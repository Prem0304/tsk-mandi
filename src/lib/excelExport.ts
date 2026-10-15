// ============================================================================
// EXCEL IMPORT / EXPORT SERVICE USING SHEETJS (XLSX)
// Templates, Validation Previews, Error Row Exports, Full System Backup
// ============================================================================

import * as XLSX from 'xlsx';
import { Customer, Supplier } from '../types';
import { MandiDatabaseState } from './db';
import { formatDate } from './utils';

export interface RowValidationResult<T> {
  rowIndex: number;
  data: Partial<T>;
  isValid: boolean;
  errors: string[];
  isDuplicate: boolean;
}

export interface ImportSummary<T> {
  validCount: number;
  errorCount: number;
  duplicateCount: number;
  rows: RowValidationResult<T>[];
}

/**
 * Export generic data array to Excel file
 */
export function exportToExcel(data: any[], fileName: string, sheetName = 'Sheet1') {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

/**
 * Generate downloadable Customer Import Template with English + Tamil headers
 */
export function downloadCustomerTemplate() {
  const template = [
    {
      'Customer Name / பெயர்': 'Selvam Stores',
      'Shop Name / கடை பெயர்': 'Selvam Supermarket',
      'Phone / போன்': '9944100001',
      'Alternate Phone / மாற்று போன்': '9842100001',
      'Place / ஊர்': 'Madurai',
      'Opening Balance (₹) / ஆரம்ப பாக்கி': 5000,
      'Opening Date (YYYY-MM-DD) / தேதி': '2026-10-01',
      'Opening Big Crates / பெரிய பெட்டி': 10,
      'Opening Small Crates / சிறிய பெட்டி': 5,
      'Credit Limit (₹) / கடன் வரம்பு': 50000,
      'Notes / குறிப்பு': 'Wholesale buyer'
    },
    {
      'Customer Name / பெயர்': 'Murugan Stall',
      'Shop Name / கடை பெயர்': 'Murugan Veggies',
      'Phone / போன்': '9944100002',
      'Alternate Phone / மாற்று போன்': '',
      'Place / ஊர்': 'Theni',
      'Opening Balance (₹) / ஆரம்ப பாக்கி': 0,
      'Opening Date (YYYY-MM-DD) / தேதி': '2026-10-01',
      'Opening Big Crates / பெரிய பெட்டி': 0,
      'Opening Small Crates / சிறிய பெட்டி': 0,
      'Credit Limit (₹) / கடன் வரம்பு': 25000,
      'Notes / குறிப்பு': 'Daily market stall'
    }
  ];

  exportToExcel(template, 'TSK_Customer_Import_Template', 'Customers');
}

/**
 * Generate downloadable Supplier Import Template
 */
export function downloadSupplierTemplate() {
  const template = [
    {
      'Supplier Name / பெயர்': 'Ramu Tomato Farm',
      'Phone / போன்': '9842100001',
      'Alternate Phone / மாற்று போன்': '',
      'Place / ஊர்': 'Dindigul',
      'GST / ஜிஎஸ்டி': '33AAAAA0000A1Z5',
      'Opening Balance Owed (₹) / ஆரம்ப பாக்கி': 12000,
      'Opening Date (YYYY-MM-DD) / தேதி': '2026-10-01',
      'Opening Big Crates Owed / பெரிய பெட்டி': 20,
      'Opening Small Crates Owed / சிறிய பெட்டி': 10,
      'Notes / குறிப்பு': 'Direct farmer supply'
    }
  ];

  exportToExcel(template, 'TSK_Supplier_Import_Template', 'Suppliers');
}

/**
 * Parse & Validate uploaded Customer Excel file
 */
export async function parseAndValidateCustomersExcel(
  file: File,
  existingCustomers: Customer[]
): Promise<ImportSummary<Customer>> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows: any[] = XLSX.utils.sheet_to_json(ws);

  const existingPhones = new Set(existingCustomers.map(c => c.phone.replace(/\D/g, '')));
  const encounteredInFilePhones = new Set<string>();

  const rows: RowValidationResult<Customer>[] = [];
  let validCount = 0;
  let errorCount = 0;
  let duplicateCount = 0;

  rawRows.forEach((row, idx) => {
    const errors: string[] = [];
    const name = (row['Customer Name / பெயர்'] || row['Customer Name'] || row['Name'] || '').toString().trim();
    const phoneRaw = (row['Phone / போன்'] || row['Phone'] || '').toString().trim();
    const cleanPhone = phoneRaw.replace(/\D/g, '');

    if (!name) {
      errors.push('Missing customer name');
    }
    if (!cleanPhone || cleanPhone.length < 10) {
      errors.push('Invalid phone number (must be at least 10 digits)');
    }

    const isDuplicate = existingPhones.has(cleanPhone) || encounteredInFilePhones.has(cleanPhone);
    if (isDuplicate) {
      duplicateCount++;
    }
    if (cleanPhone) encounteredInFilePhones.add(cleanPhone);

    const openingBalance = parseFloat(row['Opening Balance (₹) / ஆரம்ப பாக்கி'] || row['Opening Balance'] || '0') || 0;
    const openingBig = parseInt(row['Opening Big Crates / பெரிய பெட்டி'] || row['Opening Big Crates'] || '0', 10) || 0;
    const openingSmall = parseInt(row['Opening Small Crates / சிறிய பெட்டி'] || row['Opening Small Crates'] || '0', 10) || 0;
    const creditLimit = parseFloat(row['Credit Limit (₹) / கடன் வரம்பு'] || row['Credit Limit'] || '0') || null;

    const data: Partial<Customer> = {
      name,
      shopName: (row['Shop Name / கடை பெயர்'] || row['Shop Name'] || '').toString().trim(),
      phone: cleanPhone || phoneRaw,
      altPhone: (row['Alternate Phone / மாற்று போன்'] || row['Alternate Phone'] || '').toString().trim(),
      place: (row['Place / ஊர்'] || row['Place'] || '').toString().trim(),
      openingMoneyBalance: openingBalance,
      openingBalanceDate: (row['Opening Date (YYYY-MM-DD) / தேதி'] || row['Opening Date'] || new Date().toISOString().split('T')[0]).toString().trim(),
      openingCrates: { big: openingBig, small: openingSmall },
      creditLimit,
      notes: (row['Notes / குறிப்பு'] || row['Notes'] || '').toString().trim(),
      isActive: true
    };

    const isValid = errors.length === 0;
    if (isValid) validCount++;
    else errorCount++;

    rows.push({
      rowIndex: idx + 2,
      data,
      isValid,
      errors,
      isDuplicate
    });
  });

  return { validCount, errorCount, duplicateCount, rows };
}

/**
 * Export error rows to Excel so user can correct and re-upload
 */
export function exportErrorRows(rows: RowValidationResult<any>[], fileName: string) {
  const errorData = rows.filter(r => !r.isValid).map(r => ({
    'Row Number': r.rowIndex,
    'Errors': r.errors.join('; '),
    ...r.data
  }));
  exportToExcel(errorData, `${fileName}_Errors`, 'Errors');
}

/**
 * Full Multi-Sheet Backup Export
 */
export function exportFullBackupExcel(state: MandiDatabaseState) {
  const wb = XLSX.utils.book_new();

  const addSheet = (sheetName: string, data: any[]) => {
    const ws = XLSX.utils.json_to_sheet(data.length > 0 ? data : [{ message: 'No data' }]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  };

  addSheet('Settings', [state.settings]);
  addSheet('Categories', state.categories);
  addSheet('Suppliers', state.suppliers);
  addSheet('Customers', state.customers);
  addSheet('DailyRates', state.dailyRates);
  addSheet('Purchases', state.purchases);
  addSheet('PurchaseLots', state.purchaseLines);
  addSheet('Sales', state.sales);
  addSheet('PaymentsReceived', state.paymentsReceived);
  addSheet('PaymentsMade', state.paymentsMade);
  addSheet('PaymentAllocations', state.paymentAllocations);
  addSheet('CrateMovements', state.crateMovements);
  addSheet('Expenses', state.expenses);
  addSheet('CashClosings', state.cashClosings);

  const today = formatDate(new Date()).replace(/-/g, '_');
  XLSX.writeFile(wb, `TSK_Mandi_Full_Backup_${today}.xlsx`);
}
