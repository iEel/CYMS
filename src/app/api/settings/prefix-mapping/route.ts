import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { logAudit } from '@/lib/audit';

// Auto-migrate: ensure table + one-to-many structure
async function ensureTable(pool: Awaited<ReturnType<typeof getDb>>) {
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PrefixMapping')
      BEGIN
        CREATE TABLE PrefixMapping (
          prefix_id    INT IDENTITY PRIMARY KEY,
          prefix_code  NVARCHAR(4) NOT NULL,
          customer_id  INT NOT NULL,
          is_primary   BIT DEFAULT 0,
          notes        NVARCHAR(200),
          created_at   DATETIME2 DEFAULT GETDATE(),
          CONSTRAINT FK_Prefix_Customer FOREIGN KEY (customer_id) REFERENCES Customers(customer_id),
          CONSTRAINT UQ_Prefix_Customer UNIQUE (prefix_code, customer_id)
        );
      END
    `);
    // Ensure is_primary column exists (for migration from old schema)
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PrefixMapping' AND COLUMN_NAME = 'is_primary')
      ALTER TABLE PrefixMapping ADD is_primary BIT DEFAULT 0
    `);
  } catch { /* table may already exist */ }
}

// GET — List all prefix mappings (grouped by prefix for multi-owner view)
export async function GET() {
  try {
    const pool = await getDb();
    await ensureTable(pool);
    const result = await pool.request().query(`
      SELECT pm.prefix_id, pm.prefix_code, pm.customer_id, pm.is_primary, pm.notes, pm.created_at,
             c.customer_name,
             ISNULL(c.is_line, 0) as is_line,
             ISNULL(c.is_forwarder, 0) as is_forwarder,
             ISNULL(c.is_trucking, 0) as is_trucking
      FROM PrefixMapping pm
      JOIN Customers c ON pm.customer_id = c.customer_id
      ORDER BY pm.prefix_code, pm.is_primary DESC, c.customer_name
    `);
    return NextResponse.json(result.recordset);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST — Add new prefix mapping (allows same prefix for different customers)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prefix_code, customer_id, notes, is_primary } = body;

    if (!prefix_code || !customer_id) {
      return NextResponse.json({ error: 'prefix_code and customer_id required' }, { status: 400 });
    }

    const code = prefix_code.toUpperCase().trim();
    if (!/^[A-Z]{3}[A-Z]$/.test(code) || code.length !== 4) {
      return NextResponse.json({ error: 'prefix_code ต้องเป็นตัวอักษร 4 ตัว (เช่น MSCU)' }, { status: 400 });
    }

    const pool = await getDb();
    await ensureTable(pool);

    // Check duplicate (same prefix + same customer)
    const dup = await pool.request()
      .input('code', sql.NVarChar, code)
      .input('custId', sql.Int, customer_id)
      .query('SELECT COUNT(*) as cnt FROM PrefixMapping WHERE prefix_code = @code AND customer_id = @custId');
    if (dup.recordset[0].cnt > 0) {
      return NextResponse.json({ error: `prefix ${code} กับลูกค้ารายนี้ถูกเพิ่มไปแล้ว` }, { status: 400 });
    }

    // If marking as primary, unset primary for other customers with same prefix
    if (is_primary) {
      await pool.request()
        .input('code', sql.NVarChar, code)
        .query('UPDATE PrefixMapping SET is_primary = 0 WHERE prefix_code = @code');
    }

    const result = await pool.request()
      .input('prefix_code', sql.NVarChar, code)
      .input('customer_id', sql.Int, customer_id)
      .input('is_primary', sql.Bit, is_primary ? 1 : 0)
      .input('notes', sql.NVarChar, notes || null)
      .query(`
        INSERT INTO PrefixMapping (prefix_code, customer_id, is_primary, notes)
        OUTPUT INSERTED.*
        VALUES (@prefix_code, @customer_id, @is_primary, @notes)
      `);

    const created = result.recordset[0];
    await logAudit({ action: 'prefix_create', entityType: 'prefix_mapping', entityId: created.prefix_id, details: { prefix_code: code, customer_id, is_primary } });
    return NextResponse.json({ success: true, data: created });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT — Update prefix mapping (toggle primary, update notes)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { prefix_id, is_primary, notes } = body;

    if (!prefix_id) {
      return NextResponse.json({ error: 'prefix_id required' }, { status: 400 });
    }

    const pool = await getDb();

    // If setting as primary, unset others with the same prefix
    if (is_primary) {
      const current = await pool.request()
        .input('id', sql.Int, prefix_id)
        .query('SELECT prefix_code FROM PrefixMapping WHERE prefix_id = @id');
      if (current.recordset.length > 0) {
        await pool.request()
          .input('code', sql.NVarChar, current.recordset[0].prefix_code)
          .query('UPDATE PrefixMapping SET is_primary = 0 WHERE prefix_code = @code');
      }
    }

    await pool.request()
      .input('id', sql.Int, prefix_id)
      .input('is_primary', sql.Bit, is_primary ? 1 : 0)
      .input('notes', sql.NVarChar, notes || null)
      .query(`
        UPDATE PrefixMapping 
        SET is_primary = @is_primary, notes = ISNULL(@notes, notes)
        WHERE prefix_id = @id
      `);

    await logAudit({ action: 'prefix_update', entityType: 'prefix_mapping', entityId: prefix_id, details: { is_primary } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE — Remove prefix mapping
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const prefixId = searchParams.get('prefix_id');
    if (!prefixId) {
      return NextResponse.json({ error: 'prefix_id required' }, { status: 400 });
    }

    const pool = await getDb();
    await pool.request()
      .input('id', sql.Int, parseInt(prefixId))
      .query('DELETE FROM PrefixMapping WHERE prefix_id = @id');
    await logAudit({ action: 'prefix_delete', entityType: 'prefix_mapping', entityId: parseInt(prefixId) });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
