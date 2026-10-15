// ============================================================================
// PAYMENT ALLOCATION & PROFIT REALIZATION ENGINE (SECTION 9A)
// ============================================================================

import {
  Sale,
  PurchaseLine,
  PaymentAllocation,
  PaymentAllocationRule,
  SaleLotAllocation
} from '../types';

export interface SplitPreviewItem {
  type: 'opening_balance' | 'lot_share' | 'transport_recovery' | 'profit' | 'customer_credit';
  supplierId?: string;
  supplierName?: string;
  lotId?: string;
  lotNo?: string;
  billNo?: string;
  saleId?: string;
  amount: number;
  description: string;
}

export interface SplitPreviewResult {
  allocations: PaymentAllocation[];
  items: SplitPreviewItem[];
  totalSupplierShare: number;
  totalTransportShare: number;
  totalProfitShare: number;
  openingBalanceCleared: number;
  customerCreditCreated: number;
}

/**
 * Perform FIFO or Proportional allocation of a payment across customer's opening balance & unpaid sales
 */
export function calculatePaymentSplit(
  paymentId: string,
  customerId: string,
  paymentAmount: number,
  rule: PaymentAllocationRule, // 'supplier_first' | 'proportional'
  customerOpeningBalance: number,
  openingBalanceAlreadyCleared: number,
  sales: Sale[], // Unpaid or partially paid sales for this customer, sorted oldest first
  existingAllocations: PaymentAllocation[], // All existing allocations for these sales
  lotsMap: Record<string, PurchaseLine>,
  suppliersMap: Record<string, { id: string; name: string }>,
  specificSaleId?: string // If paying against a specific bill
): SplitPreviewResult {
  let remainingPayment = Math.max(0, paymentAmount);
  const newAllocations: PaymentAllocation[] = [];
  const previewItems: SplitPreviewItem[] = [];

  let totalSupplierShare = 0;
  let totalTransportShare = 0;
  let totalProfitShare = 0;
  let openingBalanceCleared = 0;
  let customerCreditCreated = 0;

  // Step 1: Clear customer's opening balance first (if any left)
  const remainingOpeningBalance = Math.max(0, customerOpeningBalance - openingBalanceAlreadyCleared);
  if (!specificSaleId && remainingOpeningBalance > 0 && remainingPayment > 0) {
    const clearAmount = Math.min(remainingPayment, remainingOpeningBalance);
    remainingPayment -= clearAmount;
    openingBalanceCleared = clearAmount;

    newAllocations.push({
      id: `alloc-op-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      paymentId,
      customerId,
      isOpeningBalance: true,
      allocatedAmount: clearAmount,
      supplierShare: 0,
      transportShare: 0,
      profitShare: clearAmount, // Opening balance is shop's past money
      createdAt: new Date().toISOString()
    });

    previewItems.push({
      type: 'opening_balance',
      amount: clearAmount,
      description: `Opening Balance Cleared: ₹${clearAmount.toFixed(2)}`
    });
  }

  // Filter sales: if specificSaleId provided, use only that sale; otherwise use all unpaid sales FIFO
  const candidateSales = specificSaleId
    ? sales.filter(s => s.id === specificSaleId && !s.deletedAt)
    : sales.filter(s => !s.deletedAt);

  for (const sale of candidateSales) {
    if (remainingPayment <= 0) break;

    // Calculate how much has already been paid on this sale
    const saleAllocations = existingAllocations.filter(a => a.saleId === sale.id);
    const alreadyPaidOnSale = saleAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
    const saleUnpaidBalance = Math.max(0, sale.billTotal - alreadyPaidOnSale);

    if (saleUnpaidBalance <= 0) continue; // Already fully paid

    const amountForThisSale = Math.min(remainingPayment, saleUnpaidBalance);
    remainingPayment -= amountForThisSale;

    // Now split amountForThisSale across the sale's allocations (lots) and profit
    // Calculate total cost, transport, and profit on this sale
    const saleTotalCost = sale.allocations.reduce((sum, alloc) => sum + alloc.costAmount, 0);
    const saleTransport = sale.transportCharge || 0;
    // Net profit on bill = billTotal - saleTotalCost - saleTransport
    const saleProfit = Math.max(0, sale.billTotal - saleTotalCost - saleTransport);

    if (rule === 'supplier_first') {
      // RULE: SUPPLIER FIRST (Default)
      // Clears supplier cost of that bill first (oldest lot first), then transport, then realised profit.
      let remainingForSale = amountForThisSale;

      // Track how much cost has already been paid for each lot on this sale
      for (const alloc of sale.allocations) {
        if (remainingForSale <= 0) break;

        // How much of this lot's cost has already been cleared on this sale?
        const lotAllocationsAlready = saleAllocations
          .filter(a => a.lotId === alloc.lotId)
          .reduce((sum, a) => sum + a.supplierShare, 0);

        const lotCostUnpaid = Math.max(0, alloc.costAmount - lotAllocationsAlready);

        if (lotCostUnpaid > 0) {
          const supplierClearAmount = Math.min(remainingForSale, lotCostUnpaid);
          remainingForSale -= supplierClearAmount;
          totalSupplierShare += supplierClearAmount;

          const lotInfo = lotsMap[alloc.lotId];
          const supplierInfo = suppliersMap[alloc.supplierId];

          newAllocations.push({
            id: `alloc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            paymentId,
            customerId,
            saleId: sale.id,
            lotId: alloc.lotId,
            supplierId: alloc.supplierId,
            allocatedAmount: supplierClearAmount,
            supplierShare: supplierClearAmount,
            transportShare: 0,
            profitShare: 0,
            createdAt: new Date().toISOString()
          });

          previewItems.push({
            type: 'lot_share',
            supplierId: alloc.supplierId,
            supplierName: supplierInfo?.name || 'Supplier',
            lotId: alloc.lotId,
            lotNo: lotInfo?.lotNo || 'Lot',
            billNo: sale.billNo,
            saleId: sale.id,
            amount: supplierClearAmount,
            description: `${supplierInfo?.name || 'Supplier'} (${lotInfo?.lotNo || 'Lot'}): ₹${supplierClearAmount.toFixed(2)}`
          });
        }
      }

      // Next in supplier_first: Transport recovery
      if (remainingForSale > 0 && saleTransport > 0) {
        const transportAlreadyRecovered = saleAllocations.reduce((sum, a) => sum + a.transportShare, 0);
        const transportUnrecovered = Math.max(0, saleTransport - transportAlreadyRecovered);

        if (transportUnrecovered > 0) {
          const transportClearAmount = Math.min(remainingForSale, transportUnrecovered);
          remainingForSale -= transportClearAmount;
          totalTransportShare += transportClearAmount;

          newAllocations.push({
            id: `alloc-tr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            paymentId,
            customerId,
            saleId: sale.id,
            allocatedAmount: transportClearAmount,
            supplierShare: 0,
            transportShare: transportClearAmount,
            profitShare: 0,
            createdAt: new Date().toISOString()
          });

          previewItems.push({
            type: 'transport_recovery',
            billNo: sale.billNo,
            saleId: sale.id,
            amount: transportClearAmount,
            description: `Transport Recovery (${sale.billNo}): ₹${transportClearAmount.toFixed(2)}`
          });
        }
      }

      // Remainder is Realised Profit!
      if (remainingForSale > 0) {
        const profitAmount = remainingForSale;
        totalProfitShare += profitAmount;

        newAllocations.push({
          id: `alloc-pr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          paymentId,
          customerId,
          saleId: sale.id,
          allocatedAmount: profitAmount,
          supplierShare: 0,
          transportShare: 0,
          profitShare: profitAmount,
          createdAt: new Date().toISOString()
        });

        previewItems.push({
          type: 'profit',
          billNo: sale.billNo,
          saleId: sale.id,
          amount: profitAmount,
          description: `Realised Profit (${sale.billNo}): ₹${profitAmount.toFixed(2)}`
        });
      }

    } else {
      // RULE: PROPORTIONAL SPLIT
      // Each rupee is split in bill's cost : transport : profit ratio
      const billBase = sale.billTotal > 0 ? sale.billTotal : 1;
      const costRatio = saleTotalCost / billBase;
      const transportRatio = saleTransport / billBase;
      const profitRatio = saleProfit / billBase;

      const propSupplierTotal = amountForThisSale * costRatio;
      const propTransport = amountForThisSale * transportRatio;
      const propProfit = amountForThisSale * profitRatio;

      totalTransportShare += propTransport;
      totalProfitShare += propProfit;

      // Distribute propSupplierTotal across lots proportionally
      let supplierAssigned = 0;
      for (let i = 0; i < sale.allocations.length; i++) {
        const alloc = sale.allocations[i];
        const isLast = i === sale.allocations.length - 1;
        const lotCostRatio = saleTotalCost > 0 ? (alloc.costAmount / saleTotalCost) : 1 / sale.allocations.length;
        const lotSupplierShare = isLast
          ? (propSupplierTotal - supplierAssigned)
          : Math.round(propSupplierTotal * lotCostRatio * 100) / 100;
        
        supplierAssigned += lotSupplierShare;
        totalSupplierShare += lotSupplierShare;

        const lotInfo = lotsMap[alloc.lotId];
        const supplierInfo = suppliersMap[alloc.supplierId];

        newAllocations.push({
          id: `alloc-prop-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          paymentId,
          customerId,
          saleId: sale.id,
          lotId: alloc.lotId,
          supplierId: alloc.supplierId,
          allocatedAmount: lotSupplierShare,
          supplierShare: lotSupplierShare,
          transportShare: 0,
          profitShare: 0,
          createdAt: new Date().toISOString()
        });

        previewItems.push({
          type: 'lot_share',
          supplierId: alloc.supplierId,
          supplierName: supplierInfo?.name || 'Supplier',
          lotId: alloc.lotId,
          lotNo: lotInfo?.lotNo || 'Lot',
          billNo: sale.billNo,
          saleId: sale.id,
          amount: lotSupplierShare,
          description: `${supplierInfo?.name || 'Supplier'} (${lotInfo?.lotNo || 'Lot'}): ₹${lotSupplierShare.toFixed(2)}`
        });
      }

      if (propTransport > 0) {
        newAllocations.push({
          id: `alloc-tr-prop-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          paymentId,
          customerId,
          saleId: sale.id,
          allocatedAmount: propTransport,
          supplierShare: 0,
          transportShare: propTransport,
          profitShare: 0,
          createdAt: new Date().toISOString()
        });

        previewItems.push({
          type: 'transport_recovery',
          billNo: sale.billNo,
          saleId: sale.id,
          amount: propTransport,
          description: `Transport Recovery: ₹${propTransport.toFixed(2)}`
        });
      }

      if (propProfit > 0) {
        newAllocations.push({
          id: `alloc-pr-prop-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          paymentId,
          customerId,
          saleId: sale.id,
          allocatedAmount: propProfit,
          supplierShare: 0,
          transportShare: 0,
          profitShare: propProfit,
          createdAt: new Date().toISOString()
        });

        previewItems.push({
          type: 'profit',
          billNo: sale.billNo,
          saleId: sale.id,
          amount: propProfit,
          description: `Realised Profit: ₹${propProfit.toFixed(2)}`
        });
      }
    }
  }

  // If there's still money remaining after paying all bills and opening balance:
  // It is treated as Customer Advance Credit (kept as customer credit for future sales)
  if (remainingPayment > 0) {
    customerCreditCreated = remainingPayment;
    newAllocations.push({
      id: `alloc-adv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      paymentId,
      customerId,
      allocatedAmount: remainingPayment,
      supplierShare: 0,
      transportShare: 0,
      profitShare: 0,
      createdAt: new Date().toISOString()
    });

    previewItems.push({
      type: 'customer_credit',
      amount: remainingPayment,
      description: `Advance Customer Credit: ₹${remainingPayment.toFixed(2)}`
    });
  }

  return {
    allocations: newAllocations,
    items: previewItems,
    totalSupplierShare,
    totalTransportShare,
    totalProfitShare,
    openingBalanceCleared,
    customerCreditCreated
  };
}

/**
 * Allocate stock from open lots using FIFO for a sale line
 */
export function allocateLotsFIFO(
  categoryId: string,
  cratesNeeded: number,
  sellingPricePerCrate: number,
  openLots: PurchaseLine[] // Sorted oldest first
): {
  success: boolean;
  allocations: Omit<SaleLotAllocation, 'id' | 'saleId' | 'saleLineId' | 'collectedAmount' | 'supplierClearedAmount'>[];
  totalAvailable: number;
  remainingShortage: number;
} {
  const categoryLots = openLots
    .filter(l => l.categoryId === categoryId && l.cratesRemaining > 0)
    .sort((a, b) => a.lotNo.localeCompare(b.lotNo));
  const totalAvailable = categoryLots.reduce((sum, l) => sum + l.cratesRemaining, 0);

  if (cratesNeeded > totalAvailable) {
    return {
      success: false,
      allocations: [],
      totalAvailable,
      remainingShortage: cratesNeeded - totalAvailable
    };
  }

  let remainingToAllocate = cratesNeeded;
  const allocations: Omit<SaleLotAllocation, 'id' | 'saleId' | 'saleLineId' | 'collectedAmount' | 'supplierClearedAmount'>[] = [];

  for (const lot of categoryLots) {
    if (remainingToAllocate <= 0) break;

    const cratesFromThisLot = Math.min(remainingToAllocate, lot.cratesRemaining);
    remainingToAllocate -= cratesFromThisLot;

    const costAmount = cratesFromThisLot * lot.effectiveCostPerCrate;
    const saleAmount = cratesFromThisLot * sellingPricePerCrate;
    const bookedProfit = saleAmount - costAmount;

    allocations.push({
      lotId: lot.id,
      supplierId: lot.supplierId,
      categoryId,
      crates: cratesFromThisLot,
      costPerCrate: lot.effectiveCostPerCrate,
      salePricePerCrate: sellingPricePerCrate,
      costAmount,
      saleAmount,
      bookedProfit
    });
  }

  return {
    success: true,
    allocations,
    totalAvailable,
    remainingShortage: 0
  };
}
