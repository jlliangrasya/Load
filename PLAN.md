# LoadTrack — Load Distribution Management App
## Master Build Plan for Claude Code

---

## Important Instructions for Claude Code

- Use **plain JavaScript** only — no TypeScript, no `.ts` or `.tsx` files
- All files use `.js` and `.jsx` extensions
- No type annotations, no interfaces, no `tsconfig.json`
- Use **functional React components** with hooks throughout — no class components
- Use **Tailwind CSS** utility classes only — no custom CSS files
- All monetary inputs use `inputMode="decimal"` for numeric keypad on mobile
- Every page must have a **loading state** and an **empty state** with a helpful call-to-action
- Forms must have **validation** with friendly error messages
- Use **Filipino Peso (₱)** formatting throughout: ₱1,234.00

---

## Project Overview

A **Progressive Web App (PWA)** for a small-business load distributor (Smart & Globe) in the Philippines. The owner buys prepaid load in bulk, distributes it to retailer clients, and collects payments. The app must work **100% offline** and is optimized for **mobile phone use only**. No login system — single user app.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React (Vite) — JavaScript template |
| Styling | Tailwind CSS |
| Local Database | IndexedDB via `Dexie.js` (free, offline, built into browser) |
| Signature Pad | `react-signature-canvas` |
| Maps | `Leaflet.js` + `react-leaflet` (OpenStreetMap, free) |
| PWA | `vite-plugin-pwa` (Workbox) |
| Charts | `recharts` |
| Icons | `lucide-react` |
| Date Handling | `date-fns` |
| Unique IDs | `uuid` |
| Cloud Backup (Phase 3 only) | Firebase Firestore (free tier) |
| PDF Export (Phase 3 only) | `jspdf` + `jspdf-autotable` |

---

## Project Setup Commands

```bash
npm create vite@latest loadtrack -- --template react
cd loadtrack
npm install dexie react-signature-canvas leaflet react-leaflet recharts lucide-react date-fns uuid
npm install -D vite-plugin-pwa autoprefixer postcss tailwindcss
npx tailwindcss init -p
```

---

## Project Structure

```
loadtrack/
├── public/
│   ├── manifest.json
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── db/
│   │   └── database.js          # Dexie.js schema and instance
│   ├── hooks/
│   │   ├── useCapital.js
│   │   ├── useClients.js
│   │   ├── useDisbursements.js
│   │   └── usePayments.js
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── Capital.jsx
│   │   ├── Clients.jsx
│   │   ├── ClientDetail.jsx
│   │   ├── Disburse.jsx
│   │   ├── Payments.jsx
│   │   ├── UnpaidList.jsx
│   │   ├── History.jsx
│   │   ├── Reports.jsx
│   │   └── MapPage.jsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── BottomNav.jsx
│   │   │   └── PageHeader.jsx
│   │   ├── shared/
│   │   │   ├── StatCard.jsx
│   │   │   ├── NetworkBadge.jsx
│   │   │   ├── StatusBadge.jsx
│   │   │   ├── PaymentMethodBadge.jsx
│   │   │   ├── Toast.jsx
│   │   │   └── EmptyState.jsx
│   │   └── signature/
│   │       └── SignaturePad.jsx
│   └── utils/
│       ├── currency.js
│       └── profit.js
├── index.html
├── vite.config.js
└── tailwind.config.js
```

---

## Database Setup (`src/db/database.js`)

Use Dexie.js. This is the only database file. All other files import from here.

```js
import Dexie from 'dexie';

export const db = new Dexie('LoadTrackDB');

db.version(1).stores({
  capital_purchases: '++id, date, network, created_at',
  clients:           '++id, name, created_at',
  disbursements:     '++id, client_id, date, network, status, capital_purchase_id, created_at',
  payments:          '++id, client_id, date, method, created_at',
  app_settings:      '++id'
});
```

### Data Shape — capital_purchases
```js
{
  id,                  // auto-increment (Dexie handles this)
  date,                // "YYYY-MM-DD"
  network,             // "smart" | "globe"
  face_value,          // number — e.g. 1000
  cost_price,          // number — e.g. 950 (what he actually paid)
  commission,          // number — auto-calc: face_value - cost_price
  remaining_balance,   // number — decreases as load is disbursed
  notes,               // string | null
  created_at           // ISO datetime string
}
```

### Data Shape — clients
```js
{
  id,
  name,                // string
  contact_number,      // string
  address,             // string | null
  latitude,            // number | null  (GPS pin)
  longitude,           // number | null  (GPS pin)
  created_at,
  updated_at
}
// NOTE: Do NOT store total_load_received, total_paid, outstanding_balance
// on the client record. Always COMPUTE these live from disbursements + payments tables.
```

### Data Shape — disbursements
```js
{
  id,
  client_id,           // FK -> clients.id
  date,                // "YYYY-MM-DD"
  network,             // "smart" | "globe"
  face_value,          // number — load value sent to client
  selling_price,       // number — what client is charged
  markup,              // number — auto-calc: selling_price - face_value
  status,              // "success" | "failed" | "returned"
  failure_reason,      // string | null — shown only if failed or returned
  capital_purchase_id, // FK -> capital_purchases.id
  notes,               // string | null
  created_at
}
```

### Data Shape — payments
```js
{
  id,
  client_id,           // FK -> clients.id
  date,                // "YYYY-MM-DD"
  amount,              // number
  method,              // "cash" | "gcash" | "online_transfer"
  reference_number,    // string | null — for gcash and online_transfer
  signature_image,     // string — base64 PNG from signature canvas
  notes,               // string | null
  created_at
}
```

### Data Shape — app_settings
```js
{
  id: 1,               // always 1 — single settings record
  default_smart_markup,  // number — default markup amount for Smart
  default_globe_markup,  // number — default markup amount for Globe
  owner_name,          // string
  business_name        // string
}
```

---

## Custom Hooks

Each hook handles all database reads and writes for its domain. Pages import hooks — pages never call `db` directly.

### `useClients.js`
Export:
- `clients` — live array from db (use `useLiveQuery` from dexie-react-hooks)
- `addClient(data)` — insert new client
- `updateClient(id, data)` — update client fields
- `deleteClient(id)` — delete client + all their disbursements and payments
- `getClientBalance(clientId)` — async function: queries disbursements (success only) and payments to compute outstanding balance

### `useCapital.js`
Export:
- `purchases` — live array, newest first
- `addPurchase(data)` — insert, auto-calc commission
- `getRemainingBalance(network)` — sum remaining_balance for a network
- `deductFromCapital(capitalPurchaseId, amount)` — subtract from remaining_balance

### `useDisbursements.js`
Export:
- `disbursements` — live array, newest first
- `addDisbursement(data)` — insert; if status is success, call deductFromCapital
- `updateStatus(id, status, reason)` — update status and failure_reason; if changing TO failed/returned from success, refund capital

### `usePayments.js`
Export:
- `payments` — live array, newest first
- `addPayment(data)` — insert payment with signature

---

## Pages

---

### Dashboard (`/`)

Stat cards:
- Smart Load Balance — sum of remaining_balance where network = smart
- Globe Load Balance — sum of remaining_balance where network = globe
- Total Outstanding — sum of all client outstanding balances (red color)
- Collected Today — sum of payments where date = today
- Disbursed Today — sum of successful disbursements where date = today
- Unpaid Clients — count of clients with balance > 0 (tappable → /unpaid)

Sections below stats:
- Recent Disbursements (last 5 records) — show client name, amount, network badge, status badge
- Recent Payments (last 5 records) — show client name, amount, method badge

Quick Action buttons at bottom: [+ Buy Load] [+ Disburse] [+ Record Payment]

---

### Capital Page (`/capital`)

Add form:
- Network toggle: Smart | Globe (required)
- Face Value ₱ (required, numeric)
- Cost Price ₱ (required, numeric) — what he actually paid
- Commission — read-only display, auto-calc as face_value - cost_price
- Date — date picker, defaults to today
- Notes — optional textarea

List view (below form):
- All purchases newest first
- Show: network badge, face value, cost price, commission earned, remaining balance
- Remaining balance in red if below ₱500
- Tap row to expand and see disbursements that came from that batch

---

### Clients Page (`/clients`)

Search bar at top. Filter tabs: All | With Balance | Fully Paid

Client card shows:
- Name + contact number (tap contact to dial)
- Outstanding balance — green if ₱0, red if >₱0
- [Disburse] and [Pay] quick action buttons → pre-fills the form with this client

Floating [+ Add Client] button.

Add/Edit Client form (modal or new page):
- Name (required)
- Contact Number (required)
- Address (optional)
- GPS Pin section — two buttons:
  - "Use My Current Location" — uses browser geolocation API
  - "Pick on Map" — opens a Leaflet map where he drags a pin to the client's location
  - Shows lat/lng if pinned, with a [Clear Pin] option

---

### Client Detail Page (`/clients/:id`)

Header: client name, contact, address, outstanding balance

Tabs:
1. Summary — total load received (successful only), total paid, balance
2. Disbursements — list of all disbursements to this client, newest first, with status badge. Failed/returned rows in muted color.
3. Payments — list of all payments from this client, newest first, with method badge and [View Signature] button
   - Signature viewer: modal overlay showing the saved base64 signature image, plus date, amount, and method

---

### Disburse Load Page (`/disburse`)

Form:
- Client — searchable dropdown (required). Show client's current balance below their name.
- Network — Smart | Globe toggle (required)
- Face Value ₱ — numeric input (required)
- Selling Price ₱ — numeric input, pre-filled as face_value + default markup for that network. Editable.
- Markup — read-only display: selling_price - face_value
- Status — 3-button toggle: Success | Failed | Returned (default: Success)
- Failure Reason — text input, visible only when status is Failed or Returned
- Capital Batch — auto-selected: oldest batch for the chosen network with remaining_balance > 0. Show batch date and remaining balance. Allow manual override via dropdown.
- Date — defaults to today
- Notes — optional

Save logic:
- If status = success: deduct face_value from capital batch remaining_balance
- If status = failed or returned: do NOT touch capital balance; log for reporting only

---

### Payments Page (`/payments`)

Step 1 — Fill payment details:
- Client — searchable dropdown. Show outstanding balance. (required)
- Amount ₱ — numeric input. [Pay Full Balance] button auto-fills.
- Payment Method — 3 buttons: Cash | GCash | Online Transfer
- Reference Number — text input, shown only for GCash and Online Transfer
- Date — defaults to today
- Notes — optional

Step 2 — Signature (after tapping [Proceed to Signature]):
- Full-screen white canvas
- Instruction text at top: "Please hand the phone to the client to sign"
- Client signs with finger
- [Clear] button resets canvas
- [Confirm & Save] saves the payment with the signature as base64 PNG
- Do not allow saving without a signature

---

### Unpaid List Page (`/unpaid`)

Header: total outstanding amount across all clients

List sorted by outstanding balance, highest first. Each row:
- Client name
- Contact number (tap to dial)
- Outstanding balance in red
- [Collect] button → opens Payment form pre-filled for this client

Empty state: "All clients are paid up!" with a checkmark illustration.

---

### History Page (`/history`)

Tabs: Disbursements | Payments

Filter bar (collapsible):
- Date range: From / To
- Network: All | Smart | Globe (disbursements tab only)
- Status: All | Success | Failed | Returned (disbursements tab only)
- Method: All | Cash | GCash | Online Transfer (payments tab only)
- Client: text search

Disbursement row: date, client name, network badge, face value, selling price, markup, status badge
Payment row: date, client name, amount, method badge, [View Signature] icon button

---

### Reports Page (`/reports`)

Toggle: Monthly | By Session

**Monthly view:**
- Month/year picker (prev/next arrows)
- Summary cards:
  - Total Capital Spent (what he paid for load)
  - Commission Earned (sum of commission from purchases in period)
  - Markup Earned (sum of markup from successful disbursements in period)
  - Gross Income (total collected from payments in period)
  - Losses (face value of failed + returned disbursements)
  - Net Profit = Commission + Markup - Losses
- Bar chart (recharts): Smart vs Globe disbursement amounts per week
- Line chart (recharts): Daily collections for the month

**By Session view:**
- List of capital purchase batches
- Each row: date, network, face value, cost price, commission, status (active/depleted)
- Tap to expand: shows all disbursements from that batch + profit from that batch

**Profit formula:**
```
commission_earned = face_value - cost_price  (per purchase)
markup_earned = sum of markup on successful disbursements
gross_profit = commission_earned + markup_earned
losses = sum of face_value of failed/returned disbursements in period
net_profit = gross_profit - losses
```

---

### Map Page (`/map`)

Full-screen Leaflet map (OpenStreetMap tiles — free).

Markers for every client that has latitude + longitude set.
Tapping a marker shows a popup: client name, contact number, outstanding balance, [Call] and [Collect] buttons.

Below the map:
- List of clients WITHOUT a pin, each with a [Pin Location] button
- [+ Add Client] button

Top-right corner:
- [Share Map] button — encodes all pinned clients (name, address, lat, lng only — no balance) as base64 JSON, appends as URL query param `?data=...`, copies the URL to clipboard. Shows a toast: "Map link copied! Share it with your collector."

### Shared/Read-only Map (`/shared-map`)
- Reads `?data=` query param, decodes base64 JSON
- Renders a clean Leaflet map with all client pins
- Popup shows: name and address only (no financial info)
- No app navigation — just the map
- Works on any phone browser without the app installed

---

## UI Layout

- Max width 430px, centered on larger screens
- **Bottom navigation bar** (fixed at bottom): 5 tabs
  - Dashboard (home icon)
  - Clients (users icon)
  - Disburse (send icon)
  - Payments (wallet icon)
  - More (menu icon) → opens a sheet with: History, Reports, Map, Capital, Settings
- Page header: back arrow (on sub-pages), page title, optional right action button

## Color System (Tailwind classes)
- Smart network: `bg-blue-100 text-blue-800`
- Globe network: `bg-red-100 text-red-800`
- Success: `bg-green-100 text-green-800`
- Failed: `bg-red-100 text-red-800`
- Returned: `bg-amber-100 text-amber-800`
- GCash: `bg-purple-100 text-purple-800`
- Cash: `bg-gray-100 text-gray-700`
- Online Transfer: `bg-teal-100 text-teal-800`

---

## Offline-First Architecture

- All data lives in **IndexedDB via Dexie.js** — zero network calls for any CRUD operation
- Service Worker (vite-plugin-pwa / Workbox) caches all app assets on first load
- App shell loads instantly even with no internet
- OpenStreetMap tiles cached after first map load (CacheFirst strategy, 30-day expiry)
- Signature images stored as base64 strings in IndexedDB — no file system needed
- Small connection status indicator in header (online/offline badge) — informational only, never blocks any feature

---

## PWA Config (`vite.config.js`)

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'LoadTrack',
        short_name: 'LoadTrack',
        description: 'Load distribution tracker for Smart and Globe distributors',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      }
    })
  ]
})
```

---

## Tailwind Config (`tailwind.config.js`)

```js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: []
}
```

---

## Sample Seed Data (First Launch)

On first app launch, if IndexedDB is empty, seed sample data so the owner can explore the app before entering real data. Include a [Clear Sample Data] button in Settings.

Seed:
- 2 capital purchases — 1 Smart (₱2,000 face / ₱1,900 cost), 1 Globe (₱1,000 face / ₱950 cost)
- 5 clients with Filipino names, contact numbers, and GPS coordinates in Metro Manila area
- 8 disbursements — mix of success (6), failed (1), returned (1) across the clients
- 4 payments — 2 cash, 1 gcash, 1 online transfer — with a placeholder flat-line signature image

---

## Build Phases

### Phase 1 — Core (Build This First)
- [ ] Vite + React (JS) project setup
- [ ] Tailwind CSS configured
- [ ] Dexie.js database file with all tables
- [ ] All custom hooks (useClients, useCapital, useDisbursements, usePayments)
- [ ] Bottom navigation layout + PageHeader component
- [ ] Shared components (StatCard, NetworkBadge, StatusBadge, PaymentMethodBadge, Toast, EmptyState)
- [ ] Dashboard page
- [ ] Capital page
- [ ] Clients page + Add/Edit form with GPS pin
- [ ] Disburse page with success/failed/returned status
- [ ] Payments page with full-screen signature canvas
- [ ] Unpaid List page
- [ ] Sample seed data on first launch
- [ ] PWA service worker (offline support)

### Phase 2 — Analytics, History & Map
- [ ] Client Detail page with disbursements + payments tabs + signature viewer
- [ ] History page with filters
- [ ] Reports page — monthly + by session, recharts bar and line charts
- [ ] Map page — Leaflet with client pins, tap popup, share button
- [ ] Shared read-only map page (/shared-map)
- [ ] Settings page (default markup per network, business name, clear sample data)

### Phase 3 — Cloud Backup & Export (Optional, Build Later)
- [ ] Firebase Firestore setup (free tier)
- [ ] Background sync — on reconnect, push local IndexedDB data to Firestore
- [ ] Restore from cloud — if app is installed on a new phone, pull data from Firestore
- [ ] PDF receipt export per payment (jspdf) — shows client name, amount, date, method, signature
- [ ] Monthly report export to spreadsheet (xlsx)

---

## Notes for Claude Code

1. JavaScript only — `.js` and `.jsx` files only. No TypeScript.
2. Use `useLiveQuery` from `dexie-react-hooks` for all reactive database reads so the UI auto-updates when data changes.
3. Never import `db` directly in page components — always go through hooks.
4. The `outstanding_balance` for a client is always computed live: sum of `selling_price` from successful disbursements minus sum of `amount` from payments. Never cache this value.
5. When a disbursement is marked `failed` or `returned`, it must not deduct from capital and must not add to the client's balance.
6. The signature canvas must be full-screen (100vw x 100vh) so a client can comfortably sign with their finger on a mobile phone.
7. Use `inputMode="decimal"` on all monetary amount fields so mobile users get the numeric keypad.
8. All delete actions must show a confirmation dialog before proceeding.
9. Show toast notifications for all save/update/delete actions.
10. Install `dexie-react-hooks` alongside `dexie`: `npm install dexie-react-hooks`