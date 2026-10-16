// ============================================================================
// MANDI DOCUMENT HEADER COMPONENT (UNIFIED OFFICIAL LETTERHEAD)
// Renders devotional invocations, contact numbers, Murugar sketch, T.S.K branding,
// shop address, and tomato graphic across all HTML printable bills and reports.
// ============================================================================

import React from 'react';
import { AppSettings } from '../../types';
import { MURUGAR_IMAGE_DATA, TOMATO_IMAGE_DATA } from '../../assets/images';

interface MandiDocumentHeaderProps {
  settings?: AppSettings;
  language?: 'en' | 'ta';
  format?: 'thermal_80' | 'thermal_58' | 'a4' | 'a5';
  docTitle?: string;
  docSubtitle?: string;
}

export const MandiDocumentHeader: React.FC<MandiDocumentHeaderProps> = ({
  settings,
  language = 'en',
  format = 'a4',
  docTitle,
  docSubtitle
}) => {
  const isThermal = format === 'thermal_80' || format === 'thermal_58';
  const isThermal58 = format === 'thermal_58';

  const shopName = settings?.shopName || 'T.S.K';
  const subtitle = language === 'ta'
    ? (settings?.shopSubtitleTa || 'தக்காளி காய்கறி கமிஷன் மண்டி')
    : (settings?.shopSubtitle || 'Thakkali Kaaikari Commission Mandi');
  
  const address = language === 'ta'
    ? (settings?.address === 'Shop no 30, Kamarajar Market, Thevaram-625530'
        ? 'கடை எண் 30, காமராஜர் மார்க்கெட், தேவாரம்-625530'
        : (settings?.address || 'Shop no 30, Kamarajar Market, Thevaram-625530'))
    : (settings?.address || 'Shop no 30, Kamarajar Market, Thevaram-625530');

  const phone1 = settings?.phone || '9715813463';
  const phone2 = settings?.altPhone || '8190801030';

  const god1 = language === 'ta' ? (settings?.godName1Ta || 'ஸ்ரீ வலகுருநாதன் துணை') : (settings?.godName1 || 'Shree Valaguranathan Thunai');
  const god2 = language === 'ta' ? (settings?.godName2Ta || 'ஸ்ரீ அங்காளஈஸ்வரி துணை') : (settings?.godName2 || 'Shree Angalaeeswari Thunai');

  // Thermal 58mm compact layout
  if (isThermal58) {
    return (
      <div className="w-full text-slate-900 font-sans border-b-2 border-slate-900 pb-2 mb-2 select-none">
        {/* Devotional Top */}
        <div className="text-center text-[9.5px] font-bold leading-tight text-red-900">
          <div>|| {god1} ||</div>
          <div>|| {god2} ||</div>
        </div>

        <div className="text-center text-[9px] font-bold text-slate-800 mt-0.5 pb-1 border-b border-dashed border-slate-300">
          Cell: {phone1} / {phone2}
        </div>

        {/* Center with Images */}
        <div className="flex items-center justify-between mt-1 px-0.5 gap-1">
          <div className="w-8 flex justify-center shrink-0">
            <img
              src={MURUGAR_IMAGE_DATA}
              alt="Murugar"
              className="w-8 h-11 object-contain"
            />
          </div>
          <div className="text-center px-0.5 flex-1">
            <h1 className="text-xl font-black tracking-tight leading-none text-slate-950">
              {shopName}
            </h1>
            <p className="text-[8.5px] font-black uppercase text-tomato mt-0.5 leading-tight">
              {subtitle}
            </p>
            <p className="text-[7.5px] font-semibold text-slate-700 leading-tight mt-0.5">
              {address}
            </p>
          </div>
          <div className="w-8 flex justify-center shrink-0">
            <img
              src={TOMATO_IMAGE_DATA}
              alt="Tomato"
              className="w-7 h-7 object-contain"
            />
          </div>
        </div>

        {docTitle && (
          <div className="mt-1.5 pt-1 border-t border-dashed border-slate-400 text-center text-[10px] font-black tracking-wider uppercase">
            {docTitle}
          </div>
        )}
      </div>
    );
  }

  // Thermal 80mm layout
  if (isThermal) {
    return (
      <div className="w-full text-slate-900 font-sans border-b-2 border-slate-900 pb-2.5 mb-2.5 select-none">
        {/* Devotional Top */}
        <div className="text-center font-bold text-red-900 leading-tight text-[10.5px]">
          <div>|| {god1} ||</div>
          <div>|| {god2} ||</div>
        </div>

        {/* Contacts Row */}
        <div className="flex justify-between items-center text-[10px] font-bold text-slate-800 mt-1 pb-1 border-b border-dashed border-slate-300">
          <div className="font-mono">Cell: {phone1} / {phone2}</div>
          {settings?.gstNumber && <div className="text-slate-600 font-mono text-[9px]">GST: {settings.gstNumber}</div>}
        </div>

        {/* Center Branding with Murugar and Tomato */}
        <div className="flex items-center justify-between mt-1.5 gap-2">
          <div className="w-11 flex justify-center shrink-0">
            <img
              src={MURUGAR_IMAGE_DATA}
              alt="Murugar"
              className="w-11 h-15 object-contain rounded"
            />
          </div>
          <div className="text-center flex-1 px-1">
            <h1 className="text-2xl font-black tracking-wider leading-none text-slate-950">
              {shopName}
            </h1>
            <p className="text-[10.5px] font-black uppercase tracking-wide text-tomato mt-1 leading-tight">
              {subtitle}
            </p>
            <p className="text-[9px] font-semibold text-slate-700 leading-tight mt-0.5">
              {address}
            </p>
          </div>
          <div className="w-11 flex justify-center shrink-0">
            <img
              src={TOMATO_IMAGE_DATA}
              alt="Tomato"
              className="w-10 h-10 object-contain"
            />
          </div>
        </div>

        {docTitle && (
          <div className="mt-2 pt-1 border-t border-dashed border-slate-400 text-center text-xs font-black tracking-wider uppercase">
            {docTitle}
          </div>
        )}
      </div>
    );
  }

  // Standard A4 / A5 Layout
  return (
    <div className="w-full text-slate-900 font-sans border-b-2 border-slate-900 pb-3 mb-3 select-none">
      {/* Top Bar: Phones on Left, Invocations in Center */}
      <div className="relative flex justify-between items-start text-xs sm:text-sm font-bold text-slate-800">
        <div className="text-left font-mono leading-tight">
          <span className="text-slate-600 font-sans font-semibold">Cell: </span>
          <span className="text-slate-950 font-black">{phone1}</span>
          <div className="pl-8 text-slate-950 font-black">{phone2}</div>
        </div>

        <div className="text-center flex-1 leading-tight text-slate-900">
          <div className="text-xs sm:text-sm font-extrabold tracking-wide text-red-900">
            || {god1} ||
          </div>
          <div className="text-xs sm:text-sm font-extrabold tracking-wide text-red-900">
            || {god2} ||
          </div>
        </div>

        {/* Right side spacer or doc reference placeholder */}
        <div className="w-24 text-right text-[11px] font-semibold text-slate-500">
          {settings?.gstNumber ? `GST: ${settings.gstNumber}` : ''}
        </div>
      </div>

      {/* Main Branding Section with Flanking Images */}
      <div className="flex items-center justify-between mt-2 gap-3">
        {/* Left: Lord Murugar Sketch */}
        <div className="w-16 sm:w-20 flex justify-center shrink-0">
          <img
            src={MURUGAR_IMAGE_DATA}
            alt="Lord Murugar"
            className="w-14 sm:w-16 h-20 sm:h-24 object-contain shadow-xs rounded"
          />
        </div>

        {/* Center: Mandi Branding */}
        <div className="text-center flex-1 px-2">
          <h1 className="text-3xl sm:text-4xl font-black tracking-widest text-slate-950 leading-none">
            {shopName}
          </h1>
          <p className="text-sm sm:text-base font-black uppercase tracking-wider text-tomato mt-1">
            {subtitle}
          </p>
          <p className="text-xs sm:text-sm font-bold text-slate-700 mt-1">
            {address}
          </p>
        </div>

        {/* Right: Tomato Image */}
        <div className="w-16 sm:w-20 flex justify-center shrink-0">
          <img
            src={TOMATO_IMAGE_DATA}
            alt="Tomato"
            className="w-14 sm:w-16 h-14 sm:h-16 object-contain"
          />
        </div>
      </div>

      {/* Optional Document Title Ribbon */}
      {docTitle && (
        <div className="mt-3 pt-2 border-t border-slate-300 flex justify-between items-center text-xs font-bold uppercase tracking-wider text-slate-800">
          <span className="bg-slate-900 text-white px-3 py-0.5 rounded-full text-[11px] font-extrabold">
            {docTitle}
          </span>
          {docSubtitle && (
            <span className="text-slate-600 text-[11px] normal-case">
              {docSubtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
