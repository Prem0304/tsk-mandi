// ============================================================================
// LOT EDIT MODAL (INWARD STOCK LOT & PURCHASE RATE MODIFICATION)
// Allows Owner to modify lot cost price, purchased crates, wastage & category
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../lib/db';
import { PurchaseLine } from '../../types';
import { formatINR } from '../../lib/utils';
import {
  X,
  Package,
  Truck,
  Building2,
  Coins,
  AlertTriangle,
  Save,
  CheckCircle2,
  Trash2,
  Info
} from 'lucide-react';

interface LotEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  lot: PurchaseLine | null;
  onSaved?: (updatedLot: PurchaseLine) => void;
}

export const LotEditModal: React.FC<LotEditModalProps> = ({
  isOpen,
  onClose,
  lot,
  onSaved
}) => {
  const { t, language } = useI18n();
  const { requestActionAuthorization } = useAuth();
  const { state } = useApp();

  const [categoryId, setCategoryId] = useState('big');
  const [cratesPurchased, setCratesPurchased] = useState<number>(0);
  const [pricePerCrate, setPricePerCrate] = useState<number>(0);
  const [cratesWasted, setCratesWasted] = useState<number>(0);
  const [formError, setFormError] = useState('');

  // Find parent purchase & supplier
  const parentPurchase = useMemo(() => {
    if (!lot?.purchaseId) return null;
    return state.purchases.find(p => p.id === lot.purchaseId) || null;
  }, [lot?.purchaseId, state.purchases]);

  const supplier = useMemo(() => {
    const sId = lot?.supplierId || parentPurchase?.supplierId;
    if (!sId) return null;
    return state.suppliers.find(s => s.id === sId) || null;
  }, [lot?.supplierId, parentPurchase?.supplierId, state.suppliers]);

  // Calculate crates already sold from this lot
  const soldFromLot = useMemo(() => {
    if (!lot?.id) return 0;
    return state.sales
      .flatMap(s => s.allocations || [])
      .filter(a => a.lotId === lot.id)
      .reduce((sum, a) => sum + (a.crates || 0), 0);
  }, [lot?.id, state.sales]);

  // Populate form on open
  useEffect(() => {
    if (isOpen && lot) {
      setCategoryId(lot.categoryId);
      setCratesPurchased(lot.cratesPurchased);
      setPricePerCrate(lot.pricePerCrate);
      setCratesWasted(lot.cratesWasted || 0);
      setFormError('');
    }
  }, [isOpen, lot]);

  if (!isOpen || !lot) return null;

  const transportShare = lot.transportShare || 0;
  const effectiveCost = pricePerCrate + transportShare;
  const lineTotal = cratesPurchased * pricePerCrate;
  const remainingPreview = Math.max(0, cratesPurchased - soldFromLot - cratesWasted);

  const handleSave = () => {
    setFormError('');

    if (cratesPurchased <= 0) {
      setFormError('Crates purchased must be greater than 0.');
      return;
    }

    if (pricePerCrate <= 0) {
      setFormError('Price per crate must be greater than ₹0.');
      return;
    }

    if (cratesPurchased < soldFromLot) {
      setFormError(
        `Cannot reduce crates to ${cratesPurchased} because ${soldFromLot} crates have already been sold from this lot!`
      );
      return;
    }

    if (cratesPurchased < soldFromLot + cratesWasted) {
      setFormError(
        `Total purchased (${cratesPurchased}) cannot be less than sold (${soldFromLot}) + wasted (${cratesWasted})!`
      );
      return;
    }

    const actionTitle = `Edit Inward Lot #${lot.lotNo}`;
    const actionDetails = `${supplier?.name || 'Supplier'} • ${cratesPurchased} crates @ ${formatINR(pricePerCrate)} (Total: ${formatINR(lineTotal)})`;

    requestActionAuthorization({
      actionName: actionTitle,
      actionDetails,
      onConfirm: () => {
        try {
          const updated = dbService.updatePurchaseLine(lot.id, {
            categoryId,
            cratesPurchased,
            pricePerCrate,
            cratesWasted
          });
          if (onSaved) onSaved(updated);
          onClose();
        } catch (err: any) {
          setFormError(err.message || 'Failed to update lot');
        }
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto safe-area-pt safe-area-pb select-none">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[95dvh] animate-in zoom-in-95 duration-150 shrink-0">
        
        {/* Header */}
        <div className="bg-blue-600 text-white px-5 py-4 flex items-center justify-between border-b border-blue-700">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-2xl bg-white/20 text-white border border-white/25">
              <Package className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-black text-base sm:text-lg">
                  Edit Stock Lot #{lot.lotNo}
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-white/20 text-white text-[10px] font-mono font-bold uppercase">
                  {lot.categoryId}
                </span>
              </div>
              <p className="text-xs text-blue-100">
                Modify purchase rate, inward crates, or wastage for this batch
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-slate-800 text-xs">
          
          {/* Error Banner */}
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Supplier & Bill Info Card */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1.5 font-bold text-slate-900">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>{supplier?.name || 'Supplier / Farmer'}</span>
              </span>
              <span className="text-[11px] font-mono text-slate-500 font-bold">
                Bill: {parentPurchase?.billNo || 'N/A'}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
              <span>Date: <strong className="text-slate-800">{parentPurchase?.purchaseDate || 'N/A'}</strong></span>
              {parentPurchase?.vehicleNo && (
                <span>Vehicle: <strong className="text-slate-800">{parentPurchase.vehicleNo}</strong></span>
              )}
            </div>
          </div>

          {/* Rate & Cost Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
              <Coins className="w-3.5 h-3.5 text-emerald-600" />
              <span>Bought Rate & Cost Adjustment</span>
            </h4>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">
                  Bought Price Per Crate (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    value={pricePerCrate || ''}
                    onChange={e => setPricePerCrate(parseFloat(e.target.value) || 0)}
                    placeholder="Rate"
                    className="w-full h-10 pl-7 pr-3 rounded-xl border border-slate-300 bg-white font-black text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">
                  Effective Cost/Crate (₹)
                </label>
                <div className="h-10 px-3 rounded-xl border border-slate-200 bg-slate-100 flex items-center font-bold text-slate-800">
                  {formatINR(effectiveCost)}
                  {transportShare > 0 && (
                    <span className="text-[10px] text-slate-500 ml-1">(+₹{transportShare} Tr)</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Crates & Stock Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
              <Package className="w-3.5 h-3.5 text-blue-600" />
              <span>Inward Crates & Stock Balance</span>
            </h4>

            <div className="grid grid-cols-3 gap-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">
                  Total Crates In *
                </label>
                <input
                  type="number"
                  min={soldFromLot}
                  value={cratesPurchased || ''}
                  onChange={e => setCratesPurchased(parseInt(e.target.value, 10) || 0)}
                  placeholder="Crates"
                  className="w-full h-10 px-2 rounded-xl border border-slate-300 bg-white font-black text-sm text-center focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">
                  Wasted / Spoiled
                </label>
                <input
                  type="number"
                  min="0"
                  value={cratesWasted || ''}
                  onChange={e => setCratesWasted(parseInt(e.target.value, 10) || 0)}
                  placeholder="0"
                  className="w-full h-10 px-2 rounded-xl border border-slate-300 bg-white font-bold text-sm text-center focus:border-rose-500 focus:outline-none text-rose-700"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">
                  Category
                </label>
                <select
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  className="w-full h-10 px-2 rounded-xl border border-slate-300 bg-white font-bold text-xs"
                >
                  {state.categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {language === 'ta' ? c.name_ta : c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Live Inventory Breakdown Banner */}
            <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between text-slate-700">
                <span>Crates Sold to Customers:</span>
                <strong className="text-slate-900 font-bold">{soldFromLot} crates</strong>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span>Remaining Open Stock:</span>
                <strong className={remainingPreview > 0 ? 'text-emerald-700 font-black' : 'text-slate-500 font-bold'}>
                  {remainingPreview} crates
                </strong>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-blue-200/60 font-semibold text-slate-800">
                <span>Total Lot Amount Payable:</span>
                <span className="text-sm font-black text-blue-900">{formatINR(lineTotal)}</span>
              </div>
            </div>
          </div>

          {/* Info note */}
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 flex items-start space-x-1.5">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Updating this lot's price will automatically update the supplier's due balance and adjust the cost margin on already allocated customer sales.
            </p>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 font-bold text-xs text-slate-700 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs shadow-md transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Save Lot Changes</span>
          </button>
        </div>

      </div>
    </div>
  );
};
