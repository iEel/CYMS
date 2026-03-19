'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  Search,
  Bell,
  Moon,
  Sun,
  ChevronDown,
  MapPin,
  User,
  X,
} from 'lucide-react';

// ข้อมูลลานจำลอง
const DEMO_YARDS = [
  { yard_id: 1, yard_name: 'ลานตู้สาขาหลัก', yard_code: 'YARD-01' },
  { yard_id: 2, yard_name: 'ลานตู้สาขา 2', yard_code: 'YARD-02' },
];

export default function Topbar() {
  const { session, switchYard } = useAuth();
  const [isDark, setIsDark] = useState(false);
  const [yardDropdownOpen, setYardDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; label: string; type: string }[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const yardRef = useRef<HTMLDivElement>(null);

  // Dark mode toggle
  useEffect(() => {
    const saved = localStorage.getItem('cyms_dark_mode');
    if (saved === 'true') {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newVal = !isDark;
    setIsDark(newVal);
    localStorage.setItem('cyms_dark_mode', String(newVal));
    if (newVal) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Instant search demo
  useEffect(() => {
    if (searchQuery.length >= 2) {
      // จำลองผลค้นหา (จะเปลี่ยนเป็น API จริงภายหลัง)
      const results = [
        { id: 'TCLU1234567', label: 'TCLU 123456-7', type: 'ตู้คอนเทนเนอร์' },
        { id: 'MSCU7654321', label: 'MSCU 765432-1', type: 'ตู้คอนเทนเนอร์' },
      ].filter(r => r.id.toLowerCase().includes(searchQuery.toLowerCase()));
      setSearchResults(results);
      setShowSearch(true);
    } else {
      setSearchResults([]);
      setShowSearch(false);
    }
  }, [searchQuery]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
      if (yardRef.current && !yardRef.current.contains(e.target as Node)) {
        setYardDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeYard = DEMO_YARDS.find(y => y.yard_id === session?.activeYardId);

  return (
    <header className="sticky top-0 z-30 h-16 bg-white dark:bg-[#1E293B] border-b border-slate-200 dark:border-slate-700 flex items-center px-4 gap-4">
      {/* Global Search */}
      <div ref={searchRef} className="flex-1 max-w-xl mx-auto relative">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาเลขตู้, ทะเบียนรถ, เลขซีล..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm
              text-slate-700 dark:text-slate-200 placeholder:text-slate-400
              border border-transparent focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-500/20
              outline-none transition-all duration-200"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setShowSearch(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showSearch && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
            {searchResults.map((result) => (
              <button
                key={result.id}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
                onClick={() => { setShowSearch(false); setSearchQuery(''); }}
              >
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <Search size={14} className="text-[#3B82F6]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 font-mono">{result.label}</p>
                  <p className="text-xs text-slate-400">{result.type}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {/* Yard Switcher */}
        <div ref={yardRef} className="relative">
          <button
            onClick={() => setYardDropdownOpen(!yardDropdownOpen)}
            className="flex items-center gap-2 h-10 px-3 rounded-xl bg-slate-100 dark:bg-slate-800
              text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700
              transition-all duration-200 border border-transparent"
          >
            <MapPin size={16} className="text-[#3B82F6]" />
            <span className="hidden sm:inline font-medium">{activeYard?.yard_name || 'เลือกลาน'}</span>
            <ChevronDown size={14} className={`transition-transform duration-200 ${yardDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {yardDropdownOpen && (
            <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-400 font-medium">สลับสาขาลาน</p>
              </div>
              {DEMO_YARDS.filter(y => session?.yardIds.includes(y.yard_id)).map((yard) => (
                <button
                  key={yard.yard_id}
                  onClick={() => { switchYard(yard.yard_id); setYardDropdownOpen(false); }}
                  className={`w-full px-4 py-3 flex items-center gap-3 transition-colors text-left
                    ${yard.yard_id === session?.activeYardId
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-[#3B82F6]'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }
                  `}
                >
                  <MapPin size={16} />
                  <div>
                    <p className="text-sm font-medium">{yard.yard_name}</p>
                    <p className="text-xs opacity-60">{yard.yard_code}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notification Bell */}
        <button className="relative w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center
          text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200"
          data-tooltip="การแจ้งเตือน"
        >
          <Bell size={18} />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#EF4444]" />
        </button>

        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center
            text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200"
          data-tooltip={isDark ? 'โหมดสว่าง' : 'โหมดมืด'}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* User Avatar */}
        <div className="w-10 h-10 rounded-xl bg-[#3B82F6] flex items-center justify-center text-white"
          data-tooltip={session?.fullName || 'ผู้ใช้'}
        >
          <User size={18} />
        </div>
      </div>
    </header>
  );
}
