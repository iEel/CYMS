'use client';

import { FileText, Upload, ShieldCheck } from 'lucide-react';

export default function EDIPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">EDI & ข้อมูลล่วงหน้า</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">นำเข้าข้อมูล Booking / Manifest, ตรวจสอบเลขซีล</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { icon: <Upload size={24} />, title: 'นำเข้าข้อมูล', desc: 'EDI, Excel, CSV, Manual', color: '#3B82F6' },
          { icon: <ShieldCheck size={24} />, title: 'Seal Cross-Validation', desc: 'ตรวจเลขตู้/ซีลเทียบ Manifest', color: '#10B981' },
          { icon: <FileText size={24} />, title: 'Booking & Manifest', desc: 'ดูข้อมูลล่วงหน้าสายเรือ', color: '#F59E0B' },
        ].map((item, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6
            hover:shadow-md transition-all duration-200 cursor-pointer group">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
              style={{ backgroundColor: `${item.color}15`, color: item.color }}>
              {item.icon}
            </div>
            <h3 className="font-semibold text-slate-800 dark:text-white mb-1">{item.title}</h3>
            <p className="text-sm text-slate-400">{item.desc}</p>
            <p className="text-xs text-amber-500 mt-3 font-medium">🔨 เฟส 6 — เร็วๆ นี้</p>
          </div>
        ))}
      </div>
    </div>
  );
}
