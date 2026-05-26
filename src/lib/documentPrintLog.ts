import sql from 'mssql';

export interface DocumentPrintState {
  print_no: number;
  is_reprint: boolean;
  reprint_count: number;
}

export interface DocumentPrintLogDbRequest {
  input(name: string, type: unknown, value: unknown): DocumentPrintLogDbRequest;
  query(statement: string): Promise<{ recordset?: Array<Record<string, unknown>> }>;
}

export interface DocumentPrintLogDb {
  request(): DocumentPrintLogDbRequest;
}

export function calculatePrintState(existingPrintCount: number): DocumentPrintState {
  const printCount = Math.max(0, Math.floor(existingPrintCount));
  const printNo = printCount + 1;

  return {
    print_no: printNo,
    is_reprint: printNo > 1,
    reprint_count: printCount,
  };
}

export function buildReprintLabel(template: string, reprintCount: number): string {
  return template.replace(/\{reprint_count\}/g, String(reprintCount));
}

export async function countDocumentPrints(
  db: DocumentPrintLogDb,
  documentType: string,
  documentId: number,
): Promise<number> {
  const result = await db.request()
    .input('documentType', sql.NVarChar(80), documentType)
    .input('documentId', sql.Int, documentId)
    .query(`
      SELECT COUNT(*) AS print_count
      FROM DocumentPrintLogs
      WHERE document_type = @documentType
        AND document_id = @documentId
    `);

  return Number(result.recordset?.[0]?.print_count || 0);
}
