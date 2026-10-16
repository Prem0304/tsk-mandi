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

/**
 * Generate Printable PDF Report of Customer Pending Crates to Collect
 */
export async function generateCustomerPendingCratesPdf(
  defaulters: Array<{
    customerId: string;
    customerName: string;
    shopName?: string;
    phone: string;
    place?: string;
    currentBalance?: number;
    cratesHeld: Record<string, number>;
    totalHeld: number;
    agingDays?: number;
  }>,
  settings: AppSettings,
  language: 'en' | 'ta' = 'en'
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const widthMm = 210;
  const margin = 12;

  let y = 12;
  const shopName = language === 'ta' && settings.shopNameTa ? settings.shopNameTa : settings.shopName;
  const reportTitle = language === 'ta'
    ? 'வாடிக்கையாளர்களிடம் உள்ள பெட்டிகள் அறிக்கை'
    : 'PENDING CRATES TO BE COLLECTED FROM CUSTOMERS';

  // Mandi Shop Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(215, 38, 61); // Tomato Red
  doc.text(shopName, widthMm / 2, y, { align: 'center' });
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(75, 85, 99);
  doc.text(settings.address || 'Wholesale Tomato & Vegetable Mandi', widthMm / 2, y, { align: 'center' });
  y += 4.5;
  doc.text(`Phone: ${settings.phone} ${settings.gstNumber ? '| GST: ' + settings.gstNumber : ''}`, widthMm / 2, y, { align: 'center' });
  y += 6;

  // Title banner
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, y, widthMm - margin * 2, 9, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(reportTitle, widthMm / 2, y + 6, { align: 'center' });
  y += 13;

  // Calculate Metrics
  const totalBig = defaulters.reduce((acc, c) => acc + (c.cratesHeld['big'] || 0), 0);
  const totalSmall = defaulters.reduce((acc, c) => acc + (c.cratesHeld['small'] || 0), 0);
  const grandTotal = defaulters.reduce((acc, c) => acc + c.totalHeld, 0);
  const totalMoneyDue = defaulters.reduce((acc, c) => acc + (c.currentBalance || 0), 0);

  // 4 Metric Summary Cards
  const gap = 3;
  const cardWidth = (widthMm - margin * 2 - gap * 3) / 4;
  const cardHeight = 15;

  const renderCard = (x: number, titleText: string, valueText: string, color: [number, number, number]) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(titleText, x + cardWidth / 2, y + 4.5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...color);
    doc.text(valueText, x + cardWidth / 2, y + 11.5, { align: 'center' });
  };

  renderCard(margin, 'TOTAL CUSTOMERS', defaulters.length.toString(), [15, 23, 42]);
  renderCard(margin + (cardWidth + gap) * 1, 'BIG CRATES', totalBig.toString(), [215, 38, 61]);
  renderCard(margin + (cardWidth + gap) * 2, 'SMALL CRATES', totalSmall.toString(), [234, 88, 12]);
  renderCard(margin + (cardWidth + gap) * 3, 'TOTAL CRATES', grandTotal.toString(), [16, 185, 129]);

  y += cardHeight + 6;

  // AutoTable
  const head = [[
    '#',
    'Customer Name',
    'Shop / Place',
    'Phone',
    'Big Crates',
    'Small Crates',
    'Total Crates',
    'Money Due (₹)'
  ]];

  const body = defaulters.map((c, index) => [
    (index + 1).toString(),
    c.customerName,
    [c.shopName, c.place].filter(Boolean).join(' • ') || '-',
    c.phone,
    (c.cratesHeld['big'] || 0).toString(),
    (c.cratesHeld['small'] || 0).toString(),
    c.totalHeld.toString(),
    c.currentBalance !== undefined ? formatINR(c.currentBalance) : '-'
  ]);

  // Total summary row at bottom of table
  body.push([
    '',
    'TOTAL SUMMARY',
    `${defaulters.length} Customers`,
    '',
    totalBig.toString(),
    totalSmall.toString(),
    grandTotal.toString(),
    formatINR(totalMoneyDue)
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      valign: 'middle'
    },
    headStyles: {
      fillColor: [215, 38, 61],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'left'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      3: { halign: 'center', cellWidth: 26 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 20 },
      5: { halign: 'center', fontStyle: 'bold', cellWidth: 20 },
      6: { halign: 'center', fontStyle: 'bold', textColor: [215, 38, 61], cellWidth: 22 },
      7: { halign: 'right', cellWidth: 26 }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 50;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Report generated on ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} • TSK Mandi System`,
    margin,
    finalY + 7
  );

  const dateStr = formatDate(new Date()).replace(/-/g, '_');
  doc.save(`Customer_Pending_Crates_To_Collect_${dateStr}.pdf`);
}
