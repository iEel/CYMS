'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, Loader2, Save, CheckCircle2, RefreshCw, Trash2 } from 'lucide-react';

interface RateLimitConfig {
  enabled: boolean;
  login_limit: number;
  login_window_min: number;
  api_limit: number;
  api_window_min: number;
  upload_limit: number;
  upload_window_min: number;
}

interface RateLimitStats {
  login: { active: number; blocked: number };
  api: { active: number; blocked: number };
  upload: { active: number; blocked: number };
}

export default function RateLimitSettings() {
  const [config, setConfig] = useState<RateLimitConfig>({
    enabled: true, login_limit: 5, login_window_min: 15,
    api_limit: 100, api_window_min: 1, upload_limit: 10, upload_window_min: 1,
  });
  const [stats, setStats] = useState<RateLimitStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/rate-limit');
      const data = await res.json();
      if (data.config) setConfig(data.config);
      if (data.stats) setStats(data.stats);
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/settings/rate-limit', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* */ }
    finally { setSaving(false); }
  };

  const handleClear = async () => {
    if (!confirm('ล้างข้อมูล Rate Limit ทั้งหมด? (ปลดบล็อก IP ทั้งหมด)')) return;
    await fetch('/api/settings/rate-limit', { method: 'DELETE' });
    fetchData();
  };

  const inputClass = "h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 w-24 text-center";
  const labelClass = "text-[10px] font-semibold text-slate-400 uppercase mb-1 block";

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-slate-400" size={24} /></div>;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600"><Shield size={20} /></div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white">Rate Limiting</h3>
            <p className="text-xs text-slate-400">จำกัดจำนวนคำขอ API เพื่อป้องกัน Brute Force และ API Abuse</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleClear} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-red-500 hover:bg-red-50 transition-all">
            <Trash2 size={14} /> ล้าง Rate Limit
          </button>
          <button onClick={fetchData} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-blue-500 hover:bg-blue-50 transition-all">
            <RefreshCw size={14} /> รีเฟรช
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
            {saved ? 'บันทึกแล้ว' : 'บันทึก'}
          </button>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-600">
          <div>
            <h4 className="text-sm font-semibold text-slate-800 dark:text-white">เปิดใช้งาน Rate Limiting</h4>
            <p className="text-xs text-slate-400 mt-0.5">เมื่อปิด ระบบจะไม่จำกัดจำนวนคำขอ (ไม่แนะนำสำหรับ Production)</p>
          </div>
          <button
            onClick={() => setConfig({ ...config, enabled: !config.enabled })}
            className={`relative w-12 h-6 rounded-full transition-colors ${config.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${config.enabled ? 'left-[26px]' : 'left-0.5'}`} />
          </button>
        </div>

        {/* Config Cards */}
        <div className={`space-y-4 ${!config.enabled ? 'opacity-40 pointer-events-none' : ''}`}>
          {/* Login Rate Limit */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-600">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">🔐 Login Rate Limit</h4>
            <p className="text-xs text-slate-400 mb-3">จำกัดจำนวนครั้งที่ login ผิดพลาด เพื่อป้องกัน brute force attack</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className={labelClass}>จำนวนสูงสุด</label>
                <input type="number" min={1} value={config.login_limit}
                  onChange={e => setConfig({ ...config, login_limit: parseInt(e.target.value) || 1 })} className={inputClass} />
              </div>
              <span className="text-sm text-slate-500 mt-4">ครั้ง / </span>
              <div>
                <label className={labelClass}>ต่อช่วงเวลา (นาที)</label>
                <input type="number" min={1} value={config.login_window_min}
                  onChange={e => setConfig({ ...config, login_window_min: parseInt(e.target.value) || 1 })} className={inputClass} />
              </div>
              <span className="text-sm text-slate-500 mt-4">นาที</span>
            </div>
          </div>

          {/* API Rate Limit */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-600">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">🌐 API Rate Limit</h4>
            <p className="text-xs text-slate-400 mb-3">จำกัดจำนวนคำขอ API ทั้งหมด ต่อ IP เพื่อป้องกันการใช้งานเกินขีดจำกัด</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className={labelClass}>จำนวนสูงสุด</label>
                <input type="number" min={10} value={config.api_limit}
                  onChange={e => setConfig({ ...config, api_limit: parseInt(e.target.value) || 10 })} className={inputClass} />
              </div>
              <span className="text-sm text-slate-500 mt-4">คำขอ / </span>
              <div>
                <label className={labelClass}>ต่อช่วงเวลา (นาที)</label>
                <input type="number" min={1} value={config.api_window_min}
                  onChange={e => setConfig({ ...config, api_window_min: parseInt(e.target.value) || 1 })} className={inputClass} />
              </div>
              <span className="text-sm text-slate-500 mt-4">นาที</span>
            </div>
          </div>

          {/* Upload Rate Limit */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-600">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">📁 Upload Rate Limit</h4>
            <p className="text-xs text-slate-400 mb-3">จำกัดจำนวนการอัปโหลดไฟล์ เพื่อป้องกัน disk abuse</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className={labelClass}>จำนวนสูงสุด</label>
                <input type="number" min={1} value={config.upload_limit}
                  onChange={e => setConfig({ ...config, upload_limit: parseInt(e.target.value) || 1 })} className={inputClass} />
              </div>
              <span className="text-sm text-slate-500 mt-4">ไฟล์ / </span>
              <div>
                <label className={labelClass}>ต่อช่วงเวลา (นาที)</label>
                <input type="number" min={1} value={config.upload_window_min}
                  onChange={e => setConfig({ ...config, upload_window_min: parseInt(e.target.value) || 1 })} className={inputClass} />
              </div>
              <span className="text-sm text-slate-500 mt-4">นาที</span>
            </div>
          </div>
        </div>

        {/* Live Stats */}
        {stats && (
          <div>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-white mb-3">📊 สถิติ Real-time</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4 text-center border border-slate-100 dark:border-slate-600">
                <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.login.active}</p>
                <p className="text-xs text-slate-400">Login Tracked IPs</p>
                {stats.login.blocked > 0 && (
                  <p className="text-xs text-red-500 mt-1">🚫 {stats.login.blocked} blocked</p>
                )}
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4 text-center border border-slate-100 dark:border-slate-600">
                <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.api.active}</p>
                <p className="text-xs text-slate-400">API Tracked IPs</p>
                {stats.api.blocked > 0 && (
                  <p className="text-xs text-red-500 mt-1">🚫 {stats.api.blocked} blocked</p>
                )}
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4 text-center border border-slate-100 dark:border-slate-600">
                <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.upload.active}</p>
                <p className="text-xs text-slate-400">Upload Tracked IPs</p>
                {stats.upload.blocked > 0 && (
                  <p className="text-xs text-red-500 mt-1">🚫 {stats.upload.blocked} blocked</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
