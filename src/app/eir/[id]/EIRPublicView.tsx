'use client';

import { useState, useEffect, use } from 'react';
import { formatDateTime } from '@/lib/utils';

interface DamagePoint {
  id: string;
  side: string;
  type: string;
  severity: string;
  photo?: string;
  note?: string;
}

const SIDE_LABELS: Record<string, string> = {
  front: 'ด้านหน้า', back: 'ด้านหลัง', left: 'ด้านซ้าย',
  right: 'ด้านขวา', top: 'ด้านบน', floor: 'พื้น',
};
const DAMAGE_LABELS: Record<string, string> = {
  dent: 'บุ๋ม (Dent)', hole: 'ทะลุ (Hole)', rust: 'สนิม (Rust)',
  scratch: 'ขีดข่วน (Scratch)', crack: 'แตกร้าว (Crack)', missing_part: 'ชิ้นส่วนหาย',
};

interface EIRPublicViewProps {
  paramsPromise: Promise<{ id: string }>;
}

export default function EIRPublicView({ paramsPromise }: EIRPublicViewProps) {
  const params = use(paramsPromise);
  const eirNumber = params.id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEIR() {
      try {
        const res = await fetch(`/api/gate/eir?eir_number=${eirNumber}`);
        const json = await res.json();
        if (json.eir) {
          setData(json.eir);
        } else {
          setError(json.error || 'ไม่พบข้อมูล EIR');
        }
      } catch {
        setError('ไม่สามารถโหลดข้อมูลได้');
      } finally {
        setLoading(false);
      }
    }
    fetchEIR();
  }, [eirNumber]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500 mt-4">กำลังโหลดข้อมูล EIR...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-sm">
          <div className="text-4xl mb-3">❌</div>
          <h1 className="text-lg font-bold text-slate-800 mb-1">ไม่พบข้อมูล</h1>
          <p className="text-sm text-slate-500">{error}</p>
          <p className="text-xs text-slate-400 mt-3 font-mono">{eirNumber}</p>
        </div>
      </div>
    );
  }

  const damagePoints: DamagePoint[] = data?.damage_report?.points || [];
  const overviewPhotos: string[] = data?.damage_report?.photos || [];
  const exitPhotos: string[] = data?.damage_report?.exit_photos || [];
  const allPhotos = [
    ...overviewPhotos.map((p: string, i: number) => ({ src: p, label: `ภาพรวม ${i + 1}` })),
    ...exitPhotos.map((p: string, i: number) => ({ src: p, label: `ภาพขาออก ${i + 1}` })),
    ...damagePoints.filter((dp: DamagePoint) => dp.photo).map((dp: DamagePoint) => ({
      src: dp.photo!, label: `${SIDE_LABELS[dp.side] || dp.side} — ${DAMAGE_LABELS[dp.type] || dp.type}`,
    })),
  ];
  const hasDamage = data.container_condition === 'damage';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white text-lg font-black">C</div>
          <div>
            <h1 className="text-sm font-bold text-slate-800">Equipment Interchange Receipt</h1>
            <p className="text-[10px] text-slate-400 font-mono">{data.eir_number}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Container Info Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold font-mono text-slate-800">{data.container_number}</span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-white ${data.transaction_type === 'gate_in' ? 'bg-emerald-500' : 'bg-blue-500'}`}>
                {data.transaction_type === 'gate_in' ? '📥 GATE-IN' : '📤 GATE-OUT'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{formatDateTime(data.date)} · {data.yard_name}</p>
          </div>

          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <MobileField label="ขนาด/ประเภท" value={`${data.size}'${data.type}`} />
              <MobileField label="สายเรือ" value={data.shipping_line || '-'} />
              <MobileField label="สถานะ" value={data.is_laden ? '📦 มีสินค้า' : '📭 ตู้เปล่า'} />
              <MobileField label="ซีล" value={data.seal_number || '-'} />
            </div>

            {/* Condition & Grade */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-slate-200">
                <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">สภาพตู้</p>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-bold ${hasDamage ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {hasDamage ? '⚠️ Damage' : '✅ Sound'}
                </span>
              </div>
              <div className="p-3 rounded-xl border border-slate-200">
                <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">เกรดตู้</p>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-white text-sm font-black ${
                    data.container_grade === 'A' ? 'bg-emerald-500' :
                    data.container_grade === 'B' ? 'bg-amber-500' :
                    data.container_grade === 'C' ? 'bg-orange-500' : 'bg-red-500'
                  }`}>{data.container_grade}</span>
                  <span className="text-xs text-slate-600">
                    {data.container_grade === 'A' ? 'สภาพดี' :
                     data.container_grade === 'B' ? 'สภาพพอใช้' :
                     data.container_grade === 'C' ? 'ใส่ของทั่วไป' : 'ห้ามใช้งาน'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Photos Section */}
        {allPhotos.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-red-50 border-b border-red-100">
              <h3 className="text-sm font-bold text-red-700">📸 รูปถ่าย ({allPhotos.length} รูป)</h3>
              <p className="text-[10px] text-red-400 mt-0.5">กดรูปเพื่อดูขนาดเต็ม</p>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              {allPhotos.map((photo, i) => (
                <button key={i} onClick={() => setSelectedPhoto(photo.src)} className="text-left">
                  <img src={photo.src} alt={photo.label}
                    className="w-full h-32 object-cover rounded-xl border border-slate-200 hover:border-blue-400 transition-all" />
                  <p className="text-[10px] text-slate-400 mt-1 truncate">{photo.label}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Damage Points */}
        {damagePoints.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
              <h3 className="text-sm font-bold text-amber-700">⚠️ จุดเสียหาย ({damagePoints.length} จุด)</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {damagePoints.map((point, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${
                    point.severity === 'severe' ? 'bg-red-500' :
                    point.severity === 'major' ? 'bg-orange-500' : 'bg-amber-400'
                  }`}>{i + 1}</span>
                  <div>
                    <p className="text-xs font-medium text-slate-700">
                      {SIDE_LABELS[point.side] || point.side} — {DAMAGE_LABELS[point.type] || point.type}
                    </p>
                    <p className="text-[10px] text-slate-400">{point.severity}</p>
                  </div>
                  {point.photo && (
                    <button onClick={() => setSelectedPhoto(point.photo!)}
                      className="ml-auto">
                      <img src={point.photo} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No damage message */}
        {allPhotos.length === 0 && damagePoints.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <div className="text-4xl mb-2">✅</div>
            <h3 className="text-sm font-bold text-emerald-700">ตู้สมบูรณ์ — ไม่พบความเสียหาย</h3>
            <p className="text-xs text-slate-400 mt-1">Container is in sound condition</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-3">
          <p className="text-[10px] text-slate-300">CYMS — Container Yard Management System</p>
        </div>
      </div>

      {/* Full-size Photo Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white text-lg flex items-center justify-center">✕</button>
          <img src={selectedPhoto} alt="Damage Photo" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
}

function MobileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 uppercase font-semibold">{label}</p>
      <p className="text-sm font-medium text-slate-700">{value}</p>
    </div>
  );
}
