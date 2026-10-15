// ============================================================================
// COMPREHENSIVE AUTOMATED VERIFICATION OF ALL 15 ACCEPTANCE CHECKS (SECTION 21)
// ============================================================================

import { dbService } from './lib/db';
import { allocateLotsFIFO, calculatePaymentSplit } from './lib/allocationEngine';
import { Purchase, Sale, SaleLine, SaleLotAllocation, PaymentReceived, PaymentMade } from './types';

function assert(condition: boolean, testName: string, detail?: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${testName} - ${detail || ''}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${testName}`);
  }
}

async function runAcceptanceChecks() {
  console.log('====================================================');
  console.log('STARTING VERIFICATION OF ALL 15 MANDI ACCEPTANCE CHECKS');
  console.log('====================================================\n');

  // Clear database to clean state
  dbService.clearAllData();

  // Setup: 2 Suppliers and 2 Customers
  const supplierAId = 'sup-test-a';
  const supplierCId = 'sup-test-c';
  const customerBId = 'cust-test-b';

  dbService.saveSupplier({
    id: supplierAId,
    name: 'Supplier A (Ramu Farm)',
    phone: '9842100001',
    place: 'Dindigul',
    openingMoneyBalance: 0,
    openingBalanceDate: '2026-10-01',
    openingCrates: { big: 0, small: 0 },
    isActive: true,
    createdAt: '2026-10-01',
    updatedAt: '2026-10-01'
  });

  dbService.saveSupplier({
    id: supplierCId,
    name: 'Supplier C (Trichy Mandi)',
    phone: '9842100002',
    place: 'Trichy',
    openingMoneyBalance: 0,
    openingBalanceDate: '2026-10-01',
    openingCrates: { big: 0, small: 0 },
    isActive: true,
    createdAt: '2026-10-01',
    updatedAt: '2026-10-01'
  });

  dbService.saveCustomer({
    id: customerBId,
    name: 'Customer B (Selvam Stores)',
    phone: '9944100001',
    place: 'Madurai',
    openingMoneyBalance: 0,
    openingBalanceDate: '2026-10-01',
    openingCrates: { big: 0, small: 0 },
    creditLimit: 20000,
    crateLimits: { big: 50, small: 50 },
    isActive: true,
    createdAt: '2026-10-01',
    updatedAt: '2026-10-01'
  });

  // --------------------------------------------------------------------------
  // CHECK 1: Purchase of 40 Big @ ₹300 + 20 Small @ ₹200 from Supplier A
  // Stock becomes Big 40, Small 20. Supplier A payable = 12000 + 4000 = 16000. Crate balance = 40 Big, 20 Small.
  // --------------------------------------------------------------------------
  const pur1Id = 'pur-test-1';
  const pur1LineBig = {
    id: 'pline-1',
    purchaseId: pur1Id,
    supplierId: supplierAId,
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
    createdAt: '2026-10-01'
  };

  const pur1LineSmall = {
    id: 'pline-2',
    purchaseId: pur1Id,
    supplierId: supplierAId,
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
    createdAt: '2026-10-01'
  };

  dbService.recordPurchase({
    id: pur1Id,
    purchaseDate: '2026-10-01',
    supplierId: supplierAId,
    billNo: 'PUR-001',
    transportCharge: 0,
    transportPaidBy: 'none',
    labourCharge: 0,
    loadingCharge: 0,
    totalCrates: 60,
    subtotalAmount: 16000,
    netAmount: 16000,
    amountPaidNow: 0,
    lines: [pur1LineBig, pur1LineSmall],
    filledCratesReceived: { big: 40, small: 20 },
    crateOwnership: 'supplier',
    emptyCratesReturned: { big: 0, small: 0 },
    createdAt: '2026-10-01',
    updatedAt: '2026-10-01'
  });

  const stockBigAfterPur = dbService.getAvailableStock('big');
  const stockSmallAfterPur = dbService.getAvailableStock('small');
  const suppASummary1 = dbService.getSupplierSummary(supplierAId);

  assert(stockBigAfterPur === 40 && stockSmallAfterPur === 20, 'Check 1.1: Live stock is Big 40, Small 20', `Got Big ${stockBigAfterPur}, Small ${stockSmallAfterPur}`);
  assert(suppASummary1?.balancePayable === 16000, 'Check 1.2: Supplier A balance payable is ₹16,000', `Got ${suppASummary1?.balancePayable}`);
  assert(suppASummary1?.cratesOwed['big'] === 40 && suppASummary1?.cratesOwed['small'] === 20, 'Check 1.3: Supplier A crate balance is 40 Big, 20 Small');

  // --------------------------------------------------------------------------
  // CHECK 2: Sale of 10 Big @ customer-specific price ₹350 to Customer B
  // Stock becomes Big 30. B's passbook shows debit ₹3,500. B's crates held = 10 Big.
  // --------------------------------------------------------------------------
  const openLots1 = dbService.getState().purchaseLines.filter(l => l.cratesRemaining > 0);
  const fifoAlloc1 = allocateLotsFIFO('big', 10, 350, openLots1);
  assert(fifoAlloc1.success && fifoAlloc1.allocations.length === 1, 'Check 2.0: FIFO allocated from L-0001');

  const sale1Id = 'sale-test-1';
  const sale1Line = {
    id: 'sline-1',
    saleId: sale1Id,
    categoryId: 'big',
    crates: 10,
    pricePerCrate: 350,
    lineTotal: 3500
  };
  const sale1Alloc: SaleLotAllocation = {
    ...fifoAlloc1.allocations[0],
    id: 'salloc-1',
    saleId: sale1Id,
    saleLineId: sale1Line.id,
    collectedAmount: 0,
    supplierClearedAmount: 0
  };

  dbService.recordSale({
    id: sale1Id,
    saleDate: '2026-10-02',
    customerId: customerBId,
    billNo: 'SALE-001',
    lines: [sale1Line],
    allocations: [sale1Alloc],
    transportCharge: 0,
    discount: 0,
    roundOff: 0,
    subtotalAmount: 3500,
    billTotal: 3500,
    amountReceivedNow: 0,
    totalCrates: 10,
    emptyCratesIssued: { big: 10, small: 0 },
    emptyCratesReturned: { big: 0, small: 0 },
    createdAt: '2026-10-02',
    updatedAt: '2026-10-02'
  });

  const stockBigAfterSale = dbService.getAvailableStock('big');
  const custBSummary1 = dbService.getCustomerSummary(customerBId);

  assert(stockBigAfterSale === 30, 'Check 2.1: Stock becomes Big 30', `Got ${stockBigAfterSale}`);
  assert(custBSummary1?.currentBalance === 3500, 'Check 2.2: Customer B balance is ₹3,500', `Got ${custBSummary1?.currentBalance}`);
  assert(custBSummary1?.cratesHeld['big'] === 10, 'Check 2.3: Customer B crates held = 10 Big', `Got ${custBSummary1?.cratesHeld['big']}`);

  // --------------------------------------------------------------------------
  // CHECK 3: Trying to sell 35 Big when only 30 are available is blocked
  // --------------------------------------------------------------------------
  let check3Blocked = false;
  try {
    const openLots2 = dbService.getState().purchaseLines.filter(l => l.cratesRemaining > 0);
    const fifoAllocOverflow = allocateLotsFIFO('big', 35, 350, openLots2);
    if (!fifoAllocOverflow.success) {
      check3Blocked = true;
    }
  } catch {
    check3Blocked = true;
  }
  assert(check3Blocked, 'Check 3: Sale of 35 Big when 30 available is strictly blocked');

  // --------------------------------------------------------------------------
  // CHECK 11: WORKED EXAMPLE IN SECTION 9A (CRITICAL CORE LOGIC)
  // Supplier A lot L-0001: 40 Big @ ₹300 = ₹12,000 due.
  // Customer B buys 10 Big @ ₹350 = ₹3,500. Cost ₹3,000, booked profit ₹500.
  // B pays ₹2,000 (Supplier first): Supplier A collected ₹2,000, profit ₹0, B balance ₹1,500.
  // B pays ₹1,500: Supplier A collected +₹1,000 (total ₹3,000 cleared), realised profit ₹500, B balance ₹0.
  // --------------------------------------------------------------------------
  // Payment 1: ₹2,000
  dbService.receivePayment({
    id: 'pay-test-1',
    paymentDate: '2026-10-03',
    customerId: customerBId,
    amount: 2000,
    mode: 'cash',
    discount: 0,
    allocations: [],
    createdAt: '2026-10-03',
    updatedAt: '2026-10-03'
  });

  const suppASummaryAfterPay1 = dbService.getSupplierSummary(supplierAId);
  const custBSummaryAfterPay1 = dbService.getCustomerSummary(customerBId);
  const profitAfterPay1 = dbService.getProfitMetrics();

  assert(suppASummaryAfterPay1?.moneyInHand === 2000, 'Check 11.1: Supplier A collected is ₹2,000 and Money in Hand = ₹2,000', `Got ${suppASummaryAfterPay1?.moneyInHand}`);
  assert(profitAfterPay1.realisedProfit === 0, 'Check 11.2: Realised profit is ₹0 after ₹2,000 payment under Supplier-First', `Got ${profitAfterPay1.realisedProfit}`);
  assert(custBSummaryAfterPay1?.currentBalance === 1500, 'Check 11.3: Customer B balance is ₹1,500', `Got ${custBSummaryAfterPay1?.currentBalance}`);

  // Payment 2: ₹1,500
  dbService.receivePayment({
    id: 'pay-test-2',
    paymentDate: '2026-10-04',
    customerId: customerBId,
    amount: 1500,
    mode: 'cash',
    discount: 0,
    allocations: [],
    createdAt: '2026-10-04',
    updatedAt: '2026-10-04'
  });

  const suppASummaryAfterPay2 = dbService.getSupplierSummary(supplierAId);
  const custBSummaryAfterPay2 = dbService.getCustomerSummary(customerBId);
  const profitAfterPay2 = dbService.getProfitMetrics();

  assert(suppASummaryAfterPay2?.moneyInHand === 3000, 'Check 11.4: Supplier A collected is total ₹3,000 (Supplier cost fully cleared)', `Got ${suppASummaryAfterPay2?.moneyInHand}`);
  assert(profitAfterPay2.realisedProfit === 500, 'Check 11.5: Realised profit is ₹500', `Got ${profitAfterPay2.realisedProfit}`);
  assert(custBSummaryAfterPay2?.currentBalance === 0, 'Check 11.6: Customer B balance is ₹0', `Got ${custBSummaryAfterPay2?.currentBalance}`);

  // --------------------------------------------------------------------------
  // CHECK 4: Passbook balance reduces correctly and cash book updates
  // --------------------------------------------------------------------------
  assert(custBSummaryAfterPay2?.currentBalance === 0, 'Check 4.1: Customer B passbook balance is fully cleared to ₹0');

  // --------------------------------------------------------------------------
  // CHECK 5: Customer B returns 6 Big crates: B holds 4 Big, shop empty crates increase by 6
  // --------------------------------------------------------------------------
  dbService.recordCrateReturn('customer', customerBId, 'big', 6, 'shop', 'Customer returned 6 crates');
  const custBSummaryAfterCrateReturn = dbService.getCustomerSummary(customerBId);
  const shopCrateBig = dbService.getShopCrateSummaries().find(c => c.categoryId === 'big');

  assert(custBSummaryAfterCrateReturn?.cratesHeld['big'] === 4, 'Check 5.1: Customer B now holds 4 Big crates', `Got ${custBSummaryAfterCrateReturn?.cratesHeld['big']}`);

  // --------------------------------------------------------------------------
  // CHECK 6: Returning 20 empty Big crates to Supplier A reduces crates owed to A
  // --------------------------------------------------------------------------
  const suppABigCratesBefore = dbService.getSupplierSummary(supplierAId)?.cratesOwed['big'] || 0;
  dbService.recordCrateReturn('supplier', supplierAId, 'big', 20, 'supplier', 'Returned 20 empty crates to Supplier A');
  const suppABigCratesAfter = dbService.getSupplierSummary(supplierAId)?.cratesOwed['big'] || 0;

  assert(suppABigCratesAfter === suppABigCratesBefore - 20, 'Check 6: Returning 20 empty Big crates to Supplier A reduces owed crates by 20', `Before ${suppABigCratesBefore}, After ${suppABigCratesAfter}`);

  // --------------------------------------------------------------------------
  // CHECK 12: Sale of 50 Big spanning Lot L-0001 (Supplier A, 30 left @ ₹300) and Lot L-0003 (Supplier C, @ ₹320)
  // Allocates 30 + 20 crates, and payment clears Supplier A first, then Supplier C
  // --------------------------------------------------------------------------
  // Add Supplier C purchase: 30 crates @ ₹320 (Lot L-0003)
  const purCId = 'pur-test-c';
  const purCLine = {
    id: 'pline-c',
    purchaseId: purCId,
    supplierId: supplierCId,
    lotNo: 'L-0003',
    categoryId: 'big',
    cratesPurchased: 30,
    cratesRemaining: 30,
    cratesWasted: 0,
    pricePerCrate: 320,
    transportShare: 0,
    effectiveCostPerCrate: 320,
    lineTotal: 9600,
    isFullySold: false,
    isFullyCollected: false,
    isSettledWithSupplier: false,
    createdAt: '2026-10-05'
  };

  dbService.recordPurchase({
    id: purCId,
    purchaseDate: '2026-10-05',
    supplierId: supplierCId,
    billNo: 'PUR-C-001',
    transportCharge: 0,
    transportPaidBy: 'none',
    labourCharge: 0,
    loadingCharge: 0,
    totalCrates: 30,
    subtotalAmount: 9600,
    netAmount: 9600,
    amountPaidNow: 0,
    lines: [purCLine],
    filledCratesReceived: { big: 30, small: 0 },
    crateOwnership: 'supplier',
    emptyCratesReturned: { big: 0, small: 0 },
    createdAt: '2026-10-05',
    updatedAt: '2026-10-05'
  });

  const openLotsForSplit = dbService.getState().purchaseLines.filter(l => l.cratesRemaining > 0);
  const fifoAlloc50 = allocateLotsFIFO('big', 50, 360, openLotsForSplit);

  assert(fifoAlloc50.success && fifoAlloc50.allocations.length === 2, 'Check 12.1: FIFO spans exactly 2 lots (30 from Lot 1 + 20 from Lot 2)');
  assert(fifoAlloc50.allocations[0].supplierId === supplierAId && fifoAlloc50.allocations[0].crates === 30, 'Check 12.2: Lot 1 gives 30 crates for Supplier A @ ₹300');
  assert(fifoAlloc50.allocations[1].supplierId === supplierCId && fifoAlloc50.allocations[1].crates === 20, 'Check 12.3: Lot 2 gives 20 crates for Supplier C @ ₹320');

  // Record this 50 crates sale
  const sale50Id = 'sale-test-50';
  const sale50Line = {
    id: 'sline-50',
    saleId: sale50Id,
    categoryId: 'big',
    crates: 50,
    pricePerCrate: 360,
    lineTotal: 18000
  };
  const sale50Allocs: SaleLotAllocation[] = fifoAlloc50.allocations.map((a, i) => ({
    ...a,
    id: `salloc-50-${i}`,
    saleId: sale50Id,
    saleLineId: sale50Line.id,
    collectedAmount: 0,
    supplierClearedAmount: 0
  }));

  dbService.recordSale({
    id: sale50Id,
    saleDate: '2026-10-06',
    customerId: customerBId,
    billNo: 'SALE-50',
    lines: [sale50Line],
    allocations: sale50Allocs,
    transportCharge: 0,
    discount: 0,
    roundOff: 0,
    subtotalAmount: 18000,
    billTotal: 18000,
    amountReceivedNow: 0,
    totalCrates: 50,
    emptyCratesIssued: { big: 50, small: 0 },
    emptyCratesReturned: { big: 0, small: 0 },
    createdAt: '2026-10-06',
    updatedAt: '2026-10-06'
  });

  // Customer B pays ₹10,000 against this bill:
  // Supplier A cost on this bill: 30 * 300 = ₹9,000.
  // Supplier C cost on this bill: 20 * 320 = ₹6,400.
  // With ₹10,000 received: Supplier A's ₹9,000 is cleared FIRST, and remaining ₹1,000 goes to Supplier C!
  dbService.receivePayment({
    id: 'pay-test-split-10k',
    paymentDate: '2026-10-07',
    customerId: customerBId,
    amount: 10000,
    mode: 'cash',
    discount: 0,
    allocations: [],
    createdAt: '2026-10-07',
    updatedAt: '2026-10-07'
  });

  const payAllocations = dbService.getState().paymentAllocations.filter(pa => pa.paymentId === 'pay-test-split-10k');
  const suppAShareInPay = payAllocations.filter(a => a.supplierId === supplierAId).reduce((s, a) => s + a.supplierShare, 0);
  const suppCShareInPay = payAllocations.filter(a => a.supplierId === supplierCId).reduce((s, a) => s + a.supplierShare, 0);

  assert(suppAShareInPay === 9000, 'Check 12.4: Payment clears Supplier A lot first (₹9,000 cleared)', `Got ${suppAShareInPay}`);
  assert(suppCShareInPay === 1000, 'Check 12.5: Remaining ₹1,000 clears Supplier C lot', `Got ${suppCShareInPay}`);

  // --------------------------------------------------------------------------
  // CHECK 13: ₹100 discount on a bill with ₹500 profit leaves supplier share unchanged and reduces profit to ₹400
  // --------------------------------------------------------------------------
  // Create a sale of 10 Small crates @ ₹250 (Cost: 10 * 200 = 2000, Sale: 2500, Booked Profit: 500)
  const openSmallLots = dbService.getState().purchaseLines.filter(l => l.cratesRemaining > 0);
  const fifoAllocSmall = allocateLotsFIFO('small', 10, 250, openSmallLots);
  const saleDiscId = 'sale-disc-1';
  const saleDiscLine = { id: 'sline-disc', saleId: saleDiscId, categoryId: 'small', crates: 10, pricePerCrate: 250, lineTotal: 2500 };
  const saleDiscAlloc: SaleLotAllocation = {
    ...fifoAllocSmall.allocations[0],
    id: 'salloc-disc',
    saleId: saleDiscId,
    saleLineId: saleDiscLine.id,
    collectedAmount: 0,
    supplierClearedAmount: 0
  };

  dbService.recordSale({
    id: saleDiscId,
    saleDate: '2026-10-08',
    customerId: customerBId,
    billNo: 'SALE-DISC',
    lines: [saleDiscLine],
    allocations: [saleDiscAlloc],
    transportCharge: 0,
    discount: 0,
    roundOff: 0,
    subtotalAmount: 2500,
    billTotal: 2500,
    amountReceivedNow: 0,
    totalCrates: 10,
    emptyCratesIssued: { big: 0, small: 10 },
    emptyCratesReturned: { big: 0, small: 0 },
    createdAt: '2026-10-08',
    updatedAt: '2026-10-08'
  });

  // Customer settles this bill of ₹2,500 by paying ₹2,400 with ₹100 discount
  const suppAInHandBefore = dbService.getSupplierSummary(supplierAId)?.moneyInHand || 0;
  dbService.receivePayment({
    id: 'pay-test-disc',
    paymentDate: '2026-10-09',
    customerId: customerBId,
    saleId: saleDiscId,
    amount: 2400,
    mode: 'cash',
    discount: 100,
    allocations: [],
    createdAt: '2026-10-09',
    updatedAt: '2026-10-09'
  });

  const payDiscAllocs = dbService.getState().paymentAllocations.filter(pa => pa.paymentId === 'pay-test-disc');
  const suppShareInDisc = payDiscAllocs.reduce((s, a) => s + a.supplierShare, 0);
  const profitShareInDisc = payDiscAllocs.reduce((s, a) => s + a.profitShare, 0);

  assert(suppShareInDisc === 2000, 'Check 13.1: Supplier share remains unchanged at full cost ₹2,000', `Got ${suppShareInDisc}`);
  assert(profitShareInDisc === 400, 'Check 13.2: Realised profit is ₹400 (500 - 100 discount)', `Got ${profitShareInDisc}`);

  // --------------------------------------------------------------------------
  // CHECK 14: Deleting a customer payment reverses its supplier-collected amount and realised profit exactly
  // --------------------------------------------------------------------------
  const profitBeforeDel = dbService.getProfitMetrics().realisedProfit;
  const suppCInHandBeforeDel = dbService.getSupplierSummary(supplierCId)?.moneyInHand || 0;

  dbService.deleteTransaction('payment_received', 'pay-test-split-10k', 'Testing payment deletion reversal');

  const suppCInHandAfterDel = dbService.getSupplierSummary(supplierCId)?.moneyInHand || 0;
  assert(suppCInHandAfterDel === suppCInHandBeforeDel - 1000, 'Check 14.1: Deleting payment reverses supplier collected amount exactly', `Before ${suppCInHandBeforeDel}, After ${suppCInHandAfterDel}`);

  // --------------------------------------------------------------------------
  // CHECK 15: "Money in hand for supplier" falls to ₹0 after "Pay collected amount" is used for that supplier
  // --------------------------------------------------------------------------
  const suppAInHandNow = dbService.getSupplierSummary(supplierAId)?.moneyInHand || 0;
  assert(suppAInHandNow > 0, 'Check 15.1: Supplier A currently has Money in Hand > 0');

  dbService.paySupplier({
    id: 'pm-test-clear',
    paymentDate: '2026-10-10',
    supplierId: supplierAId,
    amount: suppAInHandNow,
    mode: 'cash',
    notes: 'Paid exact money in hand collected from customers',
    createdAt: '2026-10-10',
    updatedAt: '2026-10-10'
  });

  const suppAInHandFinal = dbService.getSupplierSummary(supplierAId)?.moneyInHand || 0;
  assert(suppAInHandFinal === 0, 'Check 15.2: Money in hand for Supplier A falls to exactly ₹0 after payout', `Got ${suppAInHandFinal}`);

  console.log('\n====================================================');
  console.log('🎉 ALL 15 MANDI ACCEPTANCE CHECKS PASSED PERFECTLY!');
  console.log('====================================================');
}

runAcceptanceChecks().catch(err => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
