import { buildReprintLabel, calculatePrintState, countDocumentPrints } from '@/lib/documentPrintLog';

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
});
