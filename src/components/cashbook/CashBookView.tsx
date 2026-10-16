// ============================================================================
// DAILY CASH BOOK & DAY CLOSING (SECTION 12)
// Expected Closing vs Actual Physical Cash, Discrepancy Check, Carry-Forward & Day Book
// ============================================================================

import React, { useState, useMemo } from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../lib/db';
import { CashClosing } from '../../types';
import { formatINR, formatDate, getTodayDateString, formatDateWithDay } from '../../lib/utils';
import { exportToExcel } from '../../lib/excelExport';
import {
  Wallet,
  Calendar,
  Lock,
  Download,
  AlertTriangle,
  CheckCircle2,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  X
} from 'lucide-react';

export const CashBookView: React.FC = () => {
  const { t, language } = useI18n();
  const { canEditOrDelete } = useAuth();
  const { state } = useApp();

  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [actualPhysicalCash, setActualPhysicalCash] = useState<number>(0);
  const [closingNotes, setClosingNotes] = useState('');

  // Find yesterday's closing cash to carry forward as opening
  const openingCash = useMemo(() => {
    // Sort previous closings before selectedDate
    const pastClosings = state.cashClosings
      .filter(c => c.closingDate < selectedDate && c.isClosed)
      .sort((a, b) => new Date(b.closingDate).getTime() - new Date(a.closingDate).getTime());

    if (pastClosings.length > 0) {
      return pastClosings[0].actualClosing;
    }
    return 10000; // Base mandi starting cash if day 1
  }, [state.cashClosings, selectedDate]);

  // Cash Inflows on selectedDate
  const cashPaymentsRecv = useMemo(() => {
    return state.paymentsReceived.filter(p => p.paymentDate === selectedDate && p.mode === 'cash' && !p.deletedAt);
  }, [state.paymentsReceived, selectedDate]);
  const totalCashIn = cashPaymentsRecv.reduce((sum, p) => sum + p.amount, 0);

  // Cash Outflows to Suppliers on selectedDate
  const cashPaymentsMade = useMemo(() => {
    return state.paymentsMade.filter(p => p.paymentDate === selectedDate && p.mode === 'cash' && !p.deletedAt);
  }, [state.paymentsMade, selectedDate]);
  const totalCashOut = cashPaymentsMade.reduce((sum, p) => sum + p.amount, 0);

  // Cash Expenses on selectedDate
  const cashExpenses = useMemo(() => {
    return state.expenses.filter(e => e.expenseDate === selectedDate && e.mode === 'cash' && !e.deletedAt);
  }, [state.expenses, selectedDate]);
  const totalCashExpenses = cashExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Expected Closing Cash = Opening + Cash In - Cash Out - Cash Expenses
  const expectedClosing = openingCash + totalCashIn - totalCashOut - totalCashExpenses;

  // UPI / Bank Collections & Outflows
  const upiPaymentsRecv = useMemo(() => {
    return state.paymentsReceived.filter(p => p.paymentDate === selectedDate && (p.mode === 'upi' || p.mode === 'bank') && !p.deletedAt);
  }, [state.paymentsReceived, selectedDate]);
  const totalUpiIn = upiPaymentsRecv.reduce((sum, p) => sum + p.amount, 0);

  const upiPaymentsMade = useMemo(() => {
    return state.paymentsMade.filter(p => p.paymentDate === selectedDate && (p.mode === 'upi' || p.mode === 'bank') && !p.deletedAt);
  }, [state.paymentsMade, selectedDate]);
  const totalUpiOut = upiPaymentsMade.reduce((sum, p) => sum + p.amount, 0);

  // Check if selectedDate already closed
  const existingClosing = state.cashClosings.find(c => c.closingDate === selectedDate);

  // Chronological Day Book feed for selectedDate
  const dayBookFeed = useMemo(() => {
    const items: any[] = [];

    // Sales
    state.sales.filter(s => s.saleDate === selectedDate && !s.deletedAt).forEach(s => {
      const cust = state.customers.find(c => c.id === s.customerId);
      items.push({
        type: 'sale',
        time: s.createdAt,
        title: `Sale Bill #${s.billNo}`,
        party: cust?.name || 'Customer',
        amount: s.billTotal,
        mode: s.amountReceivedNow > 0 ? `${s.paymentMode} (₹${s.amountReceivedNow} rec)` : 'Credit',
        isIn: true
      });
    });

    // Purchases
    state.purchases.filter(p => p.purchaseDate === selectedDate && !p.deletedAt).forEach(p => {
      const supp = state.suppliers.find(s => s.id === p.supplierId);
      items.push({
        type: 'purchase',
        time: p.createdAt,
        title: `Purchase Bill #${p.billNo}`,
        party: supp?.name || 'Supplier',
        amount: p.netAmount,
        mode: p.amountPaidNow > 0 ? `${p.paymentMode} (₹${p.amountPaidNow} paid)` : 'Credit',
        isIn: false
      });
    });

    // Payments Received
    state.paymentsReceived.filter(p => p.paymentDate === selectedDate && !p.deletedAt).forEach(p => {
      const cust = state.customers.find(c => c.id === p.customerId);
      items.push({
        type: 'receipt',
        time: p.createdAt,
        title: `Customer Collection`,
        party: cust?.name || 'Customer',
        amount: p.amount,
        mode: p.mode.toUpperCase(),
        isIn: true
      });
    });

    // Payments Made
    state.paymentsMade.filter(p => p.paymentDate === selectedDate && !p.deletedAt).forEach(p => {
      const supp = state.suppliers.find(s => s.id === p.supplierId);
      items.push({
        type: 'payment',
        time: p.createdAt,
        title: `Supplier Payment`,
        party: supp?.name || 'Supplier',
        amount: p.amount,
        mode: p.mode.toUpperCase(),
        isIn: false
      });
    });

    // Expenses
    state.expenses.filter(e => e.expenseDate === selectedDate && !e.deletedAt).forEach(e => {
      items.push({
        type: 'expense',
        time: e.createdAt,
        title: `Expense: ${e.category}`,
        party: e.notes || 'Shop Expense',
        amount: e.amount,
        mode: e.mode.toUpperCase(),
        isIn: false
      });
    });

    return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [state.sales, state.purchases, state.paymentsReceived, state.paymentsMade, state.expenses, state.customers, state.suppliers, selectedDate]);

  const handleSaveDayClosing = () => {
    const diff = actualPhysicalCash - expectedClosing;

    const closing: CashClosing = {
      id: `close-${selectedDate}`,
      closingDate: selectedDate,
      openingCash,
      cashReceived: totalCashIn,
      cashPaid: totalCashOut,
      cashExpenses: totalCashExpenses,
      expectedClosing,
      actualClosing: actualPhysicalCash,
      difference: diff,
      upiReceived: totalUpiIn,
      upiPaid: totalUpiOut,
      notes: closingNotes || undefined,
      isClosed: true,
      createdAt: new Date().toISOString()
    };

    dbService.performCashClosing(closing);
    setIsClosingModalOpen(false);
  };

  const handleExportCashBookExcel = () => {
    const data = dayBookFeed.map(item => ({
      'Type': item.title,
      'Party': item.party,
      'Amount (₹)': item.amount,
      'Mode / Details': item.mode,
      'Direction': item.isIn ? 'IN (வரவு)' : 'OUT (பற்று)'
    }));
    exportToExcel(data, `TSK_DayBook_${selectedDate}`, 'DayBook');
  };

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4 pb-24 select-none">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center space-x-2">
            <Wallet className="w-6 h-6 text-amber-600" />
            <span>{t('cashBook.title')}</span>
          </h2>
          <p className="text-xs text-slate-500">
            Daily physical cash in hand reconciliation & complete day book
          </p>
        </div>

        {/* Date Selector & Day Closing Action */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-xl">
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent font-bold text-xs text-slate-800 outline-none"
            />
            <span className="text-[11px] font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md">
              {formatDateWithDay(selectedDate, language, false)}
            </span>
          </div>

          <button
            onClick={handleExportCashBookExcel}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
            title="Export Excel"
          >
            <Download className="w-4 h-4" />
          </button>

          {canEditOrDelete && (
            <button
              onClick={() => {
                setActualPhysicalCash(expectedClosing);
                setIsClosingModalOpen(true);
              }}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all"
            >
              <Lock className="w-4 h-4" />
              <span>{existingClosing ? 'Re-Close Day' : t('cashBook.closeDay')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Alert if Day is Closed */}
      {existingClosing && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 rounded-2xl text-xs flex items-center justify-between">
          <span className="flex items-center space-x-1.5 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Day is officially closed! Actual Cash In Hand: {formatINR(existingClosing.actualClosing)}</span>
          </span>
          {existingClosing.difference !== 0 && (
            <span className="font-extrabold text-rose-700">
              Discrepancy: {formatINR(existingClosing.difference)}
            </span>
          )}
        </div>
      )}

      {/* CASH EQUATION BANNER (SECTION 12) */}
      <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-sm space-y-3">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
          Daily Physical Cash Equation: Opening + Cash In − Cash Out − Cash Exp = Expected Cash
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1 text-center">
          
          <div className="bg-slate-800/80 p-3 rounded-2xl">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">{t('cashBook.openingCash')}</span>
            <strong className="text-sm sm:text-base font-black text-white">{formatINR(openingCash)}</strong>
          </div>

          <div className="bg-emerald-950/60 border border-emerald-700/50 p-3 rounded-2xl">
            <span className="text-[10px] text-emerald-400 font-bold uppercase block">+ {t('cashBook.cashIn')}</span>
            <strong className="text-sm sm:text-base font-black text-emerald-400">{formatINR(totalCashIn)}</strong>
          </div>

          <div className="bg-rose-950/60 border border-rose-700/50 p-3 rounded-2xl">
            <span className="text-[10px] text-rose-300 font-bold uppercase block">− {t('cashBook.cashOut')}</span>
            <strong className="text-sm sm:text-base font-black text-rose-300">{formatINR(totalCashOut)}</strong>
          </div>

          <div className="bg-purple-950/60 border border-purple-700/50 p-3 rounded-2xl">
            <span className="text-[10px] text-purple-300 font-bold uppercase block">− {t('cashBook.cashExpenses')}</span>
            <strong className="text-sm sm:text-base font-black text-purple-300">{formatINR(totalCashExpenses)}</strong>
          </div>

          <div className="bg-amber-500/20 border-2 border-amber-400 p-3 rounded-2xl col-span-2 sm:col-span-1">
            <span className="text-[10px] text-amber-300 font-black uppercase block">= {t('cashBook.expectedClosing')}</span>
            <strong className="text-base sm:text-lg font-black text-amber-300">{formatINR(expectedClosing)}</strong>
          </div>

        </div>

        {/* UPI & Bank Collections and Outflows separate strip */}
        <div className="pt-2 border-t border-slate-800 flex flex-wrap justify-between text-xs text-slate-400 font-medium">
          <span>UPI / Bank Received: <strong className="text-emerald-400">{formatINR(totalUpiIn)}</strong></span>
          <span>UPI / Bank Paid Out: <strong className="text-rose-400">{formatINR(totalUpiOut)}</strong></span>
        </div>
      </div>

      {/* CHRONOLOGICAL DAY BOOK LIST */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3">
        <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
          Day Book: All Transactions for {formatDate(selectedDate)}
        </h3>

        <div className="space-y-2">
          {dayBookFeed.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">No transactions on this date.</p>
          ) : (
            dayBookFeed.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs text-slate-900">{item.title}</span>
                    <span className="text-[10px] text-slate-400 font-medium">{item.mode}</span>
                  </div>
                  <p className="text-xs text-slate-500">{item.party}</p>
                </div>

                <div className={`text-sm font-black ${item.isIn ? 'text-emerald-700' : 'text-slate-900'}`}>
                  {item.isIn ? '+' : '−'} {formatINR(item.amount)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* DAY CLOSING MODAL (SECTION 12) */}
      {isClosingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 select-none">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            <div className="bg-amber-600 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-extrabold text-base">Day Closing: {formatDateWithDay(selectedDate, language, false)}</h3>
              <button onClick={() => setIsClosingModalOpen(false)} className="text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs text-slate-800">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Expected Cash in Hand:</span>
                  <strong className="text-slate-900">{formatINR(expectedClosing)}</strong>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1 font-bold">
                  <span>Discrepancy:</span>
                  <span className={actualPhysicalCash - expectedClosing !== 0 ? 'text-rose-600' : 'text-emerald-600'}>
                    {formatINR(actualPhysicalCash - expectedClosing)}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">
                  Actual Physical Cash Counted in Hand (₹) *
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={actualPhysicalCash || ''}
                  onChange={e => setActualPhysicalCash(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full h-12 px-3 rounded-2xl border-2 border-slate-300 text-lg font-black text-center focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Closing Notes</label>
                <input
                  type="text"
                  value={closingNotes}
                  onChange={e => setClosingNotes(e.target.value)}
                  placeholder="e.g. Cash counted, difference carried forward"
                  className="w-full h-9 px-2 rounded-xl border border-slate-300 font-medium"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                onClick={() => setIsClosingModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDayClosing}
                className="px-5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold shadow"
              >
                Confirm Closing
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
