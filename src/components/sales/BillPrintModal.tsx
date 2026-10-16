// ============================================================================
// BILL PRINT & PREVIEW MODAL (THERMAL 80/58MM, A4/A5 & WHATSAPP SHARE)
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useApp } from '../../context/AppContext';
import { Sale, Customer } from '../../types';
import { formatDate, formatINR, formatDateWithDay } from '../../lib/utils';
import { generateSaleBillPdf, generateUpiQrDataUrl } from '../../lib/pdfGenerator';
import { shareSaleBillWhatsApp } from '../../lib/whatsapp';
import { X, Printer, Share2, Download, Check } from 'lucide-react';

interface BillPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
}

export const BillPrintModal: React.FC<BillPrintModalProps> = ({
  isOpen,
  onClose,
  sale
}) => {
  const { t, language } = useI18n();
  const { state, customerSummaries } = useApp();
  const [printFormat, setPrintFormat] = useState<'thermal_80' | 'thermal_58' | 'a4' | 'a5'>('thermal_80');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const customer = customerSummaries.find(c => c.customerId === sale?.customerId);
  const custObj = state.customers.find(c => c.id === sale?.customerId);

  const previousBalance = customer ? (customer.currentBalance - (sale?.billTotal || 0) + (sale?.amountReceivedNow || 0)) : 0;
  const newBalance = customer ? customer.currentBalance : 0;
  const cratesHeld = customer ? customer.cratesHeld : { big: 0, small: 0 };

  useEffect(() => {
    if (sale && state.settings.upiId && newBalance > 0) {
      generateUpiQrDataUrl(state.settings.upiId, state.settings.shopName, newBalance, sale.billNo)
        .then(url => setQrDataUrl(url));
    }
  }, [sale, state.settings, newBalance]);

  if (!isOpen || !sale || !custObj) return null;

  const handleDownloadPdf = () => {
    generateSaleBillPdf({
      sale,
      customer: custObj,
      settings: state.settings,
      language,
      format: printFormat,
      previousBalance,
      cratesHeld
    });
  };

  const handleWhatsAppShare = () => {
    shareSaleBillWhatsApp(sale, custObj, state.settings, language, previousBalance, cratesHeld);
  };

  const handlePrint = () => {
    window.print();
  };

  const isThermal = printFormat === 'thermal_80' || printFormat === 'thermal_58';
  const shopName = language === 'ta' && state.settings.shopNameTa ? state.settings.shopNameTa : state.settings.shopName;
  const footerNote = language === 'ta' && state.settings.billFooterTa ? state.settings.billFooterTa : state.settings.billFooter;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 select-none">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        
        {/* Top bar */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Printer className="w-5 h-5 text-tomato" />
            <h3 className="font-bold text-sm sm:text-base">
              Bill Preview: {sale.billNo}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selector Bar */}
        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-600">Layout Format:</span>
          <div className="flex space-x-1">
            {(['thermal_80', 'thermal_58', 'a4', 'a5'] as const).map(fmt => (
              <button
                key={fmt}
                onClick={() => setPrintFormat(fmt)}
                className={`px-2 py-1 rounded-lg font-bold transition-all ${
                  printFormat === fmt
                    ? 'bg-tomato text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200'
                }`}
              >
                {fmt === 'thermal_80' ? '80mm' : fmt === 'thermal_58' ? '58mm' : fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Bill Receipt Preview Content (Printable area) */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-200/50 flex justify-center">
          <div
            id="printable-bill"
            className={`bg-white shadow-md p-4 sm:p-6 text-slate-900 font-mono transition-all border border-slate-200 ${
              isThermal ? 'w-full max-w-[320px] text-xs' : 'w-full max-w-md text-sm'
            }`}
          >
            {/* Header */}
            <div className="text-center space-y-1 mb-3">
              <h2 className="font-black text-base sm:text-lg text-slate-950 font-sans">
                {shopName}
              </h2>
              <p className="text-[11px] text-slate-600 font-sans">{state.settings.address}</p>
              <p className="text-[11px] text-slate-600 font-sans">
                Ph: {state.settings.phone} {state.settings.gstNumber ? `| GST: ${state.settings.gstNumber}` : ''}
              </p>
              <div className="border-b border-dashed border-slate-400 my-2" />
              <div className="font-bold text-xs uppercase tracking-wider font-sans">
                {language === 'ta' ? 'விற்பனை பில்' : 'CASH / CREDIT BILL'}
              </div>
            </div>

            {/* Bill Meta */}
            <div className="text-[11px] space-y-1 mb-3">
              <div className="flex justify-between">
                <span>Bill: <strong>{sale.billNo}</strong></span>
                <span>Date: <strong>{formatDateWithDay(sale.saleDate, language, true)}</strong></span>
              </div>
              <div className="flex justify-between">
                <span>Cust: <strong>{custObj.name}</strong></span>
                <span>Ph: {custObj.phone}</span>
              </div>
              {custObj.shopName && (
                <div>Shop: <strong>{custObj.shopName}</strong></div>
              )}
            </div>

            <div className="border-b border-dashed border-slate-400 my-2" />

            {/* Item Table */}
            <div className="space-y-1.5 text-xs mb-3">
              <div className="flex justify-between font-bold border-b border-slate-300 pb-1">
                <span>Item</span>
                <span>Qty</span>
                <span>Rate</span>
                <span>Total</span>
              </div>
              {sale.lines.map((l, i) => (
                <div key={i} className="flex justify-between">
                  <span>{l.categoryId === 'big' ? 'Big Crate' : 'Small Crate'}</span>
                  <span className="font-bold">{l.crates}</span>
                  <span>{l.pricePerCrate.toFixed(2)}</span>
                  <span className="font-bold">{formatINR(l.lineTotal)}</span>
                </div>
              ))}
            </div>

            <div className="border-b border-dashed border-slate-400 my-2" />

            {/* Calculations */}
            <div className="space-y-1 text-xs text-right mb-3">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatINR(sale.subtotalAmount)}</span>
              </div>
              {sale.transportCharge > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Transport:</span>
                  <span>{formatINR(sale.transportCharge)}</span>
                </div>
              )}
              {sale.discount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount:</span>
                  <span>-{formatINR(sale.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm border-t border-slate-300 pt-1">
                <span>Bill Total:</span>
                <span>{formatINR(sale.billTotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Prev Balance:</span>
                <span>{formatINR(previousBalance)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Paid Now:</span>
                <span>{formatINR(sale.amountReceivedNow)}</span>
              </div>
              <div className="flex justify-between font-black text-sm border-t border-dashed border-slate-400 pt-1 text-slate-950">
                <span>Net Balance Due:</span>
                <span>{formatINR(newBalance)}</span>
              </div>
            </div>

            <div className="border-b border-dashed border-slate-400 my-2" />

            {/* Crates Pending */}
            <div className="text-center font-bold text-xs my-2">
              Crates Pending With You: Big: {cratesHeld['big'] || 0} | Small: {cratesHeld['small'] || 0}
            </div>

            {/* UPI QR Code */}
            {qrDataUrl && newBalance > 0 && (
              <div className="text-center my-3 space-y-1">
                <img src={qrDataUrl} alt="UPI QR" className="w-28 h-28 mx-auto" />
                <p className="text-[10px] text-slate-500 font-sans">Scan UPI QR to pay ₹{newBalance.toFixed(2)}</p>
              </div>
            )}

            {/* Footer */}
            <div className="text-center text-[10px] text-slate-500 font-sans mt-3">
              {footerNote}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          
          <button
            onClick={handleWhatsAppShare}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all"
          >
            <Share2 className="w-4 h-4" />
            <span>Share on WhatsApp</span>
          </button>

          <div className="flex space-x-2 w-full sm:w-auto">
            <button
              onClick={handleDownloadPdf}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white px-3.5 py-2.5 rounded-xl font-bold text-xs shadow transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 bg-tomato hover:bg-rose-700 active:scale-95 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Print Bill</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
