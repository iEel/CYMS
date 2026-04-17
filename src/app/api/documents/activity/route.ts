import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { ensureDocumentLifecycle } from '@/lib/documentLifecycle';
import { formatDocumentActivity } from '@/lib/documentActivity';

function inferDocumentType(documentNumber: string | null) {
  const value = (documentNumber || '').toUpperCase();
  if (value.startsWith('EIR')) return 'eir';
  if (value.startsWith('INV')) return 'invoice';
  if (value.startsWith('CN')) return 'credit_note';
  if (value.startsWith('REC') || value.startsWith('RCP')) return 'receipt';
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentNumber = searchParams.get('document_number');
    const documentType = searchParams.get('document_type') || inferDocumentType(documentNumber);
    const documentId = searchParams.get('document_id') ? Number(searchParams.get('document_id')) : null;
    const yardId = searchParams.get('yard_id') ? Number(searchParams.get('yard_id')) : null;
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 50), 1), 200);

    if (!documentNumber && !documentId) {
      return NextResponse.json({ error: 'ต้องระบุ document_number หรือ document_id' }, { status: 400 });
    }

    const db = await getDb();
    await ensureDocumentLifecycle(db);

    const result = await db.request()
      .input('documentType', sql.VarChar(30), documentType)
      .input('documentId', sql.Int, documentId)
      .input('documentNumber', sql.NVarChar(80), documentNumber)
      .input('yardId', sql.Int, yardId)
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit)
          dl.lifecycle_id, dl.document_type, dl.document_id, dl.document_number,
          dl.event_type, dl.metadata, dl.created_at,
          u.full_name as user_name, y.yard_name
        FROM DocumentLifecycle dl
        LEFT JOIN Users u ON dl.user_id = u.user_id
        LEFT JOIN Yards y ON dl.yard_id = y.yard_id
        WHERE (@documentType IS NULL OR dl.document_type = @documentType)
          AND (@yardId IS NULL OR dl.yard_id = @yardId)
          AND (
            (@documentId IS NOT NULL AND dl.document_id = @documentId)
            OR (@documentNumber IS NOT NULL AND dl.document_number = @documentNumber)
          )
        ORDER BY dl.created_at ASC, dl.lifecycle_id ASC
      `);

    return NextResponse.json({
      document_type: documentType,
      document_id: documentId,
      document_number: documentNumber,
      events: formatDocumentActivity(result.recordset),
    });
  } catch (error) {
    console.error('❌ GET document activity error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึง Activity Feed เอกสารได้' }, { status: 500 });
  }
}
