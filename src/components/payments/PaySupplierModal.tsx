// ============================================================================
// PAY SUPPLIER MODAL (SECTION 8 - SUPPLIER SETTLEMENT)
// Pre-fills with "Money in Hand for Supplier" (Collected from Customers)
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../lib/db';
import { formatINR, getTodayDateString } from '../../lib/utils';
import { PaymentMade, PaymentMode } from '../../types';
import { X, ArrowUpRight, AlertCircle, DollarSign } from 'lucide-react';

interface PaySupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSupplierId?: string;
}

export const PaySupplierModal: React.FC<PaySupplierModalProps> = ({
  isOpen,
  onClose,
  defaultSupplierId
}) => {
  const { t } = useI18n();
  const { requestActionAuthorization } = useAuth();
  const { state, supplierSummaries } = useApp();

  const [supplierId, setSupplierId] = useState(defaultSupplierId || '');
  const [paymentDate, setPaymentDate] = useState(getTodayDateString());
  const [amount, setAmount] = useState<number>(0);
  const [mode, setMode] = useState<PaymentMode>('cash');
  const [referenceNo, setReferenceNo] = useState('');
  const [purchaseId, setPurchaseId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const selectedSupplier = useMemo(() => {
    return supplierSummaries.find(s => s.supplierId === supplierId);
  }, [supplierId, supplierSummaries]);

  // When supplier selected, default amount to Money in Hand if available, else Balance Payable
  useEffect(() => {
    if (selectedSupplier) {
      if (selectedSupplier.moneyInHand > 0) {
        setAmount(selectedSupplier.moneyInHand);
      } else if (selectedSupplier.balancePayable > 0) {
        setAmount(selectedSupplier.balancePayable);
      }
    }
  }, [selectedSupplier]);

  if (!isOpen) return null;

  const handlePreFillMoneyInHand = () => {
    if (selectedSupplier) {
      setAmount(selectedSupplier.moneyInHand);
    }
  };

  const handleSave = () => {
    setErrorMsg('');

    if (!supplierId) {
      setErrorMsg('Please select a supplier.');
      return;
    }

    if (amount <= 0) {
      setErrorMsg('Please enter a valid amount greater than ₹0.');
      return;
    }

    try {
      const pmId = `pm-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

      const newPayment: PaymentMade = {
        id: pmId,
        paymentDate,
        supplierId,
        purchaseId: purchaseId || undefined,
        amount,
        mode,
        referenceNo: referenceNo || undefined,
        notes: notes || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      requestActionAuthorization({
        actionName: 'Pay Supplier (Settlement)',
        actionDetails: `${selectedSupplier?.supplierName || 'Supplier'} • ${formatINR(amount)} (${mode.toUpperCase()})`,
        onConfirm: () => {
          dbService.paySupplier(newPayment);
          onClose();
        }
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record supplier payment');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 select-none">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-indigo-600 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-white/20">
              <ArrowUpRight className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg">
                {t('payments.paySupplier')}
              </h3>
              <p className="text-xs text-white/80">Supplier Clearance & Settlement</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-slate-800">
          
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Supplier Select */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">
              {t('payments.supplier')} *
            </label>
            <select
              value={supplierId}
              onChange={e => setSupplierId(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-slate-50 font-semibold text-sm focus:border-indigo-600 focus:bg-white focus:outline-none"
            >
              <option value="">-- Choose Supplier --</option>
              {supplierSummaries.map(s => (
                <option key={s.supplierId} value={s.supplierId}>
                  {s.supplierName} - Due: {formatINR(s.balancePayable)} (In Hand: {formatINR(s.moneyInHand)})
                </option>
              ))}
            </select>
          </div>

          {/* Supplier Money in Hand Strip & Quick Pre-fill */}
          {selectedSupplier && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-amber-800 font-medium">Money in Hand (Collected):</span>
                <strong className="text-amber-950 font-extrabold text-sm">{formatINR(selectedSupplier.moneyInHand)}</strong>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Total Balance Payable:</span>
                <strong className="text-rose-700 font-bold">{formatINR(selectedSupplier.balancePayable)}</strong>
              </div>
              
              {selectedSupplier.moneyInHand > 0 && (
                <button
                  type="button"
                  onClick={handlePreFillMoneyInHand}
                  className="w-full py-1.5 px-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center space-x-1"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>{t('payments.payCollectedAmount', { amount: formatINR(selectedSupplier.moneyInHand) })}</span>
                </button>
              )}
            </div>
          )}

          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Amount Paid (₹) *
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={amount || ''}
                onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full h-11 px-3 rounded-xl border-2 border-slate-300 text-indigo-900 font-black text-lg focus:border-indigo-600 focus:outline-none text-right"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                {t('common.date')}
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-slate-50 font-semibold text-xs"
              />
            </div>
          </div>

          {/* Mode & Reference */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                {t('payments.mode')}
              </label>
              <select
                value={mode}
                onChange={e => setMode(e.target.value as PaymentMode)}
                className="w-full h-10 px-2 rounded-xl border border-slate-300 bg-slate-50 font-semibold text-xs"
              >
                <option value="cash">Cash (ரொக்கம்)</option>
                <option value="upi">UPI</option>
                <option value="bank">Bank</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Ref / Cheque No
              </label>
              <input
                type="text"
                value={referenceNo}
                onChange={e => setReferenceNo(e.target.value)}
                placeholder="Optional"
                className="w-full h-10 px-2 rounded-xl border border-slate-300 text-xs font-medium"
              />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100"
          >
            {t('common.cancel')}
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-black text-sm text-white shadow-lg active:scale-95 transition-all"
          >
            {t('common.save')}
          </button>
        </div>

      </div>
    </div>
  );
};
