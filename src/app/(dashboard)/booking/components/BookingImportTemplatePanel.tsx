'use client';

import type { RefObject } from 'react';
import { Download, FileSpreadsheet, Loader2, Trash2, Upload } from 'lucide-react';

export interface BookingImportPreviewRow {
  booking_number: string;
  booking_type: string;
  vessel_name: string;
  container_size: string;
  container_type: string;
  seal_number: string;
}

interface BookingImportTemplatePanelProps {
  fileRef: RefObject<HTMLInputElement | null>;
  fileRows: Record<string, string>[];
  fileName: string;
  fileBatchLoading: boolean;
  fileBatchResult: { success: number; failed: number } | null;
  canManageBookings: boolean;
  helperCopy: string;
  guidanceCopy: string;
  onFileUpload: (file: File) => void;
  onDownloadTemplate: () => void;
  onClearFile: () => void;
  onBatchImport: () => void;
  mapRow: (row: Record<string, string>) => BookingImportPreviewRow;
}

export default function BookingImportTemplatePanel({
  fileRef,
  fileRows,
  fileName,
  fileBatchLoading,
  fileBatchResult,
  canManageBookings,
  helperCopy,
  guidanceCopy,
  onFileUpload,
  onDownloadTemplate,
  onClearFile,
  onBatchImport,
  mapRow,
}: BookingImportTemplatePanelProps) {
  return (
    <div className="px-5 pt-4">
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden"
        onChange={e => { if (e.target.files?.[0]) onFileUpload(e.target.files[0]); }} />
      <div onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-blue-400', 'bg-blue-50/50'); }}
        onDragLeave={e => { e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50/50'); }}
        onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50/50'); if (e.dataTransfer.files[0]) onFileUpload(e.dataTransfer.files[0]); }}
        className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all">
        <FileSpreadsheet size={32} className="mx-auto text-slate-400 mb-2" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">ลากไฟล์มาวางที่นี่ หรือ คลิกเพื่อเลือกไฟล์</p>
        <p className="text-[10px] text-slate-400 mt-1">{helperCopy}</p>
        <p className="text-[10px] text-slate-400 mt-1">{guidanceCopy}</p>
      </div>
      <div className="flex items-center justify-center gap-3 mt-2">
        <button onClick={onDownloadTemplate}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
          <Download size={12} /> ดาวน์โหลด Template (.xlsx)
        </button>
      </div>

      {fileRows.length > 0 && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <FileSpreadsheet size={14} className="text-emerald-500" /> {fileName} — {fileRows.length} รายการ
            </p>
            <button onClick={onClearFile}
              className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"><Trash2 size={12} /> ลบ</button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-xs">
              <thead><tr className="bg-slate-50 dark:bg-slate-700/50">
                <th className="px-2 py-2 text-left">#</th><th className="px-2 py-2 text-left">Booking No.</th>
                <th className="px-2 py-2 text-left">Type</th><th className="px-2 py-2 text-left">Vessel</th>
                <th className="px-2 py-2 text-left">Size</th><th className="px-2 py-2 text-left">Seal</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {fileRows.slice(0, 10).map((row, i) => {
                  const mapped = mapRow(row);
                  return (
                    <tr key={i} className={mapped.booking_number ? '' : 'bg-red-50/50 dark:bg-red-900/10'}>
                      <td className="px-2 py-1.5 text-slate-400">{i + 1}</td>
                      <td className="px-2 py-1.5 font-mono font-semibold">{mapped.booking_number || <span className="text-red-400">ไม่มี</span>}</td>
                      <td className="px-2 py-1.5">{mapped.booking_type}</td><td className="px-2 py-1.5">{mapped.vessel_name}</td>
                      <td className="px-2 py-1.5">{mapped.container_size}&apos;{mapped.container_type}</td>
                      <td className="px-2 py-1.5 font-mono">{mapped.seal_number || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {fileRows.length > 10 && <div className="p-2 text-center text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-700/30">แสดง 10 จาก {fileRows.length} รายการ</div>}
          </div>
          <button onClick={onBatchImport} disabled={fileBatchLoading || !canManageBookings}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-all">
            {fileBatchLoading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            นำเข้าทั้งหมด ({fileRows.length} รายการ)
          </button>
          {fileBatchResult && (
            <div className={`p-3 rounded-xl text-sm ${fileBatchResult.failed === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              ✅ สำเร็จ {fileBatchResult.success} รายการ{fileBatchResult.failed > 0 && ` | ❌ ล้มเหลว ${fileBatchResult.failed} รายการ`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
