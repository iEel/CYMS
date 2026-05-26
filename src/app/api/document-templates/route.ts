import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { requirePermission } from '@/lib/apiAuth';
import {
  bindTemplateVersionConfig,
  buildDefaultContinuousTemplateConfig,
  normalizeTemplateConfig,
} from '@/lib/documentTemplates';

const SETTINGS_MESSAGE = 'คุณไม่มีสิทธิ์จัดการเทมเพลตเอกสาร';

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const actor = await requirePermission(request, db, 'settings.manage', SETTINGS_MESSAGE);
    if (actor instanceof NextResponse) return actor;

    const result = await db.request().query(`
      SELECT
        t.template_id,
        t.template_code,
        t.template_name,
        t.document_type,
        t.description,
        t.status,
        t.is_default,
        t.current_version_no,
        t.created_by,
        t.updated_by,
        t.created_at,
        t.updated_at,
        v.version_id AS current_version_id,
        v.version_no,
        v.status AS version_status,
        v.paper_width_mm,
        v.paper_height_mm,
        v.paper_size_code,
        v.mode,
        v.copy_mode,
        v.published_by,
        v.published_at
      FROM DocumentTemplates t
      LEFT JOIN DocumentTemplateVersions v
        ON v.template_id = t.template_id
       AND v.version_no = t.current_version_no
      ORDER BY t.document_type, t.is_default DESC, t.template_name
    `);

    return NextResponse.json({ templates: result.recordset });
  } catch (error) {
    console.error('GET document templates error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงเทมเพลตเอกสารได้' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const templateCode = cleanString(body.template_code).toUpperCase();
    const templateName = cleanString(body.template_name);
    const documentType = cleanString(body.document_type);
    const description = cleanString(body.description) || null;

    const db = await getDb();
    const actor = await requirePermission(request, db, 'settings.manage', SETTINGS_MESSAGE);
    if (actor instanceof NextResponse) return actor;

    if (!templateCode || !templateName || !documentType) {
      return NextResponse.json({ error: 'template_code, template_name และ document_type จำเป็นต้องระบุ' }, { status: 400 });
    }

    const normalized = normalizeTemplateConfig(body.config || buildDefaultContinuousTemplateConfig());
    if (!normalized.config) {
      return NextResponse.json({ error: 'template config ไม่ถูกต้อง', errors: normalized.errors }, { status: 400 });
    }

    const templateResult = await db.request()
      .input('templateCode', sql.NVarChar(80), templateCode)
      .input('templateName', sql.NVarChar(200), templateName)
      .input('documentType', sql.NVarChar(50), documentType)
      .input('description', sql.NVarChar(500), description)
      .input('status', sql.NVarChar(20), 'draft')
      .input('isDefault', sql.Bit, body.is_default ? 1 : 0)
      .input('createdBy', sql.Int, actor.userId)
      .query(`
        INSERT INTO DocumentTemplates (
          template_code, template_name, document_type, description,
          status, is_default, current_version_no, created_by
        )
        OUTPUT INSERTED.*
        VALUES (
          @templateCode, @templateName, @documentType, @description,
          @status, @isDefault, 1, @createdBy
        )
      `);

    const template = templateResult.recordset[0];
    const versionRequest = db.request()
      .input('templateId', sql.Int, template.template_id)
      .input('templateCode', sql.NVarChar(80), templateCode)
      .input('versionNo', sql.Int, 1)
      .input('status', sql.NVarChar(20), 'draft')
      .input('createdBy', sql.Int, actor.userId);

    const versionResult = await bindTemplateVersionConfig(versionRequest, normalized.config).query(`
      INSERT INTO DocumentTemplateVersions (
        template_id, template_code, version_no, status,
        paper_width_mm, paper_height_mm, paper_size_code, mode, copy_mode,
        top_offset_mm, left_offset_mm, font_size, row_height, print_scale,
        config_json, created_by
      )
      OUTPUT INSERTED.*
      VALUES (
        @templateId, @templateCode, @versionNo, @status,
        @paperWidthMm, @paperHeightMm, @paperSizeCode, @mode, @copyMode,
        @topOffsetMm, @leftOffsetMm, @fontSize, @rowHeight, @printScale,
        @configJson, @createdBy
      )
    `);

    await logAudit({
      userId: actor.userId,
      action: 'document_template_create',
      entityType: 'document_template',
      entityId: template.template_id,
      details: { template_code: templateCode, template_name: templateName, document_type: documentType },
    });

    return NextResponse.json({ success: true, template, version: versionResult.recordset[0] });
  } catch (error) {
    console.error('POST document templates error:', error);
    return NextResponse.json({ error: 'ไม่สามารถสร้างเทมเพลตเอกสารได้' }, { status: 500 });
  }
}
