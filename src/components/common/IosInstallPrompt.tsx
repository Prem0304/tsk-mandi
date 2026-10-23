// ============================================================================
// IOS INSTALL ON IPHONE & HOME SCREEN PWA HELPER COMPONENT
// Guides iPhone and iPad Safari users through "Add to Home Screen"
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/i18nContext';
import {
  Share,
  PlusSquare,
  Smartphone,
  X,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  WifiOff,
  Zap,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

export interface IosInstallProps {
  forceOpen?: boolean;
  onCloseForce?: () => void;
}

export function isIosDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  return isIos;
}

export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;
  const isStandalone = (window.navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  return isStandalone;
}

export function isSafariBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|OPiOS|mercury|EdgiOS/i.test(ua);
  return isSafari;
}

export const IosInstallPrompt: React.FC<IosInstallProps> = ({ forceOpen = false, onCloseForce }) => {
  const { language } = useI18n();
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isSafari, setIsSafari] = useState(true);
  const [isBannerDismissed, setIsBannerDismissed] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const ios = isIosDevice();
    const standalone = isStandaloneApp();
    const safari = isSafariBrowser();

    setIsIos(ios);
    setIsStandalone(standalone);
    setIsSafari(safari);

    // Check if dismissed previously within the last 7 days
    const dismissedTime = localStorage.getItem('tsk_ios_prompt_dismissed');
    if (!dismissedTime) {
      setIsBannerDismissed(false);
    } else {
      const days = (Date.now() - parseInt(dismissedTime, 10)) / (1000 * 60 * 60 * 24);
      if (days > 7) {
        setIsBannerDismissed(false);
      }
    }
  }, []);

  useEffect(() => {
    if (forceOpen) {
      setIsModalOpen(true);
    }
  }, [forceOpen]);

  const handleDismissBanner = () => {
    setIsBannerDismissed(true);
    localStorage.setItem('tsk_ios_prompt_dismissed', Date.now().toString());
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    if (onCloseForce) onCloseForce();
  };

  // If already installed on iPhone as standalone, do not show banner
  const showBanner = !forceOpen && isIos && !isStandalone && !isBannerDismissed;

  return (
    <>
      {/* FLOATING SMART BANNER FOR IPHONE BROWSERS */}
      {showBanner && (
        <div className="fixed bottom-16 md:bottom-4 left-3 right-3 sm:left-auto sm:right-4 sm:max-w-md z-40 animate-in slide-in-from-bottom duration-300">
          <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3 overflow-hidden">
              <img
                src="/apple-touch-icon.png"
                alt="TSK Mandi"
                className="w-11 h-11 rounded-xl shadow-md border border-white/20 shrink-0"
              />
              <div className="truncate">
                <div className="flex items-center space-x-1.5">
                  <h4 className="font-extrabold text-sm text-white tracking-tight leading-tight truncate">
                    TSK Mandi
                  </h4>
                  <span className="bg-tomato text-white text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase">
                    iPhone
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 truncate mt-0.5">
                  {language === 'ta'
                    ? 'ஐபோன் முகப்புத் திரையில் சேர்க்கலாம்'
                    : 'Add to your iPhone Home Screen'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1 shrink-0">
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-tomato hover:bg-rose-700 active:scale-95 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-md transition-all flex items-center space-x-1"
              >
                <span>{language === 'ta' ? 'சேர்க்க' : 'Add'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDismissBanner}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP-BY-STEP INSTALL GUIDE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 select-none animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-tomato to-rose-700 text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-white p-1 shadow-lg shrink-0">
                  <img
                    src="/apple-touch-icon.png"
                    alt="TSK Mandi"
                    className="w-full h-full object-contain rounded-xl"
                  />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg leading-tight">
                    {language === 'ta' ? 'ஐபோனில் நிறுவுதல்' : 'Add to iPhone Home Screen'}
                  </h3>
                  <p className="text-xs text-rose-100 font-medium">
                    T.S.K Tomato Mandi PWA
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-slate-800 text-xs">
              
              {/* If opened on iPhone inside Chrome or WhatsApp in-app browser */}
              {isIos && !isSafari && (
                <div className="bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded-2xl space-y-1">
                  <div className="font-extrabold flex items-center space-x-1.5 text-xs">
                    <ExternalLink className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      {language === 'ta' ? 'சஃபாரி (Safari) உலாவியில் திறக்கவும்' : 'Open in Safari Browser First'}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-800">
                    {language === 'ta'
                      ? 'ஆப்பிள் விதிகளின்படி, ஐபோன் முகப்புத் திரையில் சேர்க்க Safari உலாவியில் திறக்க வேண்டும். பகிர் பொத்தானை அழுத்தி "Open in Safari" என்பதைத் தேர்ந்தெடுக்கவும்.'
                      : 'Apple requires Safari to add apps to the iPhone Home Screen. Tap your browser menu or share icon and select "Open in Safari".'}
                  </p>
                </div>
              )}

              {/* 3 Step Visual Guide */}
              <div className="space-y-3">
                <div className="font-black text-slate-900 text-xs uppercase tracking-wider">
                  {language === 'ta' ? '3 எளிய படிகள்:' : 'Follow these 3 simple steps:'}
                </div>

                {/* Step 1 */}
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl flex items-start space-x-3">
                  <div className="w-7 h-7 rounded-full bg-tomato text-white flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="font-extrabold text-slate-900 text-sm flex items-center space-x-1.5">
                      <span>{language === 'ta' ? 'பகிர் பொத்தானைத் தட்டவும்' : 'Tap the Share Button'}</span>
                      <span className="p-1 rounded bg-blue-100 text-blue-700 inline-flex items-center justify-center">
                        <Share className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      {language === 'ta'
                        ? 'சஃபாரியின் கீழ் பகுதியில் உள்ள பகிர்வு பொத்தானைத் (Share icon) தொடவும்.'
                        : 'Tap the Share icon (the square with an arrow pointing upward) in the bottom toolbar of Safari.'}
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl flex items-start space-x-3">
                  <div className="w-7 h-7 rounded-full bg-tomato text-white flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="font-extrabold text-slate-900 text-sm flex items-center space-x-1.5">
                      <span>{language === 'ta' ? '"முகப்புத் திரையில் சேர்" என்பதைத் தட்டவும்' : 'Tap "Add to Home Screen"'}</span>
                      <span className="p-1 rounded bg-slate-200 text-slate-800 inline-flex items-center justify-center">
                        <PlusSquare className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      {language === 'ta'
                        ? 'கீழே உருட்டி "Add to Home Screen" (முகப்புத் திரையில் சேர்) என்ற விருப்பத்தைத் தேர்ந்தெடுக்கவும்.'
                        : 'Scroll down the share sheet and tap "Add to Home Screen".'}
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl flex items-start space-x-3">
                  <div className="w-7 h-7 rounded-full bg-tomato text-white flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="font-extrabold text-slate-900 text-sm flex items-center space-x-1.5">
                      <span>{language === 'ta' ? 'மேல் வலதுபுறம் "Add" என்பதைத் தொடவும்' : 'Tap "Add" in Top Right'}</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-black text-[10px]">
                        Add
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      {language === 'ta'
                        ? 'மேல் வலது மூலையில் உள்ள "Add" என்பதை அழுத்தவும். TSK மண்டி ஆப் உங்கள் ஐபோன் திரையில் தோன்றும்!'
                        : 'Confirm by tapping "Add" in the top-right corner. The TSK Mandi app will now appear on your iPhone home screen!'}
                    </p>
                  </div>
                </div>

              </div>

              {/* App Benefits List */}
              <div className="bg-rose-50/60 border border-rose-200/80 p-3.5 rounded-2xl space-y-2">
                <div className="font-black text-slate-900 text-xs flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-tomato" />
                  <span>{language === 'ta' ? 'ஐபோனில் சேர்ப்பதன் நன்மைகள்:' : 'Why Add to iPhone Home Screen?'}</span>
                </div>
                <ul className="space-y-1.5 text-[11px] text-slate-700 font-medium">
                  <li className="flex items-center space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{language === 'ta' ? 'இணையம் இல்லாமல் ஆஃப்லைனிலும் வேலை செய்யும்' : 'Works 100% offline at the mandi floor'}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>{language === 'ta' ? 'முழுத் திரை அனுபவம் (உலாவி பட்டை இன்றி)' : 'Full-screen app mode with no browser URL bar'}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>{language === 'ta' ? 'இரு அடுக்கு கடவுச்சொல் பாதுகாப்பு மற்றும் உடனடி திறப்பு' : 'Dual-password protection with rapid PIN unlock'}</span>
                  </li>
                </ul>
              </div>

            </div>

            {/* Bottom Button */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={handleCloseModal}
                className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 text-center"
              >
                {language === 'ta' ? 'புரிந்தது / முடிந்தது' : 'Got it!'}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
