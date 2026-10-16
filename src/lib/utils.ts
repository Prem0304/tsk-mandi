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
 * Day names in English and Tamil
 */
export const DAY_NAMES = {
  en: {
    long: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    short: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  },
  ta: {
    long: ['ஞாயிற்றுக்கிழமை', 'திங்கட்கிழமை', 'செவ்வாய்க்கிழமை', 'புதன்கிழமை', 'வியாழக்கிழமை', 'வெள்ளிக்கிழமை', 'சனிக்கிழமை'],
    short: ['ஞாயிறு', 'திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி']
  }
};

/**
 * Safely parse date string or Date object avoiding timezone day-shift
 */
export function parseDateSafe(dateInput?: string | Date): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;
  if (typeof dateInput === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      const [y, m, d] = dateInput.split('-').map(Number);
      return new Date(y, m - 1, d, 12, 0, 0);
    }
    const parsed = new Date(dateInput);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Get day name for a given date
 */
export function getDayName(dateInput?: string | Date, language: 'en' | 'ta' = 'en', short = false): string {
  const d = parseDateSafe(dateInput);
  if (!d) return '';
  const dayIndex = d.getDay();
  const langKey = language === 'ta' ? 'ta' : 'en';
  return short ? DAY_NAMES[langKey].short[dayIndex] : DAY_NAMES[langKey].long[dayIndex];
}

/**
 * Format date to DD-MM-YYYY
 */
export function formatDate(dateInput?: string | Date): string {
  if (!dateInput) return '';
  const d = parseDateSafe(dateInput);
  if (!d) {
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
 * Format date with day of the week
 * Examples:
 * - short = true: "16-10-2026 (Fri)" or Tamil "16-10-2026 (வெள்ளி)"
 * - short = false: "Friday, 16-10-2026" or Tamil "வெள்ளிக்கிழமை, 16-10-2026"
 */
export function formatDateWithDay(dateInput?: string | Date, language: 'en' | 'ta' = 'en', short = false): string {
  if (!dateInput) return '';
  const dateFormatted = formatDate(dateInput);
  const dayName = getDayName(dateInput, language, short);
  if (!dayName) return dateFormatted;

  if (short) {
    return `${dateFormatted} (${dayName})`;
  }
  return `${dayName}, ${dateFormatted}`;
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
