'use client';

import { Receipt, Calculator, CreditCard, FileText } from 'lucide-react';

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">บัญชี & การเงิน</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">ตั้ง Tariff, Auto-Billing, ชำระเงิน, เอกสารบัญชี</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { icon: <Calculator size={24} />, title: 'Tariff & Free Time', desc: 'ตั้งค่าเรทราคาตามสายเรือ', color: '#3B82F6' },
          { icon: <Receipt size={24} />, title: 'Auto-Billing', desc: 'คำนวณค่าบริการอัตโนมัติ', color: '#10B981' },
          { icon: <CreditCard size={24} />, title: 'ชำระเงิน', desc: 'Payment & Release Control', color: '#F59E0B' },
          { icon: <FileText size={24} />, title: 'เอกสารบัญชี', desc: 'BN, Invoice, Receipt, CN', color: '#8B5CF6' },
        ].map((item, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6
            hover:shadow-md transition-all duration-200 cursor-pointer group">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
              style={{ backgroundColor: `${item.color}15`, color: item.color }}>
              {item.icon}
            </div>
            <h3 className="font-semibold text-slate-800 dark:text-white mb-1">{item.title}</h3>
            <p className="text-sm text-slate-400">{item.desc}</p>
            <p className="text-xs text-amber-500 mt-3 font-medium">🔨 เฟส 8 — เร็วๆ นี้</p>
          </div>
        ))}
      </div>
    </div>
  );
}
