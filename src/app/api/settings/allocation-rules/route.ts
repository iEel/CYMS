import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

const SETTING_KEY = 'allocation_rules';

// GET — Retrieve allocation rules
export async function GET() {
  try {
    const db = await getDb();
    const result = await db.request().query(
      `SELECT setting_value FROM SystemSettings WHERE setting_key = '${SETTING_KEY}'`
    );

    if (result.recordset.length > 0) {
      return NextResponse.json(JSON.parse(result.recordset[0].setting_value));
    }

    // Return default rules if none saved
    return NextResponse.json({ rules: null });
  } catch (error) {
    console.error('❌ GET allocation-rules error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลได้' }, { status: 500 });
  }
}

// PUT — Save allocation rules
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { rules } = body;

    if (!rules || !Array.isArray(rules)) {
      return NextResponse.json({ error: 'กรุณาส่งข้อมูล rules' }, { status: 400 });
    }

    const db = await getDb();
    const jsonValue = JSON.stringify({ rules });

    await db.request()
      .input('key', sql.NVarChar, SETTING_KEY)
      .input('value', sql.NVarChar, jsonValue)
      .query(`
        IF EXISTS (SELECT 1 FROM SystemSettings WHERE setting_key = @key)
          UPDATE SystemSettings SET setting_value = @value, updated_at = GETDATE() WHERE setting_key = @key
        ELSE
          INSERT INTO SystemSettings (setting_key, setting_value) VALUES (@key, @value)
      `);

    return NextResponse.json({ success: true, message: 'บันทึกกฎจัดตู้สำเร็จ' });
  } catch (error) {
    console.error('❌ PUT allocation-rules error:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกได้' }, { status: 500 });
  }
}
