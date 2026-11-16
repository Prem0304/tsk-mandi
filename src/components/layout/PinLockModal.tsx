// ============================================================================
// SINGLE LOGIN MODAL (ADMIN & STAFF UNIFIED PORTAL ENTRY)
// Typeable keyboard input (not virtual touch buttons)
// Entering Admin Password -> Enters Admin/Owner Portal (full profits & settings)
// Entering Staff Password -> Enters Staff Portal (sales, counter billing & crates)
// ============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { dbService } from '../../lib/db';
import { Lock, LogIn, Eye, EyeOff, AlertCircle, Globe, CheckCircle2 } from 'lucide-react';

export const PinLockModal: React.FC = () => {
  const { isLocked, unlockWithPassword } = useAuth();
  const { language, setLanguage } = useI18n();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [successRole, setSuccessRole] = useState<UserRole | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input whenever locked
  useEffect(() => {
    if (isLocked) {
      setPassword('');
      setError(false);
      setSuccessRole(null);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isLocked]);

  if (!isLocked) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(false);

    if (!password.trim()) {
      setError(true);
      inputRef.current?.focus();
      return;
    }

    const result = unlockWithPassword(password);
    if (result.success && result.role) {
      setSuccessRole(result.role);
    } else {
      setError(true);
      setPassword('');
      inputRef.current?.focus();
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'ta' ? 'en' : 'ta');
  };

  const settings = dbService.getState().settings;
  const shopName = language === 'ta' && settings.shopNameTa ? settings.shopNameTa : (settings.shopName || 'T.S.K Tomato Mandi');
  const god1 = language === 'ta' && settings.godName1Ta ? settings.godName1Ta : (settings.godName1 || 'ஸ்ரீ வலகுருநாதன் துணை');
  const god2 = language === 'ta' && settings.godName2Ta ? settings.godName2Ta : (settings.godName2 || 'ஸ்ரீ அங்காளஈஸ்வரி துணை');

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-4 safe-area-pt safe-area-pb">
      <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        
        {/* Top Devotional Header */}
        <div className="bg-gradient-to-r from-tomato via-rose-600 to-amber-600 px-4 py-2.5 text-white flex items-center justify-between shadow-xs">
          <div className="text-[10px] font-black tracking-wide truncate max-w-[240px]">
            {god1} • {god2}
          </div>
          
          {/* Language Switcher */}
          <button
            type="button"
            onClick={toggleLanguage}
            className="flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-black/20 hover:bg-black/30 text-[10px] font-black border border-white/20 active:scale-95 transition-all"
            title="Toggle Language / மொழியை மாற்றுக"
          >
            <Globe className="w-3 h-3" />
            <span>{language === 'ta' ? 'English' : 'தமிழ்'}</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4 text-center">
          
          {/* Brand Icon & Title */}
          <div>
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-tomato mx-auto flex items-center justify-center mb-2 shadow-inner">
              <Lock className="w-7 h-7" />
            </div>
            
            <h2 className="text-lg font-black text-slate-900 leading-tight">
              {shopName}
            </h2>
            <p className="text-xs font-bold text-slate-500 mt-0.5">
              {language === 'ta' ? 'ஒருங்கிணைந்த மண்டி உள்நுழைவு' : 'Single Mandi Login Portal'}
            </p>
          </div>

          {/* Success Banner when logged in */}
          {successRole && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3 text-emerald-800 text-xs font-black flex items-center justify-center space-x-2 animate-in zoom-in-95">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                {successRole === 'owner'
                  ? (language === 'ta' ? '👑 உரிமையாளர் போர்டல் திறக்கப்பட்டது!' : '👑 Admin Portal Unlocked!')
                  : (language === 'ta' ? '👤 பணியாளர் போர்டல் திறக்கப்பட்டது!' : '👤 Staff Portal Unlocked!')}
              </span>
            </div>
          )}

          {/* Typeable Password Input Form */}
          <form onSubmit={handleSubmit} className="space-y-3 pt-1">
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-bold text-slate-700 block">
                {language === 'ta' ? 'கடவுச்சொல் உள்ளிடவும் (Type Password):' : 'Enter Password (Type using Keyboard):'}
              </label>

              <div className="relative flex items-center">
                <input
                  ref={inputRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    setError(false);
                  }}
                  placeholder={language === 'ta' ? 'கடவுச்சொல்லை டைப் செய்க...' : 'Type password...'}
                  autoFocus
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className={`w-full h-13 pl-4 pr-11 text-center text-xl font-mono font-black tracking-wider rounded-2xl border-2 bg-slate-50 focus:bg-white transition-all outline-none ${
                    error
                      ? 'border-rose-500 bg-rose-50/50 text-rose-900 animate-shake'
                      : 'border-slate-300 focus:border-tomato focus:ring-4 focus:ring-rose-100 text-slate-900'
                  }`}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 p-1.5 text-slate-400 hover:text-slate-700 active:scale-95 transition-all"
                  tabIndex={-1}
                  title={showPassword ? 'Hide' : 'Show'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center justify-center space-x-1.5 text-xs text-rose-600 font-bold bg-rose-50 py-1.5 px-3 rounded-xl border border-rose-200 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  {language === 'ta'
                    ? 'தவறான கடவுச்சொல்! (மீண்டும் முயற்சிக்கவும்)'
                    : 'Incorrect password! Please try again.'}
                </span>
              </div>
            )}

            {/* Type to Login Submit Button */}
            <button
              type="submit"
              className="w-full h-12 bg-tomato hover:bg-rose-700 active:scale-98 text-white font-black text-sm rounded-2xl shadow-lg shadow-rose-900/20 transition-all flex items-center justify-center space-x-2 mt-2"
            >
              <LogIn className="w-4 h-4" />
              <span>{language === 'ta' ? 'உள்நுழை (Login)' : 'Login to Portal'}</span>
            </button>
          </form>

        </div>

      </div>
    </div>
  );
};
