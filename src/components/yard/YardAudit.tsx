'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ClipboardCheck, CheckCircle2, AlertTriangle, XCircle, MapPin, Loader2, RotateCcw,
  Pencil, Save, X, ArrowLeftRight, Upload, History, ChevronDown,
} from 'lucide-react';

interface AuditContainer {
  container_id: number;
  container_number: string;
  size: string;
  type: string;
  bay: number;
  row: number;
  tier: number;
  shipping_line: string;
  zone_name: string;
  status?: string;
}

interface ZoneOption {
  zone_id: number;
  zone_name: string;
  zone_type: string;
  container_count: number;
}

interface AuditLogEntry {
  log_id: number;
  action: string;
  entity_type: string;
  details: string;
  created_at: string;
  full_name?: string;
  username?: string;
}

interface Props {
  yardId: number;
  zones: ZoneOption[];
}

export default function YardAudit({ yardId, zones }: Props) {
  const [selectedZone, setSelectedZone] = useState<number>(0);
  const [containers, setContainers] = useState<AuditContainer[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [auditActive, setAuditActive] = useState(false);
  const [results, setResults] = useState<{ matched: number; total: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<string | null>(null);

  // Manual override state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ bay: 0, row: 0, tier: 0 });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Conflict modal state
  const [conflict, setConflict] = useState<{
    targetContainer: AuditContainer;
    existingContainer: { container_id: number; container_number: string };
    newPosition: { bay: number; row: number; tier: number };
  } | null>(null);

  // Audit log state
  const [showHistory, setShowHistory] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchContainers = useCallback(async (zoneId: number) => {
    if (!zoneId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/yard/audit?zone_id=${zoneId}&yard_id=${yardId}`);
      const data = await res.json();
      setContainers(data.containers || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [yardId]);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/yard/audit-log?yard_id=${yardId}&entity_type=container_move&limit=30`);
      const data = await res.json();
      setAuditLogs(data.logs || []);
    } catch (err) { console.error(err); }
    finally { setLogsLoading(false); }
  }, [yardId]);

  const startAudit = () => {
    setAuditActive(true);
    setCheckedIds(new Set());
    setResults(null);
    setSubmitResult(null);
    fetchContainers(selectedZone);
  };

  const toggleCheck = (id: number) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const checkAll = () => {
    setCheckedIds(new Set(containers.map(c => c.container_id)));
  };

  // B4: ส่งผลตรวจนับจริง → POST API
  const finishAudit = async () => {
    const total = containers.length;
    const matched = checkedIds.size;
    setResults({ matched, total });

    // Submit to API
    setSubmitting(true);
    try {
      const auditedContainers = containers.map(c => ({
        container_number: c.container_number,
        bay: c.bay,
        row: c.row,
        tier: c.tier,
        found: checkedIds.has(c.container_id),
      }));

      const res = await fetch('/api/yard/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zone_id: selectedZone,
          yard_id: yardId,
          audited_containers: auditedContainers,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitResult(`✅ บันทึกผลตรวจนับสำเร็จ — ตรง ${data.results.matched} | ผิด ${data.results.misplaced} | ไม่พบ ${data.not_found_count}`);
        // Log the audit
        await fetch('/api/yard/audit-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            yard_id: yardId,
            action: 'yard_audit',
            entity_type: 'yard_audit',
            entity_id: selectedZone,
            details: JSON.stringify({ zone_id: selectedZone, matched, total, not_found: total - matched }),
          }),
        });
      } else {
        setSubmitResult('❌ ไม่สามารถบันทึกผลได้');
      }
    } catch (err) {
      console.error(err);
      setSubmitResult('❌ เกิดข้อผิดพลาด');
    }
    finally { setSubmitting(false); }
    setAuditActive(false);
  };

  // B1: Manual Override — เริ่มแก้ไขพิกัด
  const startEdit = (c: AuditContainer) => {
    setEditingId(c.container_id);
    setEditForm({ bay: c.bay, row: c.row, tier: c.tier });
    setEditError(null);
  };

  // B2: ตรวจ conflict + save
  const savePosition = async (c: AuditContainer) => {
    setEditSaving(true);
    setEditError(null);

    try {
      // ตรวจว่ามีตู้อื่นที่ตำแหน่งนี้ไหม
      const zone = zones.find(z => z.zone_id === selectedZone);
      const checkRes = await fetch(
        `/api/containers?yard_id=${yardId}&zone_id=${selectedZone}&bay=${editForm.bay}&row=${editForm.row}&tier=${editForm.tier}&check_position=1`
      );
      const existing = await checkRes.json();

      // ถ้ามีตู้อื่นที่ตำแหน่งเดียวกัน (ไม่ใช่ตู้เดียวกัน)
      if (existing.conflict && existing.conflict.container_id !== c.container_id) {
        setConflict({
          targetContainer: c,
          existingContainer: existing.conflict,
          newPosition: { ...editForm },
        });
        setEditSaving(false);
        return;
      }

      // ไม่มี conflict → save ตรง
      await doSavePosition(c.container_id, editForm.bay, editForm.row, editForm.tier, c);
    } catch (err) {
      console.error(err);
      setEditError('เกิดข้อผิดพลาด');
    }
    finally { setEditSaving(false); }
  };

  const doSavePosition = async (containerId: number, bay: number, row: number, tier: number, originalContainer: AuditContainer) => {
    const res = await fetch('/api/containers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        container_id: containerId,
        bay, row, tier,
        status: originalContainer.status || 'in_yard',
        yard_id: yardId,
        zone_id: selectedZone,
      }),
    });
    const data = await res.json();
    if (data.success) {
      // Log the change
      await fetch('/api/yard/audit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yard_id: yardId,
          action: 'container_move',
          entity_type: 'container_move',
          entity_id: containerId,
          details: JSON.stringify({
            container_number: originalContainer.container_number,
            from: { bay: originalContainer.bay, row: originalContainer.row, tier: originalContainer.tier },
            to: { bay, row, tier },
          }),
        }),
      });

      // Update local state
      setContainers(prev => prev.map(ct =>
        ct.container_id === containerId ? { ...ct, bay, row, tier } : ct
      ));
      setEditingId(null);
    } else {
      setEditError(data.error || 'ไม่สามารถบันทึกได้');
    }
  };

  // B2: Swap — สลับพิกัดกับตู้เดิม
  const handleSwap = async () => {
    if (!conflict) return;
    setEditSaving(true);
    try {
      const { targetContainer, existingContainer, newPosition } = conflict;

      // 1. ย้ายตู้เดิม → ตำแหน่งของตู้ target
      await fetch('/api/containers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          container_id: existingContainer.container_id,
          bay: targetContainer.bay,
          row: targetContainer.row,
          tier: targetContainer.tier,
          status: 'in_yard',
          yard_id: yardId,
          zone_id: selectedZone,
        }),
      });

      // 2. ย้ายตู้ target → ตำแหน่งใหม่
      await doSavePosition(targetContainer.container_id, newPosition.bay, newPosition.row, newPosition.tier, targetContainer);

      // Log swap
      await fetch('/api/yard/audit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yard_id: yardId,
          action: 'container_swap',
          entity_type: 'container_move',
          entity_id: targetContainer.container_id,
          details: JSON.stringify({
            swapped: [
              { container: targetContainer.container_number, from: { bay: targetContainer.bay, row: targetContainer.row, tier: targetContainer.tier }, to: newPosition },
              { container: existingContainer.container_number, from: newPosition, to: { bay: targetContainer.bay, row: targetContainer.row, tier: targetContainer.tier } },
            ],
          }),
        }),
      });

      // Update local
      setContainers(prev => prev.map(ct => {
        if (ct.container_id === existingContainer.container_id) {
          return { ...ct, bay: targetContainer.bay, row: targetContainer.row, tier: targetContainer.tier };
        }
        return ct;
      }));

      setConflict(null);
    } catch (err) { console.error(err); setEditError('Swap ล้มเหลว'); }
    finally { setEditSaving(false); }
  };

  // B2: Float — ยกตู้เดิมออก (unplaced)
  const handleFloat = async () => {
    if (!conflict) return;
    setEditSaving(true);
    try {
      const { targetContainer, existingContainer, newPosition } = conflict;

      // 1. ยกตู้เดิมออก (set bay/row/tier = null)
      await fetch('/api/containers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          container_id: existingContainer.container_id,
          bay: null, row: null, tier: null,
          status: 'in_yard',
          yard_id: yardId,
          zone_id: selectedZone,
        }),
      });

      // 2. ย้ายตู้ target → ตำแหน่งใหม่
      await doSavePosition(targetContainer.container_id, newPosition.bay, newPosition.row, newPosition.tier, targetContainer);

      // Log float
      await fetch('/api/yard/audit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yard_id: yardId,
          action: 'container_float',
          entity_type: 'container_move',
          entity_id: existingContainer.container_id,
          details: JSON.stringify({
            floated_container: existingContainer.container_number,
            reason: `ถูกแทนที่โดย ${targetContainer.container_number}`,
          }),
        }),
      });

      setConflict(null);
    } catch (err) { console.error(err); setEditError('Float ล้มเหลว'); }
    finally { setEditSaving(false); }
  };

  // Group by bay
  const grouped = containers.reduce((acc, c) => {
    if (!acc[c.bay]) acc[c.bay] = [];
    acc[c.bay].push(c);
    return acc;
  }, {} as Record<number, AuditContainer[]>);

  return (
    <div className="space-y-4">
      {/* Conflict Modal (Swap/Float) */}
      {conflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-white">ตู้ซ้อนทับ!</h3>
                <p className="text-xs text-slate-400">ตำแหน่ง B{conflict.newPosition.bay}-R{conflict.newPosition.row}-T{conflict.newPosition.tier} มีตู้ <span className="font-mono font-bold text-slate-600 dark:text-slate-300">{conflict.existingContainer.container_number}</span> อยู่แล้ว</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/30 rounded-xl p-4 mb-4 text-sm">
              <p className="text-slate-500 dark:text-slate-400">
                ต้องการย้าย <span className="font-mono font-bold text-slate-800 dark:text-white">{conflict.targetContainer.container_number}</span> ไปยัง B{conflict.newPosition.bay}-R{conflict.newPosition.row}-T{conflict.newPosition.tier}
              </p>
            </div>

            <div className="space-y-2">
              <button onClick={handleSwap} disabled={editSaving}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left">
                <ArrowLeftRight size={18} className="text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-white">Swap สลับพิกัด</p>
                  <p className="text-xs text-slate-400">สลับตำแหน่ง 2 ตู้กัน</p>
                </div>
              </button>

              <button onClick={handleFloat} disabled={editSaving}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors text-left">
                <Upload size={18} className="text-amber-500" />
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-white">Float ยกออก</p>
                  <p className="text-xs text-slate-400">ยก {conflict.existingContainer.container_number} ออกเป็น &quot;ไม่มีพิกัด&quot;</p>
                </div>
              </button>
            </div>

            <button onClick={() => setConflict(null)}
              className="mt-3 w-full p-2 text-center text-sm text-slate-400 hover:text-slate-600 transition-colors">
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-white">ตรวจนับตู้ / แก้ไขพิกัด (Yard Audit & Override)</h3>
              <p className="text-xs text-slate-400">เลือกโซน แล้วเริ่มตรวจนับ — กดเช็กตู้ที่พบจริงในลาน หรือแก้ไขพิกัดตู้ที่ผิดตำแหน่ง</p>
            </div>
          </div>
          <button
            onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchLogs(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
          >
            <History size={14} /> ประวัติ
          </button>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(parseInt(e.target.value))}
            className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700
              text-sm text-slate-800 dark:text-white outline-none focus:border-indigo-500"
          >
            <option value={0}>— เลือกโซน —</option>
            {zones.map(z => (
              <option key={z.zone_id} value={z.zone_id}>Zone {z.zone_name} ({z.container_count} ตู้)</option>
            ))}
          </select>

          {!auditActive ? (
            <button onClick={startAudit} disabled={!selectedZone}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium
                hover:bg-indigo-700 disabled:opacity-50 transition-all">
              <ClipboardCheck size={16} /> เริ่มตรวจนับ
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={checkAll}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20
                  text-emerald-600 text-xs font-medium hover:bg-emerald-100 transition-all">
                <CheckCircle2 size={14} /> เช็กทั้งหมด
              </button>
              <button onClick={() => { setAuditActive(false); setResults(null); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-700
                  text-slate-500 text-xs font-medium hover:bg-slate-200 transition-all">
                <RotateCcw size={14} /> ยกเลิก
              </button>
              <button onClick={finishAudit} disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium
                  hover:bg-blue-700 disabled:opacity-50 transition-all">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                สรุปผล + บันทึก ({checkedIds.size}/{containers.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {results && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h4 className="font-semibold text-slate-800 dark:text-white mb-3">📊 ผลตรวจนับ</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
              <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-1" />
              <p className="text-2xl font-bold text-emerald-600">{results.matched}</p>
              <p className="text-xs text-slate-400">พบตรงตำแหน่ง</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20">
              <AlertTriangle size={24} className="mx-auto text-amber-500 mb-1" />
              <p className="text-2xl font-bold text-amber-600">{results.total - results.matched}</p>
              <p className="text-xs text-slate-400">ไม่พบ / ผิดตำแหน่ง</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
              <ClipboardCheck size={24} className="mx-auto text-blue-500 mb-1" />
              <p className="text-2xl font-bold text-blue-600">{results.total > 0 ? ((results.matched / results.total) * 100).toFixed(1) : '0'}%</p>
              <p className="text-xs text-slate-400">ความแม่นยำ</p>
            </div>
          </div>
          {submitResult && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${
              submitResult.startsWith('✅') ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400'
            }`}>
              {submitResult}
            </div>
          )}
        </div>
      )}

      {/* Container Checklist */}
      {auditActive && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 size={24} className="animate-spin mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-400">กำลังโหลดข้อมูลตู้...</p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              {Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b)).map(([bay, ctrs]) => (
                <div key={bay}>
                  <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/50 text-xs font-semibold text-slate-500 uppercase sticky top-0 z-10">
                    Bay {bay} — {ctrs.length} ตู้
                  </div>
                  {ctrs.sort((a, b) => a.row - b.row || a.tier - b.tier).map(c => {
                    const checked = checkedIds.has(c.container_id);
                    const isEditing = editingId === c.container_id;
                    return (
                      <div key={c.container_id}
                        className={`px-4 py-2.5 flex items-center gap-3 transition-colors
                          ${checked ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}
                          border-b border-slate-100 dark:border-slate-700/50`}>
                        {/* Checkbox */}
                        <button onClick={() => toggleCheck(c.container_id)}
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0
                            ${checked ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                          {checked && <CheckCircle2 size={14} className="text-white" />}
                        </button>

                        {/* Container info */}
                        <div className="flex-1 min-w-0">
                          <span className={`font-mono text-sm font-semibold ${checked ? 'text-emerald-600 line-through' : 'text-slate-800 dark:text-white'}`}>
                            {c.container_number}
                          </span>
                          <span className="text-xs text-slate-400 ml-2">{c.size}&apos;{c.type}</span>
                        </div>

                        {/* Position display or edit form */}
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input type="number" value={editForm.bay} onChange={e => setEditForm({ ...editForm, bay: parseInt(e.target.value) || 0 })}
                              className="w-14 h-7 px-1.5 rounded border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-700 text-xs font-mono text-center outline-none" placeholder="Bay" />
                            <input type="number" value={editForm.row} onChange={e => setEditForm({ ...editForm, row: parseInt(e.target.value) || 0 })}
                              className="w-14 h-7 px-1.5 rounded border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-700 text-xs font-mono text-center outline-none" placeholder="Row" />
                            <input type="number" value={editForm.tier} onChange={e => setEditForm({ ...editForm, tier: parseInt(e.target.value) || 0 })}
                              className="w-14 h-7 px-1.5 rounded border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-700 text-xs font-mono text-center outline-none" placeholder="Tier" />
                            <button onClick={() => savePosition(c)} disabled={editSaving}
                              className="w-7 h-7 rounded bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 disabled:opacity-50">
                              {editSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                            </button>
                            <button onClick={() => { setEditingId(null); setEditError(null); }}
                              className="w-7 h-7 rounded bg-slate-200 dark:bg-slate-600 text-slate-500 flex items-center justify-center hover:bg-slate-300">
                              <X size={12} />
                            </button>
                            {editError && <span className="text-[10px] text-rose-500">{editError}</span>}
                          </div>
                        ) : (
                          <>
                            <span className="font-mono text-xs text-slate-400 flex items-center gap-1">
                              <MapPin size={10} /> R{c.row}-T{c.tier}
                            </span>
                            <span className="text-xs text-slate-400">{c.shipping_line}</span>
                            <button onClick={() => startEdit(c)}
                              className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-500 dark:hover:bg-indigo-900/20 transition-colors"
                              title="แก้ไขพิกัด">
                              <Pencil size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Audit Log History */}
      {showHistory && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <History size={16} /> ประวัติการแก้ไขพิกัด
            </h4>
            <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>
          {logsLoading ? (
            <div className="p-6 text-center">
              <Loader2 size={20} className="animate-spin mx-auto text-slate-400" />
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400">ยังไม่มีประวัติ</div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50 text-left text-xs text-slate-500 uppercase">
                    <th className="px-4 py-2">วันที่</th>
                    <th className="px-4 py-2">ผู้ดำเนินการ</th>
                    <th className="px-4 py-2">การกระทำ</th>
                    <th className="px-4 py-2">รายละเอียด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {auditLogs.map(log => {
                    let detailText = '';
                    try {
                      const d = JSON.parse(log.details);
                      if (d.from && d.to) {
                        detailText = `${d.container_number || ''} : B${d.from.bay}-R${d.from.row}-T${d.from.tier} → B${d.to.bay}-R${d.to.row}-T${d.to.tier}`;
                      } else if (d.matched !== undefined) {
                        detailText = `ตรง ${d.matched}/${d.total} ตู้`;
                      } else {
                        detailText = log.details;
                      }
                    } catch { detailText = log.details; }

                    const actionLabel = log.action === 'container_move' ? 'ย้ายตู้' :
                      log.action === 'container_swap' ? 'สลับตู้' :
                      log.action === 'container_float' ? 'Float ตู้' :
                      log.action === 'yard_audit' ? 'ตรวจนับ' : log.action;

                    return (
                      <tr key={log.log_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="px-4 py-2 text-xs text-slate-400">
                          {new Date(log.created_at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300">{log.full_name || log.username || 'ระบบ'}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${
                            log.action === 'container_swap' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                            log.action === 'container_float' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                            log.action === 'yard_audit' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' :
                            'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                          }`}>
                            {actionLabel}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-500 font-mono">{detailText}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
