import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { logAudit } from '@/lib/audit';
import { logApprovalReview } from '@/lib/approvalReview';
import { requirePermission } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yardId = parseInt(searchParams.get('yard_id') || '1');
    const clearanceType = searchParams.get('clearance_type');
    const transactionType = searchParams.get('transaction_type');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const search = searchParams.get('search');

    const db = await getDb();

    const req = db.request().input('yardId', sql.Int, yardId);
    const statsReq = db.request().input('yardId', sql.Int, yardId);
    const conditions = ['bc.yard_id = @yardId'];
    const statsConditions = ['yard_id = @yardId'];

    if (clearanceType) {
      conditions.push('bc.clearance_type = @clearanceType');
      req.input('clearanceType', sql.NVarChar, clearanceType);
      statsConditions.push('clearance_type = @clearanceType');
      statsReq.input('clearanceType', sql.NVarChar, clearanceType);
    }
    if (transactionType) {
      conditions.push('bc.transaction_type = @transactionType');
      req.input('transactionType', sql.NVarChar, transactionType);
      statsConditions.push('transaction_type = @transactionType');
      statsReq.input('transactionType', sql.NVarChar, transactionType);
    }
    if (dateFrom) {
      conditions.push('CAST(bc.created_at AS DATE) >= @dateFrom');
      req.input('dateFrom', sql.NVarChar, dateFrom);
      statsConditions.push('CAST(created_at AS DATE) >= @dateFrom');
      statsReq.input('dateFrom', sql.NVarChar, dateFrom);
    }
    if (dateTo) {
      conditions.push('CAST(bc.created_at AS DATE) <= @dateTo');
      req.input('dateTo', sql.NVarChar, dateTo);
      statsConditions.push('CAST(created_at AS DATE) <= @dateTo');
      statsReq.input('dateTo', sql.NVarChar, dateTo);
    }
    if (search) {
      conditions.push(`(
        bc.container_number LIKE @search OR c.customer_name LIKE @search OR
        i.invoice_number LIKE @search OR gt.eir_number LIKE @search
      )`);
      req.input('search', sql.NVarChar, `%${search}%`);
    }

    const where = conditions.join(' AND ');
    const statsWhere = statsConditions.join(' AND ');

    const result = await req.query(`
      SELECT TOP 500
        bc.*,
        c.customer_name,
        i.invoice_number,
        i.status AS invoice_status,
        i.grand_total AS invoice_total,
        gt.transaction_id,
        gt.eir_number,
        gt.booking_ref,
        u.full_name AS approved_by_name,
        cu.full_name AS created_by_name
      FROM BillingClearances bc
      LEFT JOIN Customers c ON bc.customer_id = c.customer_id
      LEFT JOIN Invoices i ON bc.invoice_id = i.invoice_id
      OUTER APPLY (
        SELECT TOP 1 transaction_id, eir_number, booking_ref
        FROM GateTransactions
        WHERE billing_clearance_id = bc.clearance_id
        ORDER BY created_at DESC
      ) gt
      LEFT JOIN Users u ON bc.approved_by = u.user_id
      LEFT JOIN Users cu ON bc.created_by = cu.user_id
      WHERE ${where}
      ORDER BY bc.created_at DESC
    `);

    const stats = await statsReq.query(`
        SELECT
          COUNT(*) AS total_count,
          COUNT(CASE WHEN clearance_type = 'paid' THEN 1 END) AS paid_count,
          COUNT(CASE WHEN clearance_type = 'credit' THEN 1 END) AS credit_count,
          COUNT(CASE WHEN clearance_type = 'no_charge' THEN 1 END) AS no_charge_count,
          COUNT(CASE WHEN clearance_type = 'waived' THEN 1 END) AS waived_count,
          ISNULL(SUM(CASE WHEN clearance_type = 'paid' THEN final_amount ELSE 0 END), 0) AS paid_amount,
          ISNULL(SUM(CASE WHEN clearance_type = 'credit' THEN final_amount ELSE 0 END), 0) AS credit_amount,
          ISNULL(SUM(CASE WHEN clearance_type = 'waived' THEN original_amount - final_amount ELSE 0 END), 0) AS waived_amount,
          ISNULL(SUM(CASE WHEN transaction_type = 'gate_in' THEN final_amount ELSE 0 END), 0) AS gate_in_amount,
          ISNULL(SUM(CASE WHEN transaction_type = 'gate_out' THEN final_amount ELSE 0 END), 0) AS gate_out_amount
        FROM BillingClearances
        WHERE ${statsWhere}
      `);

    return NextResponse.json({ clearances: result.recordset, stats: stats.recordset[0] });
  } catch (error) {
    console.error('❌ GET billing clearance error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูล Billing Clearance ได้' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      yard_id,
      transaction_type,
      container_id,
      container_number,
      customer_id,
      clearance_type,
      original_amount = 0,
      final_amount = 0,
      reason,
      invoice_id,
      charges,
    } = body;

    if (!yard_id || !transaction_type || !clearance_type) {
      return NextResponse.json({ error: 'yard_id, transaction_type and clearance_type required' }, { status: 400 });
    }

    if (!['paid', 'credit', 'no_charge', 'waived'].includes(clearance_type)) {
      return NextResponse.json({ error: 'invalid clearance_type' }, { status: 400 });
    }

    if (clearance_type === 'waived' && !reason) {
      return NextResponse.json({ error: 'ต้องระบุเหตุผลการยกเว้นค่าใช้จ่าย' }, { status: 400 });
    }

    const originalAmount = Number(original_amount || 0);
    const finalAmount = Number(final_amount || 0);
    const isWaiveLike = ['waived', 'no_charge'].includes(clearance_type) || finalAmount < originalAmount;

    const db = await getDb();
    const actor = await requirePermission(
      request,
      db,
      isWaiveLike ? 'billing.waive.request' : 'billing.payment.receive',
      'คุณไม่มีสิทธิ์บันทึก Billing Clearance ประเภทนี้'
    );
    if (actor instanceof NextResponse) return actor;

    const result = await db.request()
      .input('yardId', sql.Int, yard_id)
      .input('transactionType', sql.NVarChar, transaction_type)
      .input('containerId', sql.Int, container_id || null)
      .input('containerNumber', sql.NVarChar, container_number || null)
      .input('customerId', sql.Int, customer_id || null)
      .input('clearanceType', sql.NVarChar, clearance_type)
      .input('originalAmount', sql.Decimal(12, 2), original_amount || 0)
      .input('finalAmount', sql.Decimal(12, 2), final_amount || 0)
      .input('reason', sql.NVarChar, reason || null)
      .input('invoiceId', sql.Int, invoice_id || null)
      .input('approvedBy', sql.Int, isWaiveLike ? null : actor.userId)
      .input('charges', sql.NVarChar, charges ? JSON.stringify(charges) : null)
      .input('createdBy', sql.Int, actor.userId)
      .query(`
        INSERT INTO BillingClearances (
          yard_id, transaction_type, container_id, container_number, customer_id,
          clearance_type, original_amount, final_amount, reason, invoice_id,
          approved_by, charges, created_by
        )
        OUTPUT INSERTED.*
        VALUES (
          @yardId, @transactionType, @containerId, @containerNumber, @customerId,
          @clearanceType, @originalAmount, @finalAmount, @reason, @invoiceId,
          @approvedBy, @charges, @createdBy
        )
      `);

    const clearance = result.recordset[0];
    await logAudit({
      userId: actor.userId,
      yardId: yard_id,
      action: 'billing_clearance_create',
      entityType: 'billing_clearance',
      entityId: clearance.clearance_id,
      details: {
        transaction_type,
        container_id,
        container_number,
        customer_id,
        clearance_type,
        original_amount,
        final_amount,
        invoice_id,
      },
    });

    if (isWaiveLike) {
      await logApprovalReview({
        db,
        yardId: yard_id,
        permissionCode: 'billing.waive.request',
        action: clearance_type === 'no_charge' ? 'billing_no_charge_recorded' : 'billing_waive_recorded',
        entityType: 'billing_clearance',
        entityId: clearance.clearance_id,
        requestedBy: actor.userId,
        approvedBy: null,
        reason: reason || null,
        details: {
          transaction_type,
          container_id,
          container_number,
          customer_id,
          clearance_type,
          original_amount: originalAmount,
          final_amount: finalAmount,
          waived_amount: Math.max(originalAmount - finalAmount, 0),
          invoice_id,
        },
      });
    }

    return NextResponse.json({ success: true, clearance, clearance_id: clearance.clearance_id });
  } catch (error) {
    console.error('❌ POST billing clearance error:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึก Billing Clearance ได้' }, { status: 500 });
  }
}
