'use client';

import { Compass, LocateFixed, RotateCcw } from 'lucide-react';

interface Props {
  canFocusSelected: boolean;
  onOverview: () => void;
  onTopDown: () => void;
  onFocusSelected: () => void;
}

export default function Yard3DCameraToolbar({
  canFocusSelected,
  onOverview,
  onTopDown,
  onFocusSelected,
}: Props) {
  const buttonClass = 'h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-300 hover:bg-slate-700/80 hover:text-white transition';

  return (
    <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
      <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/80 p-1 backdrop-blur">
        <button type="button" title="ภาพรวมลาน" aria-label="ภาพรวมลาน" onClick={onOverview} className={buttonClass}>
          <RotateCcw size={14} />
        </button>
        <button type="button" title="มุมมองด้านบน" aria-label="มุมมองด้านบน" onClick={onTopDown} className={buttonClass}>
          <Compass size={14} />
        </button>
        <button
          type="button"
          title="โฟกัสตู้ที่เลือก"
          aria-label="โฟกัสตู้ที่เลือก"
          onClick={onFocusSelected}
          disabled={!canFocusSelected}
          className={`${buttonClass} disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-300`}
        >
          <LocateFixed size={14} />
        </button>
      </div>
      <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 px-2.5 py-1.5 text-[10px] text-slate-500 backdrop-blur">
        หมุน • Shift+ลาก • Scroll ซูม
      </div>
    </div>
  );
}
