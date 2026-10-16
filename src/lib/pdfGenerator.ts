// ============================================================================
// PDF GENERATION SERVICE (JSPDF + AUTOTABLE + THERMAL & A4/A5 FORMATS)
// Unified Official Mandi Letterhead:
// - Top Left: Cell 9715813463 / 8190801030
// - Top Center: Shree Valaguranathan Thunai / Shree Angalaeeswari Thunai
// - Center Branding: T.S.K | Thakkali Kaaikari Commission Mandi | Shop no 30...
// - Flanking Images: Lord Murugar sketch (Left) & Ripe Tomato Graphic (Right)
// ============================================================================

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { Sale, Customer, AppSettings, Supplier } from '../types';
import { formatDate, formatINR, formatDateWithDay } from './utils';
import { MURUGAR_IMAGE_DATA, TOMATO_IMAGE_DATA } from '../assets/images';

export interface BillPdfOptions {
  sale: Sale;
  customer: Customer;
  settings: AppSettings;
  language: 'en' | 'ta';
  format: 'thermal_80' | 'thermal_58' | 'a4' | 'a5';
  previousBalance: number;
  cratesHeld: Record<string, number>;
}

export interface MandiPdfHeaderOptions {
  settings: AppSettings;
  language?: 'en' | 'ta';
  format?: 'thermal_80' | 'thermal_58' | 'a4' | 'a5';
  title?: string;
  startY?: number;
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
 * Universal Mandi Letterhead Header Renderer for jsPDF Documents
 * Draws: Invocations, Phones, Murugar sketch, T.S.K, Mandi title, Address, Tomato, Divider
 * Returns: Updated Y coordinate to continue drawing body content
 */
export function drawMandiDocumentHeader(doc: jsPDF, options: MandiPdfHeaderOptions): number {
  const { settings, language = 'en', format = 'a4', title } = options;
  const isThermal58 = format === 'thermal_58';
  const isThermal80 = format === 'thermal_80';
  const isThermal = isThermal58 || isThermal80;
  const isA5 = format === 'a5';
  const widthMm = isThermal58 ? 58 : isThermal80 ? 80 : isA5 ? 148 : 210;
  const margin = isThermal58 ? 3 : isThermal80 ? 4 : isA5 ? 10 : 14;

  const shopName = settings.shopName || 'T.S.K';
  const subtitle = language === 'ta'
    ? (settings.shopSubtitleTa || 'தக்காளி காய்கறி கமிஷன் மண்டி')
    : (settings.shopSubtitle || 'Thakkali Kaaikari Commission Mandi');
  
  const address = language === 'ta'
    ? (settings.address === 'Shop no 30, Kamarajar Market, Thevaram-625530'
        ? 'கடை எண் 30, காமராஜர் மார்க்கெட், தேவாரம்-625530'
        : (settings.address || 'Shop no 30, Kamarajar Market, Thevaram-625530'))
    : (settings.address || 'Shop no 30, Kamarajar Market, Thevaram-625530');

  const phone1 = settings.phone || '9715813463';
  const phone2 = settings.altPhone || '8190801030';
  const god1 = 'Shree Valaguranathan Thunai';
  const god2 = 'Shree Angalaeeswari Thunai';

  let y = options.startY || (isThermal ? 4.5 : 8);

  // 1. THERMAL 58MM COMPACT LAYOUT
  if (isThermal58) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(153, 27, 27);
    doc.text(`|| ${god1} ||`, widthMm / 2, y, { align: 'center' });
    y += 2.5;
    doc.text(`|| ${god2} ||`, widthMm / 2, y, { align: 'center' });
    y += 2.8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Cell: ${phone1} / ${phone2}`, widthMm / 2, y, { align: 'center' });
    y += 2.5;

    // Murugar on left (6x9mm), Tomato on right (6x6mm)
    const imgY = y;
    try {
      doc.addImage(MURUGAR_IMAGE_DATA, 'JPEG', margin, imgY, 6, 9);
      doc.addImage(TOMATO_IMAGE_DATA, 'PNG', widthMm - margin - 6, imgY + 1.5, 6, 6);
    } catch (e) {
      console.warn('Failed to add images to 58mm PDF:', e);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(shopName, widthMm / 2, y + 3.5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.8);
    doc.setTextColor(215, 38, 61);
    doc.text(subtitle, widthMm / 2, y + 6.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.2);
    doc.setTextColor(71, 85, 105);
    doc.text(address, widthMm / 2, y + 9, { align: 'center' });

    y += 10.5;
    doc.setLineWidth(0.3);
    doc.setDrawColor(15, 23, 42);
    doc.line(margin, y, widthMm - margin, y);
    y += 2;

    if (title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(15, 23, 42);
      doc.text(title, widthMm / 2, y, { align: 'center' });
      y += 2.8;
    }

    return y;
  }

  // 2. THERMAL 80MM STANDARD POS LAYOUT
  if (isThermal80) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(153, 27, 27);
    doc.text(`|| ${god1} ||`, widthMm / 2, y, { align: 'center' });
    y += 3;
    doc.text(`|| ${god2} ||`, widthMm / 2, y, { align: 'center' });
    y += 3.2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Cell: ${phone1} / ${phone2}`, widthMm / 2, y, { align: 'center' });
    y += 2.5;

    // Murugar on left (8x12mm), Tomato on right (8x8mm)
    const imgY = y;
    try {
      doc.addImage(MURUGAR_IMAGE_DATA, 'JPEG', margin, imgY, 8, 12);
      doc.addImage(TOMATO_IMAGE_DATA, 'PNG', widthMm - margin - 8, imgY + 2, 8, 8);
    } catch (e) {
      console.warn('Failed to add images to 80mm PDF:', e);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(shopName, widthMm / 2, y + 4.5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(215, 38, 61);
    doc.text(subtitle, widthMm / 2, y + 8, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.setTextColor(71, 85, 105);
    doc.text(address, widthMm / 2, y + 11, { align: 'center' });

    y += 13.5;
    doc.setLineWidth(0.3);
    doc.setDrawColor(15, 23, 42);
    doc.line(margin, y, widthMm - margin, y);
    y += 2.5;

    if (title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(title, widthMm / 2, y, { align: 'center' });
      y += 3.5;
    }

    return y;
  }

  // 3. STANDARD A4 / A5 LETTERHEAD LAYOUT
  // Top Phones on Left
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isA5 ? 7.5 : 8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Cell: ${phone1}`, margin, y);
  doc.text(`        ${phone2}`, margin, y + (isA5 ? 3.5 : 4.2));

  // Top Devotional Invocations Center
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isA5 ? 8 : 9.5);
  doc.setTextColor(153, 27, 27);
  doc.text(`|| ${god1} ||`, widthMm / 2, y, { align: 'center' });
  doc.text(`|| ${god2} ||`, widthMm / 2, y + (isA5 ? 3.8 : 4.5), { align: 'center' });

  if (settings.gstNumber) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isA5 ? 6.5 : 7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`GST: ${settings.gstNumber}`, widthMm - margin, y, { align: 'right' });
  }

  y += isA5 ? 7.5 : 9;

  // Murugar Sketch on Left & Tomato on Right
  const murW = isA5 ? 13 : 17;
  const murH = murW * 1.5; // 19.5mm / 25.5mm
  const tomW = isA5 ? 13 : 17;
  const tomH = tomW;

  try {
    doc.addImage(MURUGAR_IMAGE_DATA, 'JPEG', margin + 2, y, murW, murH);
    doc.addImage(TOMATO_IMAGE_DATA, 'PNG', widthMm - margin - tomW - 2, y + (murH - tomH) / 2, tomW, tomH);
  } catch (e) {
    console.warn('Failed to add images to A4/A5 PDF:', e);
  }

  // Center Branding: T.S.K + Subtitle + Address
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isA5 ? 20 : 26);
  doc.setTextColor(15, 23, 42);
  doc.text(shopName, widthMm / 2, y + (isA5 ? 6 : 8), { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isA5 ? 9.5 : 11.5);
  doc.setTextColor(215, 38, 61);
  doc.text(subtitle, widthMm / 2, y + (isA5 ? 12 : 15), { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isA5 ? 7.5 : 9);
  doc.setTextColor(71, 85, 105);
  doc.text(address, widthMm / 2, y + (isA5 ? 17 : 21), { align: 'center' });

  y += murH + 3;

  // Divider Line
  doc.setLineWidth(0.4);
  doc.setDrawColor(15, 23, 42);
  doc.line(margin, y, widthMm - margin, y);
  y += 3;

  if (title) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isA5 ? 8.5 : 10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(title, widthMm / 2, y + 1, { align: 'center' });
    y += 5.5;
  }

  return y;
}

/**
 * Generate and download Sale Bill PDF (Thermal 80mm/58mm or A4/A5)
 */
export async function generateSaleBillPdf(options: BillPdfOptions): Promise<void> {
  const { sale, customer, settings, language, format, previousBalance, cratesHeld } = options;
  const isThermal = format === 'thermal_80' || format === 'thermal_58';
  const widthMm = format === 'thermal_58' ? 58 : format === 'thermal_80' ? 80 : format === 'a5' ? 148 : 210;
  const heightMm = isThermal ? 190 : format === 'a5' ? 210 : 297;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [widthMm, heightMm]
  });

  const billTitle = language === 'ta' ? 'விற்பனை ரசீது (CASH/CREDIT BILL)' : 'SALE INVOICE (CASH / CREDIT BILL)';
  const footerNote = language === 'ta' && settings.billFooterTa ? settings.billFooterTa : settings.billFooter;
  const newBalance = previousBalance + sale.billTotal - sale.amountReceivedNow;
  const margin = isThermal ? (format === 'thermal_58' ? 3 : 4) : (format === 'a5' ? 10 : 14);

  // Render Official Mandi Letterhead Header
  let y = drawMandiDocumentHeader(doc, {
    settings,
    language,
    format,
    title: billTitle,
    startY: isThermal ? 4.5 : 8
  });

  // Meta info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(isThermal ? 7 : 9);
  doc.setTextColor(15, 23, 42);
  doc.text(`Bill No: ${sale.billNo}`, margin, y);
  doc.text(`Date: ${formatDateWithDay(sale.saleDate, language, true)}`, widthMm - margin, y, { align: 'right' });
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
    theme: isThermal ? 'plain' : 'striped',
    styles: {
      fontSize: isThermal ? 7 : 8.5,
      cellPadding: isThermal ? 1.5 : 2.5
    },
    headStyles: {
      fillColor: [215, 38, 61],
      textColor: 255,
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: isThermal ? 'auto' : 70 },
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' }
    }
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // Financial Summary Block
  const addSummaryRow = (label: string, val: string, isBold: boolean = false) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(isThermal ? 7 : 9);
    doc.text(label, widthMm - margin - (isThermal ? 35 : 55), y);
    doc.text(val, widthMm - margin, y, { align: 'right' });
    y += isThermal ? 3.5 : 4.5;
  };

  if (sale.transportCharge && sale.transportCharge > 0) {
    addSummaryRow('Transport Charge:', formatINR(sale.transportCharge));
  }
  if (sale.discount && sale.discount > 0) {
    addSummaryRow('Discount:', `-${formatINR(sale.discount)}`);
  }
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
  doc.setTextColor(100, 116, 139);
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
  
  // Render Mandi Header
  let y = drawMandiDocumentHeader(doc, {
    settings,
    language,
    format: 'a4',
    title: `SUPPLIER STATEMENT: ${supplier.name.toUpperCase()} (${supplier.phone})`,
    startY: 8
  });

  y += 2;

  // Balance Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, 182, 14, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Total Billed: ${formatINR(totalDue)}   |   Total Paid: ${formatINR(paidOut)}   |   Balance Payable: ${formatINR(balance)}`,
    105,
    y + 9,
    { align: 'center' }
  );
  y += 20;

  // Ledger Table
  const rows = [
    ...purchases.map(p => [formatDateWithDay(p.purchaseDate, language, true), `Purchase Bill #${p.billNo}`, formatINR(p.netAmount), '-', '-']),
    ...payments.map(pm => [formatDateWithDay(pm.paymentDate, language, true), `Payment (${pm.mode.toUpperCase()}) ${pm.referenceNo || ''}`, '-', formatINR(pm.amount), '-'])
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
 * Generate Customer Passbook & Statement PDF
 */
export async function generateCustomerPassbookPdf(
  customer: Customer,
  settings: AppSettings,
  rows: Array<{
    date: string;
    particulars: string;
    bigCrates: number | string;
    smallCrates: number | string;
    rate: number | string;
    debit: number;
    credit: number;
    balance: number;
  }>,
  totalBilled: number,
  totalPaid: number,
  currentBalance: number,
  cratesHeld: Record<string, number>,
  language: 'en' | 'ta' = 'en'
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const widthMm = 210;
  const margin = 14;

  const title = language === 'ta'
    ? `வாடிக்கையாளர் கணக்கு புத்தகம்: ${customer.name} (${customer.phone})`
    : `CUSTOMER PASSBOOK & STATEMENT: ${customer.name.toUpperCase()} (${customer.phone})`;

  // Render Mandi Header
  let y = drawMandiDocumentHeader(doc, {
    settings,
    language,
    format: 'a4',
    title,
    startY: 8
  });

  y += 2;

  // Summary Metrics Banner
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, widthMm - margin * 2, 14, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  
  const bigC = cratesHeld['big'] || 0;
  const smallC = cratesHeld['small'] || 0;
  doc.text(
    `Total Bought: ${formatINR(totalBilled)}   |   Total Paid: ${formatINR(totalPaid)}   |   Balance Due: ${formatINR(currentBalance)}   |   Crates Held: Big ${bigC}, Small ${smallC}`,
    widthMm / 2,
    y + 9,
    { align: 'center' }
  );
  y += 18;

  // Table
  const head = [[
    'Date',
    'Particulars',
    'Big',
    'Small',
    'Rate (₹)',
    'Bought / Dr (₹)',
    'Paid / Cr (₹)',
    'Balance (₹)'
  ]];

  const body = rows.map(r => [
    r.date,
    r.particulars,
    r.bigCrates.toString(),
    r.smallCrates.toString(),
    r.rate.toString(),
    r.debit > 0 ? formatINR(r.debit) : '-',
    r.credit > 0 ? formatINR(r.credit) : '-',
    formatINR(r.balance)
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.2 },
    headStyles: { fillColor: [215, 38, 61], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 14 },
      3: { halign: 'center', cellWidth: 14 },
      4: { halign: 'right', cellWidth: 16 },
      5: { halign: 'right', cellWidth: 24 },
      6: { halign: 'right', cellWidth: 24 },
      7: { halign: 'right', fontStyle: 'bold', cellWidth: 26 }
    }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || y + 50;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Statement printed on ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} • T.S.K Mandi System`,
    margin,
    finalY + 7
  );

  doc.save(`Passbook_${customer.name.replace(/\s+/g, '_')}.pdf`);
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

  const reportTitle = language === 'ta'
    ? 'வாடிக்கையாளர்களிடம் உள்ள பெட்டிகள் அறிக்கை'
    : 'PENDING CRATES TO BE COLLECTED FROM CUSTOMERS';

  // Render Official Mandi Letterhead Header
  let y = drawMandiDocumentHeader(doc, {
    settings,
    language,
    format: 'a4',
    title: reportTitle,
    startY: 8
  });

  y += 2;

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
    `Report generated on ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} • T.S.K Mandi System`,
    margin,
    finalY + 7
  );

  const dateStr = formatDate(new Date()).replace(/-/g, '_');
  doc.save(`Customer_Pending_Crates_To_Collect_${dateStr}.pdf`);
}
