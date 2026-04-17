export interface SopHint {
  code: string;
  module: 'gate' | 'billing' | 'booking' | 'mnr' | 'yard' | 'edi';
  title: string;
  when: string;
  steps: string[];
}

export const OPERATIONAL_SOP_HINTS: SopHint[] = [
  {
    code: 'gate_no_charge',
    module: 'gate',
    title: 'Gate charge เป็น 0 บาท',
    when: 'ใช้เมื่อระบบคำนวณ charge เป็น 0 หรือพนักงานเลือก no charge',
    steps: [
      'ตรวจ tariff/customer rate ว่าครบหรือไม่',
      'เลือกเหตุผล no charge ให้ชัด เช่น credit/customer contract/waive',
      'ตรวจ billing clearance ก่อนออก EIR',
    ],
  },
  {
    code: 'billing_credit_customer',
    module: 'billing',
    title: 'ลูกค้าเครดิต',
    when: 'ใช้เมื่อลูกค้ามี default payment type เป็น CREDIT หรือมี credit term',
    steps: [
      'ออก invoice สถานะ issued แทนการบังคับจ่ายหน้า Gate',
      'ตรวจวงเงินและยอด overdue ก่อนปล่อยตู้',
      'ติดตาม AR aging ตาม credit term',
    ],
  },
  {
    code: 'mnr_completion',
    module: 'mnr',
    title: 'ปิดงานซ่อม M&R',
    when: 'ใช้เมื่อ EOR ซ่อมเสร็จ',
    steps: [
      'แนบรูป after repair และ damage close-up ให้ครบ',
      'บันทึกผู้ตรวจรับและ grade หลังซ่อม',
      'ปลด repair hold และสร้าง invoice ถ้ามีค่าใช้จ่าย',
    ],
  },
  {
    code: 'edi_retry',
    module: 'edi',
    title: 'ส่ง EDI ไม่สำเร็จ',
    when: 'ใช้เมื่อ integration log มีสถานะ failed หรือ retrying',
    steps: [
      'เปิดดู error message และ payload',
      'แก้ mapping เช่น shipping line/booking/customer',
      'retry และตรวจ log ว่าสำเร็จ',
    ],
  },
];
