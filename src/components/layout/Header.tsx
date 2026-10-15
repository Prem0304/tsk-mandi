// ============================================================================
// HEADER COMPONENT (BRANDING, BILINGUAL TOGGLE, SYNC STATUS, PIN LOCK, SEARCH)
// ============================================================================

import React from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { Lock, RefreshCw, Search, Shield, Globe, Wifi, WifiOff } from 'lucide-react';

interface HeaderProps {
  onOpenSearch: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSearch }) => {
  const { language, setLanguage, t } = useI18n();
  const { role, lockApp } = useAuth();
  const { state, syncState, triggerManualSync } = useApp();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ta' : 'en');
  };

  const shopName = language === 'ta' && state.settings.shopNameTa ? state.settings.shopNameTa : state.settings.shopName;

  return (
    <header className="sticky top-0 z-30 bg-tomato text-white shadow-md select-none">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between">
        
        {/* Brand & Mandi Name */}
        <div className="flex items-center space-x-2.5 overflow-hidden">
          <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center p-1 border border-white/20 shrink-0">
            <img src="/tomato.svg" alt="TSK Mandi" className="w-7 h-7 object-contain" />
          </div>
          <div className="truncate">
            <h1 className="text-base sm:text-lg font-bold tracking-tight leading-tight truncate">
              {shopName}
            </h1>
            <p className="text-[11px] text-white/80 font-medium leading-none truncate">
              {t('app.subtitle')}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          
          {/* Global Search Button */}
          <button
            onClick={onOpenSearch}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white/90"
            title={t('common.search')}
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Sync Status Badge / Button */}
          <button
            onClick={triggerManualSync}
            className={`px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 border transition-all ${
              syncState === 'synced'
                ? 'bg-emerald-500/20 border-emerald-300 text-emerald-100 hover:bg-emerald-500/30'
                : syncState === 'syncing'
                ? 'bg-amber-500/20 border-amber-300 text-amber-100 animate-pulse'
                : 'bg-rose-950/60 border-rose-300 text-rose-200'
            }`}
            title="Click to sync"
          >
            {syncState === 'synced' && <Wifi className="w-3.5 h-3.5 text-emerald-300" />}
            {syncState === 'syncing' && <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-300" />}
            {syncState === 'offline' && <WifiOff className="w-3.5 h-3.5 text-rose-300" />}
            <span className="hidden sm:inline">
              {syncState === 'synced' ? t('app.synced') : syncState === 'syncing' ? t('app.syncing') : t('app.offline')}
            </span>
          </button>

          {/* Language Toggle (English / தமிழ்) */}
          <button
            onClick={toggleLanguage}
            className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 border border-white/25 text-xs font-bold tracking-wide active:scale-95 transition-all flex items-center space-x-1"
            title="Toggle Language / மொழியை மாற்றுக"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{language === 'en' ? 'தமிழ்' : 'English'}</span>
          </button>

          {/* Role Badge */}
          <div className="hidden md:flex items-center space-x-1 px-2 py-0.5 rounded bg-black/20 text-[11px] font-semibold text-white/90 border border-white/10">
            <Shield className="w-3 h-3 text-amber-300" />
            <span className="capitalize">{role === 'owner' ? t('app.owner') : role === 'entry_staff' ? t('app.entryStaff') : t('app.viewOnly')}</span>
          </div>

          {/* App Lock Button */}
          <button
            onClick={lockApp}
            className="p-1.5 rounded-lg bg-black/20 hover:bg-black/30 active:scale-95 text-white/90 transition-all border border-white/15"
            title={t('app.lockApp')}
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
};
