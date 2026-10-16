// ============================================================================
// ACTION / TRANSACTION MODIFICATION AUTHORIZATION MODAL (PASSWORD 2)
// Required whenever making a financial, stock or configuration change.
// Prompts for Password 2 (Modification Password) before committing transactions.
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/i18nContext';
import { ShieldCheck, Lock, AlertCircle, X, Check, Eye, EyeOff } from 'lucide-react';

export const ActionAuthModal: React.FC = () => {
  const { activeChallenge, cancelActionAuthorization, verifyAndExecuteAction } = useAuth();
  const { language } = useI18n();

  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeChallenge) {
      setPassword('');
      setError(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [activeChallenge]);

  if (!activeChallenge) return null;

  const handleDigit = (digit: string) => {
    const next = password + digit;
    setPassword(next);
    setError(false);
  };

  const handleDelete = () => {
    setPassword(prev => prev.slice(0, -1));
    setError(false);
  };

  const handleClear = () => {
    setPassword('');
    setError(false);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password) {
      setError(true);
      return;
    }

    const success = verifyAndExecuteAction(password);
    if (!success) {
      setError(true);
      setPassword('');
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/85 backdrop-blur-md flex items-center justify-center p-3 select-none">
      <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-5 py-3.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-amber-100" />
            <h3 className="font-black text-sm sm:text-base leading-tight">
              {language === 'ta' ? 'நடவடிக்கை உறுதிப்படுத்தல்' : 'Transaction Authorization'}
            </h3>
          </div>
          <button
            onClick={cancelActionAuthorization}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-3.5 text-center">
          
          {/* Action details badge */}
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3 text-left">
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              {language === 'ta' ? 'உறுதிப்படுத்த வேண்டிய செயல்:' : 'Action to authorize:'}
            </div>
            <div className="text-sm font-black text-slate-900 mt-0.5">
              {activeChallenge.actionName}
            </div>
            {activeChallenge.actionDetails && (
              <div className="text-xs font-semibold text-slate-600 mt-1">
                {activeChallenge.actionDetails}
              </div>
            )}
          </div>

          <div className="text-xs font-bold text-slate-700">
            {language === 'ta'
              ? 'மாற்றத்தை சேமிக்க Modification Password (கடவுச்சொல் 2) ஐ உள்ளிடவும்:'
              : 'Enter Modification Password (Password 2) to commit change:'}
          </div>

          {/* Form input */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative flex items-center justify-center">
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  setError(false);
                }}
                placeholder="••••"
                className={`w-48 h-12 text-center text-xl font-mono font-bold tracking-widest rounded-2xl border-2 px-3 focus:outline-none transition-all ${
                  error
                    ? 'border-rose-500 bg-rose-50 text-rose-900 animate-shake'
                    : 'border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 bg-slate-50'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-12 text-slate-400 hover:text-slate-600 p-1"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Error badge */}
            {error && (
              <div className="flex items-center justify-center space-x-1.5 text-xs text-rose-600 font-bold animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  {language === 'ta'
                    ? 'தவறான Modification Password!'
                    : 'Incorrect Modification Password!'}
                </span>
              </div>
            )}

            {/* Numeric Keypad for fast phone entry */}
            <div className="grid grid-cols-3 gap-2 pt-1 max-w-[240px] mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDigit(d)}
                  className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-amber-500 active:text-white text-slate-800 text-lg font-bold transition-all shadow-2xs active:scale-95"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold active:scale-95 transition-all"
              >
                C
              </button>
              <button
                type="button"
                onClick={() => handleDigit('0')}
                className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-amber-500 active:text-white text-slate-800 text-lg font-bold transition-all shadow-2xs active:scale-95"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold active:scale-95 transition-all"
              >
                ⌫
              </button>
            </div>

            {/* Actions: Cancel & Confirm */}
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={cancelActionAuthorization}
                className="h-11 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs active:scale-95 transition-all"
              >
                {language === 'ta' ? 'ரத்துசெய்' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="h-11 rounded-2xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-black text-xs shadow-md active:scale-95 transition-all flex items-center justify-center space-x-1"
              >
                <Check className="w-4 h-4" />
                <span>{language === 'ta' ? 'உறுதிப்படுத்து' : 'Authorize & Save'}</span>
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
};
