'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Image, Save, CheckCircle2, Loader2, Trash2, HardDrive, AlertTriangle, Play,
} from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface RetentionConfig {
  gate_photos_days: number;
  damage_photos_days: number;
  seal_photos_days: number;
  eir_pdf_days: number;
  mnr_photos_days: number;
  document_files_days: number;
  auto_cleanup_enabled: boolean;
  auto_cleanup_time: string;
  last_cleanup_at: string | null;
  last_cleanup_deleted: number;
}

interface StorageStats {
  total_files: number;
  total_size_mb: number;
  by_folder: { folder: string; files: number; size_mb: number }[];
  cleanable_files: number;
  cleanable_size_mb: number;
}

const DEFAULT_CONFIG: RetentionConfig = {
  gate_photos_days: 90,
  damage_photos_days: 365,
  seal_photos_days: 180,
  eir_pdf_days: 730, // 2 years
  mnr_photos_days: 730, // 2 years
  document_files_days: 730, // 2 years
  auto_cleanup_enabled: false,
  auto_cleanup_time: '03:00',
  last_cleanup_at: null,
  last_cleanup_deleted: 0,
};

export default function PhotoRetentionSettings() {
  const [config, setConfig] = useState<RetentionConfig>(DEFAULT_CONFIG);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<string | null>(null);
  const [confirmDlg, setConfirmDlg] = useState<{ open: boolean; message: string; action: () => void }>({ open: false, message: '', action: () => {} });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/photo-retention');
      const json = await res.json();
      if (json.config) setConfig(json.config);
      if (json.stats) setStats(json.stats);
    } catch (err) { console.error('Load photo retention error:', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/photo-retention', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (json.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleCleanup = () => {
    setConfirmDlg({
      open: true,
      message: `⚠️ จะลบรูปภาพที่เกินกำหนดเก็บรักษาทันที\n\nประมาณ ${stats?.cleanable_files || 0} ไฟล์ (${(stats?.cleanable_size_mb || 0).toFixed(1)} MB)\n\nดำเนินการ?`,
      action: async () => {
        setConfirmDlg(prev => ({ ...prev, open: false }));
        setCleaning(true);
        setCleanResult(null);
        try {
          const res = await fetch('/api/settings/photo-retention/cleanup', { method: 'POST' });
          const json = await res.json();
          if (json.success) {
            setCleanResult(`✅ ลบแล้ว ${json.deleted} ไฟล์ (${(json.freed_mb || 0).toFixed(1)} MB)`);
            fetchData(); // Refresh stats
          } else {
            setCleanResult(`❌ ${json.error}`);
          }
        } catch { setCleanResult('❌ เกิดข้อผิดพลาด'); }
        finally { setCleaning(false); }
      },
    });
  };

  const update = (field: keyof RetentionConfig, value: number | boolean | string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const formatSize = (mb: number) => mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;

  const retentionItems = [
    { key: 'gate_photos_days' as const, label: '📸 รูป Gate-In / Gate-Out', desc: 'รูปถ่ายทั่วไปเมื่อตู้เข้า-ออกลาน', default: 90, color: 'blue' },
    { key: 'damage_photos_days' as const, label: '⚠️ รูป Damage Report', desc: 'รูปความเสียหาย — ใช้เป็นหลักฐาน claim สายเรือ', default: 365, color: 'red' },
    { key: 'seal_photos_days' as const, label: '🔒 รูปซีล', desc: 'รูปถ่ายซีลตู้ — ตรวจสอบ security / ศุลกากร', default: 180, color: 'amber' },
    { key: 'eir_pdf_days' as const, label: '📄 EIR PDF ฉบับสมบูรณ์', desc: 'เอกสาร EIR แบบ PDF — เอกสารทางบัญชี+กฎหมาย', default: 730, color: 'purple' },
    { key: 'mnr_photos_days' as const, label: '🔧 รูปซ่อม M&R', desc: 'Before / During / After repair และหลักฐานงานซ่อม', default: 730, color: 'violet' },
    { key: 'document_files_days' as const, label: '🗂️ เอกสารแนบทั่วไป', desc: 'ไฟล์แนบใน Attachment Center / เอกสารประกอบอื่น ๆ', default: 730, color: 'slate' },
  ];

  const inputClass = "h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-right font-mono text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors w-24";

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
        <div className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={16} /> กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-4">
      {/* Header Card */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600">
              <Image size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-white">การเก็บรักษารูปภาพ</h3>
              <p className="text-xs text-slate-400">กำหนดระยะเวลาเก็บรูป และ Cleanup อัตโนมัติ</p>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saved ? <><CheckCircle2 size={14} /> บันทึกแล้ว</> : saving ? <><Loader2 size={14} className="animate-spin" /> กำลังบันทึก...</> : <><Save size={14} /> บันทึก</>}
          </button>
        </div>

        {/* Retention Rules */}
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {retentionItems.map(item => (
            <div key={item.key} className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-white">{item.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                <p className="text-[10px] text-slate-300 mt-0.5">ค่าเริ่มต้น: {item.default} วัน ({Math.round(item.default / 30)} เดือน)</p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <input type="number" value={config[item.key]} min={7} max={3650}
                  onChange={e => update(item.key, parseInt(e.target.value) || item.default)}
                  className={inputClass} />
                <span className="text-xs text-slate-400 w-6">วัน</span>
              </div>
            </div>
          ))}
        </div>

        {/* Auto-cleanup toggle */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">🤖 Cleanup อัตโนมัติ</p>
              <p className="text-xs text-slate-400 mt-0.5">ลบรูปที่เกินกำหนดอัตโนมัติทุกวัน</p>
            </div>
            <div className="relative">
              <input type="checkbox" checked={config.auto_cleanup_enabled}
                onChange={e => update('auto_cleanup_enabled', e.target.checked)}
                className="sr-only peer" />
              <div className="w-11 h-6 bg-slate-200 peer-checked:bg-emerald-500 rounded-full transition-colors"></div>
              <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5"></div>
            </div>
          </label>
          {config.auto_cleanup_enabled && (
            <div className="mt-3 flex items-center gap-3 pl-1">
              <span className="text-xs text-slate-500">⏰ เวลาทำ Cleanup:</span>
              <input type="time" value={config.auto_cleanup_time}
                onChange={e => update('auto_cleanup_time', e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-mono text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors" />
              <span className="text-[10px] text-slate-400">ทุกวัน</span>
            </div>
          )}
          {config.last_cleanup_at && (
            <p className="text-[10px] text-slate-400 mt-2">
              Cleanup ล่าสุด: {new Date(config.last_cleanup_at).toLocaleString('th-TH')} — ลบ {config.last_cleanup_deleted} ไฟล์
            </p>
          )}
        </div>
      </div>

      {/* Storage Stats Card */}
      {stats && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3">
            <HardDrive size={16} className="text-slate-400" />
            <h4 className="font-semibold text-sm text-slate-800 dark:text-white">สถิติพื้นที่จัดเก็บ</h4>
          </div>

          {/* Summary */}
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-3 text-center">
              <p className="text-[10px] text-slate-400 uppercase font-semibold">ไฟล์ทั้งหมด</p>
              <p className="text-lg font-bold text-slate-800 dark:text-white">{stats.total_files.toLocaleString()}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-3 text-center">
              <p className="text-[10px] text-slate-400 uppercase font-semibold">ขนาดรวม</p>
              <p className="text-lg font-bold text-slate-800 dark:text-white">{formatSize(stats.total_size_mb)}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-center">
              <p className="text-[10px] text-amber-600 uppercase font-semibold">ลบได้</p>
              <p className="text-lg font-bold text-amber-600">{stats.cleanable_files.toLocaleString()}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-center">
              <p className="text-[10px] text-amber-600 uppercase font-semibold">คืนพื้นที่</p>
              <p className="text-lg font-bold text-amber-600">{formatSize(stats.cleanable_size_mb)}</p>
            </div>
          </div>

          {/* By folder breakdown */}
          {stats.by_folder.length > 0 && (
            <div className="px-4 pb-4">
              <div className="rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-500">
                      <th className="p-2.5 text-left font-medium">โฟลเดอร์</th>
                      <th className="p-2.5 text-right font-medium">ไฟล์</th>
                      <th className="p-2.5 text-right font-medium">ขนาด</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {stats.by_folder.map(f => (
                      <tr key={f.folder} className="text-slate-600 dark:text-slate-300">
                        <td className="p-2.5 font-mono">{f.folder}</td>
                        <td className="p-2.5 text-right">{f.files.toLocaleString()}</td>
                        <td className="p-2.5 text-right">{formatSize(f.size_mb)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Manual Cleanup Button */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <AlertTriangle size={14} className="text-amber-500" />
              <span>Cleanup จะลบไฟล์ที่เกินกำหนดถาวร — ไม่สามารถกู้คืนได้</span>
            </div>
            <button onClick={handleCleanup} disabled={cleaning || (stats?.cleanable_files || 0) === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 disabled:opacity-50 transition-colors">
              {cleaning ? <><Loader2 size={14} className="animate-spin" /> กำลังลบ...</> : <><Trash2 size={14} /> Cleanup ตอนนี้</>}
            </button>
          </div>

          {cleanResult && (
            <div className={`mx-4 mb-4 p-3 rounded-lg text-sm ${cleanResult.startsWith('✅') ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700' : 'bg-red-50 dark:bg-red-900/20 text-red-700'}`}>
              {cleanResult}
            </div>
          )}
        </div>
      )}
    </div>

    <ConfirmDialog open={confirmDlg.open} title="ยืนยัน Cleanup" message={confirmDlg.message}
      confirmLabel="ลบเลย" onConfirm={confirmDlg.action}
      onCancel={() => setConfirmDlg(prev => ({ ...prev, open: false }))} />
    </>
  );
}
