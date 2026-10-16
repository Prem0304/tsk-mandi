// ============================================================================
// CUSTOMER LIST VIEW (SECTION 3.2, 3.3 & 9)
// Search, Filter, Sort by Due, Add/Edit Customer, Excel Import & Export
// ============================================================================

import React, { useState, useMemo } from 'react';
import { useI18n } from '../../i18n/i18nContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../lib/db';
import { Customer } from '../../types';
import { formatINR, formatDate, getTodayDateString } from '../../lib/utils';
import {
  exportToExcel,
  exportCustomerPendingCratesExcel,
  downloadCustomerTemplate,
  parseAndValidateCustomersExcel,
  exportErrorRows,
  ImportSummary
} from '../../lib/excelExport';
import { generateCustomerPendingCratesPdf } from '../../lib/pdfGenerator';
import {
  Users,
  Search,
  Plus,
  FileSpreadsheet,
  Download,
  Upload,
  ArrowRight,
  X,
  AlertTriangle,
  CheckCircle2,
  Phone,
  MapPin,
  Box
} from 'lucide-react';

interface CustomerListViewProps {
  onSelectCustomer: (customerId: string) => void;
}

export const CustomerListView: React.FC<CustomerListViewProps> = ({ onSelectCustomer }) => {
  const { t, language } = useI18n();
  const { canEditOrDelete } = useAuth();
  const { state, customerSummaries } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlace, setSelectedPlace] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'due' | 'settled' | 'crates'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Form State for Add / Edit
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState('');
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [place, setPlace] = useState('');
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [openingDate, setOpeningDate] = useState(getTodayDateString());
  const [openingBigCrates, setOpeningBigCrates] = useState<number>(0);
  const [openingSmallCrates, setOpeningSmallCrates] = useState<number>(0);
  const [creditLimit, setCreditLimit] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Excel Import state
  const [importSummary, setImportSummary] = useState<ImportSummary<Customer> | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Distinct places for filter dropdown
  const places = useMemo(() => {
    const set = new Set<string>();
    state.customers.forEach(c => {
      if (c.place) set.add(c.place.trim());
    });
    return Array.from(set);
  }, [state.customers]);

  // Filtered & Sorted Customer list
  const filteredCustomers = useMemo(() => {
    return customerSummaries
      .filter(c => {
        const q = searchQuery.toLowerCase();
        const matchesQuery =
          c.customerName.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.shopName && c.shopName.toLowerCase().includes(q)) ||
          (c.place && c.place.toLowerCase().includes(q));

        if (!matchesQuery) return false;
        if (selectedPlace !== 'all' && c.place !== selectedPlace) return false;
        if (statusFilter === 'due' && c.currentBalance <= 0) return false;
        if (statusFilter === 'settled' && c.currentBalance > 0) return false;
        if (statusFilter === 'crates') {
          const totalHeld = Object.values(c.cratesHeld).reduce((a, b) => a + b, 0);
          if (totalHeld <= 0) return false;
        }

        return true;
      })
      .sort((a, b) => b.currentBalance - a.currentBalance); // Highest outstanding first
  }, [customerSummaries, searchQuery, selectedPlace, statusFilter]);

  const handleDownloadCratesDue = () => {
    const defaulters = customerSummaries
      .map(c => ({
        ...c,
        totalHeld: Object.values(c.cratesHeld).reduce((a, b) => a + b, 0)
      }))
      .filter(c => c.totalHeld > 0)
      .sort((a, b) => b.totalHeld - a.totalHeld);

    if (defaulters.length === 0) {
      alert(t('crates.noPendingCrates'));
      return;
    }
    exportCustomerPendingCratesExcel(defaulters, state.settings.shopName);
  };

  const openAddCustomer = () => {
    setEditCustomer(null);
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
    setFormError('');
    setIsAddModalOpen(true);
  };

  const openEditCustomer = (c: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditCustomer(c);
    setName(c.name);
    setShopName(c.shopName || '');
    setPhone(c.phone);
    setAltPhone(c.altPhone || '');
    setPlace(c.place || '');
    setOpeningBalance(c.openingMoneyBalance);
    setOpeningDate(c.openingBalanceDate);
    setOpeningBigCrates(c.openingCrates['big'] || 0);
    setOpeningSmallCrates(c.openingCrates['small'] || 0);
    setCreditLimit(c.creditLimit || '');
    setNotes(c.notes || '');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleSaveCustomer = () => {
    setFormError('');
    if (!name.trim()) {
      setFormError('Customer name is required.');
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      setFormError('Valid 10-digit phone number is required.');
      return;
    }

    const customerObj: Customer = {
      id: editCustomer ? editCustomer.id : `cust-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: name.trim(),
      shopName: shopName.trim() || undefined,
      phone: phone.trim(),
      altPhone: altPhone.trim() || undefined,
      place: place.trim() || undefined,
      notes: notes.trim() || undefined,
      openingMoneyBalance: openingBalance,
      openingBalanceDate: openingDate,
      openingCrates: { big: openingBigCrates, small: openingSmallCrates },
      creditLimit: creditLimit === '' ? null : Number(creditLimit),
      crateLimits: { big: null, small: null },
      isActive: true,
      createdAt: editCustomer ? editCustomer.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    dbService.saveCustomer(customerObj);
    setIsAddModalOpen(false);
  };

  const handleExportCustomers = () => {
    const data = customerSummaries.map(c => ({
      'Customer Name': c.customerName,
      'Shop Name': c.shopName || '',
      'Phone': c.phone,
      'Place': c.place || '',
      'Current Balance (₹)': c.currentBalance,
      'Big Crates Held': c.cratesHeld['big'] || 0,
      'Small Crates Held': c.cratesHeld['small'] || 0,
      'Credit Limit (₹)': c.creditLimit || 'None',
      'Aging Days': c.agingDays
    }));
    exportToExcel(data, 'TSK_Customers_List', 'Customers');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const summary = await parseAndValidateCustomersExcel(file, state.customers);
      setImportSummary(summary);
    } catch (err: any) {
      alert('Error reading Excel file: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCommitImport = () => {
    if (!importSummary) return;

    let importedCount = 0;
    importSummary.rows.forEach(r => {
      if (r.isValid && r.data.name && r.data.phone) {
        dbService.saveCustomer({
          id: `cust-imp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: r.data.name,
          shopName: r.data.shopName,
          phone: r.data.phone,
          altPhone: r.data.altPhone,
          place: r.data.place,
          openingMoneyBalance: r.data.openingMoneyBalance || 0,
          openingBalanceDate: r.data.openingBalanceDate || getTodayDateString(),
          openingCrates: r.data.openingCrates || { big: 0, small: 0 },
          creditLimit: r.data.creditLimit,
          notes: r.data.notes,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        importedCount++;
      }
    });

    alert(`Successfully imported ${importedCount} customers!`);
    setIsImportModalOpen(false);
    setImportSummary(null);
  };

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4 pb-24 select-none">
      
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center space-x-2">
            <Users className="w-6 h-6 text-tomato" />
            <span>{t('nav.customers')}</span>
          </h2>
          <p className="text-xs text-slate-500">
            {customerSummaries.length} total customers • Click row for Bank Passbook
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all"
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>Import Excel</span>
          </button>

          <button
            onClick={handleExportCustomers}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all"
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handleDownloadCratesDue}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-xs transition-all"
            title="Download Excel list of crates to collect"
          >
            <Box className="w-4 h-4 text-amber-700" />
            <span>Crates Due Excel</span>
          </button>

          <button
            onClick={openAddCustomer}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-tomato hover:bg-rose-700 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-12 gap-2.5">
        
        {/* Search Input */}
        <div className="sm:col-span-6 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('common.search')}
            className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-300 text-sm font-medium focus:border-tomato focus:outline-none"
          />
        </div>

        {/* Place Filter */}
        <div className="sm:col-span-3">
          <select
            value={selectedPlace}
            onChange={e => setSelectedPlace(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-slate-50 font-semibold text-xs"
          >
            <option value="all">All Places (ஊர்)</option>
            {places.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="sm:col-span-3">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-slate-50 font-semibold text-xs"
          >
            <option value="all">All Statuses</option>
            <option value="due">Due Outstanding (பாக்கி உள்ளவை)</option>
            <option value="settled">Settled (பாக்கி இல்லை)</option>
            <option value="crates">Holding Crates (பெட்டி பாக்கி)</option>
          </select>
        </div>

      </div>

      {/* Customer List Cards */}
      <div className="space-y-2">
        {filteredCustomers.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl text-center text-slate-400 text-sm border border-slate-200">
            {t('common.noData')}
          </div>
        ) : (
          filteredCustomers.map(cust => {
            const rawCust = state.customers.find(c => c.id === cust.customerId);
            const isDue = cust.currentBalance > 0;
            return (
              <div
                key={cust.customerId}
                onClick={() => onSelectCustomer(cust.customerId)}
                className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 hover:border-tomato/50 hover:shadow-md cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 active:scale-[0.99]"
              >
                {/* Left Info */}
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                      {cust.customerName}
                    </h3>
                    {cust.shopName && (
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                        {cust.shopName}
                      </span>
                    )}
                    {cust.isOverCreditLimit && (
                      <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded">
                        Credit Limit Exceeded
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                    <span className="flex items-center space-x-1">
                      <Phone className="w-3.5 h-3.5" />
                      <span>{cust.phone}</span>
                    </span>
                    {cust.place && (
                      <span className="flex items-center space-x-1">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{cust.place}</span>
                      </span>
                    )}
                    {isDue && (
                      <span className="text-amber-700 font-bold">
                        Aging: {cust.agingDays} days
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Balance & Crates */}
                <div className="flex items-center justify-between sm:justify-end space-x-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    <div className="text-[11px] text-slate-400 font-medium">Outstanding Balance</div>
                    <div className={`text-base sm:text-lg font-black ${isDue ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {formatINR(cust.currentBalance)}
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <div className="text-[11px] text-slate-400 font-medium">Crates Held</div>
                    <div className="text-xs font-bold text-slate-800">
                      Big: <span className="text-tomato">{cust.cratesHeld['big'] || 0}</span> | Small: <span className="text-tomato">{cust.cratesHeld['small'] || 0}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    {canEditOrDelete && rawCust && (
                      <button
                        onClick={(e) => openEditCustomer(rawCust, e)}
                        className="p-1.5 text-xs text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 font-semibold"
                      >
                        Edit
                      </button>
                    )}
                    <ArrowRight className="w-5 h-5 text-slate-400" />
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* ADD / EDIT CUSTOMER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 select-none">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
            
            <div className="bg-tomato text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-extrabold text-base">
                {editCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1 text-white hover:bg-white/10 rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3.5 text-slate-800">
              
              {formError && (
                <div className="bg-rose-50 border border-rose-300 text-rose-800 p-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Customer Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Selvam"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Shop Name</label>
                  <input
                    type="text"
                    value={shopName}
                    onChange={e => setShopName(e.target.value)}
                    placeholder="e.g. Selvam Stores"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Phone *</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Alt Phone</label>
                  <input
                    type="tel"
                    value={altPhone}
                    onChange={e => setAltPhone(e.target.value)}
                    placeholder="Optional"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Place / Market</label>
                  <input
                    type="text"
                    value={place}
                    onChange={e => setPlace(e.target.value)}
                    placeholder="e.g. Madurai"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Credit Limit (₹)</label>
                  <input
                    type="number"
                    value={creditLimit}
                    onChange={e => setCreditLimit(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 50000"
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm font-semibold"
                  />
                </div>
              </div>

              {/* Opening Balances (Only for new customer) */}
              {!editCustomer && (
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Opening Balances (Day One)
                  </span>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-500 font-bold">Opening Money Owed (₹)</label>
                      <input
                        type="number"
                        value={openingBalance || ''}
                        onChange={e => setOpeningBalance(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full h-9 px-2 rounded-lg border border-slate-300 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 font-bold">As-of Date</label>
                      <input
                        type="date"
                        value={openingDate}
                        onChange={e => setOpeningDate(e.target.value)}
                        className="w-full h-9 px-2 rounded-lg border border-slate-300 text-xs font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-500 font-bold">Opening Big Crates Held</label>
                      <input
                        type="number"
                        value={openingBigCrates || ''}
                        onChange={e => setOpeningBigCrates(parseInt(e.target.value, 10) || 0)}
                        placeholder="0"
                        className="w-full h-9 px-2 rounded-lg border border-slate-300 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 font-bold">Opening Small Crates Held</label>
                      <input
                        type="number"
                        value={openingSmallCrates || ''}
                        onChange={e => setOpeningSmallCrates(parseInt(e.target.value, 10) || 0)}
                        placeholder="0"
                        className="w-full h-9 px-2 rounded-lg border border-slate-300 text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Optional customer notes"
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm font-medium"
                />
              </div>

            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustomer}
                className="px-5 py-2 rounded-xl bg-tomato hover:bg-rose-700 text-white font-extrabold text-xs shadow-md"
              >
                Save Customer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* EXCEL IMPORT PREVIEW & VALIDATION MODAL (SECTION 3.3) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 select-none">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
            
            <div className="bg-emerald-600 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-extrabold text-base flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5" />
                <span>Import Customers from Excel (.xlsx)</span>
              </h3>
              <button onClick={() => setIsImportModalOpen(false)} className="p-1 text-white hover:bg-white/10 rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-slate-800 flex-1">
              
              {/* Template Download Help */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Need the template format?</h4>
                  <p className="text-[11px] text-slate-500">Download .xlsx with sample rows and headers in English + Tamil.</p>
                </div>
                <button
                  onClick={downloadCustomerTemplate}
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs shadow-xs"
                >
                  Download Template
                </button>
              </div>

              {/* Upload Input */}
              <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center cursor-pointer bg-slate-50/50">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="excel-file-upload"
                />
                <label htmlFor="excel-file-upload" className="cursor-pointer block space-y-2">
                  <Upload className="w-8 h-8 text-emerald-600 mx-auto" />
                  <span className="text-xs font-bold text-slate-700 block">
                    Click to select .xlsx customer file
                  </span>
                </label>
              </div>

              {/* Validation Preview Table */}
              {importSummary && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs bg-slate-100 p-2.5 rounded-xl font-bold">
                    <span className="text-emerald-700">✓ Valid: {importSummary.validCount}</span>
                    <span className="text-rose-700">✗ Errors: {importSummary.errorCount}</span>
                    <span className="text-amber-700">Duplicates: {importSummary.duplicateCount}</span>
                    {importSummary.errorCount > 0 && (
                      <button
                        onClick={() => exportErrorRows(importSummary.rows, 'Customer_Import')}
                        className="text-[11px] text-rose-600 underline font-bold"
                      >
                        Download Error Rows
                      </button>
                    )}
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 sticky top-0 text-[11px] font-bold text-slate-600">
                        <tr>
                          <th className="p-2">Row</th>
                          <th className="p-2">Status</th>
                          <th className="p-2">Name</th>
                          <th className="p-2">Phone</th>
                          <th className="p-2">Balance</th>
                          <th className="p-2">Notes/Errors</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importSummary.rows.map(r => (
                          <tr key={r.rowIndex} className={r.isValid ? 'bg-white' : 'bg-rose-50/60'}>
                            <td className="p-2 font-mono">{r.rowIndex}</td>
                            <td className="p-2">
                              {r.isValid ? (
                                <span className="text-emerald-700 font-bold">Valid</span>
                              ) : (
                                <span className="text-rose-700 font-bold">Error</span>
                              )}
                            </td>
                            <td className="p-2 font-bold">{r.data.name || '-'}</td>
                            <td className="p-2">{r.data.phone || '-'}</td>
                            <td className="p-2">{formatINR(r.data.openingMoneyBalance || 0)}</td>
                            <td className="p-2 text-rose-600 font-medium">{r.errors.join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs"
              >
                Close
              </button>
              {importSummary && importSummary.validCount > 0 && (
                <button
                  type="button"
                  onClick={handleCommitImport}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md"
                >
                  Import {importSummary.validCount} Valid Customers
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
