// ============================================================================
// PURCHASE ENTRY MODAL (STOCK IN & LOT CREATION - SECTION 5)
// Multi-line Crates, Transport Options, Hamali, Crate Ownership, Supplier Ledger
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../lib/db';
import { formatINR, generateLotNo, getTodayDateString, formatDateWithDay } from '../../lib/utils';
import { Purchase, PurchaseLine, TransportPaidBy, CrateOwnership, PaymentMode } from '../../types';
import { X, Truck, AlertTriangle, Plus, Trash2, Box } from 'lucide-react';

interface PurchaseEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchaseSaved: (purchase: Purchase) => void;
}

interface FormPurchaseLine {
  categoryId: string;
  cratesPurchased: number;
  pricePerCrate: number;
}

export const PurchaseEntryModal: React.FC<PurchaseEntryModalProps> = ({
  isOpen,
  onClose,
  onPurchaseSaved
}) => {
  const { t, language } = useI18n();
  const { requestActionAuthorization } = useAuth();
  const { state, supplierSummaries } = useApp();

  const [supplierId, setSupplierId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(getTodayDateString());
  const [billNo, setBillNo] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [lines, setLines] = useState<FormPurchaseLine[]>([
    { categoryId: 'big', cratesPurchased: 40, pricePerCrate: 300 },
    { categoryId: 'small', cratesPurchased: 20, pricePerCrate: 200 }
  ]);
  const [transportCharge, setTransportCharge] = useState<number>(0);
  const [transportPaidBy, setTransportPaidBy] = useState<TransportPaidBy>('supplier_bill');
  const [labourCharge, setLabourCharge] = useState<number>(0);
  const [loadingCharge, setLoadingCharge] = useState<number>(0);
  const [crateOwnership, setCrateOwnership] = useState<CrateOwnership>('supplier');
  const [filledCratesReceived, setFilledCratesReceived] = useState<Record<string, number>>({});
  const [emptyCratesReturned, setEmptyCratesReturned] = useState<Record<string, number>>({});
  const [amountPaidNow, setAmountPaidNow] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Default bill number & filled crates
  useEffect(() => {
    if (isOpen) {
      setBillNo(`PUR-${Date.now().toString().slice(-6)}`);
      setErrorMsg('');
      setAmountPaidNow(0);
      setTransportCharge(0);
      setLabourCharge(0);
      setLoadingCharge(0);
    }
  }, [isOpen]);

  // Sync filled crates received with purchased crates by default
  useEffect(() => {
    const received: Record<string, number> = {};
    lines.forEach(l => {
      if (l.cratesPurchased > 0) {
        received[l.categoryId] = (received[l.categoryId] || 0) + l.cratesPurchased;
      }
    });
    setFilledCratesReceived(received);
  }, [lines]);

  const totalCrates = lines.reduce((sum, l) => sum + l.cratesPurchased, 0);
  const subtotal = lines.reduce((sum, l) => sum + (l.cratesPurchased * l.pricePerCrate), 0);
  // Net amount owed to supplier: subtotal + (transport if added to supplier bill)
  const netSupplierPayable = subtotal + (transportPaidBy === 'supplier_bill' ? transportCharge : 0);

  const handleAddLine = () => {
    setLines([...lines, { categoryId: 'small', cratesPurchased: 0, pricePerCrate: 200 }]);
  };

  const handleRemoveLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    setErrorMsg('');

    if (!supplierId) {
      setErrorMsg('Please select a supplier.');
      return;
    }

    if (!billNo.trim()) {
      setErrorMsg('Please enter a purchase bill/ref number.');
      return;
    }

    const validLines = lines.filter(l => l.cratesPurchased > 0 && l.pricePerCrate > 0);
    if (validLines.length === 0) {
      setErrorMsg('Please enter at least one crate category with quantity and price.');
      return;
    }

    try {
      const purchaseId = `pur-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

      // Calculate transport share spread across crates if added to supplier bill
      const transportSpreadTotal = transportPaidBy === 'supplier_bill' ? transportCharge : 0;
      const existingLotsCount = state.purchaseLines.length;

      const purchaseLines: PurchaseLine[] = validLines.map((vl, idx) => {
        const lineFraction = totalCrates > 0 ? (vl.cratesPurchased / totalCrates) : 1 / validLines.length;
        const lineTransportShare = transportSpreadTotal * lineFraction;
        const transportPerCrate = vl.cratesPurchased > 0 ? lineTransportShare / vl.cratesPurchased : 0;
        const effectiveCostPerCrate = vl.pricePerCrate + transportPerCrate;
        const lotNo = generateLotNo(existingLotsCount + idx);

        return {
          id: `pline-${purchaseId}-${idx}`,
          purchaseId,
          supplierId,
          lotNo,
          categoryId: vl.categoryId,
          cratesPurchased: vl.cratesPurchased,
          cratesRemaining: vl.cratesPurchased,
          cratesWasted: 0,
          pricePerCrate: vl.pricePerCrate,
          transportShare: transportPerCrate,
          effectiveCostPerCrate,
          lineTotal: vl.cratesPurchased * vl.pricePerCrate,
          isFullySold: false,
          isFullyCollected: false,
          isSettledWithSupplier: false,
          createdAt: purchaseDate
        };
      });

      const newPurchase: Purchase = {
        id: purchaseId,
        purchaseDate,
        supplierId,
        billNo,
        vehicleNo: vehicleNo || undefined,
        transportCharge,
        transportPaidBy,
        labourCharge,
        loadingCharge,
        totalCrates,
        subtotalAmount: subtotal,
        netAmount: netSupplierPayable,
        amountPaidNow,
        paymentMode: amountPaidNow > 0 ? paymentMode : undefined,
        paymentRef: paymentRef || undefined,
        lines: purchaseLines,
        filledCratesReceived,
        crateOwnership,
        emptyCratesReturned,
        notes: notes || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const targetSupplier = supplierSummaries.find(s => s.supplierId === supplierId);
      requestActionAuthorization({
        actionName: `Save Purchase Inward #${billNo}`,
        actionDetails: `${targetSupplier?.supplierName || 'Supplier'} • ${totalCrates} crates • Net: ${formatINR(netSupplierPayable)}`,
        onConfirm: () => {
          dbService.recordPurchase(newPurchase);
          onPurchaseSaved(newPurchase);
          onClose();
        }
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record purchase');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto select-none">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-blue-600 text-white px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-white/20">
              <Truck className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg">
                {t('purchases.title')}
              </h3>
              <p className="text-xs text-white/80">Stock In & Lot Creation</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-slate-800">
          
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-300 text-rose-800 p-3 rounded-xl text-xs font-semibold flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Supplier & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-700">
                {t('purchases.supplier')} *
              </label>
              <select
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-slate-50 font-semibold text-sm focus:bg-white focus:border-blue-600 focus:outline-none"
              >
                <option value="">-- Choose Supplier --</option>
                {supplierSummaries.map(s => (
                  <option key={s.supplierId} value={s.supplierId}>
                    {s.supplierName} ({s.place || s.phone}) - Due: {formatINR(s.balancePayable)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  {t('purchases.date')}
                </label>
                <span className="text-[10px] font-black text-blue-900 bg-blue-100 px-1.5 py-0.5 rounded">
                  {formatDateWithDay(purchaseDate, language, true)}
                </span>
              </div>
              <input
                type="date"
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-slate-50 font-semibold text-sm"
              />
            </div>
          </div>

          {/* Bill No & Vehicle No */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                {t('purchases.billNo')} *
              </label>
              <input
                type="text"
                value={billNo}
                onChange={e => setBillNo(e.target.value)}
                placeholder="Bill / Inward Ref"
                className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                {t('purchases.vehicleNo')}
              </label>
              <input
                type="text"
                value={vehicleNo}
                onChange={e => setVehicleNo(e.target.value.toUpperCase())}
                placeholder="e.g. TN-57-AB-1234"
                className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-bold uppercase"
              />
            </div>
          </div>

          {/* Crate Lines Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Purchased Tomato Crates & Cost per Crate
              </label>
              <button
                type="button"
                onClick={handleAddLine}
                className="text-xs text-blue-600 font-bold flex items-center space-x-1 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Category Line</span>
              </button>
            </div>

            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-2">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    
                    {/* Category */}
                    <div className="col-span-5 sm:col-span-4">
                      <select
                        value={line.categoryId}
                        onChange={e => {
                          const newLines = [...lines];
                          newLines[idx].categoryId = e.target.value;
                          setLines(newLines);
                        }}
                        className="w-full h-10 px-2 rounded-lg border border-slate-300 bg-white font-bold text-xs"
                      >
                        {state.categories.map(c => (
                          <option key={c.id} value={c.id}>
                            {language === 'ta' ? c.name_ta : c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Crates */}
                    <div className="col-span-3 sm:col-span-3">
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={line.cratesPurchased || ''}
                        onChange={e => {
                          const newLines = [...lines];
                          newLines[idx].cratesPurchased = parseInt(e.target.value, 10) || 0;
                          setLines(newLines);
                        }}
                        placeholder="Crates"
                        className="w-full h-10 px-2 rounded-lg border border-slate-300 bg-white font-bold text-sm text-center"
                      />
                    </div>

                    {/* Price per Crate */}
                    <div className="col-span-3 sm:col-span-4">
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        value={line.pricePerCrate || ''}
                        onChange={e => {
                          const newLines = [...lines];
                          newLines[idx].pricePerCrate = parseFloat(e.target.value) || 0;
                          setLines(newLines);
                        }}
                        placeholder="Cost ₹"
                        className="w-full h-10 px-2 rounded-lg border border-slate-300 bg-white font-bold text-sm text-right"
                      />
                    </div>

                    {/* Remove Line */}
                    <div className="col-span-1 text-right">
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                  </div>

                  <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200/60 font-semibold text-slate-600">
                    <span>Line Total:</span>
                    <span className="text-slate-900 font-bold">{formatINR(line.cratesPurchased * line.pricePerCrate)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Transport Charge & Payment Option (Section 5) */}
          <div className="bg-blue-50/60 border border-blue-200 p-3.5 rounded-2xl space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-bold text-blue-900">
                  {t('purchases.transportCharge')}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={transportCharge || ''}
                  onChange={e => setTransportCharge(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full h-10 px-2 rounded-xl border border-blue-300 bg-white font-bold text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-blue-900">
                  {t('purchases.transportOption')}
                </label>
                <select
                  value={transportPaidBy}
                  onChange={e => setTransportPaidBy(e.target.value as TransportPaidBy)}
                  className="w-full h-10 px-2 rounded-xl border border-blue-300 bg-white font-bold text-xs"
                >
                  <option value="supplier_bill">{t('purchases.transportAddedToBill')}</option>
                  <option value="self_expense">{t('purchases.transportPaidSeparately')}</option>
                </select>
              </div>
            </div>

            {transportCharge > 0 && transportPaidBy === 'supplier_bill' && (
              <p className="text-[11px] text-blue-800 font-medium">
                💡 ₹{transportCharge} transport is spread over {totalCrates} crates (~₹{(transportCharge / (totalCrates || 1)).toFixed(2)}/crate). Each lot's effective cost includes it.
              </p>
            )}
          </div>

          {/* Labour / Hamali & Loading (Shop Expenses) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700">{t('purchases.labourCharge')}</label>
              <input
                type="number"
                inputMode="decimal"
                value={labourCharge || ''}
                onChange={e => setLabourCharge(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full h-10 px-2 rounded-xl border border-slate-300 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">{t('purchases.loadingCharge')}</label>
              <input
                type="number"
                inputMode="decimal"
                value={loadingCharge || ''}
                onChange={e => setLoadingCharge(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full h-10 px-2 rounded-xl border border-slate-300 text-sm font-semibold"
              />
            </div>
          </div>

          {/* Crate Ownership & Empty Crates Returned */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {t('purchases.crateOwnership')}
              </span>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setCrateOwnership('supplier')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    crateOwnership === 'supplier'
                      ? 'bg-blue-600 text-white shadow'
                      : 'bg-white text-slate-600 border border-slate-300'
                  }`}
                >
                  {t('purchases.supplierCrates')}
                </button>
                <button
                  type="button"
                  onClick={() => setCrateOwnership('shop')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    crateOwnership === 'shop'
                      ? 'bg-blue-600 text-white shadow'
                      : 'bg-white text-slate-600 border border-slate-300'
                  }`}
                >
                  {t('purchases.myCrates')}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                {t('purchases.emptyReturned')} (Big / Small)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={emptyCratesReturned['big'] || ''}
                  onChange={e => setEmptyCratesReturned({ ...emptyCratesReturned, big: parseInt(e.target.value, 10) || 0 })}
                  placeholder="Big returned"
                  className="h-10 px-2 rounded-lg border border-slate-300 text-xs font-bold text-center"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  value={emptyCratesReturned['small'] || ''}
                  onChange={e => setEmptyCratesReturned({ ...emptyCratesReturned, small: parseInt(e.target.value, 10) || 0 })}
                  placeholder="Small returned"
                  className="h-10 px-2 rounded-lg border border-slate-300 text-xs font-bold text-center"
                />
              </div>
            </div>
          </div>

          {/* Net Supplier Amount Banner */}
          <div className="bg-slate-900 text-white p-3.5 rounded-2xl flex items-center justify-between shadow-inner">
            <div>
              <span className="text-xs text-slate-400 font-medium">{t('purchases.netPayable')}</span>
              <div className="text-2xl font-black text-white">
                {formatINR(netSupplierPayable)}
              </div>
            </div>
            <div className="text-right text-xs text-slate-400">
              Total Crates: <strong className="text-white text-base">{totalCrates}</strong>
            </div>
          </div>

          {/* Amount Paid to Supplier Now */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border border-slate-200 p-3 rounded-2xl bg-white">
            <div>
              <label className="text-xs font-bold text-slate-700">
                {t('purchases.amountPaidNow')}
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={amountPaidNow || ''}
                onChange={e => setAmountPaidNow(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full h-11 px-3 rounded-xl border border-slate-300 font-extrabold text-base text-rose-700 focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">
                {t('sales.paymentMode')}
              </label>
              <select
                value={paymentMode}
                onChange={e => setPaymentMode(e.target.value as PaymentMode)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-slate-50 font-semibold text-sm"
              >
                <option value="cash">Cash (ரொக்கம்)</option>
                <option value="upi">UPI</option>
                <option value="bank">Bank</option>
                <option value="cheque">Cheque</option>
              </select>
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
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 font-black text-sm text-white shadow-lg active:scale-95 transition-all"
          >
            {t('purchases.savePurchase')}
          </button>
        </div>

      </div>
    </div>
  );
};
