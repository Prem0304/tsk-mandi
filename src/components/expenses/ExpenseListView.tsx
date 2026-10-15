// ============================================================================
// EXPENSES MODULE (SECTION 11)
// Expense Entry, Category Breakdown, Transport Auto-Posts, Mode Filter
// ============================================================================

import React, { useState, useMemo } from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../lib/db';
import { Expense, PaymentMode } from '../../types';
import { formatINR, formatDate, getTodayDateString } from '../../lib/utils';
import { exportToExcel } from '../../lib/excelExport';
import { Receipt, Plus, Download, Trash2, X, AlertTriangle } from 'lucide-react';

export const ExpenseListView: React.FC = () => {
  const { t } = useI18n();
  const { canRecordCratesAndPayments, canEditOrDelete } = useAuth();
  const { state } = useApp();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Form State
  const [expenseDate, setExpenseDate] = useState(getTodayDateString());
  const [category, setCategory] = useState(state.settings.expenseCategories[0] || 'Transport');
  const [amount, setAmount] = useState<number>(0);
  const [mode, setMode] = useState<PaymentMode>('cash');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const activeExpenses = useMemo(() => {
    return state.expenses
      .filter(e => !e.deletedAt && (selectedCategory === 'all' || e.category === selectedCategory))
      .sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime());
  }, [state.expenses, selectedCategory]);

  const totalExpenseAmount = useMemo(() => {
    return activeExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [activeExpenses]);

  // Breakdown by Category
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    state.expenses.filter(e => !e.deletedAt).forEach(e => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return map;
  }, [state.expenses]);

  const handleSaveExpense = () => {
    setErrorMsg('');
    if (amount <= 0) {
      setErrorMsg('Enter a valid amount greater than ₹0');
      return;
    }

    dbService.recordExpense({
      id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      expenseDate,
      category,
      amount,
      mode,
      notes: notes || undefined,
      createdAt: new Date().toISOString()
    });

    setIsAddModalOpen(false);
    setAmount(0);
    setNotes('');
  };

  const handleDeleteExpense = (id: string) => {
    if (confirm('Delete this expense entry?')) {
      dbService.deleteExpense(id);
    }
  };

  const handleExportExcel = () => {
    const data = activeExpenses.map(e => ({
      'Date': formatDate(e.expenseDate),
      'Category': e.category,
      'Amount (₹)': e.amount,
      'Mode': e.mode.toUpperCase(),
      'Notes': e.notes || ''
    }));
    exportToExcel(data, 'TSK_Mandi_Expenses', 'Expenses');
  };

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4 pb-24 select-none">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center space-x-2">
            <Receipt className="w-6 h-6 text-purple-600" />
            <span>{t('nav.expenses')}</span>
          </h2>
          <p className="text-xs text-slate-500">
            Mandi Operational Expenses • Total: <strong>{formatINR(totalExpenseAmount)}</strong>
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
          >
            <Download className="w-4 h-4 text-purple-600" />
            <span>Export Excel</span>
          </button>

          {canRecordCratesAndPayments && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Record Expense</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Pills Breakdown */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            selectedCategory === 'all'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All ({formatINR(totalExpenseAmount)})
        </button>
        {state.settings.expenseCategories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {cat} ({formatINR(categoryBreakdown[cat] || 0)})
          </button>
        ))}
      </div>

      {/* Expenses List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 font-bold text-[11px] text-slate-600 uppercase">
              <tr>
                <th className="p-3 pl-4">Date</th>
                <th className="p-3">Category</th>
                <th className="p-3">Mode</th>
                <th className="p-3">Notes / Ref</th>
                <th className="p-3 text-right">Amount (₹)</th>
                {canEditOrDelete && <th className="p-3 pr-4 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No expenses recorded.
                  </td>
                </tr>
              ) : (
                activeExpenses.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="p-3 pl-4 font-mono text-slate-500">{formatDate(e.expenseDate)}</td>
                    <td className="p-3 font-bold text-slate-900">{e.category}</td>
                    <td className="p-3 uppercase text-[11px] font-semibold text-slate-500">{e.mode}</td>
                    <td className="p-3 text-slate-600">{e.notes || '-'}</td>
                    <td className="p-3 text-right font-black text-slate-900 text-sm">{formatINR(e.amount)}</td>
                    {canEditOrDelete && (
                      <td className="p-3 pr-4 text-right">
                        <button
                          onClick={() => handleDeleteExpense(e.id)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECORD EXPENSE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 select-none">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            <div className="bg-purple-600 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-extrabold text-base">Record Expense</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs text-slate-800">
              {errorMsg && (
                <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2 rounded-xl font-bold">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="font-bold block mb-1">Expense Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full h-10 px-2 rounded-xl border border-slate-300 font-bold"
                >
                  {state.settings.expenseCategories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold block mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    value={amount || ''}
                    onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full h-10 px-3 rounded-xl border-2 border-slate-300 font-black text-sm text-right"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Payment Mode</label>
                  <select
                    value={mode}
                    onChange={e => setMode(e.target.value as any)}
                    className="w-full h-10 px-2 rounded-xl border border-slate-300 font-semibold"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">Date</label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={e => setExpenseDate(e.target.value)}
                  className="w-full h-9 px-2 rounded-xl border border-slate-300 font-semibold"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Optional detail"
                  className="w-full h-9 px-2 rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveExpense}
                className="px-5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold shadow"
              >
                Save Expense
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
