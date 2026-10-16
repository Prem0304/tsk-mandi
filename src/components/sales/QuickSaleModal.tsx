// ============================================================================
// QUICK SALE MODE (SECTION 7.2 - BUSY MANDI HOURS)
// Single high-speed screen: Customer, Big Qty/Price, Small Qty/Price, Received Amount
// Rapid reset after saving for the next customer
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../lib/db';
import { formatINR, generateBillNo, getTodayDateString, formatDateWithDay } from '../../lib/utils';
import { allocateLotsFIFO } from '../../lib/allocationEngine';
import { Sale, SaleLine, SaleLotAllocation } from '../../types';
import { Zap, X, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface QuickSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaleSaved: (sale: Sale) => void;
}

export const QuickSaleModal: React.FC<QuickSaleModalProps> = ({
  isOpen,
  onClose,
  onSaleSaved
}) => {
  const { t, language } = useI18n();
  const { state, customerSummaries } = useApp();

  const [customerId, setCustomerId] = useState('');
  const [bigQty, setBigQty] = useState<number>(0);
  const [bigPrice, setBigPrice] = useState<number>(350);
  const [smallQty, setSmallQty] = useState<number>(0);
  const [smallPrice, setSmallPrice] = useState<number>(240);
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastSavedBill, setLastSavedBill] = useState('');

  const customerSelectRef = useRef<HTMLSelectElement>(null);

  // Load default prices on mount/open
  useEffect(() => {
    if (isOpen) {
      const bigRate = dbService.getTodayRate('big')?.selling || 350;
      const smallRate = dbService.getTodayRate('small')?.selling || 240;
      setBigPrice(bigRate);
      setSmallPrice(smallRate);
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setCustomerId('');
    setBigQty(0);
    setSmallQty(0);
    setAmountReceived(0);
    setErrorMsg('');
    setTimeout(() => customerSelectRef.current?.focus(), 50);
  };

  const bigAvail = dbService.getAvailableStock('big');
  const smallAvail = dbService.getAvailableStock('small');

  const subtotal = (bigQty * bigPrice) + (smallQty * smallPrice);

  const handleSave = () => {
    setErrorMsg('');

    if (!customerId) {
      setErrorMsg('Select a customer');
      return;
    }

    if (bigQty <= 0 && smallQty <= 0) {
      setErrorMsg('Enter at least 1 Big or Small crate quantity');
      return;
    }

    if (bigQty > bigAvail) {
      setErrorMsg(`Big crates exceed available stock (${bigAvail})!`);
      return;
    }

    if (smallQty > smallAvail) {
      setErrorMsg(`Small crates exceed available stock (${smallAvail})!`);
      return;
    }

    try {
      const openLots = state.purchaseLines.filter(l => l.cratesRemaining > 0);
      const saleId = `sale-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const billNo = generateBillNo(state.settings.billPrefix || 'TSK-', state.sales.length);

      const lines: SaleLine[] = [];
      const allocations: SaleLotAllocation[] = [];

      if (bigQty > 0) {
        const slineId = `sline-${saleId}-big`;
        lines.push({
          id: slineId,
          saleId,
          categoryId: 'big',
          crates: bigQty,
          pricePerCrate: bigPrice,
          lineTotal: bigQty * bigPrice
        });

        const res = allocateLotsFIFO('big', bigQty, bigPrice, openLots);
        res.allocations.forEach((a, i) => {
          allocations.push({
            ...a,
            id: `salloc-${saleId}-big-${i}`,
            saleId,
            saleLineId: slineId,
            collectedAmount: 0,
            supplierClearedAmount: 0
          });
        });
      }

      if (smallQty > 0) {
        const slineId = `sline-${saleId}-small`;
        lines.push({
          id: slineId,
          saleId,
          categoryId: 'small',
          crates: smallQty,
          pricePerCrate: smallPrice,
          lineTotal: smallQty * smallPrice
        });

        const res = allocateLotsFIFO('small', smallQty, smallPrice, openLots);
        res.allocations.forEach((a, i) => {
          allocations.push({
            ...a,
            id: `salloc-${saleId}-small-${i}`,
            saleId,
            saleLineId: slineId,
            collectedAmount: 0,
            supplierClearedAmount: 0
          });
        });
      }

      const totalCrates = bigQty + smallQty;
      const newSale: Sale = {
        id: saleId,
        saleDate: getTodayDateString(),
        customerId,
        billNo,
        lines,
        allocations,
        transportCharge: 0,
        discount: 0,
        roundOff: 0,
        subtotalAmount: subtotal,
        billTotal: subtotal,
        amountReceivedNow: amountReceived,
        paymentMode: amountReceived > 0 ? 'cash' : undefined,
        totalCrates,
        emptyCratesIssued: { big: bigQty, small: smallQty },
        emptyCratesReturned: { big: 0, small: 0 },
        notes: 'Quick sale entry',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      dbService.recordSale(newSale, 'cash');
      setLastSavedBill(`${billNo} (₹${subtotal}) saved!`);
      onSaleSaved(newSale);
      resetForm();
    } catch (err: any) {
      setErrorMsg(err.message || 'Quick sale failed');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 select-none">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        
        {/* Rapid Header */}
        <div className="bg-amber-500 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 fill-white text-white" />
            <div>
              <h3 className="font-black text-base sm:text-lg leading-tight">
                {t('sales.quickSaleTitle')}
              </h3>
              <p className="text-[11px] text-amber-100 font-bold">
                {formatDateWithDay(new Date(), language, false)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white hover:bg-white/10">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 sm:p-5 space-y-3.5">
          
          {lastSavedBill && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-2 rounded-xl text-xs font-bold flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{lastSavedBill}</span>
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2 rounded-xl text-xs font-bold flex items-center space-x-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Customer Dropdown */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Customer
            </label>
            <select
              ref={customerSelectRef}
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              className="w-full h-12 px-3 rounded-xl border-2 border-slate-300 bg-slate-50 font-bold text-sm focus:border-amber-500 focus:bg-white focus:outline-none"
            >
              <option value="">-- Select Customer --</option>
              {customerSummaries.map(c => (
                <option key={c.customerId} value={c.customerId}>
                  {c.customerName} {c.shopName ? `(${c.shopName})` : ''} - Bal: {formatINR(c.currentBalance)}
                </option>
              ))}
            </select>
          </div>

          {/* Big Crates */}
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
            <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
              <span>Big Crates (பெரிய)</span>
              <span className="text-slate-400">Stock: <strong className="text-slate-800">{bigAvail}</strong></span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={bigQty || ''}
                onChange={e => setBigQty(parseInt(e.target.value, 10) || 0)}
                placeholder="Qty (பெட்டி)"
                className="h-12 px-3 rounded-xl border border-slate-300 bg-white font-extrabold text-base text-center focus:border-amber-500 focus:outline-none"
              />
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={bigPrice || ''}
                onChange={e => setBigPrice(parseFloat(e.target.value) || 0)}
                placeholder="Price ₹"
                className="h-12 px-3 rounded-xl border border-slate-300 bg-white font-extrabold text-base text-right focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Small Crates */}
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
            <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
              <span>Small Crates (சிறிய)</span>
              <span className="text-slate-400">Stock: <strong className="text-slate-800">{smallAvail}</strong></span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={smallQty || ''}
                onChange={e => setSmallQty(parseInt(e.target.value, 10) || 0)}
                placeholder="Qty (பெட்டி)"
                className="h-12 px-3 rounded-xl border border-slate-300 bg-white font-extrabold text-base text-center focus:border-amber-500 focus:outline-none"
              />
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={smallPrice || ''}
                onChange={e => setSmallPrice(parseFloat(e.target.value) || 0)}
                placeholder="Price ₹"
                className="h-12 px-3 rounded-xl border border-slate-300 bg-white font-extrabold text-base text-right focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Amount Received Now */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Amount Received Now (Cash ₹)
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={amountReceived || ''}
              onChange={e => setAmountReceived(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-full h-12 px-3 rounded-xl border-2 border-slate-300 bg-emerald-50/50 text-emerald-800 font-black text-lg focus:border-emerald-600 focus:outline-none text-right"
            />
          </div>

          {/* Total Display */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900 text-white">
            <span className="text-xs font-bold text-slate-400">Total:</span>
            <span className="text-xl font-black">{formatINR(subtotal)}</span>
          </div>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSave}
            className="w-full h-14 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black text-base rounded-2xl shadow-lg transition-all"
          >
            Save & Next Customer (சேமி)
          </button>

        </div>

      </div>
    </div>
  );
};
