import { getCustomerCreditSnapshot } from '@/lib/customerCredit';

type DbPool = Parameters<typeof getCustomerCreditSnapshot>[0];

export type BillingGuardSeverity = 'info' | 'warning' | 'danger';

export interface BillingGuardWarning {
  code: string;
  severity: BillingGuardSeverity;
  title: string;
  message: string;
  recommended_action: string;
}

export interface BillingGuardResult {
  mode: 'soft';
  customer_id: number | null;
  is_credit: boolean;
  credit_term: number;
  credit_limit: number;
  outstanding_amount: number;
  oldest_overdue_days: number;
  credit_hold: boolean;
  credit_hold_reason: string | null;
  can_continue: true;
  warnings: BillingGuardWarning[];
}

export async function getBillingGuard(
  db: DbPool,
  customerId: number | null | undefined,
  yardId?: number | null
): Promise<BillingGuardResult> {
  if (!customerId) {
    return {
      mode: 'soft',
      customer_id: null,
      is_credit: false,
      credit_term: 0,
      credit_limit: 0,
      outstanding_amount: 0,
      oldest_overdue_days: 0,
      credit_hold: false,
      credit_hold_reason: null,
      can_continue: true,
      warnings: [
        {
          code: 'billing_customer_missing',
          severity: 'warning',
          title: 'ยังไม่ได้เลือกลูกค้าที่เรียกเก็บเงิน',
          message: 'ระบบยังคำนวณเครดิตและสถานะหนี้ไม่ได้ เพราะยังไม่มี Billing Customer',
          recommended_action: 'เลือกลูกค้าที่ต้องเรียกเก็บเงินก่อนออกเอกสาร',
        },
      ],
    };
  }

  const snapshot = await getCustomerCreditSnapshot(db, customerId, yardId);
  const warnings: BillingGuardWarning[] = [];

  if (!snapshot) {
    warnings.push({
      code: 'billing_customer_not_found',
      severity: 'danger',
      title: 'ไม่พบข้อมูลลูกค้า',
      message: 'ไม่พบ master ลูกค้าสำหรับตรวจสถานะเครดิต',
      recommended_action: 'ตรวจสอบข้อมูลลูกค้าในหน้าตั้งค่าก่อนออกเอกสาร',
    });
  } else {
    const creditLimit = Number(snapshot.credit_limit || 0);
    const outstanding = Number(snapshot.outstanding_amount || 0);
    const oldestOverdueDays = Number(snapshot.oldest_overdue_days || 0);
    const creditTerm = Number(snapshot.credit_term || 0);
    const isCredit = Boolean(snapshot.is_credit);

    if (snapshot.credit_hold) {
      warnings.push({
        code: 'credit_hold',
        severity: 'danger',
        title: 'ลูกค้าติด Credit Hold',
        message: snapshot.credit_hold_reason || 'ลูกค้ารายนี้ถูกตั้งสถานะ Credit Hold',
        recommended_action: 'แจ้งฝ่ายบัญชีหรือหัวหน้างานตรวจสอบก่อนออกเอกสาร',
      });
    }

    if (isCredit && creditLimit <= 0) {
      warnings.push({
        code: 'credit_limit_missing',
        severity: 'warning',
        title: 'ยังไม่ได้กำหนดวงเงินเครดิต',
        message: 'ลูกค้าถูกตั้งเป็นเครดิต แต่ยังไม่มีวงเงินเครดิตใน master',
        recommended_action: 'กำหนดวงเงินเครดิตที่หน้าลูกค้าเพื่อควบคุมความเสี่ยง',
      });
    }

    if (creditLimit > 0 && outstanding > creditLimit) {
      warnings.push({
        code: 'credit_over_limit',
        severity: 'danger',
        title: 'ยอดค้างเกินวงเงินเครดิต',
        message: `ยอดค้าง ${outstanding.toLocaleString('th-TH')} บาท เกินวงเงิน ${creditLimit.toLocaleString('th-TH')} บาท`,
        recommended_action: 'ให้ฝ่ายบัญชีพิจารณาเก็บเงินหรืออนุมัติเป็นกรณีพิเศษ',
      });
    }

    if (oldestOverdueDays > 0) {
      warnings.push({
        code: 'invoice_overdue',
        severity: oldestOverdueDays > creditTerm && creditTerm > 0 ? 'danger' : 'warning',
        title: 'มีใบแจ้งหนี้ค้างชำระ',
        message: `ใบแจ้งหนี้เก่าสุดค้างมา ${oldestOverdueDays} วัน`,
        recommended_action: 'ตรวจสอบ AR ก่อนออกเอกสารเรียกเก็บเงินเพิ่มเติม',
      });
    }
  }

  return {
    mode: 'soft',
    customer_id: customerId,
    is_credit: Boolean(snapshot?.is_credit),
    credit_term: Number(snapshot?.credit_term || 0),
    credit_limit: Number(snapshot?.credit_limit || 0),
    outstanding_amount: Number(snapshot?.outstanding_amount || 0),
    oldest_overdue_days: Number(snapshot?.oldest_overdue_days || 0),
    credit_hold: Boolean(snapshot?.credit_hold),
    credit_hold_reason: snapshot?.credit_hold_reason || null,
    can_continue: true,
    warnings,
  };
}
