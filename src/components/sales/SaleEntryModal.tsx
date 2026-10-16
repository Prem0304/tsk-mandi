// ============================================================================
// NORMAL SALE ENTRY MODAL (SECTION 7.1)
// Owner Only: FIFO Lot Allocation, Stock Checks, Limits, Live Margin & Split Preview
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../lib/db';
import { formatINR, generateBillNo, getTodayDateString, formatDateWithDay } from '../../lib/utils';
import { allocateLotsFIFO, calculatePaymentSplit } from '../../lib/allocationEngine';
import { Sale, SaleLine, SaleLotAllocation, PaymentMode } from '../../types';
import { X, AlertTriangle, Plus, Trash2, ArrowRight, DollarSign, Box } from 'lucide-react';

interface SaleEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaleSaved: (sale: Sale) => void;
}

interface FormLine {
  categoryId: string;
  crates: number;
  pricePerCrate: number;
}

export const SaleEntryModal: React.FC<SaleEntryModalProps> = ({
  isOpen,
  onClose,
  onSaleSaved
}) => {
  const { t, language } = useI18n();
  const { state, stockSummaries, customerSummaries } = useApp();

  const [customerId, setCustomerId] = useState('');
  const [saleDate, setSaleDate] = useState(getTodayDateString());
  const [billNo, setBillNo] = useState('');
  const [lines, setLines] = useState<FormLine[]>([
    { categoryId: 'big', crates: 0, pricePerCrate: 0 }
  ]);
  const [transportCharge, setTransportCharge] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [roundOff, setRoundOff] = useState<number>(0);
  const [amountReceivedNow, setAmountReceivedNow] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [cratesIssued, setCratesIssued] = useState<Record<string, number>>({});
  const [cratesReturned, setCratesReturned] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Generate Bill No on open
  useEffect(() => {
    if (isOpen) {
      const prefix = state.settings.billPrefix || 'TSK-';
      const existingSalesCount = state.sales.length;
      setBillNo(generateBillNo(prefix, existingSalesCount));
      setErrorMsg('');
      setAmountReceivedNow(0);
      setDiscount(0);
      setRoundOff(0);
      setTransportCharge(0);
    }
  }, [isOpen, state.sales.length, state.settings.billPrefix]);

  const selectedCustomer = useMemo(() => {
    return customerSummaries.find(c => c.customerId === customerId);
  }, [customerId, customerSummaries]);

  // When customer changes, auto-suggest last price or daily rate board price
  const handleCustomerChange = (newCustId: string) => {
    setCustomerId(newCustId);
    if (!newCustId) return;

    // Find customer's last sales
    const pastSales = state.sales
      .filter(s => s.customerId === newCustId && !s.deletedAt)
      .sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime());

    setLines(prevLines =>
      prevLines.map(line => {
        let suggestedPrice = 0;
        if (pastSales.length > 0) {
          const lastLine = pastSales[0].lines.find(l => l.categoryId === line.categoryId);
          if (lastLine) suggestedPrice = lastLine.pricePerCrate;
        }
        if (!suggestedPrice) {
          const rate = dbService.getTodayRate(line.categoryId);
          suggestedPrice = rate ? rate.selling : 350;
        }
        return {
          ...line,
          pricePerCrate: suggestedPrice
        };
      })
    );
  };

  // Sync Crates Issued with Crates Sold by default
  useEffect(() => {
    const issued: Record<string, number> = {};
    lines.forEach(l => {
      if (l.crates > 0) {
        issued[l.categoryId] = (issued[l.categoryId] || 0) + l.crates;
      }
    });
    setCratesIssued(issued);
  }, [lines]);

  // Check live available stock for each line
  const stockValidation = useMemo(() => {
    for (const line of lines) {
      if (line.crates <= 0) continue;
      const avail = dbService.getAvailableStock(line.categoryId);
      if (line.crates > avail) {
        return {
          isValid: false,
          error: t('sales.stockExceeded', { requested: line.crates, available: avail })
        };
      }
    }
    return { isValid: true, error: '' };
  }, [lines, t]);

  // FIFO Lot Allocation preview and Live Margin calculation
  const allocationPreview = useMemo(() => {
    const openLots = state.purchaseLines.filter(l => l.cratesRemaining > 0);
    let totalCost = 0;
    let totalSale = 0;
    let totalProfit = 0;
    const allocations: Omit<SaleLotAllocation, 'id' | 'saleId' | 'saleLineId' | 'collectedAmount' | 'supplierClearedAmount'>[] = [];

    for (const line of lines) {
      if (line.crates <= 0) continue;
      const res = allocateLotsFIFO(line.categoryId, line.crates, line.pricePerCrate, openLots);
      if (res.success) {
        for (const alloc of res.allocations) {
          allocations.push(alloc);
          totalCost += alloc.costAmount;
          totalSale += alloc.saleAmount;
          totalProfit += alloc.bookedProfit;
        }
      }
    }

    const marginPct = totalSale > 0 ? (totalProfit / totalSale) * 100 : 0;
    return { allocations, totalCost, totalSale, totalProfit, marginPct };
  }, [lines, state.purchaseLines]);

  // Bill totals
  const subtotal = lines.reduce((sum, l) => sum + (l.crates * l.pricePerCrate), 0);
  const billTotal = Math.max(0, subtotal + transportCharge - discount + roundOff);

  // Credit limit check
  const isCreditLimitWarning = useMemo(() => {
    if (!selectedCustomer || !selectedCustomer.creditLimit) return false;
    const projectedBalance = selectedCustomer.currentBalance + billTotal - amountReceivedNow;
    return projectedBalance > selectedCustomer.creditLimit;
  }, [selectedCustomer, billTotal, amountReceivedNow]);

  // Crate limit check
  const isCrateLimitWarning = useMemo(() => {
    if (!selectedCustomer || !selectedCustomer.creditLimit) return false;
    const custObj = state.customers.find(c => c.id === customerId);
    if (!custObj?.crateLimits) return false;
    for (const [catId, limit] of Object.entries(custObj.crateLimits)) {
      if (limit) {
        const currentlyHeld = selectedCustomer.cratesHeld[catId] || 0;
        const newIssued = cratesIssued[catId] || 0;
        const newReturned = cratesReturned[catId] || 0;
        if (currentlyHeld + newIssued - newReturned > limit) return true;
      }
    }
    return false;
  }, [selectedCustomer, state.customers, customerId, cratesIssued, cratesReturned]);

  // Live Section 9A Payment Split Preview for amount received now
  const paymentSplitPreview = useMemo(() => {
    if (amountReceivedNow <= 0 || !selectedCustomer) return null;

    // Build temporary sale and allocations for preview
    const tempSale: Sale = {
      id: 'temp-sale-id',
      saleDate,
      customerId,
      billNo,
      lines: [],
      allocations: allocationPreview.allocations.map((a, i) => ({
        ...a,
        id: `temp-alloc-${i}`,
        saleId: 'temp-sale-id',
        saleLineId: `temp-line-${i}`,
        collectedAmount: 0,
        supplierClearedAmount: 0
      })),
      transportCharge,
      discount,
      roundOff,
      subtotalAmount: subtotal,
      billTotal,
      amountReceivedNow,
      totalCrates: lines.reduce((s, l) => s + l.crates, 0),
      emptyCratesIssued: cratesIssued,
      emptyCratesReturned: cratesReturned,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const lotsMap: Record<string, any> = {};
    state.purchaseLines.forEach(l => { lotsMap[l.id] = l; });
    const suppMap: Record<string, any> = {};
    state.suppliers.forEach(s => { suppMap[s.id] = { id: s.id, name: s.name }; });

    return calculatePaymentSplit(
      'temp-pay-id',
      customerId,
      amountReceivedNow,
      state.settings.paymentAllocationRule,
      selectedCustomer.openingBalance,
      0,
      [tempSale],
      [],
      lotsMap,
      suppMap,
      tempSale.id
    );
  }, [
    amountReceivedNow,
    selectedCustomer,
    saleDate,
    customerId,
    billNo,
    allocationPreview.allocations,
    transportCharge,
    discount,
    roundOff,
    subtotal,
    billTotal,
    lines,
    cratesIssued,
    cratesReturned,
    state.purchaseLines,
    state.suppliers,
    state.settings.paymentAllocationRule
  ]);

  if (!isOpen) return null;

  const handleAddLine = () => {
    setLines([...lines, { categoryId: 'small', crates: 0, pricePerCrate: 240 }]);
  };

  const handleRemoveLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    setErrorMsg('');

    if (!customerId) {
      setErrorMsg('Please select a customer.');
      return;
    }

    if (!stockValidation.isValid) {
      setErrorMsg(stockValidation.error);
      return;
    }

    const validLines = lines.filter(l => l.crates > 0 && l.pricePerCrate > 0);
    if (validLines.length === 0) {
      setErrorMsg('Please enter at least one valid crate quantity and rate.');
      return;
    }

    try {
      const saleId = `sale-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

      const saleLines: SaleLine[] = validLines.map((vl, idx) => ({
        id: `sline-${saleId}-${idx}`,
        saleId,
        categoryId: vl.categoryId,
        crates: vl.crates,
        pricePerCrate: vl.pricePerCrate,
        lineTotal: vl.crates * vl.pricePerCrate
      }));

      // Generate full allocations with IDs
      const saleAllocations: SaleLotAllocation[] = allocationPreview.allocations.map((a, idx) => ({
        ...a,
        id: `salloc-${saleId}-${idx}`,
        saleId,
        saleLineId: saleLines.find(sl => sl.categoryId === a.categoryId)?.id || saleLines[0].id,
        collectedAmount: 0,
        supplierClearedAmount: 0
      }));

      const newSale: Sale = {
        id: saleId,
        saleDate,
        customerId,
        billNo,
        lines: saleLines,
        allocations: saleAllocations,
        transportCharge,
        discount,
        roundOff,
        subtotalAmount: subtotal,
        billTotal,
        amountReceivedNow,
        paymentMode: amountReceivedNow > 0 ? paymentMode : undefined,
        paymentRef: paymentRef || undefined,
        totalCrates: validLines.reduce((s, l) => s + l.crates, 0),
        emptyCratesIssued: cratesIssued,
        emptyCratesReturned: cratesReturned,
        notes: notes || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Atomic save to database
      dbService.recordSale(newSale, paymentMode, paymentRef);
      onSaleSaved(newSale);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record sale');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto select-none">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-tomato text-white px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-white/20">
              <Box className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg">
                {t('sales.title')}
              </h3>
              <p className="text-xs text-white/80">{billNo}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-slate-800">
          
          {/* Error Message */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-300 text-rose-800 p-3 rounded-xl text-xs font-semibold flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Customer & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-700">
                {t('sales.customer')} *
              </label>
              <select
                value={customerId}
                onChange={e => handleCustomerChange(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-slate-50 font-semibold text-sm focus:bg-white focus:border-tomato focus:outline-none"
              >
                <option value="">-- Choose Customer --</option>
                {customerSummaries.map(c => (
                  <option key={c.customerId} value={c.customerId}>
                    {c.customerName} {c.shopName ? `(${c.shopName})` : ''} - Bal: {formatINR(c.currentBalance)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  {t('sales.date')}
                </label>
                <span className="text-[10px] font-black text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded">
                  {formatDateWithDay(saleDate, language, true)}
                </span>
              </div>
              <input
                type="date"
                value={saleDate}
                onChange={e => setSaleDate(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-slate-50 font-semibold text-sm focus:bg-white focus:border-tomato focus:outline-none"
              />
            </div>
          </div>

          {/* Customer Info Strip if selected */}
          {selectedCustomer && (
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-slate-500">Current Balance: </span>
                <strong className={selectedCustomer.currentBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                  {formatINR(selectedCustomer.currentBalance)}
                </strong>
                {selectedCustomer.creditLimit && (
                  <span className="text-slate-400 ml-1">
                    (Limit: {formatINR(selectedCustomer.creditLimit)})
                  </span>
                )}
              </div>
              <div>
                <span className="text-slate-500">Crates Held: </span>
                <strong className="text-slate-800">
                  Big: {selectedCustomer.cratesHeld['big'] || 0} | Small: {selectedCustomer.cratesHeld['small'] || 0}
                </strong>
              </div>
            </div>
          )}

          {/* Warnings */}
          {isCreditLimitWarning && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 p-2.5 rounded-xl text-xs font-medium flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{t('sales.creditLimitExceeded', { limit: formatINR(selectedCustomer?.creditLimit || 0) })}</span>
            </div>
          )}
          {isCrateLimitWarning && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 p-2.5 rounded-xl text-xs font-medium flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{t('sales.crateLimitExceeded', { limit: 'Limit' })}</span>
            </div>
          )}

          {/* Crate Lines Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Tomato Crates & Rates
              </label>
              <button
                type="button"
                onClick={handleAddLine}
                className="text-xs text-tomato font-bold flex items-center space-x-1 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('sales.addLine')}</span>
              </button>
            </div>

            <div className="space-y-2">
              {lines.map((line, idx) => {
                const avail = dbService.getAvailableStock(line.categoryId);
                const lineTotal = line.crates * line.pricePerCrate;
                return (
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
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {t('sales.availableStock')}: <strong className={avail < 10 ? 'text-rose-600' : 'text-slate-800'}>{avail}</strong>
                        </div>
                      </div>

                      {/* Crates */}
                      <div className="col-span-3 sm:col-span-3">
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={line.crates || ''}
                          onChange={e => {
                            const newLines = [...lines];
                            newLines[idx].crates = parseInt(e.target.value, 10) || 0;
                            setLines(newLines);
                          }}
                          placeholder="Crates"
                          className="w-full h-10 px-2 rounded-lg border border-slate-300 bg-white font-bold text-sm text-center focus:border-tomato focus:outline-none"
                        />
                      </div>

                      {/* Price Per Crate */}
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
                          placeholder="Rate ₹"
                          className="w-full h-10 px-2 rounded-lg border border-slate-300 bg-white font-bold text-sm text-right focus:border-tomato focus:outline-none"
                        />
                      </div>

                      {/* Delete button */}
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
                      <span className="text-slate-900 font-bold">{formatINR(lineTotal)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* LIVE MARGIN PREVIEW (OWNER ONLY) */}
          <div className="bg-emerald-50/70 border border-emerald-200 p-3 rounded-2xl text-xs space-y-1">
            <div className="flex items-center justify-between font-bold text-emerald-900">
              <span>{t('sales.liveMarginPreview')}</span>
              <span className="bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded text-[10px]">
                {allocationPreview.marginPct.toFixed(1)}% {t('sales.margin')}
              </span>
            </div>
            <div className="flex justify-between text-emerald-800">
              <span>FIFO Lot Cost: <strong>{formatINR(allocationPreview.totalCost)}</strong></span>
              <span>Booked Profit: <strong className="text-emerald-700">{formatINR(allocationPreview.totalProfit)}</strong></span>
            </div>
          </div>

          {/* Charges, Discount & Round off */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[11px] font-bold text-slate-600">{t('sales.transport')}</label>
              <input
                type="number"
                inputMode="decimal"
                value={transportCharge || ''}
                onChange={e => setTransportCharge(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full h-10 px-2 rounded-xl border border-slate-300 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600">{t('sales.discount')}</label>
              <input
                type="number"
                inputMode="decimal"
                value={discount || ''}
                onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full h-10 px-2 rounded-xl border border-slate-300 text-sm font-semibold text-rose-600"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600">{t('sales.roundOff')}</label>
              <input
                type="number"
                inputMode="decimal"
                value={roundOff || ''}
                onChange={e => setRoundOff(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="w-full h-10 px-2 rounded-xl border border-slate-300 text-sm font-semibold"
              />
            </div>
          </div>

          {/* Bill Total Banner */}
          <div className="bg-slate-900 text-white p-3.5 rounded-2xl flex items-center justify-between shadow-inner">
            <div>
              <span className="text-xs text-slate-400 font-medium">{t('sales.billTotal')}</span>
              <div className="text-2xl font-black text-white">
                {formatINR(billTotal)}
              </div>
            </div>
            <div className="text-right text-xs text-slate-400">
              Total Crates: <strong className="text-white text-base">{lines.reduce((s, l) => s + l.crates, 0)}</strong>
            </div>
          </div>

          {/* Crates Issued and Returned Now */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                {t('sales.cratesIssued')} (Big / Small)
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="number"
                  inputMode="numeric"
                  value={cratesIssued['big'] || ''}
                  onChange={e => setCratesIssued({ ...cratesIssued, big: parseInt(e.target.value, 10) || 0 })}
                  placeholder="Big"
                  className="h-9 px-2 rounded-lg border border-slate-300 text-xs text-center font-bold"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  value={cratesIssued['small'] || ''}
                  onChange={e => setCratesIssued({ ...cratesIssued, small: parseInt(e.target.value, 10) || 0 })}
                  placeholder="Small"
                  className="h-9 px-2 rounded-lg border border-slate-300 text-xs text-center font-bold"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                {t('sales.cratesReturned')}
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="number"
                  inputMode="numeric"
                  value={cratesReturned['big'] || ''}
                  onChange={e => setCratesReturned({ ...cratesReturned, big: parseInt(e.target.value, 10) || 0 })}
                  placeholder="Big"
                  className="h-9 px-2 rounded-lg border border-slate-300 text-xs text-center font-bold text-emerald-700"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  value={cratesReturned['small'] || ''}
                  onChange={e => setCratesReturned({ ...cratesReturned, small: parseInt(e.target.value, 10) || 0 })}
                  placeholder="Small"
                  className="h-9 px-2 rounded-lg border border-slate-300 text-xs text-center font-bold text-emerald-700"
                />
              </div>
            </div>
          </div>

          {/* Amount Received Now (Section 9A Auto-Split) */}
          <div className="space-y-2 border border-slate-200 p-3 rounded-2xl bg-white">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-slate-700">
                  {t('sales.amountReceived')}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={amountReceivedNow || ''}
                  onChange={e => setAmountReceivedNow(parseFloat(e.target.value) || 0)}
                  placeholder="₹ 0.00"
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 font-extrabold text-base text-emerald-700 focus:border-tomato focus:outline-none"
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
                  <option value="upi">UPI (GPay/PhonePe)</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
            </div>

            {/* Live Payment Split Preview (Section 9A) */}
            {paymentSplitPreview && (
              <div className="bg-amber-50/80 border border-amber-200 p-2.5 rounded-xl text-xs space-y-1">
                <span className="font-bold text-amber-900 block">
                  {t('payments.splitPreview')} (Section 9A):
                </span>
                <div className="space-y-0.5 text-amber-950">
                  {paymentSplitPreview.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>• {item.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
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
            disabled={!stockValidation.isValid}
            className={`px-6 py-2.5 rounded-xl font-black text-sm text-white shadow-lg active:scale-95 transition-all ${
              stockValidation.isValid
                ? 'bg-tomato hover:bg-rose-700'
                : 'bg-slate-300 cursor-not-allowed text-slate-500'
            }`}
          >
            {t('sales.saveSale')}
          </button>
        </div>

      </div>
    </div>
  );
};
