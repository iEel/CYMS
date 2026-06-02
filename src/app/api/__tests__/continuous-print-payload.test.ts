import {
  buildContinuousPrintPayload,
  buildSampleContinuousPrintPayload,
} from '@/lib/billingContinuousPrint';

function makeDb(recordset: unknown[]) {
  const inputs: Array<[string, unknown, unknown]> = [];
  const queries: string[] = [];
  const query = jest.fn().mockImplementation((statement: string) => {
    queries.push(statement);
    return Promise.resolve({ recordset });
  });
  const input = jest.fn().mockImplementation((name: string, type: unknown, value: unknown) => {
    inputs.push([name, type, value]);
    return chain;
  });
  const chain = { input, query };

  return {
    request: jest.fn(() => chain),
    inputs,
    queries,
    query,
  };
}

describe('continuous billing print payload', () => {
  it('builds a sample tax invoice payload with template binding keys', () => {
    const payload = buildSampleContinuousPrintPayload();

    expect(payload.company.company_name).toBeTruthy();
    expect(payload.customer.customer_name).toBeTruthy();
    expect(payload.customer.branch_name).toBeTruthy();
    expect(payload.document.document_title).toBe('ใบกำกับภาษี/ใบเสร็จรับเงิน');
    expect(payload.document.document_date).toBeTruthy();
    expect(payload.document.tax_invoice_number).toBe(payload.document.invoice_number);
    expect(payload.document.receipt_number).toBeDefined();
    expect(payload.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ description: 'CONTAINER REPAIR CHARGES', qty: 1, amount: 3105 }),
      expect.objectContaining({ description: 'DEPOT REFUND', qty: 1, amount: -110.5 }),
      expect.objectContaining({ description: 'DEPOT TRUCKING CHARGES', qty: 1, amount: 1100 }),
    ]));
    expect(payload.lines[0].qty).toBeGreaterThan(0);
    expect(payload.totals.subtotal).toBe(4094.5);
    expect(payload.totals.vat_amount).toBe(286.61);
    expect(payload.totals.grand_total).toBe(4381.11);
    expect(payload.totals.amount_text_th).toContain('บาท');
  });

  it('parses invoice notes JSON charges for receipts and preserves negative lines', async () => {
    const db = makeDb([
      {
        invoice_id: 7,
        invoice_number: 'INV-202605-000007',
        receipt_number: 'RCT-202605-000007',
        status: 'paid',
        document_type: 'invoice',
        charge_type: 'storage',
        description: 'Fallback charge',
        quantity: 1,
        unit_price: 1000,
        total_amount: 900,
        vat_amount: 63,
        grand_total: 963,
        due_date: '2026-05-31T00:00:00.000Z',
        paid_at: '2026-05-26T03:00:00.000Z',
        created_at: '2026-05-20T03:00:00.000Z',
        notes: JSON.stringify({
          payment_method: 'transfer',
          charges: [
            { description: 'STORAGE CHARGE', quantity: 1, unit_price: 1000, subtotal: 1000 },
            { description: 'DEPOT REFUND', quantity: 1, unit_price: -100, subtotal: -100 },
          ],
        }),
        customer_name: 'ACME Logistics',
        customer_tax_id: '0105559000000',
        customer_address: '99 Test Road',
        customer_branch_type: 'head_office',
        customer_branch_number: '00000',
        container_number: 'TCLU1234567',
        yard_name: 'Bangkok Yard',
        yard_code: 'BKK',
        yard_branch_type: 'branch',
        yard_branch_number: '00001',
        company_name: 'CYMS Co., Ltd.',
        company_tax_id: '0105566000001',
        company_address: '1 Port Road',
        company_phone: '02-000-0000',
        company_email: 'billing@example.test',
      },
    ]);

    const payload = await buildContinuousPrintPayload(db, { invoiceId: 7, type: 'receipt' });

    expect(db.inputs).toContainEqual(['invoiceId', expect.anything(), 7]);
    expect(db.queries.join('\n')).toContain('OUTER APPLY');
    expect(db.queries.join('\n')).toContain('CompanyProfile');
    expect(db.queries.join('\n')).toContain('cp.company_name AS company_name');
    expect(payload.company.company_name).toBe('CYMS Co., Ltd.');
    expect(payload.company.tax_id).toBe('0105566000001');
    expect(payload.company.address).toBe('1 Port Road');
    expect(payload.company.phone).toBe('02-000-0000');
    expect(payload.company.email).toBe('billing@example.test');
    expect(payload.customer.customer_name).toBe('ACME Logistics');
    expect(payload.customer.branch_name).toBe('สำนักงานใหญ่');
    expect(payload.document.document_title).toContain('ใบเสร็จรับเงิน');
    expect(payload.document.document_date).toBe('2026-05-20T03:00:00.000Z');
    expect(payload.document.tax_invoice_number).toBe('INV-202605-000007');
    expect(payload.document.receipt_number).toBe('RCT-202605-000007');
    expect(payload.totals.amount_text_th).toContain('บาท');
    expect(payload.lines[0].qty).toBe(1);
    expect(payload.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({
        description: 'DEPOT REFUND',
        qty: 1,
        unit_price: -100,
        amount: -100,
      }),
    ]));
  });

  it('falls back to the invoice row line when notes charges are malformed', async () => {
    const db = makeDb([
      {
        invoice_id: 8,
        invoice_number: 'INV-202605-000008',
        status: 'issued',
        charge_type: 'storage',
        description: 'Fallback storage charge',
        quantity: 3,
        unit_price: 200,
        total_amount: 600,
        vat_amount: 42,
        grand_total: 642,
        created_at: '2026-05-21T03:00:00.000Z',
        notes: JSON.stringify({ charges: [null, 'bad'] }),
      },
    ]);

    const payload = await buildContinuousPrintPayload(db, { invoiceId: 8, type: 'invoice' });

    expect(payload.lines).toEqual([
      expect.objectContaining({
        description: 'Fallback storage charge',
        qty: 3,
        unit_price: 200,
        amount: 600,
      }),
    ]);
  });

  it('throws when the invoice is missing', async () => {
    const db = makeDb([]);

    await expect(buildContinuousPrintPayload(db, { invoiceId: 7, type: 'receipt' }))
      .rejects.toThrow('Invoice not found');
  });
});
