'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/providers/ToastProvider';
import {
  Plus, Trash2, Save, Globe, CheckCircle2, Shield, Server, Loader2, Mail, Clock,
  FileText, GripVertical, Eye, EyeOff, ChevronDown, ChevronUp, Copy, Pencil,
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
  template_id: number | null;
}

interface FieldDef {
  source: string;
  header: string;
  enabled: boolean;
  format?: string;
}

interface EDITemplate {
  template_id: number;
  template_name: string;
  base_format: 'csv' | 'json' | 'edifact';
  description: string;
  field_mapping: string;
  required_fields?: string;
  csv_delimiter: string;
  date_format: string;
  edifact_version: string;
  edifact_sender: string;
  edifact_config?: string;
  is_system: boolean;
  is_active: boolean;
}

const DEFAULT_FIELDS: FieldDef[] = [
  { source: 'container_number', header: 'CONTAINER NO', enabled: true },
  { source: 'transaction_type', header: 'MOVE TYPE', enabled: true },
  { source: 'eir_number', header: 'EIR', enabled: true },
  { source: 'transaction_date', header: 'DATE', enabled: true },
  { source: 'size', header: 'SIZE', enabled: true },
  { source: 'container_type', header: 'TYPE', enabled: true },
  { source: 'shipping_line', header: 'SHIPPING LINE', enabled: true },
  { source: 'is_laden', header: 'F/E', format: 'laden_fe', enabled: true },
  { source: 'seal_number', header: 'SEAL', enabled: true },
  { source: 'truck_plate', header: 'TRUCK', enabled: true },
  { source: 'truck_company', header: 'TRUCK COMPANY', enabled: true },
  { source: 'driver_name', header: 'DRIVER', enabled: true },
  { source: 'booking_ref', header: 'BOOKING', enabled: true },
  { source: 'container_grade', header: 'GRADE', enabled: true },
  { source: 'condition', header: 'CONDITION', enabled: true },
  { source: 'yard_code', header: 'YARD', enabled: true },
];

const DEFAULT_REQUIRED_FIELDS = [
  'container_number',
  'transaction_type',
  'eir_number',
  'transaction_date',
  'size',
  'container_type',
  'shipping_line',
  'yard_code',
];

const DATE_FORMAT_OPTIONS = [
  { value: 'DD/MM/YYYY HH:mm', label: 'DD/MM/YYYY HH:mm (25/03/2026 14:30)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (25/03/2026)' },
  { value: 'YYYY-MM-DD HH:mm', label: 'YYYY-MM-DD HH:mm (2026-03-25 14:30)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2026-03-25)' },
  { value: 'YYYYMMDD', label: 'YYYYMMDD (20260325)' },
  { value: 'MM/DD/YYYY HH:mm', label: 'MM/DD/YYYY HH:mm (03/25/2026 14:30)' },
  { value: 'ISO8601', label: 'ISO 8601 (2026-03-25T14:30:00.000Z)' },
  { value: 'YYMMDD:HHmm', label: 'YYMMDD:HHmm (260325:1430) — EDIFACT' },
];

const SAMPLE_DATA = {
  container_number: 'MSCU1234567', transaction_type: 'gate_in', eir_number: 'EIR-IN-2026-000001-a3f8b2',
  transaction_date: '2026-03-25T14:30:00', size: '40', container_type: 'GP',
  shipping_line: 'MSC', is_laden: true, seal_number: 'SL202601', truck_plate: 'กท-1234',
  truck_company: 'ABC Transport', driver_name: 'สมชาย', booking_ref: 'BK2026001',
  container_grade: 'A', condition: 'GOOD', yard_code: 'YD01',
};

function mergeTemplateFields(fields: FieldDef[]) {
  const missing = DEFAULT_FIELDS.filter(df => !fields.some(f => f.source === df.source));
  return [...fields, ...missing];
}

export default function EDIConfiguration() {
  const { toast } = useToast();
  const [endpoints, setEndpoints] = useState<EDIEndpoint[]>([]);
  const [templates, setTemplates] = useState<EDITemplate[]>([]);
  const [yards, setYards] = useState<{ yard_id: number; yard_name: string }[]>([]);
  const [shippingLines, setShippingLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'endpoints' | 'templates'>('endpoints');
  const [confirmDlg, setConfirmDlg] = useState<{ open: boolean; message: string; action: () => void }>({ open: false, message: '', action: () => {} });

  // Template editor state
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EDITemplate | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplFormat, setTplFormat] = useState<'csv' | 'json' | 'edifact'>('csv');
  const [tplDesc, setTplDesc] = useState('');
  const [tplFields, setTplFields] = useState<FieldDef[]>(DEFAULT_FIELDS);
  const [tplRequiredFields, setTplRequiredFields] = useState<string[]>(DEFAULT_REQUIRED_FIELDS);
  const [tplDelimiter, setTplDelimiter] = useState(',');
  const [tplDateFormat, setTplDateFormat] = useState('DD/MM/YYYY HH:mm');
  const [tplEdifactVer, setTplEdifactVer] = useState('D:95B:UN');
  const [tplEdifactSender, setTplEdifactSender] = useState('');
  const [tplEdifactConfig, setTplEdifactConfig] = useState({
    bgm_code: '36',
    gate_in_function: '34',
    gate_out_function: '36',
    location_qualifier: '89',
    include_driver: true,
    include_booking: true,
    include_truck_company: false,
    include_grade: false,
    include_condition: false,
  });
  const [tplSaving, setTplSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const fetchEndpoints = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/edi/endpoints');
      const data = await res.json();
      setEndpoints(data.endpoints || []);
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/edi/templates');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch { /* */ }
  }, []);

  useEffect(() => {
    fetchEndpoints();
    fetchTemplates();
    fetch('/api/settings/yards').then(r => r.json()).then(d => setYards(Array.isArray(d) ? d : d.yards || [])).catch(() => {});
    fetch('/api/edi/codeco?yard_id=1&format=json').then(r => r.json()).then(d => {
      if (d.shipping_lines) setShippingLines(d.shipping_lines);
    }).catch(() => {});
  }, [fetchEndpoints, fetchTemplates]);

  const addEndpoint = async () => {
    try {
      const res = await fetch('/api/edi/endpoints', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Endpoint ใหม่', host: '', type: 'sftp', port: 22, format: 'EDIFACT', remote_path: '/' }),
      });
      const data = await res.json();
      if (data.success) setEndpoints([...endpoints, data.endpoint]);
    } catch { /* */ }
  };

  const removeEndpoint = async (id: number) => {
    setConfirmDlg({
      open: true, message: 'ลบ Endpoint นี้?',
      action: async () => {
        setConfirmDlg(prev => ({ ...prev, open: false }));
        await fetch(`/api/edi/endpoints?endpoint_id=${id}`, { method: 'DELETE' });
        setEndpoints(endpoints.filter(e => e.endpoint_id !== id));
      },
    });
  };

  const update = (id: number, field: string, value: string | number | boolean | null) => {
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

  // Template editor functions
  const openEditor = (tpl?: EDITemplate) => {
    if (tpl) {
      setEditingTemplate(tpl);
      setTplName(tpl.template_name);
      setTplFormat(tpl.base_format as 'csv' | 'json' | 'edifact');
      setTplDesc(tpl.description || '');
      setTplDelimiter(tpl.csv_delimiter || ',');
      setTplDateFormat(tpl.date_format || 'DD/MM/YYYY HH:mm');
      setTplEdifactVer(tpl.edifact_version || 'D:95B:UN');
      setTplEdifactSender(tpl.edifact_sender || '');
      try {
        const parsed = JSON.parse(tpl.field_mapping);
        setTplFields(mergeTemplateFields(parsed.fields || DEFAULT_FIELDS));
      } catch { setTplFields(DEFAULT_FIELDS); }
      try {
        setTplRequiredFields(tpl.required_fields ? JSON.parse(tpl.required_fields) : DEFAULT_REQUIRED_FIELDS);
      } catch { setTplRequiredFields(DEFAULT_REQUIRED_FIELDS); }
      try {
        setTplEdifactConfig(prev => ({ ...prev, ...(tpl.edifact_config ? JSON.parse(tpl.edifact_config) : {}) }));
      } catch { /* keep defaults */ }
    } else {
      setEditingTemplate(null);
      setTplName('');
      setTplFormat('csv');
      setTplDesc('');
      setTplFields(DEFAULT_FIELDS.map(f => ({ ...f })));
      setTplRequiredFields(DEFAULT_REQUIRED_FIELDS);
      setTplDelimiter(',');
      setTplDateFormat('DD/MM/YYYY HH:mm');
      setTplEdifactVer('D:95B:UN');
      setTplEdifactSender('');
      setTplEdifactConfig({
        bgm_code: '36',
        gate_in_function: '34',
        gate_out_function: '36',
        location_qualifier: '89',
        include_driver: true,
        include_booking: true,
        include_truck_company: false,
        include_grade: false,
        include_condition: false,
      });
    }
    setShowEditor(true);
  };

  const saveTemplate = async () => {
    if (!tplName.trim()) return;
    setTplSaving(true);
    try {
      const payload = {
        template_id: editingTemplate?.template_id,
        template_name: tplName,
        base_format: tplFormat,
        description: tplDesc,
        field_mapping: JSON.stringify({ fields: tplFields }),
        required_fields: JSON.stringify(tplRequiredFields),
        csv_delimiter: tplDelimiter,
        date_format: tplDateFormat,
        edifact_version: tplEdifactVer,
        edifact_sender: tplEdifactSender,
        edifact_config: JSON.stringify(tplEdifactConfig),
      };
      const method = editingTemplate ? 'PUT' : 'POST';
      await fetch('/api/edi/templates', {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await fetchTemplates();
      setEditingTemplate(null);
      setTplName('');
      setShowEditor(false);
    } catch { /* */ }
    finally { setTplSaving(false); }
  };

  const deleteTemplate = async (id: number) => {
    setConfirmDlg({
      open: true, message: 'ลบ Template นี้? Endpoint ที่ใช้อยู่จะไม่สามารถลบได้',
      action: async () => {
        setConfirmDlg(prev => ({ ...prev, open: false }));
        const res = await fetch(`/api/edi/templates?template_id=${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) fetchTemplates();
        else toast('error', data.error);
      },
    });
  };

  const duplicateTemplate = (tpl: EDITemplate) => {
    openEditor();
    setTplName(`${tpl.template_name} (สำเนา)`);
    setTplFormat(tpl.base_format as 'csv' | 'json' | 'edifact');
    setTplDesc(tpl.description || '');
    setTplDelimiter(tpl.csv_delimiter || ',');
    setTplDateFormat(tpl.date_format || 'DD/MM/YYYY HH:mm');
    setTplEdifactVer(tpl.edifact_version || 'D:95B:UN');
    setTplEdifactSender(tpl.edifact_sender || '');
    try {
      const parsed = JSON.parse(tpl.field_mapping);
      setTplFields(mergeTemplateFields(parsed.fields || DEFAULT_FIELDS));
    } catch { setTplFields(DEFAULT_FIELDS); }
    try {
      setTplRequiredFields(tpl.required_fields ? JSON.parse(tpl.required_fields) : DEFAULT_REQUIRED_FIELDS);
    } catch { setTplRequiredFields(DEFAULT_REQUIRED_FIELDS); }
    try {
      setTplEdifactConfig(prev => ({ ...prev, ...(tpl.edifact_config ? JSON.parse(tpl.edifact_config) : {}) }));
    } catch { /* keep defaults */ }
  };

  const toggleField = (idx: number) => {
    setTplFields(prev => prev.map((f, i) => i === idx ? { ...f, enabled: !f.enabled } : f));
  };
  const updateFieldHeader = (idx: number, header: string) => {
    setTplFields(prev => prev.map((f, i) => i === idx ? { ...f, header } : f));
  };
  const toggleRequiredField = (source: string) => {
    setTplRequiredFields(prev => prev.includes(source) ? prev.filter(f => f !== source) : [...prev, source]);
  };
  const moveField = (idx: number, dir: 'up' | 'down') => {
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= tplFields.length) return;
    setTplFields(prev => {
      const arr = [...prev];
      [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
      return arr;
    });
  };

  // Drag-and-drop handlers
  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };
  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    setTplFields(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(dragIdx, 1);
      arr.splice(idx, 0, moved);
      return arr;
    });
    setDragIdx(null);
    setDragOverIdx(null);
  };
  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  // Generate preview
  const generatePreview = (): string => {
    const enabled = tplFields.filter(f => f.enabled);
    if (tplFormat === 'csv') {
      const d = tplDelimiter;
      const header = enabled.map(f => f.header).join(d);
      const row = enabled.map(f => {
        if (f.source === 'is_laden') return SAMPLE_DATA.is_laden ? 'F' : 'E';
        if (f.source === 'transaction_date') return formatPreviewDate(SAMPLE_DATA.transaction_date, tplDateFormat);
        return (SAMPLE_DATA as Record<string, unknown>)[f.source] || '';
      }).join(d);
      return `${header}\n${row}\n...`;
    }
    if (tplFormat === 'json') {
      const obj: Record<string, unknown> = {};
      enabled.forEach(f => {
        if (f.source === 'is_laden') { obj[f.header] = 'F'; return; }
        if (f.source === 'transaction_date') { obj[f.header] = formatPreviewDate(SAMPLE_DATA.transaction_date, tplDateFormat); return; }
        obj[f.header] = (SAMPLE_DATA as Record<string, unknown>)[f.source] || '';
      });
      return JSON.stringify({ message_type: 'CODECO', transactions: [obj, '...'] }, null, 2);
    }
    // EDIFACT
    return `UNB+UNOC:3+CYMS+MSC+260325:1430+CODECO...'
UNH+1+CODECO:${tplEdifactVer}'
BGM+36+CODECO...+9'
TDT+34'
LOC+89+YD01:139:6'
DTM+137:260325:1430:203'
EQD+CN+MSCU1234567+42G1:102:5'
...
UNZ+1+CODECO...'`;
  };

  const formatPreviewDate = (d: string, fmt: string): string => {
    const dt = new Date(d);
    const Y = dt.getFullYear(), m = String(dt.getMonth() + 1).padStart(2, '0'), dd = String(dt.getDate()).padStart(2, '0');
    const H = String(dt.getHours()).padStart(2, '0'), mi = String(dt.getMinutes()).padStart(2, '0');
    switch (fmt) {
      case 'DD/MM/YYYY HH:mm': return `${dd}/${m}/${Y} ${H}:${mi}`;
      case 'DD/MM/YYYY': return `${dd}/${m}/${Y}`;
      case 'YYYY-MM-DD HH:mm': return `${Y}-${m}-${dd} ${H}:${mi}`;
      case 'YYYY-MM-DD': return `${Y}-${m}-${dd}`;
      case 'YYYYMMDD': return `${Y}${m}${dd}`;
      case 'ISO8601': return dt.toISOString();
      case 'MM/DD/YYYY HH:mm': return `${m}/${dd}/${Y} ${H}:${mi}`;
      default: return `${dd}/${m}/${Y} ${H}:${mi}`;
    }
  };

  const inputClass = "w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors";
  const labelClass = "text-[10px] font-semibold text-slate-400 uppercase mb-1 block";

  const fmtDate = (d: string) => {
    if (!d) return 'ยังไม่เคยส่ง';
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  };

  const getTemplateNameById = (id: number | null) => {
    if (!id) return null;
    return templates.find(t => t.template_id === id)?.template_name;
  };

  return (
    <>
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header + Tab Toggle */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600"><Globe size={20} /></div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white">EDI Configuration</h3>
            <p className="text-xs text-slate-400">ตั้งค่า Endpoints + EDI Templates สำหรับส่งข้อมูลให้สายเรือ</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Tab toggle */}
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-700 p-0.5">
            <button onClick={() => setActiveTab('endpoints')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'endpoints' ? 'bg-white dark:bg-slate-600 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Server size={12} className="inline mr-1" />Endpoints
            </button>
            <button onClick={() => setActiveTab('templates')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'templates' ? 'bg-white dark:bg-slate-600 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <FileText size={12} className="inline mr-1" />Templates
            </button>
          </div>
          {activeTab === 'endpoints' && (
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
              {saved ? 'บันทึกแล้ว' : 'บันทึก'}
            </button>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* ===== ENDPOINTS TAB ===== */}
        {activeTab === 'endpoints' && (
          <>
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
                  <div>
                    <label className={labelClass}>สายเรือ</label>
                    <input list="sl-list" value={ep.shipping_line || ''} onChange={e => update(ep.endpoint_id, 'shipping_line', e.target.value)} className={inputClass} placeholder="พิมพ์เพื่อค้นหา..." />
                    <datalist id="sl-list">{shippingLines.map(sl => <option key={sl} value={sl} />)}</datalist>
                  </div>
                  <div><label className={labelClass}>ประเภท</label>
                    <select value={ep.type} onChange={e => { update(ep.endpoint_id, 'type', e.target.value); if (e.target.value === 'email') { update(ep.endpoint_id, 'port', 0); } }} className={inputClass}>
                      <option value="sftp">SFTP</option><option value="ftp">FTP</option><option value="api">REST API</option><option value="email">Email</option>
                    </select>
                  </div>
                  {ep.type === 'email' ? (
                    <div className="md:col-span-2"><label className={labelClass}>อีเมลผู้รับ (คั่นด้วย , หากหลายคน)</label><input value={ep.host} onChange={e => update(ep.endpoint_id, 'host', e.target.value)} className={inputClass} placeholder="edi@shipping.com, ops@shipping.com" /></div>
                  ) : (
                    <>
                      <div><label className={labelClass}>Host</label><input value={ep.host} onChange={e => update(ep.endpoint_id, 'host', e.target.value)} className={inputClass} placeholder="sftp.example.com" /></div>
                      <div><label className={labelClass}>Port</label><input type="number" value={ep.port} onChange={e => update(ep.endpoint_id, 'port', parseInt(e.target.value) || 0)} className={inputClass} /></div>
                    </>
                  )}
                </div>
                <div className={`grid gap-2 ${ep.type === 'email' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-5'}`}>
                  {ep.type !== 'email' && (
                    <>
                      <div><label className={labelClass}>Username</label><input value={ep.username || ''} onChange={e => update(ep.endpoint_id, 'username', e.target.value)} className={inputClass} /></div>
                      <div><label className={labelClass}>Password</label><input type="password" value={ep.password || ''} onChange={e => update(ep.endpoint_id, 'password', e.target.value)} className={inputClass} /></div>
                      <div><label className={labelClass}>Remote Path</label><input value={ep.remote_path || '/'} onChange={e => update(ep.endpoint_id, 'remote_path', e.target.value)} className={inputClass} placeholder="/inbound/codeco" /></div>
                    </>
                  )}
                  <div><label className={labelClass}>ฟอร์แมตพื้นฐาน</label>
                    <select value={ep.format} onChange={e => update(ep.endpoint_id, 'format', e.target.value)} className={inputClass}>
                      <option value="EDIFACT">EDIFACT</option><option value="CSV">CSV</option><option value="JSON">JSON</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>📄 Template</label>
                    <select value={ep.template_id || ''} onChange={e => update(ep.endpoint_id, 'template_id', e.target.value ? parseInt(e.target.value) : null)} className={inputClass}>
                      <option value="">— ค่าเริ่มต้น (ตาม format) —</option>
                      {templates.map(t => (
                        <option key={t.template_id} value={t.template_id}>
                          {t.template_name} ({t.base_format.toUpperCase()})
                        </option>
                      ))}
                    </select>
                    {ep.template_id && (
                      <span className="text-[10px] text-indigo-500 mt-0.5 block">📄 ใช้ template: {getTemplateNameById(ep.template_id)}</span>
                    )}
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
                  {ep.schedule_enabled && (() => {
                    const cronStr = ep.schedule_cron || '0 18 * * *';
                    const parts = cronStr.split(' ');
                    const minute = parts[0] || '0';
                    const hour = parts[1] || '18';
                    const dayOfWeek = parts[4] || '*';
                    let freq = 'daily';
                    if (hour === '*') freq = 'hourly';
                    else if (hour.includes(',')) freq = 'twice';
                    else if (dayOfWeek !== '*') freq = 'weekly';
                    const setCron = (f: string, h?: string, m?: string, dow?: string) => {
                      const mm = m ?? minute; const hh = h ?? (hour.includes(',') ? '8' : hour === '*' ? '0' : hour); const dd = dow ?? dayOfWeek;
                      let cron = '';
                      if (f === 'hourly') cron = `${mm} * * * *`;
                      else if (f === 'twice') cron = `${mm} 8,18 * * *`;
                      else if (f === 'weekly') cron = `${mm} ${hh} * * ${dd === '*' ? '1' : dd}`;
                      else cron = `${mm} ${hh} * * *`;
                      update(ep.endpoint_id, 'schedule_cron', cron);
                    };
                    const primaryHour = hour.includes(',') ? hour.split(',')[0] : hour === '*' ? '0' : hour;
                    return (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div><label className={labelClass}>ความถี่</label>
                          <select value={freq} onChange={e => setCron(e.target.value)} className={inputClass}>
                            <option value="hourly">⏱ ทุกชั่วโมง</option><option value="twice">🔄 วันละ 2 ครั้ง (08:00, 18:00)</option><option value="daily">📅 ทุกวัน</option><option value="weekly">📆 ทุกสัปดาห์</option>
                          </select>
                        </div>
                        {freq !== 'hourly' && freq !== 'twice' && (
                          <div><label className={labelClass}>เวลา</label>
                            <input type="time" value={`${String(primaryHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`}
                              onChange={e => { const [hh, mm] = e.target.value.split(':'); setCron(freq, hh, mm); }} className={inputClass} />
                          </div>
                        )}
                        {freq === 'hourly' && (
                          <div><label className={labelClass}>นาทีที่</label>
                            <select value={minute} onChange={e => setCron('hourly', undefined, e.target.value)} className={inputClass}>
                              <option value="0">:00 (ตรง)</option><option value="15">:15</option><option value="30">:30</option><option value="45">:45</option>
                            </select>
                          </div>
                        )}
                        {freq === 'weekly' && (
                          <div><label className={labelClass}>วัน</label>
                            <select value={dayOfWeek === '*' ? '1' : dayOfWeek} onChange={e => setCron('weekly', undefined, undefined, e.target.value)} className={inputClass}>
                              <option value="1">จันทร์</option><option value="2">อังคาร</option><option value="3">พุธ</option><option value="4">พฤหัสบดี</option><option value="5">ศุกร์</option><option value="6">เสาร์</option><option value="0">อาทิตย์</option>
                            </select>
                          </div>
                        )}
                        <div><label className={labelClass}>ลาน</label>
                          <select value={ep.schedule_yard_id || 1} onChange={e => update(ep.endpoint_id, 'schedule_yard_id', parseInt(e.target.value))} className={inputClass}>
                            {yards.map(y => <option key={y.yard_id} value={y.yard_id}>{y.yard_name}</option>)}
                            {yards.length === 0 && <option value={1}>Yard 1</option>}
                          </select>
                        </div>
                        <div className="col-span-2 md:col-span-4">
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
                            <Clock size={12} className="text-amber-500 shrink-0" />
                            <span className="text-[11px] text-amber-700 dark:text-amber-400">
                              {freq === 'hourly' && `ส่งทุกชั่วโมง ที่นาที :${String(minute).padStart(2, '0')}`}
                              {freq === 'twice' && `ส่งวันละ 2 ครั้ง เวลา 08:00 และ 18:00`}
                              {freq === 'daily' && `ส่งทุกวัน เวลา ${String(primaryHour).padStart(2, '0')}:${String(minute).padStart(2, '0')} น.`}
                              {freq === 'weekly' && `ส่งทุกวัน${['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'][parseInt(dayOfWeek === '*' ? '1' : dayOfWeek)] || ''} เวลา ${String(primaryHour).padStart(2, '0')}:${String(minute).padStart(2, '0')} น.`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))}

            <button onClick={addEndpoint} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:border-blue-400 hover:text-blue-500 text-sm w-full justify-center transition-all">
              <Plus size={14} /> เพิ่ม Endpoint
            </button>
          </>
        )}

        {/* ===== TEMPLATES TAB ===== */}
        {activeTab === 'templates' && (
          <>
            {/* Template List */}
            {!showEditor && (
              <div className="space-y-3">
                {templates.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">ยังไม่มี Template — กดปุ่มด้านล่างเพื่อสร้าง</p>
                ) : templates.map(tpl => (
                  <div key={tpl.template_id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-600 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText size={18} className={tpl.is_system ? 'text-blue-500' : 'text-indigo-500'} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-800 dark:text-white">{tpl.template_name}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${tpl.base_format === 'edifact' ? 'bg-purple-100 text-purple-700' : tpl.base_format === 'csv' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {tpl.base_format.toUpperCase()}
                          </span>
                          {tpl.is_system && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-600"><Shield size={8} className="inline mr-0.5" />SYSTEM</span>}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{tpl.description || 'ไม่มีคำอธิบาย'}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          📅 {tpl.date_format}
                          {tpl.base_format === 'csv' && <> · Delimiter: <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded text-[9px]">{tpl.csv_delimiter === ',' ? 'จุลภาค (,)' : tpl.csv_delimiter === ';' ? 'อัฒภาค (;)' : tpl.csv_delimiter === '\t' ? 'TAB' : tpl.csv_delimiter}</code></>}
                          {tpl.base_format === 'edifact' && <> · EDIFACT {tpl.edifact_version}</>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => duplicateTemplate(tpl)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-blue-500" title="สำเนา"><Copy size={13} /></button>
                      {!tpl.is_system && (
                        <>
                          <button onClick={() => openEditor(tpl)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-amber-500" title="แก้ไข"><Pencil size={13} /></button>
                          <button onClick={() => deleteTemplate(tpl.template_id)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-red-500" title="ลบ"><Trash2 size={13} /></button>
                        </>
                      )}
                    </div>
                  </div>
                ))}

                <button onClick={() => openEditor()} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:border-indigo-400 hover:text-indigo-500 text-sm w-full justify-center transition-all">
                  <Plus size={14} /> สร้าง Template ใหม่
                </button>
              </div>
            )}

            {/* Template Editor */}
            {showEditor && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm text-slate-800 dark:text-white">
                    {editingTemplate ? `✏️ แก้ไข: ${editingTemplate.template_name}` : '🆕 สร้าง Template ใหม่'}
                  </h4>
                  <button onClick={() => { setEditingTemplate(null); setTplName(''); setShowEditor(false); }}
                    className="text-xs text-slate-400 hover:text-slate-600">✕ ยกเลิก</button>
                </div>

                {/* Basic Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><label className={labelClass}>ชื่อ Template</label>
                    <input value={tplName} onChange={e => setTplName(e.target.value)} className={inputClass} placeholder="เช่น MSC Custom CSV" /></div>
                  <div><label className={labelClass}>ฟอร์แมต</label>
                    <select value={tplFormat} onChange={e => setTplFormat(e.target.value as 'csv' | 'json' | 'edifact')} className={inputClass}>
                      <option value="csv">CSV</option><option value="json">JSON</option><option value="edifact">EDIFACT</option>
                    </select>
                  </div>
                  <div><label className={labelClass}>รูปแบบวันที่</label>
                    <select value={tplDateFormat} onChange={e => setTplDateFormat(e.target.value)} className={inputClass}>
                      {DATE_FORMAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  {tplFormat === 'csv' && (
                    <div><label className={labelClass}>ตัวคั่น</label>
                      <select value={tplDelimiter} onChange={e => setTplDelimiter(e.target.value)} className={inputClass}>
                        <option value=",">จุลภาค (,)</option><option value=";">อัฒภาค (;)</option><option value={'\t'}>TAB</option><option value="|">Pipe (|)</option>
                      </select>
                    </div>
                  )}
                  {tplFormat === 'edifact' && (
                    <>
                      <div><label className={labelClass}>EDIFACT Version</label>
                        <select value={tplEdifactVer} onChange={e => setTplEdifactVer(e.target.value)} className={inputClass}>
                          <option value="D:95B:UN">D:95B:UN (Standard)</option><option value="D:00B:UN">D:00B:UN (Newer)</option><option value="D:01B:UN">D:01B:UN</option>
                        </select>
                      </div>
                      <div><label className={labelClass}>Sender ID (override)</label>
                        <input value={tplEdifactSender} onChange={e => setTplEdifactSender(e.target.value)} className={inputClass} placeholder="ชื่อบริษัท (ค่าเริ่มต้น)" /></div>
                    </>
                  )}
                </div>

                <div><label className={labelClass}>คำอธิบาย</label>
                  <input value={tplDesc} onChange={e => setTplDesc(e.target.value)} className={inputClass} placeholder="รายละเอียด template นี้..." /></div>

                {/* Required Fields */}
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40">
                  <h5 className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-3">Required Fields — ตรวจข้อมูลก่อนส่ง EDI</h5>
                  <div className="flex flex-wrap gap-2">
                    {tplFields.map(f => (
                      <button key={f.source} type="button" onClick={() => toggleRequiredField(f.source)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                          tplRequiredFields.includes(f.source)
                            ? 'bg-amber-500 border-amber-500 text-white'
                            : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500'
                        }`}>
                        {f.header || f.source}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-2">
                    ถ้ารายการ Gate ขาด field ที่เลือกไว้ ระบบจะไม่ส่งไฟล์ให้สายเรือ
                  </p>
                </div>

                {/* EDIFACT Rule Overrides */}
                {tplFormat === 'edifact' && (
                  <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/40">
                    <h5 className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-3">EDIFACT Rules — ปรับ qualifier ต่อสายเรือ</h5>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div><label className={labelClass}>BGM Code</label>
                        <input value={tplEdifactConfig.bgm_code} onChange={e => setTplEdifactConfig(prev => ({ ...prev, bgm_code: e.target.value }))} className={inputClass} /></div>
                      <div><label className={labelClass}>Gate-In Function</label>
                        <input value={tplEdifactConfig.gate_in_function} onChange={e => setTplEdifactConfig(prev => ({ ...prev, gate_in_function: e.target.value }))} className={inputClass} /></div>
                      <div><label className={labelClass}>Gate-Out Function</label>
                        <input value={tplEdifactConfig.gate_out_function} onChange={e => setTplEdifactConfig(prev => ({ ...prev, gate_out_function: e.target.value }))} className={inputClass} /></div>
                      <div><label className={labelClass}>LOC Qualifier</label>
                        <input value={tplEdifactConfig.location_qualifier} onChange={e => setTplEdifactConfig(prev => ({ ...prev, location_qualifier: e.target.value }))} className={inputClass} /></div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {[
                        ['include_driver', 'Driver NAD'],
                        ['include_booking', 'Booking RFF'],
                        ['include_truck_company', 'Trucking NAD'],
                        ['include_grade', 'Grade FTX'],
                        ['include_condition', 'Condition FTX'],
                      ].map(([key, label]) => (
                        <label key={key} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-purple-100 dark:border-purple-800 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
                          <input type="checkbox" checked={Boolean((tplEdifactConfig as unknown as Record<string, boolean>)[key])}
                            onChange={e => setTplEdifactConfig(prev => ({ ...prev, [key]: e.target.checked }))}
                            className="accent-purple-600" />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Field Mapping — CSV/JSON only */}
                {tplFormat !== 'edifact' && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 border border-slate-100 dark:border-slate-600">
                    <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-3">📋 Field Mapping — เลือก/เรียงลำดับ/เปลี่ยนชื่อ header</h5>
                    <div className="space-y-1.5">
                      {tplFields.map((f, idx) => (
                        <div key={f.source}
                          draggable
                          onDragStart={() => handleDragStart(idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDrop={() => handleDrop(idx)}
                          onDragEnd={handleDragEnd}
                          className={`flex items-center gap-2 p-2 rounded-lg transition-all ${dragOverIdx === idx && dragIdx !== idx ? 'ring-2 ring-blue-400 ring-offset-1' : ''} ${dragIdx === idx ? 'opacity-40' : ''} ${f.enabled ? 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600' : 'bg-slate-100/50 dark:bg-slate-800/30 border border-transparent opacity-60'}`}>
                          <GripVertical size={14} className="text-slate-300 cursor-grab active:cursor-grabbing shrink-0" />
                          <button onClick={() => toggleField(idx)} className="shrink-0">
                            {f.enabled ? <Eye size={14} className="text-emerald-500" /> : <EyeOff size={14} className="text-slate-400" />}
                          </button>
                          <span className="text-[11px] text-slate-400 w-32 shrink-0 font-mono cursor-grab active:cursor-grabbing">{f.source}</span>
                          <span className="text-slate-400 text-[10px]">→</span>
                          <input value={f.header} onChange={e => updateFieldHeader(idx, e.target.value)}
                            className="flex-1 h-7 px-2 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-800 dark:text-white outline-none focus:border-blue-400"
                            disabled={!f.enabled} />
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button onClick={() => moveField(idx, 'up')} disabled={idx === 0} className="p-0.5 text-slate-400 hover:text-blue-500 disabled:opacity-30"><ChevronUp size={12} /></button>
                            <button onClick={() => moveField(idx, 'down')} disabled={idx === tplFields.length - 1} className="p-0.5 text-slate-400 hover:text-blue-500 disabled:opacity-30"><ChevronDown size={12} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Live Preview */}
                <div className="p-4 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto">
                  <div className="flex items-center gap-2 mb-2 text-slate-400 text-[10px]">
                    <Eye size={10} /> ตัวอย่าง Output ({tplFormat.toUpperCase()})
                  </div>
                  <pre className="whitespace-pre-wrap">{generatePreview()}</pre>
                </div>

                {/* Save/Cancel */}
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setEditingTemplate(null); setTplName(''); setShowEditor(false); }}
                    className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                    ยกเลิก
                  </button>
                  <button onClick={saveTemplate} disabled={tplSaving || !tplName.trim()}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                    {tplSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {editingTemplate ? 'อัปเดต Template' : 'สร้าง Template'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>

    <ConfirmDialog open={confirmDlg.open} title="ยืนยันการลบ" message={confirmDlg.message} confirmLabel="ลบ" onConfirm={confirmDlg.action} onCancel={() => setConfirmDlg(prev => ({ ...prev, open: false }))} />
    </>
  );
}
