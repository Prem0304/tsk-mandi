// ============================================================================
// SEARCHABLE CUSTOMER SELECTOR COMPONENT
// High-speed auto-complete for sales and billing
// Search by Name, Shop Name, Phone, or Place with live balances & crate counts
// ============================================================================

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../i18n/i18nContext';
import { CustomerFinancialSummary } from '../../types';
import { formatINR } from '../../lib/utils';
import { Search, User, Phone, MapPin, X, Check, ChevronDown, Store } from 'lucide-react';

interface CustomerSearchSelectProps {
  selectedCustomerId: string;
  onSelectCustomer: (customerId: string) => void;
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
  required?: boolean;
  disabled?: boolean;
}

export const CustomerSearchSelect: React.FC<CustomerSearchSelectProps> = ({
  selectedCustomerId,
  onSelectCustomer,
  label,
  placeholder,
  autoFocus = false,
  required = false,
  disabled = false
}) => {
  const { customerSummaries, state } = useApp();
  const { language } = useI18n();

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Selected customer object
  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customerSummaries.find(c => c.customerId === selectedCustomerId) || null;
  }, [selectedCustomerId, customerSummaries]);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // If empty query, show top 25 customers sorted by most recently active / due
      return customerSummaries.slice(0, 30);
    }
    return customerSummaries.filter(c => {
      const nameMatch = c.customerName.toLowerCase().includes(q);
      const phoneMatch = c.phone.includes(q);
      const shopMatch = c.shopName ? c.shopName.toLowerCase().includes(q) : false;
      const placeMatch = c.place ? c.place.toLowerCase().includes(q) : false;
      return nameMatch || phoneMatch || shopMatch || placeMatch;
    });
  }, [customerSummaries, query]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filteredCustomers.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredCustomers.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCustomers.length > 0 && filteredCustomers[highlightedIndex]) {
        handleSelect(filteredCustomers[highlightedIndex].customerId);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (customerId: string) => {
    onSelectCustomer(customerId);
    setIsOpen(false);
    setQuery('');
  };

  const handleClearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectCustomer('');
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div ref={containerRef} className="relative space-y-1 select-none">
      {label && (
        <label className="text-xs font-bold text-slate-700 block">
          {label} {required && <span className="text-tomato">*</span>}
        </label>
      )}

      {selectedCustomer ? (
        /* Selected State Pill Card */
        <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-indigo-50/70 border-2 border-indigo-200 text-slate-900 transition-all shadow-xs">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="flex items-center space-x-1.5 flex-wrap">
                <span className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                  {selectedCustomer.customerName}
                </span>
                {selectedCustomer.shopName && (
                  <span className="text-[11px] font-bold text-indigo-700 bg-white px-1.5 py-0.5 rounded-md border border-indigo-100 truncate">
                    {selectedCustomer.shopName}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                {selectedCustomer.phone && (
                  <span className="flex items-center space-x-0.5">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{selectedCustomer.phone}</span>
                  </span>
                )}
                {selectedCustomer.place && (
                  <span className="flex items-center space-x-0.5">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{selectedCustomer.place}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0 ml-2">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-semibold leading-none">Bal Due</span>
              <strong className={`text-xs sm:text-sm font-black ${selectedCustomer.currentBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {formatINR(selectedCustomer.currentBalance)}
              </strong>
            </div>

            {!disabled && (
              <button
                type="button"
                onClick={handleClearSelection}
                className="p-1.5 rounded-xl bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition-colors shadow-xs"
                title="Change Customer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Search Input */
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>

          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            autoFocus={autoFocus}
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setIsOpen(true);
              setHighlightedIndex(0);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || (language === 'ta' ? 'வாடிக்கையாளர் பெயர், கடை அல்லது போன் எண் தேடுக...' : 'Type name, shop, phone or place to search...')}
            className="w-full h-11 pl-10 pr-10 rounded-xl border-2 border-slate-300 bg-white font-semibold text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:border-tomato focus:outline-none transition-all shadow-xs"
          />

          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setIsOpen(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Autocomplete Dropdown List */}
      {isOpen && !selectedCustomer && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-64 sm:max-h-72 overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-xl divide-y divide-slate-100 animate-in fade-in-50 duration-100">
          {filteredCustomers.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500 font-medium">
              No customer found matching "{query}"
            </div>
          ) : (
            filteredCustomers.map((cust, idx) => {
              const isSelected = cust.customerId === selectedCustomerId;
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={cust.customerId}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => handleSelect(cust.customerId)}
                  className={`p-3 cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                    isHighlighted ? 'bg-indigo-50/80' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center space-x-1.5 flex-wrap">
                      <span className="font-extrabold text-xs sm:text-sm text-slate-900">
                        {cust.customerName}
                      </span>
                      {cust.shopName && (
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          {cust.shopName}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                      {cust.phone && <span>{cust.phone}</span>}
                      {cust.place && <span>• {cust.place}</span>}
                      <span className="text-slate-400">
                        • Crates: {cust.cratesHeld['big'] || 0}B / {cust.cratesHeld['small'] || 0}S
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 block font-semibold">Balance</span>
                    <strong className={`text-xs sm:text-sm font-black ${cust.currentBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {formatINR(cust.currentBalance)}
                    </strong>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
