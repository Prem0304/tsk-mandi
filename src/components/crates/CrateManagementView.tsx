// ============================================================================
// CRATE MANAGEMENT VIEW (SECTION 10 - FULL TRACKING, COUNT ONLY)
// Shop Inventory, Customer Returns, Supplier Returns, Physical Count & Defaulters
// ============================================================================

import React, { useState, useMemo } from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../lib/db';
import { CrateInventoryEvent } from '../../types';
import { formatINR, formatDate, getTodayDateString, formatDateWithDay, getDayName } from '../../lib/utils';
import { shareCrateReminderWhatsApp } from '../../lib/whatsapp';
import { exportToExcel, exportCustomerPendingCratesExcel } from '../../lib/excelExport';
import { generateCustomerPendingCratesPdf } from '../../lib/pdfGenerator';
import {
  Box,
  RotateCcw,
  AlertTriangle,
  ClipboardCheck,
  Plus,
  Share2,
  Download,
  FileSpreadsheet,
  Search,
  X,
  Phone,
  ArrowRight,
  TrendingDown
} from 'lucide-react';

export const CrateManagementView: React.FC = () => {
  const { t, language } = useI18n();
  const { canRecordCratesAndPayments } = useAuth();
  const { state, shopCrateSummaries, customerSummaries } = useApp();

  const [activeTab, setActiveTab] = useState<'inventory' | 'defaulters' | 'history'>('inventory');

  // Modals state
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnPartyType, setReturnPartyType] = useState<'customer' | 'supplier'>('customer');
  const [returnPartyId, setReturnPartyId] = useState('');
  const [returnBigQty, setReturnBigQty] = useState<number>(0);
  const [returnSmallQty, setReturnSmallQty] = useState<number>(0);
  const [returnNotes, setReturnNotes] = useState('');

  // Physical Count Check modal
  const [isCountModalOpen, setIsCountModalOpen] = useState(false);
  const [countCategory, setCountCategory] = useState<'big' | 'small'>('big');
  const [actualPhysicalCount, setActualPhysicalCount] = useState<number>(0);
  const [countNotes, setCountNotes] = useState('');

  // New Crate Purchase / Damage modal
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventType, setEventType] = useState<'new_purchase' | 'damaged' | 'lost'>('new_purchase');
  const [eventCategory, setEventCategory] = useState<'big' | 'small'>('big');
  const [eventQty, setEventQty] = useState<number>(0);
  const [eventUnitCost, setEventUnitCost] = useState<number>(180);
  const [eventNotes, setEventNotes] = useState('');

  // Crate Defaulters (> Settings.crateAgingDays, default 15)
  const crateAgingDaysThreshold = state.settings.crateAgingDays || 15;
  const [defaulterSearch, setDefaulterSearch] = useState('');

  const crateDefaulters = useMemo(() => {
    return customerSummaries
      .map(c => {
        const totalHeld = Object.values(c.cratesHeld).reduce((a, b) => a + b, 0);
        return { ...c, totalHeld };
      })
      .filter(c => c.totalHeld > 0)
      .sort((a, b) => b.totalHeld - a.totalHeld);
  }, [customerSummaries]);

  const filteredDefaulters = useMemo(() => {
    const q = defaulterSearch.toLowerCase().trim();
    if (!q) return crateDefaulters;
    return crateDefaulters.filter(c =>
      c.customerName.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.shopName && c.shopName.toLowerCase().includes(q)) ||
      (c.place && c.place.toLowerCase().includes(q))
    );
  }, [crateDefaulters, defaulterSearch]);

  const totalPendingBig = useMemo(() => {
    return crateDefaulters.reduce((acc, c) => acc + (c.cratesHeld['big'] || 0), 0);
  }, [crateDefaulters]);

  const totalPendingSmall = useMemo(() => {
    return crateDefaulters.reduce((acc, c) => acc + (c.cratesHeld['small'] || 0), 0);
  }, [crateDefaulters]);

  const totalPendingGrand = useMemo(() => {
    return crateDefaulters.reduce((acc, c) => acc + c.totalHeld, 0);
  }, [crateDefaulters]);

  const handleDownloadExcel = () => {
    if (crateDefaulters.length === 0) {
      alert(t('crates.noPendingCrates'));
      return;
    }
    exportCustomerPendingCratesExcel(crateDefaulters, state.settings.shopName);
  };

  const handleDownloadPdf = () => {
    if (crateDefaulters.length === 0) {
      alert(t('crates.noPendingCrates'));
      return;
    }
    generateCustomerPendingCratesPdf(crateDefaulters, state.settings, language);
  };

  // Crate movements chronological history
  const recentMovements = useMemo(() => {
    return [...state.crateMovements]
      .filter(m => !m.deletedAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 30);
  }, [state.crateMovements]);

  const handleSaveReturn = () => {
    if (!returnPartyId) {
      alert('Please select customer or supplier');
      return;
    }
    if (returnBigQty <= 0 && returnSmallQty <= 0) {
      alert('Enter at least 1 crate quantity returned');
      return;
    }

    if (returnBigQty > 0) {
      dbService.recordCrateReturn(
        returnPartyType,
        returnPartyId,
        'big',
        returnBigQty,
        returnPartyType === 'customer' ? 'shop' : 'supplier',
        returnNotes
      );
    }
    if (returnSmallQty > 0) {
      dbService.recordCrateReturn(
        returnPartyType,
        returnPartyId,
        'small',
        returnSmallQty,
        returnPartyType === 'customer' ? 'shop' : 'supplier',
        returnNotes
      );
    }

    setIsReturnModalOpen(false);
    setReturnBigQty(0);
    setReturnSmallQty(0);
    setReturnNotes('');
  };

  const handleSavePhysicalCount = () => {
    const summary = shopCrateSummaries.find(s => s.categoryId === countCategory);
    const systemCount = summary?.emptyInShop || 0;
    const diff = actualPhysicalCount - systemCount;

    dbService.recordCrateInventoryEvent({
      id: `count-${Date.now()}`,
      eventDate: getTodayDateString(),
      categoryId: countCategory,
      eventType: 'physical_count',
      qty: Math.abs(diff),
      systemCount,
      physicalCount: actualPhysicalCount,
      difference: diff,
      notes: countNotes || `Physical verification: System ${systemCount}, Counted ${actualPhysicalCount} (Diff: ${diff})`,
      createdAt: new Date().toISOString()
    });

    setIsCountModalOpen(false);
    setActualPhysicalCount(0);
  };

  const handleSaveEvent = () => {
    if (eventQty <= 0) {
      alert('Enter a valid quantity');
      return;
    }

    dbService.recordCrateInventoryEvent({
      id: `cevent-${Date.now()}`,
      eventDate: getTodayDateString(),
      categoryId: eventCategory,
      eventType,
      qty: eventQty,
      unitCost: eventType === 'new_purchase' ? eventUnitCost : 0,
      totalCost: eventType === 'new_purchase' ? eventQty * eventUnitCost : 0,
      notes: eventNotes,
      createdAt: new Date().toISOString()
    });

    setIsEventModalOpen(false);
    setEventQty(0);
  };

  const handleShareWhatsAppDefaulter = (cust: typeof crateDefaulters[0]) => {
    const rawCust = state.customers.find(c => c.id === cust.customerId);
    if (rawCust) {
      shareCrateReminderWhatsApp(rawCust, cust.cratesHeld, state.settings, language);
    }
  };

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4 pb-24 select-none">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center space-x-2">
            <Box className="w-6 h-6 text-emerald-600" />
            <span>{t('crates.title')}</span>
          </h2>
          <p className="text-xs text-slate-500">
            Physical asset tracking • Count only • No deposit charges
          </p>
        </div>

        {canRecordCratesAndPayments && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Export Pending Crates */}
            <div className="flex items-center space-x-1.5 bg-amber-50 border border-amber-200 p-1 rounded-xl">
              <button
                onClick={handleDownloadPdf}
                title="Download PDF report of crates to collect"
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-tomato hover:bg-rose-700 text-white font-bold text-xs shadow-xs active:scale-95 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t('crates.downloadPdf')}</span>
              </button>
              <button
                onClick={handleDownloadExcel}
                title="Export Excel sheet of crates to collect"
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs active:scale-95 transition-all"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
            </div>

            {canRecordCratesAndPayments && (
              <>
                <button
                  onClick={() => setIsReturnModalOpen(true)}
                  className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow active:scale-95 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Record Crate Return</span>
                </button>

                <button
                  onClick={() => setIsCountModalOpen(true)}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  <ClipboardCheck className="w-4 h-4 text-blue-600" />
                  <span>Physical Count Check</span>
                </button>

                <button
                  onClick={() => { setEventType('new_purchase'); setIsEventModalOpen(true); }}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  <Plus className="w-4 h-4 text-amber-600" />
                  <span>Buy / Damage Crates</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'inventory'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Shop Inventory Cards
        </button>
        <button
          onClick={() => setActiveTab('defaulters')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'defaulters'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Crate Defaulters ({crateDefaulters.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'history'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Recent Movements
        </button>
      </div>

      {/* TAB 1: SHOP CRATE INVENTORY CARDS (SECTION 10.2) */}
      {activeTab === 'inventory' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shopCrateSummaries.map(crate => (
            <div
              key={crate.categoryId}
              className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {language === 'ta' ? crate.categoryNameTa : crate.categoryName}
                  </h3>
                  <span className="text-xs text-slate-400">Shop Total Owned: {crate.totalOwned} crates</span>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm">
                  {crate.categoryId === 'big' ? 'BIG' : 'SML'}
                </div>
              </div>

              {/* 5 Column Metric Grid (Section 10.2) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                
                {/* Empty in Shop */}
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl">
                  <span className="text-emerald-800 font-semibold block text-[10px] uppercase">
                    Empty in Shop
                  </span>
                  <strong className="text-emerald-950 font-black text-xl">
                    {crate.emptyInShop}
                  </strong>
                  <span className="text-[10px] text-emerald-700 block mt-0.5">Ready for packing</span>
                </div>

                {/* Filled with Stock */}
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
                  <span className="text-slate-500 font-semibold block text-[10px] uppercase">
                    Filled with Stock
                  </span>
                  <strong className="text-slate-900 font-black text-xl">
                    {crate.filledWithStock}
                  </strong>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Tomatoes inside</span>
                </div>

                {/* With Customers */}
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-2xl">
                  <span className="text-rose-800 font-semibold block text-[10px] uppercase">
                    With Customers
                  </span>
                  <strong className="text-rose-700 font-black text-xl">
                    {crate.withCustomers}
                  </strong>
                  <span className="text-[10px] text-rose-600 block mt-0.5">Pending return</span>
                </div>

                {/* Owed to Suppliers */}
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-2xl">
                  <span className="text-blue-800 font-semibold block text-[10px] uppercase">
                    Owed to Suppliers
                  </span>
                  <strong className="text-blue-700 font-black text-xl">
                    {crate.owedToSuppliers}
                  </strong>
                  <span className="text-[10px] text-blue-600 block mt-0.5">Supplier crates in shop</span>
                </div>

                {/* Damaged / Lost */}
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
                  <span className="text-slate-500 font-semibold block text-[10px] uppercase">
                    Damaged / Lost
                  </span>
                  <strong className="text-slate-700 font-black text-xl">
                    {crate.damagedOrLost}
                  </strong>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Written off</span>
                </div>

              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: CRATE DEFAULTERS LIST (SECTION 10.5) */}
      {activeTab === 'defaulters' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
          
          {/* Header & Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-base text-slate-900 flex items-center space-x-2">
                <span>{t('crates.pendingCratesToCollect')}</span>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-xs font-black">
                  {crateDefaulters.length}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Download reports or send one-tap WhatsApp reminders to collect empty crates
              </p>
            </div>

            {/* Download Buttons Bar */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleDownloadPdf}
                disabled={crateDefaulters.length === 0}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-tomato hover:bg-rose-700 text-white font-bold text-xs shadow-sm active:scale-95 disabled:opacity-50 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>{t('crates.downloadPdf')}</span>
              </button>
              <button
                onClick={handleDownloadExcel}
                disabled={crateDefaulters.length === 0}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm active:scale-95 disabled:opacity-50 transition-all"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{t('crates.downloadExcel')}</span>
              </button>
            </div>
          </div>

          {/* 4 Summary Cards Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
              <span className="text-slate-500 font-semibold block text-[10px] uppercase">
                {t('crates.totalCustomersHolding')}
              </span>
              <strong className="text-slate-900 font-black text-xl">
                {crateDefaulters.length}
              </strong>
              <span className="text-[10px] text-slate-400 block mt-0.5">Holding empty crates</span>
            </div>

            <div className="bg-rose-50 border border-rose-200 p-3 rounded-2xl">
              <span className="text-rose-800 font-semibold block text-[10px] uppercase">
                {t('crates.totalPendingBig')}
              </span>
              <strong className="text-rose-700 font-black text-xl">
                {totalPendingBig}
              </strong>
              <span className="text-[10px] text-rose-600 block mt-0.5">Big crates to collect</span>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl">
              <span className="text-amber-800 font-semibold block text-[10px] uppercase">
                {t('crates.totalPendingSmall')}
              </span>
              <strong className="text-amber-700 font-black text-xl">
                {totalPendingSmall}
              </strong>
              <span className="text-[10px] text-amber-600 block mt-0.5">Small crates to collect</span>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl">
              <span className="text-emerald-800 font-semibold block text-[10px] uppercase">
                {t('crates.totalPendingGrand')}
              </span>
              <strong className="text-emerald-950 font-black text-xl">
                {totalPendingGrand}
              </strong>
              <span className="text-[10px] text-emerald-700 block mt-0.5">Grand total crates</span>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={defaulterSearch}
              onChange={e => setDefaulterSearch(e.target.value)}
              placeholder="Search customer name, shop name, place, phone..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {defaulterSearch && (
              <button
                onClick={() => setDefaulterSearch('')}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>

          {/* Customers List */}
          <div className="space-y-2">
            {crateDefaulters.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8 font-medium">
                {t('crates.noPendingCrates')}
              </p>
            ) : filteredDefaulters.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8 font-medium">
                No customers match "{defaulterSearch}"
              </p>
            ) : (
              filteredDefaulters.map((c, index) => (
                <div
                  key={c.customerId}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100/70 border border-slate-200 gap-3 transition-colors"
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-700 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{c.customerName}</h4>
                      <p className="text-xs text-slate-500">
                        {[c.shopName, c.place].filter(Boolean).join(' • ')} {c.phone && `• ${c.phone}`}
                      </p>
                      {c.currentBalance > 0 && (
                        <p className="text-[11px] font-bold text-rose-600 mt-0.5">
                          Money Due: {formatINR(c.currentBalance)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                    <div className="text-right">
                      <div className="flex items-center space-x-1.5 text-xs font-black">
                        <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700">
                          Big: {c.cratesHeld['big'] || 0}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                          Small: {c.cratesHeld['small'] || 0}
                        </span>
                      </div>
                      <span className="text-[10px] font-black text-slate-600 block mt-1">
                        Total: {c.totalHeld} Crates
                      </span>
                    </div>

                    <button
                      onClick={() => handleShareWhatsAppDefaulter(c)}
                      className="flex items-center space-x-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs active:scale-95 transition-all"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Remind (WhatsApp)</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: RECENT MOVEMENTS */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 font-bold text-[11px] text-slate-600 uppercase">
                <tr>
                  <th className="p-3 pl-4">Date</th>
                  <th className="p-3">Party Type</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-center">In</th>
                  <th className="p-3 text-center">Out</th>
                  <th className="p-3">Reason / Ref</th>
                  <th className="p-3 pr-4">Ownership</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentMovements.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="p-3 pl-4 font-mono text-slate-700 whitespace-nowrap">
                      <span className="font-bold block">{formatDate(m.movementDate)}</span>
                      <span className="text-[10px] text-slate-400 font-sans block">{getDayName(m.movementDate, language, false)}</span>
                    </td>
                    <td className="p-3 font-bold capitalize">{m.partyType}</td>
                    <td className="p-3 font-semibold uppercase">{m.categoryId}</td>
                    <td className="p-3 text-center font-bold text-emerald-700">{m.qtyIn || '-'}</td>
                    <td className="p-3 text-center font-bold text-rose-700">{m.qtyOut || '-'}</td>
                    <td className="p-3 text-slate-600">{m.notes || m.refType}</td>
                    <td className="p-3 pr-4 capitalize">{m.ownership}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RECORD CRATE RETURN MODAL (SECTION 10.3 & 10.4) */}
      {isReturnModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 select-none">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            <div className="bg-emerald-600 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-extrabold text-base">Record Crate Return</h3>
              <button onClick={() => setIsReturnModalOpen(false)} className="text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs text-slate-800">
              <div>
                <label className="font-bold block mb-1">Return From</label>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => { setReturnPartyType('customer'); setReturnPartyId(''); }}
                    className={`flex-1 py-1.5 rounded-xl font-bold border ${returnPartyType === 'customer' ? 'bg-emerald-100 border-emerald-300 text-emerald-900' : 'bg-slate-50 border-slate-200'}`}
                  >
                    Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => { setReturnPartyType('supplier'); setReturnPartyId(''); }}
                    className={`flex-1 py-1.5 rounded-xl font-bold border ${returnPartyType === 'supplier' ? 'bg-emerald-100 border-emerald-300 text-emerald-900' : 'bg-slate-50 border-slate-200'}`}
                  >
                    Return to Supplier
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">
                  Select {returnPartyType === 'customer' ? 'Customer' : 'Supplier'} *
                </label>
                <select
                  value={returnPartyId}
                  onChange={e => setReturnPartyId(e.target.value)}
                  className="w-full h-10 px-2 rounded-xl border border-slate-300 font-semibold"
                >
                  <option value="">-- Choose --</option>
                  {returnPartyType === 'customer'
                    ? customerSummaries.map(c => (
                        <option key={c.customerId} value={c.customerId}>
                          {c.customerName} (Held Big: {c.cratesHeld['big'] || 0}, Small: {c.cratesHeld['small'] || 0})
                        </option>
                      ))
                    : state.suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold block mb-1">Big Crates (பெரிய)</label>
                  <input
                    type="number"
                    min="0"
                    value={returnBigQty || ''}
                    onChange={e => setReturnBigQty(parseInt(e.target.value, 10) || 0)}
                    placeholder="0"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 font-extrabold text-sm text-center"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Small Crates (சிறிய)</label>
                  <input
                    type="number"
                    min="0"
                    value={returnSmallQty || ''}
                    onChange={e => setReturnSmallQty(parseInt(e.target.value, 10) || 0)}
                    placeholder="0"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 font-extrabold text-sm text-center"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">Notes</label>
                <input
                  type="text"
                  value={returnNotes}
                  onChange={e => setReturnNotes(e.target.value)}
                  placeholder="Optional note"
                  className="w-full h-9 px-2 rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                onClick={() => setIsReturnModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveReturn}
                className="px-5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow"
              >
                Save Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHYSICAL COUNT CHECK MODAL (SECTION 10.2) */}
      {isCountModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 select-none">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            <div className="bg-blue-600 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-extrabold text-base">Physical Count Check</h3>
              <button onClick={() => setIsCountModalOpen(false)} className="text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs text-slate-800">
              <div>
                <label className="font-bold block mb-1">Crate Category</label>
                <select
                  value={countCategory}
                  onChange={e => setCountCategory(e.target.value as any)}
                  className="w-full h-10 px-2 rounded-xl border border-slate-300 font-bold"
                >
                  <option value="big">Big Crate (பெரிய பெட்டி)</option>
                  <option value="small">Small Crate (சிறிய பெட்டி)</option>
                </select>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">System Count:</span>
                  <strong className="text-slate-900">
                    {shopCrateSummaries.find(s => s.categoryId === countCategory)?.emptyInShop || 0} crates
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Actual Counted:</span>
                  <strong className="text-blue-700">{actualPhysicalCount} crates</strong>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1 font-bold">
                  <span>Difference:</span>
                  <span className={actualPhysicalCount - (shopCrateSummaries.find(s => s.categoryId === countCategory)?.emptyInShop || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                    {actualPhysicalCount - (shopCrateSummaries.find(s => s.categoryId === countCategory)?.emptyInShop || 0)}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">Actual Physical Count in Shop *</label>
                <input
                  type="number"
                  min="0"
                  value={actualPhysicalCount || ''}
                  onChange={e => setActualPhysicalCount(parseInt(e.target.value, 10) || 0)}
                  placeholder="Enter counted crates"
                  className="w-full h-11 px-3 rounded-xl border-2 border-slate-300 text-lg font-black text-center"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Notes</label>
                <input
                  type="text"
                  value={countNotes}
                  onChange={e => setCountNotes(e.target.value)}
                  placeholder="e.g. Weekly physical verification"
                  className="w-full h-9 px-2 rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                onClick={() => setIsCountModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePhysicalCount}
                className="px-5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold shadow"
              >
                Save Verification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BUY NEW CRATES OR MARK DAMAGED MODAL */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 select-none">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-extrabold text-base">Crate Inventory Event</h3>
              <button onClick={() => setIsEventModalOpen(false)} className="text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs text-slate-800">
              <div>
                <label className="font-bold block mb-1">Action Type</label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => setEventType('new_purchase')}
                    className={`py-1.5 rounded-lg font-bold border ${eventType === 'new_purchase' ? 'bg-amber-100 border-amber-300 text-amber-900' : 'bg-slate-50 border-slate-200'}`}
                  >
                    New Buy
                  </button>
                  <button
                    type="button"
                    onClick={() => setEventType('damaged')}
                    className={`py-1.5 rounded-lg font-bold border ${eventType === 'damaged' ? 'bg-rose-100 border-rose-300 text-rose-900' : 'bg-slate-50 border-slate-200'}`}
                  >
                    Damaged
                  </button>
                  <button
                    type="button"
                    onClick={() => setEventType('lost')}
                    className={`py-1.5 rounded-lg font-bold border ${eventType === 'lost' ? 'bg-rose-100 border-rose-300 text-rose-900' : 'bg-slate-50 border-slate-200'}`}
                  >
                    Lost
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">Crate Category</label>
                <select
                  value={eventCategory}
                  onChange={e => setEventCategory(e.target.value as any)}
                  className="w-full h-10 px-2 rounded-xl border border-slate-300 font-bold"
                >
                  <option value="big">Big Crate (பெரிய பெட்டி)</option>
                  <option value="small">Small Crate (சிறிய பெட்டி)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold block mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    value={eventQty || ''}
                    onChange={e => setEventQty(parseInt(e.target.value, 10) || 0)}
                    placeholder="0"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 font-extrabold text-sm text-center"
                  />
                </div>
                {eventType === 'new_purchase' && (
                  <div>
                    <label className="font-bold block mb-1">Cost/Crate (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={eventUnitCost || ''}
                      onChange={e => setEventUnitCost(parseFloat(e.target.value) || 0)}
                      placeholder="180"
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 font-bold text-sm text-right"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="font-bold block mb-1">Notes</label>
                <input
                  type="text"
                  value={eventNotes}
                  onChange={e => setEventNotes(e.target.value)}
                  placeholder="e.g. Broken handles / supplier batch"
                  className="w-full h-9 px-2 rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                onClick={() => setIsEventModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEvent}
                className="px-5 py-1.5 rounded-xl bg-slate-900 text-white font-extrabold shadow"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
