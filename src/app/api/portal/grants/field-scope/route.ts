import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/apiAuth';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const FIELD_LABEL = 'แสดงเกรดตู้ใน EIR ให้ลูกค้า';
const SUPPORTED_FIELDS = {
  container_grade: {
    path: 'permission_scope.eir.fields.container_grade',
    label: FIELD_LABEL,
  },
} as const;

type SupportedField = keyof typeof SUPPORTED_FIELDS;

interface FieldScopeBody {
  access_id?: unknown;
  field?: unknown;
  enabled?: unknown;
  reason?: unknown;
}

interface PortalEntityAccessRow {
  access_id: number;
  customer_id: number | null;
  entity_type: string | null;
  entity_id: number | null;
  entity_ref: string | null;
  permission_scope: unknown;
}

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  if (typeof value === 'string' && /^[1-9]\d*$/.test(value.trim())) {
    return Number(value);
  }

  return null;
}

function parseScope(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return { ...value as Record<string, unknown> };
  if (typeof value !== 'string') return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function getContainerGradeValue(scope: Record<string, unknown>) {
  const eir = scope.eir;
  if (!eir || typeof eir !== 'object' || Array.isArray(eir)) return undefined;

  const fields = (eir as Record<string, unknown>).fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return undefined;

  return (fields as Record<string, unknown>).container_grade;
}

function setContainerGradeValue(scope: Record<string, unknown>, enabled: boolean) {
  const eir = scope.eir && typeof scope.eir === 'object' && !Array.isArray(scope.eir)
    ? { ...scope.eir as Record<string, unknown> }
    : {};
  const fields = eir.fields && typeof eir.fields === 'object' && !Array.isArray(eir.fields)
    ? { ...eir.fields as Record<string, unknown> }
    : {};

  fields.container_grade = enabled;
  eir.fields = fields;
  return { ...scope, eir };
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = requireRole(
      request,
      ['yard_manager'],
      'เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการสิทธิ์ Customer Portal ได้'
    );
    if (actor instanceof NextResponse) return actor;

    let body: FieldScopeBody;
    try {
      const parsed = await request.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return NextResponse.json({ error: 'รูปแบบคำขอไม่ถูกต้อง' }, { status: 400 });
      }
      body = parsed as FieldScopeBody;
    } catch {
      return NextResponse.json({ error: 'รูปแบบ JSON ไม่ถูกต้อง' }, { status: 400 });
    }

    const accessId = parsePositiveInt(body.access_id);
    const field = typeof body.field === 'string' ? body.field : '';
    const fieldConfig = SUPPORTED_FIELDS[field as SupportedField];

    if (!accessId) {
      return NextResponse.json({ error: 'ต้องระบุ access_id ที่ถูกต้อง' }, { status: 400 });
    }

    if (!fieldConfig) {
      return NextResponse.json({ error: 'field ไม่รองรับ' }, { status: 400 });
    }

    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled ต้องเป็น boolean' }, { status: 400 });
    }

    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) {
      return NextResponse.json({ error: 'กรุณาระบุเหตุผลการเปลี่ยนสิทธิ์' }, { status: 400 });
    }

    const db = await getDb();
    const existing = await db.request()
      .input('accessId', sql.BigInt, accessId)
      .query<PortalEntityAccessRow>(`
        SELECT TOP 1
          access_id,
          customer_id,
          entity_type,
          entity_id,
          entity_ref,
          permission_scope
        FROM PortalEntityAccess
        WHERE access_id = @accessId
      `);

    const grant = existing.recordset[0];
    if (!grant) {
      return NextResponse.json({ error: 'ไม่พบ portal grant' }, { status: 404 });
    }

    const oldScope = parseScope(grant.permission_scope);
    const oldValue = getContainerGradeValue(oldScope);
    const nextScope = setContainerGradeValue(oldScope, body.enabled);

    await db.request()
      .input('accessId', sql.BigInt, accessId)
      .input('permissionScope', sql.NVarChar(sql.MAX), JSON.stringify(nextScope))
      .query(`
        UPDATE PortalEntityAccess
        SET permission_scope = @permissionScope,
            updated_at = GETDATE()
        WHERE access_id = @accessId
      `);

    await logAudit({
      userId: actor.userId,
      action: 'portal_grant_field_scope_update',
      entityType: 'portal_entity_access',
      entityId: accessId,
      details: {
        label: fieldConfig.label,
        field,
        field_path: fieldConfig.path,
        old_value: oldValue === undefined ? null : oldValue,
        new_value: body.enabled,
        customer_id: grant.customer_id,
        entity_type: grant.entity_type,
        entity_id: grant.entity_id,
        entity_ref: grant.entity_ref,
        reason,
      },
    });

    return NextResponse.json({
      success: true,
      access_id: accessId,
      field,
      enabled: body.enabled,
      permission_scope: nextScope,
    });
  } catch (error) {
    console.error('❌ Portal grant field scope update error:', error);
    return NextResponse.json({ error: 'ไม่สามารถอัปเดตสิทธิ์ field scope ได้' }, { status: 500 });
  }
}
