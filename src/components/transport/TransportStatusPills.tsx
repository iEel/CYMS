'use client';

const statusStyles: Record<string, string> = {
  requested: 'bg-amber-50 text-amber-700 ring-amber-200',
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  at_gate: 'bg-blue-50 text-blue-700 ring-blue-200',
  released: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-200',
};

const statusLabels: Record<string, string> = {
  requested: 'รอรับงาน',
  pending: 'รอดำเนินการ',
  at_gate: 'อยู่หน้าด่าน',
  released: 'ปล่อยออกแล้ว',
  completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก',
};

export function TransportStatusPill({ status }: { status: string }) {
  const normalized = status || 'requested';
  const style = statusStyles[normalized] || 'bg-slate-100 text-slate-700 ring-slate-200';

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${style}`}>
      {statusLabels[normalized] || normalized}
    </span>
  );
}
