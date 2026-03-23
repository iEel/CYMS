'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Clock, ChevronDown, ChevronUp } from 'lucide-react';

interface TimelineEvent {
  id: string;
  type: string;
  icon: string;
  color: string;
  title: string;
  description: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

interface ContainerInfo {
  container_number: string;
  size: string;
  type: string;
  status: string;
  shipping_line: string;
  yard_name: string;
  zone_name: string;
  bay: number;
  row: number;
  tier: number;
  dwell_days: number;
  gate_in_date: string;
  gate_out_date: string;
}

interface ContainerTimelineProps {
  containerId?: number;
  containerNumber?: string;
  onClose: () => void;
}

export default function ContainerTimeline({ containerId, containerNumber, onClose }: ContainerTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [container, setContainer] = useState<ContainerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchTimeline = useCallback(async () => {
    try {
      const params = containerId ? `container_id=${containerId}` : `container_number=${containerNumber}`;
      const res = await fetch(`/api/containers/timeline?${params}`);
      const data = await res.json();
      if (!data.error) {
        setEvents(data.events || []);
        setContainer(data.container);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [containerId, containerNumber]);

  useEffect(() => { fetchTimeline(); }, [fetchTimeline]);

  const formatDate = (d: string) => {
    if (!d) return '-';
    const date = new Date(d);
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) +
      ' ' + date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  };

  const STATUS_COLORS: Record<string, string> = {
    in_yard: 'bg-emerald-100 text-emerald-700',
    available: 'bg-blue-100 text-blue-700',
    gated_out: 'bg-slate-100 text-slate-700',
    on_hold: 'bg-red-100 text-red-700',
    under_repair: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-600 to-indigo-600">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Clock size={18} /> Container Timeline
            </h2>
            {container && (
              <p className="text-blue-100 text-xs mt-0.5">
                {container.container_number} • {container.size}&apos;{container.type} • {container.shipping_line || '-'}
              </p>
            )}
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30">
            <X size={16} />
          </button>
        </div>

        {/* Container Info Bar */}
        {container && (
          <div className="px-5 py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600 flex items-center gap-3 text-xs">
            <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${STATUS_COLORS[container.status] || 'bg-slate-100 text-slate-600'}`}>
              {container.status?.replace(/_/g, ' ').toUpperCase()}
            </span>
            {container.zone_name && (
              <span className="text-slate-500 dark:text-slate-400">
                📍 {container.zone_name} B{container.bay}-R{container.row}-T{container.tier}
              </span>
            )}
            <span className="text-slate-500 dark:text-slate-400 ml-auto">
              🕐 {container.dwell_days} วันในลาน
            </span>
          </div>
        )}

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-blue-500" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">ไม่มีเหตุการณ์</div>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-slate-600" />

              {events.map((event, idx) => {
                const isExpanded = expandedId === event.id;
                const isLast = idx === events.length - 1;
                return (
                  <div key={event.id} className={`relative flex gap-3 ${isLast ? '' : 'pb-4'}`}>
                    {/* Dot */}
                    <div className="relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-sm border-2 border-white dark:border-slate-800"
                      style={{ backgroundColor: event.color + '20', borderColor: event.color }}>
                      <span className="text-xs">{event.icon}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : event.id)}
                        className="w-full text-left group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-800 dark:text-white">{event.title}</span>
                          {event.details && Object.keys(event.details).length > 0 && (
                            isExpanded
                              ? <ChevronUp size={12} className="text-slate-400" />
                              : <ChevronDown size={12} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                        {event.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{event.description}</p>
                        )}
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{formatDate(event.timestamp)}</p>
                      </button>

                      {/* Expanded details */}
                      {isExpanded && event.details && (
                        <div className="mt-2 p-2.5 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-xs space-y-1 border border-slate-200 dark:border-slate-600">
                          {Object.entries(event.details).map(([key, val]) => {
                            if (!val || val === false) return null;
                            return (
                              <div key={key} className="flex gap-2">
                                <span className="text-slate-400 font-medium min-w-[80px]">{key.replace(/_/g, ' ')}:</span>
                                <span className="text-slate-700 dark:text-slate-300">{String(val)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 text-center">
          <p className="text-[10px] text-slate-400">{events.length} events • {container?.container_number}</p>
        </div>
      </div>
    </div>
  );
}
