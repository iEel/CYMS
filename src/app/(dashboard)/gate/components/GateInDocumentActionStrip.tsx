'use client';

import type React from 'react';
import { CheckCircle2, Circle, FileText, Printer, ReceiptText } from 'lucide-react';

interface GateInDocumentActionStripProps {
  billingCleared: boolean;
  invoiceId: number | null;
  invoiceNumber: string;
  receiptPrintOpened: boolean;
  readyForEir: boolean;
  eirIssued: boolean;
  clearanceLabel: string;
  onPrintA4: () => void;
  onPrintContinuous: () => void;
}

function stepTone(done: boolean, active: boolean) {
  if (done) return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300';
  if (active) return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
  return 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-400';
}

function stepIcon(done: boolean, icon: React.ReactNode) {
  return done ? <CheckCircle2 size={14} /> : icon;
}

export default function GateInDocumentActionStrip({
  billingCleared,
  invoiceId,
  invoiceNumber,
  receiptPrintOpened,
  readyForEir,
  eirIssued,
  clearanceLabel,
  onPrintA4,
  onPrintContinuous,
}: GateInDocumentActionStripProps) {
  const receiptRequired = billingCleared && Boolean(invoiceId);
  const receiptDone = receiptRequired ? receiptPrintOpened : billingCleared;
  const receiptActive = receiptRequired && !receiptPrintOpened;
  const eirActive = readyForEir && receiptDone && !eirIssued;

  return (
    <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-white">งานเอกสารถัดไป</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">ต่อจาก Billing clearance ใน guided workflow เดิม</p>
        </div>
        {invoiceNumber ? (
          <span className="text-xs font-mono text-emerald-600 dark:text-emerald-300">{invoiceNumber}</span>
        ) : null}
      </div>

      <div className="grid gap-2 p-3 md:grid-cols-3">
        <div className={`rounded-lg border px-3 py-2 min-h-[72px] ${stepTone(billingCleared, !billingCleared)}`}>
          <div className="flex items-center gap-2 text-xs font-semibold">
            {stepIcon(billingCleared, <Circle size={14} />)}
            <span>Billing</span>
          </div>
          <p className="mt-1 text-[11px] leading-4 opacity-85">{billingCleared ? clearanceLabel : 'ชำระเงิน วางบิล หรืออนุมัติยกเว้นก่อน'}</p>
        </div>

        <div className={`rounded-lg border px-3 py-2 min-h-[72px] ${stepTone(receiptDone, receiptActive)}`}>
          <div className="flex items-center gap-2 text-xs font-semibold">
            {stepIcon(receiptDone, <ReceiptText size={14} />)}
            <span>ใบเสร็จ / ใบกำกับภาษี</span>
          </div>
          <p className="mt-1 text-[11px] leading-4 opacity-85">
            {!billingCleared ? 'รอ Billing clearance' : receiptRequired ? (receiptPrintOpened ? 'เปิดหน้าพิมพ์แล้ว กลับมาทำ Gate-In ต่อได้' : 'พร้อมพิมพ์ก่อนรับตู้') : 'รายการนี้ไม่ต้องพิมพ์ใบเสร็จ'}
          </p>
        </div>

        <div className={`rounded-lg border px-3 py-2 min-h-[72px] ${stepTone(eirIssued, eirActive)}`}>
          <div className="flex items-center gap-2 text-xs font-semibold">
            {stepIcon(eirIssued, <FileText size={14} />)}
            <span>EIR</span>
          </div>
          <p className="mt-1 text-[11px] leading-4 opacity-85">{eirIssued ? 'ออก EIR แล้ว' : eirActive ? 'พร้อมรับตู้เข้าลานและออก EIR' : 'รอหลักฐาน/เงื่อนไขให้ครบ'}</p>
        </div>
      </div>

      {receiptRequired ? (
        <div className="px-3 pb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onPrintA4}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors">
            <Printer size={15} />
            {receiptPrintOpened ? 'พิมพ์ใบเสร็จซ้ำ' : 'พิมพ์ใบเสร็จ'}
          </button>
          <button
            type="button"
            onClick={onPrintContinuous}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors dark:border-emerald-800 dark:bg-slate-800 dark:text-emerald-300 dark:hover:bg-emerald-900/20">
            <Printer size={15} />
            ฟอร์มต่อเนื่อง
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400">หลังพิมพ์แล้วกดกลับมา Gate ข้อมูลรายการนี้จะยังอยู่</span>
        </div>
      ) : null}
    </section>
  );
}
