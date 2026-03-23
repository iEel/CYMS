import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { logAudit } from '@/lib/audit';

// Auto-migrate
async function ensureTable(pool: Awaited<ReturnType<typeof getDb>>) {
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PrefixMapping')
      BEGIN
        CREATE TABLE PrefixMapping (
          prefix_id    INT IDENTITY PRIMARY KEY,
          prefix_code  NVARCHAR(4) NOT NULL,
          customer_id  INT NOT NULL,
          notes        NVARCHAR(200),
          created_at   DATETIME2 DEFAULT GETDATE(),
          CONSTRAINT FK_Prefix_Customer FOREIGN KEY (customer_id) REFERENCES Customers(customer_id),
          CONSTRAINT UQ_Prefix UNIQUE (prefix_code)
        );
      END
    `);
  } catch { /* table may already exist */ }
}

// GET — List all prefix mappings
export async function GET() {
  try {
    const pool = await getDb();
    await ensureTable(pool);
    const result = await pool.request().query(`
      SELECT pm.prefix_id, pm.prefix_code, pm.customer_id, pm.notes, pm.created_at,
             c.customer_name, c.customer_type
      FROM PrefixMapping pm
      JOIN Customers c ON pm.customer_id = c.customer_id
      ORDER BY pm.prefix_code
    `);
    return NextResponse.json(result.recordset);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST — Add new prefix mapping
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prefix_code, customer_id, notes } = body;

    if (!prefix_code || !customer_id) {
      return NextResponse.json({ error: 'prefix_code and customer_id required' }, { status: 400 });
    }

    const code = prefix_code.toUpperCase().trim();
    if (!/^[A-Z]{3}[A-Z]$/.test(code) || code.length !== 4) {
      return NextResponse.json({ error: 'prefix_code ต้องเป็นตัวอักษร 4 ตัว (เช่น MSCU)' }, { status: 400 });
    }

    const pool = await getDb();
    await ensureTable(pool);

    // Check duplicate
    const dup = await pool.request()
      .input('code', sql.NVarChar, code)
      .query('SELECT COUNT(*) as cnt FROM PrefixMapping WHERE prefix_code = @code');
    if (dup.recordset[0].cnt > 0) {
      return NextResponse.json({ error: `prefix ${code} ถูกใช้ไปแล้ว` }, { status: 400 });
    }

    const result = await pool.request()
      .input('prefix_code', sql.NVarChar, code)
      .input('customer_id', sql.Int, customer_id)
      .input('notes', sql.NVarChar, notes || null)
      .query(`
        INSERT INTO PrefixMapping (prefix_code, customer_id, notes)
        OUTPUT INSERTED.*
        VALUES (@prefix_code, @customer_id, @notes)
      `);

    const created = result.recordset[0];
    await logAudit({ action: 'prefix_create', entityType: 'prefix_mapping', entityId: created.prefix_id, details: { prefix_code: code, customer_id } });
    return NextResponse.json({ success: true, data: created });
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
