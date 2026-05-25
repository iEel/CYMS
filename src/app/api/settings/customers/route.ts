import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { logAudit } from '@/lib/audit';
import { requireRole } from '@/lib/apiAuth';
import { deleteRemovedCustomerBranches, parseBranchId } from '@/lib/customerBranches';

function requireCustomerAdmin(req: NextRequest) {
  return requireRole(req, ['yard_manager'], 'เฉพาะ Yard Manager เท่านั้นที่จัดการข้อมูลลูกค้าได้');
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

function normalizePortalDefaultScope(input: unknown) {
  const source = typeof input === 'object' && input !== null ? input as Record<string, unknown> : {};
  const eir = typeof source.eir === 'object' && source.eir !== null ? source.eir as Record<string, unknown> : {};
  const fields = typeof eir.fields === 'object' && eir.fields !== null ? eir.fields as Record<string, unknown> : {};
  return {
    view: true,
    download: Boolean(source.download ?? true),
    eir: {
      fields: {
        container_grade: Boolean(fields.container_grade),
        damage_summary: fields.damage_summary !== false,
        damage_photos: fields.damage_photos !== false,
        seal_number: fields.seal_number !== false,
        driver_name: Boolean(fields.driver_name),
        truck_plate_full: Boolean(fields.truck_plate_full),
        billing_clearance: Boolean(fields.billing_clearance),
        invoice_amount: Boolean(fields.invoice_amount),
        internal_note: false,
      },
    },
    maskSensitiveFields: true,
  };
}

function parsePortalDefaultScope(input: unknown) {
  if (typeof input !== 'string') return input;
  try {
    return JSON.parse(input || '{}');
  } catch {
    return {};
  }
}

function stringifyPortalDefaultScope(input: unknown) {
  return JSON.stringify(normalizePortalDefaultScope(input));
}

// GET — List all customers (with optional role filter)
export async function GET(req: NextRequest) {
  try {
    const pool = await getDb();

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
             ISNULL(c.portal_enabled, 1) AS portal_enabled,
             c.portal_default_permission_scope,
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
      portal_enabled: c.portal_enabled !== false && c.portal_enabled !== 0,
      portal_default_permission_scope: normalizePortalDefaultScope(parsePortalDefaultScope(c.portal_default_permission_scope)),
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
  const auth = requireCustomerAdmin(req);
  if (auth instanceof NextResponse) return auth;

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
      .input('portalEnabled', sql.Bit, body.portal_enabled !== false)
      .input('portalDefaultPermissionScope', sql.NVarChar, JSON.stringify(normalizePortalDefaultScope(body.portal_default_permission_scope)))
      .query(`
        INSERT INTO Customers (customer_code, customer_name, customer_type,
          is_line, is_forwarder, is_trucking, is_shipper, is_consignee,
          tax_id, address, billing_address, contact_name, contact_phone, contact_email,
          default_payment_type, credit_term, credit_limit, credit_hold, credit_hold_reason,
          edi_prefix, shipping_line_code, portal_enabled, portal_default_permission_scope)
        OUTPUT INSERTED.*
        VALUES (@customer_code, @customer_name, @customer_type,
          @is_line, @is_forwarder, @is_trucking, @is_shipper, @is_consignee,
          @tax_id, @address, @billing_address, @contact_name, @contact_phone, @contact_email,
          @default_payment_type, @credit_term, @credit_limit, @credit_hold, @credit_hold_reason,
          @edi_prefix, @shipping_line_code, @portalEnabled, @portalDefaultPermissionScope)
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

    await logAudit({ userId: auth.userId, yardId: body.yard_id, action: 'customer_create', entityType: 'customer', entityId: created.customer_id, details: { customer_name, customer_code: customerCode, roles: { is_line, is_forwarder, is_trucking, is_shipper, is_consignee } } });
    if ('portal_enabled' in body || 'portal_default_permission_scope' in body) {
      await logAudit({
        userId: auth.userId,
        yardId: body.yard_id,
        action: 'customer_portal_visibility_update',
        entityType: 'customer',
        entityId: created.customer_id,
        details: {
          portal_enabled: body.portal_enabled !== false,
          portal_default_permission_scope: normalizePortalDefaultScope(body.portal_default_permission_scope),
        },
      });
    }
    return NextResponse.json({ success: true, data: created });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT — Update customer
export async function PUT(req: NextRequest) {
  const auth = requireCustomerAdmin(req);
  if (auth instanceof NextResponse) return auth;

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
    const portalEnabledIncluded = Object.prototype.hasOwnProperty.call(body, 'portal_enabled');
    const portalDefaultScopeIncluded = Object.prototype.hasOwnProperty.call(body, 'portal_default_permission_scope');
    const portalDefaultsIncluded = portalEnabledIncluded || portalDefaultScopeIncluded;
    const portalUpdateClauses = [];
    if (portalEnabledIncluded) portalUpdateClauses.push('portal_enabled = @portalEnabled');
    if (portalDefaultScopeIncluded) portalUpdateClauses.push('portal_default_permission_scope = @portalDefaultPermissionScope');
    const portalUpdateSql = portalUpdateClauses.length ? `${portalUpdateClauses.join(', ')},` : '';
    const nextPortalEnabled = body.portal_enabled !== false;
    const nextPortalDefaultScope = normalizePortalDefaultScope(body.portal_default_permission_scope);
    const nextPortalDefaultScopeJson = stringifyPortalDefaultScope(body.portal_default_permission_scope);

    const previousPortal = portalDefaultsIncluded
      ? (await pool.request()
        .input('customer_id', sql.Int, customer_id)
        .query(`
          SELECT ISNULL(portal_enabled, 1) AS portal_enabled, portal_default_permission_scope
          FROM Customers
          WHERE customer_id = @customer_id
        `)).recordset[0]
      : null;
    const previousPortalEnabled = previousPortal
      ? previousPortal.portal_enabled !== false && previousPortal.portal_enabled !== 0
      : true;
    const previousPortalDefaultScopeJson = stringifyPortalDefaultScope(parsePortalDefaultScope(previousPortal?.portal_default_permission_scope));
    const portalChanged =
      (portalEnabledIncluded && previousPortalEnabled !== nextPortalEnabled) ||
      (portalDefaultScopeIncluded && previousPortalDefaultScopeJson !== nextPortalDefaultScopeJson);

    const updateRequest = pool.request()
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
      .input('is_active', sql.Bit, is_active !== undefined ? (is_active ? 1 : 0) : 1);

    if (portalDefaultsIncluded) {
      if (portalEnabledIncluded) {
        updateRequest.input('portalEnabled', sql.Bit, nextPortalEnabled);
      }
      if (portalDefaultScopeIncluded) {
        updateRequest.input('portalDefaultPermissionScope', sql.NVarChar, nextPortalDefaultScopeJson);
      }
    }

    await updateRequest.query(`
        UPDATE Customers
        SET customer_name = @customer_name, customer_type = @customer_type,
            is_line = @is_line, is_forwarder = @is_forwarder, is_trucking = @is_trucking,
            is_shipper = @is_shipper, is_consignee = @is_consignee,
            tax_id = @tax_id, address = @address, billing_address = @billing_address,
            contact_name = @contact_name, contact_phone = @contact_phone, contact_email = @contact_email,
            default_payment_type = @default_payment_type, credit_term = @credit_term,
            credit_limit = @credit_limit, credit_hold = @credit_hold, credit_hold_reason = @credit_hold_reason,
            edi_prefix = @edi_prefix, shipping_line_code = @shipping_line_code,
            ${portalUpdateSql}
            is_active = @is_active, updated_at = GETDATE()
        WHERE customer_id = @customer_id
      `);

    // Update branches if provided
    if (Array.isArray(branches)) {
      try {
        await deleteRemovedCustomerBranches(pool, customer_id, branches);
      } catch {
        return NextResponse.json({ error: 'branch_id must be a positive integer' }, { status: 400 });
      }

      // Upsert branches
      for (const b of branches) {
        let branchId: number | null;
        try {
          branchId = parseBranchId(b.branch_id);
        } catch {
          return NextResponse.json({ error: 'branch_id must be a positive integer' }, { status: 400 });
        }

        if (branchId) {
          await pool.request()
            .input('bid', sql.Int, branchId)
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

    await logAudit({ userId: auth.userId, yardId: body.yard_id, action: 'customer_update', entityType: 'customer', entityId: customer_id, details: { customer_name } });
    if (portalChanged) {
      await logAudit({
        userId: auth.userId,
        yardId: body.yard_id,
        action: 'customer_portal_visibility_update',
        entityType: 'customer',
        entityId: customer_id,
        details: {
          ...(portalEnabledIncluded ? { portal_enabled: nextPortalEnabled } : {}),
          ...(portalDefaultScopeIncluded ? { portal_default_permission_scope: nextPortalDefaultScope } : {}),
        },
      });
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE — Delete customer
export async function DELETE(req: NextRequest) {
  const auth = requireCustomerAdmin(req);
  if (auth instanceof NextResponse) return auth;

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
    await logAudit({ userId: auth.userId, action: 'customer_delete', entityType: 'customer', entityId: parseInt(customer_id), details: { customer_id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
