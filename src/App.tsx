// ============================================================================
// ROOT APPLICATION COMPONENT
// TSK TOMATO AND VEGETABLE MANDI - PRODUCTION READY PWA
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useI18n } from './i18n/i18nContext';
import { useAuth } from './context/AuthContext';
import { useApp } from './context/AppContext';
import { dbService } from './lib/db';
import { Sale } from './types';

// Layout Components
import { Header } from './components/layout/Header';
import { BottomNav, NavTab } from './components/layout/BottomNav';
import { Sidebar } from './components/layout/Sidebar';
import { PinLockModal } from './components/layout/PinLockModal';
import { ActionAuthModal } from './components/common/ActionAuthModal';
import { GlobalSearchModal } from './components/layout/GlobalSearchModal';
import { IosInstallPrompt } from './components/common/IosInstallPrompt';

// Views
import { DashboardView } from './components/dashboard/DashboardView';
import { CustomerListView } from './components/customers/CustomerListView';
import { CustomerPassbookView } from './components/customers/CustomerPassbookView';
import { SupplierListView } from './components/suppliers/SupplierListView';
import { CrateManagementView } from './components/crates/CrateManagementView';
import { DailyRateBoardView } from './components/rates/DailyRateBoardView';
import { ExpenseListView } from './components/expenses/ExpenseListView';
import { CashBookView } from './components/cashbook/CashBookView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';
import { AuditLogView } from './components/audit/AuditLogView';

// Modals
import { SaleEntryModal } from './components/sales/SaleEntryModal';
import { QuickSaleModal } from './components/sales/QuickSaleModal';
import { BillPrintModal } from './components/sales/BillPrintModal';
import { PurchaseEntryModal } from './components/purchases/PurchaseEntryModal';
import { ReceivePaymentModal } from './components/payments/ReceivePaymentModal';
import { PaySupplierModal } from './components/payments/PaySupplierModal';
import { CustomerCollectionModal } from './components/payments/CustomerCollectionModal';

export const App: React.FC = () => {
  const { state } = useApp();
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isIosInstallOpen, setIsIosInstallOpen] = useState(false);

  // Counter Privacy Mode (shields profits on dashboard)
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);

  // Active Customer Passbook state (when a customer is clicked)
  const [selectedCustomerIdForPassbook, setSelectedCustomerIdForPassbook] = useState<string | null>(null);

  // Modals state
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isQuickSaleModalOpen, setIsQuickSaleModalOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isReceivePaymentModalOpen, setIsReceivePaymentModalOpen] = useState(false);
  const [isCustomerCollectionOpen, setIsCustomerCollectionOpen] = useState(false);
  const [isPaySupplierModalOpen, setIsPaySupplierModalOpen] = useState(false);
  const [activeSupplierIdForPay, setActiveSupplierIdForPay] = useState<string | undefined>(undefined);
  const [activeCustomerIdForPay, setActiveCustomerIdForPay] = useState<string | undefined>(undefined);
  const [activeCustomerIdForCollection, setActiveCustomerIdForCollection] = useState<string | undefined>(undefined);

  // Bill print modal after sale is saved
  const [printedSale, setPrintedSale] = useState<Sale | null>(null);
  const [isBillPrintModalOpen, setIsBillPrintModalOpen] = useState(false);

  // Auto-seed initial demo mandi data if completely fresh state
  useEffect(() => {
    if (state.suppliers.length === 0 && state.customers.length === 0 && state.purchases.length === 0) {
      dbService.loadSampleData();
    }
  }, []);

  const handleSaleSaved = (newSale: Sale) => {
    setPrintedSale(newSale);
    setIsBillPrintModalOpen(true);
  };

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerIdForPassbook(customerId);
    setActiveTab('passbook');
  };

  const handleSelectSupplier = (supplierId: string) => {
    setActiveSupplierIdForPay(supplierId);
    setActiveTab('suppliers');
  };

  const handleSelectSaleBill = (sale: Sale) => {
    setPrintedSale(sale);
    setIsBillPrintModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* Sticky Header with iOS safe area support */}
      <Header
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenInstall={() => setIsIosInstallOpen(true)}
        onOpenCollection={() => {
          setActiveCustomerIdForCollection(undefined);
          setIsCustomerCollectionOpen(true);
        }}
        isPrivacyMode={isPrivacyMode}
        onTogglePrivacy={() => setIsPrivacyMode(!isPrivacyMode)}
      />

      {/* Main Content Area: Sidebar on Desktop + View Body */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        
        {/* Desktop Sidebar & Mobile Drawer */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            if (tab === 'passbook' && !selectedCustomerIdForPassbook && state.customers.length > 0) {
              setSelectedCustomerIdForPassbook(state.customers[0].id);
            }
          }}
          isOpenMobileMore={isMobileMoreOpen}
          onCloseMobileMore={() => setIsMobileMoreOpen(false)}
          onOpenInstall={() => setIsIosInstallOpen(true)}
        />

        {/* View Switcher Container with iPhone safe area padding */}
        <main className="flex-1 overflow-x-hidden min-w-0 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-6">
          {activeTab === 'dashboard' && (
            <DashboardView
              onOpenSale={() => setIsSaleModalOpen(true)}
              onOpenQuickSale={() => setIsQuickSaleModalOpen(true)}
              onOpenPurchase={() => setIsPurchaseModalOpen(true)}
              onOpenReceivePayment={() => {
                setActiveCustomerIdForPay(undefined);
                setIsReceivePaymentModalOpen(true);
              }}
              onOpenPaySupplier={() => {
                setActiveSupplierIdForPay(undefined);
                setIsPaySupplierModalOpen(true);
              }}
              onOpenCrateReturn={() => setActiveTab('crates')}
              onOpenExpense={() => setActiveTab('expenses')}
              onSelectCustomer={handleSelectCustomer}
              onSelectSupplier={handleSelectSupplier}
              onOpenCollection={() => {
                setActiveCustomerIdForCollection(undefined);
                setIsCustomerCollectionOpen(true);
              }}
              isPrivacyMode={isPrivacyMode}
              onTogglePrivacy={() => setIsPrivacyMode(!isPrivacyMode)}
            />
          )}

          {activeTab === 'sale' && (
            <div className="p-4">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm text-center space-y-4 max-w-md mx-auto my-8">
                <h3 className="text-lg font-bold text-slate-900">New Sale Entry</h3>
                <p className="text-xs text-slate-500">Assign tomato crates to customer with FIFO lot allocation</p>
                <button
                  onClick={() => setIsSaleModalOpen(true)}
                  className="px-6 py-3 bg-tomato hover:bg-rose-700 text-white font-black text-sm rounded-2xl shadow-lg active:scale-95 transition-all"
                >
                  Open Sale Entry Modal
                </button>
              </div>
            </div>
          )}

          {activeTab === 'quickSale' && (
            <div className="p-4">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm text-center space-y-4 max-w-md mx-auto my-8">
                <h3 className="text-lg font-bold text-slate-900">Quick Sale Mode</h3>
                <p className="text-xs text-slate-500">Rapid single-screen entry for busy mandi rush</p>
                <button
                  onClick={() => setIsQuickSaleModalOpen(true)}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-black text-sm rounded-2xl shadow-lg active:scale-95 transition-all"
                >
                  Open Quick Sale Screen
                </button>
              </div>
            </div>
          )}

          {activeTab === 'purchase' && (
            role === 'owner' ? (
              <div className="p-4">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm text-center space-y-4 max-w-md mx-auto my-8">
                  <h3 className="text-lg font-bold text-slate-900">Stock Inward Purchase</h3>
                  <p className="text-xs text-slate-500">Record fresh crate arrivals, transport charges, and create stock lots</p>
                  <button
                    onClick={() => setIsPurchaseModalOpen(true)}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-2xl shadow-lg active:scale-95 transition-all"
                  >
                    Open Purchase Entry Modal
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 max-w-md mx-auto my-12 bg-white rounded-3xl border border-slate-200 shadow-sm text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto text-xl font-bold">
                  👑
                </div>
                <h3 className="text-base font-extrabold text-slate-900">Owner Access Required</h3>
                <p className="text-xs text-slate-500">Inward stock purchase is restricted to the shop owner.</p>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="px-4 py-2 bg-tomato text-white text-xs font-bold rounded-xl active:scale-95 transition-all shadow-sm"
                >
                  Return to Dashboard
                </button>
              </div>
            )
          )}

          {activeTab === 'passbook' && (
            selectedCustomerIdForPassbook ? (
              <CustomerPassbookView
                customerId={selectedCustomerIdForPassbook}
                onBack={() => {
                  setSelectedCustomerIdForPassbook(null);
                  setActiveTab('customers');
                }}
                onOpenReceivePayment={(cId) => {
                  setActiveCustomerIdForCollection(cId);
                  setIsCustomerCollectionOpen(true);
                }}
              />
            ) : (
              <CustomerListView onSelectCustomer={handleSelectCustomer} />
            )
          )}

          {activeTab === 'customers' && (
            <CustomerListView onSelectCustomer={handleSelectCustomer} />
          )}

          {activeTab === 'suppliers' && (
            role === 'owner' ? (
              <SupplierListView
                onOpenPaySupplier={(sId) => {
                  setActiveSupplierIdForPay(sId);
                  setIsPaySupplierModalOpen(true);
                }}
              />
            ) : (
              <div className="p-6 max-w-md mx-auto my-12 bg-white rounded-3xl border border-slate-200 shadow-sm text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto text-xl font-bold">
                  👑
                </div>
                <h3 className="text-base font-extrabold text-slate-900">Owner Access Required</h3>
                <p className="text-xs text-slate-500">Supplier accounts and payouts are restricted to the shop owner.</p>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="px-4 py-2 bg-tomato text-white text-xs font-bold rounded-xl active:scale-95 transition-all shadow-sm"
                >
                  Return to Dashboard
                </button>
              </div>
            )
          )}

          {activeTab === 'crates' && (
            <CrateManagementView />
          )}

          {activeTab === 'rates' && (
            <DailyRateBoardView />
          )}

          {activeTab === 'expenses' && (
            <ExpenseListView />
          )}

          {activeTab === 'cashBook' && (
            <CashBookView />
          )}

          {activeTab === 'reports' && (
            role === 'owner' ? (
              <ReportsView />
            ) : (
              <div className="p-6 max-w-md mx-auto my-12 bg-white rounded-3xl border border-slate-200 shadow-sm text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto text-xl font-bold">
                  👑
                </div>
                <h3 className="text-base font-extrabold text-slate-900">Owner Access Required</h3>
                <p className="text-xs text-slate-500">Financial P&L reports are restricted to the shop owner.</p>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="px-4 py-2 bg-tomato text-white text-xs font-bold rounded-xl active:scale-95 transition-all shadow-sm"
                >
                  Return to Dashboard
                </button>
              </div>
            )
          )}

          {activeTab === 'settings' && (
            role === 'owner' ? (
              <SettingsView />
            ) : (
              <div className="p-6 max-w-md mx-auto my-12 bg-white rounded-3xl border border-slate-200 shadow-sm text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto text-xl font-bold">
                  👑
                </div>
                <h3 className="text-base font-extrabold text-slate-900">Owner Access Required</h3>
                <p className="text-xs text-slate-500">Shop settings and password configurations are restricted to the shop owner.</p>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="px-4 py-2 bg-tomato text-white text-xs font-bold rounded-xl active:scale-95 transition-all shadow-sm"
                >
                  Return to Dashboard
                </button>
              </div>
            )
          )}

          {activeTab === 'audit' && (
            role === 'owner' ? (
              <AuditLogView />
            ) : (
              <div className="p-6 max-w-md mx-auto my-12 bg-white rounded-3xl border border-slate-200 shadow-sm text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto text-xl font-bold">
                  👑
                </div>
                <h3 className="text-base font-extrabold text-slate-900">Owner Access Required</h3>
                <p className="text-xs text-slate-500">Security audit logs are restricted to the shop owner.</p>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="px-4 py-2 bg-tomato text-white text-xs font-bold rounded-xl active:scale-95 transition-all shadow-sm"
                >
                  Return to Dashboard
                </button>
              </div>
            )
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'sale') setIsSaleModalOpen(true);
          if (tab === 'purchase') setIsPurchaseModalOpen(true);
          if (tab === 'passbook' && !selectedCustomerIdForPassbook && state.customers.length > 0) {
            setSelectedCustomerIdForPassbook(state.customers[0].id);
          }
        }}
        onOpenMore={() => setIsMobileMoreOpen(true)}
      />

      {/* Layer 1: Operational Base Modals (z-50) */}
      <SaleEntryModal
        isOpen={isSaleModalOpen}
        onClose={() => setIsSaleModalOpen(false)}
        onSaleSaved={handleSaleSaved}
      />

      <QuickSaleModal
        isOpen={isQuickSaleModalOpen}
        onClose={() => setIsQuickSaleModalOpen(false)}
        onSaleSaved={handleSaleSaved}
      />

      <PurchaseEntryModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        onPurchaseSaved={() => {}}
      />

      <ReceivePaymentModal
        isOpen={isReceivePaymentModalOpen}
        onClose={() => setIsReceivePaymentModalOpen(false)}
        defaultCustomerId={activeCustomerIdForPay}
      />

      {/* Shielded Customer Collection Modal (Zero Profit/Cost Visible) */}
      <CustomerCollectionModal
        isOpen={isCustomerCollectionOpen}
        onClose={() => setIsCustomerCollectionOpen(false)}
        defaultCustomerId={activeCustomerIdForCollection}
      />

      <PaySupplierModal
        isOpen={isPaySupplierModalOpen}
        onClose={() => setIsPaySupplierModalOpen(false)}
        defaultSupplierId={activeSupplierIdForPay}
      />

      {/* Layer 2: Secondary / Search / Print Modals (z-[60]) */}
      <BillPrintModal
        isOpen={isBillPrintModalOpen}
        onClose={() => setIsBillPrintModalOpen(false)}
        sale={printedSale}
      />

      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectCustomer={handleSelectCustomer}
        onSelectSupplier={handleSelectSupplier}
        onSelectSaleBill={handleSelectSaleBill}
      />

      {/* Layer 3: Transaction Modification Authorization (Password 2, z-[80]) */}
      <ActionAuthModal />

      {/* Layer 4: Master App PIN Screen Lock (Password 1, z-[100]) */}
      <PinLockModal />

      {/* iPhone / iOS Home Screen Install Helper Prompt & Modal */}
      <IosInstallPrompt
        forceOpen={isIosInstallOpen}
        onCloseForce={() => setIsIosInstallOpen(false)}
      />

    </div>
  );
};
