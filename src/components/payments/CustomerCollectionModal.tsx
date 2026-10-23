// ============================================================================
// CUSTOMER PAYMENT & CRATE COLLECTION MODAL (SHIELDED COUNTER MODE)
// Fully opaque privacy screen to hide all mandi wholesale profit & supplier metrics
// Includes: UPI Dynamic QR, Cash Change Calculator, Simultaneous Crate Return,
// Customer Retail Mini-Statement, Voice Announcement, and WhatsApp Receipt Share.
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import { useI18n } from '../../i18n/i18nContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../lib/db';
import { formatINR, getTodayDateString } from '../../lib/utils';
import { shareCustomerPaymentReceiptWhatsApp } from '../../lib/whatsapp';
import { Customer, PaymentReceived, PaymentMode } from '../../types';
import {
  X,
  Shield,
  CheckCircle2,
  QrCode,
  Coins,
  Package,
  Volume2,
  VolumeX,
  Share2,
  Search,
  Receipt,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
  User,
  ArrowRight,
  Plus,
  Minus
} from 'lucide-react';

interface CustomerCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCustomerId?: string;
}

export const CustomerCollectionModal: React.FC<CustomerCollectionModalProps> = ({
  isOpen,
  onClose,
  defaultCustomerId
}) => {
  const { t, language } = useI18n();
  const { requestActionAuthorization } = useAuth();
  const { state, customerSummaries } = useApp();

  // Search & Selected Customer
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(defaultCustomerId || '');

  // Payment Form States
  const [amount, setAmount] = useState<number | ''>('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');

  // Cash Calculator States
  const [cashTendered, setCashTendered] = useState<number | ''>('');

  // Crate Returns in same transaction
  const [bigCratesReturned, setBigCratesReturned] = useState<number>(0);
  const [smallCratesReturned, setSmallCratesReturned] = useState<number>(0);

  // Dynamic UPI QR Code
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // UI Toggles
  const [showLedger, setShowLedger] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Success State for confirmation & WhatsApp
  const [successReceipt, setSuccessReceipt] = useState<{
    customer: Customer;
    amount: number;
    mode: PaymentMode;
    referenceNo?: string;
    cratesReturned: { big: number; small: number };
    previousBalance: number;
    newBalance: number;
    cratesHeld: Record<string, number>;
  } | null>(null);

  // Sync default customer when modal opens
  useEffect(() => {
    if (defaultCustomerId) {
      setSelectedCustomerId(defaultCustomerId);
    }
  }, [defaultCustomerId, isOpen]);

  // Reset form when modal closes or opens
  useEffect(() => {
    if (!isOpen) {
      setSuccessReceipt(null);
      setErrorMessage('');
      setAmount('');
      setCashTendered('');
      setBigCratesReturned(0);
      setSmallCratesReturned(0);
      setReferenceNo('');
      setNotes('');
      setSearchTerm('');
      setShowLedger(false);
    }
  }, [isOpen]);

  // Selected customer object & summary
  const selectedCustomer = useMemo(() => {
    return state.customers.find(c => c.id === selectedCustomerId);
  }, [state.customers, selectedCustomerId]);

  const selectedSummary = useMemo(() => {
    return customerSummaries.find(c => c.customerId === selectedCustomerId);
  }, [customerSummaries, selectedCustomerId]);

  // Customer pending crates
  const currentBigCrates = selectedSummary?.cratesHeld['big'] || 0;
  const currentSmallCrates = selectedSummary?.cratesHeld['small'] || 0;
  const currentBalance = selectedSummary?.currentBalance || 0;

  // Filtered customer list for search
  const filteredCustomers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const active = state.customers.filter(c => c.isActive && !c.deletedAt);
    if (!term) {
      // Sort customers by money balance descending (debtors first)
      return [...active].sort((a, b) => {
        const balA = customerSummaries.find(s => s.customerId === a.id)?.currentBalance || 0;
        const balB = customerSummaries.find(s => s.customerId === b.id)?.currentBalance || 0;
        return balB - balA;
      }).slice(0, 15);
    }
    return active.filter(c => 
      c.name.toLowerCase().includes(term) ||
      (c.shopName && c.shopName.toLowerCase().includes(term)) ||
      c.phone.includes(term) ||
      (c.place && c.place.toLowerCase().includes(term))
    );
  }, [state.customers, searchTerm, customerSummaries]);

  // Customer recent retail transactions (Retail Ledger Only - zero cost, zero supplier, zero profit)
  const retailHistory = useMemo(() => {
    if (!selectedCustomerId) return { sales: [], payments: [] };
    const sales = state.sales
      .filter(s => s.customerId === selectedCustomerId && !s.deletedAt)
      .sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime())
      .slice(0, 5);

    const payments = state.paymentsReceived
      .filter(p => p.customerId === selectedCustomerId && !p.deletedAt)
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
      .slice(0, 5);

    return { sales, payments };
  }, [selectedCustomerId, state.sales, state.paymentsReceived]);

  // Generate Dynamic UPI QR Code when amount & mode is UPI
  useEffect(() => {
    if (paymentMode === 'upi' && selectedCustomer && typeof amount === 'number' && amount > 0) {
      const upiId = state.settings.upiId || 'tskvegetables@upi';
      const shopName = language === 'ta' && state.settings.shopNameTa ? state.settings.shopNameTa : state.settings.shopName;
      const note = `TSK Mandi - ${selectedCustomer.name}`;
      const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;

      QRCode.toDataURL(upiUrl, {
        width: 240,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' }
      })
        .then(url => setQrCodeDataUrl(url))
        .catch(err => {
          console.warn('QR code generation failed:', err);
          setQrCodeDataUrl('');
        });
    } else {
      setQrCodeDataUrl('');
    }
  }, [paymentMode, selectedCustomer, amount, state.settings, language]);

  // Voice announcement helper using SpeechSynthesis
  const speakAnnouncement = (custName: string, paidAmount: number, cratesCount: number) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      let text = '';
      if (language === 'ta') {
        text = `${custName} இடமிருந்து `;
        if (paidAmount > 0) {
          text += `${paidAmount} ரூபாய் `;
        }
        if (cratesCount > 0) {
          text += `மற்றும் ${cratesCount} காலி பெட்டிகள் `;
        }
        text += `பெறப்பட்டது.`;
      } else {
        text = `Received `;
        if (paidAmount > 0) {
          text += `rupees ${paidAmount} `;
        }
        if (cratesCount > 0) {
          text += `and ${cratesCount} empty crates `;
        }
        text += `from ${custName}.`;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'ta' ? 'ta-IN' : 'en-IN';
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  };

  if (!isOpen) return null;

  // Calculate Cash Change
  const numAmount = typeof amount === 'number' ? amount : 0;
  const numTendered = typeof cashTendered === 'number' ? cashTendered : 0;
  const changeToReturn = numTendered >= numAmount ? numTendered - numAmount : 0;

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedCustomer) {
      setErrorMessage(language === 'ta' ? 'வாடிக்கையாளரை தேர்ந்தெடுக்கவும்' : 'Please select a customer');
      return;
    }

    const payAmount = typeof amount === 'number' ? amount : 0;
    const totalCratesReturned = bigCratesReturned + smallCratesReturned;

    if (payAmount <= 0 && totalCratesReturned <= 0) {
      setErrorMessage(
        language === 'ta'
          ? 'தொகை அல்லது காலி பெட்டிகளை உள்ளிடவும்'
          : 'Please enter a payment amount or crates returned'
      );
      return;
    }

    const executeCollection = () => {
      setIsSubmitting(true);
      try {
        const prevBal = currentBalance;

        // 1. Record Money Payment (if amount > 0)
        if (payAmount > 0) {
          const paymentRecord: PaymentReceived = {
            id: `pr-coll-${Date.now()}`,
            paymentDate: getTodayDateString(),
            customerId: selectedCustomer.id,
            amount: payAmount,
            mode: paymentMode,
            referenceNo: referenceNo.trim() || undefined,
            discount: 0,
            notes: notes.trim() || (totalCratesReturned > 0 ? `Counter collection with ${totalCratesReturned} crates` : 'Counter collection'),
            allocations: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          dbService.receivePayment(paymentRecord);
        }

        // 2. Record Crate Returns (if any)
        if (bigCratesReturned > 0) {
          dbService.recordCrateReturn(
            'customer',
            selectedCustomer.id,
            'big',
            bigCratesReturned,
            'shop',
            'Returned during customer collection'
          );
        }

        if (smallCratesReturned > 0) {
          dbService.recordCrateReturn(
            'customer',
            selectedCustomer.id,
            'small',
            smallCratesReturned,
            'shop',
            'Returned during customer collection'
          );
        }

        // Voice Announcement
        speakAnnouncement(selectedCustomer.name, payAmount, totalCratesReturned);

        // Set Success State
        const newBal = prevBal - payAmount;
        const newHeld = {
          big: Math.max(0, currentBigCrates - bigCratesReturned),
          small: Math.max(0, currentSmallCrates - smallCratesReturned)
        };

        setSuccessReceipt({
          customer: selectedCustomer,
          amount: payAmount,
          mode: paymentMode,
          referenceNo: referenceNo.trim() || undefined,
          cratesReturned: { big: bigCratesReturned, small: smallCratesReturned },
          previousBalance: prevBal,
          newBalance: newBal,
          cratesHeld: newHeld
        });
      } catch (err: any) {
        console.error('Error saving collection:', err);
        setErrorMessage(err.message || 'Failed to record collection');
      } finally {
        setIsSubmitting(false);
      }
    };

    // Request Action Authorization if password protected
    requestActionAuthorization({
      actionName: language === 'ta' ? 'வாடிக்கையாளர் வசூல்' : 'Customer Payment Collection',
      actionDetails: `${selectedCustomer.name} • ${payAmount > 0 ? formatINR(payAmount) : ''} ${totalCratesReturned > 0 ? `(${totalCratesReturned} Crates)` : ''}`,
      onConfirm: executeCollection
    });
  };

  const handleCollectAnother = () => {
    setSuccessReceipt(null);
    setSelectedCustomerId('');
    setSearchTerm('');
    setAmount('');
    setCashTendered('');
    setBigCratesReturned(0);
    setSmallCratesReturned(0);
    setReferenceNo('');
    setNotes('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl flex flex-col justify-start p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200 safe-area-pt safe-area-pb">
      
      {/* Top Shielded Header */}
      <div className="w-full max-w-2xl mx-auto flex items-center justify-between pb-3 border-b border-slate-800 text-white shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-inner">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center space-x-2">
              <span>{language === 'ta' ? 'வாடிக்கையாளர் வசூல்' : 'Customer Collection'}</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center space-x-1">
                <Shield className="w-3 h-3 text-emerald-400" />
                <span>{language === 'ta' ? 'பாதுகாப்பானது' : 'Shielded'}</span>
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              {language === 'ta'
                ? 'லாப விவரங்கள் வாடிக்கையாளருக்கு முற்றிலும் மறைக்கப்பட்டுள்ளது'
                : 'Customer-facing mode: zero wholesale profit or supplier costs shown'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Voice Announcement Toggle */}
          <button
            type="button"
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`p-2 rounded-xl border text-xs flex items-center transition-all ${
              voiceEnabled
                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title={voiceEnabled ? 'Voice Announcement ON' : 'Voice Announcement OFF'}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Close Modal Button */}
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Body Container */}
      <div className="w-full max-w-2xl mx-auto flex-1 py-2 sm:py-3 space-y-3.5">

        {/* ----------------- SUCCESS CONFIRMATION SCREEN ----------------- */}
        {successReceipt ? (
          <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-5 sm:p-6 text-white space-y-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-emerald-500/20 border-2 border-emerald-400 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-lg">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-emerald-300">
                {language === 'ta' ? 'வசூல் பதிவு செய்யப்பட்டது!' : 'Collection Recorded Successfully!'}
              </h3>
              <p className="text-xs text-slate-400">
                {language === 'ta'
                  ? 'தொகை கணக்கிலும் காலி பெட்டிகள் சரக்கிலும் வரவு வைக்கப்பட்டது'
                  : 'Ledger balance and empty crates have been updated.'}
              </p>
            </div>

            {/* Receipt Summary Details */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                <span className="text-xs text-slate-400">{language === 'ta' ? 'வாடிக்கையாளர்' : 'Customer'}:</span>
                <span className="text-sm font-bold text-white">
                  {successReceipt.customer.name} {successReceipt.customer.shopName ? `(${successReceipt.customer.shopName})` : ''}
                </span>
              </div>

              {successReceipt.amount > 0 && (
                <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                  <span className="text-xs text-slate-400">{language === 'ta' ? 'பெற்ற தொகை' : 'Amount Received'}:</span>
                  <div className="text-right">
                    <span className="text-lg font-black text-emerald-400">{formatINR(successReceipt.amount)}</span>
                    <span className="text-[10px] text-slate-400 uppercase ml-2 bg-slate-800 px-1.5 py-0.5 rounded">
                      {successReceipt.mode}
                    </span>
                  </div>
                </div>
              )}

              {(successReceipt.cratesReturned.big > 0 || successReceipt.cratesReturned.small > 0) && (
                <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
                  <span className="text-xs text-slate-400">{language === 'ta' ? 'திருப்பி அளித்த பெட்டிகள்' : 'Crates Returned'}:</span>
                  <span className="text-xs font-bold text-amber-300">
                    {language === 'ta'
                      ? `பெரியது ${successReceipt.cratesReturned.big}, சிறியது ${successReceipt.cratesReturned.small}`
                      : `Big: ${successReceipt.cratesReturned.big}, Small: ${successReceipt.cratesReturned.small}`}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center pt-1 text-xs">
                <div>
                  <span className="text-slate-400">{language === 'ta' ? 'முந்தைய பாக்கி' : 'Previous Due'}: </span>
                  <span className="text-slate-300 font-medium">{formatINR(successReceipt.previousBalance)}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400">{language === 'ta' ? 'மீதமுள்ள பாக்கி' : 'Remaining Due'}: </span>
                  <strong className="text-rose-400 font-extrabold text-sm">{formatINR(successReceipt.newBalance)}</strong>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex justify-between">
                <span>{language === 'ta' ? 'வாடிக்கையாளரிடம் உள்ள பெட்டிகள்' : 'Pending Crates'}:</span>
                <span className="font-bold text-amber-200">
                  {language === 'ta'
                    ? `பெரியது: ${successReceipt.cratesHeld.big}, சிறியது: ${successReceipt.cratesHeld.small}`
                    : `Big: ${successReceipt.cratesHeld.big}, Small: ${successReceipt.cratesHeld.small}`}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  shareCustomerPaymentReceiptWhatsApp(
                    successReceipt.customer,
                    successReceipt.amount,
                    successReceipt.mode,
                    successReceipt.referenceNo,
                    successReceipt.cratesReturned,
                    successReceipt.previousBalance,
                    successReceipt.newBalance,
                    successReceipt.cratesHeld,
                    state.settings,
                    language
                  );
                }}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-sm rounded-2xl flex items-center justify-center space-x-2 shadow-lg transition-all"
              >
                <Share2 className="w-4 h-4" />
                <span>{language === 'ta' ? 'ரசீதை வாட்ஸ்அப் செய்க' : 'Share WhatsApp Receipt'}</span>
              </button>

              <button
                type="button"
                onClick={handleCollectAnother}
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold text-sm rounded-2xl flex items-center justify-center space-x-2 border border-slate-700 transition-all"
              >
                <RefreshCw className="w-4 h-4 text-slate-400" />
                <span>{language === 'ta' ? 'அடுத்த வாடிக்கையாளர் வசூல்' : 'Collect from Another'}</span>
              </button>
            </div>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-400 hover:text-white underline font-semibold"
              >
                {language === 'ta' ? 'முடிந்தது / மூடுக' : 'Done / Close Screen'}
              </button>
            </div>
          </div>
        ) : (
          /* ----------------- COLLECTION ENTRY FORM ----------------- */
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* STEP 1: CUSTOMER SELECTION & BALANCE CARD */}
            {!selectedCustomer ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 text-white space-y-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <User className="w-4 h-4 text-emerald-400" />
                    <span>{language === 'ta' ? 'வாடிக்கையாளரை தேர்வு செய்க' : 'Select Customer'}</span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {language === 'ta' ? 'பாக்கி உள்ளவர்கள் முதலில்' : 'Debtors sorted first'}
                  </span>
                </div>

                {/* Customer Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={language === 'ta' ? 'பெயர், கடை, ஊர் அல்லது போன் மூலம் தேடுக...' : 'Search customer by name, shop, or phone...'}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-white text-base sm:text-sm focus:outline-none focus:border-emerald-400"
                    autoFocus
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-3 text-slate-400 hover:text-white text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Customer List */}
                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/60">
                  {filteredCustomers.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500">
                      {language === 'ta' ? 'வாடிக்கையாளர் கிடைக்கவில்லை' : 'No customers found matching search'}
                    </div>
                  ) : (
                    filteredCustomers.map((cust) => {
                      const summary = customerSummaries.find(s => s.customerId === cust.id);
                      const dueBal = summary?.currentBalance || 0;
                      const bigCr = summary?.cratesHeld['big'] || 0;
                      const smallCr = summary?.cratesHeld['small'] || 0;

                      return (
                        <button
                          key={cust.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomerId(cust.id);
                            if (dueBal > 0) setAmount(dueBal);
                          }}
                          className="w-full text-left py-2 px-3 hover:bg-slate-800/80 rounded-xl flex items-center justify-between transition-all group"
                        >
                          <div>
                            <div className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                              {cust.name} {cust.shopName ? <span className="text-xs font-normal text-slate-400">({cust.shopName})</span> : ''}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {cust.place ? `${cust.place} • ` : ''}{cust.phone}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className={`text-sm font-black ${dueBal > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                              {formatINR(dueBal)}
                            </div>
                            {(bigCr > 0 || smallCr > 0) && (
                              <div className="text-[10px] text-amber-300 font-semibold">
                                {bigCr > 0 ? `B:${bigCr} ` : ''}{smallCr > 0 ? `S:${smallCr}` : ''}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* Selected Customer Card with Change Option */
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 text-white shadow-xl space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                      {language === 'ta' ? 'தேர்ந்தெடுக்கப்பட்ட வாடிக்கையாளர்' : 'Selected Customer'}
                    </span>
                    <h3 className="text-lg font-black text-white">
                      {selectedCustomer.name} {selectedCustomer.shopName ? <span className="text-sm font-semibold text-slate-300">({selectedCustomer.shopName})</span> : ''}
                    </h3>
                    <div className="text-xs text-slate-400">
                      {selectedCustomer.phone} {selectedCustomer.place ? `• ${selectedCustomer.place}` : ''}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomerId('');
                      setAmount('');
                    }}
                    className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 font-semibold transition-all"
                  >
                    {language === 'ta' ? 'மாற்றுக' : 'Change'}
                  </button>
                </div>

                {/* Outstanding Due & Crates Badges */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-2.5 text-center">
                    <span className="text-[11px] text-slate-400 block font-medium">
                      {language === 'ta' ? 'தற்போதைய பாக்கி' : 'Total Due Balance'}
                    </span>
                    <span className={`text-lg sm:text-xl font-black ${currentBalance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {formatINR(currentBalance)}
                    </span>
                  </div>

                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-2.5 text-center">
                    <span className="text-[11px] text-slate-400 block font-medium">
                      {language === 'ta' ? 'வாடிக்கையாளரிடம் உள்ள பெட்டிகள்' : 'Crates with Customer'}
                    </span>
                    <span className="text-sm sm:text-base font-extrabold text-amber-300 mt-1 block">
                      {language === 'ta'
                        ? `பெரியது: ${currentBigCrates} | சிறியது: ${currentSmallCrates}`
                        : `Big: ${currentBigCrates} | Small: ${currentSmallCrates}`}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: PAYMENT & CRATE COLLECTION CONTROLS */}
            {selectedCustomer && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 text-white space-y-4 shadow-xl">
                
                {/* 1. Payment Amount Input */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 flex justify-between items-center">
                    <span>{language === 'ta' ? 'வசூல் தொகை (₹)' : 'Collection Amount (₹)'}</span>
                    {currentBalance > 0 && (
                      <button
                        type="button"
                        onClick={() => setAmount(currentBalance)}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold underline"
                      >
                        {language === 'ta' ? 'முழு பாக்கி (Full Due)' : 'Set Full Due'}
                      </button>
                    )}
                  </label>

                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-lg font-black text-slate-400">₹</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full pl-8 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xl sm:text-2xl font-black text-emerald-400 focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  {/* Preset Amount Chips */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[500, 1000, 2000, 5000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAmount(preset)}
                        className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold border border-slate-700/80 active:scale-95 transition-all"
                      >
                        +₹{preset}
                      </button>
                    ))}
                    {currentBalance > 0 && (
                      <button
                        type="button"
                        onClick={() => setAmount(currentBalance)}
                        className="px-3 py-1.5 text-xs bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 rounded-xl font-black border border-emerald-500/40 active:scale-95 transition-all"
                      >
                        {formatINR(currentBalance)}
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Payment Mode Selector */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-bold text-slate-300 block">
                    {language === 'ta' ? 'பணம் செலுத்தும் முறை' : 'Payment Mode'}
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'cash', label: language === 'ta' ? 'ரொக்கம்' : 'Cash' },
                      { id: 'upi', label: 'UPI QR' },
                      { id: 'bank', label: language === 'ta' ? 'வங்கி' : 'Bank' },
                      { id: 'cheque', label: language === 'ta' ? 'காசோலை' : 'Cheque' }
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setPaymentMode(mode.id as PaymentMode)}
                        className={`py-2 px-2 text-xs font-black rounded-xl border transition-all text-center ${
                          paymentMode === mode.id
                            ? 'bg-emerald-600 border-emerald-400 text-white shadow-md'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Conditional Mode Helpers: UPI QR vs Cash Change Calculator */}
                {paymentMode === 'upi' && (
                  <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 text-center space-y-3">
                    <div className="flex items-center justify-center space-x-1.5 text-xs font-bold text-emerald-300">
                      <QrCode className="w-4 h-4" />
                      <span>{language === 'ta' ? 'வாடிக்கையாளர் ஸ்கேன் செய்ய QR கோட்' : 'Scan to Pay with Any UPI App'}</span>
                    </div>

                    {qrCodeDataUrl ? (
                      <div className="bg-white p-3 rounded-2xl inline-block shadow-lg mx-auto">
                        <img src={qrCodeDataUrl} alt="UPI QR Code" className="w-44 h-44 object-contain" />
                        <div className="text-[11px] font-bold text-slate-800 mt-1">
                          {formatINR(numAmount)}
                        </div>
                      </div>
                    ) : (
                      <div className="py-6 text-xs text-slate-500">
                        {language === 'ta' ? 'தொகையை உள்ளிட்டதும் QR தோன்றும்' : 'Enter amount above to generate dynamic QR code'}
                      </div>
                    )}

                    <div className="text-[11px] text-slate-400">
                      <span>UPI ID: </span>
                      <strong className="text-slate-200">{state.settings.upiId || 'tskvegetables@upi'}</strong>
                    </div>

                    <div className="pt-1">
                      <input
                        type="text"
                        value={referenceNo}
                        onChange={(e) => setReferenceNo(e.target.value)}
                        placeholder={language === 'ta' ? 'UPI குறிப்பு எண் / UTR (விரும்பினால்)' : 'UPI Ref / UTR No (Optional)'}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>
                )}

                {paymentMode === 'cash' && numAmount > 0 && (
                  <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span>{language === 'ta' ? 'சில்லறை கணக்கீட்டாளர் (Change Calculator)' : 'Cash Change Calculator'}</span>
                      <span className="text-[10px] text-slate-500">Fast Counter Math</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">
                          {language === 'ta' ? 'வாடிக்கையாளர் தந்த ரொக்கம்' : 'Cash Tendered by Customer'}
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          value={cashTendered}
                          onChange={(e) => setCashTendered(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                          placeholder="e.g. 2000"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-base font-bold text-white focus:outline-none focus:border-emerald-400"
                        />
                      </div>

                      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 text-center">
                        <span className="text-[11px] text-slate-400 block">
                          {language === 'ta' ? 'திருப்பித் தர வேண்டிய சில்லறை' : 'Change to Return'}
                        </span>
                        <span className={`text-lg font-black ${changeToReturn > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {formatINR(changeToReturn)}
                        </span>
                      </div>
                    </div>

                    {/* Quick Tender Suggestions */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setCashTendered(numAmount)}
                        className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold border border-slate-700"
                      >
                        Exact ({formatINR(numAmount)})
                      </button>
                      {[500, 1000, 2000].map((note) => {
                        if (note >= numAmount) {
                          return (
                            <button
                              key={note}
                              type="button"
                              onClick={() => setCashTendered(note)}
                              className="px-2 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold border border-slate-700"
                            >
                              ₹{note} Note
                            </button>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                )}

                {/* 4. Simultaneous Crate Return at Counter */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center space-x-1.5">
                      <Package className="w-4 h-4" />
                      <span>{language === 'ta' ? 'காலி பெட்டிகள் வரவு (Crate Return)' : 'Empty Crates Return'}</span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {language === 'ta' ? 'அதே ரசீதில் பதிவு' : 'In Same Transaction'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Big Crates Return */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 space-y-1.5">
                      <div className="flex justify-between items-center text-[11px] text-slate-300 font-semibold">
                        <span>{language === 'ta' ? 'பெரிய பெட்டி' : 'Big Crate'}</span>
                        <span className="text-[10px] text-amber-400">Held: {currentBigCrates}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setBigCratesReturned(Math.max(0, bigCratesReturned - 1))}
                          className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 flex items-center justify-center text-slate-200 font-bold shrink-0"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={bigCratesReturned || ''}
                          onChange={(e) => setBigCratesReturned(Math.max(0, parseInt(e.target.value) || 0))}
                          placeholder="0"
                          className="w-full text-center py-2 bg-slate-950 border border-slate-700 rounded-xl text-base font-black text-amber-300 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setBigCratesReturned(bigCratesReturned + 1)}
                          className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 flex items-center justify-center text-slate-200 font-bold shrink-0"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Small Crates Return */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 space-y-1.5">
                      <div className="flex justify-between items-center text-[11px] text-slate-300 font-semibold">
                        <span>{language === 'ta' ? 'சிறிய பெட்டி' : 'Small Crate'}</span>
                        <span className="text-[10px] text-amber-400">Held: {currentSmallCrates}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setSmallCratesReturned(Math.max(0, smallCratesReturned - 1))}
                          className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 flex items-center justify-center text-slate-200 font-bold shrink-0"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={smallCratesReturned || ''}
                          onChange={(e) => setSmallCratesReturned(Math.max(0, parseInt(e.target.value) || 0))}
                          placeholder="0"
                          className="w-full text-center py-2 bg-slate-950 border border-slate-700 rounded-xl text-base font-black text-amber-300 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setSmallCratesReturned(smallCratesReturned + 1)}
                          className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 flex items-center justify-center text-slate-200 font-bold shrink-0"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. Customer Retail Ledger Mini-Statement (Retail View Only) */}
                <div className="border border-slate-800 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowLedger(!showLedger)}
                    className="w-full py-2 px-3 bg-slate-950/60 hover:bg-slate-950 text-left flex items-center justify-between text-xs text-slate-400 font-semibold"
                  >
                    <span className="flex items-center space-x-1.5">
                      <Receipt className="w-3.5 h-3.5 text-slate-400" />
                      <span>{language === 'ta' ? 'வாடிக்கையாளர் முந்தைய பில்கள் & வரவு (Retail View)' : 'Customer Recent Bills & Ledger (Retail View)'}</span>
                    </span>
                    {showLedger ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showLedger && (
                    <div className="p-3 bg-slate-950 text-xs space-y-3">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                          {language === 'ta' ? 'சமீபத்திய பில்கள்' : 'Recent Sales Bills'}
                        </span>
                        {retailHistory.sales.length === 0 ? (
                          <div className="text-[11px] text-slate-500 py-1">No recent bills</div>
                        ) : (
                          <div className="space-y-1">
                            {retailHistory.sales.map(s => (
                              <div key={s.id} className="flex justify-between py-1 border-b border-slate-800/80 text-[11px]">
                                <span>{s.saleDate} • Bill #{s.billNo}</span>
                                <span className="font-bold text-slate-200">{formatINR(s.billTotal)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                          {language === 'ta' ? 'சமீபத்திய பண வரவுகள்' : 'Recent Payments'}
                        </span>
                        {retailHistory.payments.length === 0 ? (
                          <div className="text-[11px] text-slate-500 py-1">No recent payments</div>
                        ) : (
                          <div className="space-y-1">
                            {retailHistory.payments.map(p => (
                              <div key={p.id} className="flex justify-between py-1 border-b border-slate-800/80 text-[11px]">
                                <span>{p.paymentDate} • {p.mode.toUpperCase()}</span>
                                <span className="font-bold text-emerald-400">+{formatINR(p.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Error Banner */}
                {errorMessage && (
                  <div className="p-3 rounded-2xl bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-sm rounded-2xl flex items-center justify-center space-x-2 shadow-xl shadow-emerald-950/50 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <span>
                        {language === 'ta'
                          ? `வசூலை உறுதிப்படுத்துக (${numAmount > 0 ? formatINR(numAmount) : ''})`
                          : `Confirm & Record Collection (${numAmount > 0 ? formatINR(numAmount) : ''})`}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

              </div>
            )}

          </form>
        )}

      </div>

      {/* Bottom Privacy Footnote */}
      <div className="w-full max-w-2xl mx-auto pt-2 text-center text-[11px] text-slate-500 flex items-center justify-center space-x-1 shrink-0">
        <Shield className="w-3.5 h-3.5 text-emerald-500/60" />
        <span>TSK Mandi Counter Shield: All Wholesale Cost, Lot Breakdown & Margin Figures 100% Concealed.</span>
      </div>

    </div>
  );
};
