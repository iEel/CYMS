export type DataQualitySeverity = 'info' | 'warning' | 'critical';

export interface DataQualityRule {
  code: string;
  title: string;
  area: 'gate' | 'billing' | 'booking' | 'mnr' | 'edi' | 'customer' | 'yard';
  severity: DataQualitySeverity;
  message: string;
  ownerRole: string;
  recommendedAction: string;
}

export const DATA_QUALITY_RULES: DataQualityRule[] = [
  {
    code: 'gate_missing_eir',
    title: 'Gate transaction missing EIR',
    area: 'gate',
    severity: 'critical',
    message: 'Gate In/Out ที่ไม่มีเลข EIR ทำให้เอกสารปลายทางและ EDI ตามงานยาก',
    ownerRole: 'Gate Clerk',
    recommendedAction: 'ตรวจสอบ transaction และออกหรือผูก EIR ให้ครบ',
  },
  {
    code: 'gate_missing_billing_clearance',
    title: 'Gate transaction missing billing clearance',
    area: 'billing',
    severity: 'warning',
    message: 'งาน Gate ที่ไม่มี billing clearance อาจทำให้เก็บเงินตกหล่น',
    ownerRole: 'Billing',
    recommendedAction: 'ตรวจ charge/no charge และสร้าง clearance ให้ครบ',
  },
  {
    code: 'invoice_open_overdue',
    title: 'Open or overdue invoice',
    area: 'billing',
    severity: 'warning',
    message: 'ใบแจ้งหนี้ที่ยังค้างชำระควรถูกตามใน AR',
    ownerRole: 'Billing',
    recommendedAction: 'ติดตามรับชำระ หรือออกใบลดหนี้/เอกสารใหม่ถ้าข้อมูลผิด',
  },
  {
    code: 'booking_over_received',
    title: 'Booking over received',
    area: 'booking',
    severity: 'critical',
    message: 'จำนวนตู้รับเข้าเกินจำนวนใน booking',
    ownerRole: 'Operations',
    recommendedAction: 'ตรวจเลข booking และตู้ที่รับเข้าจริง',
  },
  {
    code: 'booking_over_released',
    title: 'Booking over released',
    area: 'booking',
    severity: 'critical',
    message: 'จำนวนตู้ปล่อยออกเกินจำนวนใน booking',
    ownerRole: 'Operations',
    recommendedAction: 'ตรวจ Gate Out และ booking assignment',
  },
  {
    code: 'mnr_completed_without_invoice',
    title: 'Completed M&R without invoice',
    area: 'mnr',
    severity: 'warning',
    message: 'EOR ที่ซ่อมเสร็จและมีค่าใช้จ่ายควรถูกวางบิล',
    ownerRole: 'Billing',
    recommendedAction: 'สร้างหรือผูก invoice กับ EOR',
  },
  {
    code: 'edi_failed',
    title: 'Failed integration message',
    area: 'edi',
    severity: 'warning',
    message: 'ข้อมูลที่ส่งออกไม่สำเร็จควรถูก retry หรือแก้ error',
    ownerRole: 'Admin',
    recommendedAction: 'เปิด integration log แล้ว retry หลังแก้สาเหตุ',
  },
  {
    code: 'customer_credit_over_limit',
    title: 'Customer credit over limit',
    area: 'customer',
    severity: 'critical',
    message: 'ลูกค้าเครดิตมียอดค้างเกินวงเงิน',
    ownerRole: 'Billing',
    recommendedAction: 'แจ้ง supervisor และพิจารณา credit hold',
  },
];

export function getDataQualityRule(code: string) {
  return DATA_QUALITY_RULES.find((rule) => rule.code === code) || null;
}
