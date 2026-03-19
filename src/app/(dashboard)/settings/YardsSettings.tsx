'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Plus, Pencil, Layers, ChevronDown, ChevronUp, Save, Loader2, X, Trash2 } from 'lucide-react';

interface Yard {
  yard_id: number;
  yard_name: string;
  yard_code: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  geofence_radius: number;
  is_active: boolean;
  zone_count: number;
}

interface Zone {
  zone_id: number;
  yard_id: number;
  zone_name: string;
  zone_type: string;
  max_tier: number;
  max_bay: number;
  max_row: number;
  size_restriction: string;
  has_reefer_plugs: boolean;
  is_active: boolean;
}

const ZONE_TYPES = [
  { value: 'dry', label: 'ตู้แห้ง (Dry)' },
  { value: 'reefer', label: 'ตู้เย็น (Reefer)' },
  { value: 'hazmat', label: 'สารอันตราย (Hazmat)' },
  { value: 'empty', label: 'ตู้เปล่า (Empty)' },
  { value: 'repair', label: 'ซ่อมบำรุง (Repair)' },
  { value: 'wash', label: 'ล้างตู้ (Wash)' },
];

export default function YardsSettings() {
  const [yards, setYards] = useState<Yard[]>([]);
  const [zones, setZones] = useState<Record<number, Zone[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedYard, setExpandedYard] = useState<number | null>(null);
  const [showAddYard, setShowAddYard] = useState(false);
  const [showAddZone, setShowAddZone] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [yardForm, setYardForm] = useState({ yard_name: '', yard_code: '', address: '', geofence_radius: 500 });
  const [zoneForm, setZoneForm] = useState({ zone_name: '', zone_type: 'dry', max_tier: 5, max_bay: 20, max_row: 10, size_restriction: 'any', has_reefer_plugs: false });

  // Edit states
  const [editingYardId, setEditingYardId] = useState<number | null>(null);
  const [editYardForm, setEditYardForm] = useState({ yard_name: '', yard_code: '', address: '' });
  const [editingZoneId, setEditingZoneId] = useState<number | null>(null);
  const [editZoneForm, setEditZoneForm] = useState({ zone_name: '', zone_type: 'dry', max_tier: 5, max_bay: 20, max_row: 10, size_restriction: 'any', has_reefer_plugs: false });
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchYards = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/yards');
      const data = await res.json();
      setYards(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchYards(); }, [fetchYards]);

  const fetchZones = async (yardId: number) => {
    try {
      const res = await fetch(`/api/settings/zones?yard_id=${yardId}`);
      const data = await res.json();
      setZones(prev => ({ ...prev, [yardId]: data }));
    } catch (err) { console.error(err); }
  };

  const toggleExpand = (yardId: number) => {
    if (expandedYard === yardId) {
      setExpandedYard(null);
    } else {
      setExpandedYard(yardId);
      if (!zones[yardId]) fetchZones(yardId);
    }
  };

  const handleAddYard = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/yards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(yardForm),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddYard(false);
        setYardForm({ yard_name: '', yard_code: '', address: '', geofence_radius: 500 });
        fetchYards();
      }
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleAddZone = async (yardId: number) => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...zoneForm, yard_id: yardId }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddZone(null);
        setZoneForm({ zone_name: '', zone_type: 'dry', max_tier: 5, max_bay: 20, max_row: 10, size_restriction: 'any', has_reefer_plugs: false });
        fetchZones(yardId);
        fetchYards(); // อัปเดต zone_count
      }
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  // Edit Yard
  const handleEditYard = async (yardId: number) => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/yards', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yard_id: yardId, ...editYardForm }),
      });
      const json = await res.json();
      if (json.success) { setEditingYardId(null); fetchYards(); }
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  // Delete Yard
  const handleDeleteYard = async (yardId: number) => {
    if (!confirm('ต้องการลบลานนี้? (zone ทั้งหมดจะถูกลบด้วย)')) return;
    setDeleteError(null);
    try {
      const res = await fetch(`/api/settings/yards?yard_id=${yardId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) { fetchYards(); }
      else { setDeleteError(json.error); }
    } catch (err) { console.error(err); }
  };

  // Edit Zone
  const handleEditZone = async (zoneId: number) => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/zones', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: zoneId, ...editZoneForm }),
      });
      const json = await res.json();
      if (json.success) { setEditingZoneId(null); if (expandedYard) fetchZones(expandedYard); }
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  // Delete Zone
  const handleDeleteZone = async (zoneId: number, yardId: number) => {
    if (!confirm('ต้องการลบโซนนี้?')) return;
    setDeleteError(null);
    try {
      const res = await fetch(`/api/settings/zones?zone_id=${zoneId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) { fetchZones(yardId); fetchYards(); }
      else { setDeleteError(json.error); }
    } catch (err) { console.error(err); }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
        <div className="space-y-4">
          {[1,2].map(i => <div key={i} className="skeleton h-20 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-[#10B981]">
            <MapPin size={20} />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 dark:text-white">สาขาลานและโซน</h2>
            <p className="text-xs text-slate-400">จัดการสาขาลาน + Zone/Bay/Row/Tier</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddYard(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#10B981] text-white text-sm font-medium
            hover:bg-[#059669] active:scale-[0.98] transition-all shadow-sm"
        >
          <Plus size={16} /> เพิ่มสาขาลาน
        </button>
      </div>

      {/* Add Yard Form */}
      {showAddYard && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-[#10B981]/30 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 dark:text-white">เพิ่มสาขาลานใหม่</h3>
            <button onClick={() => setShowAddYard(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="text" placeholder="ชื่อสาขา *" value={yardForm.yard_name} onChange={e => setYardForm({...yardForm, yard_name: e.target.value})}
              className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-[#10B981]" />
            <input type="text" placeholder="รหัสลาน (เช่น YARD-03) *" value={yardForm.yard_code} onChange={e => setYardForm({...yardForm, yard_code: e.target.value})}
              className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white font-mono outline-none focus:border-[#10B981]" />
            <input type="text" placeholder="ที่อยู่" value={yardForm.address} onChange={e => setYardForm({...yardForm, address: e.target.value})}
              className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none focus:border-[#10B981]" />
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={handleAddYard} disabled={saving || !yardForm.yard_name || !yardForm.yard_code}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#10B981] text-white text-sm font-medium hover:bg-[#059669] disabled:opacity-50 transition-all">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              บันทึก
            </button>
          </div>
        </div>
      )}

      {/* Yards List */}
      {yards.map((yard) => (
        <div key={yard.yard_id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Yard Header */}
          <div onClick={() => toggleExpand(yard.yard_id)} role="button" tabIndex={0}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer">
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${yard.is_active ? 'bg-[#10B981]' : 'bg-slate-300'}`} />
              <div className="text-left">
                <h3 className="font-semibold text-slate-800 dark:text-white">{yard.yard_name}</h3>
                <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                  <span className="font-mono bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{yard.yard_code}</span>
                  {yard.address && <span>• {yard.address}</span>}
                  <span>• {yard.zone_count} โซน</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {editingYardId === yard.yard_id ? (
                <>
                  <input type="text" value={editYardForm.yard_name} onChange={e => setEditYardForm({...editYardForm, yard_name: e.target.value})}
                    className="h-8 px-2 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none w-32" placeholder="ชื่อ" />
                  <input type="text" value={editYardForm.yard_code} onChange={e => setEditYardForm({...editYardForm, yard_code: e.target.value})}
                    className="h-8 px-2 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-mono text-slate-800 dark:text-white outline-none w-24" placeholder="รหัส" />
                  <input type="text" value={editYardForm.address} onChange={e => setEditYardForm({...editYardForm, address: e.target.value})}
                    className="h-8 px-2 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white outline-none w-36" placeholder="ที่อยู่" />
                  <button onClick={() => handleEditYard(yard.yard_id)} disabled={saving}
                    className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 disabled:opacity-50">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  </button>
                  <button onClick={() => setEditingYardId(null)} className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-600 text-slate-400 flex items-center justify-center hover:bg-slate-300">
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={(e) => { e.stopPropagation(); setEditingYardId(yard.yard_id); setEditYardForm({ yard_name: yard.yard_name, yard_code: yard.yard_code, address: yard.address || '' }); }}
                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 flex items-center justify-center hover:bg-blue-50 hover:text-blue-500 transition-colors" title="แก้ไข">
                    <Pencil size={14} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteYard(yard.yard_id); }}
                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors" title="ลบ">
                    <Trash2 size={14} />
                  </button>
                  <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-lg">
                    {yard.zone_count} โซน
                  </span>
                  {expandedYard === yard.yard_id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </>
              )}
            </div>
          </div>

          {/* Expanded Zones */}
          {expandedYard === yard.yard_id && (
            <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 p-5">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <Layers size={16} /> โซนใน {yard.yard_name}
                </h4>
                <button onClick={() => setShowAddZone(yard.yard_id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3B82F6] text-white text-xs font-medium hover:bg-[#2563EB] transition-all">
                  <Plus size={14} /> เพิ่มโซน
                </button>
              </div>

              {/* Add Zone Form */}
              {showAddZone === yard.yard_id && (
                <div className="mb-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-blue-800">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <input type="text" placeholder="ชื่อโซน (เช่น A, B, R1) *" value={zoneForm.zone_name} onChange={e => setZoneForm({...zoneForm, zone_name: e.target.value})}
                      className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm outline-none text-slate-800 dark:text-white" />
                    <select value={zoneForm.zone_type} onChange={e => setZoneForm({...zoneForm, zone_type: e.target.value})}
                      className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm outline-none text-slate-800 dark:text-white">
                      {ZONE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <input type="number" placeholder="Max Tier" value={zoneForm.max_tier} onChange={e => setZoneForm({...zoneForm, max_tier: parseInt(e.target.value) || 5})}
                      className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm outline-none text-slate-800 dark:text-white" />
                    <input type="number" placeholder="Max Bay" value={zoneForm.max_bay} onChange={e => setZoneForm({...zoneForm, max_bay: parseInt(e.target.value) || 20})}
                      className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm outline-none text-slate-800 dark:text-white" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <input type="number" placeholder="Max Row" value={zoneForm.max_row} onChange={e => setZoneForm({...zoneForm, max_row: parseInt(e.target.value) || 10})}
                      className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm outline-none text-slate-800 dark:text-white" />
                    <select value={zoneForm.size_restriction} onChange={e => setZoneForm({...zoneForm, size_restriction: e.target.value})}
                      className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm outline-none text-slate-800 dark:text-white">
                      <option value="any">ทุกขนาด</option>
                      <option value="20">20 ฟุต เท่านั้น</option>
                      <option value="40">40 ฟุต เท่านั้น</option>
                      <option value="45">45 ฟุต เท่านั้น</option>
                    </select>
                    <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 col-span-2">
                      <input type="checkbox" checked={zoneForm.has_reefer_plugs} onChange={e => setZoneForm({...zoneForm, has_reefer_plugs: e.target.checked})}
                        className="w-4 h-4 rounded border-slate-300 text-[#3B82F6] focus:ring-blue-500" />
                      มีปลั๊กตู้เย็น (Reefer Plugs)
                    </label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowAddZone(null)}
                      className="px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">ยกเลิก</button>
                    <button onClick={() => handleAddZone(yard.yard_id)} disabled={saving || !zoneForm.zone_name}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#3B82F6] text-white text-sm font-medium hover:bg-[#2563EB] disabled:opacity-50 transition-all">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} บันทึกโซน
                    </button>
                  </div>
                </div>
              )}

              {/* Zones Table */}
              {zones[yard.yard_id] && zones[yard.yard_id].length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 uppercase">
                        <th className="pb-2 pr-4">โซน</th>
                        <th className="pb-2 pr-4">ประเภท</th>
                        <th className="pb-2 pr-4">พิกัด (Bay×Row×Tier)</th>
                        <th className="pb-2 pr-4">ขนาดตู้</th>
                        <th className="pb-2 pr-4">Reefer</th>
                        <th className="pb-2 pr-4">สถานะ</th>
                        <th className="pb-2">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {zones[yard.yard_id].map(zone => (
                        <tr key={zone.zone_id} className="hover:bg-white dark:hover:bg-slate-800 transition-colors">
                          <td className="py-2.5 pr-4 font-semibold text-slate-800 dark:text-white">{zone.zone_name}</td>
                          <td className="py-2.5 pr-4">
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium
                              ${zone.zone_type === 'dry' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                                zone.zone_type === 'reefer' ? 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400' :
                                zone.zone_type === 'hazmat' ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                                zone.zone_type === 'repair' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                                'bg-slate-50 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                              }`}>
                              {ZONE_TYPES.find(t => t.value === zone.zone_type)?.label || zone.zone_type}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 font-mono text-slate-600 dark:text-slate-300">
                            {zone.max_bay}×{zone.max_row}×{zone.max_tier}
                          </td>
                          <td className="py-2.5 pr-4 text-slate-500">{zone.size_restriction === 'any' ? 'ทุกขนาด' : `${zone.size_restriction} ฟุต`}</td>
                          <td className="py-2.5 pr-4">{zone.has_reefer_plugs ? '⚡' : '—'}</td>
                          <td className="py-2.5 pr-4">
                            <span className={`w-2 h-2 rounded-full inline-block ${zone.is_active ? 'bg-[#10B981]' : 'bg-slate-300'}`} />
                          </td>
                          <td className="py-2.5">
                            <div className="flex items-center gap-1">
                              <button onClick={() => { setEditingZoneId(zone.zone_id); setEditZoneForm({ zone_name: zone.zone_name, zone_type: zone.zone_type, max_tier: zone.max_tier, max_bay: zone.max_bay, max_row: zone.max_row, size_restriction: zone.size_restriction, has_reefer_plugs: zone.has_reefer_plugs }); }}
                                className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 text-slate-400 flex items-center justify-center hover:bg-blue-50 hover:text-blue-500 transition-colors" title="แก้ไข">
                                <Pencil size={10} />
                              </button>
                              <button onClick={() => handleDeleteZone(zone.zone_id, yard.yard_id)}
                                className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 text-slate-400 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors" title="ลบ">
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-6">ยังไม่มีโซนในลานนี้ — คลิก &quot;เพิ่มโซน&quot; เพื่อเริ่มตั้งค่าโครงสร้าง</p>
              )}
            </div>
          )}
        </div>
      ))}

      {yards.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <p className="text-slate-400">ยังไม่มีสาขาลาน — คลิก &quot;เพิ่มสาขาลาน&quot; เพื่อเริ่มต้น</p>
        </div>
      )}
    </div>
  );
}
