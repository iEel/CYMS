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

function expectedGrantBranchFor(sql: string, marker: string) {
  const markerIndex = sql.indexOf(marker);
  expect(markerIndex).toBeGreaterThanOrEqual(0);

  const branchStart = sql.lastIndexOf('UNION ALL', markerIndex);
  const nextBranch = sql.indexOf('UNION ALL', markerIndex);

  return sql.slice(branchStart >= 0 ? branchStart : 0, nextBranch >= 0 ? nextBranch : undefined);
}

describe('portal grant reconciler', () => {
  it('builds expected grants from fixed owner, billing, booking, and invoice sources', () => {
    const sql = buildPortalExpectedGrantsSql();

    expect(sql).toContain('FROM Bookings b');
    expect(sql).toContain('FROM Containers c');
    expect(sql).toContain('FROM BookingContainers bc');
    expect(sql).toContain('FROM GateTransactions gt');
    expect(sql).toContain('FROM Invoices i');
    expect(sql).toContain('booking_customer_id');
    expect(sql).toContain('shipping_line_id');
    expect(sql).toContain('trucking_company_id');
    expect(sql).toContain("'owner'");
    expect(sql).toContain("'billing'");
    expect(sql).toContain("'booking_customer'");
    expect(sql).toContain("'invoice_customer'");
  });

  it('includes scoped metadata and reefer grants from active container visibility', () => {
    const sql = buildPortalExpectedGrantsSql();

    expect(sql).toContain('permission_scope');
    expect(sql).toContain('valid_from');
    expect(sql).toContain('valid_until');
    expect(sql).toContain('FROM ReeferTemperatureChecks rc');
    expect(sql).toContain('FROM ReeferExceptions re');
    expect(sql).toContain("CAST(N'reefer_check' AS NVARCHAR(40)) AS entity_type");
    expect(sql).toContain("CAST(N'reefer_exception' AS NVARCHAR(40)) AS entity_type");
    expect(sql).toContain('pea.entity_type = N\'container\'');
    expect(sql).toContain('(pea.valid_from IS NULL OR pea.valid_from <= GETDATE())');
    expect(sql).toContain('(pea.valid_until IS NULL OR pea.valid_until >= GETDATE())');
  });

  it('uses default permission scope JSON for non-reefer expected grants', () => {
    const sql = buildPortalExpectedGrantsSql();

    expect(sql).not.toContain('CAST(NULL AS NVARCHAR(MAX)) AS permission_scope');
    expect(sql).toContain('"eir":{"fields":{"container_grade":false},"damage_summary":true');
    expect(sql).toContain('"download":true,"billing":{"view":false,"dispute":false}');
    expect(sql).toContain('"download":false,"billing":{"view":false,"dispute":false},"eir":{"fields":{"container_grade":false},"damage_summary":true,"damage_photos":false}');
    expect(sql).toContain('"download":true,"billing":{"view":true,"dispute":true}');
    expect(sql).toMatch(/WHEN\s+LOWER\(.*access_role.*\)\s+IN\s+\(N'trucking',\s+N'driver'\)/i);
    expect(sql).toMatch(/WHEN\s+LOWER\(.*access_role.*\)\s+IN\s+\(N'billing',\s+N'invoice_customer'\)/i);
    expect(sql).toMatch(/WHEN\s+LOWER\(.*access_role.*\)\s+IN\s+\(N'owner',\s+N'booking_customer',\s+N'shipping_line',\s+N'forwarder',\s+N'shipper',\s+N'consignee'\)/i);
  });

  it('includes GateTransactions booking_customer expected grants for gate, EIR, and container targets', () => {
    const sql = buildPortalExpectedGrantsSql();

    expect(sql).toMatch(/FROM\s+GateTransactions\s+gt[\s\S]*bookingGateCustomer/i);
    expect(sql).toMatch(/COALESCE\(gt\.booking_customer_id,\s*bookingGateCustomer\.customer_id\)\s+AS\s+customer_id[\s\S]*target\.entity_type[\s\S]*CAST\(N'booking_customer'\s+AS\s+NVARCHAR\(40\)\)\s+AS\s+access_role[\s\S]*CAST\(N'GateTransactions'\s+AS\s+NVARCHAR\(80\)\)\s+AS\s+source_table/i);
    expect(sql).toContain('COALESCE(b.booking_customer_id, b.customer_id) AS customer_id');
    expect(sql).toMatch(/WHERE\s+b\.booking_number\s*=\s*gt\.booking_ref[\s\S]*AND\s+gt\.yard_id\s+IS\s+NOT\s+NULL[\s\S]*AND\s+b\.yard_id\s*=\s*gt\.yard_id/i);
    expect(sql).not.toContain('OR gt.yard_id IS NULL OR b.yard_id IS NULL');
    expect(sql).not.toContain('COALESCE(gt.booking_customer_id, b.booking_customer_id, b.customer_id)');
    expect(sql).toMatch(/bookingGateCustomer[\s\S]*CAST\(N'booking_customer'\s+AS\s+NVARCHAR\(40\)\)/i);
    expect(sql).toContain("CAST(N'gate_transaction' AS NVARCHAR(40)) AS entity_type");
    expect(sql).toContain("CAST(N'eir' AS NVARCHAR(40)) AS entity_type");
    expect(sql).toContain("CAST(N'container' AS NVARCHAR(40)) AS entity_type");
    expect(sql).toMatch(/gt\.transaction_id\s+AS\s+entity_id,\s+gt\.eir_number\s+AS\s+entity_ref/i);
    expect(sql).toMatch(/gt\.container_id\s+AS\s+entity_id,\s+c\.container_number\s+AS\s+entity_ref/i);
  });

  it('keeps invoice expected grants limited to billing-safe roles', () => {
    const sql = buildPortalExpectedGrantsSql();
    const invoiceBranch = expectedGrantBranchFor(sql, 'FROM Invoices i');
    const accessRoles = Array.from(invoiceBranch.matchAll(/CAST\(N'([^']+)'\s+AS\s+NVARCHAR\(40\)\)\s+AS\s+access_role/g))
      .map((match) => match[1]);

    expect(invoiceBranch).toContain("CAST(N'invoice' AS NVARCHAR(40)) AS entity_type");
    expect(accessRoles.length).toBeGreaterThan(0);
    expect(accessRoles.every((role) => ['invoice_customer', 'billing'].includes(role))).toBe(true);
    expect(accessRoles).toContain('invoice_customer');
    expect(accessRoles).not.toEqual(expect.arrayContaining(['driver', 'trucking']));
    expect(invoiceBranch).not.toContain('driver_user_id');
    expect(invoiceBranch).not.toContain('trucking_company_id');
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
    expect(combinedSql).toMatch(/INSERT INTO PortalEntityAccess \([\s\S]*permission_scope[\s\S]*valid_from[\s\S]*valid_until/i);
    expect(combinedSql).toMatch(/SELECT[\s\S]*eg\.permission_scope[\s\S]*eg\.valid_from[\s\S]*eg\.valid_until/i);
    expect(combinedSql).toContain('UPDATE pea');
    expect(combinedSql).toContain('pea.source_table IN');
    expect(combinedSql).toContain("N'ReeferTemperatureChecks'");
    expect(combinedSql).toContain("N'ReeferExceptions'");
    expect(repair.repaired_missing).toBe(1);
    expect(repair.deactivated_stale).toBe(1);
  });
});
