'use client';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import { X } from 'lucide-react';
import { inputClass } from '../types';

interface GateCustomerOption {
  customer_id: number;
  customer_name: string;
  is_line: boolean;
  is_trucking: boolean;
  is_forwarder: boolean;
  credit_term: number;
}

interface ResolvedGateCustomer {
  customer_id: number;
  customer_name: string;
  credit_term: number;
}

interface GateInBusinessRelationshipSectionProps {
  customerList: GateCustomerOption[];
  resolvedCustomer: ResolvedGateCustomer | null;
  containerOwnerId: number | null;
  setContainerOwnerId: Dispatch<SetStateAction<number | null>>;
  billingCustomerId: number | null;
  setBillingCustomerId: Dispatch<SetStateAction<number | null>>;
  billingDiffFromOwner: boolean;
  setBillingDiffFromOwner: Dispatch<SetStateAction<boolean>>;
  ownerSearch: string;
  setOwnerSearch: Dispatch<SetStateAction<string>>;
  ownerSearchOpen: boolean;
  setOwnerSearchOpen: Dispatch<SetStateAction<boolean>>;
  ownerSearchRef: RefObject<HTMLDivElement | null>;
  billingSearch: string;
  setBillingSearch: Dispatch<SetStateAction<string>>;
  billingSearchOpen: boolean;
  setBillingSearchOpen: Dispatch<SetStateAction<boolean>>;
  billingSearchRef: RefObject<HTMLDivElement | null>;
  handleOwnerSearchChange: (value: string) => void;
}

export default function GateInBusinessRelationshipSection({
  customerList,
  resolvedCustomer,
  containerOwnerId,
  setContainerOwnerId,
  billingCustomerId,
  setBillingCustomerId,
  billingDiffFromOwner,
  setBillingDiffFromOwner,
  ownerSearch,
  setOwnerSearch,
  ownerSearchOpen,
  setOwnerSearchOpen,
  ownerSearchRef,
  billingSearch,
  setBillingSearch,
  billingSearchOpen,
  setBillingSearchOpen,
  billingSearchRef,
  handleOwnerSearchChange,
}: GateInBusinessRelationshipSectionProps) {
  return (
    <div className="mt-4 p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/30">
      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-2">Business relationship</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Container owner</label>
          <div className="relative" ref={ownerSearchRef}>
            <input
              type="text"
              placeholder="พิมพ์ชื่อสายเรือหรือเจ้าของตู้..."
              value={ownerSearch || (containerOwnerId ? customerList.find(c => c.customer_id === containerOwnerId)?.customer_name || '' : resolvedCustomer?.customer_name || '')}
              onChange={e => handleOwnerSearchChange(e.target.value)}
              onFocus={() => setOwnerSearchOpen(true)}
              className={`${inputClass} text-sm`}
            />
            {containerOwnerId && !ownerSearchOpen && (
              <button onClick={() => {
                setContainerOwnerId(null);
                setOwnerSearch('');
                if (!billingDiffFromOwner) setBillingCustomerId(null);
                setOwnerSearchOpen(true);
              }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors">
                <X size={14} />
              </button>
            )}
            {ownerSearchOpen && (
              <div className="absolute z-30 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl">
                {customerList
                  .filter(c => {
                    const q = ownerSearch.toLowerCase();
                    return !q || c.customer_name.toLowerCase().includes(q);
                  })
                  .slice(0, 15)
                  .map(c => (
                    <button key={c.customer_id}
                      onClick={() => {
                        setContainerOwnerId(c.customer_id);
                        setOwnerSearch(c.customer_name);
                        if (!billingDiffFromOwner) setBillingCustomerId(c.customer_id);
                        setOwnerSearchOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-between ${
                        containerOwnerId === c.customer_id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'text-slate-700 dark:text-slate-200'
                      }`}>
                      <span>{c.customer_name}</span>
                      <span className="text-[10px] text-slate-400">
                        {c.is_line ? 'สายเรือ' : c.is_forwarder ? 'ตัวแทน' : c.is_trucking ? 'รถบรรทุก' : ''}
                      </span>
                    </button>
                  ))}
                {customerList.filter(c => !ownerSearch || c.customer_name.toLowerCase().includes(ownerSearch.toLowerCase())).length === 0 && (
                  <div className="px-3 py-2 text-sm text-slate-400">ไม่พบลูกค้า</div>
                )}
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 flex items-center gap-2">
            Billing customer
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={billingDiffFromOwner} onChange={e => {
                setBillingDiffFromOwner(e.target.checked);
                if (!e.target.checked) setBillingCustomerId(containerOwnerId);
              }} className="accent-blue-600" />
              <span className="text-xs text-blue-500">คนละคน</span>
            </label>
          </label>
          {billingDiffFromOwner ? (
            <div className="relative" ref={billingSearchRef}>
              <input
                type="text"
                placeholder="พิมพ์ชื่อบริษัทเพื่อค้นหา..."
                value={billingSearch || (billingCustomerId ? customerList.find(c => c.customer_id === billingCustomerId)?.customer_name || '' : '')}
                onChange={e => {
                  setBillingSearch(e.target.value);
                  setBillingSearchOpen(true);
                  if (!e.target.value) setBillingCustomerId(null);
                }}
                onFocus={() => setBillingSearchOpen(true)}
                className={`${inputClass} text-sm`}
              />
              {billingCustomerId && !billingSearchOpen && (
                <button onClick={() => { setBillingCustomerId(null); setBillingSearch(''); setBillingSearchOpen(true); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors">
                  <X size={14} />
                </button>
              )}
              {billingSearchOpen && (
                <div className="absolute z-30 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl">
                  {customerList
                    .filter(c => {
                      const q = billingSearch.toLowerCase();
                      return !q || c.customer_name.toLowerCase().includes(q);
                    })
                    .slice(0, 15)
                    .map(c => (
                      <button key={c.customer_id}
                        onClick={() => {
                          setBillingCustomerId(c.customer_id);
                          setBillingSearch(c.customer_name);
                          setBillingSearchOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-between ${
                          billingCustomerId === c.customer_id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'text-slate-700 dark:text-slate-200'
                        }`}>
                        <span>{c.customer_name}</span>
                        <span className="text-[10px] text-slate-400">
                          {c.is_line ? 'สายเรือ' : c.is_forwarder ? 'ตัวแทน' : c.is_trucking ? 'รถบรรทุก' : ''}
                        </span>
                      </button>
                    ))}
                  {customerList.filter(c => !billingSearch || c.customer_name.toLowerCase().includes(billingSearch.toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-sm text-slate-400">ไม่พบลูกค้า</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
              เหมือนเจ้าของตู้
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
