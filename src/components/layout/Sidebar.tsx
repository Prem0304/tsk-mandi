// ============================================================================
// DESKTOP SIDEBAR & MOBILE "MORE" DRAWER
// All Mandi Modules: Suppliers, Customers, Crates, Rates, Cash Book, Reports, Settings, Audit
// ============================================================================

import React from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useAuth } from '../../context/AuthContext';
import { NavTab } from './BottomNav';
import {
  LayoutDashboard,
  ShoppingCart,
  Zap,
  Truck,
  BookOpen,
  Users,
  Building2,
  Box,
  TrendingUp,
  Receipt,
  Wallet,
  BarChart3,
  Settings,
  History,
  X,
  LogOut,
  Shield
} from 'lucide-react';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isOpenMobileMore: boolean;
  onCloseMobileMore: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpenMobileMore,
  onCloseMobileMore
}) => {
  const { t } = useI18n();
  const { role, setRole, canCreateSales, canSeeProfit } = useAuth();

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    onCloseMobileMore();
  };

  const navItems: { tab: NavTab; label: string; icon: React.ReactNode; ownerOnly?: boolean }[] = [
    { tab: 'dashboard', label: t('nav.dashboard'), icon: <LayoutDashboard className="w-5 h-5" /> },
    { tab: 'sale', label: t('nav.sale'), icon: <ShoppingCart className="w-5 h-5" />, ownerOnly: true },
    { tab: 'quickSale', label: t('nav.quickSale'), icon: <Zap className="w-5 h-5 text-amber-500" />, ownerOnly: true },
    { tab: 'purchase', label: t('nav.purchase'), icon: <Truck className="w-5 h-5" /> },
    { tab: 'passbook', label: t('nav.passbook'), icon: <BookOpen className="w-5 h-5" /> },
    { tab: 'customers', label: t('nav.customers'), icon: <Users className="w-5 h-5" /> },
    { tab: 'suppliers', label: t('nav.suppliers'), icon: <Building2 className="w-5 h-5" /> },
    { tab: 'crates', label: t('nav.crates'), icon: <Box className="w-5 h-5 text-emerald-600" /> },
    { tab: 'rates', label: t('nav.rates'), icon: <TrendingUp className="w-5 h-5 text-blue-600" /> },
    { tab: 'expenses', label: t('nav.expenses'), icon: <Receipt className="w-5 h-5 text-purple-600" /> },
    { tab: 'cashBook', label: t('nav.cashBook'), icon: <Wallet className="w-5 h-5 text-amber-600" /> },
    { tab: 'reports', label: t('nav.reports'), icon: <BarChart3 className="w-5 h-5 text-indigo-600" /> },
    { tab: 'settings', label: t('nav.settings'), icon: <Settings className="w-5 h-5 text-slate-600" /> },
    { tab: 'audit', label: t('nav.audit'), icon: <History className="w-5 h-5 text-slate-500" /> }
  ];

  const content = (
    <div className="flex flex-col h-full bg-white select-none">
      
      {/* Mobile drawer header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3.5 border-b border-slate-200 bg-rose-50/50">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-full bg-tomato flex items-center justify-center p-1">
            <img src="/tomato.svg" alt="TSK" className="w-5 h-5 object-contain" />
          </div>
          <span className="font-bold text-slate-900 text-sm">{t('nav.more')}</span>
        </div>
        <button
          onClick={onCloseMobileMore}
          className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {navItems.map(item => {
          if (item.ownerOnly && !canCreateSales) return null;

          const isActive = activeTab === item.tab;
          return (
            <button
              key={item.tab}
              onClick={() => handleNavClick(item.tab)}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all ${
                isActive
                  ? 'bg-tomato text-white font-bold shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200'
              }`}
            >
              <span className={isActive ? 'text-white' : ''}>{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Role Switcher in Sidebar (for testing and quick demo switches) */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/70">
        <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
          <Shield className="w-3.5 h-3.5 text-slate-500" />
          <span>{t('app.role')}</span>
        </div>
        <div className="grid grid-cols-3 gap-1 bg-slate-200/70 p-1 rounded-lg text-xs">
          <button
            onClick={() => setRole('owner')}
            className={`py-1 rounded font-medium text-[11px] transition-all ${
              role === 'owner' ? 'bg-white shadow text-tomato font-bold' : 'text-slate-600'
            }`}
          >
            {t('app.owner')}
          </button>
          <button
            onClick={() => setRole('entry_staff')}
            className={`py-1 rounded font-medium text-[11px] transition-all ${
              role === 'entry_staff' ? 'bg-white shadow text-tomato font-bold' : 'text-slate-600'
            }`}
          >
            {t('app.entryStaff')}
          </button>
          <button
            onClick={() => setRole('view_only')}
            className={`py-1 rounded font-medium text-[11px] transition-all ${
              role === 'view_only' ? 'bg-white shadow text-tomato font-bold' : 'text-slate-600'
            }`}
          >
            {t('app.viewOnly')}
          </button>
        </div>
      </div>

    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:block w-60 shrink-0 border-r border-slate-200 shadow-sm h-[calc(100vh-3.5rem)] sticky top-14">
        {content}
      </aside>

      {/* Mobile Drawer (When More clicked) */}
      {isOpenMobileMore && (
        <div className="fixed inset-0 z-50 md:hidden flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobileMore}
          />
          <div className="relative w-4/5 max-w-xs h-full shadow-2xl z-10 animate-in slide-in-from-right duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
