// ============================================================================
// MOBILE BOTTOM NAVIGATION (DASHBOARD | SALE | PURCHASE | PASSBOOK | MORE)
// Touch-optimized with large tap targets for mandi floor use
// ============================================================================

import React from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, ShoppingCart, Truck, BookOpen, Menu, Box } from 'lucide-react';

export type NavTab = 
  | 'dashboard' 
  | 'sale' 
  | 'quickSale' 
  | 'purchase' 
  | 'passbook' 
  | 'suppliers' 
  | 'customers' 
  | 'crates' 
  | 'rates' 
  | 'expenses' 
  | 'cashBook' 
  | 'reports' 
  | 'settings' 
  | 'audit';

interface BottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenMore: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onSelectTab, onOpenMore }) => {
  const { t } = useI18n();
  const { role, canCreateSales } = useAuth();

  const isMoreActive = ['suppliers', 'customers', 'crates', 'rates', 'expenses', 'cashBook', 'reports', 'settings', 'audit'].includes(activeTab);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg px-1 py-1 safe-area-pb">
      <div className="grid grid-cols-5 gap-1 items-center">
        
        {/* Dashboard */}
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all active:scale-95 ${
            activeTab === 'dashboard'
              ? 'text-tomato font-bold bg-rose-50'
              : 'text-slate-600 font-medium hover:text-slate-900'
          }`}
        >
          <LayoutDashboard className={`w-5 h-5 ${activeTab === 'dashboard' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          <span className="text-[11px] mt-0.5 tracking-tight truncate max-w-full">
            {t('nav.dashboard')}
          </span>
        </button>

        {/* Sale */}
        <button
          onClick={() => onSelectTab('sale')}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all active:scale-95 ${
            activeTab === 'sale'
              ? 'text-tomato font-bold bg-rose-50'
              : 'text-slate-600 font-medium hover:text-slate-900'
          }`}
        >
          <ShoppingCart className={`w-5 h-5 ${activeTab === 'sale' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          <span className="text-[11px] mt-0.5 tracking-tight truncate max-w-full">
            {t('nav.sale')}
          </span>
        </button>

        {/* Purchase (Owner Only) or Crates (Staff Mode) */}
        {role === 'owner' ? (
          <button
            onClick={() => onSelectTab('purchase')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all active:scale-95 ${
              activeTab === 'purchase'
                ? 'text-tomato font-bold bg-rose-50'
                : 'text-slate-600 font-medium hover:text-slate-900'
            }`}
          >
            <Truck className={`w-5 h-5 ${activeTab === 'purchase' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
            <span className="text-[11px] mt-0.5 tracking-tight truncate max-w-full">
              {t('nav.purchase')}
            </span>
          </button>
        ) : (
          <button
            onClick={() => onSelectTab('crates')}
            className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all active:scale-95 ${
              activeTab === 'crates'
                ? 'text-tomato font-bold bg-rose-50'
                : 'text-slate-600 font-medium hover:text-slate-900'
            }`}
          >
            <Box className={`w-5 h-5 ${activeTab === 'crates' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
            <span className="text-[11px] mt-0.5 tracking-tight truncate max-w-full">
              {t('nav.crates')}
            </span>
          </button>
        )}

        {/* Passbook */}
        <button
          onClick={() => onSelectTab('passbook')}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all active:scale-95 ${
            activeTab === 'passbook'
              ? 'text-tomato font-bold bg-rose-50'
              : 'text-slate-600 font-medium hover:text-slate-900'
          }`}
        >
          <BookOpen className={`w-5 h-5 ${activeTab === 'passbook' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          <span className="text-[11px] mt-0.5 tracking-tight truncate max-w-full">
            {t('nav.passbook')}
          </span>
        </button>

        {/* More Menu Drawer Trigger */}
        <button
          onClick={onOpenMore}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all active:scale-95 ${
            isMoreActive
              ? 'text-tomato font-bold bg-rose-50'
              : 'text-slate-600 font-medium hover:text-slate-900'
          }`}
        >
          <Menu className={`w-5 h-5 ${isMoreActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          <span className="text-[11px] mt-0.5 tracking-tight truncate max-w-full">
            {t('nav.more')}
          </span>
        </button>

      </div>
    </nav>
  );
};
