import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { ensureDocumentLifecycle } from '@/lib/documentLifecycle';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentType = searchParams.get('document_type');
    const documentId = searchParams.get('document_id');
    const documentNumber = searchParams.get('document_number');

    if (!documentType || (!documentId && !documentNumber)) {
      return NextResponse.json({ error: 'ต้องระบุ document_type และ document_id หรือ document_number' }, { status: 400 });
    }

    const db = await getDb();
    await ensureDocumentLifecycle(db);

    const req = db.request()
      .input('documentType', sql.NVarChar(30), documentType);
    const conditions = ['document_type = @documentType'];

    if (documentId) {
      conditions.push('document_id = @documentId');
      req.input('documentId', sql.Int, parseInt(documentId));
    } else if (documentNumber) {
      conditions.push('document_number = @documentNumber');
      req.input('documentNumber', sql.NVarChar(80), documentNumber);
    }

    const result = await req.query(`
      SELECT dl.*, u.full_name as user_name, y.yard_name
      FROM DocumentLifecycle dl
      LEFT JOIN Users u ON dl.user_id = u.user_id
      LEFT JOIN Yards y ON dl.yard_id = y.yard_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY dl.created_at ASC, dl.lifecycle_id ASC
    `);

    return NextResponse.json({ lifecycle: result.recordset });
  } catch (error) {
    console.error('❌ GET document lifecycle error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึง Document Lifecycle ได้' }, { status: 500 });
  }
}
