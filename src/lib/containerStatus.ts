export type ContainerStatus =
  | 'in_yard'
  | 'repair'
  | 'hold'
  | 'billing_hold'
  | 'reserved'
  | 'released'
  | 'gated_out';

export const CONTAINER_STATUS_MODEL: Record<ContainerStatus, {
  label: string;
  description: string;
  severity: 'ok' | 'watch' | 'danger' | 'neutral';
  next: ContainerStatus[];
}> = {
  in_yard: {
    label: 'ในลาน',
    description: 'ตู้รับเข้าลานแล้วและพร้อมเลือกใช้งานตามเงื่อนไข hold/billing',
    severity: 'ok',
    next: ['repair', 'hold', 'billing_hold', 'reserved', 'released', 'gated_out'],
  },
  repair: {
    label: 'ซ่อม',
    description: 'ตู้มี EOR/M&R active หรืออยู่ในกระบวนการซ่อม',
    severity: 'watch',
    next: ['in_yard', 'hold'],
  },
  hold: {
    label: 'Hold',
    description: 'ตู้ถูกระงับด้วยเหตุผลปฏิบัติการหรือคุณภาพ',
    severity: 'danger',
    next: ['in_yard', 'repair'],
  },
  billing_hold: {
    label: 'Billing Hold',
    description: 'ตู้ติดเงื่อนไขการเงินก่อนปล่อยหรือดำเนินการต่อ',
    severity: 'danger',
    next: ['in_yard', 'released'],
  },
  reserved: {
    label: 'Reserved',
    description: 'ตู้ถูกกันไว้สำหรับ booking/customer',
    severity: 'neutral',
    next: ['in_yard', 'released', 'gated_out'],
  },
  released: {
    label: 'Released',
    description: 'ตู้ถูกปล่อยออกจากงานแล้ว รอ gate-out หรือออกจากลานแล้วตาม flow เดิม',
    severity: 'neutral',
    next: ['gated_out'],
  },
  gated_out: {
    label: 'Gate Out',
    description: 'ตู้ออกจากลานแล้ว ไม่ควรกลับมาใช้ในงานในลานจนกว่าจะ gate-in ใหม่',
    severity: 'neutral',
    next: ['in_yard'],
  },
};

export function canTransitionContainerStatus(from: string | null | undefined, to: string | null | undefined) {
  if (!from || !to || from === to) return true;
  const model = CONTAINER_STATUS_MODEL[from as ContainerStatus];
  return Boolean(model?.next.includes(to as ContainerStatus));
}

export function containerStatusLabel(status: string | null | undefined) {
  return CONTAINER_STATUS_MODEL[status as ContainerStatus]?.label || status || '-';
}
