import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

// GET — ดึงข้อมูลบริษัท
export async function GET() {
  try {
    const db = await getDb();
    const result = await db.request().query('SELECT TOP 1 * FROM CompanyProfile');
    return NextResponse.json(result.recordset[0] || null);
  } catch (error) {
    console.error('❌ GET company error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลบริษัทได้' }, { status: 500 });
  }
}

// POST — บันทึก/อัปเดตข้อมูลบริษัท
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = await getDb();

    // ตรวจว่ามี record อยู่แล้วหรือไม่
    const existing = await db.request().query('SELECT company_id FROM CompanyProfile');

    if (existing.recordset.length > 0) {
      // อัปเดต
      await db.request()
        .input('companyName', sql.NVarChar, body.company_name)
        .input('taxId', sql.NVarChar, body.tax_id || null)
        .input('address', sql.NVarChar, body.address || null)
        .input('phone', sql.NVarChar, body.phone || null)
        .input('email', sql.NVarChar, body.email || null)
        .input('logoUrl', sql.NVarChar, body.logo_url || null)
        .input('id', sql.Int, existing.recordset[0].company_id)
        .query(`
          UPDATE CompanyProfile SET
            company_name = @companyName, tax_id = @taxId, address = @address,
            phone = @phone, email = @email, logo_url = @logoUrl, updated_at = GETDATE()
          WHERE company_id = @id
        `);
    } else {
      // สร้างใหม่
      await db.request()
        .input('companyName', sql.NVarChar, body.company_name)
        .input('taxId', sql.NVarChar, body.tax_id || null)
        .input('address', sql.NVarChar, body.address || null)
        .input('phone', sql.NVarChar, body.phone || null)
        .input('email', sql.NVarChar, body.email || null)
        .input('logoUrl', sql.NVarChar, body.logo_url || null)
        .query(`
          INSERT INTO CompanyProfile (company_name, tax_id, address, phone, email, logo_url)
          VALUES (@companyName, @taxId, @address, @phone, @email, @logoUrl)
        `);
    }

    const result = await db.request().query('SELECT TOP 1 * FROM CompanyProfile');
    return NextResponse.json({ success: true, data: result.recordset[0] });
  } catch (error) {
    console.error('❌ POST company error:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกข้อมูลบริษัทได้' }, { status: 500 });
  }
}
