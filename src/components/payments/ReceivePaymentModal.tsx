// ============================================================================
// RECEIVE CUSTOMER PAYMENT MODAL (SECTION 9A CORE ALLOCATION ENGINE)
// Live Split Preview: Supplier Cost Share vs Transport Recovery vs Realised Profit
// ============================================================================

import React, { useState, useMemo } from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../lib/db';
import { formatINR, getTodayDateString } from '../../lib/utils';
import { calculatePaymentSplit } from '../../lib/allocationEngine';
import { PaymentReceived, PaymentMode } from '../../types';
import { X, ArrowDownLeft, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ReceivePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCustomerId?: string;
}

export const ReceivePaymentModal: React.FC<ReceivePaymentModalProps> = ({
  isOpen,
  onClose,
  defaultCustomerId
}) => {
  const { t } = useI18n();
  const { requestActionAuthorization } = useAuth();
  const { state, customerSummaries } = useApp();

  const [customerId, setCustomerId] = useState(defaultCustomerId || '');
  const [paymentDate, setPaymentDate] = useState(getTodayDateString());
  const [amount, setAmount] = useState<number>(0);
  const [mode, setMode] = useState<PaymentMode>('cash');
  const [referenceNo, setReferenceNo] = useState('');
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const selectedCustomer = useMemo(() => {
    return customerSummaries.find(c => c.customerId === customerId);
  }, [customerId, customerSummaries]);

  // Live Section 9A Payment Split Preview
  const splitPreview = useMemo(() => {
    if (!customerId || amount <= 0 || !selectedCustomer) return null;

    const openingBalanceClearedSoFar = state.paymentAllocations
      .filter(a => a.customerId === customerId && a.isOpeningBalance)
      .reduce((sum, a) => sum + a.allocatedAmount, 0);

    const customerSales = state.sales
      .filter(s => s.customerId === customerId && !s.deletedAt)
      .sort((a, b) => new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime());

    const lotsMap: Record<string, any> = {};
    state.purchaseLines.forEach(l => { lotsMap[l.id] = l; });
    const suppMap: Record<string, any> = {};
    state.suppliers.forEach(s => { suppMap[s.id] = { id: s.id, name: s.name }; });

    return calculatePaymentSplit(
      'preview-pay-id',
      customerId,
      amount,
      state.settings.paymentAllocationRule,
      selectedCustomer.openingBalance,
      openingBalanceClearedSoFar,
      customerSales,
      state.paymentAllocations,
      lotsMap,
      suppMap
    );
  }, [customerId, amount, selectedCustomer, state.paymentAllocations, state.sales, state.purchaseLines, state.suppliers, state.settings.paymentAllocationRule]);

  if (!isOpen) return null;

  const handleSave = () => {
    setErrorMsg('');

    if (!customerId) {
      setErrorMsg('Please select a customer.');
      return;
    }

    if (amount <= 0) {
      setErrorMsg('Please enter a valid payment amount greater than ₹0.');
      return;
    }

    try {
      const paymentId = `pay-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

      const newPayment: PaymentReceived = {
        id: paymentId,
        paymentDate,
        customerId,
        amount,
        mode,
        referenceNo: referenceNo || undefined,
        discount,
        notes: notes || undefined,
        allocations: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const targetCust = customerSummaries.find(c => c.customerId === customerId);
      requestActionAuthorization({
        actionName: 'Receive Customer Payment',
        actionDetails: `${targetCust?.customerName || 'Customer'} • ${formatINR(amount)} (${mode.toUpperCase()})`,
        onConfirm: () => {
          dbService.receivePayment(newPayment);
          onClose();
        }
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save payment');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 select-none">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-emerald-600 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-white/20">
              <ArrowDownLeft className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg">
                {t('payments.receivePayment')}
              </h3>
              <p className="text-xs text-white/80">Section 9A Auto-Split</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4 text-slate-800">
          
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Customer */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">
              {t('payments.customer')} *
            </label>
            <select
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-slate-50 font-semibold text-sm focus:border-emerald-600 focus:bg-white focus:outline-none"
            >
              <option value="">-- Choose Customer --</option>
              {customerSummaries.map(c => (
                <option key={c.customerId} value={c.customerId}>
                  {c.customerName} - Due: {formatINR(c.currentBalance)}
                </option>
              ))}
            </select>
          </div>

          {/* Customer Balance Info */}
          {selectedCustomer && (
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs flex justify-between items-center">
              <span className="text-slate-500">Current Outstanding:</span>
              <strong className={selectedCustomer.currentBalance > 0 ? 'text-rose-600 font-extrabold text-sm' : 'text-emerald-600 font-extrabold text-sm'}>
                {formatINR(selectedCustomer.currentBalance)}
              </strong>
            </div>
          )}

          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                {t('payments.amount')} *
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={amount || ''}
                onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full h-11 px-3 rounded-xl border-2 border-slate-300 text-emerald-800 font-black text-lg focus:border-emerald-600 focus:outline-none text-right"
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

          {/* Payment Mode & Reference */}
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
                <option value="upi">UPI (GPay/PhonePe)</option>
                <option value="bank">Bank Transfer</option>
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
                placeholder="Optional ref"
                className="w-full h-10 px-2 rounded-xl border border-slate-300 text-xs font-medium"
              />
            </div>
          </div>

          {/* Settlement Discount / Round-off */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">
              {t('payments.discount')}
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={discount || ''}
              onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
              placeholder="e.g. ₹40 round-off waiver"
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-semibold text-rose-600"
            />
            <p className="text-[10px] text-slate-400">
              Discounts reduce shop profit first. The supplier share is never reduced.
            </p>
          </div>

          {/* LIVE SECTION 9A SPLIT PREVIEW */}
          {splitPreview && (
            <div className="bg-amber-50 border-2 border-amber-300 p-3 rounded-2xl space-y-1.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-amber-900 font-extrabold text-xs">
                <span>{t('payments.splitPreview')}</span>
                <span className="text-[10px] bg-amber-200 px-1.5 py-0.5 rounded font-bold uppercase">
                  {state.settings.paymentAllocationRule === 'supplier_first' ? 'Supplier First' : 'Proportional'}
                </span>
              </div>
              
              <div className="space-y-1 text-xs text-amber-950 pt-1 border-t border-amber-200/80">
                {splitPreview.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-0.5">
                    <span>{item.description}</span>
                    <strong className="text-amber-900">{formatINR(item.amount)}</strong>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center text-[11px] font-bold text-amber-800 pt-1.5 border-t border-amber-200">
                <span>Supplier Money in Hand: +{formatINR(splitPreview.totalSupplierShare)}</span>
                <span className="text-emerald-700">Realised Profit: +{formatINR(splitPreview.totalProfitShare)}</span>
              </div>
            </div>
          )}

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
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-black text-sm text-white shadow-lg active:scale-95 transition-all"
          >
            {t('common.save')}
          </button>
        </div>

      </div>
    </div>
  );
};
