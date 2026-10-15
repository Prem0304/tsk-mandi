// ============================================================================
// SETTINGS MODULE (SECTIONS 16 & 18)
// Shop Profile, Crate Categories, Section 9A Allocation Rules, Sample Data, Backup & Restore
// ============================================================================

import React, { useState } from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../lib/db';
import { exportFullBackupExcel } from '../../lib/excelExport';
import { CrateCategory, PaymentAllocationRule } from '../../types';
import {
  Settings as SettingsIcon,
  Save,
  Check,
  Database,
  Trash2,
  Download,
  Upload,
  Layers,
  Store,
  Shield,
  Plus,
  AlertTriangle
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { t, language, setLanguage } = useI18n();
  const { role, setRole } = useAuth();
  const { state } = useApp();

  // Settings form fields
  const [shopName, setShopName] = useState(state.settings.shopName);
  const [shopNameTa, setShopNameTa] = useState(state.settings.shopNameTa);
  const [address, setAddress] = useState(state.settings.address);
  const [phone, setPhone] = useState(state.settings.phone);
  const [upiId, setUpiId] = useState(state.settings.upiId);
  const [gstNumber, setGstNumber] = useState(state.settings.gstNumber || '');
  const [billFooter, setBillFooter] = useState(state.settings.billFooter);
  const [billFooterTa, setBillFooterTa] = useState(state.settings.billFooterTa);
  const [paymentRule, setPaymentRule] = useState<PaymentAllocationRule>(state.settings.paymentAllocationRule);
  const [autoMarkSupplierPaid, setAutoMarkSupplierPaid] = useState(state.settings.autoMarkSupplierPaid);
  const [crateAgingDays, setCrateAgingDays] = useState(state.settings.crateAgingDays);
  const [lowStockThreshold, setLowStockThreshold] = useState(state.settings.lowStockThreshold);
  const [autoLockMinutes, setAutoLockMinutes] = useState(state.settings.autoLockMinutes);
  const [appPin, setAppPin] = useState(state.settings.appPin);
  const [isSaved, setIsSaved] = useState(false);

  // Categories editor
  const [categories, setCategories] = useState<CrateCategory[]>(state.categories);
  const [newCatName, setNewCatName] = useState('');
  const [newCatNameTa, setNewCatNameTa] = useState('');

  const handleSaveSettings = () => {
    dbService.updateSettings({
      shopName,
      shopNameTa,
      address,
      phone,
      upiId,
      gstNumber: gstNumber || undefined,
      billFooter,
      billFooterTa,
      paymentAllocationRule: paymentRule,
      autoMarkSupplierPaid,
      crateAgingDays,
      lowStockThreshold,
      autoLockMinutes,
      appPin
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    const newCat: CrateCategory = {
      id: newCatName.toLowerCase().replace(/\s+/g, '_'),
      name: newCatName.trim(),
      name_ta: newCatNameTa.trim() || newCatName.trim(),
      isActive: true,
      displayOrder: categories.length + 1
    };
    dbService.saveCategory(newCat);
    setCategories([...categories, newCat]);
    setNewCatName('');
    setNewCatNameTa('');
  };

  const handleToggleCategory = (cat: CrateCategory) => {
    const updated = { ...cat, isActive: !cat.isActive };
    dbService.saveCategory(updated);
    setCategories(categories.map(c => c.id === cat.id ? updated : c));
  };

  const handleLoadSampleData = () => {
    if (confirm('Load demo mandi data (2 suppliers, customers, purchases, sales and crates)?')) {
      dbService.loadSampleData();
      alert('Sample mandi data loaded successfully!');
    }
  };

  const handleClearAllData = () => {
    if (confirm('Are you sure you want to CLEAR ALL MANDI DATA? This cannot be undone.')) {
      dbService.clearAllData();
      alert('All mandi data has been cleared.');
    }
  };

  const handleBackupNow = () => {
    exportFullBackupExcel(state);
  };

  const handleBackupJSON = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(state, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `TSK_Mandi_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleRestoreJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.settings && parsed.categories) {
          if (confirm('Restore database from this backup file? Existing data will be replaced.')) {
            localStorage.setItem('tsk_mandi_full_state_v1', JSON.stringify(parsed));
            window.location.reload();
          }
        } else {
          alert('Invalid backup file format');
        }
      } catch (err: any) {
        alert('Failed to parse backup JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-3 sm:p-5 max-w-4xl mx-auto space-y-5 pb-28 select-none">
      
      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center space-x-2">
            <SettingsIcon className="w-6 h-6 text-slate-700" />
            <span>{t('nav.settings')}</span>
          </h2>
          <p className="text-xs text-slate-500">
            Mandi profile, Section 9A rules, Crate categories & Data backups
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          className="flex items-center justify-center space-x-1.5 px-6 py-2.5 rounded-2xl bg-tomato hover:bg-rose-700 text-white font-black text-sm shadow-md active:scale-95 transition-all"
        >
          {isSaved ? <Check className="w-4 h-4 text-emerald-200" /> : <Save className="w-4 h-4" />}
          <span>{isSaved ? 'Settings Saved!' : 'Save Settings'}</span>
        </button>
      </div>

      {/* 1. MANDI PROFILE */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center space-x-2">
          <Store className="w-5 h-5 text-tomato" />
          <span>Shop & Mandi Profile</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Mandi Name (English)</label>
            <input
              type="text"
              value={shopName}
              onChange={e => setShopName(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 font-semibold text-sm"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Mandi Name (Tamil)</label>
            <input
              type="text"
              value={shopNameTa}
              onChange={e => setShopNameTa(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 font-semibold text-sm"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 font-semibold text-sm"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">UPI ID (Used for QR Code on Bills)</label>
            <input
              type="text"
              value={upiId}
              onChange={e => setUpiId(e.target.value)}
              placeholder="e.g. 9876543210@upi"
              className="w-full h-10 px-3 rounded-xl border border-slate-300 font-semibold text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="font-bold text-slate-700 block mb-1">Address / Yard Location</label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 font-medium text-xs"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">GST Number (Optional)</label>
            <input
              type="text"
              value={gstNumber}
              onChange={e => setGstNumber(e.target.value)}
              placeholder="33AABCT1234D1Z5"
              className="w-full h-10 px-3 rounded-xl border border-slate-300 font-mono text-xs"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">App 4-Digit Unlock PIN</label>
            <input
              type="text"
              maxLength={4}
              value={appPin}
              onChange={e => setAppPin(e.target.value)}
              placeholder="1234"
              className="w-full h-10 px-3 rounded-xl border border-slate-300 font-mono font-bold text-center tracking-widest text-sm"
            />
          </div>
        </div>
      </div>

      {/* 2. SECTION 9A PAYMENT & PROFIT ALLOCATION RULES */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center space-x-2">
          <Layers className="w-5 h-5 text-amber-600" />
          <span>Payment Allocation & Profit Rule (Section 9A)</span>
        </h3>

        <div className="space-y-3 text-xs">
          
          <div>
            <label className="font-bold text-slate-700 block mb-1.5">Customer Payment Split Rule</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div
                onClick={() => setPaymentRule('supplier_first')}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  paymentRule === 'supplier_first'
                    ? 'border-amber-500 bg-amber-50/70 text-amber-950 font-bold'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                <div className="font-bold text-sm mb-1">Supplier First (Default & Recommended)</div>
                <p className="text-[11px] leading-relaxed font-normal">
                  Payments clear supplier cost first, then transport, and only the remainder is realised profit.
                </p>
              </div>

              <div
                onClick={() => setPaymentRule('proportional')}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  paymentRule === 'proportional'
                    ? 'border-amber-500 bg-amber-50/70 text-amber-950 font-bold'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                <div className="font-bold text-sm mb-1">Proportional Split</div>
                <p className="text-[11px] leading-relaxed font-normal">
                  Each rupee received is split proportionally in the bill's cost : transport : profit ratio.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div>
              <h4 className="font-bold text-slate-800 text-xs">Auto-mark supplier as paid when customer pays</h4>
              <p className="text-[11px] text-slate-500">
                When ON, customer payments automatically post as supplier ledger payments (for direct settlement).
              </p>
            </div>
            <input
              type="checkbox"
              checked={autoMarkSupplierPaid}
              onChange={e => setAutoMarkSupplierPaid(e.target.checked)}
              className="w-5 h-5 accent-tomato rounded cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Crate Aging Alert (Days)</label>
              <input
                type="number"
                value={crateAgingDays}
                onChange={e => setCrateAgingDays(parseInt(e.target.value, 10) || 15)}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 font-bold text-center"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Low Stock Warning Threshold</label>
              <input
                type="number"
                value={lowStockThreshold}
                onChange={e => setLowStockThreshold(parseInt(e.target.value, 10) || 20)}
                className="w-full h-10 px-3 rounded-xl border border-slate-300 font-bold text-center"
              />
            </div>
          </div>

        </div>
      </div>

      {/* 3. CRATE CATEGORIES EDITOR */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center space-x-2">
          <Layers className="w-5 h-5 text-emerald-600" />
          <span>Tomato Crate Categories (Section 0)</span>
        </h3>

        <div className="space-y-2">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="font-bold text-slate-800 text-sm">{cat.name}</span>
                <span className="text-slate-400 ml-2">({cat.name_ta})</span>
              </div>
              <button
                type="button"
                onClick={() => handleToggleCategory(cat)}
                className={`px-3 py-1 rounded-full font-bold text-[11px] ${
                  cat.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {cat.isActive ? 'Active' : 'Inactive'}
              </button>
            </div>
          ))}
        </div>

        {/* Add Category */}
        <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="text"
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            placeholder="New Category (e.g. Medium Crate)"
            className="h-10 px-3 rounded-xl border border-slate-300 text-xs font-semibold"
          />
          <input
            type="text"
            value={newCatNameTa}
            onChange={e => setNewCatNameTa(e.target.value)}
            placeholder="Tamil Name (e.g. நடுத்தர பெட்டி)"
            className="h-10 px-3 rounded-xl border border-slate-300 text-xs font-semibold"
          />
          <button
            type="button"
            onClick={handleAddCategory}
            className="h-10 px-4 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 flex items-center justify-center space-x-1"
          >
            <Plus className="w-4 h-4" />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {/* 4. BACKUP & RESTORE & SAMPLE DATA */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center space-x-2">
          <Database className="w-5 h-5 text-indigo-600" />
          <span>Data Backup, Restore & Demo Scenario</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          
          <button
            onClick={handleBackupNow}
            className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-indigo-50/50 hover:border-indigo-300 text-left transition-all space-y-1"
          >
            <div className="font-bold text-sm text-slate-900 flex items-center space-x-1.5">
              <Download className="w-4 h-4 text-indigo-600" />
              <span>Full Backup to Excel (.xlsx)</span>
            </div>
            <p className="text-slate-500 text-[11px]">Exports all tables as individual sheets.</p>
          </button>

          <button
            onClick={handleBackupJSON}
            className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-indigo-50/50 hover:border-indigo-300 text-left transition-all space-y-1"
          >
            <div className="font-bold text-sm text-slate-900 flex items-center space-x-1.5">
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Export Database JSON</span>
            </div>
            <p className="text-slate-500 text-[11px]">Complete system snapshot for instant restore.</p>
          </button>

          <label className="p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-amber-50/50 hover:border-amber-300 text-left transition-all space-y-1 cursor-pointer block">
            <input type="file" accept=".json" onChange={handleRestoreJSON} className="hidden" />
            <div className="font-bold text-sm text-slate-900 flex items-center space-x-1.5">
              <Upload className="w-4 h-4 text-amber-600" />
              <span>Restore from Backup (.json)</span>
            </div>
            <p className="text-slate-500 text-[11px]">Restores all entities, lots and balances.</p>
          </label>

          <button
            onClick={handleLoadSampleData}
            className="p-4 rounded-2xl border border-emerald-300 bg-emerald-50 text-left transition-all space-y-1 hover:bg-emerald-100"
          >
            <div className="font-bold text-sm text-emerald-950 flex items-center space-x-1.5">
              <Check className="w-4 h-4 text-emerald-700" />
              <span>Load Mandi Demo Data</span>
            </div>
            <p className="text-emerald-800 text-[11px]">Seeds Ramu Farm, Selvam Stores & Lots L-0001/0002.</p>
          </button>

        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={handleClearAllData}
            className="flex items-center space-x-1 text-xs text-rose-600 hover:text-rose-800 font-bold"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All Data</span>
          </button>
        </div>
      </div>

    </div>
  );
};
