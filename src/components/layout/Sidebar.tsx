// ============================================================================
// DESKTOP SIDEBAR & MOBILE "MORE" DRAWER
// All Mandi Modules: Suppliers, Customers, Crates, Rates, Cash Book, Reports, Settings, Audit
// ============================================================================

import React, { useState } from 'react';
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
  Shield,
  Smartphone
} from 'lucide-react';
import { isStandaloneApp, isIosDevice } from '../common/IosInstallPrompt';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isOpenMobileMore: boolean;
  onCloseMobileMore: () => void;
  onOpenInstall?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpenMobileMore,
  onCloseMobileMore,
  onOpenInstall
}) => {
  const { t, language } = useI18n();
  const { role, switchToStaff, switchToOwner } = useAuth();
  const isStandalone = isStandaloneApp();
  const isIos = isIosDevice();

  const [showOwnerPinModal, setShowOwnerPinModal] = useState(false);
  const [ownerPinInput, setOwnerPinInput] = useState('');
  const [ownerPinError, setOwnerPinError] = useState(false);

  const handleOwnerPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (switchToOwner(ownerPinInput)) {
      setShowOwnerPinModal(false);
      setOwnerPinInput('');
      setOwnerPinError(false);
    } else {
      setOwnerPinError(true);
      setOwnerPinInput('');
    }
  };

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    onCloseMobileMore();
  };

  const navItems: { tab: NavTab; label: string; icon: React.ReactNode; ownerOnly?: boolean }[] = [
    { tab: 'dashboard', label: t('nav.dashboard'), icon: <LayoutDashboard className="w-5 h-5" /> },
    { tab: 'sale', label: t('nav.sale'), icon: <ShoppingCart className="w-5 h-5" /> },
    { tab: 'quickSale', label: t('nav.quickSale'), icon: <Zap className="w-5 h-5 text-amber-500" /> },
    { tab: 'purchase', label: t('nav.purchase'), icon: <Truck className="w-5 h-5" />, ownerOnly: true },
    { tab: 'passbook', label: t('nav.passbook'), icon: <BookOpen className="w-5 h-5" /> },
    { tab: 'customers', label: t('nav.customers'), icon: <Users className="w-5 h-5" /> },
    { tab: 'suppliers', label: t('nav.suppliers'), icon: <Building2 className="w-5 h-5" />, ownerOnly: true },
    { tab: 'crates', label: t('nav.crates'), icon: <Box className="w-5 h-5 text-emerald-600" /> },
    { tab: 'rates', label: t('nav.rates'), icon: <TrendingUp className="w-5 h-5 text-blue-600" /> },
    { tab: 'expenses', label: t('nav.expenses'), icon: <Receipt className="w-5 h-5 text-purple-600" /> },
    { tab: 'cashBook', label: t('nav.cashBook'), icon: <Wallet className="w-5 h-5 text-amber-600" /> },
    { tab: 'reports', label: t('nav.reports'), icon: <BarChart3 className="w-5 h-5 text-indigo-600" />, ownerOnly: true },
    { tab: 'settings', label: t('nav.settings'), icon: <Settings className="w-5 h-5 text-slate-600" />, ownerOnly: true },
    { tab: 'audit', label: t('nav.audit'), icon: <History className="w-5 h-5 text-slate-500" />, ownerOnly: true }
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
          if (item.ownerOnly && role !== 'owner') return null;

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

        {/* Install on iPhone / Mobile Button */}
        {!isStandalone && onOpenInstall && (
          <button
            onClick={() => {
              onCloseMobileMore();
              onOpenInstall();
            }}
            className="w-full mt-2 flex items-center space-x-3 px-3 py-2.5 rounded-xl font-bold text-xs bg-rose-50 text-tomato hover:bg-rose-100 border border-rose-200 transition-all active:scale-95"
          >
            <Smartphone className="w-5 h-5 text-tomato shrink-0" />
            <div className="text-left truncate">
              <div className="leading-tight">
                {isIos ? (language === 'ta' ? 'ஐபோனில் சேர்க்க' : 'Add to iPhone') : (language === 'ta' ? 'செயலியை நிறுவ' : 'Install App')}
              </div>
              <div className="text-[10px] text-slate-500 font-normal">
                {language === 'ta' ? 'முகப்புத் திரை குறுக்குவழி' : 'Add to Home Screen'}
              </div>
            </div>
          </button>
        )}
      </div>

      {/* 2-Role Active Switcher */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/70">
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span className="flex items-center space-x-1">
            <Shield className="w-3.5 h-3.5 text-slate-500" />
            <span>{t('app.role')}</span>
          </span>
          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase bg-slate-200 text-slate-700">
            {role === 'owner' ? '👑 Owner' : '👤 Staff'}
          </span>
        </div>

        {role === 'owner' ? (
          <button
            onClick={switchToStaff}
            className="w-full py-2 px-3 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-xs flex items-center justify-between border border-amber-300 active:scale-95 transition-all shadow-xs"
            title={language === 'ta' ? 'பணியாளர் முறைக்கு மாற்றுக' : 'Switch to Staff Mode (Profits hidden)'}
          >
            <span>👑 {language === 'ta' ? 'உரிமையாளர்' : 'Owner'}</span>
            <span className="text-[10px] bg-white/80 px-1.5 py-0.5 rounded font-black text-amber-900">→ Staff</span>
          </button>
        ) : (
          <button
            onClick={() => {
              setOwnerPinInput('');
              setOwnerPinError(false);
              setShowOwnerPinModal(true);
            }}
            className="w-full py-2 px-3 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-bold text-xs flex items-center justify-between border border-emerald-300 active:scale-95 transition-all shadow-xs"
            title={language === 'ta' ? 'உரிமையாளர் முறைக்கு மாற்றுக' : 'Unlock Owner Mode'}
          >
            <span>👤 {language === 'ta' ? 'பணியாளர்' : 'Staff'}</span>
            <span className="text-[10px] bg-white/80 px-1.5 py-0.5 rounded font-black text-emerald-900">Unlock Owner →</span>
          </button>
        )}
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
        <div className="fixed inset-0 z-40 md:hidden flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobileMore}
          />
          <div className="relative w-4/5 max-w-xs h-full shadow-2xl z-10 animate-in slide-in-from-right duration-200">
            {content}
          </div>
        </div>
      )}

      {/* Owner PIN Prompt Modal in Sidebar */}
      {showOwnerPinModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl text-slate-900 space-y-4 border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black">
                  👑
                </span>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    {language === 'ta' ? 'உரிமையாளர் அணுகல்' : 'Owner Access'}
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    {language === 'ta' ? 'Owner PIN உள்ளிடவும்' : 'Enter 4-Digit Owner PIN'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOwnerPinModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOwnerPinSubmit} className="space-y-3">
              <input
                type="password"
                maxLength={6}
                value={ownerPinInput}
                onChange={e => {
                  setOwnerPinInput(e.target.value);
                  setOwnerPinError(false);
                }}
                placeholder="••••"
                className="w-full h-12 text-center text-2xl font-mono font-black tracking-widest border border-slate-300 rounded-2xl bg-slate-50 focus:bg-white focus:border-amber-500 focus:outline-none"
                autoFocus
              />

              {ownerPinError && (
                <div className="text-center text-xs font-bold text-rose-600 animate-shake">
                  {language === 'ta' ? 'தவறான PIN! மீண்டும் முயற்சிக்கவும்' : 'Incorrect PIN! Try again.'}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowOwnerPinModal(false)}
                  className="py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  {language === 'ta' ? 'ரத்து' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs shadow-md transition-all active:scale-95"
                >
                  {language === 'ta' ? 'உள்நுழைக' : 'Unlock Owner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
