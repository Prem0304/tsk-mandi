// ============================================================================
// SUPPLIER SETTLEMENT & COLLECTION VIEW (SECTION 8 & 9A)
// Total Due | Collected | Paid Out | Money in Hand | Still to Collect | Crates
// Lot-wise Customer Breakdown & Direct "Pay Collected Amount" Action
// ============================================================================

import React, { useState, useMemo } from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../lib/db';
import { Supplier } from '../../types';
import { formatINR, formatDate, getTodayDateString } from '../../lib/utils';
import { exportToExcel, downloadSupplierTemplate } from '../../lib/excelExport';
import { generateSupplierStatementPdf } from '../../lib/pdfGenerator';
import {
  Building2,
  Search,
  Plus,
  DollarSign,
  Download,
  Share2,
  ChevronDown,
  ChevronUp,
  X,
  Phone,
  MapPin,
  Box,
  ArrowRight
} from 'lucide-react';

interface SupplierListViewProps {
  onOpenPaySupplier: (supplierId: string) => void;
}

export const SupplierListView: React.FC<SupplierListViewProps> = ({ onOpenPaySupplier }) => {
  const { t, language } = useI18n();
  const { state, supplierSummaries } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New Supplier Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [place, setPlace] = useState('');
  const [gst, setGst] = useState('');
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [openingDate, setOpeningDate] = useState(getTodayDateString());
  const [openingBig, setOpeningBig] = useState<number>(0);
  const [openingSmall, setOpeningSmall] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const filteredSuppliers = useMemo(() => {
    return supplierSummaries.filter(s => {
      const q = searchQuery.toLowerCase();
      return (
        s.supplierName.toLowerCase().includes(q) ||
        s.phone.includes(q) ||
        (s.place && s.place.toLowerCase().includes(q))
      );
    });
  }, [supplierSummaries, searchQuery]);

  const handleSaveSupplier = () => {
    setErrorMsg('');
    if (!name.trim()) {
      setErrorMsg('Supplier name is required.');
      return;
    }
    if (!phone.trim()) {
      setErrorMsg('Phone number is required.');
      return;
    }

    const supplier: Supplier = {
      id: `sup-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: name.trim(),
      phone: phone.trim(),
      altPhone: altPhone.trim() || undefined,
      place: place.trim() || undefined,
      gstNumber: gst.trim() || undefined,
      openingMoneyBalance: openingBalance,
      openingBalanceDate: openingDate,
      openingCrates: { big: openingBig, small: openingSmall },
      notes: notes.trim() || undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    dbService.saveSupplier(supplier);
    setIsAddModalOpen(false);
    setName('');
    setPhone('');
    setPlace('');
  };

  const handleExportStatementPdf = (suppId: string) => {
    const supp = state.suppliers.find(s => s.id === suppId);
    const summary = supplierSummaries.find(s => s.supplierId === suppId);
    if (!supp || !summary) return;

    const suppPurchases = state.purchases.filter(p => p.supplierId === suppId && !p.deletedAt);
    const suppPayments = state.paymentsMade.filter(p => p.supplierId === suppId && !p.deletedAt);

    generateSupplierStatementPdf(
      supp,
      state.settings,
      suppPurchases,
      suppPayments,
      summary.totalDue,
      summary.paidOutToSupplier,
      summary.balancePayable,
      language
    );
  };

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4 pb-24 select-none">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center space-x-2">
            <Building2 className="w-6 h-6 text-indigo-600" />
            <span>{t('suppliers.title')}</span>
          </h2>
          <p className="text-xs text-slate-500">
            {supplierSummaries.length} suppliers • Section 9A Collection & Money in Hand
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-6 top-6" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search suppliers by name, place, phone..."
          className="w-full h-11 pl-10 pr-3 rounded-xl border border-slate-300 text-sm font-medium focus:border-indigo-600 focus:outline-none"
        />
      </div>

      {/* Supplier List Cards */}
      <div className="space-y-3">
        {filteredSuppliers.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl text-center text-slate-400 text-sm border border-slate-200">
            {t('common.noData')}
          </div>
        ) : (
          filteredSuppliers.map(supp => {
            const isExpanded = expandedSupplierId === supp.supplierId;
            const supplierLots = state.purchaseLines.filter(l => l.supplierId === supp.supplierId);

            return (
              <div
                key={supp.supplierId}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all"
              >
                {/* Main Card Strip */}
                <div className="p-4 sm:p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                          {supp.supplierName}
                        </h3>
                        {supp.moneyInHand > 0 && (
                          <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                            ₹{supp.moneyInHand.toFixed(0)} Ready to Pay
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-3 text-xs text-slate-500 mt-0.5 font-medium">
                        <span className="flex items-center space-x-1"><Phone className="w-3 h-3" /> {supp.phone}</span>
                        {supp.place && <span className="flex items-center space-x-1"><MapPin className="w-3 h-3" /> {supp.place}</span>}
                      </div>
                    </div>

                    {/* Pay Supplier Shortcut */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleExportStatementPdf(supp.supplierId)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
                      >
                        PDF Statement
                      </button>

                      <button
                        onClick={() => onOpenPaySupplier(supp.supplierId)}
                        className="flex items-center space-x-1 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow active:scale-95 transition-all"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Pay Supplier</span>
                      </button>
                    </div>
                  </div>

                  {/* 5 KPI Metric Columns (Section 8) */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-100 text-xs">
                    
                    {/* Total Due */}
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                        {t('suppliers.totalDue')}
                      </span>
                      <strong className="text-slate-900 font-extrabold text-sm sm:text-base">
                        {formatINR(supp.totalDue)}
                      </strong>
                    </div>

                    {/* Collected from Customers */}
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                        {t('suppliers.collected')}
                      </span>
                      <strong className="text-blue-700 font-extrabold text-sm sm:text-base">
                        {formatINR(supp.collectedFromCustomers)}
                      </strong>
                    </div>

                    {/* Paid Out */}
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                        {t('suppliers.paidOut')}
                      </span>
                      <strong className="text-slate-700 font-extrabold text-sm sm:text-base">
                        {formatINR(supp.paidOutToSupplier)}
                      </strong>
                    </div>

                    {/* Money in Hand */}
                    <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                      <span className="text-amber-800 font-bold block text-[10px] uppercase">
                        {t('suppliers.inHand')}
                      </span>
                      <strong className="text-amber-950 font-black text-sm sm:text-base">
                        {formatINR(supp.moneyInHand)}
                      </strong>
                    </div>

                    {/* Still to Collect */}
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                        {t('suppliers.toCollect')}
                      </span>
                      <strong className="text-slate-600 font-extrabold text-sm sm:text-base">
                        {formatINR(supp.stillToCollect)}
                      </strong>
                    </div>

                  </div>

                  {/* Crate Balance Owed */}
                  <div className="flex items-center justify-between text-xs bg-slate-50/70 p-2.5 rounded-xl text-slate-700">
                    <span className="flex items-center space-x-1 font-semibold">
                      <Box className="w-3.5 h-3.5 text-slate-500" />
                      <span>{t('suppliers.cratesOwed')}:</span>
                    </span>
                    <strong className="font-extrabold">
                      Big: <span className="text-tomato">{supp.cratesOwed['big'] || 0}</span> | Small: <span className="text-tomato">{supp.cratesOwed['small'] || 0}</span>
                    </strong>
                  </div>

                  {/* Toggle lot-wise breakdown */}
                  <button
                    onClick={() => setExpandedSupplierId(isExpanded ? null : supp.supplierId)}
                    className="w-full pt-1 text-center text-xs text-indigo-600 font-bold flex items-center justify-center space-x-1 hover:underline"
                  >
                    <span>{isExpanded ? 'Hide Lot Breakdown' : `View ${supplierLots.length} Stock Lots & Customers`}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* EXPANDED LOT-WISE BREAKDOWN (SECTION 8) */}
                {isExpanded && (
                  <div className="bg-slate-50 border-t border-slate-200 p-4 space-y-3 animate-in fade-in duration-150">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Purchase Lots & Customer Sales Breakdown
                    </h4>

                    {supplierLots.length === 0 ? (
                      <p className="text-xs text-slate-400">No purchase lots recorded yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {supplierLots.map(lot => {
                          const lotAllocations = state.sales.flatMap(s =>
                            s.allocations.filter(a => a.lotId === lot.id).map(a => ({ ...a, saleDate: s.saleDate, billNo: s.billNo, customerId: s.customerId }))
                          );

                          return (
                            <div key={lot.id} className="bg-white p-3 rounded-2xl border border-slate-200 text-xs space-y-2">
                              <div className="flex justify-between items-center font-bold">
                                <span className="text-indigo-900 font-mono text-sm">Lot {lot.lotNo} ({lot.categoryId.toUpperCase()})</span>
                                <span className="text-slate-600">
                                  Remaining: <strong className="text-slate-900">{lot.cratesRemaining}</strong> / {lot.cratesPurchased} crates
                                </span>
                              </div>

                              <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600">
                                <div>Cost/Crate: <strong>{formatINR(lot.effectiveCostPerCrate)}</strong></div>
                                <div>Total Cost: <strong>{formatINR(lot.cratesPurchased * lot.effectiveCostPerCrate)}</strong></div>
                                <div>Status: <strong className={lot.cratesRemaining === 0 ? 'text-emerald-700' : 'text-amber-700'}>{lot.cratesRemaining === 0 ? 'Fully Sold' : 'Open Stock'}</strong></div>
                              </div>

                              {/* Customer Sales on this lot */}
                              {lotAllocations.length > 0 && (
                                <div className="border-t border-slate-100 pt-2 space-y-1">
                                  <span className="text-[10px] uppercase font-bold text-slate-400">Customer Allocations:</span>
                                  {lotAllocations.map((alloc, idx) => {
                                    const cust = state.customers.find(c => c.id === alloc.customerId);
                                    return (
                                      <div key={idx} className="flex justify-between text-[11px] bg-slate-50 p-1.5 rounded-lg">
                                        <span>{cust?.name || 'Customer'} (Bill #{alloc.billNo})</span>
                                        <span className="font-bold text-slate-800">
                                          {alloc.crates} crates @ {formatINR(alloc.salePricePerCrate)} (Cost: {formatINR(alloc.costAmount)})
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

      {/* ADD SUPPLIER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 select-none">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
            <div className="bg-indigo-600 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-extrabold text-base">Add New Supplier</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3.5 text-slate-800 text-xs">
              {errorMsg && (
                <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2 rounded-xl font-bold">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Supplier Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Ramu Tomato Farm"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Place / Mandi</label>
                  <input
                    type="text"
                    value={place}
                    onChange={e => setPlace(e.target.value)}
                    placeholder="e.g. Dindigul"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">GST Number (Optional)</label>
                  <input
                    type="text"
                    value={gst}
                    onChange={e => setGst(e.target.value.toUpperCase())}
                    placeholder="e.g. 33AAAAA0000A1Z5"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 font-semibold uppercase"
                  />
                </div>
              </div>

              {/* Opening Balance */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-2">
                <span className="font-bold uppercase text-[11px] text-slate-700 block">
                  Opening Balances Owed
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-500 font-bold">Amount I Owe (₹)</label>
                    <input
                      type="number"
                      value={openingBalance || ''}
                      onChange={e => setOpeningBalance(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full h-9 px-2 rounded-lg border border-slate-300 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 font-bold">Big / Small Crates Owed</label>
                    <div className="grid grid-cols-2 gap-1">
                      <input
                        type="number"
                        value={openingBig || ''}
                        onChange={e => setOpeningBig(parseInt(e.target.value, 10) || 0)}
                        placeholder="Big"
                        className="h-9 px-1 rounded-lg border border-slate-300 text-xs font-bold text-center"
                      />
                      <input
                        type="number"
                        value={openingSmall || ''}
                        onChange={e => setOpeningSmall(parseInt(e.target.value, 10) || 0)}
                        placeholder="Small"
                        className="h-9 px-1 rounded-lg border border-slate-300 text-xs font-bold text-center"
                      />
                    </div>
                  </div>
                </div>
              </div>

            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSupplier}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md"
              >
                Save Supplier
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
