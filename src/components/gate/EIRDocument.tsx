'use client';

import { QRCodeSVG } from 'qrcode.react';
import { formatDateTime } from '@/lib/utils';

interface DamagePoint {
  id: string;
  side: string;
  x: number;
  y: number;
  type: string;
  severity: 'minor' | 'major' | 'severe';
  note: string;
  photo?: string;
}

interface EIRData {
  eir_number: string;
  transaction_type: 'gate_in' | 'gate_out';
  date: string;
  container_number: string;
  size: string;
  type: string;
  shipping_line: string;
  seal_number: string;
  is_laden: boolean;
  driver_name: string;
  driver_license: string;
  truck_plate: string;
  booking_ref: string;
  yard_name: string;
  yard_code: string;
  zone_name: string;
  bay: number;
  row: number;
  tier: number;
  processed_by: string;
  damage_report: { points?: DamagePoint[]; condition_grade?: string; inspector_notes?: string; photos?: string[] } | null;
  notes: string;
  container_condition: 'sound' | 'damage';
  container_grade: string;
  company: { company_name: string; address: string; phone: string; email: string; logo_url: string; tax_id: string } | null;
}

interface EIRDocumentProps {
  data: EIRData;
  onClose?: () => void;
}

const SIDE_LABELS: Record<string, string> = {
  front: 'ด้านหน้า', back: 'ด้านหลัง', left: 'ด้านซ้าย',
  right: 'ด้านขวา', top: 'ด้านบน', floor: 'พื้น',
};

const DAMAGE_LABELS: Record<string, string> = {
  dent: 'บุ๋ม (Dent)', hole: 'ทะลุ (Hole)', rust: 'สนิม (Rust)',
  scratch: 'ขีดข่วน (Scratch)', crack: 'แตกร้าว (Crack)', missing_part: 'ชิ้นส่วนหาย',
};

const SEVERITY_LABELS: Record<string, string> = {
  minor: 'เล็กน้อย', major: 'ปานกลาง', severe: 'รุนแรง',
};

const GRADE_INFO: Record<string, { label: string; desc: string; color: string }> = {
  A: { label: 'Grade A', desc: 'สภาพดี', color: '#10B981' },
  B: { label: 'Grade B', desc: 'สภาพพอใช้', color: '#F59E0B' },
  C: { label: 'Grade C', desc: 'ใส่ของทั่วไป', color: '#F97316' },
  D: { label: 'Grade D', desc: 'ชำรุดหนัก — ห้ามใช้งาน', color: '#EF4444' },
};

export default function EIRDocument({ data, onClose }: EIRDocumentProps) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const qrUrl = `${origin}/eir/${data.eir_number}`;
  const isGateIn = data.transaction_type === 'gate_in';
  const gradeInfo = GRADE_INFO[data.container_grade] || GRADE_INFO['A'];
  const damagePoints = data.damage_report?.points || [];
  const hasDamage = data.container_condition === 'damage';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm overflow-y-auto p-4 print:p-0 print:bg-white print:backdrop-blur-none">
      {/* Print & Close Controls — hidden on print */}
      <div className="max-w-[1100px] mx-auto mb-3 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-lg">
            🖨️ พิมพ์ A5
          </button>
          <span className="text-xs text-white/70">กระดาษ A5 แนวนอน (Landscape)</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors">✕</button>
        )}
      </div>

      {/* A5 Document */}
      <div id="eir-print-area" className="max-w-[600px] mx-auto bg-white text-slate-800 rounded-xl shadow-2xl print:shadow-none print:rounded-none print:max-w-none overflow-hidden text-[11px]"
        style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}>

        {/* === HEADER === */}
        <div className="border-b-2 border-blue-600 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {data.company?.logo_url ? (
              <img src={data.company.logo_url} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-sm font-black">
                {(data.company?.company_name || 'C').charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-sm font-bold text-slate-800">
                {data.company?.company_name || 'CYMS'}{' '}
                <span className="text-[9px] font-medium text-slate-500">(สำนักงานใหญ่)</span>
              </h1>
              {data.company?.address && (
                <p className="text-[8px] text-slate-400 mt-0">{data.company.address}</p>
              )}
              {(data.company?.tax_id || data.company?.phone) && (
                <p className="text-[8px] text-slate-400">
                  {data.company?.tax_id && `เลขภาษี: ${data.company.tax_id}`}
                  {data.company?.tax_id && data.company?.phone && ' · '}
                  {data.company?.phone && `โทร: ${data.company.phone}`}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-xs font-bold text-blue-700">Equipment Interchange Receipt</h2>
            <div className="flex items-center gap-1 justify-end mt-0.5">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white ${isGateIn ? 'bg-emerald-500' : 'bg-blue-500'}`}>
                {isGateIn ? '📥 GATE-IN' : '📤 GATE-OUT'}
              </span>
            </div>
          </div>
        </div>

        {/* === MAIN BODY === */}
        <div className="px-4 py-2 space-y-2">

          {/* Row 1: EIR Info */}
          <div className="grid grid-cols-4 gap-2">
            <InfoCell label="EIR NO." value={data.eir_number} mono bold />
            <InfoCell label="วันที่" value={data.date ? formatDateTime(data.date) : '-'} />
            <InfoCell label="ลาน" value={data.yard_name || '-'} />
            <InfoCell label="ผู้ดำเนินการ" value={data.processed_by || 'ระบบ'} />
          </div>

          {/* Row 2: Container Info */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">📦 ข้อมูลตู้คอนเทนเนอร์ (Container Information)</h3>
            </div>
            <div className="grid grid-cols-5 gap-0 divide-x divide-slate-200">
              <InfoCell label="เลขตู้" value={data.container_number} mono bold className="p-2" />
              <InfoCell label="ขนาด/ประเภท" value={`${data.size}'${data.type}`} className="p-2" />
              <InfoCell label="สายเรือ" value={data.shipping_line || '-'} className="p-2" />
              <InfoCell label="ซีล" value={data.seal_number || '-'} mono className="p-2" />
              <InfoCell label="สถานะ" value={data.is_laden ? 'มีสินค้า' : 'ตู้เปล่า'} className="p-2" />
            </div>
            <div className="grid grid-cols-5 gap-0 divide-x divide-slate-200 border-t border-slate-200">
              <InfoCell label="Booking Ref" value={data.booking_ref || '-'} className="p-2" />
              <InfoCell label="โซน" value={data.zone_name || '-'} className="p-2" />
              <InfoCell label="Bay/Row/Tier" value={data.zone_name ? `B${data.bay}-R${data.row}-T${data.tier}` : '-'} mono className="p-2" />

              {/* สภาพตู้ */}
              <div className="p-2">
                <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">สภาพตู้ (Condition)</p>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${hasDamage ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {hasDamage ? '⚠️ Damage' : '✅ Sound'}
                  </span>
                </div>
              </div>

              {/* เกรดตู้ */}
              <div className="p-2">
                <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">เกรดตู้ (Grade)</p>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-white text-sm font-black"
                    style={{ backgroundColor: gradeInfo.color }}>
                    {data.container_grade}
                  </span>
                  <span className="text-xs text-slate-600">{gradeInfo.desc}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Driver + QR Code */}
          <div className="grid grid-cols-4 gap-2">
            {/* Driver Info */}
            <div className="col-span-3 border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-3 py-1 border-b border-slate-200">
                <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">🚛 คนขับ / รถ</h3>
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-200">
                <InfoCell label="ชื่อคนขับ" value={data.driver_name || '-'} className="p-2" />
                <InfoCell label="ใบขับขี่" value={data.driver_license || '-'} className="p-2" />
                <InfoCell label="ทะเบียนรถ" value={data.truck_plate || '-'} mono className="p-2" />
              </div>
            </div>

            {/* QR Code */}
            <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col items-center justify-center p-2">
              <QRCodeSVG
                value={qrUrl}
                size={55}
                level="M"
                includeMargin={false}
              />
              <p className="text-[7px] text-slate-400 mt-1 text-center leading-tight">
                สแกนดูรูปถ่าย HD
              </p>
            </div>
          </div>

          {/* Row 4: Damage Summary (if any) */}
          {damagePoints.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-red-50 px-4 py-2 border-b border-slate-200">
                <h3 className="text-xs font-bold text-red-600 uppercase tracking-wider">
                  ⚠️ รายงานความเสียหาย (Damage Report) — {damagePoints.length} จุด
                </h3>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-left text-[10px] text-slate-500 uppercase">
                    <th className="px-3 py-2 w-8">#</th>
                    <th className="px-3 py-2">ตำแหน่ง (Position)</th>
                    <th className="px-3 py-2">ประเภท (Type)</th>
                    <th className="px-3 py-2">ความรุนแรง (Severity)</th>
                    <th className="px-3 py-2">พิกัด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {damagePoints.map((point, i) => (
                    <tr key={point.id || i} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-400 font-mono">{i + 1}</td>
                      <td className="px-3 py-2">{SIDE_LABELS[point.side] || point.side}</td>
                      <td className="px-3 py-2">{DAMAGE_LABELS[point.type] || point.type}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                          point.severity === 'severe' ? 'bg-red-100 text-red-700' :
                          point.severity === 'major' ? 'bg-orange-100 text-orange-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {SEVERITY_LABELS[point.severity] || point.severity}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-400">
                        ({point.x?.toFixed(0)}%, {point.y?.toFixed(0)}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.damage_report?.inspector_notes && (
                <div className="px-4 py-2 border-t border-slate-200 bg-amber-50 text-xs text-amber-800">
                  <span className="font-semibold">บันทึกผู้ตรวจ:</span> {data.damage_report.inspector_notes}
                </div>
              )}
            </div>
          )}

          {/* Row 5: Notes */}
          {data.notes && (
            <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-xs">
              <span className="font-semibold text-amber-700">หมายเหตุ:</span>{' '}
              <span className="text-amber-800">{data.notes}</span>
            </div>
          )}

          {/* Row 5: Signatures */}
          <div className="grid grid-cols-3 gap-3 pt-1">
            {[
              { label: 'ผู้ตรวจสภาพตู้', sub: data.processed_by || '' },
              { label: 'คนขับรถ', sub: data.driver_name || '' },
              { label: 'ผู้อนุมัติ', sub: '' },
            ].map((sig, i) => (
              <div key={i} className="text-center">
                <div className="h-8 border-b border-slate-300 mb-1" />
                <p className="text-[9px] font-semibold text-slate-600">{sig.label}</p>
                {sig.sub && <p className="text-[8px] text-slate-400">({sig.sub})</p>}
                <p className="text-[8px] text-slate-400">วันที่ ......../......../........</p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="text-center pt-1 pb-1 border-t border-slate-100">
            <p className="text-[7px] text-slate-300">
              CYMS — {data.eir_number}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Reusable info cell
function InfoCell({ label, value, mono, bold, className }: {
  label: string; value: string | number | boolean | null | undefined;
  mono?: boolean; bold?: boolean; large?: boolean; className?: string;
}) {
  return (
    <div className={className || 'p-1'}>
      <p className="text-[8px] text-slate-400 uppercase font-semibold mb-0">{label}</p>
      <p className={`text-slate-800 ${mono ? 'font-mono' : ''} ${bold ? 'font-bold' : 'font-medium'} text-[10px]`}>
        {value != null && value !== '' ? String(value) : '-'}
      </p>
    </div>
  );
}
