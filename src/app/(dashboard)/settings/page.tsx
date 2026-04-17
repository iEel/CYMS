'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  Building2,
  ChevronRight,
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
  Search,
  Star,
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
  { id: 'company', group: 'organization', label: 'องค์กร', description: 'ข้อมูลบริษัท ที่อยู่ และข้อมูลออกเอกสาร', keywords: 'บริษัท company organization tax address', icon: <Building2 size={18} />, color: '#3B82F6', permission: 'settings.manage' },
  { id: 'yards', group: 'organization', label: 'ลาน/โซน', description: 'ลาน สาขา โซน และพื้นที่จัดเก็บตู้', keywords: 'yard zone ลาน โซน สาขา', icon: <MapPin size={18} />, color: '#10B981', permission: 'settings.manage' },
  { id: 'users', group: 'organization', label: 'ผู้ใช้/สิทธิ์', description: 'ผู้ใช้งาน role และ granular RBAC', keywords: 'user permission role rbac สิทธิ์', icon: <Users size={18} />, color: '#8B5CF6', permission: 'permissions.manage' },
  { id: 'security', group: 'organization', label: 'ความปลอดภัย', description: 'นโยบาย login password และ session', keywords: 'security password login session ความปลอดภัย', icon: <Lock size={18} />, color: '#EF4444', permission: 'settings.manage' },
  { id: 'customers', group: 'customer_finance', label: 'ลูกค้า', description: 'ข้อมูลลูกค้า บทบาท สาขา และเครดิต', keywords: 'customer ลูกค้า credit วงเงิน สาขา', icon: <Receipt size={18} />, color: '#EC4899', permission: 'settings.manage' },
  { id: 'storage', group: 'customer_finance', label: 'ค่าฝาก', description: 'เรทค่าฝากแบบขั้นบันไดและแยกขนาดตู้', keywords: 'storage rate tariff ค่าฝาก เรท', icon: <TrendingUp size={18} />, color: '#06B6D4', permission: 'settings.manage' },
  { id: 'documents', group: 'customer_finance', label: 'เลขเอกสาร', description: 'เลข EIR, Invoice, Receipt, Credit Note และ EOR', keywords: 'document number eir invoice receipt credit note เลขเอกสาร', icon: <FileText size={18} />, color: '#3B82F6', permission: 'settings.manage' },
  { id: 'prefix', group: 'customer_finance', label: 'Prefix', description: 'จับคู่ BIC prefix กับลูกค้า/สายเรือ', keywords: 'prefix bic container code owner', icon: <Link size={18} />, color: '#06B6D4', permission: 'settings.manage' },
  { id: 'allocation', group: 'yard_operations', label: 'จัดตู้', description: 'กฎแนะนำตำแหน่งวางตู้ในลาน', keywords: 'allocation จัดตู้ วางตู้ zone rule', icon: <Layers size={18} />, color: '#10B981', permission: 'settings.manage' },
  { id: 'standards', group: 'yard_operations', label: 'มาตรฐานระบบ', description: 'สถานะกลาง data quality, SOP และ integration map', keywords: 'standard status sop data quality มาตรฐาน', icon: <ClipboardList size={18} />, color: '#10B981', permission: 'settings.manage' },
  { id: 'edi', group: 'integration', label: 'EDI', description: 'endpoint, template และ schedule สำหรับส่งสายเรือ', keywords: 'edi codeco endpoint template schedule', icon: <Globe size={18} />, color: '#0EA5E9', permission: 'settings.manage' },
  { id: 'email', group: 'integration', label: 'Email', description: 'SMTP และการแจ้งเตือนทางอีเมล', keywords: 'email smtp notification mail', icon: <Mail size={18} />, color: '#3B82F6', permission: 'settings.manage' },
  { id: 'ratelimit', group: 'integration', label: 'Rate Limit', description: 'จำกัด request สำหรับ login, API และ upload', keywords: 'rate limit api upload brute force', icon: <Shield size={18} />, color: '#F59E0B', permission: 'settings.manage' },
  { id: 'photos', group: 'integration', label: 'รูปภาพ', description: 'retention, cleanup policy และการดูแลหลักฐานรูปถ่าย', keywords: 'photo image evidence retention cleanup รูปภาพ รูปถ่าย ลบรูป', icon: <ImageIcon size={18} />, color: '#6366F1', permission: 'settings.manage' },
];

const groups = [
  {
    id: 'organization',
    label: 'องค์กร',
    description: 'โครงสร้างบริษัท ลาน ผู้ใช้งาน และความปลอดภัย',
    icon: <Building2 size={22} />,
    color: '#3B82F6',
  },
  {
    id: 'customer_finance',
    label: 'ลูกค้า & การเงิน',
    description: 'ลูกค้า เครดิต ค่าฝาก เลขเอกสาร และ prefix',
    icon: <Receipt size={22} />,
    color: '#EC4899',
  },
  {
    id: 'yard_operations',
    label: 'ปฏิบัติการลาน',
    description: 'กฎจัดตู้ รูป evidence และมาตรฐานการทำงาน',
    icon: <Layers size={22} />,
    color: '#10B981',
  },
  {
    id: 'integration',
    label: 'ระบบ & การเชื่อมต่อ',
    description: 'EDI, Email, Rate Limit และ policy ดูแลข้อมูลระบบ',
    icon: <Globe size={22} />,
    color: '#0EA5E9',
  },
];

const quickAccessIds = ['customers', 'users', 'storage', 'edi', 'documents'];

export default function SettingsPage() {
  const { hasPermission } = useAuth();
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('');
  const [search, setSearch] = useState('');
  const visibleTabs = tabs.filter(tab => hasPermission(tab.permission));
  const visibleGroups = groups
    .map(group => ({ ...group, items: visibleTabs.filter(tab => tab.group === group.id) }))
    .filter(group => group.items.length > 0);
  const fallbackTab = visibleGroups[0]?.items[0]?.id || '';
  const effectiveTab = visibleTabs.some(tab => tab.id === activeTab) ? activeTab : fallbackTab;
  const effectiveTabData = visibleTabs.find(tab => tab.id === effectiveTab);
  const selectedGroup = visibleGroups.find(group => group.id === (activeGroup || effectiveTabData?.group)) || visibleGroups[0];
  const normalizedSearch = search.trim().toLowerCase();
  const searchResults = normalizedSearch
    ? visibleTabs.filter(tab =>
      `${tab.label} ${tab.description} ${tab.keywords}`.toLowerCase().includes(normalizedSearch)
    )
    : [];
  const quickAccess = quickAccessIds
    .map(id => visibleTabs.find(tab => tab.id === id))
    .filter(Boolean) as typeof visibleTabs;

  const openTab = (tabId: string) => {
    const tab = visibleTabs.find(item => item.id === tabId);
    if (!tab) return;
    setActiveGroup(tab.group);
    setActiveTab(tab.id);
    setSearch('');
  };

  const openGroup = (groupId: string) => {
    const group = visibleGroups.find(item => item.id === groupId);
    setActiveGroup(groupId);
    setActiveTab(group?.items[0]?.id || '');
    setSearch('');
  };

  const showHub = !activeGroup && !normalizedSearch;

  const renderTabContent = () => (
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
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">⚙️ ตั้งค่าระบบ</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          ศูนย์บัญชาการระบบ CYMS — กำหนดโครงสร้าง กฎเกณฑ์ และความปลอดภัย
        </p>
      </div>

      {visibleTabs.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
          คุณไม่มีสิทธิ์ตั้งค่าระบบใน Granular RBAC
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ค้นหาเมนูตั้งค่า เช่น ลูกค้า, เลขเอกสาร, EDI, วงเงิน, รูปภาพ..."
                className="w-full h-11 pl-10 pr-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500"
              />
            </div>

            {normalizedSearch && (
              <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-700">
                {searchResults.length === 0 ? (
                  <p className="py-4 text-sm text-slate-400 text-center">ไม่พบเมนูที่ค้นหา</p>
                ) : searchResults.map(tab => (
                  <button key={tab.id} onClick={() => openTab(tab.id)}
                    className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40 rounded-lg px-2 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-50 dark:bg-slate-700" style={{ color: tab.color }}>
                        {tab.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{tab.label}</p>
                        <p className="text-xs text-slate-400 truncate">{tab.description}</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {showHub && (
            <div className="space-y-5">
              {quickAccess.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Star size={15} className="text-amber-500" />
                    <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">เมนูที่ใช้บ่อย</h2>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {quickAccess.map(tab => (
                      <button key={tab.id} onClick={() => openTab(tab.id)}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-left hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-50 dark:bg-slate-700 mb-3" style={{ color: tab.color }}>
                          {tab.icon}
                        </div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{tab.label}</p>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{tab.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">หมวดการตั้งค่า</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {visibleGroups.map(group => (
                    <button key={group.id} onClick={() => openGroup(group.id)}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 text-left hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-slate-50 dark:bg-slate-700" style={{ color: group.color }}>
                          {group.icon}
                        </div>
                        <span className="text-xs text-slate-400">{group.items.length} เมนู</span>
                      </div>
                      <h3 className="font-semibold text-slate-800 dark:text-white mt-4">{group.label}</h3>
                      <p className="text-xs text-slate-400 mt-1">{group.description}</p>
                      <div className="flex flex-wrap gap-1.5 mt-4">
                        {group.items.slice(0, 4).map(item => (
                          <span key={item.id} className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-[10px] text-slate-500 dark:text-slate-300">
                            {item.label}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!showHub && !normalizedSearch && selectedGroup && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => { setActiveGroup(null); setActiveTab(''); }}
                    className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-colors">
                    <ArrowLeft size={16} />
                  </button>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">ตั้งค่าระบบ / {selectedGroup.label}</p>
                    <h2 className="font-semibold text-slate-800 dark:text-white truncate">{effectiveTabData?.label || selectedGroup.label}</h2>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-1.5 flex gap-1 overflow-x-auto">
                {selectedGroup.items.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => openTab(tab.id)}
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

              {renderTabContent()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
