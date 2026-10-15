# 🍅 TSK Tomato and Vegetable Mandi - Wholesale Mandi Management System

A complete, production-ready, mobile-first Progressive Web Application (PWA) built specifically for **TSK Tomato and Vegetable Mandi**. Designed for phone use first at the mandi yard and desktop second.

---

## 🌟 Key Features & Business Capabilities

### 1. 🍅 Tomato Crate Stock & FIFO Lots
- **Crate Categories**: "Big Crate" and "Small Crate" (expandable, editable from Settings).
- **Lot-Wise Inventory**: Each purchase line generates an automated lot (e.g., `L-0001`, `L-0002`) tracking crates purchased, cost per crate (including transport share), and crates remaining.
- **Strict Stock Safety**: Available stock = Sum of crates remaining in open lots. **Negative stock is strictly forbidden** and blocked with clear error alerts.
- **Wastage / Spoiled Stock**: Deducts crates from lots (oldest first). Supplier is still owed cost; loss is absorbed by the shop.

### 2. ⚡ Fast Mandi Sales (Normal & Quick Sale Modes)
- **Normal Sale**: Multi-line crate inputs, live stock validation, credit limit warning, crate limit warning, and live margin preview (% margin, cost, booked profit).
- **Quick Sale Mode**: High-speed single screen for peak morning rush hours (Customer, Big Qty/Price, Small Qty/Price, Amount Received) with instant auto-reset for the next customer.
- **Bill Generation**: Thermal receipt (58mm and 80mm) & full sheet (A4 and A5) layouts with shop logo, item lines, transport, discount, balance before/after, crates pending, UPI QR code, and English/Tamil thank-you notes.
- **One-Tap WhatsApp Share**: Direct `wa.me` deep links with pre-formatted summaries for bills, balance reminders, and crate returns.

### 3. 💰 Core Payment Allocation & Profit Realization (Section 9A)
- **Supplier First (Default)**: Customer payment first clears the supplier cost of unpaid bills (oldest lots first), then transport charges (credited as transport recovery), and only the remainder is realised profit.
- **Proportional Rule**: Each rupee received is split in the bill's cost : transport : profit ratio.
- **Supplier Money in Hand**: Real-time tracking of `Money in Hand for Supplier` (collected from customers − paid out to supplier) and `Still to Collect from Customers`.
- **"Pay Collected Amount" Shortcut**: Instantly pre-fills supplier payout with the exact money collected in hand.
- **Discount & Bad Debt Handling**: Absorbed from profit first; supplier share is never reduced.
- **Live Preview**: Receive payment screen displays the split breakdown in real-time before saving.

### 4. 📦 Complete Crate Asset Management (Count Only)
- **No Deposit or Money Charged**: Reusable physical assets tracked purely by count.
- **Ownership Tagging**: "My Crates" (shop owned) vs "Supplier's Crates".
- **Shop Inventory Cards**: Total Owned | Empty in Shop | Filled with Stock | With Customers | Owed to Suppliers | Damaged / Lost.
- **Physical Count Verification**: Enter actual counted crates in shop; system logs discrepancies and adjustments.
- **Crate Defaulters**: Real-time list of customers holding crates past threshold days (default 15) with one-tap WhatsApp reminders.

### 5. 📖 Customer Bank Passbook & Supplier Ledger
- **Bank Passbook Layout**: Date | Particulars | Big Crates | Small Crates | Rate | Bought (Dr) | Paid (Cr) | Running Balance.
- **Owner Toggle "Show Split"**: Displays supplier cost share vs realised profit on payment rows. (Hidden from customer-facing PDFs and WhatsApp messages).
- **Due Aging**: 0–7, 8–15, 16–30, and >30 days with color-coded alerts (red = due, green = settled).

### 6. 💵 Daily Cash Book & Day Closing (Section 12)
- **Cash Book Equation**: `Opening Cash + Cash In − Cash Out − Cash Expenses = Expected Cash`.
- **UPI / Bank Segregation**: Separate totals for digital collections and payouts.
- **Day Closing**: Enter actual physical cash counted; system calculates differences, notes discrepancies, and automatically carries closing cash forward to the next morning.
- **Day Book**: Chronological stream of all sales, purchases, collections, payments, and expenses for any selected date.

### 7. 🌐 Bilingual English & Tamil (தமிழ்)
- **Instant Language Switcher**: Switch anytime from the top header.
- **Font Support**: Built with **Noto Sans Tamil** and Inter for crisp rendering on mobile screens and PDFs.
- **Localized Messages**: All labels, thermal bills, and WhatsApp templates adapt to the selected language.

### 8. 📱 PWA & Offline Support
- **Installable**: Add to home screen on Android and iOS as a standalone app.
- **Offline Resilient**: Local database engine powered by IndexedDB & LocalStorage with automatic background sync and a visible status indicator (`Offline / Syncing / Synced`).

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Recharts, QRcode
- **Documents & Export**: SheetJS (`xlsx`) for Excel import/export; `jspdf` + `jspdf-autotable` for bills & statements
- **Backend / Database**: Supabase PostgreSQL schema with RLS, triggers, views, and client sync bridge
- **Bundler & PWA**: Vite 6, `vite-plugin-pwa`, Workbox Service Worker

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser or phone on the same Wi-Fi.

### 3. Build for Production
```bash
npm run build
```
Production assets and PWA service worker will be generated in `dist/`.

### 4. Run Automated Acceptance Tests
```bash
npx tsx src/test_acceptance.ts
```
Verifies all 15 acceptance checks from Section 21 of the specification.

---

## 🗄️ Database Deployment (Supabase)

To connect directly to your Supabase PostgreSQL database:
1. Copy `supabase/migrations/20261015000000_tsk_schema.sql` into your Supabase SQL Editor and run it.
2. Create `.env` in the project root:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
3. The app will automatically connect to Supabase and sync offline entries seamlessly!

---

## 👥 Default Demo & Access Credentials
- **App 4-Digit Unlock PIN**: `1234` (configurable in Settings)
- **Preloaded Data**: Ramu Tomato Farm (Supplier A), Kaveri Mandi (Supplier C), Selvam Stores (Customer B), Murugan Veggies (Customer D), with initial purchase lots `L-0001` and `L-0002`.
- You can reset or reload sample data at any time from **Settings -> Data Backup & Demo Scenario**.
