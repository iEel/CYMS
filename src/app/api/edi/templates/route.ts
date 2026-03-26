import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { logAudit } from '@/lib/audit';

// GET — list all templates
export async function GET() {
  try {
    const db = await getDb();
    const result = await db.request().query(`
      SELECT * FROM EDITemplates WHERE is_active = 1 ORDER BY is_system DESC, template_name
    `);
    return NextResponse.json({ templates: result.recordset });
  } catch (error) {
    console.error('❌ GET templates error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึง templates ได้' }, { status: 500 });
  }
}

// POST — create template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { template_name, base_format, description, field_mapping, csv_delimiter, date_format, edifact_version, edifact_sender } = body;

    if (!template_name || !base_format) {
      return NextResponse.json({ error: 'กรุณาระบุชื่อ template และ format' }, { status: 400 });
    }

    const db = await getDb();
    const result = await db.request()
      .input('name', sql.NVarChar, template_name)
      .input('format', sql.NVarChar, base_format)
      .input('desc', sql.NVarChar, description || null)
      .input('fields', sql.NVarChar, typeof field_mapping === 'string' ? field_mapping : JSON.stringify(field_mapping))
      .input('delimiter', sql.NVarChar, csv_delimiter || ',')
      .input('dateFormat', sql.NVarChar, date_format || 'DD/MM/YYYY HH:mm')
      .input('edifactVer', sql.NVarChar, edifact_version || 'D:95B:UN')
      .input('edifactSender', sql.NVarChar, edifact_sender || null)
      .query(`
        INSERT INTO EDITemplates (template_name, base_format, description, field_mapping, csv_delimiter, date_format, edifact_version, edifact_sender)
        OUTPUT INSERTED.*
        VALUES (@name, @format, @desc, @fields, @delimiter, @dateFormat, @edifactVer, @edifactSender)
      `);

    await logAudit({
      userId: null, yardId: 1,
      action: 'edi_template_create',
      entityType: 'edi_template',
      entityId: result.recordset[0].template_id,
      details: { template_name, base_format },
    });

    return NextResponse.json({ success: true, template: result.recordset[0] });
  } catch (error) {
    console.error('❌ POST template error:', error);
    return NextResponse.json({ error: 'ไม่สามารถสร้าง template ได้' }, { status: 500 });
  }
}

// PUT — update template
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { template_id, template_name, base_format, description, field_mapping, csv_delimiter, date_format, edifact_version, edifact_sender } = body;

    if (!template_id) {
      return NextResponse.json({ error: 'กรุณาระบุ template_id' }, { status: 400 });
    }

    const db = await getDb();

    // Check if system template
    const check = await db.request().input('id', sql.Int, template_id)
      .query('SELECT is_system FROM EDITemplates WHERE template_id = @id');
    if (check.recordset[0]?.is_system) {
      return NextResponse.json({ error: 'ไม่สามารถแก้ไข System Template ได้' }, { status: 403 });
    }

    await db.request()
      .input('id', sql.Int, template_id)
      .input('name', sql.NVarChar, template_name)
      .input('format', sql.NVarChar, base_format)
      .input('desc', sql.NVarChar, description || null)
      .input('fields', sql.NVarChar, typeof field_mapping === 'string' ? field_mapping : JSON.stringify(field_mapping))
      .input('delimiter', sql.NVarChar, csv_delimiter || ',')
      .input('dateFormat', sql.NVarChar, date_format || 'DD/MM/YYYY HH:mm')
      .input('edifactVer', sql.NVarChar, edifact_version || 'D:95B:UN')
      .input('edifactSender', sql.NVarChar, edifact_sender || null)
      .query(`
        UPDATE EDITemplates SET
          template_name = @name, base_format = @format, description = @desc,
          field_mapping = @fields, csv_delimiter = @delimiter, date_format = @dateFormat,
          edifact_version = @edifactVer, edifact_sender = @edifactSender,
          updated_at = GETDATE()
        WHERE template_id = @id
      `);

    await logAudit({
      userId: null, yardId: 1,
      action: 'edi_template_update',
      entityType: 'edi_template',
      entityId: template_id,
      details: { template_name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ PUT template error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดต template ได้' }, { status: 500 });
  }
}

// DELETE — remove template (not system templates)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = parseInt(searchParams.get('template_id') || '0');

    if (!templateId) {
      return NextResponse.json({ error: 'กรุณาระบุ template_id' }, { status: 400 });
    }

    const db = await getDb();

    // Check if system template
    const check = await db.request().input('id', sql.Int, templateId)
      .query('SELECT is_system, template_name FROM EDITemplates WHERE template_id = @id');
    if (!check.recordset[0]) {
      return NextResponse.json({ error: 'ไม่พบ template' }, { status: 404 });
    }
    if (check.recordset[0].is_system) {
      return NextResponse.json({ error: 'ไม่สามารถลบ System Template ได้' }, { status: 403 });
    }

    // Check if in use
    const usage = await db.request().input('id', sql.Int, templateId)
      .query('SELECT COUNT(*) as cnt FROM EDIEndpoints WHERE template_id = @id');
    if (usage.recordset[0].cnt > 0) {
      return NextResponse.json({ error: `Template นี้ถูกใช้อยู่ใน ${usage.recordset[0].cnt} endpoint(s) — กรุณาเปลี่ยน template ก่อนลบ` }, { status: 400 });
    }

    await db.request().input('id', sql.Int, templateId)
      .query('DELETE FROM EDITemplates WHERE template_id = @id');

    await logAudit({
      userId: null, yardId: 1,
      action: 'edi_template_delete',
      entityType: 'edi_template',
      entityId: templateId,
      details: { template_name: check.recordset[0].template_name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ DELETE template error:', error);
    return NextResponse.json({ error: 'ไม่สามารถลบ template ได้' }, { status: 500 });
  }
}
