// ============================================================================
// CUSTOMER ADD / EDIT MODAL WITH AMOUNT & BALANCE ADJUSTMENT
// Allows adding new customers or editing existing customers including their
// Opening Balance Amount, Crates Held, Direct Total Balance Adjustment, and Contact Info
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../lib/db';
import { Customer } from '../../types';
import { formatINR, getTodayDateString } from '../../lib/utils';
import {
  X,
  User,
  Phone,
  MapPin,
  Coins,
  Package,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Calculator,
  Save,
  Store
} from 'lucide-react';

interface CustomerEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer?: Customer | null; // null/undefined for Add New, Customer object for Edit
  onSaved?: (customer: Customer) => void;
}

export const CustomerEditModal: React.FC<CustomerEditModalProps> = ({
  isOpen,
  onClose,
  customer,
  onSaved
}) => {
  const { t, language } = useI18n();
  const { requestActionAuthorization } = useAuth();
  const { state, customerSummaries } = useApp();

  const isEditing = Boolean(customer && customer.id);

  // Form Fields
  const [name, setName] = useState('');
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [place, setPlace] = useState('');
  const [creditLimit, setCreditLimit] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  // Financial & Amount Fields
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [openingDate, setOpeningDate] = useState(getTodayDateString());
  const [openingBigCrates, setOpeningBigCrates] = useState<number>(0);
  const [openingSmallCrates, setOpeningSmallCrates] = useState<number>(0);

  // Direct Target Balance Setter
  const [targetBalanceInput, setTargetBalanceInput] = useState<string>('');

  const [formError, setFormError] = useState('');

  // Summary for this customer if editing
  const summary = useMemo(() => {
    if (!customer?.id) return null;
    return customerSummaries.find(s => s.customerId === customer.id);
  }, [customer?.id, customerSummaries]);

  // Net amount from transactions (Billed - Paid - WrittenOff)
  const transactionNetBalance = useMemo(() => {
    if (!summary) return 0;
    return (summary.totalBilled || 0) - (summary.totalPaid || 0) - (summary.totalWrittenOff || 0);
  }, [summary]);

  // Resulting Net Total Balance
  const previewTotalBalance = (openingBalance || 0) + transactionNetBalance;

  // Populate or reset form whenever modal opens or customer changes
  useEffect(() => {
    if (isOpen) {
      setFormError('');
      setTargetBalanceInput('');
      if (customer) {
        setName(customer.name || '');
        setShopName(customer.shopName || '');
        setPhone(customer.phone || '');
        setAltPhone(customer.altPhone || '');
        setPlace(customer.place || '');
        setOpeningBalance(customer.openingMoneyBalance || 0);
        setOpeningDate(customer.openingBalanceDate || getTodayDateString());
        setOpeningBigCrates(customer.openingCrates?.['big'] || 0);
        setOpeningSmallCrates(customer.openingCrates?.['small'] || 0);
        setCreditLimit(customer.creditLimit !== undefined && customer.creditLimit !== null ? customer.creditLimit : '');
        setNotes(customer.notes || '');
      } else {
        setName('');
        setShopName('');
        setPhone('');
        setAltPhone('');
        setPlace('');
        setOpeningBalance(0);
        setOpeningDate(getTodayDateString());
        setOpeningBigCrates(0);
        setOpeningSmallCrates(0);
        setCreditLimit('');
        setNotes('');
      }
    }
  }, [isOpen, customer]);

  if (!isOpen) return null;

  // Direct Total Balance Adjustment Helper
  const handleApplyTargetBalance = () => {
    const target = parseFloat(targetBalanceInput);
    if (isNaN(target)) return;
    // target = openingBalance + transactionNetBalance => openingBalance = target - transactionNetBalance
    const requiredOpening = target - transactionNetBalance;
    setOpeningBalance(requiredOpening);
    setTargetBalanceInput('');
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError('');

    if (!name.trim()) {
      setFormError(language === 'ta' ? 'வாடிக்கையாளர் பெயர் கட்டாயம்.' : 'Customer name is required.');
      return;
    }

    const cleanPhone = phone.trim();
    if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 10) {
      setFormError(language === 'ta' ? 'சரியான 10 இலக்க போன் எண் தேவை.' : 'Valid 10-digit phone number is required.');
      return;
    }

    const customerObj: Customer = {
      id: customer?.id || `cust-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: name.trim(),
      shopName: shopName.trim() || undefined,
      phone: cleanPhone,
      altPhone: altPhone.trim() || undefined,
      place: place.trim() || undefined,
      notes: notes.trim() || undefined,
      openingMoneyBalance: openingBalance || 0,
      openingBalanceDate: openingDate || getTodayDateString(),
      openingCrates: { big: openingBigCrates || 0, small: openingSmallCrates || 0 },
      creditLimit: creditLimit === '' ? null : Number(creditLimit),
      crateLimits: customer?.crateLimits || { big: null, small: null },
      isActive: customer?.isActive ?? true,
      createdAt: customer?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const actionTitle = isEditing
      ? (language === 'ta' ? `வாடிக்கையாளர் திருத்தம்: ${name}` : `Update Customer: ${name}`)
      : (language === 'ta' ? `புதிய வாடிக்கையாளர்: ${name}` : `Add Customer: ${name}`);

    const actionDetails = `Due Balance: ₹${openingBalance} (Net: ₹${previewTotalBalance}) • Crates: B:${openingBigCrates}, S:${openingSmallCrates}`;

    requestActionAuthorization({
      actionName: actionTitle,
      actionDetails,
      onConfirm: () => {
        dbService.saveCustomer(customerObj);
        if (onSaved) onSaved(customerObj);
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-start sm:justify-center p-2 sm:p-4 overflow-y-auto safe-area-pt safe-area-pb">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[95dvh] animate-in zoom-in-95 duration-150 shrink-0">
        
        {/* Modal Header */}
        <div className="bg-tomato text-white px-5 py-3.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-xl bg-white/20">
              <User className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-black text-sm sm:text-base leading-tight">
                {isEditing
                  ? (language === 'ta' ? 'வாடிக்கையாளர் விவரங்கள் & பாக்கி திருத்தம்' : 'Edit Customer & Balance Amount')
                  : (language === 'ta' ? 'புதிய வாடிக்கையாளர் சேர்த்தல்' : 'Add New Customer')}
              </h3>
              <p className="text-[11px] text-white/80">
                {isEditing ? customer?.name : (language === 'ta' ? 'கடன் & பாக்கி மேலாண்மை' : 'Credit & Ledger Management')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-slate-800">
          
          {/* Error Banner */}
          {formError && (
            <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2.5 rounded-xl text-xs font-bold flex items-center space-x-2 animate-shake">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Section 1: Customer Profile Details */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {language === 'ta' ? 'தனிப்பட்ட & தொடர்பு விவரங்கள்' : 'Profile & Contact Info'}
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  {language === 'ta' ? 'வாடிக்கையாளர் பெயர் *' : 'Customer Name *'}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Murugan"
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-bold focus:border-tomato focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                  <Store className="w-3.5 h-3.5 text-slate-400" />
                  <span>{language === 'ta' ? 'கடை பெயர்' : 'Shop / Stall Name'}</span>
                </label>
                <input
                  type="text"
                  value={shopName}
                  onChange={e => setShopName(e.target.value)}
                  placeholder="e.g. Murugan Traders"
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-semibold focus:border-tomato focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{language === 'ta' ? 'தொலைபேசி எண் *' : 'Phone Number *'}</span>
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="9842100000"
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-bold focus:border-tomato focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  {language === 'ta' ? 'மாற்று போன் எண்' : 'Alt Phone'}
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={altPhone}
                  onChange={e => setAltPhone(e.target.value)}
                  placeholder="Optional"
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-semibold focus:border-tomato focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{language === 'ta' ? 'ஊர் / மார்க்கெட்' : 'Town / Place'}</span>
                </label>
                <input
                  type="text"
                  value={place}
                  onChange={e => setPlace(e.target.value)}
                  placeholder="e.g. Theni, Thevaram"
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-semibold focus:border-tomato focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  {language === 'ta' ? 'கடன் வரம்பு (Credit Limit ₹)' : 'Credit Limit (₹)'}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={creditLimit}
                  onChange={e => setCreditLimit(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 50000"
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-semibold focus:border-tomato focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: EDITABLE AMOUNT & OPENING BALANCES (THE MAIN FEATURE) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 sm:p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
                <Coins className="w-4 h-4 text-emerald-600" />
                <span>
                  {language === 'ta'
                    ? 'பாக்கி தொகை & காலி பெட்டி கணக்கு'
                    : 'Due Balance & Crate Amount Settings'}
                </span>
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                {language === 'ta' ? 'தொகையை திருத்தலாம்' : 'Editable Amount'}
              </span>
            </div>

            {/* Opening Balance Input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  {language === 'ta' ? 'பழைய பாக்கி தொகை (₹) *' : 'Opening Due Balance (₹) *'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-black text-slate-400">₹</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="1"
                    value={openingBalance || ''}
                    onChange={e => setOpeningBalance(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full h-11 pl-7 pr-3 rounded-xl border-2 border-slate-300 text-base font-black text-emerald-700 focus:border-emerald-600 focus:outline-none bg-white"
                  />
                </div>
                <span className="text-[10px] text-slate-500 block leading-tight">
                  {language === 'ta'
                    ? 'மண்டி கணக்கில் ஏறும் முன் உள்ள பழைய பாக்கி'
                    : 'Initial due balance before current bills'}
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{language === 'ta' ? 'கணக்கிட்ட தேதி' : 'As-of Date'}</span>
                </label>
                <input
                  type="date"
                  value={openingDate}
                  onChange={e => setOpeningDate(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-semibold bg-white"
                />
              </div>
            </div>

            {/* Direct Total Balance Target Adjustment Helper (Only when editing existing customer with bills) */}
            {isEditing && transactionNetBalance !== 0 && (
              <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                  <span className="flex items-center space-x-1">
                    <Calculator className="w-3.5 h-3.5 text-amber-700" />
                    <span>{language === 'ta' ? 'மொத்த பாக்கியை நேரடியாக மாற்ற' : 'Directly Adjust Total Net Balance:'}</span>
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={targetBalanceInput}
                    onChange={e => setTargetBalanceInput(e.target.value)}
                    placeholder={language === 'ta' ? 'புதிய மொத்த பாக்கி (₹)' : 'e.g. 5000'}
                    className="flex-1 h-9 px-2.5 rounded-lg border border-amber-300 text-xs font-bold bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleApplyTargetBalance}
                    disabled={!targetBalanceInput}
                    className="px-3 h-9 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs rounded-lg shadow-xs disabled:opacity-50 transition-all shrink-0"
                  >
                    {language === 'ta' ? 'பயன்படுத்து' : 'Apply'}
                  </button>
                </div>
                <span className="text-[10px] text-amber-800 block">
                  {language === 'ta'
                    ? `* விற்பனை பில்கள் கழித்து பழைய பாக்கி தானாக கணக்கிடப்படும் (பில்கள் பாக்கி: ${formatINR(transactionNetBalance)})`
                    : `* Automatically sets Opening Balance to achieve target (Net from bills: ${formatINR(transactionNetBalance)})`}
                </span>
              </div>
            )}

            {/* Live Resulting Balance Preview Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-[11px] font-bold text-slate-500 block">
                  {language === 'ta' ? 'நிகர தற்போதைய பாக்கி (Net Current Balance):' : 'Net Current Balance:'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {language === 'ta'
                    ? `பழைய பாக்கி ${formatINR(openingBalance)} ${transactionNetBalance ? `+ பில்கள் ${formatINR(transactionNetBalance)}` : ''}`
                    : `Opening ${formatINR(openingBalance)} ${transactionNetBalance ? `+ Bills Net ${formatINR(transactionNetBalance)}` : ''}`}
                </span>
              </div>
              <div className="text-right">
                <span className={`text-lg sm:text-xl font-black ${previewTotalBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {formatINR(previewTotalBalance)}
                </span>
              </div>
            </div>

            {/* Opening Empty Crates */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                <Package className="w-3.5 h-3.5 text-amber-600" />
                <span>{language === 'ta' ? 'வாடிக்கையாளரிடம் உள்ள பழைய காலி பெட்டிகள்' : 'Opening Empty Crates with Customer'}</span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500">
                    {language === 'ta' ? 'பெரிய பெட்டி (Big)' : 'Big Crates'}
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={openingBigCrates || ''}
                    onChange={e => setOpeningBigCrates(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    placeholder="0"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm font-bold text-center bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500">
                    {language === 'ta' ? 'சிறிய பெட்டி (Small)' : 'Small Crates'}
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={openingSmallCrates || ''}
                    onChange={e => setOpeningSmallCrates(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    placeholder="0"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm font-bold text-center bg-white"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Section 3: Notes */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">
              {language === 'ta' ? 'குறிப்புகள் (Notes)' : 'Customer Notes'}
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={language === 'ta' ? 'கூடுதல் விவரங்கள்...' : 'Optional notes, reference...'}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm font-medium focus:border-tomato focus:outline-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 active:scale-95 transition-all"
            >
              {language === 'ta' ? 'ரத்து' : 'Cancel'}
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-tomato hover:bg-rose-700 active:scale-95 text-white font-black text-xs shadow-md transition-all flex items-center space-x-1.5"
            >
              <Save className="w-4 h-4" />
              <span>
                {isEditing
                  ? (language === 'ta' ? 'மாற்றங்களை சேமி' : 'Save Changes')
                  : (language === 'ta' ? 'வாடிக்கையாளரை சேமி' : 'Save Customer')}
              </span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
