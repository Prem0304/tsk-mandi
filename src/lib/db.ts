// ============================================================================
// CLIENT DATABASE ENGINE & REPOSITORIES (INDEXEDDB + LOCALSTORAGE + AUDIT)
// ============================================================================

import { openDB, IDBPDatabase } from 'idb';
import {
  CrateCategory,
  Supplier,
  Customer,
  DailyRate,
  Purchase,
  PurchaseLine,
  Sale,
  SaleLine,
  SaleLotAllocation,
  PaymentReceived,
  PaymentMade,
  PaymentAllocation,
  StockAdjustment,
  CrateMovement,
  CrateInventoryEvent,
  Expense,
  CashClosing,
  DiscountWriteoff,
  AuditLog,
  AppSettings,
  LiveStockSummary,
  ShopCrateSummary,
  SupplierCollectionSummary,
  CustomerFinancialSummary,
  ProfitMetrics
} from '../types';
import { calculatePaymentSplit } from './allocationEngine';
import { getTodayDateString } from './utils';

const DB_NAME = 'tsk_mandi_db';
const DB_VERSION = 1;

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'primary',
  shopName: 'T.S.K',
  shopNameTa: 'T.S.K',
  shopSubtitle: 'Thakkali Kaaikari Commission Mandi',
  shopSubtitleTa: 'தக்காளி காய்கறி கமிஷன் மண்டி',
  godName1: 'Shree Valaguranathan Thunai',
  godName1Ta: 'ஸ்ரீ வலகுருநாதன் துணை',
  godName2: 'Shree Angalaeeswari Thunai',
  godName2Ta: 'ஸ்ரீ அங்காளஈஸ்வரி துணை',
  address: 'Shop no 30, Kamarajar Market, Thevaram-625530',
  phone: '9715813463',
  altPhone: '8190801030',
  upiId: '9715813463@upi',
  gstNumber: '',
  billFooter: 'Thank you for your business! Please return empty crates promptly.',
  billFooterTa: 'உங்கள் வணிகத்திற்கு நன்றி! காலி பெட்டிகளை உடனுக்குடன் திருப்பித் தரவும்.',
  paymentAllocationRule: 'supplier_first',
  billAllocationRule: 'fifo',
  lotAllocationRule: 'fifo',
  autoMarkSupplierPaid: false,
  defaultLanguage: 'en',
  crateAgingDays: 15,
  lowStockThreshold: 20,
  autoLockMinutes: 10,
  billPrefix: 'TSK-',
  billPrintSize: 'thermal_80',
  appPin: '1234',
  expenseCategories: [
    'Transport',
    'Labour/Hamali',
    'Loading',
    'Rent',
    'Electricity',
    'Tea/Snacks',
    'Crate Purchase',
    'Other'
  ]
};

export const INITIAL_CATEGORIES: CrateCategory[] = [
  { id: 'big', name: 'Big Crate', name_ta: 'பெரிய பெட்டி', description: 'Standard 25kg plastic tomato crate', isActive: true, displayOrder: 1 },
  { id: 'small', name: 'Small Crate', name_ta: 'சிறிய பெட்டி', description: 'Standard 15kg plastic tomato crate', isActive: true, displayOrder: 2 }
];

export interface MandiDatabaseState {
  settings: AppSettings;
  categories: CrateCategory[];
  suppliers: Supplier[];
  customers: Customer[];
  dailyRates: DailyRate[];
  purchases: Purchase[];
  purchaseLines: PurchaseLine[]; // Lots
  sales: Sale[];
  paymentsReceived: PaymentReceived[];
  paymentsMade: PaymentMade[];
  paymentAllocations: PaymentAllocation[];
  stockAdjustments: StockAdjustment[];
  crateMovements: CrateMovement[];
  crateEvents: CrateInventoryEvent[];
  expenses: Expense[];
  cashClosings: CashClosing[];
  discountsWriteoffs: DiscountWriteoff[];
  auditLogs: AuditLog[];
}

const STORAGE_KEY = 'tsk_mandi_full_state_v1';

const memoryStore: Record<string, string> = {};

function getStoredItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {}
  return memoryStore[key] || null;
}

function setStoredItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
  } catch {}
  memoryStore[key] = value;
}

class DatabaseService {
  private state: MandiDatabaseState;
  private listeners: (() => void)[] = [];

  constructor() {
    this.state = this.loadInitialState();
  }

  private loadInitialState(): MandiDatabaseState {
    const raw = getStoredItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        // Ensure default settings and categories are merged if missing
        const settings = { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) };
        if (settings.address === 'Wholesale Market Yard, Dindigul Road') {
          settings.address = DEFAULT_SETTINGS.address;
        }
        if (settings.phone === '9876543210') {
          settings.phone = DEFAULT_SETTINGS.phone;
          settings.altPhone = DEFAULT_SETTINGS.altPhone;
        }
        if (settings.shopName === 'TSK Tomato and Vegetable Mandi') {
          settings.shopName = DEFAULT_SETTINGS.shopName;
          settings.shopSubtitle = DEFAULT_SETTINGS.shopSubtitle;
          settings.shopSubtitleTa = DEFAULT_SETTINGS.shopSubtitleTa;
        }
        if (!settings.altPhone) settings.altPhone = DEFAULT_SETTINGS.altPhone;
        if (!settings.godName1) settings.godName1 = DEFAULT_SETTINGS.godName1;
        if (!settings.godName1Ta) settings.godName1Ta = DEFAULT_SETTINGS.godName1Ta;
        if (!settings.godName2) settings.godName2 = DEFAULT_SETTINGS.godName2;
        if (!settings.godName2Ta) settings.godName2Ta = DEFAULT_SETTINGS.godName2Ta;

        return {
          ...parsed,
          settings,
          categories: parsed.categories && parsed.categories.length > 0 ? parsed.categories : INITIAL_CATEGORIES
        };
      } catch (e) {
        console.error('Failed to parse saved state, using clean init:', e);
      }
    }

    return {
      settings: DEFAULT_SETTINGS,
      categories: INITIAL_CATEGORIES,
      suppliers: [],
      customers: [],
      dailyRates: [],
      purchases: [],
      purchaseLines: [],
      sales: [],
      paymentsReceived: [],
      paymentsMade: [],
      paymentAllocations: [],
      stockAdjustments: [],
      crateMovements: [],
      crateEvents: [],
      expenses: [],
      cashClosings: [],
      discountsWriteoffs: [],
      auditLogs: []
    };
  }

  public saveState() {
    try {
      setStoredItem(STORAGE_KEY, JSON.stringify(this.state));
      this.notifyListeners();
    } catch (e) {
      console.error('Error saving state to storage:', e);
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l());
  }

  public getState(): MandiDatabaseState {
    return this.state;
  }

  // --- AUDIT HELPER ---
  public logAudit(action: AuditLog['action'], entityType: string, entityId: string, description: string, oldValues?: any, newValues?: any) {
    const log: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      userName: 'Owner',
      action,
      entityType,
      entityId,
      oldValues: oldValues ? JSON.parse(JSON.stringify(oldValues)) : undefined,
      newValues: newValues ? JSON.parse(JSON.stringify(newValues)) : undefined,
      description
    };
    this.state.auditLogs.unshift(log);
  }

  // --- SETTINGS ---
  public updateSettings(newSettings: Partial<AppSettings>) {
    const old = { ...this.state.settings };
    this.state.settings = { ...this.state.settings, ...newSettings };
    this.logAudit('update', 'settings', 'primary', 'Updated shop settings', old, this.state.settings);
    this.saveState();
  }

  // --- CATEGORIES ---
  public saveCategory(category: CrateCategory) {
    const idx = this.state.categories.findIndex(c => c.id === category.id);
    if (idx >= 0) {
      const old = this.state.categories[idx];
      this.state.categories[idx] = category;
      this.logAudit('update', 'crate_category', category.id, `Updated category ${category.name}`, old, category);
    } else {
      this.state.categories.push(category);
      this.logAudit('create', 'crate_category', category.id, `Created category ${category.name}`, null, category);
    }
    this.saveState();
  }

  // --- DAILY RATES ---
  public setDailyRates(rateDate: string, rates: Record<string, { buying: number; selling: number }>, notes?: string) {
    const idx = this.state.dailyRates.findIndex(r => r.rateDate === rateDate);
    const item: DailyRate = {
      id: idx >= 0 ? this.state.dailyRates[idx].id : `rate-${Date.now()}`,
      rateDate,
      rates,
      notes,
      updatedAt: new Date().toISOString()
    };
    if (idx >= 0) {
      this.state.dailyRates[idx] = item;
    } else {
      this.state.dailyRates.unshift(item);
    }
    this.logAudit('update', 'daily_rate', item.id, `Updated daily rates for ${rateDate}`, null, rates);
    this.saveState();
  }

  public getTodayRate(categoryId: string): { buying: number; selling: number } | null {
    const today = getTodayDateString();
    const todayEntry = this.state.dailyRates.find(r => r.rateDate === today);
    if (todayEntry && todayEntry.rates[categoryId]) {
      return todayEntry.rates[categoryId];
    }
    // Fallback to most recent rate
    if (this.state.dailyRates.length > 0) {
      const latest = this.state.dailyRates[0];
      if (latest.rates[categoryId]) return latest.rates[categoryId];
    }
    return null;
  }

  // --- SUPPLIERS ---
  public saveSupplier(supplier: Supplier) {
    const idx = this.state.suppliers.findIndex(s => s.id === supplier.id);
    if (idx >= 0) {
      const old = this.state.suppliers[idx];
      this.state.suppliers[idx] = { ...supplier, updatedAt: new Date().toISOString() };
      this.logAudit('update', 'supplier', supplier.id, `Updated supplier ${supplier.name}`, old, supplier);
    } else {
      this.state.suppliers.push(supplier);
      this.logAudit('create', 'supplier', supplier.id, `Created supplier ${supplier.name}`, null, supplier);

      // Create initial opening crate movement if any
      Object.entries(supplier.openingCrates || {}).forEach(([catId, qty]) => {
        if (qty > 0) {
          this.state.crateMovements.push({
            id: `cm-op-sup-${supplier.id}-${catId}`,
            movementDate: supplier.openingBalanceDate,
            categoryId: catId,
            partyType: 'supplier',
            partyId: supplier.id,
            qtyIn: qty,
            qtyOut: 0,
            ownership: 'supplier',
            refType: 'opening',
            notes: 'Opening crate balance owed to supplier',
            createdAt: new Date().toISOString()
          });
        }
      });
    }
    this.saveState();
  }

  public deleteSupplier(id: string) {
    const s = this.state.suppliers.find(x => x.id === id);
    if (s) {
      s.deletedAt = new Date().toISOString();
      this.logAudit('soft_delete', 'supplier', id, `Deleted supplier ${s.name}`, s, null);
      this.saveState();
    }
  }

  // --- CUSTOMERS ---
  public saveCustomer(customer: Customer) {
    const idx = this.state.customers.findIndex(c => c.id === customer.id);
    if (idx >= 0) {
      const old = this.state.customers[idx];
      this.state.customers[idx] = { ...customer, updatedAt: new Date().toISOString() };
      this.logAudit('update', 'customer', customer.id, `Updated customer ${customer.name}`, old, customer);
    } else {
      this.state.customers.push(customer);
      this.logAudit('create', 'customer', customer.id, `Created customer ${customer.name}`, null, customer);

      // Create initial opening crate movement if any
      Object.entries(customer.openingCrates || {}).forEach(([catId, qty]) => {
        if (qty > 0) {
          this.state.crateMovements.push({
            id: `cm-op-cust-${customer.id}-${catId}`,
            movementDate: customer.openingBalanceDate,
            categoryId: catId,
            partyType: 'customer',
            partyId: customer.id,
            qtyIn: 0,
            qtyOut: qty,
            ownership: 'shop',
            refType: 'opening',
            notes: 'Opening crates held by customer',
            createdAt: new Date().toISOString()
          });
        }
      });
    }
    this.saveState();
  }

  public deleteCustomer(id: string) {
    const c = this.state.customers.find(x => x.id === id);
    if (c) {
      c.deletedAt = new Date().toISOString();
      this.logAudit('soft_delete', 'customer', id, `Deleted customer ${c.name}`, c, null);
      this.saveState();
    }
  }

  // --- PURCHASES (STOCK IN & LOT CREATION) ---
  public recordPurchase(purchase: Purchase) {
    // 1. Add purchase
    this.state.purchases.unshift(purchase);

    // 2. Add purchase lines as individual stock lots in FIFO order
    for (const line of purchase.lines) {
      this.state.purchaseLines.push(line);
    }

    // 3. Record filled crates received (Crate Movement)
    Object.entries(purchase.filledCratesReceived || {}).forEach(([catId, qty]) => {
      if (qty > 0) {
        this.state.crateMovements.push({
          id: `cm-pur-in-${purchase.id}-${catId}`,
          movementDate: purchase.purchaseDate,
          categoryId: catId,
          partyType: 'supplier',
          partyId: purchase.supplierId,
          qtyIn: qty,
          qtyOut: 0,
          ownership: purchase.crateOwnership,
          refType: 'purchase',
          refId: purchase.id,
          notes: `Purchase ${purchase.billNo} filled crates received (${purchase.crateOwnership})`,
          createdAt: new Date().toISOString()
        });
      }
    });

    // 4. Record empty crates returned to supplier on this trip
    Object.entries(purchase.emptyCratesReturned || {}).forEach(([catId, qty]) => {
      if (qty > 0) {
        this.state.crateMovements.push({
          id: `cm-pur-ret-${purchase.id}-${catId}`,
          movementDate: purchase.purchaseDate,
          categoryId: catId,
          partyType: 'supplier',
          partyId: purchase.supplierId,
          qtyIn: 0,
          qtyOut: qty,
          ownership: 'supplier',
          refType: 'supplier_return',
          refId: purchase.id,
          notes: `Empty crates returned on purchase trip ${purchase.billNo}`,
          createdAt: new Date().toISOString()
        });
      }
    });

    // 5. If transport was paid separately by me, record as Expense
    if (purchase.transportCharge > 0 && purchase.transportPaidBy === 'self_expense') {
      this.state.expenses.unshift({
        id: `exp-tr-${purchase.id}`,
        expenseDate: purchase.purchaseDate,
        category: 'Transport',
        amount: purchase.transportCharge,
        mode: purchase.paymentMode || 'cash',
        refType: 'purchase',
        refId: purchase.id,
        notes: `Transport for purchase ${purchase.billNo} (Vehicle: ${purchase.vehicleNo || 'N/A'})`,
        createdAt: new Date().toISOString()
      });
    }

    // 6. If labour/loading charges paid, record as Expense
    if (purchase.labourCharge > 0) {
      this.state.expenses.unshift({
        id: `exp-lab-${purchase.id}`,
        expenseDate: purchase.purchaseDate,
        category: 'Labour/Hamali',
        amount: purchase.labourCharge,
        mode: 'cash',
        refType: 'purchase',
        refId: purchase.id,
        notes: `Hamali for purchase ${purchase.billNo}`,
        createdAt: new Date().toISOString()
      });
    }
    if (purchase.loadingCharge > 0) {
      this.state.expenses.unshift({
        id: `exp-load-${purchase.id}`,
        expenseDate: purchase.purchaseDate,
        category: 'Loading',
        amount: purchase.loadingCharge,
        mode: 'cash',
        refType: 'purchase',
        refId: purchase.id,
        notes: `Loading charge for purchase ${purchase.billNo}`,
        createdAt: new Date().toISOString()
      });
    }

    // 7. If amount paid now to supplier, record as PaymentMade
    if (purchase.amountPaidNow > 0) {
      this.state.paymentsMade.unshift({
        id: `pm-${purchase.id}`,
        paymentDate: purchase.purchaseDate,
        supplierId: purchase.supplierId,
        purchaseId: purchase.id,
        amount: purchase.amountPaidNow,
        mode: purchase.paymentMode || 'cash',
        referenceNo: purchase.paymentRef,
        notes: `Initial payment on purchase bill ${purchase.billNo}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    this.logAudit('create', 'purchase', purchase.id, `Recorded purchase ${purchase.billNo}`, null, purchase);
    this.saveState();
  }

  // --- SALES (STOCK OUT & ALLOCATION) ---
  public recordSale(sale: Sale, paymentNowMode?: string, paymentNowRef?: string) {
    // 1. Verify available stock per category strictly! NO negative stock allowed!
    for (const line of sale.lines) {
      const avail = this.getAvailableStock(line.categoryId);
      if (line.crates > avail) {
        throw new Error(`Insufficient stock for ${line.categoryId}: requested ${line.crates}, available ${avail}. Negative stock is forbidden.`);
      }
    }

    // 2. Deduct crates from allocated lots
    for (const alloc of sale.allocations) {
      const lot = this.state.purchaseLines.find(l => l.id === alloc.lotId);
      if (!lot) throw new Error(`Lot not found: ${alloc.lotId}`);
      if (lot.cratesRemaining < alloc.crates) {
        throw new Error(`Lot ${lot.lotNo} has only ${lot.cratesRemaining} crates left, needed ${alloc.crates}`);
      }
      lot.cratesRemaining -= alloc.crates;
      if (lot.cratesRemaining === 0) {
        lot.isFullySold = true;
      }
    }

    // 3. Add sale
    this.state.sales.unshift(sale);

    // 4. Record empty crates issued to customer
    Object.entries(sale.emptyCratesIssued || {}).forEach(([catId, qty]) => {
      if (qty > 0) {
        this.state.crateMovements.push({
          id: `cm-sale-iss-${sale.id}-${catId}`,
          movementDate: sale.saleDate,
          categoryId: catId,
          partyType: 'customer',
          partyId: sale.customerId,
          qtyIn: 0,
          qtyOut: qty,
          ownership: 'shop',
          refType: 'sale',
          refId: sale.id,
          notes: `Sale bill ${sale.billNo} crates issued`,
          createdAt: new Date().toISOString()
        });
      }
    });

    // 5. Record empty crates returned immediately on sale
    Object.entries(sale.emptyCratesReturned || {}).forEach(([catId, qty]) => {
      if (qty > 0) {
        this.state.crateMovements.push({
          id: `cm-sale-ret-${sale.id}-${catId}`,
          movementDate: sale.saleDate,
          categoryId: catId,
          partyType: 'customer',
          partyId: sale.customerId,
          qtyIn: qty,
          qtyOut: 0,
          ownership: 'shop',
          refType: 'customer_return',
          refId: sale.id,
          notes: `Crates returned on sale bill ${sale.billNo}`,
          createdAt: new Date().toISOString()
        });
      }
    });

    // 6. If amount received now on sale, record payment and split automatically (Section 9A)
    if (sale.amountReceivedNow > 0) {
      this.receivePayment({
        id: `pay-sale-${sale.id}`,
        paymentDate: sale.saleDate,
        customerId: sale.customerId,
        saleId: sale.id,
        amount: sale.amountReceivedNow,
        mode: (sale.paymentMode || 'cash') as any,
        referenceNo: paymentNowRef || sale.paymentRef,
        discount: 0,
        notes: `Received on sale bill ${sale.billNo}`,
        allocations: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, false);
    }

    this.logAudit('create', 'sale', sale.id, `Recorded sale ${sale.billNo} (${sale.totalCrates} crates)`, null, sale);
    this.saveState();
  }

  // --- RECEIVE PAYMENT & AUTO-SPLIT (SECTION 9A) ---
  public receivePayment(payment: PaymentReceived, shouldSave = true) {
    const customer = this.state.customers.find(c => c.id === payment.customerId);
    const customerOpeningBalance = customer?.openingMoneyBalance || 0;

    // Calculate how much opening balance has already been cleared
    const openingBalanceClearedSoFar = this.state.paymentAllocations
      .filter(a => a.customerId === payment.customerId && a.isOpeningBalance)
      .reduce((sum, a) => sum + a.allocatedAmount, 0);

    // Get unpaid sales for this customer sorted oldest first
    const customerSales = this.state.sales
      .filter(s => s.customerId === payment.customerId && !s.deletedAt)
      .sort((a, b) => new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime());

    const lotsMap: Record<string, PurchaseLine> = {};
    this.state.purchaseLines.forEach(l => { lotsMap[l.id] = l; });

    const suppliersMap: Record<string, { id: string; name: string }> = {};
    this.state.suppliers.forEach(s => { suppliersMap[s.id] = { id: s.id, name: s.name }; });

    // Perform the Section 9A allocation calculation!
    const splitResult = calculatePaymentSplit(
      payment.id,
      payment.customerId,
      payment.amount,
      this.state.settings.paymentAllocationRule,
      customerOpeningBalance,
      openingBalanceClearedSoFar,
      customerSales,
      this.state.paymentAllocations,
      lotsMap,
      suppliersMap,
      payment.saleId
    );

    payment.allocations = splitResult.allocations;
    this.state.paymentsReceived.unshift(payment);

    // Save payment allocations
    for (const alloc of splitResult.allocations) {
      this.state.paymentAllocations.push(alloc);

      // If Settings has "autoMarkSupplierPaid" ON and this allocation has a supplier share:
      if (this.state.settings.autoMarkSupplierPaid && alloc.supplierId && alloc.supplierShare > 0) {
        this.state.paymentsMade.unshift({
          id: `pm-auto-${alloc.id}`,
          paymentDate: payment.paymentDate,
          supplierId: alloc.supplierId,
          amount: alloc.supplierShare,
          mode: payment.mode,
          referenceNo: `Auto-paid on receipt ${payment.referenceNo || payment.id}`,
          notes: `Auto settlement from customer payment (Lot: ${lotsMap[alloc.lotId || '']?.lotNo || 'N/A'})`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    // If there is settlement discount provided, record it as profit reduction (does not affect supplier's share)
    if (payment.discount > 0) {
      this.state.discountsWriteoffs.unshift({
        id: `disc-${payment.id}`,
        entryDate: payment.paymentDate,
        customerId: payment.customerId,
        type: 'discount',
        amount: payment.discount,
        reason: `Settlement discount on payment ${payment.referenceNo || payment.id}`,
        createdAt: new Date().toISOString()
      });
    }

    this.logAudit('create', 'payment_received', payment.id, `Received payment of ₹${payment.amount} from ${customer?.name || 'Customer'}`, null, payment);
    if (shouldSave) this.saveState();
  }

  // --- PAY SUPPLIER ---
  public paySupplier(payment: PaymentMade) {
    this.state.paymentsMade.unshift(payment);
    const supplier = this.state.suppliers.find(s => s.id === payment.supplierId);
    this.logAudit('create', 'payment_made', payment.id, `Paid ₹${payment.amount} to supplier ${supplier?.name || 'Supplier'}`, null, payment);
    this.saveState();
  }

  // --- CRATE RETURNS & MOVEMENTS ---
  public recordCrateReturn(partyType: 'customer' | 'supplier', partyId: string, categoryId: string, qty: number, ownership: 'shop' | 'supplier', notes?: string) {
    const isCust = partyType === 'customer';
    this.state.crateMovements.push({
      id: `cm-ret-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      movementDate: getTodayDateString(),
      categoryId,
      partyType,
      partyId,
      // For customer return: qtyIn = qty (entering shop/reducing customer held crates)
      // For supplier return: qtyOut = qty (leaving shop/reducing crates owed to supplier)
      qtyIn: isCust ? qty : 0,
      qtyOut: isCust ? 0 : qty,
      ownership,
      refType: isCust ? 'customer_return' : 'supplier_return',
      notes: notes || `${partyType === 'customer' ? 'Customer' : 'Supplier'} crate return`,
      createdAt: new Date().toISOString()
    });
    this.logAudit('create', 'crate_movement', partyId, `Recorded crate return: ${qty} ${categoryId} crates for ${partyType}`, null, { partyType, partyId, qty });
    this.saveState();
  }

  // --- CRATE PHYSICAL COUNT / INVENTORY ADJUSTMENT ---
  public recordCrateInventoryEvent(event: CrateInventoryEvent) {
    this.state.crateEvents.unshift(event);
    if (event.eventType === 'damaged' || event.eventType === 'lost') {
      // Record damage movement out of shop
      this.state.crateMovements.push({
        id: `cm-loss-${event.id}`,
        movementDate: event.eventDate,
        categoryId: event.categoryId,
        partyType: event.partyType || 'shop',
        partyId: event.partyId,
        qtyIn: 0,
        qtyOut: event.qty,
        ownership: 'shop',
        refType: event.eventType === 'damaged' ? 'damaged' : 'lost',
        refId: event.id,
        notes: event.notes || `Crate ${event.eventType}`,
        createdAt: new Date().toISOString()
      });
    } else if (event.eventType === 'new_purchase') {
      // New crates bought
      this.state.crateMovements.push({
        id: `cm-new-${event.id}`,
        movementDate: event.eventDate,
        categoryId: event.categoryId,
        partyType: 'shop',
        qtyIn: event.qty,
        qtyOut: 0,
        ownership: 'shop',
        refType: 'new_purchase',
        refId: event.id,
        notes: event.notes || 'New crates purchased',
        createdAt: new Date().toISOString()
      });
      if (event.totalCost && event.totalCost > 0) {
        this.state.expenses.unshift({
          id: `exp-crate-${event.id}`,
          expenseDate: event.eventDate,
          category: 'Crate Purchase',
          amount: event.totalCost,
          mode: 'cash',
          notes: `Purchased ${event.qty} new crates (${event.categoryId})`,
          createdAt: new Date().toISOString()
        });
      }
    }
    this.logAudit('create', 'crate_inventory_event', event.id, `Crate inventory event: ${event.eventType} (${event.qty} crates)`, null, event);
    this.saveState();
  }

  // --- STOCK WASTAGE & ADJUSTMENT ---
  public recordStockAdjustment(adj: StockAdjustment) {
    // Reduce from lot (oldest first if not specified)
    const categoryLots = this.state.purchaseLines
      .filter(l => l.categoryId === adj.categoryId && l.cratesRemaining > 0)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let targetLot = adj.lotId ? this.state.purchaseLines.find(l => l.id === adj.lotId) : categoryLots[0];
    if (!targetLot || targetLot.cratesRemaining < adj.crates) {
      throw new Error(`Insufficient crates remaining in lot to record wastage of ${adj.crates} crates.`);
    }

    targetLot.cratesRemaining -= adj.crates;
    targetLot.cratesWasted += adj.crates;
    adj.costPerCrate = targetLot.effectiveCostPerCrate;
    adj.totalCost = adj.crates * targetLot.effectiveCostPerCrate;
    adj.lotId = targetLot.id;

    this.state.stockAdjustments.unshift(adj);
    this.logAudit('create', 'stock_adjustment', adj.id, `Wastage recorded: ${adj.crates} crates (${adj.reason}). Loss: ₹${adj.totalCost}`, null, adj);
    this.saveState();
  }

  // --- EXPENSES ---
  public recordExpense(expense: Expense) {
    this.state.expenses.unshift(expense);
    this.logAudit('create', 'expense', expense.id, `Expense recorded: ₹${expense.amount} (${expense.category})`, null, expense);
    this.saveState();
  }

  public deleteExpense(id: string) {
    const idx = this.state.expenses.findIndex(e => e.id === id);
    if (idx >= 0) {
      const e = this.state.expenses[idx];
      e.deletedAt = new Date().toISOString();
      this.logAudit('delete', 'expense', id, `Deleted expense ₹${e.amount} (${e.category})`, e, null);
      this.saveState();
    }
  }

  // --- CASH BOOK & DAY CLOSING ---
  public performCashClosing(closing: CashClosing) {
    const idx = this.state.cashClosings.findIndex(c => c.closingDate === closing.closingDate);
    if (idx >= 0) {
      this.state.cashClosings[idx] = closing;
    } else {
      this.state.cashClosings.unshift(closing);
    }
    this.logAudit('create', 'cash_closing', closing.id, `Day closing completed for ${closing.closingDate}. Actual Cash: ₹${closing.actualClosing}`, null, closing);
    this.saveState();
  }

  public isDateClosed(dateStr: string): boolean {
    return this.state.cashClosings.some(c => c.closingDate === dateStr && c.isClosed);
  }

  // --- DISCOUNTS & BAD DEBT WRITEOFF ---
  public recordWriteoff(writeoff: DiscountWriteoff) {
    this.state.discountsWriteoffs.unshift(writeoff);
    this.logAudit('create', 'writeoff', writeoff.id, `${writeoff.type === 'bad_debt' ? 'Bad debt written off' : 'Discount given'}: ₹${writeoff.amount}`, null, writeoff);
    this.saveState();
  }

  // --- SOFT DELETE AND AUDIT RECALCULATION ENGINE (SECTION 17) ---
  public deleteTransaction(entityType: 'sale' | 'purchase' | 'payment_received' | 'payment_made', id: string, reason?: string) {
    if (entityType === 'sale') {
      const sale = this.state.sales.find(s => s.id === id);
      if (!sale || sale.deletedAt) return;
      sale.deletedAt = new Date().toISOString();

      // Reverse lot allocations: restore cratesRemaining to lots
      for (const alloc of sale.allocations) {
        const lot = this.state.purchaseLines.find(l => l.id === alloc.lotId);
        if (lot) {
          lot.cratesRemaining += alloc.crates;
          lot.isFullySold = false;
        }
      }

      // Soft delete related crate movements
      this.state.crateMovements.forEach(cm => {
        if (cm.refId === id && cm.refType === 'sale') cm.deletedAt = new Date().toISOString();
      });

      // Remove / recalculate payment allocations linked to this sale
      this.state.paymentAllocations = this.state.paymentAllocations.filter(pa => pa.saleId !== id);

      this.logAudit('soft_delete', 'sale', id, `Deleted sale bill ${sale.billNo}. Reason: ${reason || 'N/A'}`);
    } else if (entityType === 'purchase') {
      const pur = this.state.purchases.find(p => p.id === id);
      if (!pur || pur.deletedAt) return;
      pur.deletedAt = new Date().toISOString();

      // Check if any lot from this purchase has been sold
      const lots = this.state.purchaseLines.filter(l => l.purchaseId === id);
      const isSold = lots.some(l => l.cratesRemaining < l.cratesPurchased);
      if (isSold) {
        throw new Error(`Cannot delete purchase ${pur.billNo}: stock has already been sold to customers. Delete the sales first.`);
      }

      // Soft delete lots
      this.state.purchaseLines = this.state.purchaseLines.filter(l => l.purchaseId !== id);

      // Soft delete crate movements
      this.state.crateMovements.forEach(cm => {
        if (cm.refId === id && cm.refType === 'purchase') cm.deletedAt = new Date().toISOString();
      });

      this.logAudit('soft_delete', 'purchase', id, `Deleted purchase ${pur.billNo}. Reason: ${reason || 'N/A'}`);
    } else if (entityType === 'payment_received') {
      const pay = this.state.paymentsReceived.find(p => p.id === id);
      if (!pay || pay.deletedAt) return;
      pay.deletedAt = new Date().toISOString();

      // Remove payment allocations
      this.state.paymentAllocations = this.state.paymentAllocations.filter(pa => pa.paymentId !== id);

      this.logAudit('soft_delete', 'payment_received', id, `Deleted customer payment ₹${pay.amount}. Reason: ${reason || 'N/A'}`);
    } else if (entityType === 'payment_made') {
      const pm = this.state.paymentsMade.find(p => p.id === id);
      if (!pm || pm.deletedAt) return;
      pm.deletedAt = new Date().toISOString();

      this.logAudit('soft_delete', 'payment_made', id, `Deleted supplier payment ₹${pm.amount}. Reason: ${reason || 'N/A'}`);
    }

    this.saveState();
  }

  // --- QUERY & CALCULATION HELPERS ---

  public getAvailableStock(categoryId: string): number {
    return this.state.purchaseLines
      .filter(l => l.categoryId === categoryId && l.cratesRemaining > 0)
      .reduce((sum, l) => sum + l.cratesRemaining, 0);
  }

  public getLiveStockSummaries(): LiveStockSummary[] {
    const threshold = this.state.settings.lowStockThreshold || 20;
    return this.state.categories.map(cat => {
      const catLots = this.state.purchaseLines.filter(l => l.categoryId === cat.id);
      const totalPurchased = catLots.reduce((sum, l) => sum + l.cratesPurchased, 0);
      const availableStock = catLots.reduce((sum, l) => sum + l.cratesRemaining, 0);
      const totalWasted = catLots.reduce((sum, l) => sum + l.cratesWasted, 0);
      const totalSold = totalPurchased - availableStock - totalWasted;

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        categoryNameTa: cat.name_ta,
        availableStock,
        totalPurchased,
        totalSold,
        totalWasted,
        isLowStock: availableStock <= threshold
      };
    });
  }

  public getCustomerSummary(customerId: string): CustomerFinancialSummary | null {
    const cust = this.state.customers.find(c => c.id === customerId);
    if (!cust) return null;

    const custSales = this.state.sales.filter(s => s.customerId === customerId && !s.deletedAt);
    const totalBilled = custSales.reduce((sum, s) => sum + s.billTotal, 0);

    const custPayments = this.state.paymentsReceived.filter(p => p.customerId === customerId && !p.deletedAt);
    const totalPaid = custPayments.reduce((sum, p) => sum + p.amount + p.discount, 0);

    const custWriteoffs = this.state.discountsWriteoffs.filter(w => w.customerId === customerId && !w.deletedAt);
    const totalWrittenOff = custWriteoffs.reduce((sum, w) => sum + w.amount, 0);

    const currentBalance = cust.openingMoneyBalance + totalBilled - totalPaid - totalWrittenOff;

    // Crate balance
    const cratesHeld: Record<string, number> = {};
    this.state.categories.forEach(cat => {
      const inShop = this.state.crateMovements
        .filter(m => m.partyId === customerId && m.partyType === 'customer' && m.categoryId === cat.id && !m.deletedAt)
        .reduce((sum, m) => sum + m.qtyIn, 0);
      const outShop = this.state.crateMovements
        .filter(m => m.partyId === customerId && m.partyType === 'customer' && m.categoryId === cat.id && !m.deletedAt)
        .reduce((sum, m) => sum + m.qtyOut, 0);
      cratesHeld[cat.id] = Math.max(0, outShop - inShop);
    });

    // Aging: find oldest unpaid sale bill
    let oldestUnpaidDate = cust.openingBalanceDate;
    let runningPaid = totalPaid + totalWrittenOff;
    if (runningPaid >= cust.openingMoneyBalance) {
      runningPaid -= cust.openingMoneyBalance;
      const sortedSales = [...custSales].sort((a, b) => new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime());
      for (const sale of sortedSales) {
        if (runningPaid >= sale.billTotal) {
          runningPaid -= sale.billTotal;
        } else {
          oldestUnpaidDate = sale.saleDate;
          break;
        }
      }
    }

    const agingDays = currentBalance > 0 && oldestUnpaidDate
      ? Math.floor((new Date().getTime() - new Date(oldestUnpaidDate).getTime()) / (1000 * 3600 * 24))
      : 0;

    return {
      customerId: cust.id,
      customerName: cust.name,
      shopName: cust.shopName,
      phone: cust.phone,
      place: cust.place,
      creditLimit: cust.creditLimit,
      openingBalance: cust.openingMoneyBalance,
      totalBilled,
      totalPaid,
      totalWrittenOff,
      currentBalance,
      cratesHeld,
      agingDays,
      isOverCreditLimit: Boolean(cust.creditLimit && currentBalance > cust.creditLimit)
    };
  }

  public getSupplierSummary(supplierId: string): SupplierCollectionSummary | null {
    const supp = this.state.suppliers.find(s => s.id === supplierId);
    if (!supp) return null;

    const suppPurchases = this.state.purchases.filter(p => p.supplierId === supplierId && !p.deletedAt);
    const purchasesDue = suppPurchases.reduce((sum, p) => sum + p.netAmount, 0);
    const totalDue = supp.openingMoneyBalance + purchasesDue;

    // Collected from customers for this supplier
    const collectedFromCustomers = this.state.paymentAllocations
      .filter(a => a.supplierId === supplierId)
      .reduce((sum, a) => sum + a.supplierShare, 0);

    // Paid out to supplier
    const paidOutToSupplier = this.state.paymentsMade
      .filter(p => p.supplierId === supplierId && !p.deletedAt)
      .reduce((sum, p) => sum + p.amount, 0);

    const moneyInHand = Math.max(0, collectedFromCustomers - paidOutToSupplier);
    const stillToCollect = Math.max(0, totalDue - collectedFromCustomers);
    const balancePayable = Math.max(0, totalDue - paidOutToSupplier);

    // Crate balance owed to supplier
    const cratesOwed: Record<string, number> = {};
    this.state.categories.forEach(cat => {
      const inMov = this.state.crateMovements
        .filter(m => m.partyId === supplierId && m.partyType === 'supplier' && m.categoryId === cat.id && !m.deletedAt)
        .reduce((sum, m) => sum + m.qtyIn, 0);
      const outMov = this.state.crateMovements
        .filter(m => m.partyId === supplierId && m.partyType === 'supplier' && m.categoryId === cat.id && !m.deletedAt)
        .reduce((sum, m) => sum + m.qtyOut, 0);
      cratesOwed[cat.id] = Math.max(0, inMov - outMov);
    });

    return {
      supplierId: supp.id,
      supplierName: supp.name,
      phone: supp.phone,
      place: supp.place,
      totalDue,
      collectedFromCustomers,
      paidOutToSupplier,
      moneyInHand,
      stillToCollect,
      balancePayable,
      cratesOwed
    };
  }

  public getShopCrateSummaries(): ShopCrateSummary[] {
    return this.state.categories.map(cat => {
      // 1. Total Owned: from new purchases or initial opening
      const newPurchased = this.state.crateMovements
        .filter(m => m.refType === 'new_purchase' && m.categoryId === cat.id && !m.deletedAt)
        .reduce((sum, m) => sum + m.qtyIn, 0);
      const damagedOrLost = this.state.crateMovements
        .filter(m => (m.refType === 'damaged' || m.refType === 'lost') && m.categoryId === cat.id && !m.deletedAt)
        .reduce((sum, m) => sum + m.qtyOut, 0);
      const totalOwned = Math.max(0, 100 + newPurchased - damagedOrLost); // Base 100 crates owned

      // 2. Filled with Stock: sum of remaining crates in open lots
      const filledWithStock = this.state.purchaseLines
        .filter(l => l.categoryId === cat.id)
        .reduce((sum, l) => sum + l.cratesRemaining, 0);

      // 3. With Customers: sum of customer out - customer in
      const custOut = this.state.crateMovements
        .filter(m => m.partyType === 'customer' && m.categoryId === cat.id && !m.deletedAt)
        .reduce((sum, m) => sum + m.qtyOut, 0);
      const custIn = this.state.crateMovements
        .filter(m => m.partyType === 'customer' && m.categoryId === cat.id && !m.deletedAt)
        .reduce((sum, m) => sum + m.qtyIn, 0);
      const withCustomers = Math.max(0, custOut - custIn);

      // 4. Owed to Suppliers: sum of supplier in - supplier out
      const suppIn = this.state.crateMovements
        .filter(m => m.partyType === 'supplier' && m.categoryId === cat.id && !m.deletedAt)
        .reduce((sum, m) => sum + m.qtyIn, 0);
      const suppOut = this.state.crateMovements
        .filter(m => m.partyType === 'supplier' && m.categoryId === cat.id && !m.deletedAt)
        .reduce((sum, m) => sum + m.qtyOut, 0);
      const owedToSuppliers = Math.max(0, suppIn - suppOut);

      // 5. Empty in Shop: Owned + OwedToSuppliers - WithCustomers - FilledWithStock
      const emptyInShop = Math.max(0, totalOwned + owedToSuppliers - withCustomers - filledWithStock);

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        categoryNameTa: cat.name_ta,
        totalOwned,
        emptyInShop,
        filledWithStock,
        withCustomers,
        owedToSuppliers,
        damagedOrLost
      };
    });
  }

  public getProfitMetrics(startDate?: string, endDate?: string): ProfitMetrics {
    const filterByDate = (dateStr: string) => {
      if (!startDate && !endDate) return true;
      if (startDate && dateStr < startDate) return false;
      if (endDate && dateStr > endDate) return false;
      return true;
    };

    const sales = this.state.sales.filter(s => !s.deletedAt && filterByDate(s.saleDate));
    const totalSales = sales.reduce((sum, s) => sum + s.billTotal, 0);
    const totalCostOfSales = sales.reduce((sum, s) => sum + s.allocations.reduce((aSum, a) => aSum + a.costAmount, 0), 0);

    const wastages = this.state.stockAdjustments.filter(w => !w.deletedAt && filterByDate(w.adjustmentDate));
    const totalWastageLoss = wastages.reduce((sum, w) => sum + w.totalCost, 0);

    const expenses = this.state.expenses.filter(e => !e.deletedAt && filterByDate(e.expenseDate));
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    const writeoffs = this.state.discountsWriteoffs.filter(w => !w.deletedAt && filterByDate(w.entryDate));
    const totalDiscounts = writeoffs.filter(w => w.type === 'discount').reduce((sum, w) => sum + w.amount, 0);
    const totalBadDebts = writeoffs.filter(w => w.type === 'bad_debt').reduce((sum, w) => sum + w.amount, 0);

    // Booked Profit = Sales - Cost - Wastage - Expenses - Discounts - BadDebts
    const bookedProfit = totalSales - totalCostOfSales - totalWastageLoss - totalExpenses - totalDiscounts - totalBadDebts;

    // Realised Profit = Profit share of payments collected + Transport recovery - Wastage - Expenses - Discounts - BadDebts
    const allocations = this.state.paymentAllocations.filter(a => {
      const payment = this.state.paymentsReceived.find(p => p.id === a.paymentId && !p.deletedAt);
      return payment && filterByDate(payment.paymentDate);
    });

    const collectedProfitShare = allocations.reduce((sum, a) => sum + a.profitShare, 0);
    const collectedTransportShare = allocations.reduce((sum, a) => sum + a.transportShare, 0);

    const realisedProfit = (collectedProfitShare + collectedTransportShare) - totalWastageLoss - totalExpenses - totalDiscounts - totalBadDebts;
    const pendingProfit = Math.max(0, bookedProfit - realisedProfit);

    return {
      bookedProfit,
      realisedProfit,
      pendingProfit,
      totalSales,
      totalCostOfSales,
      totalWastageLoss,
      totalExpenses,
      totalDiscounts,
      totalBadDebts
    };
  }

  // --- SEED SAMPLE DATA (EXACT WORKED EXAMPLE & MANDI TEST SCENARIOS) ---
  public loadSampleData() {
    const today = getTodayDateString();

    // 1. Suppliers
    const supplierA: Supplier = {
      id: 'sup-001',
      name: 'Ramu Tomato Farm (Supplier A)',
      phone: '9842100001',
      place: 'Dindigul',
      openingMoneyBalance: 0,
      openingBalanceDate: today,
      openingCrates: { big: 0, small: 0 },
      isActive: true,
      createdAt: today,
      updatedAt: today
    };

    const supplierC: Supplier = {
      id: 'sup-002',
      name: 'Kaveri Mandi Wholesale (Supplier C)',
      phone: '9842100002',
      place: 'Trichy',
      openingMoneyBalance: 0,
      openingBalanceDate: today,
      openingCrates: { big: 0, small: 0 },
      isActive: true,
      createdAt: today,
      updatedAt: today
    };

    // 2. Customers
    const customerB: Customer = {
      id: 'cust-001',
      name: 'Selvam Supermarket (Customer B)',
      shopName: 'Selvam Stores',
      phone: '9944100001',
      place: 'Madurai',
      openingMoneyBalance: 0,
      openingBalanceDate: today,
      openingCrates: { big: 0, small: 0 },
      creditLimit: 50000,
      crateLimits: { big: 50, small: 50 },
      isActive: true,
      createdAt: today,
      updatedAt: today
    };

    const customerD: Customer = {
      id: 'cust-002',
      name: 'Murugan Veggies (Customer D)',
      shopName: 'Murugan Stall',
      phone: '9944100002',
      place: 'Theni',
      openingMoneyBalance: 0,
      openingBalanceDate: today,
      openingCrates: { big: 0, small: 0 },
      creditLimit: 25000,
      crateLimits: { big: 30, small: 30 },
      isActive: true,
      createdAt: today,
      updatedAt: today
    };

    this.state.suppliers = [supplierA, supplierC];
    this.state.customers = [customerB, customerD];

    // 3. Purchase 1: Supplier A - 40 Big Crates @ ₹300 (Lot L-0001) + 20 Small @ ₹200
    const pur1Line1: PurchaseLine = {
      id: 'pline-001',
      purchaseId: 'pur-001',
      supplierId: supplierA.id,
      lotNo: 'L-0001',
      categoryId: 'big',
      cratesPurchased: 40,
      cratesRemaining: 40,
      cratesWasted: 0,
      pricePerCrate: 300,
      transportShare: 0,
      effectiveCostPerCrate: 300,
      lineTotal: 12000,
      isFullySold: false,
      isFullyCollected: false,
      isSettledWithSupplier: false,
      createdAt: today
    };

    const pur1Line2: PurchaseLine = {
      id: 'pline-002',
      purchaseId: 'pur-001',
      supplierId: supplierA.id,
      lotNo: 'L-0002',
      categoryId: 'small',
      cratesPurchased: 20,
      cratesRemaining: 20,
      cratesWasted: 0,
      pricePerCrate: 200,
      transportShare: 0,
      effectiveCostPerCrate: 200,
      lineTotal: 4000,
      isFullySold: false,
      isFullyCollected: false,
      isSettledWithSupplier: false,
      createdAt: today
    };

    const purchase1: Purchase = {
      id: 'pur-001',
      purchaseDate: today,
      supplierId: supplierA.id,
      billNo: 'TSK-PUR-001',
      vehicleNo: 'TN-57-AB-1234',
      transportCharge: 0,
      transportPaidBy: 'none',
      labourCharge: 0,
      loadingCharge: 0,
      totalCrates: 60,
      subtotalAmount: 16000,
      netAmount: 16000,
      amountPaidNow: 0,
      lines: [pur1Line1, pur1Line2],
      filledCratesReceived: { big: 40, small: 20 },
      crateOwnership: 'supplier',
      emptyCratesReturned: { big: 0, small: 0 },
      notes: 'Fresh morning arrival from Ramu Farm',
      createdAt: today,
      updatedAt: today
    };

    this.state.purchases = [purchase1];
    this.state.purchaseLines = [pur1Line1, pur1Line2];

    // Record crate movement for purchase 1
    this.state.crateMovements = [
      {
        id: 'cm-init-1',
        movementDate: today,
        categoryId: 'big',
        partyType: 'supplier',
        partyId: supplierA.id,
        qtyIn: 40,
        qtyOut: 0,
        ownership: 'supplier',
        refType: 'purchase',
        refId: purchase1.id,
        createdAt: today
      },
      {
        id: 'cm-init-2',
        movementDate: today,
        categoryId: 'small',
        partyType: 'supplier',
        partyId: supplierA.id,
        qtyIn: 20,
        qtyOut: 0,
        ownership: 'supplier',
        refType: 'purchase',
        refId: purchase1.id,
        createdAt: today
      }
    ];

    // 4. Daily Rates
    this.setDailyRates(today, {
      big: { buying: 300, selling: 350 },
      small: { buying: 200, selling: 240 }
    });

    this.logAudit('create', 'sample_data', 'all', 'Loaded demonstration mandi scenario data');
    this.saveState();
  }

  public clearAllData() {
    this.state = {
      settings: DEFAULT_SETTINGS,
      categories: INITIAL_CATEGORIES,
      suppliers: [],
      customers: [],
      dailyRates: [],
      purchases: [],
      purchaseLines: [],
      sales: [],
      paymentsReceived: [],
      paymentsMade: [],
      paymentAllocations: [],
      stockAdjustments: [],
      crateMovements: [],
      crateEvents: [],
      expenses: [],
      cashClosings: [],
      discountsWriteoffs: [],
      auditLogs: []
    };
    this.saveState();
  }
}

export const dbService = new DatabaseService();
