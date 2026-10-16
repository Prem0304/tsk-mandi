// ============================================================================
// 4-DIGIT PIN LOCK MODAL WITH NUMERIC TOUCH KEYPAD
// Rapid phone unlock at the mandi floor
// ============================================================================

import React, { useState } from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useAuth } from '../../context/AuthContext';
import { Lock, Delete, AlertCircle } from 'lucide-react';

export const PinLockModal: React.FC = () => {
  const { isLocked, unlockWithPin } = useAuth();
  const { t, language } = useI18n();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (!isLocked) return null;

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(false);

      if (nextPin.length === 4) {
        setTimeout(() => {
          const success = unlockWithPin(nextPin);
          if (!success) {
            setError(true);
            setPin('');
          }
        }, 150);
      }
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  const handleClear = () => {
    setPin('');
    setError(false);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xs w-full shadow-2xl text-center border border-slate-200 animate-in zoom-in-95 duration-200">
        
        {/* Mandi icon */}
        <div className="w-16 h-16 rounded-full bg-rose-50 text-tomato mx-auto flex items-center justify-center mb-4 shadow-inner">
          <Lock className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-black text-slate-900 mb-1">
          {language === 'ta' ? 'பயன்பாட்டு அணுகல் கடவுச்சொல்' : 'App Access Password'}
        </h2>
        <p className="text-xs font-semibold text-slate-500 mb-6">
          T.S.K Tomato & Vegetable Mandi • (Password 1)
        </p>

        {/* 4 Pin Dots */}
        <div className="flex justify-center space-x-4 mb-6">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                pin.length > i
                  ? 'bg-tomato border-tomato scale-110'
                  : 'bg-slate-100 border-slate-300'
              }`}
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center justify-center space-x-1 text-xs text-rose-600 font-medium mb-4 animate-shake">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{t('app.incorrectPin')}</span>
          </div>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3 mb-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
            <button
              key={d}
              onClick={() => handleDigit(d)}
              className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-tomato active:text-white text-slate-800 text-2xl font-bold transition-all shadow-sm active:scale-95 border border-slate-200/80"
            >
              {d}
            </button>
          ))}
          <button
            onClick={handleClear}
            className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-500 text-sm font-semibold transition-all active:scale-95 border border-slate-200/80"
          >
            C
          </button>
          <button
            onClick={() => handleDigit('0')}
            className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-tomato active:text-white text-slate-800 text-2xl font-bold transition-all shadow-sm active:scale-95 border border-slate-200/80"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-600 flex items-center justify-center transition-all active:scale-95 border border-slate-200/80"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        <p className="text-[11px] text-slate-400 mt-2">
          Default PIN: 1234 (Configurable in Settings)
        </p>

      </div>
    </div>
  );
};
