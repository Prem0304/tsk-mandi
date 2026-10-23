// ============================================================================
// TSK TOMATO AND VEGETABLE MANDI - TYPE DEFINITIONS
// ============================================================================

export type UserRole = 'owner' | 'staff' | 'entry_staff' | 'view_only';

export type PaymentAllocationRule = 'supplier_first' | 'proportional';
export type AllocationRuleMode = 'fifo' | 'manual';
export type PaymentMode = 'cash' | 'upi' | 'bank' | 'cheque';
export type CrateOwnership = 'shop' | 'supplier';
export type TransportPaidBy = 'supplier_bill' | 'self_expense' | 'none';

export interface CrateCategory {
  id: string; // 'big', 'small' or custom id
  name: string;
  name_ta: string;
  description?: string;
  isActive: boolean;
  displayOrder: number;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  altPhone?: string;
  place?: string;
  gstNumber?: string;
  notes?: string;
  openingMoneyBalance: number; // Positive = I owe them
  openingBalanceDate: string; // YYYY-MM-DD
  openingCrates: Record<string, number>; // { [categoryId]: number } crates I owe them
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Customer {
  id: string;
  name: string;
  shopName?: string;
  phone: string;
  altPhone?: string;
  place?: string;
  notes?: string;
  openingMoneyBalance: number; // Positive = They owe me
  openingBalanceDate: string;
  openingCrates: Record<string, number>; // { [categoryId]: number } crates they hold
  creditLimit?: number | null; // Max ₹ credit
  crateLimits?: Record<string, number | null>; // Max crates allowed
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface DailyRateItem {
  buying: number;
  selling: number;
}

export interface DailyRate {
  id: string;
  rateDate: string; // YYYY-MM-DD
  rates: Record<string, DailyRateItem>; // { [categoryId]: { buying, selling } }
  notes?: string;
  updatedAt: string;
}

export interface PurchaseLine {
  id: string;
  purchaseId: string;
  supplierId: string;
  lotNo: string; // e.g. L-0001
  categoryId: string;
  cratesPurchased: number;
  cratesRemaining: number;
  cratesWasted: number;
  pricePerCrate: number;
  transportShare: number; // spread transport per crate
  effectiveCostPerCrate: number; // pricePerCrate + transportShare
  lineTotal: number;
  isFullySold: boolean;
  isFullyCollected: boolean;
  isSettledWithSupplier: boolean;
  createdAt: string;
}

export interface Purchase {
  id: string;
  purchaseDate: string; // YYYY-MM-DD
  supplierId: string;
  billNo: string;
  vehicleNo?: string;
  transportCharge: number;
  transportPaidBy: TransportPaidBy;
  labourCharge: number;
  loadingCharge: number;
  totalCrates: number;
  subtotalAmount: number;
  netAmount: number; // subtotal + (transport if supplier_bill)
  amountPaidNow: number;
  paymentMode?: PaymentMode;
  paymentRef?: string;
  lines: PurchaseLine[];
  filledCratesReceived: Record<string, number>; // by category
  crateOwnership: CrateOwnership;
  emptyCratesReturned: Record<string, number>; // by category
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface SaleLine {
  id: string;
  saleId: string;
  categoryId: string;
  crates: number;
  pricePerCrate: number;
  lineTotal: number;
}

export interface SaleLotAllocation {
  id: string;
  saleId: string;
  saleLineId: string;
  lotId: string;
  supplierId: string;
  categoryId: string;
  crates: number;
  costPerCrate: number;
  salePricePerCrate: number;
  costAmount: number; // supplier cost portion
  saleAmount: number; // customer billed portion
  bookedProfit: number; // saleAmount - costAmount
  collectedAmount: number; // how much collected so far against this allocation
  supplierClearedAmount: number; // how much paid/cleared to supplier
}

export interface Sale {
  id: string;
  saleDate: string; // YYYY-MM-DD
  customerId: string;
  billNo: string;
  lines: SaleLine[];
  allocations: SaleLotAllocation[];
  transportCharge: number;
  discount: number;
  roundOff: number;
  subtotalAmount: number;
  billTotal: number; // subtotal + transport - discount + roundOff
  amountReceivedNow: number;
  paymentMode?: PaymentMode;
  paymentRef?: string;
  totalCrates: number;
  emptyCratesIssued: Record<string, number>;
  emptyCratesReturned: Record<string, number>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface PaymentAllocation {
  id: string;
  paymentId: string;
  customerId: string;
  saleId?: string;
  lotId?: string;
  supplierId?: string;
  isOpeningBalance?: boolean;
  allocatedAmount: number;
  supplierShare: number; // clears supplier cost
  transportShare: number; // transport recovery
  profitShare: number; // realised profit
  createdAt: string;
}

export interface PaymentReceived {
  id: string;
  paymentDate: string; // YYYY-MM-DD
  customerId: string;
  saleId?: string; // if paid against specific bill
  amount: number;
  mode: PaymentMode;
  referenceNo?: string;
  discount: number; // settlement discount
  notes?: string;
  allocations: PaymentAllocation[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface PaymentMade {
  id: string;
  paymentDate: string; // YYYY-MM-DD
  supplierId: string;
  purchaseId?: string;
  amount: number;
  mode: PaymentMode;
  referenceNo?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface StockAdjustment {
  id: string;
  adjustmentDate: string; // YYYY-MM-DD
  categoryId: string;
  lotId?: string;
  crates: number;
  costPerCrate: number;
  totalCost: number; // Recorded as shop loss; supplier still owed
  reason: 'spoiled' | 'damaged' | 'sample' | 'count_correction' | 'other';
  notes?: string;
  createdAt: string;
  deletedAt?: string | null;
}

export type CrateRefType = 
  | 'purchase' 
  | 'sale' 
  | 'customer_return' 
  | 'supplier_return' 
  | 'damaged' 
  | 'lost' 
  | 'physical_count' 
  | 'new_purchase' 
  | 'opening';

export interface CrateMovement {
  id: string;
  movementDate: string;
  categoryId: string;
  partyType: 'customer' | 'supplier' | 'shop' | 'internal';
  partyId?: string; // customerId, supplierId, or null
  qtyIn: number; // crates entering party's account or shop
  qtyOut: number; // crates leaving
  ownership: CrateOwnership;
  refType: CrateRefType;
  refId?: string;
  notes?: string;
  createdAt: string;
  deletedAt?: string | null;
}

export interface CrateInventoryEvent {
  id: string;
  eventDate: string;
  categoryId: string;
  eventType: 'new_purchase' | 'damaged' | 'lost' | 'physical_count';
  qty: number;
  unitCost?: number;
  totalCost?: number;
  partyType?: 'customer' | 'supplier' | 'shop';
  partyId?: string;
  systemCount?: number;
  physicalCount?: number;
  difference?: number;
  notes?: string;
  createdAt: string;
  deletedAt?: string | null;
}

export interface Expense {
  id: string;
  expenseDate: string;
  category: string;
  amount: number;
  mode: PaymentMode;
  refType?: string;
  refId?: string;
  notes?: string;
  createdAt: string;
  deletedAt?: string | null;
}

export interface CashClosing {
  id: string;
  closingDate: string; // YYYY-MM-DD
  openingCash: number;
  cashReceived: number;
  cashPaid: number;
  cashExpenses: number;
  expectedClosing: number;
  actualClosing: number;
  difference: number;
  upiReceived: number;
  upiPaid: number;
  notes?: string;
  isClosed: boolean;
  createdAt: string;
}

export interface DiscountWriteoff {
  id: string;
  entryDate: string;
  customerId: string;
  type: 'discount' | 'bad_debt';
  amount: number;
  reason: string;
  createdAt: string;
  deletedAt?: string | null;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId?: string;
  userName: string;
  action: 'create' | 'update' | 'delete' | 'soft_delete' | 'restore';
  entityType: string;
  entityId: string;
  oldValues?: any;
  newValues?: any;
  description: string;
}

export interface AppSettings {
  id: string;
  shopName: string;
  shopNameTa: string;
  shopSubtitle?: string;
  shopSubtitleTa?: string;
  godName1?: string;
  godName1Ta?: string;
  godName2?: string;
  godName2Ta?: string;
  logoUrl?: string;
  address: string;
  phone: string;
  altPhone?: string;
  upiId: string;
  gstNumber?: string;
  billFooter: string;
  billFooterTa: string;
  paymentAllocationRule: PaymentAllocationRule; // 'supplier_first' | 'proportional'
  billAllocationRule: AllocationRuleMode; // 'fifo' | 'manual'
  lotAllocationRule: AllocationRuleMode; // 'fifo' | 'manual'
  autoMarkSupplierPaid: boolean; // default false
  defaultLanguage: 'en' | 'ta';
  crateAgingDays: number; // default 15
  lowStockThreshold: number; // default 20
  autoLockMinutes: number; // default 10
  billPrefix: string; // e.g. TSK-
  billPrintSize: 'a4' | 'a5' | 'thermal_58' | 'thermal_80';
  appPin: string; // Password 1: App Access Password e.g. '1234'
  ownerPin?: string; // Owner PIN e.g. '1234' (Unlocks full owner mode & profits)
  staffPin?: string; // Staff PIN e.g. '5678' (Unlocks counter billing & collections mode)
  modificationPassword: string; // Password 2: Action Modification Password e.g. '9999'
  requirePasswordOnChange: boolean; // default true
  expenseCategories: string[];
}

export interface LiveStockSummary {
  categoryId: string;
  categoryName: string;
  categoryNameTa: string;
  availableStock: number;
  totalPurchased: number;
  totalSold: number;
  totalWasted: number;
  isLowStock: boolean;
}

export interface ShopCrateSummary {
  categoryId: string;
  categoryName: string;
  categoryNameTa: string;
  totalOwned: number;
  emptyInShop: number;
  filledWithStock: number;
  withCustomers: number;
  owedToSuppliers: number;
  damagedOrLost: number;
}

export interface SupplierCollectionSummary {
  supplierId: string;
  supplierName: string;
  phone: string;
  place?: string;
  totalDue: number;
  collectedFromCustomers: number;
  paidOutToSupplier: number;
  moneyInHand: number; // collectedFromCustomers - paidOutToSupplier
  stillToCollect: number; // totalDue - collectedFromCustomers
  balancePayable: number; // totalDue - paidOutToSupplier
  cratesOwed: Record<string, number>;
}

export interface CustomerFinancialSummary {
  customerId: string;
  customerName: string;
  shopName?: string;
  phone: string;
  place?: string;
  creditLimit?: number | null;
  openingBalance: number;
  totalBilled: number;
  totalPaid: number;
  totalWrittenOff: number;
  currentBalance: number; // opening + billed - paid - writtenOff
  cratesHeld: Record<string, number>;
  agingDays: number;
  isOverCreditLimit: boolean;
}

export interface ProfitMetrics {
  bookedProfit: number;
  realisedProfit: number;
  pendingProfit: number; // booked - realised
  totalSales: number;
  totalCostOfSales: number;
  totalWastageLoss: number;
  totalExpenses: number;
  totalDiscounts: number;
  totalBadDebts: number;
}
