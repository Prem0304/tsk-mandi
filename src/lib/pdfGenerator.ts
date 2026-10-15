// ============================================================================
// PDF GENERATION SERVICE (JSPDF + AUTOTABLE + THERMAL & A4/A5 FORMATS)
// Supports English & Tamil headers, UPI QR Code embedding
// ============================================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { Sale, Customer, AppSettings, Supplier } from '../types';
import { formatDate, formatINR } from './utils';

export interface BillPdfOptions {
  sale: Sale;
  customer: Customer;
  settings: AppSettings;
  language: 'en' | 'ta';
  format: 'thermal_80' | 'thermal_58' | 'a4' | 'a5';
  previousBalance: number;
  cratesHeld: Record<string, number>;
}

/**
 * Generate UPI QR Code as Base64 Data URL
 */
export async function generateUpiQrDataUrl(upiId: string, payeeName: string, amount: number, billNo: string): Promise<string> {
  const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(billNo)}`;
  try {
    return await QRCode.toDataURL(upiUrl, { margin: 1, width: 120 });
  } catch (err) {
    console.error('QR code generation failed:', err);
    return '';
  }
}

/**
 * Generate and download Sale Bill PDF (Thermal 80mm/58mm or A4/A5)
 */
export async function generateSaleBillPdf(options: BillPdfOptions): Promise<void> {
  const { sale, customer, settings, language, format, previousBalance, cratesHeld } = options;
  const isThermal = format === 'thermal_80' || format === 'thermal_58';
  const widthMm = format === 'thermal_58' ? 58 : format === 'thermal_80' ? 80 : format === 'a5' ? 148 : 210;
  
  // For thermal, height adapts dynamically; start with reasonable initial height
  const heightMm = isThermal ? 180 : format === 'a5' ? 210 : 297;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [widthMm, heightMm]
  });

  const shopName = language === 'ta' && settings.shopNameTa ? settings.shopNameTa : settings.shopName;
  const billTitle = language === 'ta' ? 'விற்பனை ரசீது' : 'TAX / SALE INVOICE';
  const footerNote = language === 'ta' && settings.billFooterTa ? settings.billFooterTa : settings.billFooter;

  const newBalance = previousBalance + sale.billTotal - sale.amountReceivedNow;

  let y = 8;
  const margin = isThermal ? 4 : 14;
  const usableWidth = widthMm - margin * 2;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isThermal ? 11 : 16);
  doc.text(shopName, widthMm / 2, y, { align: 'center' });
  y += isThermal ? 4 : 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(isThermal ? 7 : 9);
  doc.text(settings.address, widthMm / 2, y, { align: 'center' });
  y += isThermal ? 3.5 : 5;
  doc.text(`Phone: ${settings.phone} ${settings.gstNumber ? '| GST: ' + settings.gstNumber : ''}`, widthMm / 2, y, { align: 'center' });
  y += isThermal ? 4 : 6;

  // Title Divider
  doc.setLineWidth(0.3);
  doc.line(margin, y, widthMm - margin, y);
  y += 3;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isThermal ? 8 : 10);
  doc.text(billTitle, widthMm / 2, y, { align: 'center' });
  y += isThermal ? 4 : 6;

  // Meta info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(isThermal ? 7 : 9);
  doc.text(`Bill No: ${sale.billNo}`, margin, y);
  doc.text(`Date: ${formatDate(sale.saleDate)}`, widthMm - margin, y, { align: 'right' });
  y += isThermal ? 3.5 : 5;

  doc.text(`Customer: ${customer.name}${customer.shopName ? ' (' + customer.shopName + ')' : ''}`, margin, y);
  doc.text(`Phone: ${customer.phone}`, widthMm - margin, y, { align: 'right' });
  y += isThermal ? 4 : 6;

  // Table of Items
  const tableHeaders = language === 'ta'
    ? [['வகை (Category)', 'பெட்டி (Qty)', 'விலை (Rate)', 'தொகை (Total)']]
    : [['Item / Category', 'Crates', 'Rate (₹)', 'Total (₹)']];

  const tableRows = sale.lines.map(line => [
    line.categoryId === 'big' ? (language === 'ta' ? 'Big (பெரிய)' : 'Big Crate') : (language === 'ta' ? 'Small (சிறிய)' : 'Small Crate'),
    line.crates.toString(),
    line.pricePerCrate.toFixed(2),
    line.lineTotal.toFixed(2)
  ]);

  autoTable(doc, {
    startY: y,
    head: tableHeaders,
    body: tableRows,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: {
      fontSize: isThermal ? 6.5 : 8.5,
      cellPadding: isThermal ? 1.5 : 3,
      halign: 'right'
    },
    headStyles: {
      fillColor: [215, 38, 61], // Tomato red #D7263D
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'left' }
    }
  });

  // Calculate table end y
  const lastTableY = (doc as any).lastAutoTable?.finalY || y + 20;
  y = lastTableY + 3;

  // Summary Lines
  const addSummaryRow = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(isThermal ? 7 : 9);
    doc.text(label, widthMm - margin - (isThermal ? 32 : 50), y);
    doc.text(value, widthMm - margin, y, { align: 'right' });
    y += isThermal ? 3.5 : 5;
  };

  addSummaryRow('Subtotal:', formatINR(sale.subtotalAmount));
  if (sale.transportCharge > 0) addSummaryRow('Transport:', formatINR(sale.transportCharge));
  if (sale.discount > 0) addSummaryRow('Discount:', `-${formatINR(sale.discount)}`);
  if (sale.roundOff !== 0) addSummaryRow('Round off:', formatINR(sale.roundOff));

  doc.setLineWidth(0.2);
  doc.line(widthMm - margin - (isThermal ? 35 : 55), y, widthMm - margin, y);
  y += 2;

  addSummaryRow('Bill Total:', formatINR(sale.billTotal), true);
  addSummaryRow('Previous Balance:', formatINR(previousBalance));
  addSummaryRow('Amount Paid Now:', formatINR(sale.amountReceivedNow));

  doc.setLineWidth(0.3);
  doc.line(widthMm - margin - (isThermal ? 35 : 55), y, widthMm - margin, y);
  y += 2;
  addSummaryRow('Net Balance Due:', formatINR(newBalance), true);

  y += 2;
  doc.line(margin, y, widthMm - margin, y);
  y += 3.5;

  // Crates Pending summary
  const bigPending = cratesHeld['big'] || 0;
  const smallPending = cratesHeld['small'] || 0;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isThermal ? 6.5 : 8);
  doc.text(`Crates Pending With You: Big: ${bigPending} | Small: ${smallPending}`, widthMm / 2, y, { align: 'center' });
  y += isThermal ? 3.5 : 5;

  // Embed UPI QR Code if amount due > 0 and upiId configured
  if (settings.upiId && newBalance > 0) {
    const qrDataUrl = await generateUpiQrDataUrl(settings.upiId, settings.shopName, newBalance, sale.billNo);
    if (qrDataUrl) {
      const qrSize = isThermal ? 22 : 30;
      doc.addImage(qrDataUrl, 'PNG', (widthMm - qrSize) / 2, y, qrSize, qrSize);
      y += qrSize + 2;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(isThermal ? 6 : 7.5);
      doc.text(`Scan UPI QR to pay ₹${newBalance.toFixed(2)}`, widthMm / 2, y, { align: 'center' });
      y += isThermal ? 3 : 4;
    }
  }

  // Footer note
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(isThermal ? 6 : 7.5);
  doc.text(footerNote, widthMm / 2, y, { align: 'center' });

  // Save PDF
  doc.save(`${sale.billNo}.pdf`);
}

/**
 * Generate Supplier Statement PDF
 */
export async function generateSupplierStatementPdf(
  supplier: Supplier,
  settings: AppSettings,
  purchases: any[],
  payments: any[],
  totalDue: number,
  paidOut: number,
  balance: number,
  language: 'en' | 'ta'
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(settings.shopName, 105, y, { align: 'center' });
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Supplier Statement: ${supplier.name} (${supplier.phone})`, 105, y, { align: 'center' });
  y += 8;

  // Balance Card
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y, 182, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Billed: ${formatINR(totalDue)}  |  Total Paid: ${formatINR(paidOut)}  |  Balance Payable: ${formatINR(balance)}`, 105, y + 9, { align: 'center' });
  y += 20;

  // Ledger Table
  const rows = [
    ...purchases.map(p => [formatDate(p.purchaseDate), `Purchase Bill #${p.billNo}`, formatINR(p.netAmount), '-', '-']),
    ...payments.map(pm => [formatDate(pm.paymentDate), `Payment (${pm.mode.toUpperCase()}) ${pm.referenceNo || ''}`, '-', formatINR(pm.amount), '-'])
  ];

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Particulars', 'Purchase (Cr)', 'Payment (Dr)', 'Balance']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [215, 38, 61] }
  });

  doc.save(`Statement_${supplier.name.replace(/\s+/g, '_')}.pdf`);
}
