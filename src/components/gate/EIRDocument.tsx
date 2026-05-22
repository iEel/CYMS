'use client';

import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { formatDateTime } from '@/lib/utils';
import { RawImage } from '@/components/ui/RawImage';
import type { EvidencePhoto, PhotoCompleteness, PhotoRequirement } from '@/lib/photoEvidence';

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

export interface EIRData {
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
  truck_plate: string;
  truck_company: string;
  booking_ref: string;
  yard_name: string;
  yard_code: string;
  zone_name: string;
  bay: number;
  row: number;
  tier: number;
  processed_by: string;
  damage_report: {
    points?: DamagePoint[];
    condition_grade?: string;
    inspector_notes?: string;
    photos?: string[];
    photo_evidence?: EvidencePhoto[];
    photo_requirements?: PhotoRequirement[];
    photo_completeness?: PhotoCompleteness;
  } | null;
  notes: string;
  container_condition: 'sound' | 'damage';
  container_grade: string;
  company: { company_name: string; address: string; phone: string; email: string; logo_url: string; tax_id: string } | null;
}

interface EIRDocumentProps {
  data: EIRData;
  onClose?: () => void;
}

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
  const hasDamage = data.container_condition === 'damage';
  const printStyles = `
    @media print {
      @page { size: A5 landscape; margin: 4mm; }
      html, body {
        width: auto !important;
        height: auto !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
      }
      #eir-overlay {
        width: 202mm !important;
        height: auto !important;
        min-height: 0 !important;
        margin: 0 auto !important;
        page-break-after: avoid !important;
        break-after: avoid-page !important;
      }
      #eir-print-area {
        width: 202mm !important;
        height: 139mm !important;
        margin: 0 auto !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
        page-break-inside: avoid !important;
        break-inside: avoid-page !important;
        font-size: 12px !important;
        line-height: 1.25 !important;
      }
      #eir-print-area .eir-header {
        padding: 3mm 4mm !important;
      }
      #eir-print-area .eir-body {
        padding: 3mm 4mm !important;
      }
      #eir-print-area .eir-company {
        font-size: 15px !important;
        line-height: 1.2 !important;
      }
      #eir-print-area .eir-doc-title {
        font-size: 14px !important;
      }
      #eir-print-area .eir-section-title {
        font-size: 10.5px !important;
        letter-spacing: 0.03em !important;
      }
      #eir-print-area .eir-label {
        font-size: 9px !important;
        line-height: 1.15 !important;
      }
      #eir-print-area .eir-value {
        font-size: 12px !important;
        line-height: 1.25 !important;
      }
      #eir-print-area .eir-value-strong {
        font-size: 13px !important;
      }
      #eir-print-area .eir-sign-line {
        height: 12mm !important;
      }
      #eir-print-area svg {
        width: 18mm !important;
        height: 18mm !important;
      }
    }
  `;

  const content = (
    <div id="eir-overlay" className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm overflow-y-auto p-4">
      <style>{printStyles}</style>
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
      <div id="eir-print-area" className="max-w-[900px] mx-auto bg-white text-slate-800 rounded-xl shadow-2xl print:shadow-none print:rounded-none print:max-w-none overflow-hidden text-[12px]"
        style={{ fontFamily: "'Inter', 'Noto Sans Thai', sans-serif" }}>

        {/* === HEADER === */}
        <div className="eir-header border-b-2 border-blue-600 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {data.company?.logo_url ? (
              <RawImage src={data.company.logo_url} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-sm font-black">
                {(data.company?.company_name || 'C').charAt(0)}
              </div>
            )}
            <div>
              <h1 className="eir-company text-base font-bold text-slate-800">
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
            <h2 className="eir-doc-title text-sm font-bold text-blue-700">Equipment Interchange Receipt</h2>
            <div className="flex items-center gap-1 justify-end mt-0.5">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white ${isGateIn ? 'bg-emerald-500' : 'bg-blue-500'}`}>
                {isGateIn ? '📥 GATE-IN' : '📤 GATE-OUT'}
              </span>
            </div>
          </div>
        </div>

        {/* === MAIN BODY === */}
        <div className="eir-body px-5 py-3 space-y-2">

          {/* Row 1: EIR Info */}
          <div className="grid grid-cols-4 gap-2">
            <InfoCell label="EIR NO." value={data.eir_number} mono bold />
            <InfoCell label="วันที่" value={data.date ? formatDateTime(data.date) : '-'} />
            <InfoCell label="ลาน" value={data.yard_name || '-'} />
            <InfoCell label="ผู้ดำเนินการ" value={data.processed_by || 'ระบบ'} />
          </div>

          {/* Row 2: Container Info */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-3 py-1 border-b border-slate-200">
              <h3 className="eir-section-title text-[10px] font-bold text-slate-500 uppercase tracking-wider">📦 ข้อมูลตู้ (Container Information)</h3>
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
                <p className="eir-label text-[10px] text-slate-400 uppercase font-semibold mb-1">สภาพตู้ (Condition)</p>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${hasDamage ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {hasDamage ? '⚠️ Damage' : '✅ Sound'}
                  </span>
                </div>
              </div>

              {/* เกรดตู้ */}
              <div className="p-2">
                <p className="eir-label text-[10px] text-slate-400 uppercase font-semibold mb-1">เกรดตู้ (Grade)</p>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-white text-sm font-black"
                    style={{ backgroundColor: gradeInfo.color }}>
                    {data.container_grade}
                  </span>
                  <span className="eir-value text-xs text-slate-600">{gradeInfo.desc}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Driver + QR Code */}
          <div className="grid grid-cols-4 gap-2">
            {/* Driver Info */}
            <div className="col-span-3 border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-3 py-1 border-b border-slate-200">
                <h3 className="eir-section-title text-[10px] font-bold text-slate-500 uppercase tracking-wider">🚛 คนขับ / รถ</h3>
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-200">
                <InfoCell label="ชื่อคนขับ" value={data.driver_name || '-'} className="p-2" />
                <InfoCell label="บริษัทคนขับ" value={data.truck_company || '-'} className="p-2" />
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
                    <div className="eir-sign-line h-10 border-b border-slate-300 mb-1" />
                    <p className="eir-value text-[10px] font-semibold text-slate-600">{sig.label}</p>
                    {sig.sub && <p className="eir-label text-[9px] text-slate-400">({sig.sub})</p>}
                    <p className="eir-label text-[9px] text-slate-400">วันที่ ......../......../........</p>
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

  // Portal renders EIR as direct child of <body> for clean printing
  if (typeof document === 'undefined') return content;
  return createPortal(content, document.body);
}

// Reusable info cell
function InfoCell({ label, value, mono, bold, className }: {
  label: string; value: string | number | boolean | null | undefined;
  mono?: boolean; bold?: boolean; large?: boolean; className?: string;
}) {
  return (
    <div className={className || 'p-1'}>
      <p className="eir-label text-[9px] text-slate-400 uppercase font-semibold mb-0">{label}</p>
      <p className={`eir-value text-slate-800 ${mono ? 'font-mono' : ''} ${bold ? 'font-bold eir-value-strong' : 'font-medium'} text-[11px]`}>
        {value != null && value !== '' ? String(value) : '-'}
      </p>
    </div>
  );
}
