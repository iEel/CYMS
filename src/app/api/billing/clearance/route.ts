import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import sql from 'mssql';
import { logAudit } from '@/lib/audit';

async function ensureBillingClearances(db: sql.ConnectionPool) {
  await db.request().query(`
    IF OBJECT_ID('BillingClearances', 'U') IS NULL
    BEGIN
      CREATE TABLE BillingClearances (
        clearance_id INT PRIMARY KEY IDENTITY(1,1),
        yard_id INT NOT NULL,
        transaction_type NVARCHAR(20) NOT NULL,
        container_id INT NULL,
        container_number NVARCHAR(15) NULL,
        customer_id INT NULL,
        clearance_type NVARCHAR(20) NOT NULL,
        original_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        final_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        reason NVARCHAR(500) NULL,
        invoice_id INT NULL,
        approved_by INT NULL,
        charges NVARCHAR(MAX) NULL,
        created_by INT NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE()
      );
    END
  `);
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
      approved_by,
      charges,
      user_id,
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

    const db = await getDb();
    await ensureBillingClearances(db);

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
      .input('approvedBy', sql.Int, approved_by || null)
      .input('charges', sql.NVarChar, charges ? JSON.stringify(charges) : null)
      .input('createdBy', sql.Int, user_id || null)
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
      userId: user_id || null,
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

    return NextResponse.json({ success: true, clearance, clearance_id: clearance.clearance_id });
  } catch (error) {
    console.error('❌ POST billing clearance error:', error);
    return NextResponse.json({ error: 'ไม่สามารถบันทึก Billing Clearance ได้' }, { status: 500 });
  }
}

