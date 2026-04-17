'use client';

import { useState } from 'react';
import {
  Building2,
  Users,
  MapPin,
  Globe,
  Receipt,
  Lock,
  TrendingUp,
  Layers,
  Link,
  Shield,
  Mail,
  Image as ImageIcon,
  FileText,
  ClipboardList,
} from 'lucide-react';
import CompanySettings from './CompanySettings';
import YardsSettings from './YardsSettings';
import UsersSettings from './UsersSettings';
import CustomerMaster from './CustomerMaster';
import EDIConfiguration from './EDIConfiguration';
import TieredStorageRate from './TieredStorageRate';
import AutoAllocationRules from './AutoAllocationRules';
import PrefixMapping from './PrefixMapping';
import RateLimitSettings from './RateLimitSettings';
import EmailSettingsTab from './EmailSettings';
import PhotoRetentionSettings from './PhotoRetentionSettings';
import SecuritySettings from './SecuritySettings';
import DocumentNumberSettings from './DocumentNumberSettings';
import SystemStandardsOverview from './SystemStandardsOverview';
import { useAuth } from '@/components/providers/AuthProvider';

const tabs = [
  { id: 'company', label: 'องค์กร', icon: <Building2 size={18} />, color: '#3B82F6', permission: 'settings.manage' },
  { id: 'yards', label: 'ลาน/โซน', icon: <MapPin size={18} />, color: '#10B981', permission: 'settings.manage' },
  { id: 'users', label: 'ผู้ใช้/สิทธิ์', icon: <Users size={18} />, color: '#8B5CF6', permission: 'permissions.manage' },
  { id: 'customers', label: 'ลูกค้า', icon: <Receipt size={18} />, color: '#EC4899', permission: 'settings.manage' },
  { id: 'edi', label: 'EDI', icon: <Globe size={18} />, color: '#0EA5E9', permission: 'settings.manage' },
  { id: 'storage', label: 'ค่าฝาก', icon: <TrendingUp size={18} />, color: '#06B6D4', permission: 'settings.manage' },
  { id: 'allocation', label: 'จัดตู้', icon: <Layers size={18} />, color: '#10B981', permission: 'settings.manage' },
  { id: 'prefix', label: 'Prefix', icon: <Link size={18} />, color: '#06B6D4', permission: 'settings.manage' },
  { id: 'documents', label: 'เลขเอกสาร', icon: <FileText size={18} />, color: '#3B82F6', permission: 'settings.manage' },
  { id: 'standards', label: 'มาตรฐานระบบ', icon: <ClipboardList size={18} />, color: '#10B981', permission: 'settings.manage' },
  { id: 'ratelimit', label: 'Rate Limit', icon: <Shield size={18} />, color: '#F59E0B', permission: 'settings.manage' },
  { id: 'security', label: 'ความปลอดภัย', icon: <Lock size={18} />, color: '#EF4444', permission: 'settings.manage' },
  { id: 'email', label: 'Email', icon: <Mail size={18} />, color: '#3B82F6', permission: 'settings.manage' },
  { id: 'photos', label: 'รูปภาพ', icon: <ImageIcon size={18} />, color: '#6366F1', permission: 'settings.manage' },
];

export default function SettingsPage() {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('company');
  const visibleTabs = tabs.filter(tab => hasPermission(tab.permission));
  const effectiveTab = visibleTabs.some(tab => tab.id === activeTab) ? activeTab : visibleTabs[0]?.id || '';

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
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200
              ${effectiveTab === tab.id
                ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }
            `}
          >
            <span style={{ color: effectiveTab === tab.id ? tab.color : undefined }}>
              {tab.icon}
            </span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {visibleTabs.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
          คุณไม่มีสิทธิ์ตั้งค่าระบบใน Granular RBAC
        </div>
      ) : (
      <div className="page-enter">
        {effectiveTab === 'company' && <CompanySettings />}
        {effectiveTab === 'yards' && <YardsSettings />}
        {effectiveTab === 'users' && <UsersSettings />}
        {effectiveTab === 'customers' && <CustomerMaster />}
        {effectiveTab === 'edi' && <EDIConfiguration />}
        {effectiveTab === 'storage' && <TieredStorageRate />}
        {effectiveTab === 'allocation' && <AutoAllocationRules />}
        {effectiveTab === 'prefix' && <PrefixMapping />}
        {effectiveTab === 'documents' && <DocumentNumberSettings />}
        {effectiveTab === 'standards' && <SystemStandardsOverview />}
        {effectiveTab === 'ratelimit' && <RateLimitSettings />}
        {effectiveTab === 'security' && <SecuritySettings />}
        {effectiveTab === 'email' && <EmailSettingsTab />}
        {effectiveTab === 'photos' && <PhotoRetentionSettings />}
      </div>
      )}
    </div>
  );
}
