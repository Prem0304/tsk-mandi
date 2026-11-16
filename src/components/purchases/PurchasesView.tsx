// ============================================================================
// PURCHASES & INWARD STOCK LOTS VIEW
// Complete Management of Inward Batches, Purchase Bills, Rates & Lot Editing
// ============================================================================

import React, { useState, useMemo } from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../lib/db';
import { PurchaseLine, Purchase } from '../../types';
import { formatINR, formatDate, getTodayDateString } from '../../lib/utils';
import { LotEditModal } from './LotEditModal';
import {
  Truck,
  Search,
  Plus,
  Package,
  Pencil,
  Building2,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock,
  Filter
} from 'lucide-react';

interface PurchasesViewProps {
  onOpenNewPurchase: () => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({ onOpenNewPurchase }) => {
  const { t, language } = useI18n();
  const { state } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'sold'>('all');
  const [selectedLotForEdit, setSelectedLotForEdit] = useState<PurchaseLine | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Map of suppliers for quick lookup
  const supplierMap = useMemo(() => {
    const map = new Map<string, string>();
    state.suppliers.forEach(s => map.set(s.id, s.name));
    return map;
  }, [state.suppliers]);

  // Map of purchases for quick lookup
  const purchaseMap = useMemo(() => {
    const map = new Map<string, Purchase>();
    state.purchases.forEach(p => map.set(p.id, p));
    return map;
  }, [state.purchases]);

  // Filtered and sorted purchase lines (lots)
  const filteredLots = useMemo(() => {
    return state.purchaseLines
      .filter(lot => {
        // Parent purchase must not be deleted
        const parent = purchaseMap.get(lot.purchaseId);
        if (parent && parent.deletedAt) return false;

        // Category filter
        if (selectedCategory !== 'all' && lot.categoryId !== selectedCategory) {
          return false;
        }

        // Status filter
        if (statusFilter === 'open' && lot.cratesRemaining <= 0) return false;
        if (statusFilter === 'sold' && lot.cratesRemaining > 0) return false;

        // Search query (Lot No, Supplier Name, Bill No, Date)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const suppName = (supplierMap.get(lot.supplierId) || '').toLowerCase();
          const lotNo = (lot.lotNo || '').toLowerCase();
          const billNo = (parent?.billNo || '').toLowerCase();
          const date = (parent?.purchaseDate || '').toLowerCase();
          return lotNo.includes(q) || suppName.includes(q) || billNo.includes(q) || date.includes(q);
        }

        return true;
      })
      .sort((a, b) => {
        // Sort newest first
        const pA = purchaseMap.get(a.purchaseId);
        const pB = purchaseMap.get(b.purchaseId);
        const dateA = pA ? new Date(pA.purchaseDate).getTime() : 0;
        const dateB = pB ? new Date(pB.purchaseDate).getTime() : 0;
        return dateB - dateA;
      });
  }, [state.purchaseLines, purchaseMap, supplierMap, selectedCategory, statusFilter, searchQuery]);

  // High-level Metrics
  const totalInwardCrates = useMemo(() => {
    return state.purchaseLines.reduce((s, l) => s + (l.cratesPurchased || 0), 0);
  }, [state.purchaseLines]);

  const totalInwardAmount = useMemo(() => {
    return state.purchases
      .filter(p => !p.deletedAt)
      .reduce((s, p) => s + (p.netAmount || 0), 0);
  }, [state.purchases]);

  const openLotsCount = useMemo(() => {
    return state.purchaseLines.filter(l => l.cratesRemaining > 0).length;
  }, [state.purchaseLines]);

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4 pb-24 select-none">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center space-x-2">
            <Truck className="w-6 h-6 text-blue-600" />
            <span>Stock Inward Purchases & Lots</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage bought lots, purchase rates, stock arrivals & supplier batch history
          </p>
        </div>

        <button
          onClick={onOpenNewPurchase}
          className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Stock Purchase</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-slate-400 font-bold block text-[11px] uppercase tracking-wide">
            Total Inward Purchases
          </span>
          <strong className="text-xl font-black text-slate-900 block mt-0.5">
            {formatINR(totalInwardAmount)}
          </strong>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {state.purchases.filter(p => !p.deletedAt).length} purchase bills recorded
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-slate-400 font-bold block text-[11px] uppercase tracking-wide">
            Total Crates Received
          </span>
          <strong className="text-xl font-black text-indigo-700 block mt-0.5">
            {totalInwardCrates} Crates
          </strong>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Across {state.categories.length} crate categories
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-slate-400 font-bold block text-[11px] uppercase tracking-wide">
            Active Open Lots (FIFO)
          </span>
          <strong className="text-xl font-black text-emerald-600 block mt-0.5">
            {openLotsCount} Open Batches
          </strong>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Ready to be sold to customers
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search lot number (e.g. L-0001), supplier, bill, date..."
              className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 bg-slate-50/70 font-semibold text-xs focus:bg-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="h-10 px-3 rounded-xl border border-slate-200 bg-slate-50/70 font-bold text-xs focus:bg-white focus:outline-none"
          >
            <option value="all">All Categories</option>
            {state.categories.map(c => (
              <option key={c.id} value={c.id}>
                {language === 'ta' ? c.name_ta : c.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('open')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'open' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Open Stock
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('sold')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'sold' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Fully Sold
            </button>
          </div>
        </div>
      </div>

      {/* Lots List */}
      <div className="space-y-3">
        {filteredLots.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-2">
            <Package className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="font-bold text-slate-700 text-sm">No Inward Lots Found</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery ? `No lots matched "${searchQuery}".` : 'No inward stock purchases have been recorded yet.'}
            </p>
          </div>
        ) : (
          filteredLots.map(lot => {
            const parent = purchaseMap.get(lot.purchaseId);
            const suppName = supplierMap.get(lot.supplierId) || 'Supplier / Farmer';
            const isFullySold = lot.cratesRemaining <= 0;

            return (
              <div
                key={lot.id}
                className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all space-y-3"
              >
                {/* Lot Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2.5">
                    <span className="font-mono font-black text-sm px-2.5 py-1 rounded-xl bg-blue-50 text-blue-800 border border-blue-200">
                      Lot #{lot.lotNo}
                    </span>
                    <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                      {lot.categoryId}
                    </span>
                    {isFullySold ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3 text-slate-500" />
                        <span>Fully Sold</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Open: {lot.cratesRemaining} crates</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLotForEdit(lot);
                        setIsEditModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-700 font-extrabold text-xs flex items-center space-x-1.5 shadow-xs transition-all active:scale-95"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit Lot</span>
                    </button>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200/70">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Supplier / Farmer</span>
                    <strong className="text-slate-900 font-extrabold truncate block">
                      {suppName}
                    </strong>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Bill: {parent?.billNo || 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Arrival Date</span>
                    <strong className="text-slate-800 font-bold block">
                      {parent?.purchaseDate || 'N/A'}
                    </strong>
                    {parent?.vehicleNo && (
                      <span className="text-[10px] text-slate-500">
                        Veh: {parent.vehicleNo}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Bought Price / Cost</span>
                    <strong className="text-slate-900 font-black block">
                      {formatINR(lot.pricePerCrate)} / crate
                    </strong>
                    <span className="text-[10px] text-slate-500">
                      Eff: {formatINR(lot.effectiveCostPerCrate)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Crates Inventory</span>
                    <strong className="text-slate-900 font-extrabold block">
                      {lot.cratesPurchased} Inward
                    </strong>
                    <span className="text-[10px] text-slate-500">
                      Sold: {lot.cratesPurchased - lot.cratesRemaining} • Rem: {lot.cratesRemaining}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* LOT EDIT MODAL */}
      <LotEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedLotForEdit(null);
        }}
        lot={selectedLotForEdit}
      />

    </div>
  );
};
