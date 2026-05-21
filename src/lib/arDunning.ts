export type ARDunningStage = 'friendly_reminder' | 'second_notice' | 'credit_hold_review' | 'final_notice';
export type ARDunningSeverity = 'info' | 'warning' | 'danger' | 'critical';
export type ARDunningAction = 'email_reminder' | 'call_customer' | 'credit_hold_review' | 'final_notice_and_credit_hold_review';

export interface ARDunningCustomer {
  customer_id: number;
  customer_name: string;
  total: number;
  current?: number;
  d30?: number;
  d60?: number;
  d90?: number;
  d90plus?: number;
  invoice_count: number;
  oldest_days: number;
}

export interface ARDunningItem {
  customer_id: number;
  customer_name: string;
  outstanding_amount: number;
  invoice_count: number;
  oldest_days: number;
  stage: ARDunningStage;
  severity: ARDunningSeverity;
  recommended_action: ARDunningAction;
  email_subject: string;
  email_body: string;
  priority: number;
}

function money(value: number) {
  return `฿${Math.round(value).toLocaleString('th-TH')}`;
}

function stageFromAge(days: number): Pick<ARDunningItem, 'stage' | 'severity' | 'recommended_action' | 'priority'> {
  if (days > 90) {
    return {
      stage: 'final_notice',
      severity: 'critical',
      recommended_action: 'final_notice_and_credit_hold_review',
      priority: 400 + days,
    };
  }
  if (days > 60) {
    return {
      stage: 'credit_hold_review',
      severity: 'danger',
      recommended_action: 'credit_hold_review',
      priority: 300 + days,
    };
  }
  if (days > 30) {
    return {
      stage: 'second_notice',
      severity: 'warning',
      recommended_action: 'call_customer',
      priority: 200 + days,
    };
  }
  return {
    stage: 'friendly_reminder',
    severity: 'info',
    recommended_action: 'email_reminder',
    priority: 100 + days,
  };
}

function stageLabel(stage: ARDunningStage) {
  const labels: Record<ARDunningStage, string> = {
    friendly_reminder: 'แจ้งเตือนชำระเงิน',
    second_notice: 'แจ้งเตือนครั้งที่ 2',
    credit_hold_review: 'พิจารณา Credit Hold',
    final_notice: 'แจ้งเตือนขั้นสุดท้าย',
  };
  return labels[stage];
}

function buildDraft(customer: ARDunningCustomer, stage: ARDunningStage) {
  const subject = `[CYMS] ${stageLabel(stage)} - ${customer.customer_name}`;
  const body = [
    `เรียน ${customer.customer_name},`,
    '',
    `ระบบ CYMS พบยอดค้างชำระรวม ${money(customer.total)} จาก ${customer.invoice_count} ใบแจ้งหนี้`,
    `รายการเก่าสุดค้างอยู่ ${customer.oldest_days} วัน`,
    '',
    stage === 'final_notice'
      ? 'กรุณาติดต่อฝ่ายบัญชีและดำเนินการชำระเงินโดยเร็ว เพื่อหลีกเลี่ยงการระงับเครดิต/การปล่อยตู้'
      : stage === 'credit_hold_review'
        ? 'กรุณาติดต่อฝ่ายบัญชีเพื่อยืนยันแผนการชำระเงิน รายการนี้อาจถูกเสนอพิจารณา Credit Hold'
        : 'กรุณาตรวจสอบและดำเนินการชำระเงินตามกำหนด',
    '',
    'ขอบคุณครับ/ค่ะ',
    'ทีมบัญชี CYMS',
  ].join('\n');

  return { subject, body };
}

export function buildARDunningPlan(customers: ARDunningCustomer[]) {
  const items: ARDunningItem[] = customers
    .filter(customer => customer.total > 0 && customer.oldest_days > 0)
    .map(customer => {
      const stage = stageFromAge(customer.oldest_days);
      const draft = buildDraft(customer, stage.stage);
      return {
        customer_id: customer.customer_id,
        customer_name: customer.customer_name,
        outstanding_amount: customer.total,
        invoice_count: customer.invoice_count,
        oldest_days: customer.oldest_days,
        stage: stage.stage,
        severity: stage.severity,
        recommended_action: stage.recommended_action,
        email_subject: draft.subject,
        email_body: draft.body,
        priority: stage.priority + Math.min(customer.total / 1000, 100),
      };
    })
    .sort((a, b) => b.priority - a.priority || b.outstanding_amount - a.outstanding_amount);

  return {
    items,
    summary: {
      total_customers: items.length,
      critical_customers: items.filter(item => item.severity === 'critical').length,
      total_exposure: items.reduce((sum, item) => sum + item.outstanding_amount, 0),
      friendly_reminder_count: items.filter(item => item.stage === 'friendly_reminder').length,
      second_notice_count: items.filter(item => item.stage === 'second_notice').length,
      credit_hold_review_count: items.filter(item => item.stage === 'credit_hold_review').length,
      final_notice_count: items.filter(item => item.stage === 'final_notice').length,
    },
  };
}
