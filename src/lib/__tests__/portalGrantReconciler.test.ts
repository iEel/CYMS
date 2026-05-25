import {
  buildPortalExpectedGrantsSql,
  previewPortalEntityAccessGrants,
  repairPortalEntityAccessGrants,
} from '../portalGrantReconciler';

function makeDb(recordsets: Array<Array<Record<string, unknown>>> = []) {
  const query = jest.fn().mockImplementation(() => Promise.resolve({
    recordset: recordsets.shift() || [],
    rowsAffected: [0],
  }));
  const input = jest.fn().mockReturnThis();
  const request = jest.fn(() => ({ input, query }));
  return { request, input, query };
}

describe('portal grant reconciler', () => {
  it('builds expected grants from fixed owner, billing, booking, and invoice sources', () => {
    const sql = buildPortalExpectedGrantsSql();

    expect(sql).toContain('FROM Bookings b');
    expect(sql).toContain('FROM Containers c');
    expect(sql).toContain('FROM BookingContainers bc');
    expect(sql).toContain('FROM GateTransactions gt');
    expect(sql).toContain('FROM Invoices i');
    expect(sql).toContain("'owner'");
    expect(sql).toContain("'billing'");
    expect(sql).toContain("'booking_customer'");
    expect(sql).toContain("'invoice_customer'");
  });

  it('includes GateTransactions booking_customer expected grants for gate, EIR, and container targets', () => {
    const sql = buildPortalExpectedGrantsSql();

    expect(sql).toMatch(/FROM\s+GateTransactions\s+gt[\s\S]*bookingGateCustomer/i);
    expect(sql).toMatch(/bookingGateCustomer\.customer_id[\s\S]*target\.entity_type[\s\S]*CAST\(N'booking_customer'\s+AS\s+NVARCHAR\(40\)\)\s+AS\s+access_role[\s\S]*CAST\(N'GateTransactions'\s+AS\s+NVARCHAR\(80\)\)\s+AS\s+source_table/i);
    expect(sql).toContain('COALESCE(gt.booking_customer_id, b.booking_customer_id, b.customer_id)');
    expect(sql).toMatch(/bookingGateCustomer[\s\S]*CAST\(N'booking_customer'\s+AS\s+NVARCHAR\(40\)\)/i);
    expect(sql).toMatch(/CAST\(N'gate_transaction'\s+AS\s+NVARCHAR\(40\)\),\s+gt\.transaction_id,\s+gt\.eir_number/i);
    expect(sql).toMatch(/CAST\(N'eir'\s+AS\s+NVARCHAR\(40\)\),\s+gt\.transaction_id,\s+gt\.eir_number/i);
    expect(sql).toMatch(/CAST\(N'container'\s+AS\s+NVARCHAR\(40\)\),\s+gt\.container_id,\s+c\.container_number/i);
  });

  it('previews missing and stale PortalEntityAccess grants', async () => {
    const db = makeDb([
      [{ customer_id: 3, entity_type: 'container', entity_id: 9, access_role: 'owner' }],
      [{ access_id: 21, customer_id: 5, entity_type: 'invoice', entity_id: 10, access_role: 'invoice_customer' }],
    ]);

    const preview = await previewPortalEntityAccessGrants(db);

    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.input).toHaveBeenCalledWith('limit', expect.anything(), 500);
    expect(db.query.mock.calls[0][0]).toContain('MissingGrants');
    expect(db.query.mock.calls[1][0]).toContain('StaleGrants');
    expect(preview.summary).toEqual({ missing_count: 1, stale_count: 1 });
  });

  it('repairs by inserting expected grants and deactivating managed stale grants', async () => {
    const db = makeDb([
      [{ customer_id: 3, entity_type: 'booking', entity_id: 8, access_role: 'booking_customer' }],
      [{ access_id: 22, customer_id: 4, entity_type: 'container', entity_id: 11, access_role: 'billing' }],
      [],
      [],
      [],
      [],
    ]);

    const repair = await repairPortalEntityAccessGrants(db);

    const combinedSql = db.query.mock.calls.map(([statement]) => statement).join('\n');
    expect(combinedSql).toContain('INSERT INTO PortalEntityAccess');
    expect(combinedSql).toContain('UPDATE pea');
    expect(combinedSql).toContain('pea.source_table IN');
    expect(repair.repaired_missing).toBe(1);
    expect(repair.deactivated_stale).toBe(1);
  });
});
