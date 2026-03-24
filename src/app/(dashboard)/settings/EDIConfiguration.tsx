'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Save, Globe, CheckCircle2, Shield, Server, Loader2, Mail, Clock,
} from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface EDIEndpoint {
  endpoint_id: number;
  name: string;
  shipping_line: string;
  type: 'api' | 'ftp' | 'sftp' | 'email';
  host: string;
  port: number;
  username: string;
  password: string;
  remote_path: string;
  format: 'EDIFACT' | 'XML' | 'JSON' | 'CSV';
  is_active: boolean;
  last_sent_at: string;
  last_status: string;
  schedule_enabled: boolean;
  schedule_cron: string;
  schedule_yard_id: number;
  schedule_last_run: string;
}

export default function EDIConfiguration() {
  const [endpoints, setEndpoints] = useState<EDIEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDlg, setConfirmDlg] = useState<{ open: boolean; message: string; action: () => void }>({ open: false, message: '', action: () => {} });

  const fetchEndpoints = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/edi/endpoints');
      const data = await res.json();
      setEndpoints(data.endpoints || []);
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEndpoints(); }, [fetchEndpoints]);

  const addEndpoint = async () => {
    try {
      const res = await fetch('/api/edi/endpoints', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Endpoint ใหม่', host: '', type: 'sftp', port: 22, format: 'EDIFACT', remote_path: '/' }),
      });
      const data = await res.json();
      if (data.success) {
        setEndpoints([...endpoints, data.endpoint]);
      }
    } catch { /* */ }
  };

  const removeEndpoint = async (id: number) => {
    setConfirmDlg({
      open: true,
      message: 'ลบ Endpoint นี้?',
      action: async () => {
        setConfirmDlg(prev => ({ ...prev, open: false }));
        await fetch(`/api/edi/endpoints?endpoint_id=${id}`, { method: 'DELETE' });
        setEndpoints(endpoints.filter(e => e.endpoint_id !== id));
      },
    });
  };

  const update = (id: number, field: string, value: string | number | boolean) => {
    setEndpoints(prev => prev.map(e => e.endpoint_id === id ? { ...e, [field]: value } : e));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const ep of endpoints) {
        await fetch('/api/edi/endpoints', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ep),
        });
        // Sync schedule
        await fetch('/api/edi/schedule', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint_id: ep.endpoint_id,
            schedule_enabled: ep.schedule_enabled,
            schedule_cron: ep.schedule_cron,
            schedule_yard_id: ep.schedule_yard_id,
          }),
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* */ }
    finally { setSaving(false); }
  };

  const inputClass = "w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors";
  const labelClass = "text-[10px] font-semibold text-slate-400 uppercase mb-1 block";

  const fmtDate = (d: string) => {
    if (!d) return 'ยังไม่เคยส่ง';
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <>
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600"><Globe size={20} /></div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white">EDI Configuration</h3>
            <p className="text-xs text-slate-400">ตั้งค่า SFTP / FTP / API / Email endpoints สำหรับส่งข้อมูลให้สายเรือ</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
          {saved ? 'บันทึกแล้ว' : 'บันทึก'}
        </button>
      </div>

      <div className="p-5 space-y-4">
        {loading ? (
          <div className="p-8 text-center"><Loader2 size={24} className="animate-spin mx-auto text-slate-400" /></div>
        ) : endpoints.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">ยังไม่มี Endpoint — กดปุ่มด้านล่างเพื่อเพิ่ม</p>
        ) : endpoints.map(ep => (
          <div key={ep.endpoint_id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-600 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {ep.type === 'email' ? <Mail size={14} className={ep.is_active ? 'text-blue-500' : 'text-slate-400'} /> : <Server size={14} className={ep.is_active ? 'text-emerald-500' : 'text-slate-400'} />}
                <span className="font-semibold text-sm text-slate-800 dark:text-white">{ep.name || 'Endpoint ใหม่'}</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${ep.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {ep.is_active ? 'ACTIVE' : 'INACTIVE'}
                </span>
                {ep.last_status && (
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${ep.last_status === 'sent' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {ep.last_status === 'sent' ? '✅ ส่งสำเร็จ' : '❌ ส่งไม่สำเร็จ'}
                  </span>
                )}
                <span className="text-[10px] text-slate-400">🕐 {fmtDate(ep.last_sent_at)}</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-slate-500 cursor-pointer">
                  <input type="checkbox" checked={ep.is_active} onChange={e => update(ep.endpoint_id, 'is_active', e.target.checked)} className="w-3.5 h-3.5 rounded" /> เปิด
                </label>
                <button onClick={() => removeEndpoint(ep.endpoint_id)} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div><label className={labelClass}>ชื่อ Endpoint</label><input value={ep.name} onChange={e => update(ep.endpoint_id, 'name', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>สายเรือ</label><input value={ep.shipping_line || ''} onChange={e => update(ep.endpoint_id, 'shipping_line', e.target.value)} className={inputClass} placeholder="MSC, Evergreen..." /></div>
              <div><label className={labelClass}>ประเภท</label>
                <select value={ep.type} onChange={e => { update(ep.endpoint_id, 'type', e.target.value); if (e.target.value === 'email') { update(ep.endpoint_id, 'port', 0); } }} className={inputClass}>
                  <option value="sftp">SFTP</option><option value="ftp">FTP</option><option value="api">REST API</option><option value="email">Email</option>
                </select>
              </div>
              {ep.type === 'email' ? (
                <>
                  <div className="md:col-span-2"><label className={labelClass}>อีเมลผู้รับ (คั่นด้วย , หากหลายคน)</label><input value={ep.host} onChange={e => update(ep.endpoint_id, 'host', e.target.value)} className={inputClass} placeholder="edi@shipping.com, ops@shipping.com" /></div>
                </>
              ) : (
                <>
                  <div><label className={labelClass}>Host</label><input value={ep.host} onChange={e => update(ep.endpoint_id, 'host', e.target.value)} className={inputClass} placeholder="sftp.example.com" /></div>
                  <div><label className={labelClass}>Port</label><input type="number" value={ep.port} onChange={e => update(ep.endpoint_id, 'port', parseInt(e.target.value) || 0)} className={inputClass} /></div>
                </>
              )}
            </div>
            <div className={`grid gap-2 ${ep.type === 'email' ? 'grid-cols-2 md:grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
              {ep.type !== 'email' && (
                <>
                  <div><label className={labelClass}>Username</label><input value={ep.username || ''} onChange={e => update(ep.endpoint_id, 'username', e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Password</label><input type="password" value={ep.password || ''} onChange={e => update(ep.endpoint_id, 'password', e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Remote Path</label><input value={ep.remote_path || '/'} onChange={e => update(ep.endpoint_id, 'remote_path', e.target.value)} className={inputClass} placeholder="/inbound/codeco" /></div>
                </>
              )}
              <div><label className={labelClass}>ฟอร์แมต</label>
                <select value={ep.format} onChange={e => update(ep.endpoint_id, 'format', e.target.value as EDIEndpoint['format'])} className={inputClass}>
                  <option value="EDIFACT">EDIFACT</option><option value="CSV">CSV</option><option value="JSON">JSON</option>
                </select>
              </div>
            </div>

            {/* Schedule Section */}
            <div className="mt-2 p-3 rounded-lg bg-white/60 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock size={13} className={ep.schedule_enabled ? 'text-amber-500' : 'text-slate-400'} />
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">ส่งอัตโนมัติ</span>
                  {ep.schedule_last_run && <span className="text-[10px] text-slate-400">ส่งล่าสุด: {fmtDate(ep.schedule_last_run)}</span>}
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={ep.schedule_enabled || false} onChange={e => update(ep.endpoint_id, 'schedule_enabled', e.target.checked)} className="w-3.5 h-3.5 rounded" />
                  <span className={`text-xs font-medium ${ep.schedule_enabled ? 'text-amber-600' : 'text-slate-400'}`}>{ep.schedule_enabled ? 'เปิด' : 'ปิด'}</span>
                </label>
              </div>
              {ep.schedule_enabled && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="md:col-span-2">
                    <label className={labelClass}>ความถี่</label>
                    <div className="flex gap-1 flex-wrap">
                      {[
                        { label: 'ทุกชั่วโมง', cron: '0 * * * *' },
                        { label: 'วันละ 2 ครั้ง', cron: '0 8,18 * * *' },
                        { label: 'ทุกวัน 18:00', cron: '0 18 * * *' },
                        { label: 'ทุกสัปดาห์', cron: '0 9 * * 1' },
                      ].map(p => (
                        <button key={p.cron} type="button" onClick={() => update(ep.endpoint_id, 'schedule_cron', p.cron)}
                          className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                            ep.schedule_cron === p.cron
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-600 dark:text-slate-400 hover:bg-slate-200'
                          }`}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Cron Expression</label>
                    <input value={ep.schedule_cron || '0 18 * * *'} onChange={e => update(ep.endpoint_id, 'schedule_cron', e.target.value)} className={inputClass} placeholder="0 18 * * *" />
                  </div>
                  <div>
                    <label className={labelClass}>Yard ID</label>
                    <input type="number" value={ep.schedule_yard_id || 1} onChange={e => update(ep.endpoint_id, 'schedule_yard_id', parseInt(e.target.value) || 1)} className={inputClass} />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        <button onClick={addEndpoint} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:border-blue-400 hover:text-blue-500 text-sm w-full justify-center transition-all">
          <Plus size={14} /> เพิ่ม Endpoint
        </button>
      </div>
    </div>

    <ConfirmDialog open={confirmDlg.open} title="ยืนยันการลบ" message={confirmDlg.message} confirmLabel="ลบ" onConfirm={confirmDlg.action} onCancel={() => setConfirmDlg(prev => ({ ...prev, open: false }))} />
    </>
  );
}
