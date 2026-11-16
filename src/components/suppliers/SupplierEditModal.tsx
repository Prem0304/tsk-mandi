// ============================================================================
// SUPPLIER ADD / EDIT MODAL WITH AMOUNT & CRATE ADJUSTMENT
// Allows adding new suppliers or editing existing suppliers including their
// Opening Balance (Payable), Crates Owed, Direct Target Balance, and Contact Info
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../lib/db';
import { Supplier } from '../../types';
import { formatINR, getTodayDateString } from '../../lib/utils';
import {
  X,
  Building2,
  Phone,
  MapPin,
  Coins,
  Package,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Calculator,
  Save,
  FileText
} from 'lucide-react';

interface SupplierEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier?: Supplier | null; // null/undefined for Add New, Supplier object for Edit
  onSaved?: (supplier: Supplier) => void;
}

export const SupplierEditModal: React.FC<SupplierEditModalProps> = ({
  isOpen,
  onClose,
  supplier,
  onSaved
}) => {
  const { t, language } = useI18n();
  const { requestActionAuthorization } = useAuth();
  const { state, supplierSummaries } = useApp();

  const isEditing = Boolean(supplier && supplier.id);

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [place, setPlace] = useState('');
  const [gst, setGst] = useState('');
  const [notes, setNotes] = useState('');

  // Financial & Amount Fields
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [openingDate, setOpeningDate] = useState(getTodayDateString());
  const [openingBigCrates, setOpeningBigCrates] = useState<number>(0);
  const [openingSmallCrates, setOpeningSmallCrates] = useState<number>(0);

  // Direct Target Balance Setter
  const [targetBalanceInput, setTargetBalanceInput] = useState<string>('');

  const [formError, setFormError] = useState('');

  // Summary for this supplier if editing
  const summary = useMemo(() => {
    if (!supplier?.id) return null;
    return supplierSummaries.find(s => s.supplierId === supplier.id);
  }, [supplier?.id, supplierSummaries]);

  // Net amount from purchases & payments: (Total Purchases - Paid Out)
  const transactionNetBalance = useMemo(() => {
    if (!summary) return 0;
    const purchasesDue = (summary.totalDue || 0) - (supplier?.openingMoneyBalance || 0);
    return purchasesDue - (summary.paidOutToSupplier || 0);
  }, [summary, supplier?.openingMoneyBalance]);

  // Resulting Net Total Balance Payable
  const previewTotalBalance = (openingBalance || 0) + transactionNetBalance;

  // Populate or reset form whenever modal opens or supplier changes
  useEffect(() => {
    if (isOpen) {
      setFormError('');
      setTargetBalanceInput('');
      if (supplier) {
        setName(supplier.name || '');
        setPhone(supplier.phone || '');
        setAltPhone(supplier.altPhone || '');
        setPlace(supplier.place || '');
        setGst(supplier.gstNumber || '');
        setOpeningBalance(supplier.openingMoneyBalance || 0);
        setOpeningDate(supplier.openingBalanceDate || getTodayDateString());
        setOpeningBigCrates(supplier.openingCrates?.['big'] || 0);
        setOpeningSmallCrates(supplier.openingCrates?.['small'] || 0);
        setNotes(supplier.notes || '');
      } else {
        setName('');
        setPhone('');
        setAltPhone('');
        setPlace('');
        setGst('');
        setOpeningBalance(0);
        setOpeningDate(getTodayDateString());
        setOpeningBigCrates(0);
        setOpeningSmallCrates(0);
        setNotes('');
      }
    }
  }, [isOpen, supplier]);

  // Handler for direct target balance application
  const handleApplyTargetBalance = () => {
    const target = parseFloat(targetBalanceInput);
    if (isNaN(target)) {
      setFormError('Please enter a valid numeric target balance.');
      return;
    }
    // Required opening balance = target - transactionNetBalance
    const computedOpening = Math.round((target - transactionNetBalance) * 100) / 100;
    setOpeningBalance(computedOpening);
    setTargetBalanceInput('');
    setFormError('');
  };

  const handleSave = () => {
    setFormError('');

    if (!name.trim()) {
      setFormError('Supplier Name is required.');
      return;
    }

    if (!phone.trim()) {
      setFormError('Phone number is required.');
      return;
    }

    const supplierId = supplier?.id || `sup-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    const updatedSupplier: Supplier = {
      id: supplierId,
      name: name.trim(),
      phone: phone.trim(),
      altPhone: altPhone.trim() || undefined,
      place: place.trim() || undefined,
      gstNumber: gst.trim() || undefined,
      openingMoneyBalance: openingBalance,
      openingBalanceDate: openingDate,
      openingCrates: {
        big: openingBigCrates,
        small: openingSmallCrates
      },
      notes: notes.trim() || undefined,
      isActive: supplier?.isActive ?? true,
      createdAt: supplier?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: supplier?.deletedAt
    };

    const actionTitle = isEditing
      ? `Edit Supplier: ${updatedSupplier.name}`
      : `Add Supplier: ${updatedSupplier.name}`;

    const actionDetails = isEditing
      ? `Update profile, opening balance ${formatINR(openingBalance)} & crates (${openingBigCrates} Big, ${openingSmallCrates} Small)`
      : `New supplier with opening balance ${formatINR(openingBalance)}`;

    requestActionAuthorization({
      actionName: actionTitle,
      actionDetails,
      onConfirm: () => {
        dbService.saveSupplier(updatedSupplier);
        if (onSaved) onSaved(updatedSupplier);
        onClose();
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto safe-area-pt safe-area-pb select-none">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[95dvh] animate-in zoom-in-95 duration-150 shrink-0">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Building2 className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-black text-base sm:text-lg">
                {isEditing ? 'Edit Supplier Details' : 'Add New Supplier'}
              </h3>
              <p className="text-xs text-slate-400">
                {isEditing ? `Modify balances, crates & details for ${supplier?.name}` : 'Register a new farmer / supplier'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-slate-800">
          
          {/* Error Banner */}
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Current Balance Summary Banner (If Editing) */}
          {isEditing && summary && (
            <div className="p-3.5 bg-gradient-to-r from-slate-50 to-indigo-50/40 rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-slate-500 font-semibold block text-[11px]">Total Balance Payable</span>
                <span className="text-base font-black text-indigo-700">
                  {formatINR(summary.balancePayable)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 font-semibold block text-[11px]">Money in Hand (Ready to Pay)</span>
                <span className="text-sm font-bold text-emerald-600">
                  {formatINR(summary.moneyInHand)}
                </span>
              </div>
              <div className="w-full pt-1 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600">
                <span>Crates Owed to Supplier:</span>
                <strong className="text-slate-900 font-bold">
                  Big: {summary.cratesOwed['big'] || 0} | Small: {summary.cratesOwed['small'] || 0}
                </strong>
              </div>
            </div>
          )}

          {/* Section 1: Contact & Profile */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Supplier & Contact Info</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Supplier / Farmer Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Ramu Farmer / Thangavelu"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 font-semibold text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Phone Number *</label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="10-digit mobile"
                    className="w-full h-10 pl-8 pr-3 rounded-xl border border-slate-300 font-semibold text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Alternate Phone</label>
                <input
                  type="tel"
                  value={altPhone}
                  onChange={e => setAltPhone(e.target.value)}
                  placeholder="Secondary phone"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 font-semibold text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Place / Village / Market Yard</label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    value={place}
                    onChange={e => setPlace(e.target.value)}
                    placeholder="e.g. Thevaram / Bodinayakanur"
                    className="w-full h-10 pl-8 pr-3 rounded-xl border border-slate-300 font-semibold text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-700">GST Number (Optional)</label>
                <input
                  type="text"
                  value={gst}
                  onChange={e => setGst(e.target.value.toUpperCase())}
                  placeholder="e.g. 33AAAAA0000A1Z5"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 font-semibold text-xs focus:border-indigo-500 focus:outline-none uppercase font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Financial Amount & Balance Adjustment */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                <Coins className="w-3.5 h-3.5 text-emerald-600" />
                <span>Opening Due Balance & Amount Adjustment</span>
              </h4>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/90 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                    <span>Opening Payable Amount (₹)</span>
                    <span className="text-[10px] text-slate-400 font-normal">Starting balance owed</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={openingBalance || ''}
                    onChange={e => setOpeningBalance(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white font-bold text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Opening Balance Date</label>
                  <input
                    type="date"
                    value={openingDate}
                    onChange={e => setOpeningDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white font-semibold text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Direct Target Balance Calculator */}
              {isEditing && (
                <div className="p-3 bg-white rounded-xl border border-indigo-100 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-indigo-950 flex items-center space-x-1">
                      <Calculator className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Direct Target Balance Setter</span>
                    </span>
                    <span className="text-[10px] text-slate-500">Auto-calculates opening amount</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Want the total supplier balance to equal an agreed amount? Type the target number below and click <strong>Apply</strong>:
                  </p>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      step="any"
                      placeholder={`e.g. 15000`}
                      value={targetBalanceInput}
                      onChange={e => setTargetBalanceInput(e.target.value)}
                      className="flex-1 h-9 px-3 rounded-lg border border-indigo-200 text-xs font-bold focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleApplyTargetBalance}
                      className="px-3 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shrink-0 shadow-sm"
                    >
                      Apply Target
                    </button>
                  </div>
                </div>
              )}

              {/* Resulting Balance Live Preview */}
              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-semibold">Resulting Total Balance Payable:</span>
                <span className="text-sm font-black text-indigo-700">
                  {formatINR(previewTotalBalance)}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Crates Owed to Supplier */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
              <Package className="w-3.5 h-3.5 text-amber-600" />
              <span>Opening Empty Crates Owed to Supplier</span>
            </h4>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/90">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Big Crates (பெரிய பெட்டி)</label>
                <input
                  type="number"
                  min="0"
                  value={openingBigCrates || ''}
                  onChange={e => setOpeningBigCrates(parseInt(e.target.value, 10) || 0)}
                  placeholder="0"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white font-bold text-sm text-center focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Small Crates (சிறிய பெட்டி)</label>
                <input
                  type="number"
                  min="0"
                  value={openingSmallCrates || ''}
                  onChange={e => setOpeningSmallCrates(parseInt(e.target.value, 10) || 0)}
                  placeholder="0"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white font-bold text-sm text-center focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Notes */}
          <div className="space-y-1 pt-1">
            <label className="text-[11px] font-bold text-slate-700">Notes / Remarks</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Tomato farmer from Thevaram, delivers every Tuesday..."
              className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold text-xs focus:border-indigo-500 focus:outline-none"
            />
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
            className="flex items-center space-x-1.5 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs shadow-md transition-all"
          >
            <Save className="w-4 h-4" />
            <span>{isEditing ? 'Save Supplier Changes' : 'Register Supplier'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
