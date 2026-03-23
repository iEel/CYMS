'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Mail, Cloud, Server, Send, CheckCircle, XCircle, Loader2,
  Bell, Shield, Eye, EyeOff, ToggleLeft, ToggleRight,
} from 'lucide-react';

interface EmailSettings {
  enabled: boolean;
  provider: 'azure' | 'smtp';
  azure: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    mailFrom: string;
  };
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
  };
  notifyGate: boolean;
  notifyPayment: boolean;
  notifyTo: string;
}

const DEFAULT: EmailSettings = {
  enabled: false,
  provider: 'azure',
  azure: { tenantId: '', clientId: '', clientSecret: '', mailFrom: '' },
  smtp: { host: 'smtp.office365.com', port: 587, user: '', pass: '', from: '' },
  notifyGate: false,
  notifyPayment: false,
  notifyTo: '',
};

export default function EmailSettings() {
  const [settings, setSettings] = useState<EmailSettings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/email');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setTestResult({ success: true, message: 'บันทึกสำเร็จ' });
        fetchSettings();
      } else {
        setTestResult({ success: false, message: 'บันทึกไม่สำเร็จ' });
      }
    } catch {
      setTestResult({ success: false, message: 'เกิดข้อผิดพลาด' });
    }
    setSaving(false);
    setTimeout(() => setTestResult(null), 3000);
  };

  const handleTestEmail = async () => {
    if (!testEmail) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult({ success: true, message: `ส่งสำเร็จ via ${data.provider}` });
      } else {
        setTestResult({ success: false, message: data.error || 'ส่งไม่สำเร็จ' });
      }
    } catch {
      setTestResult({ success: false, message: 'เกิดข้อผิดพลาด' });
    }
    setTesting(false);
  };

  const toggleShow = (key: string) => setShowSecrets(p => ({ ...p, [key]: !p[key] }));

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin text-slate-400" size={24} /></div>;
  }

  const inputCls = "w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors";
  const labelCls = "block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1";

  return (
    <div className="space-y-6">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500">
            <Mail size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-white">ระบบแจ้งเตือน Email</p>
            <p className="text-xs text-slate-400">{settings.enabled ? 'เปิดใช้งาน' : 'ปิดการใช้งาน'}</p>
          </div>
        </div>
        <button onClick={() => setSettings(p => ({ ...p, enabled: !p.enabled }))}
          className={`transition-colors ${settings.enabled ? 'text-blue-500' : 'text-slate-300'}`}>
          {settings.enabled ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
        </button>
      </div>

      {settings.enabled && (
        <>
          {/* Provider Selection */}
          <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Email Provider</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'azure' as const, icon: <Cloud size={20} />, label: 'Azure AD (Graph API)', desc: 'Microsoft 365 OAuth2' },
                { key: 'smtp' as const, icon: <Server size={20} />, label: 'SMTP Direct', desc: 'smtp.office365.com' },
              ].map(p => (
                <button key={p.key}
                  onClick={() => setSettings(s => ({ ...s, provider: p.key }))}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    settings.provider === p.key
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'
                  }`}>
                  <div className={`mb-2 ${settings.provider === p.key ? 'text-blue-500' : 'text-slate-400'}`}>{p.icon}</div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">{p.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{p.desc}</p>
                  {settings.provider === p.key && p.key === 'azure' && (
                    <span className="inline-block mt-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">PRIMARY</span>
                  )}
                  {settings.provider !== p.key && p.key === 'smtp' && (
                    <span className="inline-block mt-2 text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">FALLBACK</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Azure AD Config */}
          <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={16} className="text-blue-500" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Azure AD Configuration</h3>
              {settings.provider === 'azure' && <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded">ACTIVE</span>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Tenant ID</label>
                <input type="text" className={inputCls} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={settings.azure.tenantId} onChange={e => setSettings(s => ({ ...s, azure: { ...s.azure, tenantId: e.target.value } }))} />
              </div>
              <div>
                <label className={labelCls}>Client ID (Application ID)</label>
                <input type="text" className={inputCls} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={settings.azure.clientId} onChange={e => setSettings(s => ({ ...s, azure: { ...s.azure, clientId: e.target.value } }))} />
              </div>
              <div>
                <label className={labelCls}>Client Secret</label>
                <div className="relative">
                  <input type={showSecrets.azureSecret ? 'text' : 'password'} className={`${inputCls} pr-10`}
                    placeholder="Azure app secret"
                    value={settings.azure.clientSecret}
                    onChange={e => setSettings(s => ({ ...s, azure: { ...s.azure, clientSecret: e.target.value } }))} />
                  <button onClick={() => toggleShow('azureSecret')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showSecrets.azureSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Mail From (User Principal Name)</label>
                <input type="email" className={inputCls} placeholder="noreply@company.com"
                  value={settings.azure.mailFrom} onChange={e => setSettings(s => ({ ...s, azure: { ...s.azure, mailFrom: e.target.value } }))} />
              </div>
            </div>
          </div>

          {/* SMTP Config */}
          <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <Server size={16} className="text-amber-500" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white">SMTP Configuration</h3>
              <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded">
                {settings.provider === 'smtp' ? 'ACTIVE' : 'FALLBACK'}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>SMTP Host</label>
                <input type="text" className={inputCls}
                  value={settings.smtp.host} onChange={e => setSettings(s => ({ ...s, smtp: { ...s.smtp, host: e.target.value } }))} />
              </div>
              <div>
                <label className={labelCls}>Port</label>
                <input type="number" className={inputCls}
                  value={settings.smtp.port} onChange={e => setSettings(s => ({ ...s, smtp: { ...s.smtp, port: parseInt(e.target.value) || 587 } }))} />
              </div>
              <div>
                <label className={labelCls}>Username</label>
                <input type="text" className={inputCls} placeholder="user@company.com"
                  value={settings.smtp.user} onChange={e => setSettings(s => ({ ...s, smtp: { ...s.smtp, user: e.target.value } }))} />
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <div className="relative">
                  <input type={showSecrets.smtpPass ? 'text' : 'password'} className={`${inputCls} pr-10`}
                    value={settings.smtp.pass}
                    onChange={e => setSettings(s => ({ ...s, smtp: { ...s.smtp, pass: e.target.value } }))} />
                  <button onClick={() => toggleShow('smtpPass')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showSecrets.smtpPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>From Address</label>
                <input type="email" className={inputCls} placeholder="noreply@company.com"
                  value={settings.smtp.from} onChange={e => setSettings(s => ({ ...s, smtp: { ...s.smtp, from: e.target.value } }))} />
              </div>
            </div>
          </div>

          {/* Notification Triggers */}
          <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-4">
              <Bell size={16} className="text-violet-500" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white">การแจ้งเตือนอัตโนมัติ</h3>
            </div>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 cursor-pointer">
                <span className="text-sm text-slate-700 dark:text-slate-200">📥 แจ้งเมื่อมีตู้ Gate-In / Gate-Out</span>
                <input type="checkbox" className="w-4 h-4 accent-blue-500" checked={settings.notifyGate}
                  onChange={e => setSettings(s => ({ ...s, notifyGate: e.target.checked }))} />
              </label>
              <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 cursor-pointer">
                <span className="text-sm text-slate-700 dark:text-slate-200">💰 แจ้งเมื่อมีการชำระเงิน</span>
                <input type="checkbox" className="w-4 h-4 accent-blue-500" checked={settings.notifyPayment}
                  onChange={e => setSettings(s => ({ ...s, notifyPayment: e.target.checked }))} />
              </label>
              <div>
                <label className={labelCls}>Email ปลายทาง (คั่นด้วย ,)</label>
                <input type="text" className={inputCls} placeholder="admin@company.com, manager@company.com"
                  value={settings.notifyTo} onChange={e => setSettings(s => ({ ...s, notifyTo: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Test Email */}
          <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">🧪 ทดสอบส่ง Email</h3>
            <div className="flex gap-3">
              <input type="email" className={`${inputCls} flex-1`} placeholder="test@company.com"
                value={testEmail} onChange={e => setTestEmail(e.target.value)} />
              <button onClick={handleTestEmail} disabled={testing || !testEmail}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors">
                {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                ส่ง Test
              </button>
            </div>
            {testResult && (
              <div className={`mt-3 flex items-center gap-2 p-3 rounded-lg text-sm ${
                testResult.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}>
                {testResult.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
                {testResult.message}
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              บันทึกการตั้งค่า
            </button>
          </div>
        </>
      )}
    </div>
  );
}
