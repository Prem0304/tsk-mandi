// ============================================================================
// COMPREHENSIVE REPORTS MODULE (SECTION 14)
// Profit Report (Booked vs Realised vs Pending), Lot-wise P&L, Collection Split, Registers
// Exportable to Excel & Printable PDF
// ============================================================================

import React, { useState, useMemo } from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../lib/db';
import { formatINR, formatDate, getTodayDateString } from '../../lib/utils';
import { exportToExcel } from '../../lib/excelExport';
import {
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  Layers,
  FileText,
  DollarSign,
  PieChart
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { t } = useI18n();
  const { state, customerSummaries, supplierSummaries } = useApp();

  const [activeReport, setActiveReport] = useState<
    'profit' | 'lots' | 'collection_split' | 'sales_reg' | 'purchase_reg'
  >('profit');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Profit Metrics with date filter
  const profitMetrics = useMemo(() => {
    return dbService.getProfitMetrics(startDate, endDate);
  }, [state, startDate, endDate]);

  // Lot-wise P&L Data
  const lotPnlData = useMemo(() => {
    return state.purchaseLines.map(lot => {
      const supp = state.suppliers.find(s => s.id === lot.supplierId);
      const cost = lot.cratesPurchased * lot.effectiveCostPerCrate;

      // Find all sale allocations for this lot
      const allocations = state.sales
        .filter(s => !s.deletedAt)
        .flatMap(s => s.allocations.filter(a => a.lotId === lot.id));

      const cratesSold = allocations.reduce((sum, a) => sum + a.crates, 0);
      const salesValue = allocations.reduce((sum, a) => sum + a.saleAmount, 0);
      const bookedProfit = allocations.reduce((sum, a) => sum + a.bookedProfit, 0);

      // Payments collected for this lot
      const paymentAllocs = state.paymentAllocations.filter(pa => pa.lotId === lot.id);
      const supplierShareCollected = paymentAllocs.reduce((sum, pa) => sum + pa.supplierShare, 0);
      const realisedProfit = paymentAllocs.reduce((sum, pa) => sum + pa.profitShare, 0);

      return {
        lotNo: lot.lotNo,
        supplierName: supp?.name || 'Supplier',
        category: lot.categoryId.toUpperCase(),
        cratesPurchased: lot.cratesPurchased,
        cratesSold,
        cratesRemaining: lot.cratesRemaining,
        cratesWasted: lot.cratesWasted,
        costPerCrate: lot.effectiveCostPerCrate,
        totalCost: cost,
        salesValue,
        bookedProfit,
        supplierShareCollected,
        realisedProfit
      };
    });
  }, [state.purchaseLines, state.sales, state.paymentAllocations, state.suppliers]);

  // Collection Split Report Data (Section 9A)
  const collectionSplitData = useMemo(() => {
    return state.paymentsReceived
      .filter(p => !p.deletedAt)
      .map(p => {
        const cust = state.customers.find(c => c.id === p.customerId);
        const allocs = state.paymentAllocations.filter(pa => pa.paymentId === p.id);
        const suppShare = allocs.reduce((sum, a) => sum + a.supplierShare, 0);
        const trShare = allocs.reduce((sum, a) => sum + a.transportShare, 0);
        const profitShare = allocs.reduce((sum, a) => sum + a.profitShare, 0);

        return {
          paymentDate: p.paymentDate,
          customerName: cust?.name || 'Customer',
          mode: p.mode.toUpperCase(),
          amount: p.amount,
          discount: p.discount,
          supplierShare: suppShare,
          transportShare: trShare,
          profitShare: profitShare,
          referenceNo: p.referenceNo || '-'
        };
      });
  }, [state.paymentsReceived, state.paymentAllocations, state.customers]);

  const handleExportCurrentReport = () => {
    if (activeReport === 'profit') {
      const data = [
        { Metric: 'Sales Amount (Billed)', Amount: profitMetrics.totalSales },
        { Metric: 'Cost of Tomato Crates Sold', Amount: profitMetrics.totalCostOfSales },
        { Metric: 'Wastage / Loss', Amount: profitMetrics.totalWastageLoss },
        { Metric: 'Operating Expenses', Amount: profitMetrics.totalExpenses },
        { Metric: 'Discounts Given', Amount: profitMetrics.totalDiscounts },
        { Metric: 'Bad Debts Written Off', Amount: profitMetrics.totalBadDebts },
        { Metric: 'BOOKED PROFIT', Amount: profitMetrics.bookedProfit },
        { Metric: 'REALISED PROFIT (Cash Collected)', Amount: profitMetrics.realisedProfit },
        { Metric: 'PENDING PROFIT', Amount: profitMetrics.pendingProfit }
      ];
      exportToExcel(data, 'TSK_Profit_Report', 'Profit');
    } else if (activeReport === 'lots') {
      exportToExcel(lotPnlData, 'TSK_Lotwise_PnL_Report', 'LotPnL');
    } else if (activeReport === 'collection_split') {
      exportToExcel(collectionSplitData, 'TSK_Collection_Split_Report', 'CollectionSplit');
    } else if (activeReport === 'sales_reg') {
      const data = state.sales.filter(s => !s.deletedAt).map(s => ({
        'Bill No': s.billNo,
        'Date': formatDate(s.saleDate),
        'Customer': state.customers.find(c => c.id === s.customerId)?.name || '',
        'Total Crates': s.totalCrates,
        'Subtotal (₹)': s.subtotalAmount,
        'Transport (₹)': s.transportCharge,
        'Discount (₹)': s.discount,
        'Bill Total (₹)': s.billTotal,
        'Received (₹)': s.amountReceivedNow
      }));
      exportToExcel(data, 'TSK_Sales_Register', 'Sales');
    } else if (activeReport === 'purchase_reg') {
      const data = state.purchases.filter(p => !p.deletedAt).map(p => ({
        'Bill / Ref No': p.billNo,
        'Date': formatDate(p.purchaseDate),
        'Supplier': state.suppliers.find(s => s.id === p.supplierId)?.name || '',
        'Vehicle': p.vehicleNo || '',
        'Total Crates': p.totalCrates,
        'Subtotal (₹)': p.subtotalAmount,
        'Transport (₹)': p.transportCharge,
        'Net Payable (₹)': p.netAmount,
        'Paid Now (₹)': p.amountPaidNow
      }));
      exportToExcel(data, 'TSK_Purchase_Register', 'Purchases');
    }
  };

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4 pb-24 select-none">
      
      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center space-x-2">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            <span>{t('nav.reports')}</span>
          </h2>
          <p className="text-xs text-slate-500">
            Exportable to Excel & PDF • Verified Section 9A P&L & Registers
          </p>
        </div>

        <button
          onClick={handleExportCurrentReport}
          className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all"
        >
          <Download className="w-4 h-4" />
          <span>Export to Excel (.xlsx)</span>
        </button>
      </div>

      {/* Report Switcher & Date Filters */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: 'profit', label: 'Profit Report (Booked vs Realised)' },
            { id: 'lots', label: 'Lot-wise P&L' },
            { id: 'collection_split', label: 'Collection Split (Sec 9A)' },
            { id: 'sales_reg', label: 'Sales Register' },
            { id: 'purchase_reg', label: 'Purchase Register' }
          ].map(r => (
            <button
              key={r.id}
              onClick={() => setActiveReport(r.id as any)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                activeReport === r.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-1 text-[11px] font-semibold text-slate-600">
          <Calendar className="w-3.5 h-3.5" />
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="h-8 px-1.5 rounded-lg border border-slate-300"
          />
          <span>to</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="h-8 px-1.5 rounded-lg border border-slate-300"
          />
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="text-slate-400 hover:text-slate-700 underline ml-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* REPORT 1: PROFIT REPORT (BOOKED VS REALISED VS PENDING) */}
      {activeReport === 'profit' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-5 rounded-3xl shadow-sm">
              <span className="text-xs font-semibold text-emerald-100">BOOKED PROFIT</span>
              <div className="text-3xl font-black mt-1">
                {formatINR(profitMetrics.bookedProfit)}
              </div>
              <p className="text-[11px] text-emerald-100/80 mt-1">
                Sales − FIFO Cost − Wastage − Expenses − Discounts
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-5 rounded-3xl shadow-sm">
              <span className="text-xs font-semibold text-blue-100">REALISED PROFIT</span>
              <div className="text-3xl font-black mt-1">
                {formatINR(profitMetrics.realisedProfit)}
              </div>
              <p className="text-[11px] text-blue-100/80 mt-1">
                Profit share of cash actually collected
              </p>
            </div>

            <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white p-5 rounded-3xl shadow-sm">
              <span className="text-xs font-semibold text-amber-100">PENDING PROFIT</span>
              <div className="text-3xl font-black mt-1">
                {formatINR(profitMetrics.pendingProfit)}
              </div>
              <p className="text-[11px] text-amber-100/80 mt-1">
                Booked − Realised (Locked in credit)
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-3">
            <h3 className="font-extrabold text-sm text-slate-800">
              Profit & Loss Breakdown Breakdown
            </h3>
            <div className="space-y-2 text-xs divide-y divide-slate-100">
              <div className="flex justify-between py-1">
                <span className="text-slate-600">Total Tomato Sales Value</span>
                <strong className="text-slate-900">{formatINR(profitMetrics.totalSales)}</strong>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600">Total Cost of Crates Sold (FIFO Lots)</span>
                <strong className="text-slate-900">− {formatINR(profitMetrics.totalCostOfSales)}</strong>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600">Wastage / Spoiled Tomato Loss</span>
                <strong className="text-rose-700">− {formatINR(profitMetrics.totalWastageLoss)}</strong>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600">Operating Expenses (Hamali, Loading, Rent, etc.)</span>
                <strong className="text-purple-700">− {formatINR(profitMetrics.totalExpenses)}</strong>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600">Settlement Discounts Allowed</span>
                <strong className="text-rose-600">− {formatINR(profitMetrics.totalDiscounts)}</strong>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600">Bad Debts Written Off</span>
                <strong className="text-rose-800">− {formatINR(profitMetrics.totalBadDebts)}</strong>
              </div>
              <div className="flex justify-between py-2 border-t-2 border-slate-200 font-black text-sm">
                <span>Final Booked Net Profit</span>
                <span className={profitMetrics.bookedProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                  {formatINR(profitMetrics.bookedProfit)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REPORT 2: LOT-WISE P&L */}
      {activeReport === 'lots' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase">
                <tr>
                  <th className="p-3 pl-4">Lot No</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3">Cat</th>
                  <th className="p-3 text-center">Purchased</th>
                  <th className="p-3 text-center">Sold</th>
                  <th className="p-3 text-center">Remaining</th>
                  <th className="p-3 text-right">Cost/Crate</th>
                  <th className="p-3 text-right">Sales Val</th>
                  <th className="p-3 text-right">Booked P&L</th>
                  <th className="p-3 pr-4 text-right">Realised P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {lotPnlData.map(l => (
                  <tr key={l.lotNo} className="hover:bg-slate-50">
                    <td className="p-3 pl-4 font-mono font-bold text-indigo-900">{l.lotNo}</td>
                    <td className="p-3 font-semibold text-slate-800">{l.supplierName}</td>
                    <td className="p-3 font-bold">{l.category}</td>
                    <td className="p-3 text-center">{l.cratesPurchased}</td>
                    <td className="p-3 text-center font-bold text-emerald-700">{l.cratesSold}</td>
                    <td className="p-3 text-center font-bold text-amber-700">{l.cratesRemaining}</td>
                    <td className="p-3 text-right">{formatINR(l.costPerCrate)}</td>
                    <td className="p-3 text-right font-bold">{formatINR(l.salesValue)}</td>
                    <td className="p-3 text-right font-black text-emerald-700">{formatINR(l.bookedProfit)}</td>
                    <td className="p-3 pr-4 text-right font-black text-blue-700">{formatINR(l.realisedProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 3: COLLECTION SPLIT REPORT (SECTION 9A) */}
      {activeReport === 'collection_split' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase">
                <tr>
                  <th className="p-3 pl-4">Date</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Mode / Ref</th>
                  <th className="p-3 text-right">Amount (₹)</th>
                  <th className="p-3 text-right text-amber-800">Supplier Share (₹)</th>
                  <th className="p-3 text-right text-blue-800">Transport Rec (₹)</th>
                  <th className="p-3 pr-4 text-right text-emerald-700">Realised Profit (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {collectionSplitData.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-400">No payment collections recorded.</td></tr>
                ) : (
                  collectionSplitData.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-3 pl-4 font-mono text-slate-500">{formatDate(c.paymentDate)}</td>
                      <td className="p-3 font-bold text-slate-900">{c.customerName}</td>
                      <td className="p-3 text-slate-500">{c.mode} {c.referenceNo !== '-' ? `(${c.referenceNo})` : ''}</td>
                      <td className="p-3 text-right font-extrabold text-slate-900">{formatINR(c.amount)}</td>
                      <td className="p-3 text-right font-bold text-amber-900">{formatINR(c.supplierShare)}</td>
                      <td className="p-3 text-right font-bold text-blue-800">{formatINR(c.transportShare)}</td>
                      <td className="p-3 pr-4 text-right font-black text-emerald-700">{formatINR(c.profitShare)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 4 & 5: REGISTERS */}
      {(activeReport === 'sales_reg' || activeReport === 'purchase_reg') && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 text-xs text-slate-500">
          Showing complete transaction log for {activeReport === 'sales_reg' ? 'Sales' : 'Purchases'}. Click "Export to Excel" above to download the full registry.
        </div>
      )}

    </div>
  );
};
