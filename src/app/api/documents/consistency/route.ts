import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { ensureDocumentLifecycle } from '@/lib/documentLifecycle';

type Severity = 'info' | 'warning' | 'critical';

interface ConsistencyCheck {
  code: string;
  title: string;
  severity: Severity;
  expected: string;
  recommended_action: string;
  count: number;
  rows: Array<Record<string, unknown>>;
  unavailable?: boolean;
  error?: string;
}

async function runCheck(
  code: string,
  title: string,
  severity: Severity,
  expected: string,
  recommendedAction: string,
  query: () => Promise<{ recordset: Array<Record<string, unknown>> }>
): Promise<ConsistencyCheck> {
  try {
    const result = await query();
    return {
      code,
      title,
      severity,
      expected,
      recommended_action: recommendedAction,
      count: result.recordset.length,
      rows: result.recordset,
    };
  } catch (error) {
    return {
      code,
      title,
      severity: 'warning',
      expected,
      recommended_action: 'ตรวจสอบโครงสร้างฐานข้อมูลหรือ migration ของโมดูลเอกสาร',
      count: 0,
      rows: [],
      unavailable: true,
      error: error instanceof Error ? error.message : 'unknown error',
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = searchParams.get('yard_id') ? Number(searchParams.get('yard_id')) : null;
    const db = await getDb();
    await ensureDocumentLifecycle(db);

    const checks = await Promise.all([
      runCheck(
        'eir_lifecycle_missing',
        'EIR ที่ยังไม่มี Document Lifecycle',
        'warning',
        'EIR ทุกใบควรมี lifecycle เพื่อให้ activity feed และ audit อ่านง่าย',
        'สร้าง lifecycle ย้อนหลังจาก GateTransactions ที่มี eir_number',
        () => db.request().input('yardId', sql.Int, yardId).query(`
          SELECT TOP 50 g.transaction_id, g.eir_number, g.transaction_type, g.container_number, g.created_at
          FROM GateTransactions g
          LEFT JOIN DocumentLifecycle dl
            ON dl.document_type = 'eir'
           AND (dl.document_id = g.transaction_id OR dl.document_number = g.eir_number)
          WHERE g.eir_number IS NOT NULL
            AND (@yardId IS NULL OR g.yard_id = @yardId)
            AND dl.lifecycle_id IS NULL
          ORDER BY g.created_at DESC
        `)
      ),
      runCheck(
        'invoice_lifecycle_missing',
        'Invoice ที่ยังไม่มี Document Lifecycle',
        'warning',
        'Invoice ทุกใบควรมี lifecycle ตั้งแต่ created/issued/paid/cancelled',
        'สร้าง lifecycle ย้อนหลังจาก Invoices ที่มี invoice_number',
        () => db.request().input('yardId', sql.Int, yardId).query(`
          SELECT TOP 50 i.invoice_id, i.invoice_number, i.status, i.grand_total, i.created_at
          FROM Invoices i
          LEFT JOIN DocumentLifecycle dl
            ON dl.document_type = 'invoice'
           AND (dl.document_id = i.invoice_id OR dl.document_number = i.invoice_number)
          WHERE i.invoice_number IS NOT NULL
            AND (@yardId IS NULL OR i.yard_id = @yardId)
            AND dl.lifecycle_id IS NULL
          ORDER BY i.created_at DESC
        `)
      ),
      runCheck(
        'paid_invoice_receipt_missing',
        'Invoice ที่ paid แต่ยังไม่มี receipt lifecycle',
        'critical',
        'Invoice ที่รับชำระแล้วควรมี event receipt_issued หรือเอกสาร receipt',
        'ตรวจสอบการออกใบเสร็จและบันทึก receipt lifecycle ให้ครบ',
        () => db.request().input('yardId', sql.Int, yardId).query(`
          SELECT TOP 50 i.invoice_id, i.invoice_number, i.status, i.grand_total, i.paid_at
          FROM Invoices i
          WHERE i.status = 'paid'
            AND (@yardId IS NULL OR i.yard_id = @yardId)
            AND NOT EXISTS (
              SELECT 1 FROM DocumentLifecycle dl
              WHERE (dl.document_type = 'receipt' OR dl.event_type = 'receipt_issued')
                AND (dl.document_id = i.invoice_id OR dl.document_number = i.receipt_number)
            )
          ORDER BY i.paid_at DESC, i.invoice_id DESC
        `)
      ),
      runCheck(
        'receipt_for_unpaid_invoice',
        'Receipt lifecycle อยู่กับ invoice ที่ยังไม่ paid',
        'critical',
        'ใบเสร็จควรออกได้เฉพาะ invoice ที่ paid แล้วเท่านั้น',
        'ตรวจสอบสถานะ invoice หรือยกเลิก receipt lifecycle ที่ผิดสถานะ',
        () => db.request().input('yardId', sql.Int, yardId).query(`
          SELECT TOP 50 i.invoice_id, i.invoice_number, i.status, i.receipt_number, dl.lifecycle_id, dl.event_type
          FROM Invoices i
          INNER JOIN DocumentLifecycle dl
            ON (dl.document_type = 'receipt' OR dl.event_type = 'receipt_issued')
           AND (dl.document_id = i.invoice_id OR dl.document_number = i.receipt_number)
          WHERE i.status <> 'paid'
            AND (@yardId IS NULL OR i.yard_id = @yardId)
          ORDER BY dl.created_at DESC
        `)
      ),
      runCheck(
        'draft_invoice_has_issued_event',
        'Draft invoice แต่มี event issued',
        'warning',
        'เอกสาร draft ไม่ควรถูกมองว่าออกเอกสารแล้ว และไม่ควรแสดงบน portal',
        'ตรวจสอบ flow ออกใบแจ้งหนี้ และแก้ lifecycle หรือสถานะ invoice ให้ตรงกัน',
        () => db.request().input('yardId', sql.Int, yardId).query(`
          SELECT TOP 50 i.invoice_id, i.invoice_number, i.status, dl.lifecycle_id, dl.created_at
          FROM Invoices i
          INNER JOIN DocumentLifecycle dl
            ON dl.document_type = 'invoice'
           AND (dl.document_id = i.invoice_id OR dl.document_number = i.invoice_number)
           AND dl.event_type = 'issued'
          WHERE i.status = 'draft'
            AND (@yardId IS NULL OR i.yard_id = @yardId)
          ORDER BY dl.created_at DESC
        `)
      ),
      runCheck(
        'credit_note_without_reference',
        'Credit Note ที่ไม่มี invoice อ้างอิง',
        'warning',
        'ใบลดหนี้ควรอ้างอิง invoice เดิมเสมอ เพื่อให้ audit และ portal แสดงถูกต้อง',
        'เติม original_invoice_id/original_invoice_number หรือเชื่อม relation ให้ครบ',
        () => db.request().input('yardId', sql.Int, yardId).query(`
          SELECT TOP 50 invoice_id, invoice_number, status, credit_note_number, original_invoice_id, created_at
          FROM Invoices
          WHERE (status = 'credit_note' OR invoice_number LIKE 'CN%' OR credit_note_number IS NOT NULL)
            AND original_invoice_id IS NULL
            AND (@yardId IS NULL OR yard_id = @yardId)
          ORDER BY created_at DESC
        `)
      ),
      runCheck(
        'eir_driver_license_in_payload',
        'EIR ยังมีข้อมูลใบขับขี่ใน payload',
        'info',
        'EIR สำหรับลูกค้าไม่ควรแสดงใบขับขี่ และ API preview ควรไม่ส่ง field นี้ไปหน้าเอกสาร',
        'ตรวจสอบ template และ API preview ให้ใช้เฉพาะชื่อคนขับ/ทะเบียนรถ/บริษัทคนขับ',
        () => db.request().input('yardId', sql.Int, yardId).query(`
          SELECT TOP 50 transaction_id, eir_number, container_number, driver_name, driver_license, created_at
          FROM GateTransactions
          WHERE driver_license IS NOT NULL
            AND LTRIM(RTRIM(CONVERT(NVARCHAR(200), driver_license))) <> ''
            AND (@yardId IS NULL OR yard_id = @yardId)
          ORDER BY created_at DESC
        `)
      ),
    ]);

    const openChecks = checks.filter(check => check.count > 0 || check.unavailable);
    const summary = {
      total_open: openChecks.reduce((sum, check) => sum + check.count, 0),
      critical: openChecks.filter(check => check.severity === 'critical').length,
      warning: openChecks.filter(check => check.severity === 'warning').length,
      info: openChecks.filter(check => check.severity === 'info').length,
      unavailable_checks: checks.filter(check => check.unavailable).length,
    };

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      yard_id: yardId,
      summary,
      checks,
    });
  } catch (error) {
    console.error('❌ GET document consistency error:', error);
    return NextResponse.json({ error: 'ไม่สามารถตรวจสอบความสอดคล้องเอกสารได้' }, { status: 500 });
  }
}
