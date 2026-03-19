'use client';

import { Wrench, FileCheck2, CheckCircle } from 'lucide-react';

export default function MnRPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">ซ่อมบำรุง M&R</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">สร้าง EOR, มาตรฐาน CEDEX, อนุมัติใบซ่อม</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { icon: <Wrench size={24} />, title: 'สร้างใบ EOR', desc: 'ประเมินราคาซ่อมจากรูปรอยเสียหาย', color: '#3B82F6' },
          { icon: <FileCheck2 size={24} />, title: 'CEDEX Standard', desc: 'Damage, Component, Repair codes', color: '#10B981' },
          { icon: <CheckCircle size={24} />, title: 'อนุมัติ EOR', desc: 'Workflow อนุมัติจากสายเรือ', color: '#F59E0B' },
        ].map((item, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6
            hover:shadow-md transition-all duration-200 cursor-pointer group">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
              style={{ backgroundColor: `${item.color}15`, color: item.color }}>
              {item.icon}
            </div>
            <h3 className="font-semibold text-slate-800 dark:text-white mb-1">{item.title}</h3>
            <p className="text-sm text-slate-400">{item.desc}</p>
            <p className="text-xs text-amber-500 mt-3 font-medium">🔨 เฟส 7 — เร็วๆ นี้</p>
          </div>
        ))}
      </div>
    </div>
  );
}
