// ============================================================================
// WHATSAPP INTEGRATION SERVICE (WA.ME DEEP LINKS - NO PAID API REQUIRED)
// English & Tamil templates for bills, passbooks, payment & crate reminders
// ============================================================================

import { formatDate, formatINR, formatDateWithDay } from './utils';
import { Sale, Customer, AppSettings } from '../types';

/**
 * Clean phone number to Indian 10 or 12 digits (e.g. 919876543210)
 */
export function formatWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

/**
 * Open WhatsApp wa.me link in new tab
 */
export function openWhatsAppLink(phone: string, message: string) {
  const cleanPhone = formatWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(message);
  const url = `https://wa.me/${cleanPhone}?text=${encodedText}`;
  window.open(url, '_blank');
}

/**
 * WhatsApp Share for Sale Bill
 */
export function shareSaleBillWhatsApp(
  sale: Sale,
  customer: Customer,
  settings: AppSettings,
  language: 'en' | 'ta',
  previousBalance: number,
  cratesHeld: Record<string, number>
) {
  const shopName = language === 'ta' && settings.shopNameTa ? settings.shopNameTa : settings.shopName;
  const newBalance = previousBalance + sale.billTotal - sale.amountReceivedNow;
  const bigPending = cratesHeld['big'] || 0;
  const smallPending = cratesHeld['small'] || 0;

  let message = '';
  if (language === 'ta') {
    message = `*${shopName}*\n` +
      `வணக்கம் ${customer.name},\n` +
      `விற்பனை பில்: *${sale.billNo}* (${formatDateWithDay(sale.saleDate, 'ta', true)})\n\n` +
      `பில் தொகை: *${formatINR(sale.billTotal)}*\n` +
      `இப்போது பெற்ற தொகை: *${formatINR(sale.amountReceivedNow)}*\n` +
      `தற்போதைய மொத்த பாக்கி: *${formatINR(newBalance)}*\n` +
      `நிலுவையில் உள்ள பெட்டிகள்: *பெரியது: ${bigPending}, சிறியது: ${smallPending}*\n\n` +
      `UPI மூலம் செலுத்த: ${settings.upiId}\n\n` +
      `${settings.billFooterTa || 'உங்கள் வணிகத்திற்கு நன்றி!'}`;
  } else {
    message = `*${shopName}*\n` +
      `Dear ${customer.name},\n` +
      `Sale Bill: *${sale.billNo}* (${formatDateWithDay(sale.saleDate, 'en', true)})\n\n` +
      `Bill Amount: *${formatINR(sale.billTotal)}*\n` +
      `Amount Paid Now: *${formatINR(sale.amountReceivedNow)}*\n` +
      `Total Balance Due: *${formatINR(newBalance)}*\n` +
      `Crates Pending With You: *Big: ${bigPending}, Small: ${smallPending}*\n\n` +
      `Pay via UPI: ${settings.upiId}\n\n` +
      `${settings.billFooter || 'Thank you for your business!'}`;
  }

  openWhatsAppLink(customer.phone, message);
}

/**
 * WhatsApp Share for Customer Passbook & Balance Reminder (Section 9)
 */
export function sharePassbookReminderWhatsApp(
  customer: Customer,
  balance: number,
  cratesHeld: Record<string, number>,
  settings: AppSettings,
  language: 'en' | 'ta'
) {
  const shopName = language === 'ta' && settings.shopNameTa ? settings.shopNameTa : settings.shopName;
  const today = formatDateWithDay(new Date(), language, true);
  const big = cratesHeld['big'] || 0;
  const small = cratesHeld['small'] || 0;

  let message = '';
  if (language === 'ta') {
    message = `வணக்கம் ${customer.name}, ${today} அன்றைய நிலவரப்படி ${shopName}-ல் உங்கள் நிலுவை பாக்கி *${formatINR(balance)}*. நிலுவையில் உள்ள பெட்டிகள்: *பெரியது ${big}, சிறியது ${small}*. நன்றி.`;
  } else {
    message = `Dear ${customer.name}, your balance with ${shopName} as on ${today} is *${formatINR(balance)}*. Crates pending: *Big ${big}, Small ${small}*. Thank you.`;
  }

  openWhatsAppLink(customer.phone, message);
}

/**
 * WhatsApp Share for Crate Defaulters (Section 10.5)
 */
export function shareCrateReminderWhatsApp(
  customer: Customer,
  cratesHeld: Record<string, number>,
  settings: AppSettings,
  language: 'en' | 'ta'
) {
  const shopName = language === 'ta' && settings.shopNameTa ? settings.shopNameTa : settings.shopName;
  const big = cratesHeld['big'] || 0;
  const small = cratesHeld['small'] || 0;

  let message = '';
  if (language === 'ta') {
    message = `வணக்கம் ${customer.name}, தங்களிடம் ${shopName}-ன் *${big} பெரிய பெட்டிகள்* மற்றும் *${small} சிறிய பெட்டிகள்* நிலுவையில் உள்ளன. தயவுசெய்து உடனடியாக திருப்பித் தரவும்.`;
  } else {
    message = `Dear ${customer.name}, you have *${big} Big* and *${small} Small* crates pending with ${shopName}. Kindly return.`;
  }

  openWhatsAppLink(customer.phone, message);
}

/**
 * WhatsApp Daily End-Of-Day Summary for Owner (Section 15)
 */
export function shareDailyOwnerSummaryWhatsApp(
  settings: AppSettings,
  dateStr: string,
  summary: {
    totalSales: number;
    totalCollections: number;
    totalPurchases: number;
    totalPaidSuppliers: number;
    totalExpenses: number;
    totalReceivables: number;
    moneyInHandForSuppliers: number;
    bookedProfit: number;
    realisedProfit: number;
    cratesWithCustomers: { big: number; small: number };
  }
) {
  const formattedDate = formatDateWithDay(dateStr, 'en', false);
  const msg = `📊 *${settings.shopName}* - End of Day Summary (${formattedDate})\n\n` +
    `🛒 *Sales Today:* ${formatINR(summary.totalSales)}\n` +
    `💰 *Collections Today:* ${formatINR(summary.totalCollections)}\n` +
    `🚚 *Purchases Today:* ${formatINR(summary.totalPurchases)}\n` +
    `🤝 *Paid to Suppliers:* ${formatINR(summary.totalPaidSuppliers)}\n` +
    `💸 *Expenses Today:* ${formatINR(summary.totalExpenses)}\n\n` +
    `📈 *Booked Profit:* ${formatINR(summary.bookedProfit)}\n` +
    `💵 *Realised Profit:* ${formatINR(summary.realisedProfit)}\n\n` +
    `📌 *Total Receivables:* ${formatINR(summary.totalReceivables)}\n` +
    `💼 *Money in Hand for Suppliers:* ${formatINR(summary.moneyInHandForSuppliers)}\n` +
    `📦 *Crates with Customers:* Big ${summary.cratesWithCustomers.big}, Small ${summary.cratesWithCustomers.small}\n\n` +
    `Generated by TSK Mandi System.`;

  openWhatsAppLink(settings.phone, msg);
}

/**
 * WhatsApp Share for Customer Payment Receipt (Receipt Confirmation)
 */
export function shareCustomerPaymentReceiptWhatsApp(
  customer: Customer,
  amount: number,
  mode: string,
  referenceNo: string | undefined,
  cratesReturned: { big: number; small: number },
  previousBalance: number,
  newBalance: number,
  cratesHeld: Record<string, number>,
  settings: AppSettings,
  language: 'en' | 'ta'
) {
  const shopName = language === 'ta' && settings.shopNameTa ? settings.shopNameTa : settings.shopName;
  const today = formatDateWithDay(new Date(), language, true);
  const bigRemaining = cratesHeld['big'] || 0;
  const smallRemaining = cratesHeld['small'] || 0;

  let message = '';
  if (language === 'ta') {
    message = `*${shopName}*\n` +
      `கடை எண் 30, காமராஜர் மார்க்கெட், தேவாரம்\n` +
      `------------------------------------\n` +
      `*பணம் செலுத்திய ரசீது (Payment Receipt)*\n` +
      `தேதி: *${today}*\n` +
      `வாடிக்கையாளர்: *${customer.name}* ${customer.shopName ? `(${customer.shopName})` : ''}\n\n` +
      `பெற்ற தொகை: *${formatINR(amount)}* (${mode === 'cash' ? 'ரொக்கம்' : mode.toUpperCase()})\n` +
      (referenceNo ? `குறிப்பு எண்: ${referenceNo}\n` : '') +
      ((cratesReturned.big > 0 || cratesReturned.small > 0) ? `திருப்பி அளித்த காலி பெட்டிகள்: *பெரியது ${cratesReturned.big}, சிறியது ${cratesReturned.small}*\n` : '') +
      `------------------------------------\n` +
      `முந்தைய பாக்கி: ${formatINR(previousBalance)}\n` +
      `*தற்போதைய நிகர பாக்கி: ${formatINR(newBalance)}*\n` +
      `தங்களிடம் உள்ள காலி பெட்டிகள்: *பெரியது ${bigRemaining}, சிறியது ${smallRemaining}*\n` +
      `------------------------------------\n` +
      `நன்றி! வணக்கம்!`;
  } else {
    message = `*${shopName}*\n` +
      `Shop no 30, Kamarajar Market, Thevaram\n` +
      `------------------------------------\n` +
      `*PAYMENT RECEIPT*\n` +
      `Date: *${today}*\n` +
      `Customer: *${customer.name}* ${customer.shopName ? `(${customer.shopName})` : ''}\n\n` +
      `Amount Received: *${formatINR(amount)}* (${mode.toUpperCase()})\n` +
      (referenceNo ? `Ref No: ${referenceNo}\n` : '') +
      ((cratesReturned.big > 0 || cratesReturned.small > 0) ? `Crates Returned: *Big ${cratesReturned.big}, Small ${cratesReturned.small}*\n` : '') +
      `------------------------------------\n` +
      `Previous Due: ${formatINR(previousBalance)}\n` +
      `*New Remaining Due: ${formatINR(newBalance)}*\n` +
      `Pending Crates with you: *Big ${bigRemaining}, Small ${smallRemaining}*\n` +
      `------------------------------------\n` +
      `Thank you for your prompt payment!`;
  }

  openWhatsAppLink(customer.phone, message);
}

