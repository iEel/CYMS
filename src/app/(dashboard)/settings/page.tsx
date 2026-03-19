'use client';

import { useState } from 'react';
import {
  Building2,
  Users,
  MapPin,
  Globe,
  Wrench,
  Receipt,
  Cog,
} from 'lucide-react';
import CompanySettings from './CompanySettings';
import YardsSettings from './YardsSettings';
import UsersSettings from './UsersSettings';

const tabs = [
  { id: 'company', label: 'ข้อมูลองค์กร', icon: <Building2 size={18} />, color: '#3B82F6' },
  { id: 'yards', label: 'สาขาลานและโซน', icon: <MapPin size={18} />, color: '#10B981' },
  { id: 'users', label: 'ผู้ใช้งานและสิทธิ์', icon: <Users size={18} />, color: '#8B5CF6' },
  { id: 'customers', label: 'ลูกค้าและ EDI', icon: <Globe size={18} />, color: '#F59E0B' },
  { id: 'mnr', label: 'ซ่อมบำรุง', icon: <Wrench size={18} />, color: '#EF4444' },
  { id: 'billing', label: 'บัญชีการเงิน', icon: <Receipt size={18} />, color: '#0EA5E9' },
  { id: 'automation', label: 'กฎอัตโนมัติ', icon: <Cog size={18} />, color: '#64748B' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('company');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">⚙️ ตั้งค่าระบบ</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          ศูนย์บัญชาการระบบ CYMS — กำหนดโครงสร้าง กฎเกณฑ์ และความปลอดภัย
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-1.5 flex gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200
              ${activeTab === tab.id
                ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }
            `}
          >
            <span style={{ color: activeTab === tab.id ? tab.color : undefined }}>
              {tab.icon}
            </span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="page-enter">
        {activeTab === 'company' && <CompanySettings />}
        {activeTab === 'yards' && <YardsSettings />}
        {activeTab === 'users' && <UsersSettings />}
        {activeTab === 'customers' && <ComingSoon title="ลูกค้าและ EDI" phase={6} />}
        {activeTab === 'mnr' && <ComingSoon title="มาตรฐานซ่อมบำรุง" phase={7} />}
        {activeTab === 'billing' && <ComingSoon title="บัญชีและการเงิน" phase={8} />}
        {activeTab === 'automation' && <ComingSoon title="กฎการทำงานอัตโนมัติ" phase={9} />}
      </div>
    </div>
  );
}

function ComingSoon({ title, phase }: { title: string; phase: number }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4">
        <Cog size={28} className="text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-2">{title}</h3>
      <p className="text-sm text-slate-400">จะเปิดใช้งานในเฟส {phase} — เร็วๆ นี้</p>
    </div>
  );
}
