'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Building2, Save, Loader2, CheckCircle, Upload, ImageIcon, X } from 'lucide-react';

interface CompanyData {
  company_id?: number;
  company_name: string;
  tax_id: string;
  branch_type: string;
  branch_number: string;
  address: string;
  phone: string;
  email: string;
  logo_url: string;
  labor_rate: number;
}

const emptyCompany: CompanyData = {
  company_name: '', tax_id: '', branch_type: 'head_office', branch_number: '00000', address: '', phone: '', email: '', logo_url: '', labor_rate: 350,
};

export default function CompanySettings() {
  const [data, setData] = useState<CompanyData>(emptyCompany);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/company');
      const json = await res.json();
      if (json) {
        setData({
          company_id: json.company_id,
          company_name: json.company_name ?? '',
          tax_id: json.tax_id ?? '',
          branch_type: json.branch_type ?? 'head_office',
          branch_number: json.branch_number ?? '00000',
          address: json.address ?? '',
          phone: json.phone ?? '',
          email: json.email ?? '',
          logo_url: json.logo_url ?? '',
          labor_rate: json.labor_rate ?? 350,
        });
      }
    } catch (err) {
      console.error('Load company error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/settings/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        const d = json.data;
        setData({
          company_id: d.company_id,
          company_name: d.company_name ?? '',
          tax_id: d.tax_id ?? '',
          branch_type: d.branch_type ?? 'head_office',
          branch_number: d.branch_number ?? '00000',
          address: d.address ?? '',
          phone: d.phone ?? '',
          email: d.email ?? '',
          logo_url: d.logo_url ?? '',
          labor_rate: d.labor_rate ?? 350,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error('Save company error:', err);
    } finally {
      setSaving(false);
    }
  };

  const [logoUploading, setLogoUploading] = useState(false);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) { alert('ไฟล์ใหญ่เกิน 5MB'); return; }

    // Read as base64 first for preview
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setData(d => ({ ...d, logo_url: base64 })); // preview immediately
      setLogoUploading(true);
      try {
        const res = await fetch('/api/uploads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: base64, folder: 'logos', filename_prefix: 'logo' }),
        });
        const json = await res.json();
        if (json.success) {
          setData(d => ({ ...d, logo_url: json.url }));
        }
      } catch (err) {
        console.error('Logo upload failed:', err);
        // Keep base64 as fallback
      } finally {
        setLogoUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
        <div className="space-y-4">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-10 w-full" />)}
        </div>
      </div>
    );
  }

  const inputClass = "w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white text-sm focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-500/20 outline-none transition-all";

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-[#3B82F6]">
            <Building2 size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-white">ข้อมูลบริษัท</h2>
            <p className="text-xs text-slate-400">Company Profile — ข้อมูลแสดงบนหัวกระดาษเอกสาร EIR, ใบแจ้งหนี้</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#3B82F6] text-white text-sm font-medium
            hover:bg-[#2563EB] active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> :
           saved ? <CheckCircle size={16} /> : <Save size={16} />}
          {saving ? 'กำลังบันทึก...' : saved ? 'บันทึกแล้ว!' : 'บันทึก'}
        </button>
      </div>

      {/* Form */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Logo Upload — full width */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            โลโก้บริษัท
          </label>
          <div className="flex items-start gap-5">
            {/* Preview */}
            <div className="shrink-0 w-28 h-28 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 flex items-center justify-center overflow-hidden relative">
              {data.logo_url ? (
                <img
                  src={data.logo_url}
                  alt="Company Logo"
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <div className="text-center">
                  <ImageIcon size={28} className="mx-auto text-slate-300 dark:text-slate-500" />
                  <p className="text-[10px] text-slate-400 mt-1">ไม่มีโลโก้</p>
                </div>
              )}
              {logoUploading && (
                <div className="absolute inset-0 bg-white/70 dark:bg-slate-800/70 flex items-center justify-center">
                  <Loader2 size={20} className="animate-spin text-blue-500" />
                </div>
              )}
            </div>

            {/* Upload Zone */}
            <div className="flex-1">
              <div
                className={`relative rounded-xl border-2 border-dashed p-5 text-center transition-all cursor-pointer
                  ${dragOver
                    ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/10'
                    : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700/30'
                  }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={24} className={`mx-auto mb-2 ${dragOver ? 'text-blue-500' : 'text-slate-400'}`} />
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-blue-600">คลิกเลือกไฟล์</span> หรือลากมาวาง
                </p>
                <p className="text-[11px] text-slate-400 mt-1">PNG, JPG, SVG — สูงสุด 5MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
              </div>

              {data.logo_url && (
                <button
                  onClick={(e) => { e.stopPropagation(); setData({ ...data, logo_url: '' }); }}
                  className="mt-2 flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600 transition-colors"
                >
                  <X size={12} /> ลบโลโก้
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            ชื่อบริษัท <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={data.company_name}
            onChange={(e) => setData({ ...data, company_name: e.target.value })}
            placeholder="บริษัท ตัวอย่าง จำกัด"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            เลขประจำตัวผู้เสียภาษี
          </label>
          <input
            type="text"
            value={data.tax_id}
            onChange={(e) => setData({ ...data, tax_id: e.target.value })}
            placeholder="0-0000-00000-00-0"
            className={`${inputClass} font-mono`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            ประเภทสาขา
          </label>
          <div className="flex items-center gap-4 h-11">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="branch_type" value="head_office" checked={(data.branch_type || 'head_office') === 'head_office'}
                onChange={() => setData({ ...data, branch_type: 'head_office', branch_number: '00000' })}
                className="accent-blue-600" />
              <span className="text-sm text-slate-700 dark:text-slate-300">สำนักงานใหญ่</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="branch_type" value="branch" checked={data.branch_type === 'branch'}
                onChange={() => setData({ ...data, branch_type: 'branch', branch_number: '' })}
                className="accent-blue-600" />
              <span className="text-sm text-slate-700 dark:text-slate-300">สาขาที่</span>
            </label>
            {data.branch_type === 'branch' && (
              <input type="text" value={data.branch_number || ''}
                onChange={(e) => setData({ ...data, branch_number: e.target.value })}
                placeholder="00001"
                className="h-11 w-28 px-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-mono text-slate-800 dark:text-white outline-none focus:border-blue-500" />
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            อัตราแรงงาน (฿/ชม.)
          </label>
          <input
            type="number"
            step="10"
            value={data.labor_rate}
            onChange={(e) => setData({ ...data, labor_rate: parseFloat(e.target.value) || 0 })}
            placeholder="350"
            className={inputClass}
          />
          <p className="text-[10px] text-slate-400 mt-1">ใช้คำนวณค่าซ่อม CEDEX ในหน้าซ่อมบำรุง M&R</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            โทรศัพท์
          </label>
          <input
            type="text"
            value={data.phone}
            onChange={(e) => setData({ ...data, phone: e.target.value })}
            placeholder="02-xxx-xxxx"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            อีเมล
          </label>
          <input
            type="email"
            value={data.email}
            onChange={(e) => setData({ ...data, email: e.target.value })}
            placeholder="info@company.com"
            className={inputClass}
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            ที่อยู่
          </label>
          <textarea
            value={data.address}
            onChange={(e) => setData({ ...data, address: e.target.value })}
            placeholder="ที่อยู่บริษัท..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700
              text-slate-800 dark:text-white text-sm focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
          />
        </div>
      </div>
    </div>
  );
}

