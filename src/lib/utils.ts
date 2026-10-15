// ============================================================================
// FORMATTERS AND HELPER UTILITIES
// Indian Currency (₹1,23,456.00), DD-MM-YYYY Date Format, Asia/Kolkata
// ============================================================================

/**
 * Format number into Indian currency format: ₹1,23,456.00 or ₹1,23,456
 */
export function formatINR(amount: number, includeDecimals = true): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '₹0.00';
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  // Format with 2 decimals
  const fixed = absAmount.toFixed(includeDecimals ? 2 : 0);
  const [integerPart, decimalPart] = fixed.split('.');

  // Indian numbering system: last 3 digits, then groups of 2 digits
  let lastThree = integerPart.substring(integerPart.length - 3);
  const otherNumbers = integerPart.substring(0, integerPart.length - 3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInteger = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;

  const result = `₹${formattedInteger}${includeDecimals && decimalPart ? '.' + decimalPart : ''}`;
  return isNegative ? `-${result}` : result;
}

/**
 * Format Indian number without currency symbol
 */
export function formatIndianNumber(num: number, decimals = 0): string {
  if (num === undefined || num === null || isNaN(num)) return '0';
  const isNegative = num < 0;
  const fixed = Math.abs(num).toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  let lastThree = intPart.substring(intPart.length - 3);
  const others = intPart.substring(0, intPart.length - 3);
  if (others !== '') lastThree = ',' + lastThree;
  const formatted = others.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
  const res = `${formatted}${decimals > 0 && decPart ? '.' + decPart : ''}`;
  return isNegative ? `-${res}` : res;
}

/**
 * Format date to DD-MM-YYYY
 */
export function formatDate(dateInput?: string | Date): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) {
    // If it's already YYYY-MM-DD
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      const [year, month, day] = dateInput.split('-');
      return `${day}-${month}-${year}`;
    }
    return String(dateInput);
  }
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Get current date string in YYYY-MM-DD for form inputs (Asia/Kolkata timezone)
 */
export function getTodayDateString(): string {
  const now = new Date();
  // Format according to Asia/Kolkata
  const options: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-CA', options); // en-CA gives YYYY-MM-DD
  return formatter.format(now);
}

/**
 * Generate sequential bill numbers e.g. TSK-20261015-001
 */
export function generateBillNo(prefix: string, count: number): string {
  const today = getTodayDateString().replace(/-/g, '');
  const seq = String(count + 1).padStart(3, '0');
  return `${prefix}${today}-${seq}`;
}

/**
 * Generate sequential lot number e.g. L-0012
 */
export function generateLotNo(existingLotsCount: number): string {
  return `L-${String(existingLotsCount + 1).padStart(4, '0')}`;
}

/**
 * Calculate difference in days between two dates
 */
export function getDaysDifference(dateStr: string): number {
  if (!dateStr) return 0;
  const target = new Date(dateStr);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - target.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Deep clone an object
 */
export function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
