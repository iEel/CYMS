import {
  buildContinuousPrintPayload,
  buildSampleContinuousPrintPayload,
} from '@/lib/billingContinuousPrint';

function makeDb(recordset: unknown[]) {
  const inputs: Array<[string, unknown, unknown]> = [];
  const query = jest.fn().mockResolvedValue({ recordset });
  const input = jest.fn().mockImplementation((name: string, type: unknown, value: unknown) => {
    inputs.push([name, type, value]);
    return chain;
  });
  const chain = { input, query };

  return {
    request: jest.fn(() => chain),
    inputs,
    query,
  };
}

describe('continuous billing print payload', () => {
  it('builds a sample tax invoice payload with template binding keys', () => {
    const payload = buildSampleContinuousPrintPayload();

    expect(payload.document.document_title).toContain('ใบกำกับภาษี');
    expect(payload.document.receipt_number).toBeDefined();
    expect(payload.lines.length).toBeGreaterThan(0);
    expect(payload.lines[0].qty).toBeGreaterThan(0);
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
      },
    ]);

    const payload = await buildContinuousPrintPayload(db, { invoiceId: 7, type: 'receipt' });

    expect(db.inputs).toContainEqual(['invoiceId', expect.anything(), 7]);
    expect(payload.document.document_title).toContain('ใบเสร็จรับเงิน');
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

  it('throws when the invoice is missing', async () => {
    const db = makeDb([]);

    await expect(buildContinuousPrintPayload(db, { invoiceId: 7, type: 'receipt' }))
      .rejects.toThrow('Invoice not found');
  });
});
