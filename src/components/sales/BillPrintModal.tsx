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
import { MandiDocumentHeader } from '../common/MandiDocumentHeader';
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
    <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 select-none">
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
            {/* Mandi Letterhead Header */}
            <MandiDocumentHeader
              settings={state.settings}
              language={language}
              format={printFormat}
              docTitle={language === 'ta' ? 'விற்பனை பில்' : 'CASH / CREDIT BILL'}
            />

            {/* Bill Meta */}
            <div className="text-xs space-y-1 mb-2.5 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
              <div className="flex justify-between items-center">
                <span><span className="text-slate-500">Bill:</span> <strong className="font-mono text-slate-950">{sale.billNo}</strong></span>
                <span className="text-slate-700 text-[11px]"><strong>{formatDateWithDay(sale.saleDate, language, true)}</strong></span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-200/60 pt-1">
                <span><span className="text-slate-500">Cust:</span> <strong className="text-slate-900">{custObj.name}</strong></span>
                <span className="font-mono text-slate-700 text-[11px]">{custObj.phone}</span>
              </div>
              {custObj.shopName && (
                <div className="text-[11px] text-slate-600">
                  <span className="text-slate-500">Shop:</span> <strong>{custObj.shopName}</strong>
                </div>
              )}
            </div>

            {/* Item Table */}
            <div className="text-xs mb-3">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-900 text-[11px] uppercase font-bold text-slate-950">
                    <th className="py-1 text-left">{language === 'ta' ? 'பொருள்' : 'Item'}</th>
                    <th className="py-1 text-center w-12">{language === 'ta' ? 'பெட்டி' : 'Qty'}</th>
                    <th className="py-1 text-right w-16">{language === 'ta' ? 'விலை' : 'Rate'}</th>
                    <th className="py-1 text-right w-20">{language === 'ta' ? 'தொகை' : 'Total'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sale.lines.map((l, i) => (
                    <tr key={i} className="py-1">
                      <td className="py-1.5 text-left font-bold text-slate-900">
                        {l.categoryId === 'big'
                          ? (language === 'ta' ? 'Big (பெரிய)' : 'Big Crate')
                          : (language === 'ta' ? 'Small (சிறிய)' : 'Small Crate')}
                      </td>
                      <td className="py-1.5 text-center font-black font-mono text-slate-950">
                        {l.crates}
                      </td>
                      <td className="py-1.5 text-right font-mono text-slate-800">
                        {l.pricePerCrate.toFixed(2)}
                      </td>
                      <td className="py-1.5 text-right font-black font-mono text-slate-950">
                        {formatINR(l.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculations */}
            <div className="space-y-1 text-xs mb-3 border-t border-dashed border-slate-400 pt-2">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-600">{language === 'ta' ? 'மொத்த தொகை (Subtotal):' : 'Subtotal:'}</span>
                <span className="font-mono font-bold text-slate-900">{formatINR(sale.subtotalAmount)}</span>
              </div>
              {sale.transportCharge > 0 && (
                <div className="flex justify-between items-center py-0.5 text-slate-600">
                  <span>{language === 'ta' ? 'வண்டி வாடகை (Transport):' : 'Transport:'}</span>
                  <span className="font-mono">+{formatINR(sale.transportCharge)}</span>
                </div>
              )}
              {sale.discount > 0 && (
                <div className="flex justify-between items-center py-0.5 text-rose-600">
                  <span>{language === 'ta' ? 'தள்ளுபடி (Discount):' : 'Discount:'}</span>
                  <span className="font-mono">-{formatINR(sale.discount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center font-bold text-sm border-t border-slate-300 pt-1 text-slate-950">
                <span>{language === 'ta' ? 'பில் மொத்தம் (Bill Total):' : 'Bill Total:'}</span>
                <span className="font-mono font-black">{formatINR(sale.billTotal)}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 text-slate-600">
                <span>{language === 'ta' ? 'பழைய பாக்கி (Prev Balance):' : 'Prev Balance:'}</span>
                <span className="font-mono">{formatINR(previousBalance)}</span>
              </div>
              <div className="flex justify-between items-center py-0.5 text-emerald-700 font-bold">
                <span>{language === 'ta' ? 'இப்போது பெற்றது (Paid Now):' : 'Paid Now:'}</span>
                <span className="font-mono font-black">{formatINR(sale.amountReceivedNow)}</span>
              </div>
              <div className="flex justify-between items-center font-black text-sm border-t-2 border-slate-900 pt-1 text-slate-950">
                <span>{language === 'ta' ? 'நிகர பாக்கி (Net Balance Due):' : 'Net Balance Due:'}</span>
                <span className="font-mono font-black text-base">{formatINR(newBalance)}</span>
              </div>
            </div>

            {/* Crates Pending */}
            <div className="text-center font-bold text-[11px] my-2 bg-amber-50/80 border border-amber-200/80 rounded-xl p-2 text-amber-950">
              <span className="block font-semibold text-slate-600 text-[10px] uppercase tracking-wide">
                {language === 'ta' ? 'வாடிக்கையாளரிடம் உள்ள காலி பெட்டிகள்' : 'Pending Crates With Customer'}
              </span>
              <div className="mt-0.5 space-x-3 font-mono">
                <span>Big: <strong className="text-slate-950">{cratesHeld['big'] || 0}</strong></span>
                <span>•</span>
                <span>Small: <strong className="text-slate-950">{cratesHeld['small'] || 0}</strong></span>
              </div>
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
