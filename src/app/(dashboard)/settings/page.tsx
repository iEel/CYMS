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
  ShieldCheck,
  Lock,
  TrendingUp,
  Layers,
  Truck,
  Link,
} from 'lucide-react';
import CompanySettings from './CompanySettings';
import YardsSettings from './YardsSettings';
import UsersSettings from './UsersSettings';
import CustomerMaster from './CustomerMaster';
import ApprovalHierarchy from './ApprovalHierarchy';
import EDIConfiguration from './EDIConfiguration';
import SealMaster from './SealMaster';
import TieredStorageRate from './TieredStorageRate';
import AutoAllocationRules from './AutoAllocationRules';
import EquipmentRulesConfig from './EquipmentRulesConfig';
import PrefixMapping from './PrefixMapping';

const tabs = [
  { id: 'company', label: 'องค์กร', icon: <Building2 size={18} />, color: '#3B82F6' },
  { id: 'yards', label: 'ลาน/โซน', icon: <MapPin size={18} />, color: '#10B981' },
  { id: 'users', label: 'ผู้ใช้/สิทธิ์', icon: <Users size={18} />, color: '#8B5CF6' },
  { id: 'customers', label: 'ลูกค้า', icon: <Receipt size={18} />, color: '#EC4899' },
  { id: 'approval', label: 'อนุมัติ', icon: <ShieldCheck size={18} />, color: '#F59E0B' },
  { id: 'edi', label: 'EDI', icon: <Globe size={18} />, color: '#0EA5E9' },
  { id: 'seal', label: 'ซีล', icon: <Lock size={18} />, color: '#EF4444' },
  { id: 'storage', label: 'ค่าฝาก', icon: <TrendingUp size={18} />, color: '#06B6D4' },
  { id: 'allocation', label: 'จัดตู้', icon: <Layers size={18} />, color: '#10B981' },
  { id: 'equipment', label: 'เครื่องจักร', icon: <Truck size={18} />, color: '#F97316' },
  { id: 'prefix', label: 'Prefix', icon: <Link size={18} />, color: '#06B6D4' },
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
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200
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
        {activeTab === 'customers' && <CustomerMaster />}
        {activeTab === 'approval' && <ApprovalHierarchy />}
        {activeTab === 'edi' && <EDIConfiguration />}
        {activeTab === 'seal' && <SealMaster />}
        {activeTab === 'storage' && <TieredStorageRate />}
        {activeTab === 'allocation' && <AutoAllocationRules />}
        {activeTab === 'equipment' && <EquipmentRulesConfig />}
        {activeTab === 'prefix' && <PrefixMapping />}
      </div>
    </div>
  );
}

