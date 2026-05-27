import fs from 'fs';
import path from 'path';
import {
  buildReprintLabel,
  calculatePrintState,
  countDocumentPrints,
  recordDocumentPrint,
  validateReprintReason,
} from '@/lib/documentPrintLog';

describe('document print log helper', () => {
  it('calculates first print state', () => {
    expect(calculatePrintState(0)).toEqual({
      print_no: 1,
      is_reprint: false,
      reprint_count: 0,
    });
  });

  it('calculates reprint state', () => {
    expect(calculatePrintState(1)).toEqual({
      print_no: 2,
      is_reprint: true,
      reprint_count: 1,
    });
  });

  it('builds a localized reprint label', () => {
    expect(buildReprintLabel('พิมพ์ซ้ำครั้งที่ {reprint_count}', 2)).toBe('พิมพ์ซ้ำครั้งที่ 2');
  });

  it('counts document print logs with parameterized SQL', async () => {
    const query = jest.fn().mockResolvedValue({ recordset: [{ print_count: 3 }] });
    const input = jest.fn().mockReturnValue({ input: jest.fn(), query });
    input.mockReturnValue({ input, query });
    const db = { request: jest.fn(() => ({ input, query })) };

    await expect(countDocumentPrints(db, 'invoice', 42)).resolves.toBe(3);
    expect(input).toHaveBeenCalledWith('documentType', expect.anything(), 'invoice');
    expect(input).toHaveBeenCalledWith('documentId', expect.anything(), 42);
    expect(query.mock.calls[0][0]).toMatch(/FROM\s+DocumentPrintLogs/i);
    expect(query.mock.calls[0][0]).toMatch(/document_type\s*=\s*@documentType/i);
    expect(query.mock.calls[0][0]).toMatch(/document_id\s*=\s*@documentId/i);
  });

  it('requires a reprint reason only when policy and state require it', () => {
    expect(validateReprintReason({ requireReason: true, isReprint: true, reason: '  ' })).toEqual({
      valid: false,
      error: 'reprint reason is required',
    });
    expect(validateReprintReason({ requireReason: true, isReprint: false, reason: '' })).toEqual({ valid: true });
    expect(validateReprintReason({ requireReason: false, isReprint: true, reason: '' })).toEqual({ valid: true });
  });

  it('records a first print and snapshot without a reprint label', async () => {
    const queries: string[] = [];
    const inputs: Record<string, unknown>[] = [];
    const db = mockPrintLogDb([
      { recordset: [{ success: true, print_no: 1, is_reprint: false, reprint_count: 0 }] },
    ], queries, inputs);

    const result = await recordDocumentPrint(db, {
      documentType: 'tax_invoice_receipt',
      documentId: 42,
      documentNo: 'INV-42',
      templateCode: 'TAX-CTR',
      templateVersion: 3,
      snapshot: { document: { invoice_number: 'INV-42' } },
      mode: 'full',
      copyMode: 'carbonless',
      printedBy: 9,
      showReprintLabel: true,
      reprintLabelTemplate: 'REPRINT #{reprint_count}',
      requireReprintReason: true,
    });

    expect(result).toEqual({ print_no: 1, is_reprint: false, reprint_count: 0 });
    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatch(/SET\s+XACT_ABORT\s+ON/i);
    expect(queries[0]).toMatch(/SET\s+TRANSACTION\s+ISOLATION\s+LEVEL\s+SERIALIZABLE/i);
    expect(queries[0]).toMatch(/BEGIN\s+TRAN/i);
    expect(queries[0]).toMatch(/WITH\s*\(\s*UPDLOCK\s*,\s*HOLDLOCK\s*\)/i);
    expect(queries[0]).toMatch(/INSERT\s+INTO\s+DocumentPrintLogs/i);
    expect(queries[0]).toMatch(/INSERT\s+INTO\s+DocumentPrintSnapshots/i);
    expect(queries[0]).toMatch(/COMMIT\s+TRAN/i);
    expect(inputs).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'snapshotJson', value: JSON.stringify({ document: { invoice_number: 'INV-42' } }) }),
    ]));
  });

  it('records a reprint with label template when prior prints exist', async () => {
    const queries: string[] = [];
    const inputs: Record<string, unknown>[] = [];
    const invalidDb = mockPrintLogDb([
      { recordset: [{ success: false, error: 'reprint reason is required' }] },
    ], queries, inputs);

    await expect(recordDocumentPrint(invalidDb, {
      documentType: 'tax_invoice_receipt',
      documentId: 42,
      templateCode: 'TAX-CTR',
      templateVersion: 3,
      snapshot: { ok: true },
      mode: 'overlay',
      copyMode: 'separate',
      showReprintLabel: true,
      reprintLabelTemplate: 'พิมพ์ซ้ำครั้งที่ {reprint_count}',
      requireReprintReason: true,
    })).rejects.toThrow('reprint reason is required');

    const db = mockPrintLogDb([
      { recordset: [{ success: true, print_no: 2, is_reprint: true, reprint_count: 1 }] },
    ], queries, inputs);

    const result = await recordDocumentPrint(db, {
      documentType: 'tax_invoice_receipt',
      documentId: 42,
      documentNo: 'INV-42',
      templateCode: 'TAX-CTR',
      templateVersion: 3,
      snapshot: { ok: true },
      mode: 'overlay',
      copyMode: 'separate',
      reprintReason: 'customer requested copy',
      showReprintLabel: true,
      reprintLabelTemplate: 'พิมพ์ซ้ำครั้งที่ {reprint_count}',
      requireReprintReason: true,
    });

    expect(result).toEqual({
      print_no: 2,
      is_reprint: true,
      reprint_count: 1,
      reprint_label: 'พิมพ์ซ้ำครั้งที่ 1',
    });
    expect(inputs).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'reprintReason', value: 'customer requested copy' }),
    ]));
  });

  it('rejects unserializable snapshots before issuing SQL', async () => {
    const queries: string[] = [];
    const inputs: Record<string, unknown>[] = [];
    const db = mockPrintLogDb([], queries, inputs);
    const snapshot: Record<string, unknown> = {};
    snapshot.self = snapshot;

    await expect(recordDocumentPrint(db, {
      documentType: 'tax_invoice_receipt',
      documentId: 42,
      templateCode: 'TAX-CTR',
      templateVersion: 3,
      snapshot,
      mode: 'full',
      copyMode: 'carbonless',
    })).rejects.toThrow('snapshot_json is not serializable');
    expect(queries).toHaveLength(0);
    expect(inputs).toHaveLength(0);
  });
});

describe('document print history shape', () => {
  it('keeps fields needed by the template history panel', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/app/api/document-templates/print-history/route.ts'), 'utf8');
    expect(source).toContain('print_no');
    expect(source).toContain('reprint_count');
    expect(source).toContain('manual_preprinted_form_no');
    expect(source).toContain('has_snapshot');
  });
});

function mockPrintLogDb(
  responses: Array<{ recordset?: Array<Record<string, unknown>> }>,
  queries: string[],
  inputs: Record<string, unknown>[],
) {
  return {
    request: jest.fn(() => {
      const request: {
        input: jest.Mock;
        query: jest.Mock;
      } = {
        input: jest.fn((name: string, type: unknown, value: unknown) => {
          inputs.push({ name, type, value });
          return request;
        }),
        query: jest.fn(async (statement: string) => {
          queries.push(statement);
          return responses.shift() || { recordset: [] };
        }),
      };
      return request;
    }),
  };
}
