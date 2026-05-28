'use client';

interface LegendItem {
  label: string;
  color: string;
  count?: number;
}

interface Props {
  title: string;
  items: LegendItem[];
  note?: string;
  maxVisibleItems?: number;
}

function shortLabel(label: string) {
  if (label.length <= 24) return label;
  return `${label.slice(0, 21)}...`;
}

export default function Yard3DLegend({
  title,
  items,
  note,
  maxVisibleItems = 4,
}: Props) {
  const visibleItems = items.slice(0, maxVisibleItems);
  const overflowCount = Math.max(0, items.length - visibleItems.length);

  return (
    <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 backdrop-blur">
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </span>
      {visibleItems.map((item) => (
        <span
          key={item.label}
          title={item.label}
          className="inline-flex items-center gap-1 rounded-md bg-slate-800/80 px-2 py-1 text-[10px] text-slate-200"
        >
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: item.color }}
          />
          <span>{shortLabel(item.label)}</span>
          {typeof item.count === 'number' && (
            <span className="text-slate-500">{item.count}</span>
          )}
        </span>
      ))}
      {overflowCount > 0 && (
        <span className="rounded-md bg-slate-800/80 px-2 py-1 text-[10px] font-semibold text-slate-400">
          +{overflowCount}
        </span>
      )}
      {note && <span className="text-[10px] text-slate-500">{note}</span>}
    </div>
  );
}
