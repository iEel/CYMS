import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { ensureDocumentSequences, nextDocumentNumber } from '@/lib/documentNumber';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = Number(searchParams.get('yard_id') || 1);
    const db = await getDb();
    await ensureDocumentSequences(db);

    const result = await db.request()
      .input('yardId', sql.Int, yardId)
      .query(`
        SELECT sequence_id, yard_id, document_type, sequence_year, sequence_month, prefix, next_number, padding, updated_at
        FROM DocumentSequences
        WHERE yard_id = @yardId
        ORDER BY sequence_year DESC, sequence_month DESC, document_type
      `);

    return NextResponse.json({ sequences: result.recordset });
  } catch (error) {
    console.error('GET document numbering error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงเลขเอกสารได้' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const yardId = Number(body.yard_id || 1);
    const documentType = String(body.document_type || '').trim();
    const prefix = String(body.prefix || '').trim().toUpperCase();
    const year = body.year ? Number(body.year) : new Date().getFullYear();
    const month = body.month ? Number(body.month) : new Date().getMonth() + 1;
    const padding = body.padding ? Number(body.padding) : 6;

    if (!documentType || !prefix) {
      return NextResponse.json({ error: 'document_type และ prefix จำเป็นต้องระบุ' }, { status: 400 });
    }

    const db = await getDb();
    const documentNumber = await nextDocumentNumber({ db, yardId, documentType, prefix, year, month, padding });
    return NextResponse.json({ document_number: documentNumber });
  } catch (error) {
    console.error('POST document numbering error:', error);
    return NextResponse.json({ error: 'ไม่สามารถออกเลขเอกสารได้' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const yardId = Number(body.yard_id || 1);
    const documentType = String(body.document_type || '').trim();
    const prefix = String(body.prefix || '').trim().toUpperCase();
    const year = body.sequence_year ? Number(body.sequence_year) : new Date().getFullYear();
    const month = Math.min(Math.max(Number(body.sequence_month || new Date().getMonth() + 1), 1), 12);
    const nextNumber = Math.max(Number(body.next_number || 1), 1);
    const padding = Math.min(Math.max(Number(body.padding || 6), 3), 10);

    if (!documentType || !prefix) {
      return NextResponse.json({ error: 'document_type และ prefix จำเป็นต้องระบุ' }, { status: 400 });
    }

    const db = await getDb();
    await ensureDocumentSequences(db);
    const result = await db.request()
      .input('yardId', sql.Int, yardId)
      .input('documentType', sql.NVarChar(30), documentType)
      .input('year', sql.Int, year)
      .input('month', sql.Int, month)
      .input('prefix', sql.NVarChar(20), prefix)
      .input('nextNumber', sql.Int, nextNumber)
      .input('padding', sql.Int, padding)
      .query(`
        IF EXISTS (
          SELECT 1 FROM DocumentSequences
          WHERE yard_id = @yardId AND document_type = @documentType AND sequence_year = @year AND sequence_month = @month
        )
        BEGIN
          UPDATE DocumentSequences
          SET prefix = @prefix, next_number = @nextNumber, padding = @padding, updated_at = GETDATE()
          OUTPUT INSERTED.*
          WHERE yard_id = @yardId AND document_type = @documentType AND sequence_year = @year AND sequence_month = @month;
        END
        ELSE
        BEGIN
          INSERT INTO DocumentSequences (yard_id, document_type, sequence_year, sequence_month, prefix, next_number, padding)
          OUTPUT INSERTED.*
          VALUES (@yardId, @documentType, @year, @month, @prefix, @nextNumber, @padding);
        END
      `);

    return NextResponse.json({ success: true, sequence: result.recordset[0] });
  } catch (error) {
    console.error('PUT document numbering error:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกเลขเอกสารได้' }, { status: 500 });
  }
}
