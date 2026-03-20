import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Auto-migrate: add branch + shipping_line_code columns if missing
async function ensureColumns(pool: Awaited<ReturnType<typeof getDb>>) {
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Customers') AND name = 'branch_type')
        ALTER TABLE Customers ADD branch_type NVARCHAR(20) DEFAULT 'head_office';
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Customers') AND name = 'branch_number')
        ALTER TABLE Customers ADD branch_number NVARCHAR(10) DEFAULT '00000';
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Customers') AND name = 'shipping_line_code')
        ALTER TABLE Customers ADD shipping_line_code NVARCHAR(50) NULL;
    `);
  } catch { /* columns may already exist */ }
}

// GET — List all customers
export async function GET() {
  try {
    const pool = await getDb();
    await ensureColumns(pool);
    const result = await pool.request().query(`
      SELECT customer_id, customer_name, customer_type, tax_id, address,
             contact_name, contact_phone, contact_email, credit_term,
             ISNULL(branch_type, 'head_office') as branch_type,
             ISNULL(branch_number, '00000') as branch_number,
             ISNULL(shipping_line_code, '') as shipping_line_code,
             is_active, created_at
      FROM Customers
      ORDER BY customer_name
    `);
    return NextResponse.json(result.recordset);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — Create new customer
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customer_name, customer_type, tax_id, address, contact_name, contact_phone, contact_email, credit_term, branch_type, branch_number, shipping_line_code } = body;
    if (!customer_name || !customer_type) {
      return NextResponse.json({ error: 'customer_name and customer_type required' }, { status: 400 });
    }
    const pool = await getDb();
    await ensureColumns(pool);
    const result = await pool.request()
      .input('customer_name', customer_name)
      .input('customer_type', customer_type || 'general')
      .input('tax_id', tax_id || '')
      .input('address', address || '')
      .input('contact_name', contact_name || '')
      .input('contact_phone', contact_phone || '')
      .input('contact_email', contact_email || '')
      .input('credit_term', credit_term || 0)
      .input('branch_type', branch_type || 'head_office')
      .input('branch_number', branch_number || '00000')
      .input('shipping_line_code', shipping_line_code || '')
      .query(`
        INSERT INTO Customers (customer_name, customer_type, tax_id, address, contact_name, contact_phone, contact_email, credit_term, branch_type, branch_number, shipping_line_code)
        OUTPUT INSERTED.*
        VALUES (@customer_name, @customer_type, @tax_id, @address, @contact_name, @contact_phone, @contact_email, @credit_term, @branch_type, @branch_number, @shipping_line_code)
      `);
    return NextResponse.json({ success: true, data: result.recordset[0] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT — Update customer
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { customer_id, customer_name, customer_type, tax_id, address, contact_name, contact_phone, contact_email, credit_term, branch_type, branch_number, shipping_line_code, is_active } = body;
    if (!customer_id) {
      return NextResponse.json({ error: 'customer_id required' }, { status: 400 });
    }
    const pool = await getDb();
    await pool.request()
      .input('customer_id', customer_id)
      .input('customer_name', customer_name)
      .input('customer_type', customer_type)
      .input('tax_id', tax_id || '')
      .input('address', address || '')
      .input('contact_name', contact_name || '')
      .input('contact_phone', contact_phone || '')
      .input('contact_email', contact_email || '')
      .input('credit_term', credit_term || 0)
      .input('branch_type', branch_type || 'head_office')
      .input('branch_number', branch_number || '00000')
      .input('shipping_line_code', shipping_line_code || '')
      .input('is_active', is_active !== undefined ? is_active : true)
      .query(`
        UPDATE Customers
        SET customer_name = @customer_name, customer_type = @customer_type,
            tax_id = @tax_id, address = @address,
            contact_name = @contact_name, contact_phone = @contact_phone,
            contact_email = @contact_email, credit_term = @credit_term,
            branch_type = @branch_type, branch_number = @branch_number,
            shipping_line_code = @shipping_line_code,
            is_active = @is_active, updated_at = GETDATE()
        WHERE customer_id = @customer_id
      `);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE — Delete customer
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customer_id = searchParams.get('customer_id');
    if (!customer_id) {
      return NextResponse.json({ error: 'customer_id required' }, { status: 400 });
    }
    const pool = await getDb();
    // Check if customer has invoices
    const check = await pool.request().input('id', customer_id)
      .query('SELECT COUNT(*) as cnt FROM Invoices WHERE customer_id = @id');
    if (check.recordset[0].cnt > 0) {
      return NextResponse.json({ error: 'ไม่สามารถลบได้ — ลูกค้ามีใบแจ้งหนี้อยู่' }, { status: 400 });
    }
    await pool.request().input('id', customer_id)
      .query('DELETE FROM Customers WHERE customer_id = @id');
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
