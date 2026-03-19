'use client';

import { useState } from 'react';
import {
  Plus, Trash2, Save, Globe, CheckCircle2, Shield, Key, Server,
} from 'lucide-react';

interface EDIEndpoint {
  id: number;
  name: string;
  type: 'api' | 'ftp' | 'sftp';
  url: string;
  port: number;
  username: string;
  api_key: string;
  format: 'EDIFACT' | 'XML' | 'JSON' | 'CSV';
  is_active: boolean;
  last_sync: string;
}

const DEFAULT_ENDPOINTS: EDIEndpoint[] = [
  { id: 1, name: 'Evergreen EDI', type: 'api', url: 'https://api.evergreen-marine.com/edi/v2', port: 443, username: '', api_key: '••••••••', format: 'JSON', is_active: true, last_sync: '10 นาทีที่แล้ว' },
  { id: 2, name: 'MSC Booking SFTP', type: 'sftp', url: 'sftp.msc.com', port: 22, username: 'cyms_user', api_key: '', format: 'EDIFACT', is_active: true, last_sync: '1 ชม.ที่แล้ว' },
  { id: 3, name: 'ONE Line XML Feed', type: 'api', url: 'https://one-line.com/api/bookings', port: 443, username: '', api_key: '••••••••', format: 'XML', is_active: false, last_sync: 'ยังไม่ sync' },
];

export default function EDIConfiguration() {
  const [endpoints, setEndpoints] = useState<EDIEndpoint[]>(DEFAULT_ENDPOINTS);
  const [saved, setSaved] = useState(false);

  const addEndpoint = () => {
    setEndpoints([...endpoints, {
      id: Date.now(), name: '', type: 'api', url: '', port: 443, username: '', api_key: '', format: 'JSON', is_active: true, last_sync: '-',
    }]);
  };

  const removeEndpoint = (id: number) => setEndpoints(endpoints.filter(e => e.id !== id));
  const update = (id: number, field: string, value: string | number | boolean) => {
    setEndpoints(endpoints.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const inputClass = "w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors";
  const labelClass = "text-[10px] font-semibold text-slate-400 uppercase mb-1 block";

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600"><Globe size={20} /></div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white">EDI Configuration</h3>
            <p className="text-xs text-slate-400">ตั้งค่า API / FTP endpoints สำหรับสายเรือ</p>
          </div>
        </div>
        <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
          {saved ? <><CheckCircle2 size={14} /> บันทึกแล้ว</> : <><Save size={14} /> บันทึก</>}
        </button>
      </div>

      <div className="p-5 space-y-4">
        {endpoints.map(ep => (
          <div key={ep.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-600 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server size={14} className={ep.is_active ? 'text-emerald-500' : 'text-slate-400'} />
                <span className="font-semibold text-sm text-slate-800 dark:text-white">{ep.name || 'Endpoint ใหม่'}</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${ep.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {ep.is_active ? 'ACTIVE' : 'INACTIVE'}
                </span>
                <span className="text-[10px] text-slate-400">🕐 {ep.last_sync}</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-slate-500 cursor-pointer">
                  <input type="checkbox" checked={ep.is_active} onChange={e => update(ep.id, 'is_active', e.target.checked)} className="w-3.5 h-3.5 rounded" /> เปิด
                </label>
                <button onClick={() => removeEndpoint(ep.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div><label className={labelClass}>ชื่อ Endpoint</label><input value={ep.name} onChange={e => update(ep.id, 'name', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>ประเภท</label>
                <select value={ep.type} onChange={e => update(ep.id, 'type', e.target.value)} className={inputClass}>
                  <option value="api">REST API</option><option value="ftp">FTP</option><option value="sftp">SFTP</option>
                </select>
              </div>
              <div><label className={labelClass}>URL / Host</label><input value={ep.url} onChange={e => update(ep.id, 'url', e.target.value)} className={inputClass} placeholder="https://..." /></div>
              <div><label className={labelClass}>Port</label><input type="number" value={ep.port} onChange={e => update(ep.id, 'port', parseInt(e.target.value) || 0)} className={inputClass} /></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div><label className={labelClass}>Username</label><input value={ep.username} onChange={e => update(ep.id, 'username', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>API Key / Password</label><input type="password" value={ep.api_key} onChange={e => update(ep.id, 'api_key', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>ฟอร์แมต</label>
                <select value={ep.format} onChange={e => update(ep.id, 'format', e.target.value as EDIEndpoint['format'])} className={inputClass}>
                  <option value="EDIFACT">EDIFACT</option><option value="XML">XML</option><option value="JSON">JSON</option><option value="CSV">CSV</option>
                </select>
              </div>
            </div>
          </div>
        ))}

        <button onClick={addEndpoint} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:border-blue-400 hover:text-blue-500 text-sm w-full justify-center transition-all">
          <Plus size={14} /> เพิ่ม Endpoint
        </button>
      </div>
    </div>
  );
}
