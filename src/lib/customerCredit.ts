import sql from 'mssql';
import { getDb } from '@/lib/db';

type DbPool = Awaited<ReturnType<typeof getDb>>;

export async function ensureCustomerCreditColumns(db: DbPool) {
  await db.request().query(`
    IF COL_LENGTH('Customers', 'credit_limit') IS NULL
      ALTER TABLE Customers ADD credit_limit DECIMAL(12,2) NULL;
    IF COL_LENGTH('Customers', 'credit_hold') IS NULL
      ALTER TABLE Customers ADD credit_hold BIT NOT NULL CONSTRAINT DF_Customers_CreditHold DEFAULT 0;
    IF COL_LENGTH('Customers', 'credit_hold_reason') IS NULL
      ALTER TABLE Customers ADD credit_hold_reason NVARCHAR(300) NULL;
  `);
}

export async function getCustomerCreditSnapshot(db: DbPool, customerId: number, yardId?: number | null) {
  await ensureCustomerCreditColumns(db);
  const result = await db.request()
    .input('customerId', sql.Int, customerId)
    .input('yardId', sql.Int, yardId || null)
    .query(`
      SELECT TOP 1 c.customer_id, c.customer_name,
        ISNULL(c.default_payment_type, 'CASH') AS default_payment_type,
        ISNULL(c.credit_term, 0) AS credit_term,
        ISNULL(c.credit_limit, 0) AS credit_limit,
        ISNULL(c.credit_hold, 0) AS credit_hold,
        c.credit_hold_reason,
        ISNULL((
          SELECT SUM(ISNULL(i.balance_amount, i.grand_total))
          FROM Invoices i
          WHERE i.customer_id = c.customer_id
            AND (@yardId IS NULL OR i.yard_id = @yardId)
            AND i.status IN ('issued', 'overdue')
        ), 0) AS outstanding_amount,
        ISNULL((
          SELECT MAX(DATEDIFF(DAY, ISNULL(i.due_date, i.created_at), GETDATE()))
          FROM Invoices i
          WHERE i.customer_id = c.customer_id
            AND (@yardId IS NULL OR i.yard_id = @yardId)
            AND i.status IN ('issued', 'overdue')
        ), 0) AS oldest_overdue_days
      FROM Customers c
      WHERE c.customer_id = @customerId
    `);

  const row = result.recordset[0] || null;
  if (!row) return null;
  return {
    ...row,
    is_credit: row.default_payment_type === 'CREDIT' || Number(row.credit_term || 0) > 0,
    over_limit: Number(row.credit_limit || 0) > 0 && Number(row.outstanding_amount || 0) > Number(row.credit_limit || 0),
    has_overdue: Number(row.oldest_overdue_days || 0) > 0,
  };
}
