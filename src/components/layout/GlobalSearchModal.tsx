// ============================================================================
// GLOBAL SEARCH MODAL (SEARCH CUSTOMERS, SUPPLIERS, BILLS & LOTS)
// ============================================================================

import React, { useState, useMemo } from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useApp } from '../../context/AppContext';
import { formatINR, formatDate } from '../../lib/utils';
import { Search, X, User, Building2, FileText, ArrowRight } from 'lucide-react';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomer: (id: string) => void;
  onSelectSupplier: (id: string) => void;
  onSelectSaleBill: (sale: any) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectCustomer,
  onSelectSupplier,
  onSelectSaleBill
}) => {
  const { t } = useI18n();
  const { state, customerSummaries, supplierSummaries } = useApp();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { customers: [], suppliers: [], sales: [] };

    const customers = customerSummaries.filter(c =>
      c.customerName.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.shopName && c.shopName.toLowerCase().includes(q)) ||
      (c.place && c.place.toLowerCase().includes(q))
    ).slice(0, 5);

    const suppliers = supplierSummaries.filter(s =>
      s.supplierName.toLowerCase().includes(q) ||
      s.phone.includes(q) ||
      (s.place && s.place.toLowerCase().includes(q))
    ).slice(0, 5);

    const sales = state.sales.filter(s =>
      !s.deletedAt && (
        s.billNo.toLowerCase().includes(q) ||
        (s.notes && s.notes.toLowerCase().includes(q))
      )
    ).slice(0, 5);

    return { customers, suppliers, sales };
  }, [query, customerSummaries, supplierSummaries, state.sales]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-3 pt-12 sm:pt-20 safe-area-pt safe-area-pb">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh] animate-in slide-in-from-top-4 duration-150">
        
        {/* Search Input Bar */}
        <div className="p-3 border-b border-slate-200 flex items-center space-x-2">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('common.search')}
            autoFocus
            className="w-full text-base font-medium outline-none bg-transparent placeholder-slate-400"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
          >
            Esc
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          
          {/* Customers */}
          {results.customers.length > 0 && (
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                <User className="w-3.5 h-3.5" />
                <span>{t('nav.customers')}</span>
              </div>
              <div className="space-y-1">
                {results.customers.map(c => (
                  <div
                    key={c.customerId}
                    onClick={() => {
                      onSelectCustomer(c.customerId);
                      onClose();
                    }}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-rose-50/50 cursor-pointer flex items-center justify-between border border-slate-100 transition-all"
                  >
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">{c.customerName}</h4>
                      <p className="text-xs text-slate-500">{c.shopName || c.place || c.phone}</p>
                    </div>
                    <div className="text-right flex items-center space-x-2">
                      <span className={`text-xs font-bold ${c.currentBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {formatINR(c.currentBalance)}
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suppliers */}
          {results.suppliers.length > 0 && (
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                <Building2 className="w-3.5 h-3.5" />
                <span>{t('nav.suppliers')}</span>
              </div>
              <div className="space-y-1">
                {results.suppliers.map(s => (
                  <div
                    key={s.supplierId}
                    onClick={() => {
                      onSelectSupplier(s.supplierId);
                      onClose();
                    }}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-rose-50/50 cursor-pointer flex items-center justify-between border border-slate-100 transition-all"
                  >
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">{s.supplierName}</h4>
                      <p className="text-xs text-slate-500">{s.place || s.phone}</p>
                    </div>
                    <div className="text-right flex items-center space-x-2">
                      <span className="text-xs font-bold text-amber-700">
                        In Hand: {formatINR(s.moneyInHand)}
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sale Bills */}
          {results.sales.length > 0 && (
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                <FileText className="w-3.5 h-3.5" />
                <span>Bills</span>
              </div>
              <div className="space-y-1">
                {results.sales.map(s => {
                  const cust = state.customers.find(c => c.id === s.customerId);
                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        onSelectSaleBill(s);
                        onClose();
                      }}
                      className="p-2.5 rounded-xl bg-slate-50 hover:bg-rose-50/50 cursor-pointer flex items-center justify-between border border-slate-100 transition-all"
                    >
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">{s.billNo}</h4>
                        <p className="text-xs text-slate-500">{cust?.name || 'Customer'} • {formatDate(s.saleDate)}</p>
                      </div>
                      <div className="text-right flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-800">
                          {formatINR(s.billTotal)}
                        </span>
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {query && results.customers.length === 0 && results.suppliers.length === 0 && results.sales.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">
              {t('common.noData')}
            </div>
          )}

          {!query && (
            <div className="text-center py-8 text-slate-400 text-xs">
              Type customer name, phone number, supplier, or bill ID to search...
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
