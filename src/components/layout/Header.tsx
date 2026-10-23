// ============================================================================
// HEADER COMPONENT (BRANDING, BILINGUAL TOGGLE, SYNC STATUS, PIN LOCK, SEARCH)
// ============================================================================

import React, { useState } from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { Lock, RefreshCw, Search, Shield, Globe, Wifi, WifiOff, Calendar, Smartphone, Coins, Eye, EyeOff, User, KeyRound, X } from 'lucide-react';
import { formatDateWithDay } from '../../lib/utils';
import { isStandaloneApp, isIosDevice } from '../common/IosInstallPrompt';

interface HeaderProps {
  onOpenSearch: () => void;
  onOpenInstall?: () => void;
  onOpenCollection?: () => void;
  isPrivacyMode?: boolean;
  onTogglePrivacy?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSearch,
  onOpenInstall,
  onOpenCollection,
  isPrivacyMode = false,
  onTogglePrivacy
}) => {
  const { language, setLanguage, t } = useI18n();
  const { role, lockApp, switchToStaff, switchToOwner } = useAuth();
  const { state, syncState, triggerManualSync } = useApp();
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

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ta' : 'en');
  };

  const shopName = language === 'ta' && state.settings.shopNameTa ? state.settings.shopNameTa : state.settings.shopName;

  return (
    <header className="sticky top-0 z-30 bg-tomato text-white shadow-md select-none safe-area-pt">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 h-14 flex items-center justify-between gap-1 sm:gap-2">
        
        {/* Brand & Mandi Name */}
        <div className="flex items-center space-x-2 overflow-hidden shrink min-w-0 max-w-[135px] xs:max-w-[170px] sm:max-w-none">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/15 flex items-center justify-center p-1 border border-white/20 shrink-0">
            <img src="/tomato.svg" alt="TSK Mandi" className="w-6 h-6 sm:w-7 sm:h-7 object-contain" />
          </div>
          <div className="truncate min-w-0">
            <h1 className="text-sm sm:text-base md:text-lg font-black tracking-tight leading-tight truncate">
              {shopName}
            </h1>
            <div className="flex items-center space-x-1 leading-none">
              <span className="text-[10px] sm:text-[11px] text-white/80 font-medium truncate">
                {t('app.subtitle')}
              </span>
              <span className="hidden md:hidden lg:inline text-[10px] text-amber-200 font-bold">
                • {formatDateWithDay(new Date(), language, true)}
              </span>
            </div>
          </div>
        </div>

        {/* Date and Day Center Badge (Desktop & Tablet) */}
        <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-black/20 border border-white/15 text-xs font-bold text-white tracking-wide shadow-xs shrink-0">
          <Calendar className="w-3.5 h-3.5 text-amber-300" />
          <span>{formatDateWithDay(new Date(), language, false)}</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
          
          {/* Quick Customer Collection (Shielded Mode) */}
          {onOpenCollection && (
            <button
              onClick={onOpenCollection}
              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white flex items-center space-x-1 font-black text-xs shadow-sm border border-emerald-400/50 transition-all shrink-0"
              title={language === 'ta' ? 'வாடிக்கையாளர் வசூல்' : 'Collect Money'}
            >
              <Coins className="w-3.5 h-3.5 text-emerald-100" />
              <span className="text-[11px] sm:text-xs">{language === 'ta' ? 'வசூல்' : 'Collect'}</span>
            </button>
          )}

          {/* Privacy Eye Toggle (Owner Only) */}
          {role === 'owner' && onTogglePrivacy && (
            <button
              onClick={onTogglePrivacy}
              className={`p-1.5 rounded-lg active:scale-95 transition-all border shrink-0 ${
                isPrivacyMode
                  ? 'bg-amber-400/30 border-amber-300 text-amber-200 shadow-inner'
                  : 'bg-white/10 hover:bg-white/20 border-white/15 text-white/90'
              }`}
              title={isPrivacyMode ? 'Privacy Shield ON (Profits masked)' : 'Privacy Shield OFF (Click to mask profits)'}
            >
              {isPrivacyMode ? <EyeOff className="w-4 h-4 text-amber-200" /> : <Eye className="w-4 h-4" />}
            </button>
          )}

          {/* Install on iPhone / Add to Home Screen Button (Desktop / Tablet only) */}
          {!isStandalone && onOpenInstall && (
            <button
              onClick={onOpenInstall}
              className="hidden md:flex px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 active:scale-95 transition-all text-white items-center space-x-1 border border-white/20 text-xs font-bold shrink-0"
              title={isIos ? (language === 'ta' ? 'ஐபோனில் சேர்க்க' : 'Add to iPhone') : (language === 'ta' ? 'பயன்பாட்டை நிறுவ' : 'Install App')}
            >
              <Smartphone className="w-3.5 h-3.5 text-amber-200" />
              <span>
                {isIos ? (language === 'ta' ? 'ஐபோனில் சேர்' : 'iPhone App') : (language === 'ta' ? 'நிறுவ' : 'Install')}
              </span>
            </button>
          )}

          {/* Global Search Button */}
          <button
            onClick={onOpenSearch}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white/90 shrink-0"
            title={t('common.search')}
          >
            <Search className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Sync Status Badge / Button (Tablet / Desktop only) */}
          <button
            onClick={triggerManualSync}
            className={`hidden sm:flex px-2 py-1 rounded-full text-xs font-medium items-center space-x-1 border transition-all shrink-0 ${
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
            <span>
              {syncState === 'synced' ? t('app.synced') : syncState === 'syncing' ? t('app.syncing') : t('app.offline')}
            </span>
          </button>

          {/* Language Toggle (English / தமிழ்) */}
          <button
            onClick={toggleLanguage}
            className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 border border-white/25 text-[11px] sm:text-xs font-bold tracking-wide active:scale-95 transition-all flex items-center space-x-1 shrink-0"
            title="Toggle Language / மொழியை மாற்றுக"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{language === 'en' ? 'தமிழ்' : 'English'}</span>
          </button>

          {/* 2-Role Active Badge & Quick Switcher */}
          {role === 'owner' ? (
            <button
              onClick={switchToStaff}
              className="flex items-center space-x-1 px-1.5 sm:px-2 py-1 rounded-lg bg-black/25 hover:bg-black/35 text-[10px] sm:text-[11px] font-black text-amber-200 border border-amber-300/40 active:scale-95 transition-all shadow-xs shrink-0"
              title={language === 'ta' ? 'பணியாளர் முறைக்கு மாற்றுக' : 'Switch to Staff Mode'}
            >
              <span>👑</span>
              <span className="hidden sm:inline">{language === 'ta' ? 'உரிமையாளர்' : 'Owner'}</span>
              <span className="text-[9px] bg-white/20 px-1 py-0.5 rounded font-bold">Staff</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setOwnerPinInput('');
                setOwnerPinError(false);
                setShowOwnerPinModal(true);
              }}
              className="flex items-center space-x-1 px-1.5 sm:px-2 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 text-[10px] sm:text-[11px] font-black text-emerald-200 border border-emerald-400/50 active:scale-95 transition-all shadow-xs shrink-0"
              title={language === 'ta' ? 'உரிமையாளர் முறைக்கு மாற்ற PIN உள்ளிடுக' : 'Unlock Owner Mode'}
            >
              <span>👤</span>
              <span className="hidden sm:inline">{language === 'ta' ? 'பணியாளர்' : 'Staff'}</span>
              <span className="text-[9px] bg-white/20 px-1 py-0.5 rounded font-bold">Owner</span>
            </button>
          )}

          {/* App Lock Button */}
          <button
            onClick={lockApp}
            className="p-1.5 rounded-lg bg-black/20 hover:bg-black/30 active:scale-95 text-white/90 transition-all border border-white/15 shrink-0"
            title={t('app.lockApp')}
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Owner PIN Prompt Modal for Switching from Staff to Owner */}
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
    </header>
  );
};
