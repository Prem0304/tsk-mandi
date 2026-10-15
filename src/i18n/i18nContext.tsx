import React, { createContext, useContext, useState, useEffect } from 'react';
import enTranslations from './en.json';
import taTranslations from './ta.json';

export type Language = 'en' | 'ta';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('tsk_mandi_language');
    return saved === 'ta' ? 'ta' : 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('tsk_mandi_language', lang);
    document.documentElement.lang = lang;
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = (path: string, params?: Record<string, string | number>): string => {
    const keys = path.split('.');
    const dict = language === 'ta' ? taTranslations : enTranslations;
    const fallbackDict = enTranslations;

    let result: any = dict;
    for (const key of keys) {
      if (result && typeof result === 'object' && key in result) {
        result = result[key];
      } else {
        result = undefined;
        break;
      }
    }

    if (result === undefined) {
      // Fallback to english
      result = fallbackDict;
      for (const key of keys) {
        if (result && typeof result === 'object' && key in result) {
          result = result[key];
        } else {
          return path;
        }
      }
    }

    if (typeof result !== 'string') {
      return path;
    }

    if (params) {
      let interpolated = result;
      for (const [paramKey, paramValue] of Object.entries(params)) {
        interpolated = interpolated.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
      }
      return interpolated;
    }

    return result;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
