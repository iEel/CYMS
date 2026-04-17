import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { ensureCustomerCreditColumns, getCustomerCreditSnapshot } from '@/lib/customerCredit';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id');
    const yardId = Number(searchParams.get('yard_id') || 1);
    const db = await getDb();
    await ensureCustomerCreditColumns(db);

    if (customerId) {
      const snapshot = await getCustomerCreditSnapshot(db, Number(customerId), yardId);
      return NextResponse.json({ customer: snapshot });
    }

    const result = await db.request()
      .input('yardId', sql.Int, yardId)
      .query(`
        SELECT c.customer_id, c.customer_name,
          ISNULL(c.default_payment_type, 'CASH') AS default_payment_type,
          ISNULL(c.credit_term, 0) AS credit_term,
          ISNULL(c.credit_limit, 0) AS credit_limit,
          ISNULL(c.credit_hold, 0) AS credit_hold,
          c.credit_hold_reason,
          ISNULL(SUM(CASE WHEN i.status IN ('issued', 'overdue')
            THEN ISNULL(i.balance_amount, i.grand_total) ELSE 0 END), 0) AS outstanding_amount,
          ISNULL(MAX(CASE WHEN i.status IN ('issued', 'overdue')
            THEN DATEDIFF(DAY, ISNULL(i.due_date, i.created_at), GETDATE()) ELSE 0 END), 0) AS oldest_overdue_days
        FROM Customers c
        LEFT JOIN Invoices i ON i.customer_id = c.customer_id AND i.yard_id = @yardId
        WHERE ISNULL(c.default_payment_type, 'CASH') = 'CREDIT'
          OR ISNULL(c.credit_term, 0) > 0
          OR ISNULL(c.credit_limit, 0) > 0
        GROUP BY c.customer_id, c.customer_name, c.default_payment_type, c.credit_term,
          c.credit_limit, c.credit_hold, c.credit_hold_reason
        ORDER BY outstanding_amount DESC, c.customer_name
      `);

    const customers = result.recordset.map((row) => ({
      ...row,
      is_credit: row.default_payment_type === 'CREDIT' || Number(row.credit_term || 0) > 0,
      over_limit: Number(row.credit_limit || 0) > 0 && Number(row.outstanding_amount || 0) > Number(row.credit_limit || 0),
      has_overdue: Number(row.oldest_overdue_days || 0) > 0,
    }));

    return NextResponse.json({ customers });
  } catch (error) {
    console.error('GET credit control error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลเครดิตลูกค้าได้' }, { status: 500 });
  }
}
