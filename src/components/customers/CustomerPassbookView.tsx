// ============================================================================
// CUSTOMER PASSBOOK VIEW (SECTION 9 - BANK PASSBOOK STYLE)
// Date | Particulars | Big | Small | Rate | Bought (Dr) | Paid (Cr) | Balance
// Owner Toggle: "Show Split" (Supplier Share vs Realised Profit)
// WhatsApp Share & Bad Debt Write-off
// ============================================================================

import React, { useState, useMemo } from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../lib/db';
import { Customer } from '../../types';
import { formatINR, formatDate, getTodayDateString, formatDateWithDay, getDayName } from '../../lib/utils';
import { sharePassbookReminderWhatsApp } from '../../lib/whatsapp';
import { exportToExcel } from '../../lib/excelExport';
import {
  BookOpen,
  ArrowLeft,
  Share2,
  Download,
  PlusCircle,
  Eye,
  EyeOff,
  AlertOctagon,
  X,
  Phone,
  MapPin,
  Calendar
} from 'lucide-react';

interface CustomerPassbookViewProps {
  customerId: string;
  onBack: () => void;
  onOpenReceivePayment: (customerId: string) => void;
}

interface PassbookRow {
  id: string;
  date: string;
  particulars: string;
  bigCrates: number | string;
  smallCrates: number | string;
  rate: number | string;
  debit: number; // Bought
  credit: number; // Paid
  balance: number;
  allocations?: { supplierName: string; supplierShare: number; profitShare: number }[];
  isOpening?: boolean;
}

export const CustomerPassbookView: React.FC<CustomerPassbookViewProps> = ({
  customerId,
  onBack,
  onOpenReceivePayment
}) => {
  const { t, language } = useI18n();
  const { canSeeProfit, canEditOrDelete } = useAuth();
  const { state, customerSummaries } = useApp();

  const [showSplit, setShowSplit] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isWriteoffModalOpen, setIsWriteoffModalOpen] = useState(false);
  const [writeoffAmount, setWriteoffAmount] = useState<number>(0);
  const [writeoffReason, setWriteoffReason] = useState('');
  const [writeoffType, setWriteoffType] = useState<'discount' | 'bad_debt'>('bad_debt');

  const customerSummary = useMemo(() => {
    return customerSummaries.find(c => c.customerId === customerId);
  }, [customerId, customerSummaries]);

  const customerObj = useMemo(() => {
    return state.customers.find(c => c.id === customerId);
  }, [customerId, state.customers]);

  // Build Chronological Passbook Rows with Running Balance
  const passbookRows = useMemo(() => {
    if (!customerObj) return [];

    const rows: { date: string; timestamp: number; type: string; raw: any }[] = [];

    // 1. Opening Balance
    if (customerObj.openingMoneyBalance > 0) {
      rows.push({
        date: customerObj.openingBalanceDate,
        timestamp: new Date(customerObj.openingBalanceDate).getTime(),
        type: 'opening',
        raw: {
          balance: customerObj.openingMoneyBalance,
          big: customerObj.openingCrates['big'] || 0,
          small: customerObj.openingCrates['small'] || 0
        }
      });
    }

    // 2. Sales (Debits)
    const sales = state.sales.filter(s => s.customerId === customerId && !s.deletedAt);
    sales.forEach(s => {
      rows.push({
        date: s.saleDate,
        timestamp: new Date(s.saleDate).getTime(),
        type: 'sale',
        raw: s
      });
    });

    // 3. Payments Received (Credits)
    const payments = state.paymentsReceived.filter(p => p.customerId === customerId && !p.deletedAt);
    payments.forEach(p => {
      rows.push({
        date: p.paymentDate,
        timestamp: new Date(p.paymentDate).getTime(),
        type: 'payment',
        raw: p
      });
    });

    // 4. Bad debts / write-offs
    const writeoffs = state.discountsWriteoffs.filter(w => w.customerId === customerId && !w.deletedAt);
    writeoffs.forEach(w => {
      rows.push({
        date: w.entryDate,
        timestamp: new Date(w.entryDate).getTime(),
        type: 'writeoff',
        raw: w
      });
    });

    // Sort chronologically
    rows.sort((a, b) => a.timestamp - b.timestamp);

    // Calculate Running Balance
    let runningBalance = 0;
    const computedRows: PassbookRow[] = [];

    rows.forEach(r => {
      if (r.type === 'opening') {
        runningBalance += r.raw.balance;
        computedRows.push({
          id: 'row-opening',
          date: r.date,
          particulars: 'Opening Balance (ஆரம்ப பாக்கி)',
          bigCrates: r.raw.big || '-',
          smallCrates: r.raw.small || '-',
          rate: '-',
          debit: r.raw.balance,
          credit: 0,
          balance: runningBalance,
          isOpening: true
        });
      } else if (r.type === 'sale') {
        const sale = r.raw;
        runningBalance += sale.billTotal;
        const bigCr = sale.lines.find((l: any) => l.categoryId === 'big')?.crates || 0;
        const smallCr = sale.lines.find((l: any) => l.categoryId === 'small')?.crates || 0;
        const rates = sale.lines.map((l: any) => `₹${l.pricePerCrate}`).join(', ');

        computedRows.push({
          id: `row-sale-${sale.id}`,
          date: sale.saleDate,
          particulars: `Sale Bill #${sale.billNo}${sale.transportCharge > 0 ? ' (incl. transport)' : ''}`,
          bigCrates: bigCr > 0 ? bigCr : '-',
          smallCrates: smallCr > 0 ? smallCr : '-',
          rate: rates || '-',
          debit: sale.billTotal,
          credit: 0,
          balance: runningBalance
        });
      } else if (r.type === 'payment') {
        const pay = r.raw;
        runningBalance -= (pay.amount + pay.discount);

        // Fetch allocations for this payment
        const allocs = state.paymentAllocations.filter(pa => pa.paymentId === pay.id);
        const splitBreakdown = allocs.map(a => {
          const supp = state.suppliers.find(s => s.id === a.supplierId);
          return {
            supplierName: supp?.name || (a.isOpeningBalance ? 'Opening Bal' : 'Mandi'),
            supplierShare: a.supplierShare,
            profitShare: a.profitShare
          };
        });

        computedRows.push({
          id: `row-pay-${pay.id}`,
          date: pay.paymentDate,
          particulars: `Payment Recv (${pay.mode.toUpperCase()})${pay.referenceNo ? ' Ref: ' + pay.referenceNo : ''}${pay.discount > 0 ? ' [Disc: ₹' + pay.discount + ']' : ''}`,
          bigCrates: '-',
          smallCrates: '-',
          rate: '-',
          debit: 0,
          credit: pay.amount + pay.discount,
          balance: runningBalance,
          allocations: splitBreakdown
        });
      } else if (r.type === 'writeoff') {
        const w = r.raw;
        runningBalance -= w.amount;
        computedRows.push({
          id: `row-w-${w.id}`,
          date: w.entryDate,
          particulars: `${w.type === 'bad_debt' ? 'Bad Debt Write-off' : 'Discount'}: ${w.reason}`,
          bigCrates: '-',
          smallCrates: '-',
          rate: '-',
          debit: 0,
          credit: w.amount,
          balance: runningBalance
        });
      }
    });

    // Apply date range filter if selected
    return computedRows.filter(row => {
      if (startDate && row.date < startDate) return false;
      if (endDate && row.date > endDate) return false;
      return true;
    });
  }, [customerObj, state.sales, state.paymentsReceived, state.paymentAllocations, state.suppliers, state.discountsWriteoffs, customerId, startDate, endDate]);

  if (!customerObj || !customerSummary) {
    return (
      <div className="p-8 text-center text-slate-400">
        Customer not found.
      </div>
    );
  }

  const handleWhatsAppShare = () => {
    sharePassbookReminderWhatsApp(
      customerObj,
      customerSummary.currentBalance,
      customerSummary.cratesHeld,
      state.settings,
      language
    );
  };

  const handleExportPassbookExcel = () => {
    const data = passbookRows.map(r => ({
      'Date / தேதி': formatDate(r.date),
      'Day / கிழமை': getDayName(r.date, language, false),
      'Particulars / விவரம்': r.particulars,
      'Big Crates / பெரிய பெட்டி': r.bigCrates,
      'Small Crates / சிறிய பெட்டி': r.smallCrates,
      'Rate / விலை': r.rate,
      'Bought / Debit (₹) / பற்று': r.debit > 0 ? r.debit : '',
      'Paid / Credit (₹) / வரவு': r.credit > 0 ? r.credit : '',
      'Balance (₹) / மீதி பாக்கி': r.balance
    }));
    exportToExcel(data, `Passbook_${customerObj.name.replace(/\s+/g, '_')}`, 'Passbook');
  };

  const handleSaveWriteoff = () => {
    if (writeoffAmount <= 0) {
      alert('Enter a valid write-off amount');
      return;
    }
    if (!writeoffReason.trim()) {
      alert('Reason is required for write-off');
      return;
    }

    dbService.recordWriteoff({
      id: `w-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      entryDate: getTodayDateString(),
      customerId,
      type: writeoffType,
      amount: writeoffAmount,
      reason: writeoffReason,
      createdAt: new Date().toISOString()
    });

    setIsWriteoffModalOpen(false);
    setWriteoffAmount(0);
    setWriteoffReason('');
  };

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4 pb-24 select-none">
      
      {/* Top Header Card */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                {customerObj.name}
              </h2>
              <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
                {customerObj.shopName && <span>{customerObj.shopName} •</span>}
                <span className="flex items-center space-x-1"><Phone className="w-3 h-3" /> {customerObj.phone}</span>
                {customerObj.place && <span className="flex items-center space-x-1"><MapPin className="w-3 h-3" /> {customerObj.place}</span>}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Show Split Owner Toggle */}
            {canSeeProfit && (
              <button
                onClick={() => setShowSplit(!showSplit)}
                className={`flex items-center space-x-1 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                  showSplit
                    ? 'bg-amber-100 border-amber-300 text-amber-900 shadow-xs'
                    : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                }`}
                title="Owner-only: shows supplier share vs realised profit on payment rows"
              >
                {showSplit ? <Eye className="w-4 h-4 text-amber-700" /> : <EyeOff className="w-4 h-4" />}
                <span>{showSplit ? 'Hide Split' : 'Show Split'}</span>
              </button>
            )}

            <button
              onClick={handleWhatsAppShare}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm active:scale-95 transition-all"
            >
              <Share2 className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={handleExportPassbookExcel}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
            >
              <Download className="w-4 h-4" />
              <span>Excel</span>
            </button>

            <button
              onClick={() => onOpenReceivePayment(customerId)}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-tomato hover:bg-rose-700 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Receive Payment</span>
            </button>
          </div>

        </div>

        {/* Passbook Header Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
          <div className="bg-slate-50 p-3 rounded-2xl">
            <span className="text-[11px] font-semibold text-slate-500">{t('passbook.totalBought')}</span>
            <div className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
              {formatINR(customerSummary.totalBilled + customerSummary.openingBalance)}
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl">
            <span className="text-[11px] font-semibold text-slate-500">{t('passbook.totalSettled')}</span>
            <div className="text-base sm:text-lg font-black text-emerald-700 mt-0.5">
              {formatINR(customerSummary.totalPaid + customerSummary.totalWrittenOff)}
            </div>
          </div>

          <div className="bg-rose-50 border border-rose-200 p-3 rounded-2xl">
            <span className="text-[11px] font-semibold text-rose-800">{t('passbook.currentBalance')}</span>
            <div className="text-base sm:text-lg font-black text-rose-700 mt-0.5">
              {formatINR(customerSummary.currentBalance)}
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl">
            <span className="text-[11px] font-semibold text-slate-500">Crates Held</span>
            <div className="text-sm font-black text-slate-900 mt-0.5">
              Big: <strong className="text-tomato">{customerSummary.cratesHeld['big'] || 0}</strong> | Small: <strong className="text-tomato">{customerSummary.cratesHeld['small'] || 0}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-slate-600 flex items-center space-x-1">
            <Calendar className="w-3.5 h-3.5" />
            <span>Date Range:</span>
          </span>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="h-8 px-2 rounded-lg border border-slate-300 font-semibold"
          />
          <span>to</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="h-8 px-2 rounded-lg border border-slate-300 font-semibold"
          />
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="text-slate-400 hover:text-slate-700 underline"
            >
              Clear
            </button>
          )}
        </div>

        {canEditOrDelete && customerSummary.currentBalance > 0 && (
          <button
            onClick={() => setIsWriteoffModalOpen(true)}
            className="flex items-center space-x-1 text-rose-600 hover:underline font-bold"
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>Bad Debt Write-off</span>
          </button>
        )}
      </div>

      {/* BANK PASSBOOK STYLE TABLE */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-900 text-white font-bold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="p-3 pl-4">Date</th>
                <th className="p-3">Particulars</th>
                <th className="p-3 text-center">Big</th>
                <th className="p-3 text-center">Small</th>
                <th className="p-3 text-center">Rate</th>
                <th className="p-3 text-right">Bought (Dr)</th>
                <th className="p-3 text-right">Paid (Cr)</th>
                <th className="p-3 text-right pr-4">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {passbookRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No transactions found for this customer.
                  </td>
                </tr>
              ) : (
                passbookRows.map(row => (
                  <React.Fragment key={row.id}>
                    <tr className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 pl-4 whitespace-nowrap font-mono text-slate-700">
                        <span className="font-bold block">{formatDate(row.date)}</span>
                        <span className="text-[10px] text-slate-400 font-sans block">{getDayName(row.date, language, false)}</span>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-slate-800">{row.particulars}</span>
                      </td>
                      <td className="p-3 text-center font-bold text-slate-700">
                        {row.bigCrates}
                      </td>
                      <td className="p-3 text-center font-bold text-slate-700">
                        {row.smallCrates}
                      </td>
                      <td className="p-3 text-center text-slate-500">
                        {row.rate}
                      </td>
                      <td className="p-3 text-right font-extrabold text-slate-900">
                        {row.debit > 0 ? formatINR(row.debit) : '-'}
                      </td>
                      <td className="p-3 text-right font-extrabold text-emerald-700">
                        {row.credit > 0 ? formatINR(row.credit) : '-'}
                      </td>
                      <td className="p-3 text-right pr-4 font-black text-slate-950 text-sm">
                        {formatINR(row.balance)}
                      </td>
                    </tr>

                    {/* OWNER-ONLY EXPANDED SPLIT ROW (SECTION 9A) */}
                    {showSplit && canSeeProfit && row.allocations && row.allocations.length > 0 && (
                      <tr className="bg-amber-50/60 text-[11px]">
                        <td colSpan={8} className="px-4 py-2 border-t border-dashed border-amber-200">
                          <div className="flex flex-wrap items-center gap-3 text-amber-900">
                            <span className="font-bold">Split:</span>
                            {row.allocations.map((a, i) => (
                              <span key={i} className="bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300">
                                {a.supplierName}: Cleared Cost: <strong>{formatINR(a.supplierShare)}</strong> | Realised Profit: <strong className="text-emerald-700">{formatINR(a.profitShare)}</strong>
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* BAD DEBT WRITE-OFF MODAL (SECTION 9 & 9A) */}
      {isWriteoffModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 select-none">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            <div className="bg-rose-700 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm">Write-off / Discount</h3>
              <button onClick={() => setIsWriteoffModalOpen(false)} className="text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-slate-800 text-xs">
              <p className="text-slate-500 leading-relaxed">
                Writing off reduces receivables. The supplier is still owed their cost; this is absorbed as shop loss.
              </p>

              <div>
                <label className="font-bold block mb-1">Type</label>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setWriteoffType('bad_debt')}
                    className={`flex-1 py-1.5 rounded-lg font-bold border ${writeoffType === 'bad_debt' ? 'bg-rose-100 border-rose-300 text-rose-900' : 'bg-slate-50 border-slate-200'}`}
                  >
                    Bad Debt
                  </button>
                  <button
                    type="button"
                    onClick={() => setWriteoffType('discount')}
                    className={`flex-1 py-1.5 rounded-lg font-bold border ${writeoffType === 'discount' ? 'bg-rose-100 border-rose-300 text-rose-900' : 'bg-slate-50 border-slate-200'}`}
                  >
                    Discount
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">Amount (₹)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={writeoffAmount || ''}
                  onChange={e => setWriteoffAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 font-bold text-sm"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Reason *</label>
                <input
                  type="text"
                  value={writeoffReason}
                  onChange={e => setWriteoffReason(e.target.value)}
                  placeholder="e.g. Customer untraceable / disputed rate"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 font-medium text-xs"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                onClick={() => setIsWriteoffModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveWriteoff}
                className="px-4 py-1.5 rounded-xl bg-rose-700 text-white text-xs font-black shadow"
              >
                Confirm Write-off
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
