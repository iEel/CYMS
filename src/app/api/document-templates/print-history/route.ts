import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { requirePermission, requireYardAccess } from '@/lib/apiAuth';

const PERMISSION_MESSAGE = 'คุณไม่มีสิทธิ์ดูประวัติการพิมพ์เทมเพลตเอกสาร';
const ALLOWED_DOCUMENT_TYPES = new Set(['receipt', 'tax_invoice_receipt']);

type PrintHistoryRow = {
  print_id: number;
  document_type: string;
  document_id: number;
  document_no: string | null;
  template_code: string;
  template_version: number;
  print_no: number;
  is_reprint: boolean;
  reprint_count: number;
  reprint_reason: string | null;
  manual_preprinted_form_no: string | null;
  mode: string;
  copy_mode: string;
  printed_by: number | null;
  printed_by_name: string | null;
  printed_at: string;
  has_snapshot: boolean;
};

function cleanString(value: string | null): string {
  return (value || '').trim();
}

function parsePositiveInt(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseLimit(value: string | null): number {
  const parsed = parsePositiveInt(value);
  if (!parsed) return 25;
  return Math.min(100, Math.max(1, parsed));
}

async function documentPrintScope(
  db: Awaited<ReturnType<typeof getDb>>,
  documentId: number,
): Promise<{ yard_id: number } | NextResponse> {
  const result = await db.request()
    .input('documentId', sql.Int, documentId)
    .query<{ yard_id?: number }>(`
      SELECT TOP 1 yard_id
      FROM Invoices
      WHERE invoice_id = @documentId
    `);

  const row = result.recordset[0];
  if (!row) return NextResponse.json({ error: 'invoice not found' }, { status: 404 });
  return { yard_id: Number(row.yard_id) };
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const actor = await requirePermission(request, db, 'document_templates.view', PERMISSION_MESSAGE);
    if (actor instanceof NextResponse) return actor;

    const { searchParams } = request.nextUrl;
    const templateCode = cleanString(searchParams.get('templateCode'));
    const templateVersion = parsePositiveInt(searchParams.get('templateVersion'));
    const documentType = cleanString(searchParams.get('documentType')) || null;
    const documentIdText = searchParams.get('documentId');
    const documentId = parsePositiveInt(documentIdText);
    const limit = parseLimit(searchParams.get('limit'));

    if (!templateCode || !templateVersion) {
      return NextResponse.json({ error: 'templateCode and templateVersion are required' }, { status: 400 });
    }

    if (documentIdText !== null && documentIdText.trim() !== '' && !documentId) {
      return NextResponse.json({ error: 'documentId must be a positive integer' }, { status: 400 });
    }

    if (documentType && !ALLOWED_DOCUMENT_TYPES.has(documentType)) {
      return NextResponse.json({ error: 'unsupported documentType' }, { status: 400 });
    }

    if (documentId) {
      const scope = await documentPrintScope(db, documentId);
      if (scope instanceof NextResponse) return scope;
      const yardAccess = await requireYardAccess(request, db, scope.yard_id);
      if (yardAccess instanceof NextResponse) return yardAccess;
    }

    const result = await db.request()
      .input('templateCode', sql.NVarChar(80), templateCode)
      .input('templateVersion', sql.Int, templateVersion)
      .input('documentType', sql.NVarChar(50), documentType)
      .input('documentId', sql.Int, documentId)
      .input('limit', sql.Int, limit)
      .input('actorUserId', sql.Int, actor.userId)
      .input('isYardManager', sql.Bit, actor.role === 'yard_manager' ? 1 : 0)
      .query<PrintHistoryRow>(`
        SELECT TOP (@limit)
          l.print_id,
          l.document_type,
          l.document_id,
          l.document_no,
          l.template_code,
          l.template_version,
          l.print_no,
          l.is_reprint,
          l.reprint_count,
          l.reprint_reason,
          l.manual_preprinted_form_no,
          l.mode,
          l.copy_mode,
          l.printed_by,
          ISNULL(u.full_name, u.username) AS printed_by_name,
          l.printed_at,
          CAST(CASE WHEN EXISTS (
            SELECT 1
            FROM DocumentPrintSnapshots s
            WHERE s.print_id = l.print_id
          ) THEN 1 ELSE 0 END AS bit) AS has_snapshot
        FROM DocumentPrintLogs l
        JOIN Invoices i ON i.invoice_id = l.document_id
        LEFT JOIN Users u ON u.user_id = l.printed_by
        LEFT JOIN UserYardAccess uya
          ON uya.user_id = @actorUserId
         AND uya.yard_id = i.yard_id
        WHERE l.template_code = @templateCode
          AND l.template_version = @templateVersion
          AND l.document_type IN ('receipt', 'tax_invoice_receipt')
          AND (@documentType IS NULL OR l.document_type = @documentType)
          AND (@documentId IS NULL OR l.document_id = @documentId)
          AND (@isYardManager = 1 OR uya.user_id IS NOT NULL)
        ORDER BY l.printed_at DESC, l.print_id DESC
      `);

    return NextResponse.json({ prints: result.recordset });
  } catch (error) {
    console.error('GET document template print history error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดูประวัติการพิมพ์เทมเพลตเอกสารได้' }, { status: 500 });
  }
}
