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

function snapshotJsonFrom(snapshot: unknown): string {
  try {
    return JSON.stringify(snapshot ?? {});
  } catch {
    throw new Error('snapshot_json is not serializable');
  }
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
  const reprintReason = String(options.reprintReason || '').trim() || null;
  const manualPreprintedFormNo = String(options.manualPreprintedFormNo || '').trim() || null;
  const documentNo = String(options.documentNo || '').trim() || null;
  const snapshotJson = snapshotJsonFrom(options.snapshot);

  const result = await db.request()
    .input('documentType', sql.NVarChar(50), options.documentType)
    .input('documentId', sql.Int, options.documentId)
    .input('documentNo', sql.NVarChar(100), documentNo)
    .input('templateCode', sql.NVarChar(80), options.templateCode)
    .input('templateVersion', sql.Int, options.templateVersion)
    .input('reprintReason', sql.NVarChar(500), reprintReason)
    .input('manualPreprintedFormNo', sql.NVarChar(100), manualPreprintedFormNo)
    .input('mode', sql.NVarChar(20), options.mode)
    .input('copyMode', sql.NVarChar(20), options.copyMode)
    .input('printedBy', sql.Int, options.printedBy || null)
    .input('ipAddress', sql.NVarChar(100), options.ipAddress || null)
    .input('userAgent', sql.NVarChar(500), options.userAgent || null)
    .input('snapshotJson', sql.NVarChar(sql.MAX), snapshotJson)
    .input('requireReprintReason', sql.Bit, options.requireReprintReason ? 1 : 0)
    .query(`
      SET XACT_ABORT ON;
      SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

      BEGIN TRY
        BEGIN TRAN;

        DECLARE @existingPrintCount INT;
        DECLARE @printNo INT;
        DECLARE @isReprint BIT;
        DECLARE @reprintCount INT;
        DECLARE @insertedPrint TABLE (print_id BIGINT);

        SELECT @existingPrintCount = COUNT(*)
        FROM DocumentPrintLogs WITH (UPDLOCK, HOLDLOCK)
        WHERE document_type = @documentType
          AND document_id = @documentId;

        SET @existingPrintCount = ISNULL(@existingPrintCount, 0);
        SET @printNo = @existingPrintCount + 1;
        SET @isReprint = CASE WHEN @printNo > 1 THEN 1 ELSE 0 END;
        SET @reprintCount = @existingPrintCount;

        IF @requireReprintReason = 1
          AND @isReprint = 1
          AND NULLIF(LTRIM(RTRIM(ISNULL(@reprintReason, N''))), N'') IS NULL
        BEGIN
          ROLLBACK TRAN;
          SELECT
            CAST(0 AS BIT) AS success,
            N'reprint reason is required' AS error;
          RETURN;
        END;

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
        OUTPUT INSERTED.print_id INTO @insertedPrint
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
        );

      INSERT INTO DocumentPrintSnapshots (
        print_id,
        document_type,
        document_id,
        document_no,
        template_code,
        template_version,
        snapshot_json
      )
        SELECT
          print_id,
        @documentType,
        @documentId,
        @documentNo,
        @templateCode,
        @templateVersion,
        @snapshotJson
        FROM @insertedPrint;

        COMMIT TRAN;

        SELECT
          CAST(1 AS BIT) AS success,
          @printNo AS print_no,
          @isReprint AS is_reprint,
          @reprintCount AS reprint_count;
      END TRY
      BEGIN CATCH
        IF @@TRANCOUNT > 0
          ROLLBACK TRAN;
        THROW;
      END CATCH
    `);

  const row = result.recordset?.[0] || {};
  if (row.error) {
    throw new Error(String(row.error));
  }

  const state = {
    print_no: Number(row.print_no || 0),
    is_reprint: row.is_reprint === true || row.is_reprint === 1,
    reprint_count: Number(row.reprint_count || 0),
  };

  if (state.is_reprint && options.showReprintLabel && options.reprintLabelTemplate) {
    return {
      ...state,
      reprint_label: buildReprintLabel(options.reprintLabelTemplate, state.reprint_count),
    };
  }

  return state;
}
