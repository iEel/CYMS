'use client';

import { useState, useEffect, useCallback } from 'react';
import { Building2, Save, Loader2, CheckCircle } from 'lucide-react';

interface CompanyData {
  company_id?: number;
  company_name: string;
  tax_id: string;
  address: string;
  phone: string;
  email: string;
  logo_url: string;
}

const emptyCompany: CompanyData = {
  company_name: '', tax_id: '', address: '', phone: '', email: '', logo_url: '',
};

export default function CompanySettings() {
  const [data, setData] = useState<CompanyData>(emptyCompany);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/company');
      const json = await res.json();
      if (json) setData(json);
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
        setData(json.data);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error('Save company error:', err);
    } finally {
      setSaving(false);
    }
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
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            ชื่อบริษัท <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={data.company_name}
            onChange={(e) => setData({ ...data, company_name: e.target.value })}
            placeholder="บริษัท ตัวอย่าง จำกัด"
            className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700
              text-slate-800 dark:text-white text-sm focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
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
            className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700
              text-slate-800 dark:text-white text-sm font-mono focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
          />
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
            className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700
              text-slate-800 dark:text-white text-sm focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
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
            className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700
              text-slate-800 dark:text-white text-sm focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            URL โลโก้
          </label>
          <input
            type="text"
            value={data.logo_url}
            onChange={(e) => setData({ ...data, logo_url: e.target.value })}
            placeholder="https://example.com/logo.png"
            className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700
              text-slate-800 dark:text-white text-sm focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
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
