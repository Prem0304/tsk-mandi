// ============================================================================
// MAIN MANDI DASHBOARD VIEW
// Today's KPIs, Profit Cards, Supplier Money, Live Stock, Crates & Quick Actions
// ============================================================================

import React, { useState } from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { formatINR, getTodayDateString, formatDateWithDay } from '../../lib/utils';
import { shareDailyOwnerSummaryWhatsApp } from '../../lib/whatsapp';
import { exportCustomerPendingCratesExcel } from '../../lib/excelExport';
import {
  TrendingUp,
  DollarSign,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  Box,
  Truck,
  ShoppingCart,
  Plus,
  Share2,
  Clock,
  CheckCircle2,
  Users,
  Download,
  Coins,
  Eye,
  EyeOff,
  Shield
} from 'lucide-react';

interface DashboardViewProps {
  onOpenSale: () => void;
  onOpenQuickSale: () => void;
  onOpenPurchase: () => void;
  onOpenReceivePayment: () => void;
  onOpenPaySupplier: () => void;
  onOpenCrateReturn: () => void;
  onOpenExpense: () => void;
  onSelectCustomer: (id: string) => void;
  onSelectSupplier: (id: string) => void;
  onOpenCollection?: () => void;
  isPrivacyMode?: boolean;
  onTogglePrivacy?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenSale,
  onOpenQuickSale,
  onOpenPurchase,
  onOpenReceivePayment,
  onOpenPaySupplier,
  onOpenCrateReturn,
  onOpenExpense,
  onSelectCustomer,
  onSelectSupplier,
  onOpenCollection,
  isPrivacyMode,
  onTogglePrivacy
}) => {
  const { t, language } = useI18n();
  const { canSeeProfit, canCreateSales } = useAuth();
  const [internalPrivacy, setInternalPrivacy] = useState(false);
  const privacyActive = isPrivacyMode !== undefined ? isPrivacyMode : internalPrivacy;
  const togglePrivacy = () => {
    if (onTogglePrivacy) onTogglePrivacy();
    else setInternalPrivacy(!internalPrivacy);
  };
  const {
    state,
    stockSummaries,
    shopCrateSummaries,
    customerSummaries,
    supplierSummaries,
    profitMetrics
  } = useApp();

  const [isFabOpen, setIsFabOpen] = useState(false);

  const todayStr = getTodayDateString();

  // Today's stats
  const todayPurchases = state.purchases.filter(p => p.purchaseDate === todayStr && !p.deletedAt);
  const todaySales = state.sales.filter(s => s.saleDate === todayStr && !s.deletedAt);
  const todayPaymentsRecv = state.paymentsReceived.filter(p => p.paymentDate === todayStr && !p.deletedAt);
  const todayPaymentsMade = state.paymentsMade.filter(p => p.paymentDate === todayStr && !p.deletedAt);
  const todayExpenses = state.expenses.filter(e => e.expenseDate === todayStr && !e.deletedAt);

  const todaySalesAmount = todaySales.reduce((sum, s) => sum + s.billTotal, 0);
  const todayPurchaseAmount = todayPurchases.reduce((sum, p) => sum + p.netAmount, 0);
  const todayCashReceived = todayPaymentsRecv.filter(p => p.mode === 'cash').reduce((sum, p) => sum + p.amount, 0);
  const todayUpiReceived = todayPaymentsRecv.filter(p => p.mode === 'upi' || p.mode === 'bank').reduce((sum, p) => sum + p.amount, 0);
  const todayCashPaid = todayPaymentsMade.filter(p => p.mode === 'cash').reduce((sum, p) => sum + p.amount, 0);
  const todayExpensesTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Today's crates
  const todayCratesSoldBig = todaySales.reduce((sum, s) => sum + (s.lines.find(l => l.categoryId === 'big')?.crates || 0), 0);
  const todayCratesSoldSmall = todaySales.reduce((sum, s) => sum + (s.lines.find(l => l.categoryId === 'small')?.crates || 0), 0);
  const todayCratesPurBig = todayPurchases.reduce((sum, p) => sum + (p.lines.find(l => l.categoryId === 'big')?.cratesPurchased || 0), 0);
  const todayCratesPurSmall = todayPurchases.reduce((sum, p) => sum + (p.lines.find(l => l.categoryId === 'small')?.cratesPurchased || 0), 0);

  // Aggregated Supplier Money Cards
  const totalMoneyInHandForSuppliers = supplierSummaries.reduce((sum, s) => sum + s.moneyInHand, 0);
  const totalStillToCollectFromCust = supplierSummaries.reduce((sum, s) => sum + s.stillToCollect, 0);
  const totalSupplierPayable = supplierSummaries.reduce((sum, s) => sum + s.balancePayable, 0);

  // Total Receivables
  const totalCustomerReceivables = customerSummaries.reduce((sum, c) => sum + Math.max(0, c.currentBalance), 0);

  // Top 5 Outstanding Customers
  const topOutstanding = [...customerSummaries]
    .filter(c => c.currentBalance > 0)
    .sort((a, b) => b.currentBalance - a.currentBalance)
    .slice(0, 5);

  // Top 5 Crate Defaulters
  const topCrateDefaulters = [...customerSummaries]
    .map(c => {
      const totalHeld = Object.values(c.cratesHeld).reduce((a, b) => a + b, 0);
      return { ...c, totalHeld };
    })
    .filter(c => c.totalHeld > 0)
    .sort((a, b) => b.totalHeld - a.totalHeld)
    .slice(0, 5);

  const handleShareEodSummary = () => {
    const cratesWithCustomers = {
      big: shopCrateSummaries.find(c => c.categoryId === 'big')?.withCustomers || 0,
      small: shopCrateSummaries.find(c => c.categoryId === 'small')?.withCustomers || 0
    };

    shareDailyOwnerSummaryWhatsApp(state.settings, todayStr, {
      totalSales: todaySalesAmount,
      totalCollections: todayCashReceived + todayUpiReceived,
      totalPurchases: todayPurchaseAmount,
      totalPaidSuppliers: todayCashPaid,
      totalExpenses: todayExpensesTotal,
      totalReceivables: totalCustomerReceivables,
      moneyInHandForSuppliers: totalMoneyInHandForSuppliers,
      bookedProfit: profitMetrics.bookedProfit,
      realisedProfit: profitMetrics.realisedProfit,
      cratesWithCustomers
    });
  };

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4 sm:space-y-6 pb-24 select-none">
      
      {/* Top Banner & Date + EOD Share */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gradient-to-r from-tomato via-rose-700 to-rose-800 text-white p-4 rounded-2xl shadow-md">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-black bg-white/20 px-2.5 py-1 rounded-lg">
              {formatDateWithDay(todayStr, language, false)}
            </span>
            <span className="text-xs text-white/80 font-medium">Mandi Live (Asia/Kolkata)</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black mt-1">
            {t('dashboard.todayOverview')}
          </h2>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {onOpenCollection && (
            <button
              onClick={onOpenCollection}
              className="flex items-center justify-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl font-black text-xs shadow-md transition-all active:scale-95 border border-emerald-400/40"
              title={language === 'ta' ? 'வாடிக்கையாளர் வசூல்' : 'Collect Money'}
            >
              <Coins className="w-4 h-4 text-emerald-100" />
              <span>{language === 'ta' ? 'வாடிக்கையாளர் வசூல்' : 'Collect Money'}</span>
            </button>
          )}

          {canSeeProfit && (
            <button
              onClick={handleShareEodSummary}
              className="flex items-center justify-center space-x-2 bg-white text-tomato hover:bg-rose-50 px-3.5 py-2 rounded-xl font-bold text-xs shadow transition-all active:scale-95 shrink-0"
            >
              <Share2 className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">Share Daily Summary (WhatsApp)</span>
              <span className="sm:hidden">Share EOD</span>
            </button>
          )}
        </div>
      </div>

      {/* TODAY'S METRICS STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        
        {/* Sales */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{t('dashboard.todaySales')}</span>
            <ShoppingCart className="w-4 h-4 text-tomato" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-slate-900">
            {formatINR(todaySalesAmount)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
            Big: <strong className="text-slate-800">{todayCratesSoldBig}</strong> | Small: <strong className="text-slate-800">{todayCratesSoldSmall}</strong>
          </div>
        </div>

        {/* Purchases */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{t('dashboard.todayPurchases')}</span>
            <Truck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-slate-900">
            {formatINR(todayPurchaseAmount)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
            Big: <strong className="text-slate-800">{todayCratesPurBig}</strong> | Small: <strong className="text-slate-800">{todayCratesPurSmall}</strong>
          </div>
        </div>

        {/* Collections */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">{t('dashboard.todayCollections')}</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-emerald-700">
            {formatINR(todayCashReceived + todayUpiReceived)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Cash: {formatINR(todayCashReceived)} | UPI: {formatINR(todayUpiReceived)}
          </div>
        </div>

        {/* Outflow (Supplier + Expenses) */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Today Outflow</span>
            <ArrowUpRight className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-slate-900">
            {formatINR(todayCashPaid + todayExpensesTotal)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Supplier: {formatINR(todayCashPaid)} | Exp: {formatINR(todayExpensesTotal)}
          </div>
        </div>

      </div>

      {/* PROFIT REALIZATION CARDS (SECTION 9A & 13) - OWNER ONLY */}
      {canSeeProfit && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>{t('dashboard.profitOverview')} (Section 9A)</span>
            </h3>

            {/* Privacy Shield Toggle Button */}
            <button
              type="button"
              onClick={togglePrivacy}
              className={`flex items-center space-x-1.5 text-xs font-bold px-2.5 py-1 rounded-xl border transition-all ${
                privacyActive
                  ? 'bg-amber-100 border-amber-300 text-amber-900 shadow-inner'
                  : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600 shadow-xs'
              }`}
              title={privacyActive ? 'Privacy Active (Profits hidden)' : 'Counter Shield (Click to mask profits)'}
            >
              {privacyActive ? <EyeOff className="w-3.5 h-3.5 text-amber-800" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
              <span>{privacyActive ? (language === 'ta' ? 'ரகசிய முறை இயக்கத்தில்' : 'Shield ON') : (language === 'ta' ? 'ரகசிய முறை' : 'Shield Profit')}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            
            {/* Booked Profit */}
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-4 rounded-2xl shadow-sm">
              <span className="text-xs text-emerald-100 font-semibold">{t('dashboard.bookedProfit')}</span>
              <div className={`text-2xl font-black mt-1 transition-all ${privacyActive ? 'blur-sm select-none' : ''}`}>
                {privacyActive ? '••••••' : formatINR(profitMetrics.bookedProfit)}
              </div>
              <p className="text-[11px] text-emerald-100/90 mt-1">
                Sales − FIFO Cost − Wastage − Expenses − Discounts
              </p>
            </div>

            {/* Realised Profit (Cash Collected) */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-4 rounded-2xl shadow-sm">
              <span className="text-xs text-blue-100 font-semibold">{t('dashboard.realisedProfit')}</span>
              <div className={`text-2xl font-black mt-1 transition-all ${privacyActive ? 'blur-sm select-none' : ''}`}>
                {privacyActive ? '••••••' : formatINR(profitMetrics.realisedProfit)}
              </div>
              <p className="text-[11px] text-blue-100/90 mt-1">
                Actual profit share collected from payments
              </p>
            </div>

            {/* Pending Profit */}
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white p-4 rounded-2xl shadow-sm">
              <span className="text-xs text-amber-100 font-semibold">{t('dashboard.pendingProfit')}</span>
              <div className={`text-2xl font-black mt-1 transition-all ${privacyActive ? 'blur-sm select-none' : ''}`}>
                {privacyActive ? '••••••' : formatINR(profitMetrics.pendingProfit)}
              </div>
              <p className="text-[11px] text-amber-100/90 mt-1">
                Booked profit locked in customer credit
              </p>
            </div>

          </div>
        </div>
      )}

      {/* SUPPLIER MONEY CARDS (SECTION 8 & 9A) - OWNER ONLY */}
      {canSeeProfit && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <DollarSign className="w-4 h-4 text-amber-600" />
            <span>{t('dashboard.supplierMoney')}</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            
            {/* Money in Hand for Suppliers */}
            <div className="bg-amber-50 border-2 border-amber-300 p-4 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800">{t('dashboard.moneyInHand')}</span>
                <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">
                  Collected
                </span>
              </div>
              <div className={`text-2xl font-black text-amber-950 mt-1 transition-all ${privacyActive ? 'blur-sm select-none' : ''}`}>
                {privacyActive ? '••••••' : formatINR(totalMoneyInHandForSuppliers)}
              </div>
              <p className="text-[11px] text-amber-700 mt-1">
                Collected from customers, ready to pay out to suppliers
              </p>
            </div>

            {/* Dues Still to Collect */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl shadow-sm">
              <span className="text-xs font-semibold text-slate-600">{t('dashboard.stillToCollect')}</span>
              <div className="text-2xl font-black text-slate-800 mt-1">
                {formatINR(totalStillToCollectFromCust)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Supplier cost still pending with customers
              </p>
            </div>

            {/* Total Supplier Dues */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl shadow-sm">
              <span className="text-xs font-semibold text-slate-600">{t('dashboard.totalPayable')}</span>
              <div className="text-2xl font-black text-rose-700 mt-1">
                {formatINR(totalSupplierPayable)}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Total balance owed to suppliers
              </p>
            </div>

          </div>
        </div>
      )}

      {/* LIVE TOMATO STOCK & CRATE ACCOUNTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Live Tomato Stock */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
              <img src="/tomato.svg" alt="" className="w-4 h-4" />
              <span>{t('dashboard.stockStatus')}</span>
            </h3>
            <span className="text-xs text-slate-400 font-medium">Never negative</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {stockSummaries.map(cat => (
              <div
                key={cat.categoryId}
                className={`p-3 rounded-xl border transition-all ${
                  cat.isLowStock
                    ? 'bg-rose-50 border-rose-300'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    {language === 'ta' ? cat.categoryNameTa : cat.categoryName}
                  </span>
                  {cat.isLowStock && (
                    <span className="text-[10px] font-bold bg-rose-200 text-rose-800 px-1 rounded flex items-center space-x-0.5">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      <span>Low</span>
                    </span>
                  )}
                </div>
                <div className={`text-2xl font-black mt-1 ${cat.isLowStock ? 'text-rose-700' : 'text-slate-900'}`}>
                  {cat.availableStock} <span className="text-xs font-medium text-slate-500">crates</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Pur: {cat.totalPurchased} | Sold: {cat.totalSold} | Waste: {cat.totalWasted}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Crate Inventory Summary (Section 10) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
              <Box className="w-4 h-4 text-emerald-600" />
              <span>{t('crates.title')}</span>
            </h3>
            <span className="text-xs text-slate-400 font-medium">Count Only</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {shopCrateSummaries.map(crate => (
              <div key={crate.categoryId} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-700">
                  {language === 'ta' ? crate.categoryNameTa : crate.categoryName}
                </span>
                <div className="grid grid-cols-2 gap-1 text-[11px] mt-2">
                  <div className="text-slate-600">
                    Empty in Shop: <strong className="text-slate-900">{crate.emptyInShop}</strong>
                  </div>
                  <div className="text-slate-600">
                    Filled: <strong className="text-slate-900">{crate.filledWithStock}</strong>
                  </div>
                  <div className="text-rose-700">
                    With Cust: <strong>{crate.withCustomers}</strong>
                  </div>
                  <div className="text-blue-700">
                    Owed Sup: <strong>{crate.owedToSuppliers}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* OUTSTANDING CUSTOMER DUES & CRATE DEFAULTERS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Top Outstanding Customers */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
              <Users className="w-4 h-4 text-rose-600" />
              <span>{t('dashboard.topOutstanding')}</span>
            </h3>
            <span className="text-xs font-bold text-rose-600">
              Total: {formatINR(totalCustomerReceivables)}
            </span>
          </div>

          <div className="space-y-2">
            {topOutstanding.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-4">No outstanding dues! All settled.</div>
            ) : (
              topOutstanding.map(cust => (
                <div
                  key={cust.customerId}
                  onClick={() => onSelectCustomer(cust.customerId)}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-rose-50/50 cursor-pointer border border-slate-100 transition-all"
                >
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">{cust.customerName}</h4>
                    <p className="text-[11px] text-slate-500">{cust.place || cust.phone} • {cust.agingDays} days</p>
                  </div>
                  <span className="text-xs font-extrabold text-rose-600">
                    {formatINR(cust.currentBalance)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Crate Defaulters */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
              <Box className="w-4 h-4 text-amber-600" />
              <span>{t('dashboard.topCrateDefaulters')}</span>
            </h3>
            <div className="flex items-center space-x-2">
              {topCrateDefaulters.length > 0 && (
                <button
                  onClick={() => exportCustomerPendingCratesExcel(topCrateDefaulters, state.settings.shopName)}
                  title="Download Crates to Collect (Excel)"
                  className="flex items-center space-x-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md transition-colors"
                >
                  <Download className="w-3 h-3" />
                  <span>Download</span>
                </button>
              )}
              <span className="text-xs text-slate-400">Holdings</span>
            </div>
          </div>

          <div className="space-y-2">
            {topCrateDefaulters.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-4">No crate defaulters. All returned!</div>
            ) : (
              topCrateDefaulters.map(cust => (
                <div
                  key={cust.customerId}
                  onClick={() => onSelectCustomer(cust.customerId)}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-amber-50/50 cursor-pointer border border-slate-100 transition-all"
                >
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">{cust.customerName}</h4>
                    <p className="text-[11px] text-slate-500">{cust.place || cust.phone}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-amber-800">
                      Big: {cust.cratesHeld['big'] || 0} | Small: {cust.cratesHeld['small'] || 0}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* FLOATING ACTION BUTTON (FAB) FOR QUICK MANDI ACTIONS */}
      <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40">
        
        {/* Expanded menu */}
        {isFabOpen && (
          <div className="flex flex-col items-end space-y-2 mb-3 animate-in slide-in-from-bottom-2 duration-150">
            
            {canCreateSales && (
              <>
                <button
                  onClick={() => { setIsFabOpen(false); onOpenSale(); }}
                  className="flex items-center space-x-2 bg-tomato text-white px-3.5 py-2 rounded-full shadow-lg text-xs font-bold hover:brightness-110 active:scale-95 transition-all"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>{t('nav.sale')}</span>
                </button>

                <button
                  onClick={() => { setIsFabOpen(false); onOpenQuickSale(); }}
                  className="flex items-center space-x-2 bg-amber-500 text-white px-3.5 py-2 rounded-full shadow-lg text-xs font-bold hover:brightness-110 active:scale-95 transition-all"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>{t('nav.quickSale')}</span>
                </button>
              </>
            )}

            {onOpenCollection && (
              <button
                onClick={() => { setIsFabOpen(false); onOpenCollection(); }}
                className="flex items-center space-x-2 bg-emerald-600 text-white px-3.5 py-2 rounded-full shadow-lg text-xs font-black hover:brightness-110 active:scale-95 transition-all border border-emerald-400/40"
              >
                <Coins className="w-4 h-4 text-emerald-200" />
                <span>{language === 'ta' ? 'வாடிக்கையாளர் வசூல்' : 'Collect Money'}</span>
              </button>
            )}

            {canSeeProfit && (
              <button
                onClick={() => { setIsFabOpen(false); onOpenPurchase(); }}
                className="flex items-center space-x-2 bg-blue-600 text-white px-3.5 py-2 rounded-full shadow-lg text-xs font-bold hover:brightness-110 active:scale-95 transition-all"
              >
                <Truck className="w-4 h-4" />
                <span>{t('nav.purchase')}</span>
              </button>
            )}

            <button
              onClick={() => { setIsFabOpen(false); onOpenReceivePayment(); }}
              className="flex items-center space-x-2 bg-emerald-600 text-white px-3.5 py-2 rounded-full shadow-lg text-xs font-bold hover:brightness-110 active:scale-95 transition-all"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>{t('payments.receivePayment')}</span>
            </button>

            {canSeeProfit && (
              <button
                onClick={() => { setIsFabOpen(false); onOpenPaySupplier(); }}
                className="flex items-center space-x-2 bg-indigo-600 text-white px-3.5 py-2 rounded-full shadow-lg text-xs font-bold hover:brightness-110 active:scale-95 transition-all"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>{t('payments.paySupplier')}</span>
              </button>
            )}

            <button
              onClick={() => { setIsFabOpen(false); onOpenCrateReturn(); }}
              className="flex items-center space-x-2 bg-teal-600 text-white px-3.5 py-2 rounded-full shadow-lg text-xs font-bold hover:brightness-110 active:scale-95 transition-all"
            >
              <Box className="w-4 h-4" />
              <span>{t('crates.returnEntry')}</span>
            </button>

            <button
              onClick={() => { setIsFabOpen(false); onOpenExpense(); }}
              className="flex items-center space-x-2 bg-purple-600 text-white px-3.5 py-2 rounded-full shadow-lg text-xs font-bold hover:brightness-110 active:scale-95 transition-all"
            >
              <DollarSign className="w-4 h-4" />
              <span>{t('nav.expenses')}</span>
            </button>

          </div>
        )}

        {/* Main Floating Trigger Button */}
        <button
          onClick={() => setIsFabOpen(!isFabOpen)}
          className={`w-14 h-14 rounded-full bg-tomato text-white flex items-center justify-center shadow-xl hover:bg-rose-700 active:scale-90 transition-all ${
            isFabOpen ? 'rotate-45' : ''
          }`}
          title="Quick Actions"
        >
          <Plus className="w-7 h-7" />
        </button>

      </div>

    </div>
  );
};
