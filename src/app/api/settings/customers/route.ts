import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { logAudit } from '@/lib/audit';

// Auto-migrate: add multi-role columns + CustomerBranches table if missing
async function ensureColumns(pool: Awaited<ReturnType<typeof getDb>>) {
  try {
    await pool.request().query(`
      -- Multi-role boolean flags
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Customers') AND name = 'is_line')
        ALTER TABLE Customers ADD is_line BIT DEFAULT 0;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Customers') AND name = 'is_forwarder')
        ALTER TABLE Customers ADD is_forwarder BIT DEFAULT 0;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Customers') AND name = 'is_trucking')
        ALTER TABLE Customers ADD is_trucking BIT DEFAULT 0;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Customers') AND name = 'is_shipper')
        ALTER TABLE Customers ADD is_shipper BIT DEFAULT 0;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Customers') AND name = 'is_consignee')
        ALTER TABLE Customers ADD is_consignee BIT DEFAULT 0;

      -- New fields
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Customers') AND name = 'customer_code')
        ALTER TABLE Customers ADD customer_code VARCHAR(20) NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Customers') AND name = 'billing_address')
        ALTER TABLE Customers ADD billing_address NVARCHAR(MAX) NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Customers') AND name = 'default_payment_type')
        ALTER TABLE Customers ADD default_payment_type VARCHAR(20) DEFAULT 'CASH';
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Customers') AND name = 'edi_prefix')
        ALTER TABLE Customers ADD edi_prefix NVARCHAR(10) NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Customers') AND name = 'credit_limit')
        ALTER TABLE Customers ADD credit_limit DECIMAL(12,2) NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Customers') AND name = 'credit_hold')
        ALTER TABLE Customers ADD credit_hold BIT NOT NULL CONSTRAINT DF_Customers_CreditHold DEFAULT 0;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Customers') AND name = 'credit_hold_reason')
        ALTER TABLE Customers ADD credit_hold_reason NVARCHAR(300) NULL;

      -- Legacy columns (keep for backward compat)
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Customers') AND name = 'branch_type')
        ALTER TABLE Customers ADD branch_type NVARCHAR(20) DEFAULT 'head_office';
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Customers') AND name = 'branch_number')
        ALTER TABLE Customers ADD branch_number NVARCHAR(10) DEFAULT '00000';
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Customers') AND name = 'shipping_line_code')
        ALTER TABLE Customers ADD shipping_line_code NVARCHAR(50) NULL;
    `);

    // Migrate legacy customer_type → boolean flags
    await pool.request().query(`
      UPDATE Customers SET is_line = 1
      WHERE customer_type = 'shipping_line' AND (is_line IS NULL OR is_line = 0);
      UPDATE Customers SET is_trucking = 1
      WHERE customer_type IN ('trucker', 'trucking') AND (is_trucking IS NULL OR is_trucking = 0);
    `);

    // Auto-generate customer_code for existing records that don't have one
    await pool.request().query(`
      UPDATE Customers SET customer_code = 'CUST-' + RIGHT('00000' + CAST(customer_id AS VARCHAR), 5)
      WHERE customer_code IS NULL OR customer_code = '';
    `);

    // Create CustomerBranches table if not exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CustomerBranches')
      BEGIN
        CREATE TABLE CustomerBranches (
          branch_id       INT PRIMARY KEY IDENTITY(1,1),
          customer_id     INT NOT NULL REFERENCES Customers(customer_id),
          branch_code     VARCHAR(10) NOT NULL DEFAULT '00000',
          branch_name     NVARCHAR(200),
          billing_address NVARCHAR(MAX),
          contact_name    NVARCHAR(100),
          contact_phone   NVARCHAR(50),
          contact_email   NVARCHAR(100),
          is_default      BIT DEFAULT 0,
          is_active       BIT DEFAULT 1,
          created_at      DATETIME2 DEFAULT GETDATE(),
          CONSTRAINT UQ_Customer_Branch UNIQUE (customer_id, branch_code)
        );
      END
    `);
  } catch { /* columns/table may already exist */ }
}

// Helper: generate next customer_code
async function generateCustomerCode(pool: Awaited<ReturnType<typeof getDb>>): Promise<string> {
  const result = await pool.request().query(`
    SELECT MAX(CAST(REPLACE(customer_code, 'CUST-', '') AS INT)) as max_num
    FROM Customers
    WHERE customer_code LIKE 'CUST-%'
  `);
  const nextNum = (result.recordset[0]?.max_num || 0) + 1;
  return 'CUST-' + String(nextNum).padStart(5, '0');
}

// GET — List all customers (with optional role filter)
export async function GET(req: NextRequest) {
  try {
    const pool = await getDb();
    await ensureColumns(pool);

    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role'); // 'line', 'forwarder', 'trucking', 'shipper', 'consignee'

    let whereClause = '';
    if (role === 'line') whereClause = 'WHERE c.is_line = 1 AND c.is_active = 1';
    else if (role === 'forwarder') whereClause = 'WHERE c.is_forwarder = 1 AND c.is_active = 1';
    else if (role === 'trucking') whereClause = 'WHERE c.is_trucking = 1 AND c.is_active = 1';
    else if (role === 'shipper') whereClause = 'WHERE c.is_shipper = 1 AND c.is_active = 1';
    else if (role === 'consignee') whereClause = 'WHERE c.is_consignee = 1 AND c.is_active = 1';

    const result = await pool.request().query(`
      SELECT c.customer_id, c.customer_code, c.customer_name,
             ISNULL(c.is_line, 0) as is_line,
             ISNULL(c.is_forwarder, 0) as is_forwarder,
             ISNULL(c.is_trucking, 0) as is_trucking,
             ISNULL(c.is_shipper, 0) as is_shipper,
             ISNULL(c.is_consignee, 0) as is_consignee,
             c.tax_id, c.address, c.billing_address,
             c.contact_name, c.contact_phone, c.contact_email,
             ISNULL(c.default_payment_type, 'CASH') as default_payment_type,
             c.credit_term, ISNULL(c.credit_limit, 0) as credit_limit,
             ISNULL(c.credit_hold, 0) as credit_hold, c.credit_hold_reason,
             c.edi_prefix,
             ISNULL(c.shipping_line_code, '') as shipping_line_code,
             c.is_active, c.created_at, c.customer_type
      FROM Customers c
      ${whereClause}
      ORDER BY c.customer_name
    `);

    // Also fetch branches for each customer
    const branches = await pool.request().query(`
      SELECT branch_id, customer_id, branch_code, branch_name,
             billing_address, contact_name, contact_phone, contact_email,
             is_default, is_active
      FROM CustomerBranches
      ORDER BY customer_id, is_default DESC, branch_code
    `);

    const branchMap: Record<number, typeof branches.recordset> = {};
    for (const b of branches.recordset) {
      if (!branchMap[b.customer_id]) branchMap[b.customer_id] = [];
      branchMap[b.customer_id].push(b);
    }

    const customers = result.recordset.map(c => ({
      ...c,
      branches: branchMap[c.customer_id] || [],
    }));

    return NextResponse.json(customers);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — Create new customer (with auto-generated customer_code)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customer_name, is_line, is_forwarder, is_trucking, is_shipper, is_consignee,
      tax_id, address, billing_address, contact_name, contact_phone, contact_email,
      default_payment_type, credit_term, credit_limit, credit_hold, credit_hold_reason,
      edi_prefix, shipping_line_code, branches } = body;

    if (!customer_name) {
      return NextResponse.json({ error: 'customer_name required' }, { status: 400 });
    }

    const pool = await getDb();
    await ensureColumns(pool);

    // Duplicate check: company name
    const dupName = await pool.request()
      .input('name', sql.NVarChar, customer_name)
      .query('SELECT COUNT(*) as cnt FROM Customers WHERE customer_name = @name');
    if (dupName.recordset[0].cnt > 0) {
      return NextResponse.json({ error: `ชื่อบริษัท "${customer_name}" มีอยู่ในระบบแล้ว — กรุณาไปแก้ไขบทบาทที่รายการเดิม` }, { status: 400 });
    }

    // Duplicate check: tax_id (if provided)
    if (tax_id) {
      const dupTax = await pool.request()
        .input('taxId', sql.NVarChar, tax_id)
        .query('SELECT COUNT(*) as cnt FROM Customers WHERE tax_id = @taxId AND tax_id != \'\'');
      if (dupTax.recordset[0].cnt > 0) {
        return NextResponse.json({ error: `เลขประจำตัวผู้เสียภาษี "${tax_id}" ถูกใช้ไปแล้ว` }, { status: 400 });
      }
    }

    // Auto-generate customer_code
    const customerCode = await generateCustomerCode(pool);

    // Derive legacy customer_type for backward compat
    const legacyType = is_line ? 'shipping_line' : is_trucking ? 'trucker' : 'general';

    const result = await pool.request()
      .input('customer_code', sql.VarChar, customerCode)
      .input('customer_name', sql.NVarChar, customer_name)
      .input('customer_type', sql.NVarChar, legacyType)
      .input('is_line', sql.Bit, is_line ? 1 : 0)
      .input('is_forwarder', sql.Bit, is_forwarder ? 1 : 0)
      .input('is_trucking', sql.Bit, is_trucking ? 1 : 0)
      .input('is_shipper', sql.Bit, is_shipper ? 1 : 0)
      .input('is_consignee', sql.Bit, is_consignee ? 1 : 0)
      .input('tax_id', sql.NVarChar, tax_id || '')
      .input('address', sql.NVarChar, address || '')
      .input('billing_address', sql.NVarChar, billing_address || '')
      .input('contact_name', sql.NVarChar, contact_name || '')
      .input('contact_phone', sql.NVarChar, contact_phone || '')
      .input('contact_email', sql.NVarChar, contact_email || '')
      .input('default_payment_type', sql.VarChar, default_payment_type || 'CASH')
      .input('credit_term', sql.Int, credit_term || 0)
      .input('credit_limit', sql.Decimal(12, 2), credit_limit || 0)
      .input('credit_hold', sql.Bit, credit_hold ? 1 : 0)
      .input('credit_hold_reason', sql.NVarChar, credit_hold_reason || '')
      .input('edi_prefix', sql.NVarChar, edi_prefix || '')
      .input('shipping_line_code', sql.NVarChar, shipping_line_code || '')
      .query(`
        INSERT INTO Customers (customer_code, customer_name, customer_type,
          is_line, is_forwarder, is_trucking, is_shipper, is_consignee,
          tax_id, address, billing_address, contact_name, contact_phone, contact_email,
          default_payment_type, credit_term, credit_limit, credit_hold, credit_hold_reason,
          edi_prefix, shipping_line_code)
        OUTPUT INSERTED.*
        VALUES (@customer_code, @customer_name, @customer_type,
          @is_line, @is_forwarder, @is_trucking, @is_shipper, @is_consignee,
          @tax_id, @address, @billing_address, @contact_name, @contact_phone, @contact_email,
          @default_payment_type, @credit_term, @credit_limit, @credit_hold, @credit_hold_reason,
          @edi_prefix, @shipping_line_code)
      `);

    const created = result.recordset[0];

    // Create branches if provided
    if (Array.isArray(branches) && branches.length > 0) {
      for (const b of branches) {
        await pool.request()
          .input('cid', sql.Int, created.customer_id)
          .input('code', sql.VarChar, b.branch_code || '00000')
          .input('name', sql.NVarChar, b.branch_name || '')
          .input('addr', sql.NVarChar, b.billing_address || '')
          .input('cname', sql.NVarChar, b.contact_name || '')
          .input('cphone', sql.NVarChar, b.contact_phone || '')
          .input('cemail', sql.NVarChar, b.contact_email || '')
          .input('def', sql.Bit, b.is_default ? 1 : 0)
          .query(`
            INSERT INTO CustomerBranches (customer_id, branch_code, branch_name, billing_address, contact_name, contact_phone, contact_email, is_default)
            VALUES (@cid, @code, @name, @addr, @cname, @cphone, @cemail, @def)
          `);
      }
    }

    await logAudit({ userId: body.user_id, yardId: body.yard_id, action: 'customer_create', entityType: 'customer', entityId: created.customer_id, details: { customer_name, customer_code: customerCode, roles: { is_line, is_forwarder, is_trucking, is_shipper, is_consignee } } });
    return NextResponse.json({ success: true, data: created });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT — Update customer
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { customer_id, customer_name, is_line, is_forwarder, is_trucking, is_shipper, is_consignee,
      tax_id, address, billing_address, contact_name, contact_phone, contact_email,
      default_payment_type, credit_term, credit_limit, credit_hold, credit_hold_reason,
      edi_prefix, shipping_line_code, is_active, branches } = body;

    if (!customer_id) {
      return NextResponse.json({ error: 'customer_id required' }, { status: 400 });
    }

    const pool = await getDb();
    await ensureColumns(pool);

    // Duplicate check: company name (exclude self)
    if (customer_name) {
      const dupName = await pool.request()
        .input('name', sql.NVarChar, customer_name)
        .input('id', sql.Int, customer_id)
        .query('SELECT COUNT(*) as cnt FROM Customers WHERE customer_name = @name AND customer_id != @id');
      if (dupName.recordset[0].cnt > 0) {
        return NextResponse.json({ error: `ชื่อบริษัท "${customer_name}" มีอยู่ในระบบแล้ว` }, { status: 400 });
      }
    }

    // Duplicate check: tax_id (exclude self)
    if (tax_id) {
      const dupTax = await pool.request()
        .input('taxId', sql.NVarChar, tax_id)
        .input('id', sql.Int, customer_id)
        .query('SELECT COUNT(*) as cnt FROM Customers WHERE tax_id = @taxId AND tax_id != \'\' AND customer_id != @id');
      if (dupTax.recordset[0].cnt > 0) {
        return NextResponse.json({ error: `เลขประจำตัวผู้เสียภาษี "${tax_id}" ถูกใช้ไปแล้ว` }, { status: 400 });
      }
    }

    // Derive legacy customer_type
    const legacyType = is_line ? 'shipping_line' : is_trucking ? 'trucker' : 'general';

    await pool.request()
      .input('customer_id', sql.Int, customer_id)
      .input('customer_name', sql.NVarChar, customer_name)
      .input('customer_type', sql.NVarChar, legacyType)
      .input('is_line', sql.Bit, is_line ? 1 : 0)
      .input('is_forwarder', sql.Bit, is_forwarder ? 1 : 0)
      .input('is_trucking', sql.Bit, is_trucking ? 1 : 0)
      .input('is_shipper', sql.Bit, is_shipper ? 1 : 0)
      .input('is_consignee', sql.Bit, is_consignee ? 1 : 0)
      .input('tax_id', sql.NVarChar, tax_id || '')
      .input('address', sql.NVarChar, address || '')
      .input('billing_address', sql.NVarChar, billing_address || '')
      .input('contact_name', sql.NVarChar, contact_name || '')
      .input('contact_phone', sql.NVarChar, contact_phone || '')
      .input('contact_email', sql.NVarChar, contact_email || '')
      .input('default_payment_type', sql.VarChar, default_payment_type || 'CASH')
      .input('credit_term', sql.Int, credit_term || 0)
      .input('credit_limit', sql.Decimal(12, 2), credit_limit || 0)
      .input('credit_hold', sql.Bit, credit_hold ? 1 : 0)
      .input('credit_hold_reason', sql.NVarChar, credit_hold_reason || '')
      .input('edi_prefix', sql.NVarChar, edi_prefix || '')
      .input('shipping_line_code', sql.NVarChar, shipping_line_code || '')
      .input('is_active', sql.Bit, is_active !== undefined ? (is_active ? 1 : 0) : 1)
      .query(`
        UPDATE Customers
        SET customer_name = @customer_name, customer_type = @customer_type,
            is_line = @is_line, is_forwarder = @is_forwarder, is_trucking = @is_trucking,
            is_shipper = @is_shipper, is_consignee = @is_consignee,
            tax_id = @tax_id, address = @address, billing_address = @billing_address,
            contact_name = @contact_name, contact_phone = @contact_phone, contact_email = @contact_email,
            default_payment_type = @default_payment_type, credit_term = @credit_term,
            credit_limit = @credit_limit, credit_hold = @credit_hold, credit_hold_reason = @credit_hold_reason,
            edi_prefix = @edi_prefix, shipping_line_code = @shipping_line_code,
            is_active = @is_active, updated_at = GETDATE()
        WHERE customer_id = @customer_id
      `);

    // Update branches if provided
    if (Array.isArray(branches)) {
      // Delete branches not in the new list
      const branchIds = branches.filter(b => b.branch_id).map(b => b.branch_id);
      if (branchIds.length > 0) {
        await pool.request()
          .input('cid', sql.Int, customer_id)
          .query(`DELETE FROM CustomerBranches WHERE customer_id = @cid AND branch_id NOT IN (${branchIds.join(',')})`);
      } else {
        await pool.request()
          .input('cid', sql.Int, customer_id)
          .query(`DELETE FROM CustomerBranches WHERE customer_id = @cid`);
      }

      // Upsert branches
      for (const b of branches) {
        if (b.branch_id) {
          await pool.request()
            .input('bid', sql.Int, b.branch_id)
            .input('code', sql.VarChar, b.branch_code || '00000')
            .input('name', sql.NVarChar, b.branch_name || '')
            .input('addr', sql.NVarChar, b.billing_address || '')
            .input('cname', sql.NVarChar, b.contact_name || '')
            .input('cphone', sql.NVarChar, b.contact_phone || '')
            .input('cemail', sql.NVarChar, b.contact_email || '')
            .input('def', sql.Bit, b.is_default ? 1 : 0)
            .input('active', sql.Bit, b.is_active !== false ? 1 : 0)
            .query(`
              UPDATE CustomerBranches SET branch_code = @code, branch_name = @name,
                billing_address = @addr, contact_name = @cname, contact_phone = @cphone,
                contact_email = @cemail, is_default = @def, is_active = @active
              WHERE branch_id = @bid
            `);
        } else {
          await pool.request()
            .input('cid', sql.Int, customer_id)
            .input('code', sql.VarChar, b.branch_code || '00000')
            .input('name', sql.NVarChar, b.branch_name || '')
            .input('addr', sql.NVarChar, b.billing_address || '')
            .input('cname', sql.NVarChar, b.contact_name || '')
            .input('cphone', sql.NVarChar, b.contact_phone || '')
            .input('cemail', sql.NVarChar, b.contact_email || '')
            .input('def', sql.Bit, b.is_default ? 1 : 0)
            .query(`
              INSERT INTO CustomerBranches (customer_id, branch_code, branch_name, billing_address, contact_name, contact_phone, contact_email, is_default)
              VALUES (@cid, @code, @name, @addr, @cname, @cphone, @cemail, @def)
            `);
        }
      }
    }

    await logAudit({ userId: body.user_id, yardId: body.yard_id, action: 'customer_update', entityType: 'customer', entityId: customer_id, details: { customer_name } });
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
    // Delete branches first
    await pool.request().input('id', customer_id)
      .query('DELETE FROM CustomerBranches WHERE customer_id = @id');
    await pool.request().input('id', customer_id)
      .query('DELETE FROM Customers WHERE customer_id = @id');
    await logAudit({ action: 'customer_delete', entityType: 'customer', entityId: parseInt(customer_id), details: { customer_id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
