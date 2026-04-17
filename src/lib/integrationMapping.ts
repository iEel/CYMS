export interface IntegrationMapItem {
  event: string;
  sourceModule: string;
  targetSystem: 'EDI' | 'ERP' | 'Customer Portal' | 'Internal';
  payload: string[];
  trigger: string;
  logKey: string;
  retryPolicy: string;
}

export const INTEGRATION_MAPPING: IntegrationMapItem[] = [
  {
    event: 'gate_in_completed',
    sourceModule: 'Gate In',
    targetSystem: 'EDI',
    payload: ['container_number', 'eir_number', 'booking_number', 'customer_id', 'gate_in_time'],
    trigger: 'หลังบันทึก Gate In และ EIR สำเร็จ',
    logKey: 'CODECO_GATE_IN',
    retryPolicy: 'retry ได้หลังแก้ validation หรือ endpoint error',
  },
  {
    event: 'gate_out_completed',
    sourceModule: 'Gate Out',
    targetSystem: 'EDI',
    payload: ['container_number', 'eir_number', 'booking_number', 'customer_id', 'gate_out_time'],
    trigger: 'หลังบันทึก Gate Out และ EIR สำเร็จ',
    logKey: 'CODECO_GATE_OUT',
    retryPolicy: 'retry ได้หลังแก้ booking/customer mapping',
  },
  {
    event: 'invoice_issued',
    sourceModule: 'Billing',
    targetSystem: 'ERP',
    payload: ['invoice_number', 'customer_id', 'container_id', 'grand_total', 'status'],
    trigger: 'หลังออกใบแจ้งหนี้สถานะ issued',
    logKey: 'ERP_INVOICE',
    retryPolicy: 'retry หลังแก้ customer/tax/account mapping',
  },
  {
    event: 'receipt_paid',
    sourceModule: 'Billing',
    targetSystem: 'Customer Portal',
    payload: ['receipt_number', 'invoice_number', 'paid_amount', 'paid_at'],
    trigger: 'หลังรับชำระสำเร็จ',
    logKey: 'PORTAL_RECEIPT',
    retryPolicy: 'sync ใหม่ได้เมื่อ portal unavailable',
  },
  {
    event: 'eor_completed',
    sourceModule: 'M&R',
    targetSystem: 'Customer Portal',
    payload: ['eor_number', 'container_number', 'actual_cost', 'repair_photo_evidence'],
    trigger: 'หลังปิดงานซ่อมและตรวจรับ',
    logKey: 'PORTAL_EOR',
    retryPolicy: 'sync ใหม่ได้หลังอัปโหลด evidence ครบ',
  },
];
