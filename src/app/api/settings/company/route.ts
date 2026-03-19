import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';

// Auto-migrate: add branch columns if missing
async function ensureBranchColumns(db: Awaited<ReturnType<typeof getDb>>) {
  try {
    await db.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CompanyProfile') AND name = 'branch_type')
        ALTER TABLE CompanyProfile ADD branch_type NVARCHAR(20) DEFAULT 'head_office';
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CompanyProfile') AND name = 'branch_number')
        ALTER TABLE CompanyProfile ADD branch_number NVARCHAR(10) DEFAULT '00000';
    `);
  } catch { /* columns may already exist */ }
}

// GET — ดึงข้อมูลบริษัท
export async function GET() {
  try {
    const db = await getDb();
    await ensureBranchColumns(db);
    const result = await db.request().query(`
      SELECT company_id, company_name, tax_id, address, phone, email, logo_url,
             ISNULL(branch_type, 'head_office') as branch_type,
             ISNULL(branch_number, '00000') as branch_number
      FROM CompanyProfile
    `);
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
    await ensureBranchColumns(db);

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
        .input('branchType', sql.NVarChar, body.branch_type || 'head_office')
        .input('branchNumber', sql.NVarChar, body.branch_number || '00000')
        .input('id', sql.Int, existing.recordset[0].company_id)
        .query(`
          UPDATE CompanyProfile SET
            company_name = @companyName, tax_id = @taxId, address = @address,
            phone = @phone, email = @email, logo_url = @logoUrl,
            branch_type = @branchType, branch_number = @branchNumber,
            updated_at = GETDATE()
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
        .input('branchType', sql.NVarChar, body.branch_type || 'head_office')
        .input('branchNumber', sql.NVarChar, body.branch_number || '00000')
        .query(`
          INSERT INTO CompanyProfile (company_name, tax_id, address, phone, email, logo_url, branch_type, branch_number)
          VALUES (@companyName, @taxId, @address, @phone, @email, @logoUrl, @branchType, @branchNumber)
        `);
    }

    const result = await db.request().query(`
      SELECT company_id, company_name, tax_id, address, phone, email, logo_url,
             ISNULL(branch_type, 'head_office') as branch_type,
             ISNULL(branch_number, '00000') as branch_number
      FROM CompanyProfile
    `);
    return NextResponse.json({ success: true, data: result.recordset[0] });
  } catch (error) {
    console.error('❌ POST company error:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึกข้อมูลบริษัทได้' }, { status: 500 });
  }
}
