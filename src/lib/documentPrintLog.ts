import sql from 'mssql';

export interface DocumentPrintState {
  print_no: number;
  is_reprint: boolean;
  reprint_count: number;
  reprint_label?: string;
}

export interface DocumentPrintLogDbRequest {
  input(name: string, type: unknown, value: unknown): DocumentPrintLogDbRequest;
  query(statement: string): Promise<{ recordset?: Array<Record<string, unknown>> }>;
}

export interface DocumentPrintLogDb {
  request(): DocumentPrintLogDbRequest;
}

export interface ReprintReasonValidationOptions {
  requireReason: boolean;
  isReprint: boolean;
  reason?: string | null;
}

export type ReprintReasonValidationResult =
  | { valid: true }
  | { valid: false; error: 'reprint reason is required' };

export interface RecordDocumentPrintOptions {
  documentType: string;
  documentId: number;
  documentNo?: string | null;
  templateCode: string;
  templateVersion: number;
  reprintReason?: string | null;
  manualPreprintedFormNo?: string | null;
  snapshot: unknown;
  mode: string;
  copyMode: string;
  printedBy?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  showReprintLabel?: boolean;
  reprintLabelTemplate?: string | null;
  requireReprintReason?: boolean;
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

export function validateReprintReason({
  requireReason,
  isReprint,
  reason,
}: ReprintReasonValidationOptions): ReprintReasonValidationResult {
  if (requireReason && isReprint && !String(reason || '').trim()) {
    return { valid: false, error: 'reprint reason is required' };
  }

  return { valid: true };
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

export async function recordDocumentPrint(
  db: DocumentPrintLogDb,
  options: RecordDocumentPrintOptions,
): Promise<DocumentPrintState> {
  const existingPrintCount = await countDocumentPrints(db, options.documentType, options.documentId);
  const state = calculatePrintState(existingPrintCount);
  const validation = validateReprintReason({
    requireReason: Boolean(options.requireReprintReason),
    isReprint: state.is_reprint,
    reason: options.reprintReason,
  });

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const reprintReason = String(options.reprintReason || '').trim() || null;
  const manualPreprintedFormNo = String(options.manualPreprintedFormNo || '').trim() || null;
  const documentNo = String(options.documentNo || '').trim() || null;
  const snapshotJson = JSON.stringify(options.snapshot ?? {});

  const printResult = await db.request()
    .input('documentType', sql.NVarChar(50), options.documentType)
    .input('documentId', sql.Int, options.documentId)
    .input('documentNo', sql.NVarChar(100), documentNo)
    .input('templateCode', sql.NVarChar(80), options.templateCode)
    .input('templateVersion', sql.Int, options.templateVersion)
    .input('printNo', sql.Int, state.print_no)
    .input('isReprint', sql.Bit, state.is_reprint ? 1 : 0)
    .input('reprintCount', sql.Int, state.reprint_count)
    .input('reprintReason', sql.NVarChar(500), reprintReason)
    .input('manualPreprintedFormNo', sql.NVarChar(100), manualPreprintedFormNo)
    .input('mode', sql.NVarChar(20), options.mode)
    .input('copyMode', sql.NVarChar(20), options.copyMode)
    .input('printedBy', sql.Int, options.printedBy || null)
    .input('ipAddress', sql.NVarChar(100), options.ipAddress || null)
    .input('userAgent', sql.NVarChar(500), options.userAgent || null)
    .query(`
      INSERT INTO DocumentPrintLogs (
        document_type,
        document_id,
        document_no,
        template_code,
        template_version,
        print_no,
        is_reprint,
        reprint_count,
        reprint_reason,
        manual_preprinted_form_no,
        mode,
        copy_mode,
        printed_by,
        ip_address,
        user_agent
      )
      OUTPUT INSERTED.print_id
      VALUES (
        @documentType,
        @documentId,
        @documentNo,
        @templateCode,
        @templateVersion,
        @printNo,
        @isReprint,
        @reprintCount,
        @reprintReason,
        @manualPreprintedFormNo,
        @mode,
        @copyMode,
        @printedBy,
        @ipAddress,
        @userAgent
      )
    `);

  const printId = Number(printResult.recordset?.[0]?.print_id);
  await db.request()
    .input('printId', sql.BigInt, printId)
    .input('documentType', sql.NVarChar(50), options.documentType)
    .input('documentId', sql.Int, options.documentId)
    .input('documentNo', sql.NVarChar(100), documentNo)
    .input('templateCode', sql.NVarChar(80), options.templateCode)
    .input('templateVersion', sql.Int, options.templateVersion)
    .input('snapshotJson', sql.NVarChar(sql.MAX), snapshotJson)
    .query(`
      INSERT INTO DocumentPrintSnapshots (
        print_id,
        document_type,
        document_id,
        document_no,
        template_code,
        template_version,
        snapshot_json
      )
      VALUES (
        @printId,
        @documentType,
        @documentId,
        @documentNo,
        @templateCode,
        @templateVersion,
        @snapshotJson
      )
    `);

  if (state.is_reprint && options.showReprintLabel && options.reprintLabelTemplate) {
    return {
      ...state,
      reprint_label: buildReprintLabel(options.reprintLabelTemplate, state.reprint_count),
    };
  }

  return state;
}
