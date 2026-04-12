# ๐“ CYMS โ€” Developer Handoff Document
> **Container Yard Management System**  
> Version: Phase 1-9 + FR1-6 + NFR + Master Setup + Customer Management + Gate Auto-Allocation + EIR A5 + 2-Phase Gate-Out + File Storage + Notifications + **Tiered Billing + Printable Invoice/Receipt + Bay View + 3D Search Highlight + Gate History Search + Container Detail Modal + Search Detail Panel + Boxtech API + ISO 6346 Check Digit + Prefix Mapping + Gate-In Billing + Gate-Out Billing Fix + SSE Real-Time Operations + Billing Reports + ERP Export Fix + Hold Logic Fix + Dashboard Gate-Out + CODECO Outbound EDI + SFTP Integration + Email EDI Delivery + EDI Auto-Schedule (node-cron) + Production Readiness (Auth Proxy + Rate Limiting + Input Validation + Audit Trail) + Dwell Days Display + Demurrage Calculator + Container Tracking Timeline + Table Pagination + Custom ConfirmDialog + SQL Injection Audit + Automated Testing + Dashboard Analytics + Credit Note + AR Aging Report + Auto-Allocation DB Rules + M&R Hardening + CEDEX Thai + PDF Export + Calendar Days Dwell + EDI Template System + Gate Component Decomposition + Password Policy & Account Lockout + Inter-Yard Transfer Hardening + PWA Camera OCR + B4 Reports + RBAC Reports Module + API Integration Tests (195 tests) + Notification Cross-Browser Sync + Gate Reports + Security Hardening + Next.js 16 Proxy Migration + Auth Session Persistence Fix + Multi-Role Customer Master (Boolean Flags + Multi-Branch + Auto-Code) + Tariff Matrix (Customer x Size x Cargo Status) + Prefix One-to-Many (Halt Rule + Booking Priority + is_primary) + Owner/Billing Separation (container_owner_id + billing_customer_id + SOC/COC)** (~100%) (เธฃเธฐเธเธเธเธฃเธดเธซเธฒเธฃเธเธฑเธ”เธเธฒเธฃเธฅเธฒเธเธ•เธนเนเธเธญเธเน€เธ—เธเน€เธเธญเธฃเนเธญเธฑเธเธเธฃเธดเธขเธฐ)  
> เธชเนเธเธกเธญเธเธเธฒเธ: 26 เธกเธตเธเธฒเธเธก 2569 | เน€เธงเธญเธฃเนเธเธฑเธ: เน€เธเธช 1-9 + FR1-6 + NFR + Master Setup + Customer Management + Gate Auto-Allocation + EIR A5 + 2-Phase Gate-Out + File Storage + Notifications + **Tiered Billing + Printable Invoice/Receipt + Bay View + 3D Search Highlight + Gate History Search + Container Detail Modal + Search Detail Panel + Boxtech API + ISO 6346 Check Digit + Prefix Mapping + Gate-In Billing + Gate-Out Billing Fix + SSE Real-Time Operations + Billing Reports + ERP Export Fix + Hold Logic Fix + Dashboard Gate-Out + CODECO Outbound EDI + SFTP Integration + ๐“ง Email EDI Delivery + โฐ EDI Auto-Schedule (node-cron) + ๐” Production Readiness (Auth Proxy + Rate Limiting + Input Validation + Audit Trail) + Dwell Days Display + Demurrage Calculator + Container Tracking Timeline + ๐“ Table Pagination + ๐จ Custom ConfirmDialog + ๐”’ SQL Injection Audit + ๐งช Automated Testing + ๐“ Dashboard Analytics (Range Toggle 7d/30d/3m) + ๐’ณ Credit Note + ๐“ AR Aging Report + ๐—๏ธ Auto-Allocation DB Rules + ๐”ง M&R Hardening + ๐ CEDEX Thai + ๐“ PDF Export + ๐“… Calendar Days Dwell + ๐“ EDI Template System + ๐งฉ Gate Component Decomposition + ๐” Password Policy & Account Lockout + ๐ Inter-Yard Transfer Hardening + ๐“ท PWA Camera OCR (Smart Container Scanner) + ๐“ B4 Reports (Dwell + M&R + Excel Export) + ๐” RBAC Reports Module + ๐ Dashboard Shipping Line Chart Fix + โก Gate History Auto-search Debounce + ๐งช API Integration Tests (194 tests) + ๐”” Notification Cross-Browser Sync + ๐“ Gate Reports (Daily In/Out + Summary In/Out) + ๐” Code Review Fixes (DB Reconnect + Token Expiry + Zod Validation) + ๐ก๏ธ Security Hardening (JWT Fail-Fast + Users RBAC + Proxy Header Fix + Uploads Path-Traversal) + ๐” Next.js 16 Proxy Migration + ๐ Auth Session Persistence Fix + ๐ข Multi-Role Customer Master (Boolean Flags + Multi-Branch + Auto-Code)** (~100%)

---

## 1. เธ เธฒเธเธฃเธงเธกเนเธเธฃเน€เธเธ

**CYMS** เธเธทเธญเธฃเธฐเธเธเธเธฃเธดเธซเธฒเธฃเธฅเธฒเธเธ•เธนเนเธเธญเธเน€เธ—เธเน€เธเธญเธฃเนเนเธเธเธฃเธงเธกเธจเธนเธเธขเน เธฃเธญเธเธฃเธฑเธเธซเธฅเธฒเธขเธชเธฒเธเธฒ (Multi-Yard) เธ—เธณเธเธฒเธ Real-time เธเนเธฒเธ Web + PWA

### เธชเธ–เธฒเธเธฐเธเธฑเธเธเธธเธเธฑเธ

| เน€เธเธช | เธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ” | เธชเธ–เธฒเธเธฐ |
|-----|-----------|-------|
| **เน€เธเธช 1** | เธงเธฒเธเธฃเธฒเธเธเธฒเธ โ€” เนเธเธฃเน€เธเธ, Design System, DB Schema | โ… เน€เธชเธฃเนเธ |
| **เน€เธเธช 2** | เธฅเนเธญเธเธญเธดเธ, Dashboard, เธ•เธฑเนเธเธเนเธฒเธฃเธฐเธเธ, RBAC | โ… เน€เธชเธฃเนเธ |
| **เน€เธเธช 3** | เธเธฑเธ”เธเธฒเธฃเธฅเธฒเธ, 3D Viewer, **Bay Cross-Section View**, Auto-Allocation, เธเนเธเธซเธฒเธ•เธนเน + **3D Highlight + Detail Panel**, Yard Audit, **PWA Card View**, **Container Detail Modal** | โ… เน€เธชเธฃเนเธ |
| **เน€เธเธช 4** | Gate In/Out, EIR, เธ•เธฃเธงเธเธชเธ เธฒเธเธ•เธนเน, OCR, Seal Photo, Signature, Inter-Yard Transfer | โ… เน€เธชเธฃเนเธ |
| **เน€เธเธช 5** | เธเธเธดเธเธฑเธ•เธดเธเธฒเธฃ, Job Queue, Smart Shifting, **Tablet-optimized buttons** | โ… เน€เธชเธฃเนเธ |
| **เน€เธเธช 6** | EDI, Booking/Manifest, Seal Validation, **CSV/Excel file import**, **CODECO Outbound (EDIFACT/CSV/JSON)**, **SFTP auto-upload**, **๐“ง Email delivery**, **โฐ Auto-Schedule (node-cron)** | โ… เน€เธชเธฃเนเธ |
| **เน€เธเธช 7** | เธเนเธญเธกเธเธณเธฃเธธเธ M&R, EOR, CEDEX, **Audit Trail, Zod Validation, Actual Cost Modal, CEDEX เธ เธฒเธฉเธฒเนเธ—เธข** | โ… เน€เธชเธฃเนเธ |
| **เน€เธเธช 8** | เธเธฑเธเธเธต Billing, Tariff, Hold/Release, **Tiered Storage Rates, Gate-Out Billing, Gate-In Billing, A4 Invoice/Receipt Print, Demurrage Calculator** | โ… เน€เธชเธฃเนเธ |
| **เน€เธเธช 9** | PWA, Toast, UI Polish, Print | โ… เน€เธชเธฃเนเธ |

---

## 2. Tech Stack

| เธชเนเธงเธ | เน€เธ—เธเนเธเนเธฅเธขเธต | เน€เธงเธญเธฃเนเธเธฑเธ |
|------|----------|---------|
| **Framework** | Next.js (App Router) | 16.1+ |
| **Language** | TypeScript | 5.x |
| **Runtime** | Node.js | v24.13.0 |
| **Styling** | Tailwind CSS | v4.2 (PostCSS, `@variant`, `@theme`) |
| **3D Rendering** | Three.js | latest |
| **Database** | MS SQL Server (เนเธขเธ Server) | เธเนเธฒเธ `mssql` package |
| **Auth** | JWT + bcrypt | `jose` (Edge-compatible) + `bcryptjs` |
| **OCR** | Tesseract.js | `tesseract.js` |
| **QR Code** | qrcode.react | `qrcode.react` |
| **Excel/CSV** | SheetJS | `xlsx` |
| **Boxtech API** | BIC Container DB (external) | REST API v2.0 |
| **SFTP Client** | ssh2-sftp-client | `ssh2-sftp-client` |
| **Validation** | Zod | `zod` |
| **PDF Export** | jsPDF + jspdf-autotable | เธเธญเธเธ•เน Sarabun (Google Fonts, embedded base64) |
| **Testing** | Jest + ts-jest | `jest` + `ts-jest` |
| **Package Manager** | npm | - |

---

## 3. เธเธฒเธฃ Setup เนเธเธฃเน€เธเธ

### 3.1 เธ•เธดเธ”เธ•เธฑเนเธ Dependencies

```bash
cd d:\Antigravity\container-yard-system
npm install
```

### 3.2 เธ•เธฑเนเธเธเนเธฒ Environment Variables

เนเธเธฅเน `.env.local` (เธ—เธตเน root เธเธญเธเนเธเธฃเน€เธเธ):

```env
# Database (MS SQL Server โ€” เนเธขเธ Server)
DB_SERVER=192.168.110.106
DB_INSTANCE=alpha
DB_NAME=CYMS_DB
DB_USER=sa
DB_PASSWORD=<เธฃเธซเธฑsเธเนเธฒเธ>
DB_PORT=1433

# Authentication (JWT)
JWT_SECRET=<secret-key>
JWT_EXPIRES_IN=8h

# Application
PORT=3005
NEXT_PUBLIC_APP_NAME=CYMS
NEXT_PUBLIC_APP_TITLE=เธฃเธฐเธเธเธเธฃเธดเธซเธฒเธฃเธเธฑเธ”เธเธฒเธฃเธฅเธฒเธเธ•เธนเนเธเธญเธเน€เธ—เธเน€เธเธญเธฃเนเธญเธฑเธเธเธฃเธดเธขเธฐ
NEXT_PUBLIC_DEFAULT_YARD_ID=1

# File Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Boxtech API (BIC Container Database)
BOXTECH_USERNAME=<email>
BOXTECH_PASSWORD=<password>
```

### 3.3 Setup Database

```bash
# 1. เธชเธฃเนเธฒเธเธเธฒเธเธเนเธญเธกเธนเธฅ + เธ•เธฒเธฃเธฒเธ (14 เธ•เธฒเธฃเธฒเธ)
node scripts/setup-db.js

# 2. Seed เธเนเธญเธกเธนเธฅเธเธนเนเนเธเน (5 demo accounts)
node scripts/seed-users.js

# 3. Seed เธชเธดเธ—เธเธดเน (40 permissions ร— 6 roles โ€” เธฃเธงเธก reports module)
node scripts/seed-permissions.js

# 4. Seed เธเนเธญเธกเธนเธฅเธ•เธนเน (10 zones + ~925 containers)
node scripts/seed-containers.js

# 5. เธชเธฃเนเธฒเธเธ•เธฒเธฃเธฒเธ StorageRateTiers + เธเนเธฒเน€เธฃเธดเนเธกเธ•เนเธ
node scripts/migrate-storage-tiers.js

# 6. เธชเธฃเนเธฒเธเธ•เธฒเธฃเธฒเธ EDIEndpoints + EDISendLog
node scripts/migrate-edi-endpoints.js

# 7. เธชเธฃเนเธฒเธเธ•เธฒเธฃเธฒเธ DemurrageRates + เธเนเธฒเน€เธฃเธดเนเธกเธ•เนเธ
node scripts/migrate-demurrage.js
```

### 3.4 เธฃเธฑเธเนเธเธฃเน€เธเธ

```bash
npm run dev
# เน€เธเธดเธ” http://localhost:3005
```

### 3.5 เธเธฑเธเธเธตเธ—เธ”เธชเธญเธ

| Username | Password | เธเธ—เธเธฒเธ— | เธชเธดเธ—เธเธดเน |
|----------|----------|-------|--------|
| `admin` | `admin123` | เธเธนเนเธ”เธนเนเธฅเธฃเธฐเธเธ | เธ—เธธเธเน€เธกเธเธน |
| `gate01` | `gate123` | เธเธเธฑเธเธเธฒเธเธเธฃเธฐเธ•เธน | Gate In/Out |
| `survey01` | `survey123` | เธเนเธฒเธเธ•เธฃเธงเธ | Survey, M&R |
| `driver01` | `driver123` | เธเธเธเธฑเธเธฃเธ–เธขเธ | RS Driver |
| `billing01` | `billing123` | เธเธฑเธเธเธต | Billing |

---

## 4. เนเธเธฃเธเธชเธฃเนเธฒเธเนเธเธฃเน€เธเธ

```
container-yard-system/
โ”โ”€โ”€ .env.local                    # เธเนเธฒ config (DB, JWT, App)
โ”โ”€โ”€ scripts/
โ”   โ”โ”€โ”€ setup-db.js               # เธชเธฃเนเธฒเธ DB + 14 เธ•เธฒเธฃเธฒเธ
โ”   โ”โ”€โ”€ seed-users.js             # Seed 5 demo users
โ”   โ”โ”€โ”€ seed-permissions.js       # Seed 33 permissions ร— 6 roles (incl. customers module)
โ”   โ”โ”€โ”€ seed-containers.js        # Seed 10 zones + 925 containers
โ”   โ”โ”€โ”€ migrate-storage-tiers.js  # เธชเธฃเนเธฒเธเธ•เธฒเธฃเธฒเธ StorageRateTiers + เธเนเธฒเน€เธฃเธดเนเธกเธ•เนเธ 4 เธเธฑเนเธ
โ”   โ”โ”€โ”€ migrate-edi-endpoints.js  # เธชเธฃเนเธฒเธเธ•เธฒเธฃเธฒเธ EDIEndpoints + EDISendLog (SFTP config)
โ”   โ”โ”€โ”€ migrate-edi-schedule.js   # **เน€เธเธดเนเธก schedule columns** (schedule_enabled, schedule_cron, schedule_last_run, schedule_yard_id)
โ”   โ”โ”€โ”€ migrate-edi-templates.js  # **๐“ เธชเธฃเนเธฒเธเธ•เธฒเธฃเธฒเธ EDITemplates** + seed 3 default templates + เน€เธเธดเนเธก template_id เนเธ EDIEndpoints
โ”   โ”โ”€โ”€ migrate-demurrage.js      # เธชเธฃเนเธฒเธเธ•เธฒเธฃเธฒเธ DemurrageRates + default rates
โ”   โ””โ”€โ”€ update-cedex-thai.js      # **๐ เธญเธฑเธเน€เธ”เธ• CEDEX codes เน€เธเนเธเธ เธฒเธฉเธฒเนเธ—เธข** (29 codes)
โ”
โ”โ”€โ”€ src/
โ”   โ”โ”€โ”€ app/
โ”   โ”   โ”โ”€โ”€ layout.tsx            # Root layout (fonts, providers)
โ”   โ”   โ”โ”€โ”€ page.tsx              # Root redirect (โ’ login or dashboard)
โ”   โ”   โ”โ”€โ”€ globals.css           # Tailwind v4 + @variant dark + high-contrast theme
โ”   โ”   โ”โ”€โ”€ login/
โ”   โ”   โ”   โ””โ”€โ”€ page.tsx          # เธซเธเนเธฒ Login (glassmorphism)
โ”   โ”   โ”
โ”   โ”   โ”โ”€โ”€ (dashboard)/
โ”   โ”   โ”   โ”โ”€โ”€ layout.tsx        # Dashboard layout (sidebar + topbar + auth check + **global fetch interceptor**)
โ”   โ”   โ”   โ”โ”€โ”€ dashboard/page.tsx   # เธซเธเนเธฒ Dashboard (KPI cards: เธ•เธนเน/เธญเธฑเธ•เธฃเธฒเน€เธ•เนเธก/Gate-In/Gate-Out/เธฃเธฒเธขเนเธ”เน)
โ”   โ”   โ”   โ”โ”€โ”€ yard/page.tsx     # เธซเธเนเธฒเธเธฑเธ”เธเธฒเธฃเธฅเธฒเธ (4 tabs: เธ เธฒเธเธฃเธงเธก/เธเนเธเธซเธฒ/เธเธฑเธ”เธงเธฒเธเธ•เธนเน/เธ•เธฃเธงเธเธเธฑเธ) + **Dwell Days column** + **7 summary cards (incl. Overdue + Avg Dwell)**
โ”   โ”   โ”   โ”โ”€โ”€ gate/
โ”   โ”   โ”   โ”   โ”โ”€โ”€ page.tsx          # **๐งฉ Orchestrator** (95 lines) โ€” tab switching + EIR modal + Timeline modal
โ”   โ”   โ”   โ”   โ”โ”€โ”€ types.ts          # Shared types (Transaction, ContainerResult, BillingCharge, BillingData) + CSS constants
โ”   โ”   โ”   โ”   โ”โ”€โ”€ GateInTab.tsx     # Gate-In: auto-allocation + **ISO 6346 check digit** + **Boxtech auto-fill** + **prefixโ’customer** + billing + inspection + OCR
โ”   โ”   โ”   โ”   โ”โ”€โ”€ GateOutTab.tsx    # Gate-Out: **2-Phase workflow** (เธเธญเธ”เธถเธ โ’ เธฃเธญเธฃเธ–เธขเธ โ’ เธเธฅเนเธญเธขเธญเธญเธ) + billing + payment
โ”   โ”   โ”   โ”   โ”โ”€โ”€ HistoryTab.tsx    # เธเธฃเธฐเธงเธฑเธ•เธด Gate: search + date filter + pagination + **Excel export**
โ”   โ”   โ”   โ”   โ””โ”€โ”€ TransferTab.tsx   # เธขเนเธฒเธขเธเนเธฒเธกเธฅเธฒเธ: send transfer + receive in-transit
โ”   โ”   โ”   โ”โ”€โ”€ operations/page.tsx # เธซเธเนเธฒเธเธเธดเธเธฑเธ•เธดเธเธฒเธฃ (3 tabs: Job Queue/เธชเธฃเนเธฒเธเธเธฒเธ/Shifting)
โ”   โ”   โ”   โ”โ”€โ”€ edi/page.tsx      # เธซเธเนเธฒ EDI (4 tabs: Bookings/เธเธณเน€เธเนเธฒ/เธ•เธฃเธงเธเธเธตเธฅ/CODECO)
โ”   โ”   โ”   โ”โ”€โ”€ mnr/page.tsx      # เธซเธเนเธฒ M&R (3 tabs: EOR/เธชเธฃเนเธฒเธ EOR/เธฃเธซเธฑเธชเธเธงเธฒเธกเน€เธชเธตเธขเธซเธฒเธข) + **actual_cost modal + notes field + user_id tracking**
โ”   โ”   โ”   โ”โ”€โ”€ billing/
โ”   โ”   โ”   โ”   โ”โ”€โ”€ page.tsx          # เธซเธเนเธฒเธเธฑเธเธเธต (8 tabs: เนเธเนเธเนเธเธซเธเธตเน/เธชเธฃเนเธฒเธเธเธดเธฅ/Tariff/Hold/เน€เธญเธเธชเธฒเธฃ/ERP/เธฃเธฒเธขเธเธฒเธ/**Demurrage**)
โ”   โ”   โ”   โ”   โ””โ”€โ”€ DemurrageTab.tsx  # **Demurrage Calculator** โ€” overview + risk cards + editable rates + per-container calculator + timeline
โ”   โ”   โ”   โ””โ”€โ”€ settings/
โ”   โ”   โ”       โ”โ”€โ”€ page.tsx              # เธซเธเนเธฒเธ•เธฑเนเธเธเนเธฒ (12 tabs, เธฃเธงเธก Rate Limit)
โ”   โ”   โ”       โ”โ”€โ”€ CompanySettings.tsx    # CRUD เธเนเธญเธกเธนเธฅเธญเธเธเนเธเธฃ (+ logo upload + branch)
โ”   โ”   โ”       โ”โ”€โ”€ YardsSettings.tsx      # CRUD เธฅเธฒเธ + เนเธเธ (+ branch เธชเธณเธเธฑเธเธเธฒเธเนเธซเธเน/เธชเธฒเธเธฒ)
โ”   โ”   โ”       โ”โ”€โ”€ CustomerMaster.tsx     # **๐ข CRUD เธฅเธนเธเธเนเธฒ Multi-role** (checkbox roles + branch manager + EDI prefix + customer_code display)
โ”   โ”   โ”       โ”โ”€โ”€ UsersSettings.tsx      # CRUD เธเธนเนเนเธเนเธเธฒเธ
โ”   โ”   โ”       โ”โ”€โ”€ PermissionsMatrix.tsx  # Permission Matrix (33ร—6 incl. customers)
โ”   โ”   โ”       โ”โ”€โ”€ ApprovalHierarchy.tsx  # เธฅเธณเธ”เธฑเธเธเธฑเนเธเธญเธเธธเธกเธฑเธ•เธด + เธงเธเน€เธเธดเธ
โ”   โ”   โ”       โ”โ”€โ”€ EDIConfiguration.tsx   # SFTP/FTP/API/**Email** endpoints โ€” CRUD + **โฐ Auto-Schedule UI** + **๐“ Template Editor** (2-tab layout, **drag-and-drop** field mapping, live preview)
โ”   โ”   โ”       โ”โ”€โ”€ SealMaster.tsx         # เธเธฃเธฐเน€เธ เธ—เธเธตเธฅ + prefix
โ”   โ”   โ”       โ”โ”€โ”€ TieredStorageRate.tsx  # เธญเธฑเธ•เธฃเธฒเธเนเธฒเธเธฒเธเธเธฑเนเธเธเธฑเธเนเธ”
โ”   โ”   โ”       โ”โ”€โ”€ AutoAllocationRules.tsx # 9 เธเธเธเธฑเธ”เธ•เธนเนเธญเธฑเธ•เนเธเธกเธฑเธ•เธด โ€” **เน€เธเธทเนเธญเธก DB เธเธฃเธดเธ** (fetch/save via `/api/settings/allocation-rules`)
โ”   โ”   โ”       โ”โ”€โ”€ EquipmentRulesConfig.tsx # 8 เธเธเน€เธเธฃเธทเนเธญเธเธเธฑเธเธฃ
โ”   โ”   โ”       โ”โ”€โ”€ PrefixMapping.tsx       # **Prefixโ’Customer mapping** (เธเธฑเธเธเธนเน BIC prefix เธเธฑเธเธฅเธนเธเธเนเธฒ)
โ”   โ”   โ”       โ””โ”€โ”€ RateLimitSettings.tsx   # **๐” Rate Limit Settings** โ€” toggle เน€เธเธดเธ”/เธเธดเธ” + เธเธณเธซเธเธ”เธเนเธฒ + เธชเธ–เธดเธ•เธด real-time
โ”   โ”   โ”
โ”   โ”   โ”โ”€โ”€ billing/
โ”   โ”   โ”   โ””โ”€โ”€ print/
โ”   โ”   โ”       โ”โ”€โ”€ page.tsx          # เธซเธเนเธฒเธเธดเธกเธเน A4 เนเธเนเธเนเธเธซเธเธตเน/เนเธเน€เธชเธฃเนเธ (standalone, เนเธกเนเธกเธต sidebar)
โ”   โ”   โ”       โ””โ”€โ”€ report/
โ”   โ”   โ”           โ””โ”€โ”€ page.tsx      # **เธซเธเนเธฒเธเธดเธกเธเนเธฃเธฒเธขเธเธฒเธเธเธฃเธฐเธเธณเธงเธฑเธ/เธเธฃเธฐเธเธณเน€เธ”เธทเธญเธ** (A4, auto-print)
โ”   โ”   โ”
โ”   โ”   โ”โ”€โ”€ eir/
โ”   โ”   โ”   โ””โ”€โ”€ [id]/
โ”   โ”   โ”       โ”โ”€โ”€ page.tsx          # เธซเธเนเธฒเธชเธฒเธเธฒเธฃเธ“เธฐ EIR (QR scan target, เนเธกเนเธ•เนเธญเธ login)
โ”   โ”   โ”       โ””โ”€โ”€ EIRPublicView.tsx # Client component เนเธชเธ”เธเธเนเธญเธกเธนเธฅ + เธฃเธนเธเธ–เนเธฒเธขเธเธงเธฒเธกเน€เธชเธตเธขเธซเธฒเธข HD
โ”   โ”   โ”
โ”   โ”   โ””โ”€โ”€ api/
โ”   โ”       โ”โ”€โ”€ auth/login/route.ts         # POST login โ’ JWT + **๐” Rate limit: 5 req/15min per IP**
โ”   โ”       โ”โ”€โ”€ auth/me/route.ts            # GET session restore โ€” เธ•เธฃเธงเธ token เธเธฒเธ x-cyms-token header (proxy) เธซเธฃเธทเธญ cookie โ’ เธ”เธถเธ user+role+yards เธเธฒเธ DB
โ”   โ”       โ”โ”€โ”€ boxtech/route.ts           # **GET Boxtech proxy** (token cache + BIC + container lookup + prefixโ’customer)
โ”   โ”       โ”โ”€โ”€ containers/
โ”   โ”       โ”   โ”โ”€โ”€ route.ts               # GET/POST/PUT (dynamic fields) + position check
โ”   โ”       โ”   โ”โ”€โ”€ detail/route.ts        # GET container detail + gate-in/out + damage_report + dwell days
โ”   โ”       โ”   โ””โ”€โ”€ timeline/route.ts      # **GET container timeline** โ€” merged events from GateTransactions + AuditLog + Invoices
โ”   โ”       โ”โ”€โ”€ gate/
โ”   โ”       โ”   โ”โ”€โ”€ route.ts                # GET/POST gate transactions + **auto-allocation**
โ”   โ”       โ”   โ”โ”€โ”€ eir/route.ts            # GET EIR data (+ condition/grade/company info)
โ”   โ”       โ”   โ””โ”€โ”€ transfer/route.ts       # POST inter-yard transfer
โ”   โ”       โ”โ”€โ”€ uploads/route.ts            # POST photo/logo upload (base64 โ’ file โ’ URL)
โ”   โ”       โ”โ”€โ”€ notifications/route.ts      # GET activity feed (gate + work orders)
โ”   โ”       โ”โ”€โ”€ operations/
โ”   โ”       โ”   โ”โ”€โ”€ route.ts                # GET/POST/PUT work orders
โ”   โ”       โ”   โ”โ”€โ”€ stream/route.ts         # **GET SSE stream** โ€” real-time work order updates (polls DB every 5s)
โ”   โ”       โ”   โ””โ”€โ”€ shift/route.ts          # POST smart shifting (LIFO)
โ”   โ”       โ”โ”€โ”€ edi/
โ”   โ”       โ”   โ”โ”€โ”€ bookings/route.ts       # GET/POST/PUT bookings
โ”   โ”       โ”   โ”โ”€โ”€ validate/route.ts       # POST seal cross-validation
โ”   โ”       โ”   โ”โ”€โ”€ codeco/route.ts         # **GET CODECO outbound** โ€” shared `ediFormatter` + optional `?template_id=X`
โ”   โ”       โ”   โ”โ”€โ”€ codeco/send/route.ts    # **POST send** โ€” reads template from endpoint config โ’ **SFTP or Email**
โ”   โ”       โ”   โ”โ”€โ”€ endpoints/route.ts      # **GET/POST/PUT/DELETE** EDI endpoint settings + **template_id** (DB CRUD)
โ”   โ”       โ”   โ”โ”€โ”€ templates/route.ts      # **๐“ GET/POST/PUT/DELETE** EDI Templates CRUD (system template protection + FK check)
โ”   โ”       โ”   โ””โ”€โ”€ schedule/route.ts       # **GET/PUT/POST** EDI schedule management + cron reload
โ”   โ”       โ”โ”€โ”€ mnr/route.ts                    # GET/POST/PUT repair orders (EOR) โ€” **Zod validation + logAudit + notes/created_by + rejectโ’in_yard**
โ”   โ”       โ”โ”€โ”€ mnr/cedex/route.ts               # GET/POST/PUT/DELETE CEDEX codes
โ”   โ”       โ”โ”€โ”€ billing/
โ”   โ”       โ”   โ”โ”€โ”€ tariffs/route.ts        # GET/POST/PUT tariffs
โ”   โ”       โ”   โ”โ”€โ”€ invoices/route.ts       # GET/POST/PUT invoices + Hold/Release + notes (charges JSON)
โ”   โ”       โ”   โ”โ”€โ”€ gate-check/route.ts     # POST Gate-Out billing โ€” tiered per-size rates + fallback Tariff
โ”   โ”       โ”   โ”โ”€โ”€ gate-in-check/route.ts  # **POST Gate-In billing** โ€” per-container charges (LOLO, gate fee) + prefixโ’customer credit check
โ”   โ”       โ”   โ”โ”€โ”€ auto-calculate/route.ts # POST auto-billing (dwell time + tariff)
โ”   โ”       โ”   โ”โ”€โ”€ erp-export/route.ts     # GET ERP export (CSV/JSON debit-credit) โ€” **fixed: getDb() + date format DD/MM/YYYY HH:mm + customer credit/branch data**
โ”   โ”       โ”   โ”โ”€โ”€ reports/route.ts         # **GET billing reports** โ€” daily/monthly KPIs, charge breakdowns, top customers
โ”   โ”       โ”   โ”โ”€โ”€ ar-aging/route.ts        # **GET AR Aging report** โ€” เธขเธญเธ”เธเนเธฒเธเธเธณเธฃเธฐเนเธขเธเธ•เธฒเธกเธญเธฒเธขเธธ (current/30/60/90+ เธงเธฑเธ) + เนเธขเธเธ•เธฒเธกเธฅเธนเธเธเนเธฒ
โ”   โ”       โ”   โ””โ”€โ”€ demurrage/route.ts      # **GET/POST/PUT demurrage** โ€” overview, single calc, rates CRUD
โ”   โ”       โ”โ”€โ”€ reports/
โ”   โ”       โ”   โ”โ”€โ”€ dwell/route.ts           # **๐“ GET Container Dwell Report** โ€” by shipping line (avg/max/min dwell) + overdue list (>${overdueDays}d) + distribution buckets (7/14/30d)
โ”   โ”       โ”   โ””โ”€โ”€ mnr/route.ts             # **๐“ GET M&R Report** โ€” EOR summary KPIs + by status + 6-month trend + full EOR list with date range filter
โ”   โ”       โ”โ”€โ”€ __tests__/                   # **๐งช API Integration Tests** โ€” 48 tests (containers, mnr, reports/dwell, reports/mnr, gate, billing/invoices)
โ”   โ”       โ”   โ”โ”€โ”€ containers.test.ts       # GET (list, position check, filters) + POST (create, UNIQUE)
โ”   โ”       โ”   โ”โ”€โ”€ mnr.test.ts              # GET + POST (create EOR) + PUT (approve/reject/complete/404)
โ”   โ”       โ”   โ”โ”€โ”€ reports.test.ts          # GET /reports/dwell + GET /reports/mnr โ€” structure + error handling
โ”   โ”       โ”   โ”โ”€โ”€ gate.test.ts             # GET (list, date/search filter)
โ”   โ”       โ”   โ””โ”€โ”€ billing.test.ts          # GET (list+stats) + POST (VAT calc) + PUT (pay/issue/cancel)
โ”   โ”       โ”โ”€โ”€ settings/
โ”   โ”       โ”   โ”โ”€โ”€ company/route.ts        # GET/POST company profile (+ branch + logo URL)
โ”   โ”       โ”   โ”โ”€โ”€ customers/route.ts      # **GET/POST/PUT/DELETE customers** โ€” Multi-role boolean flags + auto customer_code + CustomerBranches CRUD + legacy migration
โ”   โ”       โ”   โ”โ”€โ”€ users/route.ts          # GET/POST/PUT users
โ”   โ”       โ”   โ”โ”€โ”€ yards/route.ts          # GET/POST/PUT/DELETE yards (+ branch auto-migrate)
โ”   โ”       โ”   โ”โ”€โ”€ zones/route.ts          # GET/POST/PUT/DELETE zones
โ”   โ”       โ”   โ”โ”€โ”€ permissions/route.ts    # GET/PUT permission matrix
โ”   โ”       โ”   โ”โ”€โ”€ storage-rates/route.ts  # GET/POST tiered storage rates (per-size pricing)
โ”   โ”       โ”   โ”โ”€โ”€ prefix-mapping/route.ts # **GET/POST/DELETE** prefixโ’customer mapping
โ”   โ”       โ”   โ”โ”€โ”€ rate-limit/route.ts    # **๐” GET/PUT** Rate Limit settings (toggle + config + stats)
โ”   โ”       โ”   โ””โ”€โ”€ allocation-rules/route.ts # **๐—๏ธ GET/PUT** Auto-Allocation Rules (9 rules JSON โ’ SystemSettings)
โ”   โ”       โ””โ”€โ”€ yard/
โ”   โ”           โ”โ”€โ”€ stats/route.ts          # GET yard statistics
โ”   โ”           โ”โ”€โ”€ allocate/route.ts       # POST auto-allocation (+ size_restriction)
โ”   โ”           โ”โ”€โ”€ audit/route.ts          # GET/POST yard audit
โ”   โ”           โ””โ”€โ”€ audit-log/route.ts     # GET/POST audit history log
โ”   โ”
โ”   โ”โ”€โ”€ components/
โ”   โ”   โ”โ”€โ”€ layout/
โ”   โ”   โ”   โ”โ”€โ”€ Sidebar.tsx       # Left sidebar (collapsible + role-based menus + **เธชเน€เธกเธเธน 'เธฃเธฒเธขเธเธฒเธ' /reports BarChart3 icon**)
โ”   โ”   โ”   โ””โ”€โ”€ Topbar.tsx        # Top header (**real API search**, yard switcher, **notification bell**, dark/high-contrast toggle)
โ”   โ”   โ”โ”€โ”€ providers/
โ”   โ”   โ”   โ”โ”€โ”€ AuthProvider.tsx  # Auth context (login/logout/session)
โ”   โ”   โ”   โ””โ”€โ”€ ToastProvider.tsx # Toast notifications (success/error/warning/info)
โ”   โ”   โ”โ”€โ”€ ui/
โ”   โ”   โ”   โ””โ”€โ”€ ConfirmDialog.tsx     # **๐จ Custom ConfirmDialog** โ€” reusable modal (danger/warning/info variants, backdrop blur, Escape key, auto-focus cancel)
โ”   โ”   โ”โ”€โ”€ yard/
โ”   โ”   โ”   โ”โ”€โ”€ YardViewer3D.tsx      # Three.js 3D yard viewer (+ X-Ray highlight + floating label)
โ”   โ”   โ”   โ”โ”€โ”€ BayCrossSection.tsx   # Bay Cross-Section view (Rowร—Tier grid per bay) + **Dwell Days tooltip**
โ”   โ”   โ”   โ”โ”€โ”€ ContainerSearch.tsx   # Instant search + detail panel + photos + EIR link + **Dwell Days badge**
โ”   โ”   โ”   โ”โ”€โ”€ ContainerCardPWA.tsx  # Mobile card view + **Dwell Days badge**
โ”   โ”   โ”   โ”โ”€โ”€ ContainerDetailModal.tsx  # Container detail modal (SVG inspection, photos, actions)
โ”   โ”   โ”   โ””โ”€โ”€ YardAudit.tsx         # Audit checklist per zone/bay
โ”   โ”   โ”โ”€โ”€ containers/
โ”   โ”   โ”   โ””โ”€โ”€ ContainerTimeline.tsx   # **Container Tracking Timeline** โ€” visual vertical timeline (Gate-Inโ’Moveโ’Holdโ’Repairโ’Gate-Out)
โ”   โ”   โ””โ”€โ”€ gate/
โ”   โ”       โ”โ”€โ”€ EIRDocument.tsx         # EIR A5 print (Portal, QR, condition, grade, signatures)
โ”   โ”       โ”โ”€โ”€ ContainerInspection.tsx  # 6-side SVG damage marking + photo + grade
โ”   โ”       โ”โ”€โ”€ CameraOCR.tsx            # **๐“ท Full-screen PWA Camera OCR** โ€” pre-warmed Tesseract worker, crop zone, smart container extraction (`extractContainerNumber` 4-strategy), confidence scoring, torch toggle, scan overlay, `loadedmetadata` race condition fix, `mode` prop (container/plate/seal/generic)
โ”   โ”       โ”โ”€โ”€ PhotoCapture.tsx         # Camera/upload photo โ’ **auto-upload to server** (URL, not base64)
โ”   โ”       โ””โ”€โ”€ SignaturePad.tsx         # Canvas digital signature pad
โ”   โ”
โ”   โ”โ”€โ”€ types/
โ”   โ”   โ”โ”€โ”€ index.ts             # Shared TypeScript interfaces
โ”   โ”   โ””โ”€โ”€ mssql.d.ts           # mssql type declaration
โ”   โ”
โ”   โ””โ”€โ”€ lib/
โ”       โ”โ”€โ”€ db.ts                 # MS SQL connection pool (mssql, useUTC: false)
โ”       โ”โ”€โ”€ auth.ts               # JWT create/verify functions
โ”       โ”โ”€โ”€ utils.ts              # formatDateTime, formatTime, **calcDwellDays** (Calendar Days +1), etc.
โ”       โ”โ”€โ”€ containerValidation.ts # **ISO 6346 check digit** validation + size/type parser + **`extractContainerNumber()` (4-strategy OCR smart extraction)** + `extractTruckPlate()`
โ”       โ”โ”€โ”€ offlineQueue.ts       # NFR1: IndexedDB offline queue + auto-sync
โ”       โ”โ”€โ”€ rateLimit.ts          # **๐” Rate limiter** โ€” in-memory per-IP, DB-backed config (login/API/upload)
โ”       โ”โ”€โ”€ validators.ts         # **๐” Zod schemas** โ€” container numbers, gate, invoices, users, customers, EDI
โ”       โ”โ”€โ”€ apiAuth.ts            # **๐” withAuth() wrapper** โ€” JWT + rate limiting + role-based access
โ”       โ”โ”€โ”€ authFetch.ts          # **๐” Client auth fetch** โ€” auto-attach Bearer token + 401 redirect
โ”       โ”โ”€โ”€ audit.ts              # **๐” Centralized logAudit()** โ€” non-fatal AuditLog INSERT
โ”       โ”โ”€โ”€ ediFormatter.ts       # **๐“ Shared CODECO formatter** โ€” template-based CSV/JSON/EDIFACT (field mapping, headers, date format, delimiter)
โ”       โ”โ”€โ”€ schema.sql            # SQL schema reference (17 tables, incl. CustomerBranches)
โ”       โ””โ”€โ”€ __tests__/            # **๐งช Unit Tests** (Jest + ts-jest)
โ”           โ”โ”€โ”€ containerValidation.test.ts  # ISO 6346 check digit + validation + parseSizeTypeCode (20 tests)
โ”           โ”โ”€โ”€ utils.test.ts               # formatContainerNumber + status colors/labels (24 tests)
โ”           โ”โ”€โ”€ validators.test.ts          # Zod schemas โ€” gate, billing, users, customers (multi-role), EDI (60 tests)
โ”           โ”โ”€โ”€ auth.test.ts                # JWT round-trip + tamper detection + role labels (16 tests)
โ”           โ””โ”€โ”€ rateLimit.test.ts            # store clearing + stats + client IP extraction (14 tests)
โ”
โ”โ”€โ”€ src/proxy.ts                  # **๐” Next.js 16 Proxy** (เน€เธ”เธดเธกเธเธทเธญ middleware.ts) โ€” JWT enforcement เธ—เธธเธ /api/ + page guard + cookieโ’x-cyms-token forwarding
โ””โ”€โ”€ package.json
```

---

## 5. Database Schema

### เธ•เธฒเธฃเธฒเธ (14 เธ•เธฒเธฃเธฒเธ)

| เธ•เธฒเธฃเธฒเธ | เธเธญเธฅเธฑเธกเธเนเธซเธฅเธฑเธ | เธซเธเนเธฒเธ—เธตเน |
|-------|------------|--------|
| `CompanyProfile` | name, address, tax_id, logo_url (MAX), **branch_type, branch_number** | เธเนเธญเธกเธนเธฅเธเธฃเธดเธฉเธฑเธ— |
| `Yards` | yard_name, address, lat/lng, status, **branch_type, branch_number** | เธชเธฒเธเธฒเธฅเธฒเธ |
| `YardZones` | zone_name, zone_type, max_bay/row/tier | เนเธเธเนเธเธฅเธฒเธ |
| `Roles` | role_name, description | เธเธ—เธเธฒเธ— (6 roles) |
| `Permissions` | module, action, description | เธชเธดเธ—เธเธดเน (33 permissions: 9 modules) |
| `RolePermissions` | role_id, permission_id | Permission matrix |
| `Users` | username, password_hash, role_id, status, **notif_last_read_at** | เธเธนเนเนเธเนเธเธฒเธ (notif_last_read_at = timestamp เธญเนเธฒเธเนเธเนเธเน€เธ•เธทเธญเธเธฅเนเธฒเธชเธธเธ” โ€” เธเธดเธเธเนเธเนเธฒเธก browser) |
| `UserYardAccess` | user_id, yard_id | เธชเธดเธ—เธเธดเนเน€เธเนเธฒเธ–เธถเธเธฅเธฒเธ |
| `ApprovalHierarchy` | approver_id, level | เธชเธฒเธขเธญเธเธธเธกเธฑเธ•เธด |
| `Containers` | container_number, size, type, status, zone/bay/row/tier, **is_soc** (BIT), **container_owner_id** (FK) | Containers + SOC flag |
| `Customers` | customer_code (auto-gen `CUST-XXXXX`), customer_name, **is_line, is_forwarder, is_trucking, is_shipper, is_consignee** (Boolean flags), tax_id, address, billing_address, contact_name/phone/email, **default_payment_type** (CASH/CREDIT), credit_term, **edi_prefix** (เธเธฑเธเธเธฑเธเน€เธกเธทเนเธญ is_line=1), is_active | เธฅเธนเธเธเนเธฒ โ€” **Multi-role** (1 เธเธฃเธดเธฉเธฑเธ— = เธซเธฅเธฒเธขเธเธ—เธเธฒเธ—) |
| `CustomerBranches` | customer_id (FK), branch_code (default '00000'), branch_name, billing_address, contact_name/phone/email, is_default, is_active | **เธชเธฒเธเธฒเธฅเธนเธเธเนเธฒ** โ€” เธซเธฅเธฒเธขเธชเธฒเธเธฒเธ•เนเธญ 1 เธเธฃเธดเธฉเธฑเธ— |
| `ISOContainerCodes` | iso_code, description | เธฃเธซเธฑเธช ISO เธ•เธนเน |
| `DocumentFormats` | doc_type, prefix, running_number | เน€เธฅเธเน€เธญเธเธชเธฒเธฃ |
| `GateTransactions` | container_id, transaction_type, driver_name, truck_plate, eir_number, **container_owner_id** (FK), **billing_customer_id** (FK) | Gate In/Out + Owner/Billing |
| `WorkOrders` | container_id, order_type, from/to positions, priority, status | เธเธณเธชเธฑเนเธเธเธฒเธเธฃเธ–เธขเธ |
| `Bookings` | booking_number, booking_type, vessel_name, container_count, seal_number | Booking/Manifest |
| `RepairOrders` | eor_number, container_id, damage_details, estimated_cost, status | เนเธเธเนเธญเธก EOR |
| `Tariffs` | charge_type, rate, unit, free_days | เธญเธฑเธ•เธฃเธฒเธเนเธฒเธเธฃเธดเธเธฒเธฃ (LOLO, gate, etc.) |
| `StorageRateTiers` | tier_name, from_day, to_day, rate_20, rate_40, rate_45, sort_order, **customer_id** (FK, NULL=default), **cargo_status** (laden/empty/any) | Tiered storage + per-customer rates |
| `DemurrageRates` | yard_id, customer_id, charge_type, free_days, rate_20/40/45, description, is_active | **เธญเธฑเธ•เธฃเธฒเธเนเธฒ Demurrage/Detention** (เนเธขเธเธเธฒเธ Storage โ€” เธเนเธฒเธเธฃเธฑเธเธชเธฒเธขเน€เธฃเธทเธญ) |
| `Invoices` | invoice_number, customer_id, charge_type, grand_total, status, **notes (JSON charges)** | เนเธเนเธเนเธเธซเธเธตเน |
| `AuditLog` | user_id, action, details, timestamp | เธเธฑเธเธ—เธถเธเธเธฒเธฃเนเธเนเธเธฒเธ |
| `PrefixMapping` | **prefix_code** (4 chars), **customer_id** (FK), **is_primary** (BIT), notes, UNIQUE(prefix_code, customer_id) | BIC prefix mapping (1:N + Halt Rule) |
| `EDIEndpoints` | name, shipping_line, type (sftp/ftp/api/**email**), host, port, username, password, remote_path, format, is_active, last_sent_at, last_status, **schedule_enabled**, **schedule_cron**, **schedule_yard_id**, **schedule_last_run**, **template_id** (FKโ’EDITemplates) | **เธ•เธฑเนเธเธเนเธฒ endpoints เธชเธณเธซเธฃเธฑเธเธชเนเธ EDI + โฐ Auto-Schedule + ๐“ Template** |
| `EDISendLog` | endpoint_id (FK), message_type, filename, record_count, status (pending/sent/failed), error_message, sent_at | **เธเธฃเธฐเธงเธฑเธ•เธดเธเธฒเธฃเธชเนเธ EDI เธ—เธธเธเธเธฃเธฑเนเธ** |
| `EDITemplates` | template_name, base_format (csv/json/edifact), description, **field_mapping** (JSON), csv_delimiter, date_format, edifact_version, edifact_sender, **is_system**, is_active | **๐“ Template config เธชเธณเธซเธฃเธฑเธ CODECO format** โ€” field order/rename/toggle, date format, delimiter |
| `SystemSettings` | **setting_key** (UNIQUE), **setting_value**, **updated_at** | **๐” เธเนเธฒเธ•เธฑเนเธเธฃเธฐเธเธ** (rate limit toggle/config) |

### Zone Types

| Type | เธ•เธฑเธงเธญเธขเนเธฒเธ | เธเนเธญเธเธณเธเธฑเธ” |
|------|---------|----------|
| `dry` | Zone A, B, C | เธ•เธนเนเธ—เธฑเนเธงเนเธ, max tier 4-5 |
| `reefer` | Zone R1 | เธ•เธนเนเน€เธขเนเธเน€เธ—เนเธฒเธเธฑเนเธ, เธกเธตเธเธฅเธฑเนเธ |
| `hazmat` | Zone H | เธ•เธนเนเธญเธฑเธเธ•เธฃเธฒเธข, max tier 2 |
| `empty` | Zone E | เธ•เธนเนเน€เธเธฅเนเธฒ, max tier 6 |
| `repair` | Zone M | เธ•เธนเนเธเนเธญเธก, max tier 2 |

---

## 6. API Reference

### Authentication

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/api/auth/login` | `{ username, password }` | `{ token, user, yards }` + httpOnly cookie `cyms_token` |
| GET | `/api/auth/me` | โ€” | `{ authenticated, session }` โ€” restore session เธเธฒเธ cookie (New Tab/Refresh) |

### Containers

| Method | Endpoint | Params/Body | Response |
|--------|----------|-------------|----------|
| GET | `/api/containers` | `?yard_id=1&zone_id=&status=&search=` | `ContainerData[]` |
| GET | `/api/containers` | `?check_position=1&zone_id=X&bay=Y&row=Z&tier=W` | Conflict check โ€” `{ conflict: {...} \| null }` |
| GET | `/api/containers/detail` | `?container_id=X` | Container + gate-in/out + damage_report + dwell_days |
| POST | `/api/containers` | `{ container_number, size, type, yard_id, zone_id, bay, row, tier, ... }` | Gate-In record |
| PUT | `/api/containers` | `{ container_id, status?, zone_id?, bay?, ... }` | **Dynamic update** โ€” เน€เธเธเธฒเธฐ fields เธ—เธตเนเธชเนเธเธกเธฒ (เนเธกเน null เธเนเธฒเธญเธทเนเธ) |

### Yard Management

| Method | Endpoint | เธเธณเธญเธเธดเธเธฒเธข |
|--------|----------|---------|
| GET | `/api/yard/stats?yard_id=1` | เธชเธ–เธดเธ•เธดเธฃเธงเธก + zone occupancy% |
| POST | `/api/yard/allocate` | Auto-allocation โ€” `{ yard_id, size, type, shipping_line }` โ’ Top 5 suggestions (+ size_restriction enforcement) |
| GET | `/api/yard/audit?zone_id=&yard_id=` | เธ”เธถเธเธ•เธนเนเธชเธณเธซเธฃเธฑเธเธ•เธฃเธงเธเธเธฑเธ |
| POST | `/api/yard/audit` | เธชเนเธเธเธฅเธ•เธฃเธงเธเธเธฑเธ โ’ matched/misplaced/missing |
| GET | `/api/yard/audit-log?yard_id=&entity_type=&limit=` | เธ”เธถเธเธเธฃเธฐเธงเธฑเธ•เธด audit log |
| POST | `/api/yard/audit-log` | เธเธฑเธเธ—เธถเธ audit log โ€” `{ yard_id, action, entity_type, entity_id, details }` |

### Gate

| Method | Endpoint | เธเธณเธญเธเธดเธเธฒเธข |
|--------|----------|---------|
| GET | `/api/gate?yard_id=X&type=gate_in&date=today&search=` | เธ”เธถเธเธฃเธฒเธขเธเธฒเธฃ gate transactions (date: `today` เธซเธฃเธทเธญ `YYYY-MM-DD`, search: เน€เธฅเธเธ•เธนเน/เธเธเธเธฑเธ/เธ—เธฐเน€เธเธตเธขเธ/EIR) |
| POST | `/api/gate` | Gate-In/Gate-Out โ€” `{ transaction_type, container_number, ... }` โ’ **auto-allocate** + EIR + **auto Work Order** |
| GET | `/api/gate/eir?eir_number=X` | เธ”เธถเธเธเนเธญเธกเธนเธฅ EIR (+ condition/grade/company info) |

### Uploads (File Storage)

| Method | Endpoint | เธเธณเธญเธเธดเธเธฒเธข |
|--------|----------|---------|
| POST | `/api/uploads` | เธญเธฑเธเนเธซเธฅเธ”เธ เธฒเธ โ€” `{ data: 'data:image/jpeg;base64,...', folder: 'photos', filename_prefix: 'photo' }` โ’ `{ url: '/uploads/photos/2026-03/photo_xxx.jpg' }` |

### Notifications

| Method | Endpoint | เธเธณเธญเธเธดเธเธฒเธข |
|--------|----------|---------|
| GET | `/api/notifications?yard_id=X&limit=20&user_id=Y` | เธ”เธถเธ activity feed โ€” เธฃเธงเธก Gate Transactions + Work Order updates, เน€เธฃเธตเธขเธเธ•เธฒเธกเน€เธงเธฅเธฒเธฅเนเธฒเธชเธธเธ” + เธชเนเธ `last_read_at` เธเธญเธ user เธเธฅเธฑเธเธกเธฒ (เธ”เธถเธเธเธฒเธ DB โ€” เธเธดเธเธเนเธเนเธฒเธก browser/device) |
| PATCH | `/api/notifications` | เธเธฑเธเธ—เธถเธ read timestamp เธฅเธ DB โ€” `{ user_id }` โ’ `UPDATE Users SET notif_last_read_at = GETDATE()` โ’ เธชเนเธ `last_read_at` เธเธฅเธฑเธเธกเธฒ |

### Operations

| Method | Endpoint | เธเธณเธญเธเธดเธเธฒเธข |
|--------|----------|---------|
| GET | `/api/operations?yard_id=X&status=pending` | เธ”เธถเธ Work Orders |
| POST | `/api/operations` | เธชเธฃเนเธฒเธ Work Order โ€” `{ order_type, container_id, to_zone/bay/row/tier, priority }` |
| PUT | `/api/operations` | เธญเธฑเธเน€เธ”เธ—เธชเธ–เธฒเธเธฐ โ€” `{ order_id, action: accept/complete/cancel }` + optional `{ to_zone_id, to_bay, to_row, to_tier }` เธชเธณเธซเธฃเธฑเธ position override |
| POST | `/api/operations/shift` | Smart Shifting โ€” `{ container_id, yard_id }` โ’ LIFO plan |

### Settings

| Method | Endpoint | เธเธณเธญเธเธดเธเธฒเธข |
|--------|----------|---------|
| GET/POST | `/api/settings/company` | Company profile CRUD (+ branch_type/branch_number) |
| GET/POST/PUT | `/api/settings/users` | User management |
| GET/POST/PUT/DELETE | `/api/settings/yards` | Yard management (+ branch, DELETE เธ•เธฃเธงเธเธ•เธนเนเธเนเธญเธเธฅเธ) |
| GET/POST/PUT/DELETE | `/api/settings/zones` | Zone management (DELETE เธ•เธฃเธงเธเธ•เธนเนเธเนเธญเธเธฅเธ) |
| GET/POST/PUT/DELETE | `/api/settings/customers` | **Customer CRUD** โ€” Multi-role boolean flags (`is_line`, `is_forwarder`, `is_trucking`, `is_shipper`, `is_consignee`) + auto `customer_code` (CUST-XXXXX) + CustomerBranches + duplicate name/tax_id check + `?role=line\|trucking\|...` filter |
| GET/PUT | `/api/settings/permissions` | Permission matrix toggle (33 perms ร— 6 roles) |
| GET/POST | `/api/settings/storage-rates` | Tiered storage rate tiers (per-size: 20'/40'/45') |
| GET/POST/DELETE | `/api/settings/prefix-mapping` | **Prefixโ’Customer mapping** (prefix_code 4 chars + customer_id) |

### Billing

| Method | Endpoint | เธเธณเธญเธเธดเธเธฒเธข |
|--------|----------|---------|
| POST | `/api/billing/gate-check` | Gate-Out billing check โ€” เธเธณเธเธงเธ“เธเนเธฒเธเธฃเธดเธเธฒเธฃเธเธฒเธ tiered rates (เนเธขเธเธฃเธฒเธเธฒเธ•เธฒเธกเธเธเธฒเธ”เธ•เธนเน) + เธ•เธฃเธงเธ paid invoices โ’ `already_paid` flag |
| POST | `/api/billing/gate-in-check` | **Gate-In billing check** โ€” เธเนเธฒเธเธฃเธดเธเธฒเธฃ per-container (LOLO, gate fee เธฏเธฅเธฏ) + เธเนเธเธฅเธนเธเธเนเธฒเธเธฒเธ prefixโ’PrefixMapping โ’ เน€เธเนเธ credit_term |
| GET/POST/PUT | `/api/billing/invoices` | CRUD เนเธเนเธเนเธเธซเธเธตเน โ€” supports `invoice_id` filter, stores charge breakdown in `notes` JSON |
| GET/POST/PUT | `/api/billing/tariffs` | เธญเธฑเธ•เธฃเธฒเธเนเธฒเธเธฃเธดเธเธฒเธฃ (LOLO, gate, washing, etc.) |
| GET | `/api/billing/erp-export` | ERP export (CSV/JSON debit-credit) โ€” **date: DD/MM/YYYY HH:mm, includes customer credit_term/branch/address/due_date** |
| GET | `/api/billing/reports` | **Billing reports** โ€” `?type=daily|monthly&date=YYYY-MM-DD&yard_id=X` โ’ KPIs, charge breakdown, invoice list / top customers |
| GET | `/api/billing/ar-aging` | **AR Aging report** โ€” `?yard_id=X` โ’ เธขเธญเธ”เธเนเธฒเธเธเธณเธฃเธฐเนเธขเธเธ•เธฒเธกเธญเธฒเธขเธธเธซเธเธตเน (current/30/60/90+ เธงเธฑเธ) + เนเธขเธเธ•เธฒเธกเธฅเธนเธเธเนเธฒ |
| GET | `/api/billing/demurrage?yard_id=X&mode=overview` | **Demurrage overview** โ€” containers approaching/exceeding free days + risk levels (exceeded/warning/safe) |
| GET | `/api/billing/demurrage?yard_id=X&container_id=Y` | **Demurrage calculation** โ€” single container charges (demurrage + detention) |
| GET | `/api/billing/demurrage?yard_id=X` | **Demurrage rates config** โ€” เธ”เธถเธ rate เธ—เธฑเนเธเธซเธกเธ” |
| POST | `/api/billing/demurrage` | **Create demurrage rate** โ€” `{ yard_id, charge_type, free_days, rate_20/40/45, description }` |
| PUT | `/api/billing/demurrage` | **Update/Delete rate** โ€” `{ demurrage_id, ... }` or `{ demurrage_id, action: 'delete' }` (soft delete) |

### Boxtech API (Container Database)

| Method | Endpoint | เธเธณเธญเธเธดเธเธฒเธข |
|--------|----------|---------|
| GET | `/api/containers/timeline?container_id=X` | **Container Timeline** โ€” unified events from GateTransactions + AuditLog + Invoices sorted by time |
| GET | `/api/containers/timeline?container_number=XXXX1234567` | **Container Timeline** โ€” same, lookup by container_number |
| GET | `/api/boxtech?container_number=XXXX1234567` | Boxtech proxy โ€” BIC code + container lookup + prefixโ’customer mapping โ’ `{ shipping_line, size, type, customer, source }` |

### ๐“ Gate Reports

| Method | Endpoint | เธเธณเธญเธเธดเธเธฒเธข |
|--------|----------|---------|
| GET | `/api/reports/gate?type=daily_in&yard_id=X&date=YYYY-MM-DD` | **Daily Gate In** โ€” เธฃเธฒเธขเธเธฒเธฃเธ•เธนเนเน€เธเนเธฒเธฃเธฒเธขเธงเธฑเธ + summary (total, laden, empty, 20/40/45) + byShippingLine |
| GET | `/api/reports/gate?type=daily_out&yard_id=X&date=YYYY-MM-DD` | **Daily Gate Out** โ€” เธฃเธฒเธขเธเธฒเธฃเธ•เธนเนเธญเธญเธเธฃเธฒเธขเธงเธฑเธ + summary |
| GET | `/api/reports/gate?type=summary_in&yard_id=X&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD` | **Summary Gate In** โ€” 7 sections: KPI, เธชเธฒเธขเน€เธฃเธทเธญ Top 10, เธฃเธฒเธขเธงเธฑเธ, เธเธเธฒเธ”, เธเธฃเธฐเน€เธ เธ—, เธเธฑเนเธงเนเธกเธ, เธเธนเนเธ”เธณเน€เธเธดเธเธเธฒเธฃ |
| GET | `/api/reports/gate?type=summary_out&yard_id=X&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD` | **Summary Gate Out** โ€” เน€เธซเธกเธทเธญเธเธเธฑเธ เนเธ•เนเน€เธเนเธเธ•เธนเนเธญเธญเธ |

### EDI (CODECO Outbound + SFTP/Email + Auto-Schedule + ๐“ Templates)

| Method | Endpoint | เธเธณเธญเธเธดเธเธฒเธข |
|--------|----------|---------|
| GET | `/api/edi/codeco?yard_id=X&date_from=&date_to=&type=gate_in|gate_out&shipping_line=&format=json|csv|edifact&template_id=X` | **CODECO outbound** โ€” generate CODECO with optional **template** (field mapping, custom headers, date format) |
| POST | `/api/edi/codeco/send` | **Send** โ€” reads **template from endpoint config** โ’ generate CODECO + upload via **SFTP or Email** โ’ log results |
| GET | `/api/edi/codeco/send?endpoint_id=X` | **Send log history** โ€” เธเธฃเธฐเธงเธฑเธ•เธดเธเธฒเธฃเธชเนเธเธ—เธฑเนเธเธซเธกเธ” |
| GET/POST/PUT/DELETE | `/api/edi/endpoints` | **EDI endpoint CRUD** โ€” manage configurations + **template_id** + **audit log** |
| GET/POST/PUT/DELETE | `/api/edi/templates` | **๐“ EDI Template CRUD** โ€” create/edit/duplicate/delete templates (system template protection + FK check before delete) |
| GET | `/api/edi/schedule` | **Schedule status** โ€” เธ”เธถเธเธชเธ–เธฒเธเธฐ schedule เธ—เธธเธ endpoint |
| PUT | `/api/edi/schedule` | **Update schedule** โ€” `{ endpoint_id, schedule_enabled, schedule_cron, schedule_yard_id }` + reload cron |
| POST | `/api/edi/schedule` | **Reload all schedules** โ€” manual trigger เน€เธฃเธดเนเธก cron เนเธซเธกเนเธ—เธฑเนเธเธซเธกเธ” |

### ๐” Security & Rate Limiting

| Method | Endpoint | เธเธณเธญเธเธดเธเธฒเธข |
|--------|----------|---------|
| GET | `/api/settings/rate-limit` | เธ”เธถเธเธเนเธฒ Rate Limit settings (enabled, login/api/upload limits) |
| PUT | `/api/settings/rate-limit` | เธญเธฑเธเน€เธ”เธ•เธเนเธฒ Rate Limit settings (toggle + config) |
| `src/proxy.ts` | เธ—เธธเธ `/api/*` + protected pages | **๐” JWT enforcement** โ€” เธ•เธฃเธงเธ Bearer token / cookie เธ—เธธเธ API call, exempt: login, EIR โ€” **uploads เธ•เนเธญเธ login เนเธฅเนเธง** |
| `src/proxy.ts` | เธ—เธธเธ `/api/*` | **๐”ง Header forwarding** โ€” `passthrough()` เธญเนเธฒเธ cookie `cyms_token` เนเธฅเนเธงเธชเนเธเน€เธเนเธ `x-cyms-token` custom header + `x-user-id/x-user-role/x-customer-id` |
| `src/proxy.ts` | Protected pages | **๐”’ Page guard** โ€” เธ•เธฃเธงเธ cookie เธชเธณเธซเธฃเธฑเธ page routes (`/dashboard`, `/gate`, etc.) โ’ redirect เนเธ `/login` เธ–เนเธฒเนเธกเนเธกเธต/เธซเธกเธ”เธญเธฒเธขเธธ |

---

## 7. เธเธตเน€เธเธญเธฃเนเธซเธฅเธฑเธเธ—เธตเนเธชเธฃเนเธฒเธเน€เธชเธฃเนเธ

### 7.1 เธฃเธฐเธเธ Login + Auth
- เธซเธเนเธฒ Login เนเธเธ Glassmorphism + animated background
- JWT token (8 เธเธก.) + bcrypt password hashing + **httpOnly cookie** (`cyms_token`)
- **Dual-layer session**: httpOnly cookie (server-side guard) + localStorage (client-side UI state)
- Auth context เธเนเธฒเธ `AuthProvider` (localStorage session + **`/api/auth/me` fallback** เธชเธณเธซเธฃเธฑเธ New Tab/Hard Refresh)
- **Next.js 16 Proxy** (`src/proxy.ts`): เธ•เธฃเธงเธ cookie เธเธ page routes + forward token เธเนเธฒเธ `x-cyms-token` header เนเธเธขเธฑเธ API routes
- Audit log เธ—เธธเธเธเธฒเธฃ login

### 7.2 Dashboard
- KPI cards (เธ•เธนเนเธ—เธฑเนเธเธซเธกเธ”, เธญเธฑเธ•เธฃเธฒเน€เธ•เนเธก, Gate-In เธงเธฑเธเธเธตเน, **Gate-Out เธงเธฑเธเธเธตเน**, เธฃเธฒเธขเนเธ”เนเธงเธฑเธเธเธตเน) โ€” **5-column grid**
- **Gate-Out card** (**เนเธซเธกเน**): เนเธชเธ”เธเธเธณเธเธงเธ Gate-Out เธงเธฑเธเธเธตเน + เน€เธเธฃเธตเธขเธเน€เธ—เธตเธขเธเน€เธกเธทเนเธญเธงเธฒเธ (เนเธญเธเธญเธ DoorOpen เธชเธตเนเธ”เธ)
- **๐“ Dashboard Charts** (Recharts): Gate Activity Bar Chart, Revenue Area Chart, Shipping Line Pie Chart, Dwell Time Distribution
- **Range Toggle**: เน€เธฅเธทเธญเธเธเนเธงเธเน€เธงเธฅเธฒ **7 เธงเธฑเธ / 30 เธงเธฑเธ / 3 เน€เธ”เธทเธญเธ** โ€” 30d/90d เธฃเธงเธกเน€เธเนเธเธฃเธฒเธขเธชเธฑเธเธ”เธฒเธซเนเธญเธฑเธ•เนเธเธกเธฑเธ•เธด
- Quick Action buttons
- Yard Status overview

### 7.3 เธ•เธฑเนเธเธเนเธฒเธฃเธฐเธเธ (Settings โ€” 11 เนเธ—เนเธ)
- **Company Profile**: CRUD โ’ DB + **logo upload (local file storage โ’ URL)** + **เธชเธฒเธเธฒ (เธชเธณเธเธฑเธเธเธฒเธเนเธซเธเน/เธชเธฒเธเธฒเธ—เธตเน)**
- **User Management**: CRUD + role + yard access
- **Permission Matrix**: **33 permissions ร— 6 roles**, toggle realtime (**เธฃเธงเธก customers module**)
- **Yards + Zones**: CRUD + Edit/Delete โ’ DB (เธเนเธญเธเธเธฑเธเธฅเธเธซเธฒเธเธขเธฑเธเธกเธตเธ•เธนเนเธญเธขเธนเน) + **เธชเธฒเธเธฒ (เธชเธณเธเธฑเธเธเธฒเธเนเธซเธเน/เธชเธฒเธเธฒเธ—เธตเน + badge เธชเธต)**
- **Customer Master (๐ข Multi-role)**: CRUD เธฅเธนเธเธเนเธฒ โ€” **5 เธเธ—เธเธฒเธ— checkbox** (เธชเธฒเธขเน€เธฃเธทเธญ/Forwarder/เธฃเธ–เธเธฃเธฃเธ—เธธเธ/เธเธนเนเธชเนเธเธญเธญเธ/เธเธนเนเธเธณเน€เธเนเธฒ), `customer_code` auto-generate (CUST-XXXXX), เน€เธฅเธเธ เธฒเธฉเธต, เธ—เธตเนเธญเธขเธนเน/เธ—เธตเนเธญเธขเธนเนเธญเธญเธเธเธดเธฅ, เธเธนเนเธ•เธดเธ”เธ•เนเธญ, **default_payment_type** (CASH/CREDIT), credit term, **EDI prefix** (เธเธฑเธเธเธฑเธเน€เธกเธทเนเธญ is_line), **multi-branch manager** (เน€เธเธดเนเธก/เธฅเธ/เนเธเนเนเธเธชเธฒเธเธฒ + เธเธณเธซเธเธ”เธชเธฒเธเธฒเธซเธฅเธฑเธ)
- **Approval Hierarchy**: เธฅเธณเธ”เธฑเธเธเธฑเนเธเธญเธเธธเธกเธฑเธ•เธด + เธงเธเน€เธเธดเธ + auto-approve (เธฅเธฒเธเธชเธฅเธฑเธเธ•เธณเนเธซเธเนเธ)
- **EDI Configuration**: SFTP/FTP/API/**Email** endpoints โ€” CRUD + **โฐ Auto-Schedule** (เธเธงเธฒเธกเธ–เธตเน dropdown + time picker + cron presets) + **shipping line autocomplete** + เนเธชเธ”เธ last sent status/time
- **Seal Master**: เธเธฃเธฐเน€เธ เธ—เธเธตเธฅ + prefix + เธชเธต + เธเธฑเธเธเธฑเธเธ–เนเธฒเธขเธฃเธนเธ
- **Tiered Storage Rate**: เธญเธฑเธ•เธฃเธฒเธเธฑเนเธเธเธฑเธเนเธ” (Freeโ’Standardโ’Extendedโ’Penalty) 20'/40'/45'
- **Auto-Allocation Rules**: 9 เธเธ toggle โ€” **เน€เธเธทเนเธญเธก DB เธเธฃเธดเธ** (เธเนเธฒเน€เธฃเธดเนเธกเธ•เนเธเธ–เนเธฒเนเธกเนเธกเธตเนเธ DB) โ€” เนเธขเธเธชเธฒเธขเน€เธฃเธทเธญ/เธเธเธฒเธ”/เธเธฃเธฐเน€เธ เธ—(GP/HC/RF/OT/FR/TK/DG)/LIFO/FIFO/max tier(เนเธขเธ laden/empty)/เธเธฃเธฐเธเธฒเธขเธ•เธนเนเธชเธกเนเธณเน€เธชเธกเธญ/เนเธเธฅเนเธเธฃเธฐเธ•เธน
- **Equipment Rules Config**: 8 เธเธ toggle (shift limit, weight, cooldown, maintenance)
- **Prefix Mapping** (**เนเธซเธกเน**): เธเธฑเธเธเธนเน BIC prefix (4 เธ•เธฑเธงเธญเธฑเธเธฉเธฃ เน€เธเนเธ MSCU, MEDU) เธเธฑเธเธฅเธนเธเธเนเธฒเนเธเธฃเธฐเธเธ โ€” เธฃเธญเธเธฃเธฑเธเธซเธฅเธฒเธข prefix เธ•เนเธญเธฅเธนเธเธเนเธฒ, auto-create table

### 7.4 เธเธฑเธ”เธเธฒเธฃเธฅเธฒเธ (Yard Management)

4 เนเธ—เนเธ:

#### เนเธ—เนเธ "เธ เธฒเธเธฃเธงเธก"
- เธชเธ–เธดเธ•เธด **7 เธเธฒเธฃเนเธ”** (เธ•เธนเนเธ—เธฑเนเธเธซเธกเธ”, เนเธเธฅเธฒเธ, เธเนเธฒเธเธเนเธฒเธข, เธเนเธญเธก, **Overdue (>30เธงเธฑเธ)**, **Avg Dwell**, เธญเธฑเธ•เธฃเธฒเน€เธ•เนเธก)
  - **Overdue**: เนเธชเธ”เธเธเธณเธเธงเธเธ•เธนเนเธเนเธฒเธเน€เธเธดเธ 30 เธงเธฑเธ โ€” เธชเธตเนเธ”เธเธ–เนเธฒเธกเธต, เธชเธตเน€เธเธตเธขเธงเธ–เนเธฒเนเธกเนเธกเธต
  - **Avg Dwell**: เธเนเธฒเน€เธเธฅเธตเนเธขเธเธณเธเธงเธเธงเธฑเธเนเธเธฅเธฒเธเธ—เธฑเนเธเธซเธกเธ”
  - เธเธณเธเธงเธ“เธ”เนเธงเธข `calcDwellDays()` (Calendar Days +1)
- **2D / Bay / 3D** toggle (3 เธกเธธเธกเธกเธญเธ)
- **2D**: Zone cards + occupancy bars
- **Bay**: (**เนเธซเธกเน**) Bay Cross-Section โ€” เนเธชเธ”เธ Rowร—Tier grid เนเธขเธเธ•เธฒเธก Bay + เน€เธฅเธทเธญเธ Zone + เธชเธต shipping line/status + hover tooltip + click detail + legend
- **3D**: Three.js โ€” เธ•เธนเนเธชเธกเธเธฃเธดเธ (เธชเธฑเธ”เธชเนเธงเธเธเธฃเธดเธ 20ft/40ft/45ft)
- เธ•เธฒเธฃเธฒเธเธ•เธนเน + filter + search + **pagination** (25 เธ•เธนเน/เธซเธเนเธฒ + เธเธธเนเธกเน€เธฅเธเธซเธเนเธฒ + เธฃเธตเน€เธเนเธ•เธญเธฑเธ•เนเธเธกเธฑเธ•เธดเน€เธกเธทเนเธญเน€เธเธฅเธตเนเธขเธ filter)
- **เธเธฅเธดเธเนเธ–เธงเธ•เธนเน โ’ Container Detail Modal** (popup เธ•เธฃเธเธเธฅเธฒเธ)

#### Container Detail Modal (เธเธฅเธดเธเนเธ–เธงเธ•เธนเน)
- **เธเนเธญเธกเธนเธฅเธ•เธนเน**: เน€เธฅเธเธ•เธนเน, เธเธเธฒเธ”/เธเธฃเธฐเน€เธ เธ—, เธชเธฒเธขเน€เธฃเธทเธญ, เธเธตเธฅ, เธเธดเธเธฑเธ”, เธเธณเธเธงเธเธงเธฑเธเนเธเธฅเธฒเธ
- **Gate-In**: เธงเธฑเธเธ—เธตเน, เธเธเธเธฑเธ, เธ—เธฐเน€เธเธตเธขเธเธฃเธ–, เน€เธฅเธ EIR (เธเธ”เน€เธเธดเธ” tab เนเธซเธกเน)
- **เนเธเธเธเธฑเธเธ•เธฃเธงเธเธชเธ เธฒเธ (Read-Only SVG)**: 6 เธ”เนเธฒเธ + เน€เธเธฃเธ” + เธเธธเธ”เน€เธชเธตเธขเธซเธฒเธขเธเธ”เธ”เธนเธฃเธนเธ+เธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”
- **เธฃเธนเธเธ–เนเธฒเธข**: gallery เธฃเธนเธเธ•เธฃเธงเธเธชเธ เธฒเธ + เธเธธเธ”เน€เธชเธตเธขเธซเธฒเธข + เธเธฒเธญเธญเธ (เธเธ”เธเธขเธฒเธขเน€เธ•เนเธกเธเธญ)
- **Gate-Out** (เธ–เนเธฒเธกเธต): เธงเธฑเธเธ—เธตเน, เธเธเธเธฑเธ, เน€เธฅเธ EIR
- **Actions**: เน€เธเธฅเธตเนเธขเธเธชเธ–เธฒเธเธฐ (in_yard/hold/repair), เธ”เธน EIR

#### เนเธ—เนเธ "เธเนเธเธซเธฒเธ•เธนเน" (Split Screen)
- **เธเนเธฒเธข**: Instant search โ’ เธฃเธฒเธขเธเธทเนเธญ โ’ **Detail Panel** (gate-in, เน€เธเธฃเธ”, เธเธธเธ”เน€เธชเธตเธขเธซเธฒเธข, ๐“ธ เธฃเธนเธเธ–เนเธฒเธข, เธฅเธดเธเธเน EIR)
- **เธเธงเธฒ**: 3D Viewer โ€” **X-Ray Mode** (เธ•เธนเนเธญเธทเนเธ opacity 60%) + **Beacon เธชเธตเน€เธซเธฅเธทเธญเธ** + **Floating Label** (เน€เธฅเธเธ•เธนเน + เธเธดเธเธฑเธ” + เธชเธฒเธขเน€เธฃเธทเธญ) + เธงเธเนเธซเธงเธเธเธเธเธทเนเธ + เธเธฅเนเธญเธเธเธนเธก smooth

#### เนเธ—เนเธ "เธเธฑเธ”เธงเธฒเธเธ•เธนเน" (Smart Auto-Allocation)
- เธเธญเธฃเนเธกเธฃเธฐเธเธธเธ•เธนเน (เน€เธฅเธเธ•เธนเน, เธเธเธฒเธ”, เธเธฃเธฐเน€เธ เธ—, เธชเธฒเธขเน€เธฃเธทเธญ)
- เธเธธเนเธก "เธเธญเนเธเธฐเธเธณเธเธดเธเธฑเธ”" โ’ เน€เธฃเธตเธขเธ API โ’ เนเธชเธ”เธ Top 5 suggestions เธเธฃเนเธญเธกเธเธฐเนเธเธ+เน€เธซเธ•เธธเธเธฅ
- เน€เธฅเธทเธญเธ suggestion โ’ เธขเธทเธเธขเธฑเธเธงเธฒเธเธ•เธนเน โ’ Gate-In เน€เธเนเธฒเธฅเธฒเธเธเธฃเธดเธ

#### เนเธ—เนเธ "เธ•เธฃเธงเธเธเธฑเธ" (Yard Audit & Manual Override)
- เน€เธฅเธทเธญเธเนเธเธ โ’ Checklist เนเธขเธเธ•เธฒเธก Bay
- เธเธ”เน€เธเนเธเธ•เธนเนเธ—เธตเนเธเธ โ’ **เธชเนเธเธเธฅเธ•เธฃเธงเธเธเธฑเธเธเธฃเธดเธ** เธเนเธฒเธ API โ’ เธชเธฃเธธเธเธเธฅ % accuracy
- **Manual Override**: เธเธธเนเธกเนเธเนเนเธเธเธดเธเธฑเธ”เธ•เธนเน (bay/row/tier) inline โ’ เธเธฑเธเธ—เธถเธ + audit log
- **Swap/Float**: เน€เธกเธทเนเธญเธ•เธนเนเธเนเธญเธเธ—เธฑเธ โ’ modal เน€เธฅเธทเธญเธ Swap (เธชเธฅเธฑเธเธเธดเธเธฑเธ”) เธซเธฃเธทเธญ Float (เธขเธเธ•เธนเนเน€เธ”เธดเธกเธญเธญเธ)
- **เธเธฃเธฐเธงเธฑเธ•เธดเนเธเนเนเธ**: เธ”เธนเธ•เธฒเธฃเธฒเธ audit log เนเธชเธ”เธ เนเธเธฃ เธขเนเธฒเธขเธ•เธนเนเธญเธฐเนเธฃ เธเธฒเธเนเธซเธเนเธเนเธซเธ เน€เธกเธทเนเธญเนเธฃ

### 7.5 เธเธฃเธฐเธ•เธน Gate (Gate In/Out)

3 เนเธ—เนเธ:

#### เนเธ—เนเธ "Gate-In (เธฃเธฑเธเน€เธเนเธฒ)"
- เธเธญเธฃเนเธกเธเธฃเธญเธเธเนเธญเธกเธนเธฅเธ•เธนเน (เน€เธฅเธเธ•เธนเน, เธเธเธฒเธ”, เธเธฃเธฐเน€เธ เธ—, เธชเธฒเธขเน€เธฃเธทเธญ, เธเธตเธฅ) + เธเธเธเธฑเธ/เธ—เธฐเน€เธเธตเธขเธเธฃเธ– + Booking Ref
- เธเธ”เธฃเธฑเธเธ•เธนเน โ’ เธชเธฃเนเธฒเธ Container + GateTransaction + **เธญเธญเธ EIR เธญเธฑเธ•เนเธเธกเธฑเธ•เธด**
- **Auto Allocation**: เธ–เนเธฒเนเธกเนเธฃเธฐเธเธธ zone โ’ เธฃเธฐเธเธเธเธฑเธ”เธเธดเธเธฑเธ” zone/bay/row/tier เธญเธฑเธ•เนเธเธกเธฑเธ•เธด
- เนเธชเธ”เธเธเธดเธเธฑเธ”เธ—เธตเนเธเธฑเธ”เนเธซเนเธ—เธฑเธเธ—เธตเธซเธฅเธฑเธ gate-in เธชเธณเน€เธฃเนเธ
- **Auto Work Order**: เธชเธฃเนเธฒเธเธเธณเธชเธฑเนเธเธขเนเธฒเธขเธ•เธนเนเธญเธฑเธ•เนเธเธกเธฑเธ•เธดเนเธซเนเธเธเธเธฑเธเธฃเธ–เธขเธ (เธฅเธณเธ”เธฑเธ: เธเธเธ•เธด) โ€” notes เธฃเธงเธก ๐ เธ—เธฐเน€เธเธตเธขเธเธฃเธ– + ๐‘ค เธเธทเนเธญเธเธเธเธฑเธ
- เธฃเธญเธเธฃเธฑเธเธ•เธนเนเธ—เธตเนเน€เธเธข gate-out เนเธเนเธฅเนเธงเธเธฅเธฑเธเน€เธเนเธฒเธกเธฒเนเธซเธกเน (re-enter)
- **ISO 6346 Check Digit Validation** (**เนเธซเธกเน**):
  - เธ•เธฃเธงเธ check digit real-time เน€เธกเธทเนเธญเธเธดเธกเธเนเธเธฃเธ 11 เธซเธฅเธฑเธ
  - ๐ข เธ–เธนเธ โ’ เธเธญเธเน€เธเธตเธขเธง + "Check Digit OK"
  - ๐”ด เธเธดเธ” โ’ เธเธญเธเนเธ”เธ + เนเธเนเธเธเนเธฒเธ—เธตเนเธ–เธนเธเธ•เนเธญเธ + **เธเธฅเนเธญเธเธเธธเนเธก Gate-In**
- **Boxtech API Auto-Fill** (**เนเธซเธกเน**):
  - เน€เธกเธทเนเธญ check digit เธเนเธฒเธ โ’ เน€เธฃเธตเธขเธ Boxtech API เธ”เธถเธเธเนเธญเธกเธนเธฅเธชเธฒเธขเน€เธฃเธทเธญ/เธเธเธฒเธ”/เธเธฃเธฐเน€เธ เธ—
  - Auto-fill เธเนเธญเธ shipping_line, size, type + badge "โ… Boxtech"
  - Token cache เธเธฑเนเธ server (auto-refresh)
- **Prefix โ’ Customer Mapping** (**เนเธซเธกเน**):
  - เธเธฑเธเธเธนเน prefix เธเธฑเธเธฅเธนเธเธเนเธฒเธเธฒเธ PrefixMapping table โ’ เนเธชเธ”เธเธเธทเนเธญเธฅเธนเธเธเนเธฒเธ—เธฑเธเธ—เธต
- **Fallback โ€” เธ•เธนเน prefix เนเธกเนเธฃเธนเนเธเธฑเธ** (**เนเธซเธกเน**):
  - เนเธกเนเธเธฅเนเธญเธ Gate-In โ€” เธเธฅเนเธญเธขเธเนเธญเธเธชเธฒเธขเน€เธฃเธทเธญเธงเนเธฒเธ เนเธซเนเธเธเธฑเธเธเธฒเธเธเธดเธกเธเนเน€เธญเธ
  - เธเธฑเธเธ—เธถเธ `unknown_prefix_alert` เธฅเธ AuditLog โ’ Admin เน€เธซเนเธเน€เธ•เธทเธญเธเนเธเน€เธเธดเนเธก prefix
- **๐’ฐ Gate-In Billing** (**เนเธซเธกเน**):
  - เน€เธกเธทเนเธญ check digit เธเนเธฒเธ โ’ เธเธณเธเธงเธ“เธเนเธฒเธเธฃเธดเธเธฒเธฃ Gate-In เธญเธฑเธ•เนเธเธกเธฑเธ•เธด (LOLO, gate fee เธฏเธฅเธฏ เธเธฒเธ Tariffs โ€” **เนเธกเนเธฃเธงเธก storage**)
  - **Billing Card**: เธ•เธฒเธฃเธฒเธเธฃเธฒเธขเธเธฒเธฃ + checkbox เน€เธฅเธทเธญเธ/เธขเธเน€เธฅเธดเธ + เนเธเนเนเธเธฃเธฒเธเธฒเนเธ”เน + เน€เธเธดเนเธกเธฃเธฒเธขเธเธฒเธฃเน€เธญเธ + VAT 7% + เธขเธญเธ”เธฃเธงเธก
  - **เน€เธเนเธเน€เธเธฃเธ”เธดเธ•เธฅเธนเธเธเนเธฒ**: เธ”เธถเธ prefix 4 เธ•เธฑเธงเนเธฃเธ โ’ PrefixMapping โ’ Customers โ’ เธ•เธฃเธงเธ `credit_term`
    - **เธฅเธนเธเธเนเธฒเน€เธเธฃเธ”เธดเธ•** โ’ เธเธธเนเธก "๐“ เธงเธฒเธเธเธดเธฅ" (เธชเธฃเนเธฒเธเนเธเนเธเนเธเธซเธเธตเน pending)
    - **เธฅเธนเธเธเนเธฒเน€เธเธดเธเธชเธ”** โ’ เน€เธฅเธทเธญเธเธงเธดเธเธต (๐’ต เน€เธเธดเธเธชเธ” / ๐’ณ เนเธญเธ) โ’ เธเธธเนเธก "๐’ฐ เธเธณเธฃเธฐเน€เธเธดเธ"
  - เธซเธฅเธฑเธเธเธณเธฃเธฐ โ’ เธเธธเนเธก **"๐–จ๏ธ เธเธดเธกเธเนเนเธเน€เธชเธฃเนเธ"** / **"๐–จ๏ธ เธเธดเธกเธเนเนเธเนเธเนเธเธซเธเธตเน"**
  - **เนเธขเธเธเธธเนเธกเธเธฑเธ”เน€เธเธ**: เธเธณเธฃเธฐเธเนเธญเธ โ’ เธเธถเธเธเธ” "เธฃเธฑเธเธ•เธนเนเน€เธเนเธฒเธฅเธฒเธ + เธญเธญเธ EIR" (เธเธธเนเธกเธฅเนเธญเธเธ–เนเธฒเธขเธฑเธเนเธกเนเธเธณเธฃเธฐ + เนเธเนเธเน€เธ•เธทเธญเธ โ ๏ธ)
  - เธ–เนเธฒเนเธกเนเธกเธต Tariff charges โ’ เธเธธเนเธก Gate-In เนเธเนเนเธ”เนเน€เธฅเธขเนเธกเนเธ•เนเธญเธเธเธณเธฃเธฐ
  - เธเธฑเธเธ—เธถเธ `processed_by` (user_id) เธฅเธ GateTransactions โ€” เนเธชเธ”เธเธเธทเนเธญเธเธนเนเธ”เธณเน€เธเธดเธเธเธฒเธฃเนเธเธเธฃเธฐเธงเธฑเธ•เธด
- **UX โ€” Toast Banner**: เธซเธฅเธฑเธ Gate-In เธชเธณเน€เธฃเนเธ โ’ form reset เธ—เธฑเธเธ—เธต (เธเธฃเธญเธเน€เธฅเธเธ•เธนเนเนเธซเธกเนเนเธ”เนเน€เธฅเธข) + toast banner เน€เธฅเนเธเน เนเธชเธ”เธ EIR number + เธเธธเนเธก "เธเธดเธกเธเน EIR" + โ• เธเธดเธ”เนเธ”เน + auto-dismiss 15 เธงเธดเธเธฒเธ—เธต

#### เนเธ—เนเธ "Gate-Out (เธเธฅเนเธญเธขเธญเธญเธ)" โ€” **2-Phase Workflow**

เธเธฑเนเธเธ•เธญเธเธ—เธตเน 1 โ€” **เธเธญเธ”เธถเธเธ•เธนเน**:
- เธเนเธเธซเธฒเธ•เธนเนเนเธเธฅเธฒเธ โ’ เน€เธฅเธทเธญเธเธ•เธนเน โ’ เธเธฃเธญเธเธเธเธเธฑเธ/เธ—เธฐเน€เธเธตเธขเธ โ’ **เธเธณเธฃเธฐเน€เธเธดเธ/เธงเธฒเธเธเธดเธฅเธเนเธญเธ** โ’ เธเธ”เธเธธเนเธก "เธเธญเธ”เธถเธเธ•เธนเน"
- **เธเธธเนเธก "เธเธญเธ”เธถเธเธ•เธนเน" เธฅเนเธญเธ** เธเธเธเธงเนเธฒเธเธฐเธเธณเธฃเธฐเน€เธเธดเธ (เน€เธเธดเธเธชเธ”) เธซเธฃเธทเธญเธงเธฒเธเธเธดเธฅ (เธฅเธนเธเธเนเธฒเน€เธเธฃเธ”เธดเธ•) เน€เธชเธฃเนเธ
- เธชเธฃเนเธฒเธ Work Order เธชเนเธเนเธเธซเธเนเธฒเธเธเธดเธเธฑเธ•เธดเธเธฒเธฃ (**เธขเธฑเธเนเธกเนเธญเธญเธ EIR**) โ€” notes เธฃเธงเธก ๐ เธ—เธฐเน€เธเธตเธขเธเธฃเธ– + ๐‘ค เธเธทเนเธญเธเธเธเธฑเธ
- เธเธฑเธเธ—เธถเธเธเนเธญเธกเธนเธฅเธเธเธเธฑเธเธฅเธ localStorage (persist เธเนเธฒเธกเธซเธเนเธฒ)

เธเธฑเนเธเธ•เธญเธเธ—เธตเน 2 โ€” **เธฃเธญเธฃเธ–เธขเธ**:
- เนเธชเธ”เธ ๐ "เธฃเธญเธฃเธ–เธขเธเธเธณเธ•เธนเนเธกเธฒเธ—เธตเนเธเธฃเธฐเธ•เธน..." เธเธฃเนเธญเธก step indicator
- เน€เธกเธทเนเธญเธเธฅเธฑเธเธกเธฒเธเนเธเธซเธฒเธ•เธนเนเน€เธ”เธดเธก เธฃเธฐเธเธเธ•เธฃเธงเธ Work Order เธญเธฑเธ•เนเธเธกเธฑเธ•เธด โ’ เธเนเธฒเธกเนเธ Phase เธ—เธตเนเธ–เธนเธเธ•เนเธญเธ

เธเธฑเนเธเธ•เธญเธเธ—เธตเน 3 โ€” **เธเธฅเนเธญเธขเธ•เธนเน + เธญเธญเธ EIR**:
- เธ–เนเธฒเธขเธฃเธนเธเธ•เธนเนเธเธฒเธญเธญเธ (เนเธกเนเธเธฑเธเธเธฑเธ, เธชเธนเธเธชเธธเธ” 4 เธฃเธนเธ) โ’ เธญเธฑเธเนเธซเธฅเธ”เน€เธเนเธเนเธเธฅเนเธญเธฑเธ•เนเธเธกเธฑเธ•เธด
- เธเธ”เธขเธทเธเธขเธฑเธเธเธฅเนเธญเธขเธ•เธนเน โ’ เธญเธฑเธเน€เธ”เธ— container status + **เธญเธญเธ EIR เธญเธฑเธ•เนเธเธกเธฑเธ•เธด** (เธฃเธงเธกเธเนเธญเธกเธนเธฅเธเธเธเธฑเธเธเธฒเธ Phase 1)
- เธฃเธนเธเธ–เนเธฒเธขเธเธฒเธญเธญเธเน€เธเนเธเน€เธเนเธ `exit_photos` เนเธ `damage_report` JSON (URL, เนเธกเนเนเธเน base64)

**๐’ฐ Gate-Out Billing**:
- เน€เธฅเธทเธญเธเธ•เธนเน โ’ เธเธณเธเธงเธ“เธเนเธฒเธเธฃเธดเธเธฒเธฃเธญเธฑเธ•เนเธเธกเธฑเธ•เธดเธเธฒเธ **Tiered Storage Rates** (เธ•เธฒเธกเธงเธฑเธเธ—เธตเนเธญเธขเธนเน + เธเธเธฒเธ”เธ•เธนเน 20'/40'/45')
- **Billing Card เนเธชเธ”เธเธ—เธธเธ Phase**: เนเธกเนเธงเนเธฒเธเธฐเน€เธเนเธ Phase 1/2/3 โ’ billing card เนเธชเธ”เธเน€เธชเธกเธญ
- **Checkbox เน€เธฅเธทเธญเธเธฃเธฒเธขเธเธฒเธฃ**: storage/LOLO/gate เน€เธเธดเธ”เธญเธฑเธ•เนเธเธกเธฑเธ•เธด, เธเนเธฒเธฅเนเธฒเธ/PTI/reefer/M&R เธเธดเธ”เนเธงเน โ€” เธ•เธดเนเธเน€เธฅเธทเธญเธเธ•เธฒเธกเธเธฃเธดเธ
- **เนเธเนเนเธเธฃเธฒเธเธฒเนเธ”เน**: เธ—เธธเธเธฃเธฒเธขเธเธฒเธฃเธกเธตเธเนเธญเธเธเธฃเธญเธเธฃเธฒเธเธฒ เนเธเนเนเธ”เนเธ—เธฑเธเธ—เธต โ€” เธขเธญเธ”เธฃเธงเธก+VAT เธเธณเธเธงเธ“เนเธซเธกเน real-time
- **เน€เธเธดเนเธกเธฃเธฒเธขเธเธฒเธฃเน€เธญเธ**: เธเธธเนเธก "+ เน€เธเธดเนเธกเธฃเธฒเธขเธเธฒเธฃเธเนเธฒเธเธฃเธดเธเธฒเธฃ" โ’ เธเธฃเธญเธเธเธทเนเธญ + เธฃเธฒเธเธฒ + เธฅเธเนเธ”เน (โ•)
- **เนเธขเธ Invoice เธเธฒเน€เธเนเธฒ/เธเธฒเธญเธญเธ**: Gate-Out เนเธกเนเธ”เธถเธ invoice เธเธฒเน€เธเนเธฒเธกเธฒเธเธฅเนเธญเธ โ€” เธชเธฃเนเธฒเธ invoice เนเธซเธกเนเนเธ”เนเน€เธชเธกเธญ
- **เน€เธเนเธเน€เธเธฃเธ”เธดเธ•เธฅเธนเธเธเนเธฒเธเนเธฒเธ PrefixMapping**: เธ”เธถเธ prefix 4 เธ•เธฑเธงเนเธฃเธ โ’ PrefixMapping โ’ Customers โ’ เธ•เธฃเธงเธ `credit_term`
- เธฃเธญเธเธฃเธฑเธ 2 เธงเธดเธเธตเธเนเธฒเธข: ๐’ต เน€เธเธดเธเธชเธ” / ๐’ณ เนเธญเธ 
- **เธฅเธนเธเธเนเธฒเน€เธเธฃเธ”เธดเธ• โ’ เธ•เนเธญเธเธงเธฒเธเธเธดเธฅเธเนเธญเธ** เธเธ”เธเธญเธ”เธถเธเธ•เธนเน (เธเธธเนเธกเธเธญเธ”เธถเธเธ•เธนเนเธฅเนเธญเธเธเธเธเธงเนเธฒเธงเธฒเธเธเธดเธฅเน€เธชเธฃเนเธ)
- เธซเธฅเธฑเธเธเธณเธฃเธฐ โ’ เธเธธเนเธก **"๐–จ๏ธ เธเธดเธกเธเนเนเธเน€เธชเธฃเนเธ"** เธเธถเนเธเธกเธฒเธ—เธฑเธเธ—เธต
- เนเธเน€เธชเธฃเนเธ/เนเธเนเธเนเธเธซเธเธตเนเธเธฑเธเธ—เธถเธ **เน€เธเธเธฒเธฐเธฃเธฒเธขเธเธฒเธฃเธ—เธตเนเน€เธฅเธทเธญเธ** + เธฃเธฒเธเธฒเธ—เธตเนเนเธเนเนเธ
- **UX โ€” Toast Banner**: เธซเธฅเธฑเธ Gate-Out เธชเธณเน€เธฃเนเธ โ’ form reset เธ—เธฑเธเธ—เธต + toast banner เนเธชเธ”เธ EIR print + auto-dismiss 15 เธงเธดเธเธฒเธ—เธต
- **WO เธเธฃเธญเธเน€เธเธเธฒเธฐเธฃเธญเธเธเธฑเธเธเธธเธเธฑเธ**: เธ”เธนเน€เธเธเธฒเธฐ Work Orders เธ—เธตเนเธชเธฃเนเธฒเธเธซเธฅเธฑเธ gate_in_date โ€” เนเธกเนเธ”เธถเธ WO เน€เธเนเธฒเธกเธฒเธเนเธฒเธก Phase

#### เนเธ—เนเธ "เธเธฃเธฐเธงเธฑเธ•เธด Gate"
- เธ•เธฒเธฃเธฒเธ transactions + เธฅเธดเธเธเนเธ”เธน EIR เธ—เธธเธเธฃเธฒเธขเธเธฒเธฃ
- **เธเธนเนเธ”เธณเน€เธเธดเธเธเธฒเธฃ**: เนเธชเธ”เธเธเธทเนเธญ user เธ—เธตเนเธ—เธณ Gate-In/Out (เธเธฒเธ `processed_by` โ’ Users.full_name)
- **Date picker**: เน€เธฅเธทเธญเธเธ”เธนเธเธฃเธฐเธงเธฑเธ•เธดเธงเธฑเธเนเธซเธเธเนเนเธ”เน + เธเธธเนเธก "เธงเธฑเธเธเธตเน" เธชเธณเธซเธฃเธฑเธเธเธฅเธฑเธเธกเธฒเธงเธฑเธเธเธฑเธเธเธธเธเธฑเธ
- **เธเนเธญเธเธเนเธเธซเธฒ**: เธเนเธเธซเธฒเธ”เนเธงเธขเน€เธฅเธเธ•เธนเน, เธเธทเนเธญเธเธเธเธฑเธ, เธ—เธฐเน€เธเธตเธขเธเธฃเธ–, เน€เธฅเธ EIR (เธเธ” Enter)
- **๐“ Pagination** (**เนเธซเธกเน**): 25 เธฃเธฒเธขเธเธฒเธฃ/เธซเธเนเธฒ + เธเธธเนเธกเน€เธฅเธเธซเธเนเธฒ + Prev/Next
- เนเธชเธ”เธเธงเธฑเธเธ—เธตเน+เน€เธงเธฅเธฒ + เธเธณเธเธงเธเธฃเธฒเธขเธเธฒเธฃ

### 7.6 EIR (Equipment Interchange Receipt) โ€” A5 Print
- **A5 Landscape** print layout เธเธฃเนเธญเธกเธเธธเนเธก "เธเธดเธกเธเน A5"
- **React Portal**: render เน€เธเนเธ direct child เธเธญเธ `<body>` โ€” เธเนเธญเธเธเธฑเธ print เธเนเธณเธซเธฅเธฒเธขเธซเธเนเธฒ
- เน€เธฅเธ EIR เธญเธญเธเธญเธฑเธ•เนเธเธกเธฑเธ•เธด (EIR-IN-YYYY-XXXXXX / EIR-OUT-YYYY-XXXXXX)
- เธเนเธญเธกเธนเธฅเธเธฃเธ: เธ•เธนเน, เธเธเธเธฑเธ, เธฃเธ–, เธเธตเธฅ, เธฅเธฒเธ, เธเธดเธเธฑเธ”, เธเธนเนเธ”เธณเน€เธเธดเธเธเธฒเธฃ
- **Company Header**: เธเธทเนเธญเธเธฃเธดเธฉเธฑเธ— + (เธชเธณเธเธฑเธเธเธฒเธเนเธซเธเน) + เธ—เธตเนเธญเธขเธนเน + เน€เธฅเธเธเธฃเธฐเธเธณเธ•เธฑเธงเธเธนเนเน€เธชเธตเธขเธ เธฒเธฉเธต + เน€เธเธญเธฃเนเนเธ—เธฃ + เนเธฅเนเธเน
- **เธชเธ เธฒเธเธ•เธนเน (Container Condition)**: โ… Sound / โ ๏ธ Damage (เธเธณเธเธงเธ“เธเธฒเธ damage_report)
- **เน€เธเธฃเธ”เธ•เธนเน (Container Grade)**: A (เธชเธ เธฒเธเธ”เธต) / B (เธชเธ เธฒเธเธเธญเนเธเน) / C (เนเธชเนเธเธญเธเธ—เธฑเนเธงเนเธ) / D (เธซเนเธฒเธกเนเธเนเธเธฒเธ)
- **QR Code**: เธชเนเธเธเน€เธเธดเธ”เธซเธเนเธฒ `/eir/{eir_number}` โ’ เธ”เธนเธฃเธนเธเธ–เนเธฒเธข + **เธฃเธฒเธขเธเธฒเธเธเธงเธฒเธกเน€เธชเธตเธขเธซเธฒเธข** (เนเธกเนเนเธชเธ”เธเนเธเน€เธญเธเธชเธฒเธฃ)
- **เธเนเธญเธเธฅเธฒเธขเน€เธเนเธ 3 เธเนเธญเธ**: เธเธนเนเธ•เธฃเธงเธเธชเธ เธฒเธเธ•เธนเน / เธเธเธเธฑเธเธฃเธ– / เธเธนเนเธญเธเธธเธกเธฑเธ•เธด
- **Print CSS**: `body > *:not(#eir-overlay) { display: none }` + Portal render
- **Public EIR Page** (`/eir/[id]`): เธซเธเนเธฒเธชเธฒเธเธฒเธฃเธ“เธฐ mobile-friendly โ€” เธเนเธญเธกเธนเธฅเธ•เธนเน + เธฃเธนเธเธ–เนเธฒเธข + เธฃเธฒเธขเธเธฒเธเธเธงเธฒเธกเน€เธชเธตเธขเธซเธฒเธข (เธเธ”เธเธขเธฒเธขเน€เธ•เนเธกเธเธญ)

### 7.7 เธ•เธฃเธงเธเธชเธ เธฒเธเธ•เธนเน (Container Inspection)
- เนเธเธเธเธฑเธ 6 เธ”เนเธฒเธ: Front, Back, Left, Right, Top, Floor
- เธเธ”เธกเธฒเธฃเนเธเธเธธเธ”เน€เธชเธตเธขเธซเธฒเธข (dent, hole, rust, scratch, crack, missing_part)
- เธฃเธฐเธ”เธฑเธเธเธงเธฒเธกเธฃเธธเธเนเธฃเธ: minor / major / severe
- Auto-grade: A (เธ”เธต), B (เธเธญเนเธเน), C (เธเธณเธฃเธธเธ”), D (เธเธณเธฃเธธเธ”เธซเธเธฑเธ)
- เน€เธเนเธเธเนเธญเธกเธนเธฅเน€เธเนเธ JSON เนเธ GateTransactions.damage_report

### 7.8a File Storage (Local)
- เธฃเธนเธเธ–เนเธฒเธขเธ—เธฑเนเธเธซเธกเธ” (Gate photo, Exit photo, Logo) **เธญเธฑเธเนเธซเธฅเธ”เน€เธเนเธเนเธเธฅเน** เนเธกเนเนเธเน base64 เนเธ DB
- เน€เธเนเธเธ—เธตเน `public/uploads/{folder}/{YYYY-MM}/` โ’ เน€เธเนเธฒเธ–เธถเธเธเนเธฒเธ URL path
- `PhotoCapture` component เธญเธฑเธเนเธซเธฅเธ”เธญเธฑเธ•เนเธเธกเธฑเธ•เธด + เนเธชเธ”เธ loading overlay
- Fallback: เธ–เนเธฒเธญเธฑเธเนเธซเธฅเธ”เนเธกเนเธชเธณเน€เธฃเนเธเธเธฐ fallback เน€เธเนเธ base64
- `/public/uploads` เธญเธขเธนเนเนเธ `.gitignore`

### 7.8b Global Search (Topbar)
- เธเนเธญเธเธเนเธเธซเธฒเธเธเธชเธธเธ”เธเนเธเธซเธฒ **เธเธฒเธ API เธเธฃเธดเธ** (`/api/containers?search=`)
- Debounce 300ms, เนเธชเธ”เธเธชเธนเธเธชเธธเธ” 8 เธเธฅเธฅเธฑเธเธเน
- เนเธชเธ”เธ: เน€เธฅเธเธ•เธนเน, เธเธเธฒเธ”/เธเธฃเธฐเน€เธ เธ—, เธชเธฒเธขเน€เธฃเธทเธญ, เธ•เธณเนเธซเธเนเธ Zone, เธชเธ–เธฒเธเธฐ (badge เธชเธต)
- เธเธ”เน€เธฅเธทเธญเธ โ’ เนเธเธซเธเนเธฒ Yard Management
- เนเธกเนเธเธเธเธฅเธฅเธฑเธเธเน โ’ เนเธชเธ”เธเธเนเธญเธเธงเธฒเธก "เนเธกเนเธเธ"

### 7.8c Notification Bell (Topbar)
- เธเธฃเธฐเธ”เธดเนเธเนเธเนเธเน€เธ•เธทเธญเธเธ—เธณเธเธฒเธเนเธ”เนเธเธฃเธดเธ โ€” เธ”เธถเธเธเธดเธเธเธฃเธฃเธกเธฅเนเธฒเธชเธธเธ”เธเธฒเธ Gate + Work Orders
- Badge เธ•เธฑเธงเน€เธฅเธเนเธชเธ”เธเธเธณเธเธงเธเธ—เธตเนเธขเธฑเธเนเธกเนเธญเนเธฒเธ (เธชเธตเนเธ”เธ)
- เธเธ”เธเธฃเธฐเธ”เธดเนเธ โ’ เน€เธเธดเธ” dropdown เธฃเธฒเธขเธเธฒเธฃเนเธเนเธเน€เธ•เธทเธญเธ
- เนเธญเธเธญเธเธชเธตเธ•เธฒเธกเธเธฃเธฐเน€เธ เธ—: ๐“ฅ Gate-In, ๐“ค Gate-Out, โ… เน€เธชเธฃเนเธ, ๐• เธเธฒเธเนเธซเธกเน
- เน€เธงเธฅเธฒเธชเธฑเธกเธเธฑเธ—เธเน (3 min, 2 hr, 1 d) + เธเธธเธ”เธชเธตเธเนเธณเน€เธเธดเธ unread
- เธเธธเนเธก "เธญเนเธฒเธเธ—เธฑเนเธเธซเธกเธ”เนเธฅเนเธง" โ’ เน€เธฃเธตเธขเธ `PATCH /api/notifications` เธเธฑเธเธ—เธถเธ timestamp เธฅเธ **Database** (เธเธดเธเธเนเธเนเธฒเธกเธ—เธธเธ browser เนเธฅเธฐ device เธเธญเธ user เน€เธ”เธตเธขเธงเธเธฑเธ)
- **Cross-Browser/Device Sync** (**เนเธเนเนเธ 31 เธกเธต.เธ. 2569**): เธชเธ–เธฒเธเธฐ "เธญเนเธฒเธเนเธฅเนเธง" เน€เธเนเธเนเธ `Users.notif_last_read_at` เธเธ DB โ€” เน€เธเธดเธ”เธซเธฅเธฒเธข tab/browser/device เนเธกเน flash badge เธเนเธณ
- **Per-user read state**: เนเธ•เนเธฅเธฐ user เธกเธต read timestamp เนเธขเธเธเธฑเธเนเธ DB โ€” เนเธกเนเธเนเธฒเธกเนเธเนเธเนเธเธญเธ user เธญเธทเนเธ
- `GET /api/notifications?user_id=Y` เธชเนเธ `last_read_at` เธเธฅเธฑเธเธกเธฒเธเธฃเนเธญเธกเธเนเธญเธกเธนเธฅ โ€” frontend เนเธเนเธเนเธฒเธเธตเนเน€เธเธฃเธตเธขเธเน€เธ—เธตเธขเธ (เนเธกเนเธ•เนเธญเธเธเธถเนเธ localStorage เธญเธตเธเธ•เนเธญเนเธ)
- เธฃเธตเน€เธเธฃเธเธญเธฑเธ•เนเธเธกเธฑเธ•เธดเธ—เธธเธ 30 เธงเธดเธเธฒเธ—เธต

### 7.8 เธเธเธดเธเธฑเธ•เธดเธเธฒเธฃ (Operations)

3 เนเธ—เนเธ:

#### เนเธ—เนเธ "Job Queue"
- เธ•เธฒเธฃเธฒเธ Work Orders + **2-button workflow** เธชเธณเธซเธฃเธฑเธเธเธเธเธฑเธเธฃเธ–เธขเธ:
  - ๐“ฅ **เธฃเธฑเธเธเธฒเธ** (pending โ’ in_progress โ€” เธเนเธฒเธก assigned)
  - โ… **เน€เธชเธฃเนเธ** (in_progress โ’ completed + เธญเธฑเธเน€เธ”เธ—เธเธดเธเธฑเธ”เธ•เธนเนเธญเธฑเธ•เนเธเธกเธฑเธ•เธด)
- **SSE Real-Time** (**เนเธซเธกเน**): เน€เธเธทเนเธญเธกเธ•เนเธญ `/api/operations/stream` เธเนเธฒเธ EventSource โ€” เธเธฒเธเนเธซเธกเนเธเธถเนเธเธญเธฑเธ•เนเธเธกเธฑเธ•เธดเนเธกเนเธ•เนเธญเธ refresh + ๐ข Live indicator + auto-reconnect
- **โฑ Container Timeline** (**เนเธซเธกเน**): เธ—เธธเธ Work Order เธกเธตเธเธธเนเธกเธ”เธน Container Timeline เธเธญเธเธ•เธนเนเธเธฑเนเธ (dynamic import)
- **Direction Badge** (**เนเธซเธกเน**): ๐“ค เธชเนเธเธญเธญเธ (Gate-Out) / ๐“ฅ เธฃเธฑเธเน€เธเนเธฒ (Gate-In) เนเธชเธ”เธเธเธฑเธ”เน€เธเธเธเธเธเธฒเธฃเนเธ”เธเธฒเธ
- **Truck/Driver Info** (**เนเธซเธกเน**): ๐ เธ—เธฐเน€เธเธตเธขเธเธฃเธ– + ๐‘ค เธเธทเนเธญเธเธเธเธฑเธ เนเธชเธ”เธเนเธเนเธ•เนเธฅเธฐ WO (เธ”เธถเธเธเธฒเธ notes)
- **เน€เธเธฅเธตเนเธขเธเธ•เธณเนเธซเธเนเธเธงเธฒเธเธ•เธนเนเนเธ”เน**: เธเธ”เน€เธชเธฃเนเธ โ’ เนเธชเธ”เธเธเธญเธฃเนเธกเนเธเนเธ Zone/Bay/Row/Tier (pre-fill เธ•เธณเนเธซเธเนเธเน€เธ”เธดเธก, **Zone dropdown เนเธซเธฅเธ”เธเธฒเธ API เธ–เธนเธเธ•เนเธญเธ**) โ’ เธขเธทเธเธขเธฑเธเน€เธชเธฃเนเธเธชเธดเนเธ
- Filter เธ•เธฒเธก status
- เธเธธเนเธกเธขเธเน€เธฅเธดเธเธชเธณเธซเธฃเธฑเธเธเธฒเธเธ—เธตเนเธขเธฑเธเนเธกเนเน€เธฃเธดเนเธก
- เธเธธเนเธก Mobile เธเธเธฒเธ”เนเธซเธเน (48px+) เธชเธณเธซเธฃเธฑเธเนเธชเนเธ–เธธเธเธกเธทเธญเธเธ”เนเธ”เน

#### เนเธ—เนเธ "เธชเธฃเนเธฒเธเธเธฒเธ"
- เน€เธฅเธทเธญเธเธเธฃเธฐเน€เธ เธ—: เธขเนเธฒเธขเธ•เธนเน / เธซเธฅเธเธ•เธนเน / เธเธฑเธ”เน€เธฃเธตเธขเธ
- เธเนเธเธซเธฒเธ•เธนเน โ’ เน€เธฅเธทเธญเธ โ’ เธเธณเธซเธเธ”เธเธฅเธฒเธขเธ—เธฒเธ (Zone/Bay/Row/Tier)
- เธ•เธฑเนเธเธเธงเธฒเธกเธชเธณเธเธฑเธ (เธ”เนเธงเธเธกเธฒเธ / เธ”เนเธงเธ / เธเธเธ•เธด / เธ•เนเธณ)

#### เนเธ—เนเธ "Smart Shifting" (LIFO)
- เธเนเธเธซเธฒเธ•เธนเนเธฅเนเธฒเธเธ—เธตเนเธ•เนเธญเธเธ”เธถเธเธญเธญเธ
- เธฃเธฐเธเธเธงเธดเน€เธเธฃเธฒเธฐเธซเนเธ•เธนเนเธ—เธตเนเธเนเธญเธเธเนเธฒเธเธเธ (LIFO) โ€” **เธฃเธงเธกเธ—เธธเธเธชเธ–เธฒเธเธฐ** (in_yard, repair, hold เธฏเธฅเธฏ) เธขเธเน€เธงเนเธ gated_out
- เนเธชเธ”เธ: เธ•เธนเนเธ—เธตเนเธ•เนเธญเธเธซเธฅเธ + เธ•เธณเนเธซเธเนเธเธเธฑเธเธเธฑเนเธงเธเธฃเธฒเธง + total moves

### 7.9 3D Yard Viewer (Three.js)

เธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เน€เธ—เธเธเธดเธ:

| เธเธตเน€เธเธญเธฃเน | เธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ” |
|---------|-----------|
| **เธชเธฑเธ”เธชเนเธงเธเธเธฃเธดเธ** | 20ft=2.4ร—1.0ร—1.06, 40ft=4.9ร—1.0ร—1.06, 45ft HC ร—1.12 |
| **เธชเธตเธ•เธฒเธกเธชเธฒเธขเน€เธฃเธทเธญ** | Evergreen=เน€เธเธตเธขเธง, MSC=เธเนเธณเน€เธเธดเธเน€เธเนเธก, Maersk=เธเนเธฒ, COSCO=เนเธ”เธ, ONE=เธเธกเธเธน, Yang Ming=เน€เธซเธฅเธทเธญเธ เธฏเธฅเธฏ |
| **เธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธ•เธนเน** | Edge lines, corrugation (เธฅเธญเธเธเธฅเธทเนเธ), door lines + handles, corner posts 4 เธกเธธเธก, top rail |
| **Hover tooltip** | เน€เธฅเธเธ•เธนเน \| เธเธเธฒเธ” \| เธชเธฒเธขเน€เธฃเธทเธญ \| เธชเธ–เธฒเธเธฐ \| เธเธดเธเธฑเธ” |
| **Click** | เน€เธฅเธทเธญเธเธ•เธนเน โ’ detail panel |
| **X-Ray Mode** | เธ•เธนเนเธญเธทเนเธ opacity 60% + beacon เธชเธตเน€เธซเธฅเธทเธญเธ + เธงเธเนเธซเธงเธเธเธเธเธทเนเธ + **floating label** (billboard) |
| **Camera** | OrbitControls + smooth lerp zoom (cubic easing) |
| **Stack** | Ground-up stacking โ€” เนเธกเนเธกเธตเธ•เธนเนเธฅเธญเธข |

### 7.6 Auto-Allocation Algorithm

Scoring system เธชเธณเธซเธฃเธฑเธเนเธเธฐเธเธณเธเธดเธเธฑเธ”เธงเธฒเธเธ•เธนเน:

| เธเธ | เธเธฐเนเธเธ |
|----|-------|
| Base score | 100 |
| เธชเธฒเธขเน€เธฃเธทเธญเน€เธ”เธตเธขเธงเธเธฑเธเธญเธขเธนเน Bay เน€เธ”เธตเธขเธงเธเธฑเธ | +30 |
| Tier เธ•เนเธณ (เธซเธขเธดเธเธเนเธฒเธข) | +5 เธ•เนเธญเธเธฑเนเธ |
| เนเธเธเธงเนเธฒเธเน€เธขเธญเธฐ (>50%) | +15 |
| Stack เธชเธนเธเน€เธเธดเธ tier 3 | -10 เธ•เนเธญเธเธฑเนเธ |
| เธเธเธฒเธ”เธ•เธนเนเนเธกเนเธ•เธฃเธ zone size_restriction | filter |
| เธ•เธนเนเน€เธขเนเธ โ’ Zone reefer เน€เธ—เนเธฒเธเธฑเนเธ | filter |
| เธ•เธนเน hazmat โ’ Zone hazmat เน€เธ—เนเธฒเธเธฑเนเธ | filter |
| Zone repair โ’ เนเธกเนเธงเธฒเธเธ•เธนเนเนเธซเธกเน | filter |

---

## 8. Design System โ€” "Industrial Tech"

### เธชเธต

| เธเธฅเธธเนเธก | Hex | เนเธเนเธเธฒเธ |
|-------|-----|--------|
| Primary | `#1E293B` | Sidebar, Header |
| Background | `#F8FAFC` / `#F1F5F9` | เธเธทเนเธเธซเธฅเธฑเธ |
| Accent | `#3B82F6` | เธเธธเนเธกเธซเธฅเธฑเธ, Active |
| Success | `#10B981` | Available, เธญเธเธธเธกเธฑเธ•เธด |
| Danger | `#EF4444` | Damage, Hold |
| Warning | `#F59E0B` | Pending, เธฃเธญเธเนเธญเธก |

### Typography
- **EN + เธ•เธฑเธงเน€เธฅเธ**: Inter
- **TH**: Sarabun
- **Dark Mode**: `class` strategy

### UI Patterns
- Skeleton Loading (เนเธกเนเนเธเน spinner)
- Glassmorphism (backdrop-blur + bg-opacity)
- Smooth transitions (150-300ms)

### Date / Time / Timezone
- **เธฃเธนเธเนเธเธเธงเธฑเธเธ—เธตเน**: `dd/mm/yyyy` (เน€เธเนเธ 19/03/2026)
- **Timezone**: `Asia/Bangkok` (UTC+7) โ€” เนเธเน `timeZone: 'Asia/Bangkok'` เนเธ `toLocaleString`
- **เน€เธงเธฅเธฒ**: 24 เธเธฑเนเธงเนเธกเธ (เน€เธเนเธ 14:30)
- **เธเธฑเธเธเนเธเธฑเธ**: เนเธเน `formatDate()`, `formatDateTime()`, `formatTime()`, `formatShortDate()`, `calcDwellDays()` เธเธฒเธ `@/lib/utils.ts` เน€เธ—เนเธฒเธเธฑเนเธ
  - `formatDate()` โ’ `19/03/2026`
  - `formatDateTime()` โ’ `19/03/2026 14:30`
  - `formatTime()` โ’ `14:30:00`
  - `formatShortDate()` โ’ `19 เธกเธต.เธ. 69` (เนเธชเธ”เธเธขเนเธญเธ เธฒเธฉเธฒเนเธ—เธข)
  - `calcDwellDays(gateInDate)` โ’ เธเธณเธเธงเธเธงเธฑเธ Calendar Days (+1) โ€” **เธซเนเธฒเธกเนเธเน `Math.floor(diff/86400000)` inline**
- **เธซเนเธฒเธกเนเธเน** inline `toLocaleDateString()` / `toLocaleTimeString()` / inline dwell calculation เนเธ”เธขเธ•เธฃเธ

---

## 9. เธเธฒเธเธ—เธตเนเน€เธซเธฅเธทเธญ (เน€เธเธช 5-9)

### เน€เธเธช 4: Gate In/Out + เธ•เธฃเธงเธเธชเธ เธฒเธเธ•เธนเน (โ… เน€เธชเธฃเนเธ โ€” เธขเธฑเธเน€เธซเธฅเธทเธญเธเธฒเธเธชเนเธงเธ)
- [x] เธเธญเธฃเนเธก Gate-In (เน€เธฅเธเธ•เธนเน, เธเธเธฒเธ”, เธเธฃเธฐเน€เธ เธ—, เธชเธฒเธขเน€เธฃเธทเธญ, เธเธตเธฅ, เธเธเธเธฑเธ, เธ—เธฐเน€เธเธตเธขเธเธฃเธ–)
- [x] เธเธญเธฃเนเธก Gate-Out (เธเนเธเธซเธฒเธ•เธนเน โ’ เธเธฅเนเธญเธขเธญเธญเธ โ’ EIR)
- [x] เธญเธญเธเน€เธญเธเธชเธฒเธฃ EIR เธญเธฑเธ•เนเธเธกเธฑเธ•เธด
- [x] เธ•เธฃเธงเธเธชเธ เธฒเธเธ•เธนเนเธ”เธดเธเธดเธ—เธฑเธฅ (เนเธเธเธเธฑเธ 6 เธ”เนเธฒเธ + damage marking)
- [x] **๐“ท PWA OCR เธชเนเธเธเน€เธฅเธเธ•เธนเน** (Tesseract.js) โ€” **เน€เธชเธฃเนเธเนเธฅเนเธง** (26 เธกเธต.เธ. 2569):
  - Full-screen PWA camera UI (autoPlay + playsInline + loadedmetadata fix)
  - Crop zone: เธ•เธฑเธ”เน€เธเธเธฒเธฐเธเธขเธฐเธเธฅเธฒเธ 80%ร—30% เธชเธณเธซเธฃเธฑเธ container/seal เน€เธฃเนเธงเธเธถเนเธ 3ร—
  - Pre-warm Tesseract worker เธ•เธญเธ mount โ€” เนเธกเนเน€เธชเธตเธขเน€เธงเธฅเธฒเธ•เธญเธ capture
  - `extractContainerNumber()` 4-strategy: Direct regex โ’ O/0 I/1 noise correction โ’ check digit auto-fix โ’ fuzzy
  - Confidence score badge: High/Medium/Low + เน€เธ•เธทเธญเธเธ–เนเธฒ low
  - mode prop: `container` / `plate` / `seal` / `generic`
  - Animated scan overlay (corner brackets + scan line)
  - Torch/Flash toggle (เธเธ device เธ—เธตเนเธฃเธญเธเธฃเธฑเธ)
  - OCR progress bar
  - GateOutTab: เน€เธเธดเนเธกเธเธธเนเธก scan เธชเธณเธซเธฃเธฑเธเธ—เธฐเน€เธเธตเธขเธเธฃเธ– + เน€เธฅเธเธเธตเธฅ
- [x] เธขเนเธฒเธขเธ•เธนเนเธเนเธฒเธกเธชเธฒเธเธฒ (Inter-Yard Transfer) โ€” **เน€เธชเธฃเนเธเนเธฅเนเธง** (6 bugs + smart allocate + to_yard_id + toast)

### เน€เธเธช 5: เธเธเธดเธเธฑเธ•เธดเธเธฒเธฃเธซเธเนเธฒเธเธฒเธ (โ… เน€เธชเธฃเนเธ โ€” เธขเธฑเธเน€เธซเธฅเธทเธญเธเธฒเธเธชเนเธงเธ)
- [x] Job Queue เธฃเธ–เธขเธ (Work Orders + status workflow)
- [x] Smart Shifting Logic (Virtual LIFO)
- [ ] เนเธญเธ Surveyor (PWA Offline) โ€” เนเธเน YardAudit เธ—เธตเนเธ—เธณเนเธงเนเนเธฅเนเธงเนเธ—เธ

### เน€เธเธช 6: เน€เธเธทเนเธญเธกเนเธขเธ EDI เธชเธฒเธขเน€เธฃเธทเธญ (โ… เน€เธชเธฃเนเธ)
- [x] Booking/Manifest เธเธณเน€เธเนเธฒ + เธเธฑเธ”เธเธฒเธฃเธชเธ–เธฒเธเธฐ
- [x] Seal Cross-Validation
- [x] Customer Master + EDI Config (ISO auto-import)
- [x] **CODECO Outbound** โ€” เธชเธฃเนเธฒเธเธเนเธญเธกเธนเธฅ Container Departure/Arrival Message (UN/EDIFACT D:95B:UN, CSV, JSON)
- [x] **SFTP Auto-Upload** โ€” เธชเนเธ CODECO เนเธเธฅเนเธเนเธฒเธ SFTP เธญเธฑเธ•เนเธเธกเธฑเธ•เธดเนเธซเนเธชเธฒเธขเน€เธฃเธทเธญ (ssh2-sftp-client)
- [x] **๐“ง Email EDI Delivery** โ€” เธชเนเธ CODECO เธเนเธฒเธ Email (SMTP/Azure Graph API) เธเธฃเนเธญเธกเนเธเธฅเนเนเธเธ
- [x] **โฐ EDI Auto-Schedule (node-cron)** โ€” เธ•เธฑเนเธเน€เธงเธฅเธฒเธชเนเธเธญเธฑเธ•เนเธเธกเธฑเธ•เธด (เธ—เธธเธเธเธฑเนเธงเนเธกเธ/เธงเธฑเธเธฅเธฐ2เธเธฃเธฑเนเธ/เธ—เธธเธเธงเธฑเธ/เธ—เธธเธเธชเธฑเธเธ”เธฒเธซเน) + instrumentation.ts auto-init
- [x] **EDI Endpoints (DB)** โ€” เธ•เธฑเนเธเธเนเธฒ SFTP/FTP/API/Email endpoints เน€เธเนเธเนเธ DB เธเธฃเธดเธ + CRUD API + Send Log
- [x] **Shipping Line Autocomplete** โ€” เธเธดเธกเธเนเธเนเธเธซเธฒเธชเธฒเธขเน€เธฃเธทเธญเธเธฒเธเธเนเธญเธกเธนเธฅเธ—เธตเนเธกเธตเธญเธขเธนเน (HTML datalist)
- [x] **๐“ EDI Template System** โ€” template-based format per shipping line: field mapping (**drag-and-drop** reorder), custom headers, date format, CSV delimiter, EDIFACT version โ€” Config เธเนเธฒเธ UI เนเธกเนเธ•เนเธญเธเนเธเนเนเธเนเธ”
- [x] **Shared CODECO Formatter** (`ediFormatter.ts`) โ€” เธฅเธ”เนเธเนเธ”เธเนเธณ, เธฃเธญเธเธฃเธฑเธ template config + legacy fallback
- [x] **CODECO Download Fix** โ€” เนเธเน auth error เธเธธเนเธกเธ”เธฒเธงเธเนเนเธซเธฅเธ” (fetch+blob เนเธ—เธ window.open)

### Customer Management โ€” ๐ข Multi-Role Architecture (โ… เน€เธชเธฃเนเธ)
- [x] **Multi-Role Customer Master** โ€” เธฅเธนเธเธเนเธฒ 1 เธเธฃเธดเธฉเธฑเธ— = เธซเธฅเธฒเธขเธเธ—เธเธฒเธ—เธเธฃเนเธญเธกเธเธฑเธ เธเนเธฒเธ Boolean flags:
  - `is_line` (เธชเธฒเธขเน€เธฃเธทเธญ/เน€เธเนเธฒเธเธญเธเธ•เธนเน), `is_forwarder` (เธ•เธฑเธงเนเธ—เธ), `is_trucking` (เธฃเธ–เธเธฃเธฃเธ—เธธเธ), `is_shipper` (เธเธนเนเธชเนเธเธญเธญเธ), `is_consignee` (เธเธนเนเธเธณเน€เธเนเธฒ)
  - UI: **Checkbox group** เธชเธต+เนเธญเธเธญเธเนเธขเธเธ•เธฒเธกเธเธ—เธเธฒเธ— โ€” เน€เธฅเธทเธญเธเนเธ”เนเธซเธฅเธฒเธขเธฃเธฒเธขเธเธฒเธฃ
  - Legacy `customer_type` column เน€เธเนเธเนเธงเนเธชเธณเธซเธฃเธฑเธ backward compatibility (auto-derive เธเธฒเธ flags)
- [x] **Customer Code Auto-Generation** โ€” `CUST-XXXXX` (5 เธซเธฅเธฑเธ, auto-increment, เนเธกเนเธเนเธณ)
- [x] **Multi-Branch Support** โ€” เธ•เธฒเธฃเธฒเธ `CustomerBranches` (branch_code + name + billing_address + contact + is_default)
  - UI: **Branch Manager** โ€” เน€เธเธดเนเธก/เธฅเธเธชเธฒเธเธฒ, เธเธณเธซเธเธ”เธชเธฒเธเธฒเธซเธฅเธฑเธ (radio), contact info เธ•เนเธญเธชเธฒเธเธฒ
- [x] **EDI Prefix Validation** โ€” เธเนเธญเธ `edi_prefix` เธเธฑเธเธเธฑเธเธเธฃเธญเธเน€เธกเธทเนเธญ `is_line = true` (Zod refine rule)
- [x] **Duplicate Detection** โ€” เธ•เธฃเธงเธเธเนเธณเธเธทเนเธญเธเธฃเธดเธฉเธฑเธ— + เน€เธฅเธเธเธนเนเน€เธชเธตเธขเธ เธฒเธฉเธต (เธ—เธฑเนเธ POST เนเธฅเธฐ PUT)
- [x] **Payment Type** โ€” `default_payment_type` (CASH/CREDIT) + เนเธชเธ”เธ credit term เน€เธกเธทเนเธญเน€เธฅเธทเธญเธ CREDIT
- [x] **Auto-Migration** โ€” API auto-migrate existing data: `shipping_line` โ’ `is_line=1`, `trucker` โ’ `is_trucking=1`, auto-gen customer_code
- [x] **Downstream Updates (17 files)** โ€” เธ—เธธเธ API/UI เธ—เธตเนเนเธเน `customer_type` เธญเธฑเธเน€เธ”เธ•เน€เธเนเธ boolean flags:
  - API: `gate-check`, `gate-in-check`, `ar-aging`, `boxtech`, `portal/overview`, `prefix-mapping`
  - UI: `GateInTab`, `GateOutTab`, `PrefixMapping`, `UsersSettings`, `billing/page`, `portal/page`
- [x] **RBAC customers module** โ€” 4 permissions (create/read/update/delete), 33 เธเนเธญเธฃเธงเธก
- [x] **Billing autocomplete** โ€” search + autocomplete เธฅเธนเธเธเนเธฒ (เธเธทเนเธญ/เน€เธฅเธเธ เธฒเธฉเธต) เนเธ—เธ dropdown
- [x] **Invoice + branch** โ€” JOIN Yards/Customers เน€เธเธทเนเธญเธ”เธถเธเธเนเธญเธกเธนเธฅเธชเธฒเธเธฒเธชเธณเธซเธฃเธฑเธเธญเธญเธเนเธเธเธณเธเธฑเธเธ เธฒเธฉเธต
- [x] **Logo upload fix** โ€” ALTER COLUMN logo_url NVARCHAR(MAX) เธชเธณเธซเธฃเธฑเธ base64 image

### เน€เธเธช 7: เธเนเธญเธกเธเธณเธฃเธธเธ M&R (โ… เน€เธชเธฃเนเธ + ๐”ง Hardened)
- [x] เธชเธฃเนเธฒเธเนเธ EOR + CEDEX codes + เธเธณเธเธงเธ“เธฃเธฒเธเธฒเธญเธฑเธ•เนเธเธกเธฑเธ•เธด
- [x] Approval workflow (draftโ’submitโ’approveโ’repairโ’complete)
- [x] **๐ CEDEX เธ เธฒเธฉเธฒเนเธ—เธข** โ€” เนเธเธฅ 29 เธฃเธซเธฑเธช (component/damage/repair) + tab label + header
- [x] **๐“ Audit Trail** โ€” `logAudit` เธ—เธธเธ action (eor_create/submit/approve/start_repair/complete/reject)
- [x] **โ… Zod Validation** โ€” `createEORSchema` + `updateEORSchema` เธ•เธฃเธงเธ body เธ—เธฑเนเธ POST/PUT
- [x] **๐’ฐ Actual Cost Modal** โ€” เธเธ” "เน€เธชเธฃเนเธ" เนเธชเธ”เธ modal เนเธซเนเนเธชเนเธเนเธฒเธเนเธญเธกเธเธฃเธดเธ (pre-fill เธเธฒเธเธฃเธฒเธเธฒเธเธฃเธฐเน€เธกเธดเธ)
- [x] **๐“ Notes + Created By** โ€” เธเธฑเธเธ—เธถเธเธซเธกเธฒเธขเน€เธซเธ•เธธ + เธเธนเนเธชเธฃเนเธฒเธ EOR
- [x] **๐” Reject Revert** โ€” เธเธเธดเน€เธชเธ EOR โ’ เธ•เธนเนเธเธฅเธฑเธเน€เธเนเธ `in_yard` (เน€เธ”เธดเธกเธเนเธฒเธ `under_repair`)
- [x] **๐” User ID Tracking** โ€” เธ—เธธเธ action เธชเนเธ user_id เธเธฒเธ session เน€เธเธทเนเธญเธเธฑเธเธ—เธถเธเนเธ audit

### เน€เธเธช 8: เธเธฑเธเธเธตเธเธฒเธฃเน€เธเธดเธ (โ… เน€เธชเธฃเนเธ)
- [x] Tariff เธ•เธฑเนเธเธเนเธฒเธเธฃเธดเธเธฒเธฃ (Storage, LOLO, M&R, Washing, PTI, Reefer) + labels + number input UX
- [x] **Tiered Storage Rates** โ€” เธญเธฑเธ•เธฃเธฒเธเธฑเนเธเธเธฑเธเนเธ” เน€เธเธทเนเธญเธกเธเธฑเธ DB เธเธฃเธดเธ + API + live preview calculator
  - เธ•เธฒเธฃเธฒเธ `StorageRateTiers`: Free/Standard/Extended/Penalty + เธฃเธฒเธเธฒเนเธขเธเธ•เธฒเธกเธเธเธฒเธ”เธ•เธนเน (20'/40'/45')
  - เธ•เธฑเนเธเธเนเธฒเธ—เธตเน: เธ•เธฑเนเธเธเนเธฒเธฃเธฐเธเธ โ’ เธเนเธฒเธเธฒเธ | เธญเธฑเธ•เธฃเธฒเธญเธทเนเธเน (LOLO, gate): เธเธฑเธเธเธต โ’ Tariff
- [x] **Gate-Out Billing Integration** โ€” เธเธณเธเธงเธ“เธเนเธฒเธเธฃเธดเธเธฒเธฃเธญเธฑเธ•เนเธเธกเธฑเธ•เธดเธ—เธตเน Gate-Out
  - เนเธเน tiered rates + per-size pricing | Fallback เน€เธเนเธ flat Tariff
  - เธ•เธฃเธงเธ paid invoices โ’ เธเนเธญเธเธเธฑเธ duplicate payment
- [x] Auto-billing (Dwell Time โ’ Auto-Calculate API) + VAT 7%
- [x] Hold/Release workflow
- [x] Invoice status workflow (draftโ’issuedโ’paidโ’credit_note)
- [x] **Printable A4 Invoice/Receipt** โ€” `/billing/print?id=X&type=invoice|receipt`
  - Company header (logo + เธเธทเนเธญ + เธชเธณเธเธฑเธเธเธฒเธเนเธซเธเน/เธชเธฒเธเธฒ + เธ—เธตเนเธญเธขเธนเน + เน€เธฅเธเธ เธฒเธฉเธต + เนเธ—เธฃ)
  - Customer info (เธเธทเนเธญ + เธชเธฒเธเธฒ + เธ—เธตเนเธญเธขเธนเน + เน€เธฅเธเธ เธฒเธฉเธต)
  - **Itemized charges table** (เนเธเธเนเธเธเธ—เธธเธเธฃเธฒเธขเธเธฒเธฃเธเธฒเธ JSON notes)
  - VAT breakdown + เธเธณเธเธงเธเน€เธเธดเธเน€เธเนเธเธ•เธฑเธงเธญเธฑเธเธฉเธฃเนเธ—เธข
  - เธเนเธญเธเธฅเธฒเธขเน€เธเนเธ: **เธเธนเนเธเนเธฒเธข / Paid by** (เธเนเธฒเธข) + **เธเธนเนเธฃเธฑเธเน€เธเธดเธ / Received by** (เธเธงเธฒ) + auto-print
  - Receipt: เธซเธฑเธงเน€เธญเธเธชเธฒเธฃ **"Receipt"** (เนเธกเนเธกเธต Tax Invoice) + เนเธชเธ•เธกเธเน "โ… เธเธณเธฃเธฐเน€เธเธดเธเนเธฅเนเธง"
- [x] Billing Statement + Receipt + Print Template
- [x] ERP Export (CSV/JSON debit-credit entries) โ€” **เนเธเนเนเธ: getDb() fix, date format DD/MM/YYYY HH:mm, เน€เธเธดเนเธก customer credit_term/branch/address/due_date**
- [x] **Billing Reports** (เนเธซเธกเน): เธฃเธฒเธขเธเธฒเธเธเธฃเธฐเธเธณเธงเธฑเธ + เธเธฃเธฐเธเธณเน€เธ”เธทเธญเธ
  - เนเธ—เนเธ "เธฃเธฒเธขเธเธฒเธ" เนเธเธซเธเนเธฒเธเธฑเธเธเธต + เธซเธเนเธฒเธเธดเธกเธเน A4 เนเธขเธ (`/billing/print/report`)
  - เธฃเธฒเธขเธงเธฑเธ: KPIs, เธชเธฃเธธเธเธชเธ–เธฒเธเธฐ, gate activity, เนเธเธเนเธเธเธ•เธฒเธกเธเธฃเธฐเน€เธ เธ—เธเนเธฒเธเธฃเธดเธเธฒเธฃ, เธฃเธฒเธขเธเธฒเธฃ invoice
  - เธฃเธฒเธขเน€เธ”เธทเธญเธ: KPIs, top customers, daily breakdown table
- [x] **๐“ PDF Export** (เนเธซเธกเน) โ€” client-side PDF เธเนเธฒเธ jsPDF + jspdf-autotable
  - `src/lib/pdfExport.ts` โ€” 3 เธเธฑเธเธเนเธเธฑเนเธเธชเธณเน€เธฃเนเธเธฃเธนเธ:
    - `generateBillingReportPDF()` โ€” เธฃเธฒเธขเธเธฒเธเธเธฃเธฐเธเธณเธงเธฑเธ/เน€เธ”เธทเธญเธ (KPIs, เธ•เธฒเธฃเธฒเธเธเธดเธฅ, gate activity, เธขเธญเธ”เธฃเธฒเธขเธงเธฑเธ, top เธฅเธนเธเธเนเธฒ)
    - `generateInvoicePDF()` โ€” เนเธเนเธเนเธเธซเธเธตเน/เนเธเน€เธชเธฃเนเธ (เธ•เธฒเธฃเธฒเธเธฃเธฒเธขเธเธฒเธฃ + VAT + เธเนเธญเธเธฅเธฒเธขเน€เธเนเธ)
    - `generateGateHistoryPDF()` โ€” เธเธฃเธฐเธงเธฑเธ•เธด Gate (landscape, เธ•เธฒเธฃเธฒเธ transactions)
  - `src/lib/sarabunFont.ts` โ€” Sarabun font (Google Fonts) embedded base64 เธฃเธญเธเธฃเธฑเธเธ เธฒเธฉเธฒเนเธ—เธข
  - Lazy import เนเธ billing page (`const loadPdfExport = () => import(...)`) เธเนเธญเธเธเธฑเธ SSR bundle
  - เธเธธเนเธก PDF เธชเธตเนเธ”เธ (เธ–เธฑเธ”เธเธฒเธเธเธธเนเธกเธเธดเธกเธเน) เธ—เธตเนเนเธ—เนเธเธฃเธฒเธขเธเธฒเธ
  - **เธซเธกเธฒเธขเน€เธซเธ•เธธ**: headStyles เธ•เนเธญเธเนเธเน `fontStyle: 'normal'` เน€เธเธฃเธฒเธฐ Sarabun เธฅเธเธ—เธฐเน€เธเธตเธขเธเน€เธเธเธฒเธฐ normal (bold เธเธฐ fallback เน€เธเนเธ helvetica)
- [x] **Hold Logic Fix** (**เนเธซเธกเน**): เธเนเธญเธเธเธฑเธ hold เธ•เธนเนเธ—เธตเน gate-out เนเธเนเธฅเนเธง
  - API เธ•เธฃเธงเธ container status เธเนเธญเธ hold + เนเธชเธ”เธเน€เธเธเธฒเธฐเธ•เธนเน in_yard เนเธเนเธ—เนเธ Hold
- [x] **Print button at Gate-Out** โ€” เธซเธฅเธฑเธเธเธณเธฃเธฐเน€เธเธดเธเธกเธตเธเธธเนเธกเธเธดเธกเธเนเนเธเน€เธชเธฃเนเธเธ—เธฑเธเธ—เธต
- [x] **Print button at Gate-In** โ€” เธซเธฅเธฑเธเธเธณเธฃเธฐเน€เธเธดเธ/เธงเธฒเธเธเธดเธฅเธกเธตเธเธธเนเธกเธเธดเธกเธเนเนเธเน€เธชเธฃเนเธ/เนเธเนเธเนเธเธซเธเธตเนเธ—เธฑเธเธ—เธต
- [x] **Invoice datetime** โ€” เนเธเนเธเนเธเธซเธเธตเนเนเธชเธ”เธเธ—เธฑเนเธเธงเธฑเธเธ—เธตเนเนเธฅเธฐเน€เธงเธฅเธฒ (formatDateTime)
- [x] **Demurrage Calculator** (**เนเธซเธกเน**) โ€” เนเธขเธ demurrage/detention เธเธฒเธ storage
  - เธ•เธฒเธฃเธฒเธ `DemurrageRates` (yard_id, charge_type, free_days, rate_20/40/45, customer_id)
  - เนเธ—เนเธ "Demurrage" เนเธเธซเธเนเธฒเธเธฑเธเธเธต: Overview (เธ•เธนเนเน€เธเธดเธ/เนเธเธฅเน/เธเธฅเธญเธ”เธ เธฑเธข) + เธเนเธฒ demurrage เธฃเธงเธก
  - **Rates Config** (โ๏ธ เนเธเนเนเธ / + เน€เธเธดเนเธก / ๐—‘ เธฅเธ) โ€” inline editing เธ—เธธเธ field
  - **Calculator** โ€” เธเธ”เธเธณเธเธงเธ“เธฃเธฒเธขเธ•เธนเน (demurrage + detention breakdown + over_days ร— rate)
  - **Timeline** โ€” เธเธธเนเธก Clock เน€เธเธดเธ” Container Timeline เนเธ”เนเธเธฒเธเนเธ•เนเธฅเธฐเธ•เธนเน
  - **๐“ Pagination** (**เนเธซเธกเน**): 25 เธฃเธฒเธขเธเธฒเธฃ/เธซเธเนเธฒ + เธเธธเนเธกเน€เธฅเธเธซเธเนเธฒ (Overview tab)
  - **เนเธขเธเธเธฒเธ Storage**: Storage = เธเนเธฒเธเธฒเธเธ•เธนเน (เธฃเธฒเธขเนเธ”เนเธฅเธฒเธ), Demurrage = เธเนเธฒเธเธฃเธฑเธเธชเธฒเธขเน€เธฃเธทเธญ

### Container Tracking Timeline (โ… เน€เธชเธฃเนเธ)
- [x] **Timeline API** (`/api/containers/timeline`) โ€” merge events เธเธฒเธ 3 เนเธซเธฅเนเธ:
  - GateTransactions (Gate-In, Gate-Out)
  - AuditLog (Move, Hold, Release, Status Change, Repair)
  - Invoices (Payment, Invoice Created)
- [x] **ContainerTimeline component** โ€” visual vertical timeline + expand/collapse details
  - icon + เธชเธต เธ•เธฒเธก event type + เธงเธฑเธเธ—เธตเน/เน€เธงเธฅเธฒ + เธเธณเธญเธเธดเธเธฒเธข
  - เธฃเธญเธเธฃเธฑเธเธ—เธฑเนเธ `container_id` เนเธฅเธฐ `container_number` lookup
- [x] **เธเธธเนเธก โฑ Timeline เนเธเธซเธเนเธฒ Operations** โ€” เธ—เธธเธ Work Order เธกเธตเธเธธเนเธกเธ”เธน timeline เธเธญเธเธ•เธนเนเธเธฑเนเธ
- [x] **Timeline modal เนเธเธซเธเนเธฒ Gate** โ€” เน€เธเธทเนเธญเธกเธเนเธฒเธ container_id

### เน€เธเธช 9: เธเธฃเธฑเธเนเธ•เนเธ & PWA (โ… เน€เธชเธฃเนเธ)
- [x] PWA Service Worker (Network-first API, Cache-first assets)
- [x] Toast Notification System (success/error/warning/info)
- [x] PWA meta tags + manifest + SVG icons + favicon
- [x] CSS: Toast animation, Pulse glow, Focus ring, Print styles
- [x] Offline-First IndexedDB โ’ `offlineQueue.ts` (enqueue + auto-sync on online)

### NFR: Non-Functional Requirements (โ… เน€เธชเธฃเนเธ)
- [x] NFR1: Offline-First โ€” IndexedDB queue + `offlineFetch()` wrapper + auto-replay
- [x] NFR3b: High-Contrast Theme โ€” `.high-contrast` CSS + โ€๏ธ toggle (sidebar white bg, เน€เธชเนเธเธเธญเธเธซเธเธฒ, เธ•เธฑเธงเธญเธฑเธเธฉเธฃเนเธซเธเน)
- [x] Dark Mode โ€” `@variant dark (&:is(.dark *))` เธชเธณเธซเธฃเธฑเธ Tailwind v4 class strategy

### ๐” Production Readiness (โ… เน€เธชเธฃเนเธ)
- [x] **API Auth Proxy** โ€” `src/proxy.ts` (Next.js 16, เน€เธ”เธดเธกเธเธทเธญ `middleware.ts`) เธ•เธฃเธงเธ JWT เธเธเธ—เธธเธ `/api/` route + protected page routes เธญเธฑเธ•เนเธเธกเธฑเธ•เธด (exempt: login, EIR)
  - **Page Guard**: เธ•เธฃเธงเธ `cyms_token` cookie เธชเธณเธซเธฃเธฑเธ page routes โ’ redirect เนเธ `/login` เธ–เนเธฒเนเธกเนเธกเธต/เธซเธกเธ”เธญเธฒเธขเธธ (server-side, เนเธกเนเธ•เนเธญเธเธฃเธญ JS)
  - **Cookieโ’Header Forwarding**: `passthrough()` เธญเนเธฒเธ cookie เนเธฅเนเธงเธชเนเธเน€เธเนเธ `x-cyms-token` custom header โ’ API route handler เธญเนเธฒเธเนเธ”เนเนเธเนเธเธญเธ
  - Client: global fetch interceptor เนเธ dashboard layout โ’ auto-attach `Authorization: Bearer` + auto-redirect 401
  - `src/lib/apiAuth.ts`: `withAuth()` wrapper เธชเธณเธซเธฃเธฑเธ role-based access control
- [x] **Rate Limiting** โ€” `src/lib/rateLimit.ts` + Settings UI + Toggle เน€เธเธดเธ”/เธเธดเธ”
  - Login: 5 req/15 เธเธฒเธ—เธต, API: 100 req/เธเธฒเธ—เธต, Upload: 10 req/เธเธฒเธ—เธต
  - DB-backed config via `SystemSettings` table (cached 30s)
  - เนเธ—เนเธ "Rate Limit" เนเธเธ•เธฑเนเธเธเนเธฒ: toggle + เธเธฃเธฑเธเธเนเธฒ + เธชเธ–เธดเธ•เธด real-time (active IPs, blocked counts)
  - Login route returns 429 + `Retry-After` header เน€เธกเธทเนเธญเน€เธเธดเธเธเธณเธซเธเธ”
- [x] **Input Validation (Zod)** โ€” `src/lib/validators.ts`
  - Schemas: container numbers, gate transactions, invoices, users, customers, EDI endpoints
  - เนเธเนเธเธฑเธ Gate POST route โ’ return 400 + error details เน€เธเนเธเธ เธฒเธฉเธฒเนเธ—เธข
- [x] **Complete Audit Trail** โ€” `src/lib/audit.ts` (centralized logAudit helper)
  - เธเธฃเธญเธเธเธฅเธธเธก 14+ routes: settings (9 routes), operations, billing, EDI endpoints

### Dwell Days Display + Calendar Days Formula (โ… เน€เธชเธฃเนเธ)
- [x] **เธ•เธฒเธฃเธฒเธเธ เธฒเธเธฃเธงเธก** โ€” เธเธญเธฅเธฑเธกเธเน "เธญเธขเธนเนเนเธเธฅเธฒเธ" เนเธชเธ”เธ X เธงเธฑเธ เธเธฃเนเธญเธก badge เธชเธต
- [x] **เธเนเธเธซเธฒเธ•เธนเน** โ€” badge เธเธณเธเธงเธเธงเธฑเธเธเนเธฒเธเธเธฅเธฅเธฑเธเธเน
- [x] **Card View** โ€” badge เนเธ location bar เธเธญเธเนเธ•เนเธฅเธฐ container card
- [x] **Bay View tooltip** โ€” "เธญเธขเธนเนเนเธเธฅเธฒเธ: X เธงเธฑเธ" เนเธ hover tooltip
- [x] **Container Detail Modal** โ€” "เธญเธขเธนเนเธฅเธฒเธเนเธฅเนเธง X เธงเธฑเธ" เนเธชเธ”เธเธ•เธฃเธเธเธฑเธเธ•เธฒเธฃเธฒเธ
- [x] **Summary Cards โ€” Overdue + Avg Dwell** โ€” เธฃเธงเธก Dwell Time metrics เน€เธเนเธฒเธ เธฒเธเธฃเธงเธก (เธฅเธ Dwell Time tab เนเธขเธเธญเธญเธ)
- [x] **๐“… Calendar Days (+1)** โ€” เธชเธนเธ•เธฃเธเธฑเธเธงเธฑเธ:
  - เธ•เธฑเธ”เน€เธงเธฅเธฒเธญเธญเธ โ’ เน€เธเธฃเธตเธขเธเน€เธ—เธตเธขเธเน€เธเธเธฒเธฐเธงเธฑเธเธ—เธตเน โ’ diff + 1
  - เธงเธฑเธเน€เธเนเธฒ = Day 1 (เน€เธเนเธฒ 1 เธกเธต.เธ. โ’ เธงเธฑเธเธเธตเน 1 เธกเธต.เธ. = **1 เธงเธฑเธ**)
  - เนเธเนเธเธฑเธเธเนเธเธฑเธ `calcDwellDays()` เธเธฒเธ `@/lib/utils.ts` **เธ—เธฑเนเธเธฃเธฐเธเธ** (6 เธเธธเธ” เนเธ 5 เนเธเธฅเน)
  - เนเธเธฅเน: `yard/page.tsx`, `containers/detail/route.ts`, `BayCrossSection.tsx`, `ContainerCardPWA.tsx`, `ContainerSearch.tsx`
- Color coding: ๐ข โค7 เธงเธฑเธ (เธเธเธ•เธด) | ๐ก 8-14 เธงเธฑเธ (เน€เธฃเธดเนเธกเธเธฒเธ) | ๐”ด >14 เธงเธฑเธ (เธเนเธฒเธเธฅเธฒเธเธเธฒเธ)

### ๐“ Table Pagination (โ… เน€เธชเธฃเนเธ)
- [x] **Gate History** โ€” 25 เธฃเธฒเธขเธเธฒเธฃ/เธซเธเนเธฒ + เธเธธเนเธกเน€เธฅเธเธซเธเนเธฒ + Prev/Next
- [x] **Invoices** โ€” 25 เธฃเธฒเธขเธเธฒเธฃ/เธซเธเนเธฒ + เธเธธเนเธกเน€เธฅเธเธซเธเนเธฒ + Prev/Next
- [x] **CODECO** โ€” 25 เธฃเธฒเธขเธเธฒเธฃ/เธซเธเนเธฒ + เธเธธเนเธกเน€เธฅเธเธซเธเนเธฒ + Prev/Next
- [x] **Demurrage Overview** โ€” 25 เธฃเธฒเธขเธเธฒเธฃ/เธซเธเนเธฒ + เธเธธเนเธกเน€เธฅเธเธซเธเนเธฒ + Prev/Next
- Pagination component: auto-reset เน€เธกเธทเนเธญ filter เน€เธเธฅเธตเนเธขเธ, เนเธชเธ”เธ "เนเธชเธ”เธ X-Y เธเธฒเธ Z เธฃเธฒเธขเธเธฒเธฃ"

### ๐“ Gate Reports (โ… เน€เธชเธฃเนเธ)
- [x] **Daily Gate In Report** โ€” เน€เธฅเธทเธญเธเธงเธฑเธเธ—เธตเน โ’ เธ•เธฒเธฃเธฒเธเธฃเธฒเธขเธเธฒเธฃเธ•เธนเนเน€เธเนเธฒเธ—เธฑเนเธเธซเธกเธ” + summary cards (total/laden/empty/20/40/45) + byShippingLine + Export PDF/Excel
- [x] **Daily Gate Out Report** โ€” เน€เธซเธกเธทเธญเธเธเธฑเธ เนเธ•เนเน€เธเนเธเธ•เธนเนเธญเธญเธ
- [x] **Summary Gate In Report** โ€” Date Range โ’ 7 sections:
  - KPI Cards (total, laden/empty, เน€เธเธฅเธตเนเธข/เธงเธฑเธ, Peak day)
  - Daily Trend Chart (CSS bar chart โ€” เนเธกเนเธ•เนเธญเธเธ•เธดเธ”เธ•เธฑเนเธ Recharts)
  - Top 10 Shipping Lines (rank + progress bar + laden vs empty)
  - By Container Size (20/40/45 + %)
  - By Container Type (GP/HC/RF/OT โ€” RF เน€เธเนเธเธชเธตเธเธดเน€เธจเธฉ)
  - Hour Heatmap (24 เธเธฑเนเธงเนเธกเธ โ€” เธชเธตเน€เธเนเธกเธเธถเนเธเธ•เธฒเธกเธเธฃเธดเธกเธฒเธ“)
  - By Operator (เธเธนเนเธ”เธณเน€เธเธดเธเธเธฒเธฃ + เธเธณเธเธงเธ)
- [x] **Summary Gate Out Report** โ€” เน€เธซเธกเธทเธญเธเธเธฑเธ เนเธ•เนเน€เธเนเธเธ•เธนเนเธญเธญเธ
- [x] **Export เธ—เธฑเนเธ 3 เนเธเธ**: ๐“ PDF (jsPDF landscape + Sarabun Thai) / ๐“ Excel (xlsx) / ๐–ถ๏ธ Print
- เน€เธเนเธฒเธ–เธถเธเธ—เธตเน: เธซเธเนเธฒ Gate โ’ เนเธ—เนเธ "เธฃเธฒเธขเธเธฒเธ"
- เนเธเธฅเน: `api/reports/gate/route.ts`, `gate/GateReportTab.tsx`, เน€เธเธดเนเธกเนเธ `lib/pdfExport.ts`

### ๐ก๏ธ Security Hardening (โ… เน€เธชเธฃเนเธ)
- [x] **[P0] JWT Fail-Fast** โ€” `proxy.ts` + `auth/me` เนเธเน `getJwtSecret()` โ€” throw เธ—เธฑเธเธ—เธตเธ–เนเธฒเนเธกเนเธ•เธฑเนเธเธเนเธฒ `JWT_SECRET` (เนเธกเนเธกเธต fallback `cyms-default-secret` เธญเธตเธเธ•เนเธญเนเธ)
- [x] **[P0] Users API RBAC** โ€” `api/settings/users` เน€เธเธเธฒเธฐ `yard_manager` (403 เธชเธณเธซเธฃเธฑเธ role เธญเธทเนเธ) + audit actor เธเธฒเธ JWT token เนเธกเนเนเธเนเธเธฒเธ body (เธเธฅเธญเธกเนเธกเนเนเธ”เน)
- [x] **[P1] Proxy Header Forwarding** โ€” `passthrough()` เนเธ `proxy.ts` เธญเนเธฒเธ cookie เนเธฅเนเธง forward เน€เธเนเธ custom header `x-cyms-token` + `x-user-id/x-user-role` โ€” portal + role-check เธ—เธณเธเธฒเธเนเธ”เนเธ–เธนเธเธ•เนเธญเธ
- [x] **[P1] Uploads Security** โ€” `api/uploads` เน€เธเธดเนเธก: auth check + folder whitelist (`photos/damage/eir/mnr/documents`) + เธเธณเธเธฑเธ”เนเธเธฅเนเธชเธนเธเธชเธธเธ” 5MB + เน€เธเธเธฒเธฐ jpeg/png/webp/gif

### ๐” Code Review Improvements (โ… เน€เธชเธฃเนเธ)
- [x] DB Pool auto-reconnect โ€” `pool.connected` check เธเนเธญเธ return
- [x] AuthProvider token expiry check โ€” `isTokenExpired()` เธเนเธญเธ restore session
- [x] `autoAllocate.ts` เน€เธเธฅเธตเนเธขเธ `any` โ’ `ConnectionPool`
- [x] `GateReportTab` เน€เธเธฅเธตเนเธขเธ `setTimeout(...,0)` โ’ `useEffect`
- [x] Gate Reports API เน€เธเธดเนเธก Zod validation เธเธ query params (type enum + date format + yard_id)
- [x] PATCH notifications เธ”เธถเธ user_id เธเธฒเธ JWT token เนเธกเนเนเธเนเธเธฒเธ body
- [x] **ConfirmDialog component** (`src/components/ui/ConfirmDialog.tsx`)
  - 3 variants: ๐”ด danger, ๐ก warning, ๐”ต info
  - Backdrop blur + smooth animations (animate-in, zoom-in-95, fade-in)
  - Auto-focus cancel button + Escape key to dismiss
- [x] **Replaced `window.confirm()` เธ—เธฑเนเธเธซเธกเธ”** โ€” 8 เธเธธเธ” เนเธ 7 เนเธเธฅเน:
  - `DemurrageTab.tsx` โ€” เธฅเธ rate
  - `CustomerMaster.tsx` โ€” เธฅเธเธฅเธนเธเธเนเธฒ
  - `YardsSettings.tsx` โ€” เธฅเธเธฅเธฒเธ + เธฅเธเนเธเธ (ร—2)
  - `EDIConfiguration.tsx` โ€” เธฅเธ Endpoint
  - `RateLimitSettings.tsx` โ€” เธฅเนเธฒเธ Rate Limit (warning variant)
  - `PrefixMapping.tsx` โ€” เธฅเธ prefix
  - `mnr/page.tsx` โ€” เธฅเธ CEDEX

### ๐”’ SQL Injection Audit (โ… เน€เธชเธฃเนเธ)
- [x] **เธ•เธฃเธงเธเธชเธญเธ 20+ API route files** โ€” เนเธกเนเธเธเธเนเธญเธเนเธซเธงเน SQL injection
- [x] เธ—เธธเธเนเธเธฅเนเนเธเน `mssql` parameterized queries (`.input()` + `@param`) เธญเธขเนเธฒเธเธ–เธนเธเธ•เนเธญเธ
- [x] Dynamic WHERE clauses เธเธฅเธญเธ”เธ เธฑเธข โ€” เนเธเน hardcoded condition strings (เน€เธเนเธ `'w.yard_id = @yardId'`)
- [x] เนเธกเนเธเธ string concatenation, `sql` tagged templates, เธซเธฃเธทเธญ `.raw()` calls
- เธเธณเนเธเธฐเธเธณ: เน€เธเธดเนเธก Zod validation เนเธซเน route เธญเธทเนเธเน (เธเธฑเธเธเธธเธเธฑเธเธกเธตเนเธเน `gate/route.ts`)

### ๐งช Automated Testing (โ… เน€เธชเธฃเนเธ)
- [x] **Jest + ts-jest** โ€” เธ•เธดเธ”เธ•เธฑเนเธเนเธฅเธฐเธ•เธฑเนเธเธเนเธฒ Jest เธชเธณเธซเธฃเธฑเธ Next.js + TypeScript (path alias `@/*`, jose ESM handling)
- [x] **5 Test Suites / 154 Tests** โ€” เธเธฃเธญเธเธเธฅเธธเธก business logic เธชเธณเธเธฑเธเธ—เธฑเนเธเธซเธกเธ”เนเธ `src/lib/`:
  - `containerValidation.test.ts` โ€” ISO 6346 check digit calculation, full validation (valid/invalid), parseSizeTypeCode (20 tests)
  - `utils.test.ts` โ€” formatContainerNumber, getStatusColor (เธ—เธธเธ status), getStatusLabel เธ เธฒเธฉเธฒเนเธ—เธข (24 tests)
  - `validators.test.ts` โ€” Zod schemas เธ—เธฑเนเธ 7 เธ•เธฑเธง: containerNumber, gate in/out, invoice, user, **customer (multi-role + edi_prefix refine)**, EDI endpoint (60 tests)
  - `auth.test.ts` โ€” JWT create/verify round-trip, tamper detection, getRoleLabel, ROLES constant (16 tests)
  - `rateLimit.test.ts` โ€” clearRateLimitStores, getRateLimitStats, getClientIP (x-forwarded-for, x-real-ip, fallback) (14 tests)
- [x] **เธเธณเธชเธฑเนเธ**: `npm test` (verbose) / `npm run test:watch` (watch mode)
- [x] **เธเธฅเธฅเธฑเธเธเน**: 154/154 tests passed, ~0.7s execution time

### Master Setup (โ… 6 เธเนเธญ เน€เธชเธฃเนเธ)
- [x] Approval Hierarchy, EDI Config, Seal Master
- [x] Tiered Storage Rate โ€” **เน€เธเธทเนเธญเธก DB เธเธฃเธดเธ** (API GET/POST) + live preview, Auto-Allocation Rules, Equipment Rules

### ๐“ Booking Feature (โ… เน€เธชเธฃเนเธ โ€” 6 Phases)
- [x] **Phase 1 โ€” Database**: เธ•เธฒเธฃเธฒเธ `BookingContainers` (junction Bookingโ”Container) + เธเธญเธฅเธฑเธกเธเนเนเธซเธกเนเนเธ `Bookings` (`valid_from`, `valid_to`, `received_count`, `released_count`)
- [x] **Phase 2 โ€” API**: `api/edi/bookings/route.ts` เน€เธเธดเนเธก progress fields + server-side pagination (`OFFSET/FETCH NEXT`, `page`/`limit` params), `api/bookings/containers/route.ts` [NEW] (GET/POST/DELETE), `api/gate/route.ts` auto-link Booking on Gate-In + update released_count on Gate-Out + auto-complete Booking
- [x] **Phase 3 โ€” Dedicated Page**: `booking/page.tsx` 3 เนเธ—เนเธ (เธฃเธฒเธขเธเธฒเธฃ Booking + เธชเธฃเนเธฒเธ/เธเธณเน€เธเนเธฒ CSV/Excel + เธชเธฃเธธเธ KPI), เธขเนเธฒเธขเธญเธญเธเธเธฒเธเธซเธเนเธฒ EDI, Sidebar เน€เธกเธเธนเนเธซเธกเน "๐“ Booking"
- [x] **Phase 4 โ€” Gate Integration**: Gate-In/Out `booking_ref` fields auto-link เธเนเธฒเธ API (เนเธกเนเธ•เนเธญเธเนเธเน UI เน€เธเธดเนเธก)
- [x] **Phase 5 โ€” Yard Display**: `ContainerDetailModal.tsx` เนเธชเธ”เธ booking_ref เธญเธขเธนเนเนเธฅเนเธง
- [x] **Phase 6 โ€” RBAC**: 4 permissions เนเธซเธกเน (`bookings:create/read/update/delete`) + เน€เธเธดเนเธกเนเธ `PermissionsMatrix.tsx`, `gate_clerk` เนเธ”เน create/read/update

**Booking Flow:**
1. เธชเธฃเนเธฒเธ Booking (เธซเธฃเธทเธญ Import CSV/Excel) โ’ status: `pending`
2. เธขเธทเธเธขเธฑเธ โ’ status: `confirmed`
3. Gate-In เธฃเธฐเธเธธ `booking_ref` โ’ auto-link เธ•เธนเนเน€เธเนเธฒ `BookingContainers` + `received_count++`
4. Gate-Out เธฃเธฐเธเธธ `booking_ref` โ’ update `released_count++` โ’ เธ–เนเธฒเธเธฃเธ โ’ auto-complete

**Pagination:**
- API: `GET /api/edi/bookings?page=1&limit=20` โ’ returns `{ bookings, total, totalPages, page, limit }`
- UI: เธเธธเนเธกเน€เธฅเธเธซเธเนเธฒ (sliding window 5 เธเธธเนเธก) + prev/next + "เนเธชเธ”เธ Xโ€“Y เธเธฒเธ Z เธฃเธฒเธขเธเธฒเธฃ"

### ๐“ง Booking Email Notifications (โ… เน€เธชเธฃเนเธ)
- [x] **Real-time Email**: เธชเนเธ email เน€เธกเธทเนเธญ Booking เน€เธเธฅเธตเนเธขเธเธชเธ–เธฒเธเธฐ (confirmed/completed/cancelled) + เธ•เธนเน Gate-In/Out
  - เธชเนเธเนเธเธ—เธตเน `Customers.contact_email` เธเธญเธเน€เธเนเธฒเธเธญเธ Booking
  - เนเธเน `emailService.ts` (Azure Graph API + SMTP fallback) เธ—เธตเนเธกเธตเธญเธขเธนเนเนเธฅเนเธง
  - Toggle เน€เธเธดเธ”/เธเธดเธ”เธ—เธตเน Settings โ’ Email: "เนเธเนเธเน€เธกเธทเนเธญ Booking เน€เธเธฅเธตเนเธขเธเธชเธ–เธฒเธเธฐ"
  - Non-blocking: email error เนเธกเนเธเธฃเธฐเธ—เธ transaction
- [x] **Daily Summary**: `bookingScheduler.ts` (node-cron) + `api/cron/booking-summary/route.ts`
  - เธ•เธฑเนเธเน€เธงเธฅเธฒเธชเนเธเนเธ”เน (dropdown HH:MM) เธ—เธตเนเธซเธเนเธฒ Settings โ’ Email
  - เธชเธฃเธธเธ KPI: Active, เนเธซเธกเน, เธขเธทเธเธขเธฑเธ, เน€เธชเธฃเนเธ, เธ•เธนเนเธฃเธฑเธ/เธญเธญเธเธงเธฑเธเธเธตเน
  - เธเธธเนเธก "เธชเนเธเธชเธฃเธธเธเธ•เธญเธเธเธตเน" + เนเธชเธ”เธ timestamp เธชเนเธเธฅเนเธฒเธชเธธเธ”
  - Scheduler init เธเนเธฒเธ `instrumentation.ts` + auto-reload เน€เธกเธทเนเธญเธเธฑเธเธ—เธถเธ Settings
- [x] **Email Templates**: `bookingStatusEmail()` (status badge + progress bar), `bookingDailySummaryEmail()` (6 KPI cards + table)

### ๐“ Gate Email + EIR PDF (โ… เน€เธชเธฃเนเธ)
- [x] **Gate Email Notification**: เธชเนเธ email เนเธเนเธ admin เน€เธกเธทเนเธญเธกเธต Gate-In/Out เธเธฃเนเธญเธกเนเธเธ EIR PDF
  - `lib/eirPdfGenerator.ts`: เธชเธฃเนเธฒเธ EIR PDF เธเธฑเนเธ server เธ”เนเธงเธข jsPDF + Sarabun Bold
  - 4 sections: Container Info, Location, Transport, Signature Lines
  - เนเธเธเนเธเธฅเน `EIR_{eir_number}.pdf` เธเธฑเธ email เธญเธฑเธ•เนเธเธกเธฑเธ•เธด
  - Toggle: Settings โ’ Email โ’ "เนเธเนเธเน€เธกเธทเนเธญเธกเธตเธ•เธนเน Gate-In / Gate-Out"
  - Non-blocking: email error เนเธกเนเธเธฃเธฐเธ—เธ gate transaction
- [x] **Fonts**: `public/fonts/Sarabun-Bold.ttf`, `Sarabun-Italic.ttf` (เนเธซเธฅเธ”เธเธฒเธ filesystem, cache เนเธ memory)

### ๐“ฅ Booking Import Template (โ… เน€เธชเธฃเนเธ)
- [x] เธเธธเนเธก "เธ”เธฒเธงเธเนเนเธซเธฅเธ” Template (.xlsx)" เธ—เธตเนเธซเธเนเธฒ Booking โ’ เธชเธฃเนเธฒเธ/เธเธณเน€เธเนเธฒ
  - 13 เธเธญเธฅเธฑเธกเธเน: `booking_number`, `booking_type`, `vessel_name`, `voyage_number`, `container_count`, `container_size`, `container_type`, `eta`, `seal_number`, `container_numbers`, `valid_from`, `valid_to`, `notes`
  - เนเธเธฅเน `.xlsx` เธเธฃเนเธญเธก 2 เนเธ–เธงเธ•เธฑเธงเธญเธขเนเธฒเธ + auto-size columns
  - `container_numbers`: เธเธฑเนเธเธ”เนเธงเธข `,` เนเธเธเนเธญเธเน€เธ”เธตเธขเธง โ’ split เน€เธเนเธ array โ’ auto-link `BookingContainers`

### ๐ Customer Portal (โ… เน€เธชเธฃเนเธ)
- [x] **Database**: `scripts/migrate-customer-portal.js`
  - `Users.customer_id` (FK โ’ Customers) โ€” link user เธเธฑเธเธเธฃเธดเธฉเธฑเธ—เธฅเธนเธเธเนเธฒ
  - `Customers.is_portal_enabled` โ€” toggle เน€เธเธดเธ”/เธเธดเธ” Portal
  - เธ•เธฃเธงเธเนเธฅเธฐเธชเธฃเนเธฒเธ `customer` role เธญเธฑเธ•เนเธเธกเธฑเธ•เธด
- [x] **Auth & Security**:
  - `auth.ts`: เน€เธเธดเนเธก `customerId` เนเธ `UserPayload`
  - `login/route.ts`: เธ”เธถเธ `customer_id` เธเธฒเธ Users โ’ เนเธชเนเนเธ JWT
  - `middleware.ts`: guard `/api/portal/*` (เธ•เนเธญเธ role = customer) + เธชเนเธ `x-customer-id` header
  - Login page: redirect customer role โ’ `/portal`
  - **Data isolation**: เธ—เธธเธ portal API เนเธเน `customer_id` เธเธฒเธ JWT เน€เธ—เนเธฒเธเธฑเนเธ (เนเธกเนเธฃเธฑเธเธเธฒเธ query params)
- [x] **Portal API** (4 endpoints เธ—เธตเน `api/portal/`):
  - `overview`: KPIs (เธ•เธนเนเนเธเธฅเธฒเธ, เธเนเธฒเธเธเธณเธฃเธฐ, Booking active) + recent gate activity
  - `containers`: paginated container list + status filter
  - `invoices`: invoices + summary (outstanding/paid)
  - `bookings`: bookings + progress (received/container_count)
- [x] **Portal UI** (`app/(portal)/`):
  - Layout: responsive sidebar (desktop) + hamburger (mobile), auto-redirect non-customer
  - Overview: 4 KPI cards + recent gate activity
  - Containers: responsive table (mobile cards + desktop) + search + filter + pagination
  - Invoices: summary cards (เธเนเธฒเธเธเธณเธฃเธฐ/เธเธณเธฃเธฐเนเธฅเนเธง) + table + pagination
  - Bookings: cards with progress bar + vessel info + pagination
- [x] **Admin โ€” เธเธฑเธ”เธเธฒเธฃเธฅเธนเธเธเนเธฒ**:
  - API `api/settings/customers/portal/route.ts`: เธชเธฃเนเธฒเธเธเธฑเธเธเธต Portal
  - `CustomerMaster.tsx`: เธเธธเนเธก ๐”‘ (KeyRound) เธชเธฃเนเธฒเธเธเธฑเธเธเธต โ’ เนเธชเธ”เธ username/password เนเธ alert
  - Username = contact_email, Password = เธชเธธเนเธก 8 เธ•เธฑเธง, auto-enable `is_portal_enabled`

### ๐” Portal Enhancements โ€” Auto-refresh & Self-service PDF (โ… เน€เธชเธฃเนเธ)
- [x] **Auto-refresh Polling (30 เธงเธดเธเธฒเธ—เธต)**:
  - Overview: `setInterval(fetchData, 30000)` + refresh button + last updated timestamp
  - Containers: เน€เธซเธกเธทเธญเธเธเธฑเธ โ€” เธฅเธนเธเธเนเธฒเน€เธซเนเธ status update เธ—เธธเธ 30s
- [x] **Self-service PDF Downloads**:
  - `api/portal/eir-pdf`: EIR PDF download (reuse `eirPdfGenerator.ts`, เธ•เธฃเธงเธ customer_id ownership)
  - `api/portal/invoice-pdf`: Invoice PDF with Thai font (jsPDF + Sarabun, เธ•เธฃเธงเธ customer_id ownership)
  - Overview: เธฅเธดเธเธเน "EIR PDF" เธ—เธตเนเธ—เธธเธเนเธ–เธง gate activity
  - Invoices: เธเธธเนเธก "PDF" เธ—เธธเธเนเธ–เธง (เธ—เธฑเนเธ mobile cards + desktop table)
- [x] **Data Isolation**: เธ—เธธเธ PDF endpoint เนเธเน `WHERE customer_id = @cid` โ€” เธฅเธนเธเธเนเธฒเธ”เธฒเธงเธเนเนเธซเธฅเธ”เนเธ”เนเน€เธเธเธฒเธฐเน€เธญเธเธชเธฒเธฃเธ•เธฑเธงเน€เธญเธ

### ๐‘ฅ User Management UX (โ… เน€เธชเธฃเนเธ)
- [x] **Tab-based Filtering**: 3 เนเธ—เนเธ (เธ—เธฑเนเธเธซเธกเธ” / ๐‘ค เธเธเธฑเธเธเธฒเธ / ๐ข เธฅเธนเธเธเนเธฒ) + count badges
- [x] **Search**: เธเนเธเธซเธฒเธ”เนเธงเธขเธเธทเนเธญเธซเธฃเธทเธญ username
- [x] **Pagination**: 10 เธฃเธฒเธขเธเธฒเธฃ/เธซเธเนเธฒ + page numbers + ellipsis + info text
- [x] **Delete**: เธเธธเนเธกเธฅเธ + ConfirmDialog + FK cleanup (UserYardAccess) + เธเนเธญเธเธเธฑเธเธฅเธเธ•เธฑเธงเน€เธญเธ
- [x] **Company Badge**: เนเธชเธ”เธ ๐ข เธเธทเนเธญเธเธฃเธดเธฉเธฑเธ—เนเธ•เน username เธชเธณเธซเธฃเธฑเธ customer users
- [x] **Sectioned Form**: เนเธเนเธเธเธญเธฃเนเธกเน€เธเนเธ 3 เธชเนเธงเธ (Account / Personal / Role & Permissions)
- [x] **Yard Checkboxes**: multi-select checkbox + "เน€เธฅเธทเธญเธเธ—เธฑเนเธเธซเธกเธ”" เธชเธณเธซเธฃเธฑเธเธเธณเธซเธเธ”เธฅเธฒเธเน€เธเนเธฒเธ–เธถเธ

### ๐” EIR Number Security Hardening (โ… เน€เธชเธฃเนเธ)
- [x] **เธเธฑเธเธซเธฒ**: EIR page เน€เธเนเธ public (QR scan access) + EIR number เน€เธเนเธเน€เธฅเธเน€เธฃเธตเธขเธเธฅเธณเธ”เธฑเธ โ’ เน€เธ”เธฒเนเธ”เน
- [x] **เนเธเนเนเธ**: เน€เธเธดเนเธก random 6-char hex suffix
  - เธเนเธญเธ: `EIR-IN-2026-000001` (guessable)
  - เธซเธฅเธฑเธ: `EIR-IN-2026-000001-a3f8b2` (16^6 = ~16M เธเธงเธฒเธกเน€เธเนเธเนเธเนเธ”เน)
  - เนเธเน `crypto.randomUUID().slice(0,6)` โ€” เธ—เธธเธเนเธเธกเธต hex เน€เธเธเธฒเธฐเธ•เธฑเธง
  - Lookup เธ”เนเธงเธข full string โ’ เน€เธเธฅเธตเนเธขเธเนเธเนเน€เธฅเธเธฅเธณเธ”เธฑเธ + hex เนเธกเนเธ•เธฃเธ โ’ 404
- [x] **Transfer numbers**: เนเธเน format เน€เธ”เธตเธขเธงเธเธฑเธ `TRF-YYYY-XXXXXX-randomhex`

### ๐” Password Policy & Account Lockout (โ… เน€เธชเธฃเนเธ)

**เนเธเธฅเนเธ—เธตเนเน€เธเธตเนเธขเธงเธเนเธญเธ:**
- `src/lib/passwordPolicy.ts` โ€” validation logic + strength meter + config loader
- `src/app/api/settings/security/route.ts` โ€” GET policy+locked users, PUT update config/unlock
- `src/app/api/auth/login/route.ts` โ€” lockout enforcement (count, lock, auto-unlock)
- `src/app/api/settings/users/route.ts` โ€” password validation on create/update, unlock action
- `src/app/(dashboard)/settings/SecuritySettings.tsx` โ€” Admin UI เนเธ—เนเธ "เธเธงเธฒเธกเธเธฅเธญเธ”เธ เธฑเธข"
- `src/app/login/page.tsx` โ€” lockout feedback (remaining time, attempts warning)
- `scripts/migrate-password-policy.js` โ€” DB migration

**Password Policy (configurable via Admin UI):**
- [x] เธเธงเธฒเธกเธขเธฒเธงเธเธฑเนเธเธ•เนเธณ (default 8, range 6-32)
- [x] เธเธฑเธเธเธฑเธเธ•เธฑเธงเธเธดเธกเธเนเนเธซเธเน (A-Z) โ€” toggle
- [x] เธเธฑเธเธเธฑเธเธ•เธฑเธงเธเธดเธกเธเนเน€เธฅเนเธ (a-z) โ€” toggle
- [x] เธเธฑเธเธเธฑเธเธ•เธฑเธงเน€เธฅเธ (0-9) โ€” toggle
- [x] เธเธฑเธเธเธฑเธเธญเธฑเธเธเธฃเธฐเธเธดเน€เธจเธฉ (!@#$%...) โ€” toggle
- [x] Real-time password strength meter (4 เธฃเธฐเธ”เธฑเธ: เธญเนเธญเธเธกเธฒเธ/เธญเนเธญเธ/เธเธฒเธเธเธฅเธฒเธ/เนเธเนเธเนเธฃเธ)

**Account Lockout:**
- [x] เธเธฑเธ failed login attempts เธ•เนเธญ user
- [x] เธฅเนเธญเธเธญเธฑเธ•เนเธเธกเธฑเธ•เธดเน€เธกเธทเนเธญเธ–เธถเธ max (default 5 เธเธฃเธฑเนเธ, configurable 3-20)
- [x] Auto-unlock เธซเธฅเธฑเธเธซเธกเธ”เน€เธงเธฅเธฒ (default 30 เธเธฒเธ—เธต, configurable 5-1440)
- [x] Admin เธเธฅเธ”เธฅเนเธญเธเนเธ”เนเธเธฒเธ 2 เธ—เธตเน: SecuritySettings tab + UsersSettings inline button
- [x] Login page เนเธชเธ”เธ countdown + remaining attempts warning (โค 3 เธเธฃเธฑเนเธ)
- [x] Reset counter เน€เธเนเธ 0 เน€เธกเธทเนเธญ login เธชเธณเน€เธฃเนเธ
- [x] `locked_at` เธเธฃเนเธญเธก lockout badge ๐”’ เนเธ Users table

**DB Columns (Users table):**
```sql
failed_login_count  INT DEFAULT 0          -- เธเธณเธเธงเธ login เธเธดเธ”เธ•เธดเธ”เธ•เนเธญเธเธฑเธ
locked_at           DATETIME2 NULL         -- เน€เธงเธฅเธฒเธ—เธตเนเธ–เธนเธเธฅเนเธญเธ (NULL = เนเธกเนเธ–เธนเธเธฅเนเธญเธ)
password_changed_at DATETIME2 NULL         -- เน€เธงเธฅเธฒเน€เธเธฅเธตเนเธขเธเธฃเธซเธฑเธชเธเนเธฒเธเธฅเนเธฒเธชเธธเธ”
notif_last_read_at  DATETIME2 NULL         -- เน€เธงเธฅเธฒเธ—เธตเนเธญเนเธฒเธเธเธฒเธฃเนเธเนเธเน€เธ•เธทเธญเธเธฅเนเธฒเธชเธธเธ” (เธเธดเธเธเนเธเนเธฒเธก browser)
```

**Config (SystemSettings key `password_policy`):**
```json
{
  "min_length": 8,
  "require_uppercase": true,
  "require_lowercase": true,
  "require_number": true,
  "require_special": true,
  "max_login_attempts": 5,
  "lockout_duration_min": 30
}
```

### ๐ Inter-Yard Transfer Hardening (โ… เน€เธชเธฃเนเธ)

**เนเธเธฅเนเธ—เธตเนเน€เธเธตเนเธขเธงเธเนเธญเธ:**
- `src/lib/autoAllocate.ts` โ€” shared smart allocation module (เนเธขเธเธเธฒเธ gate/route.ts)
- `src/app/api/gate/transfer/route.ts` โ€” send transfer (fix column name + to_yard_id + audit)
- `src/app/api/gate/transfer/receive/route.ts` โ€” receive transfer (smart allocate + to_yard_id filter + fix column)
- `src/app/(dashboard)/gate/TransferTab.tsx` โ€” toast feedback + user_id
- `scripts/migrate-transfer-yard.js` โ€” DB migration (to_yard_id column + backfill)

**เนเธเนเนเธ 6 เธเธธเธ”:**
- [x] **Column name** โ€” `row_pos` โ’ `[row]` (เธ•เธฃเธเธเธฑเธ schema)
- [x] **to_yard_id** โ€” เน€เธเธดเนเธก column เนเธ GateTransactions เน€เธเธทเนเธญ filter เธ•เธนเนเธ—เธตเนเธเธณเธฅเธฑเธเธกเธธเนเธเธซเธเนเธฒเนเธเธฅเธฒเธเธเธฅเธฒเธขเธ—เธฒเธ
- [x] **Notes structure** โ€” เน€เธเนเธ `to_yard_id` เนเธ column เนเธขเธ + user notes เน€เธเนเธ structured JSON
- [x] **Smart auto-allocate** โ€” Transfer receive เนเธเน `autoAllocate()` เน€เธ”เธตเธขเธงเธเธฑเธ Gate-In (size/type/reefer/line/spread)
- [x] **Audit user_id** โ€” เธชเนเธ user_id เธเธฒเธ frontend + เน€เธเนเธเนเธ AuditLog
- [x] **Toast feedback** โ€” เนเธชเธ”เธ toast เน€เธกเธทเนเธญเธชเนเธ/เธฃเธฑเธเธ•เธนเนเธชเธณเน€เธฃเนเธ

**Shared module `src/lib/autoAllocate.ts`:**
- เนเธขเธ autoAllocate() เธญเธญเธเธเธฒเธ gate/route.ts เน€เธเนเธ shared lib
- เนเธเนเธฃเนเธงเธกเธเธฑเธเธ—เธฑเนเธ Gate-In เนเธฅเธฐ Transfer Receive
- เธเธดเธเธฒเธฃเธ“เธฒ: size segregation, reefer/DG zone, shipping line grouping, spread-even, nearest-gate, max tier

### ๐” Next.js 16 Proxy Migration + Auth Session Fix (โ… เน€เธชเธฃเนเธ)

**เนเธเธฅเนเธ—เธตเนเน€เธเธตเนเธขเธงเธเนเธญเธ:**
- `src/proxy.ts` โ€” Next.js 16 Proxy (เนเธ—เธเธ—เธตเน `middleware.ts` เธเธถเนเธ deprecated เนเธ Next.js 16)
- `src/app/api/auth/me/route.ts` โ€” Session restore endpoint (เนเธเน SQL bug)
- `src/app/api/auth/login/route.ts` โ€” Login + httpOnly cookie

**Next.js 16 Proxy Migration:**
- [x] เน€เธเธฅเธตเนเธขเธเธเธฒเธ `middleware.ts` โ’ `proxy.ts` เธ•เธฒเธกเธกเธฒเธ•เธฃเธเธฒเธ Next.js 16
- [x] Export function `proxy()` เนเธ—เธ `middleware()`
- [x] **Page Guard (server-side)**: เธ•เธฃเธงเธ `cyms_token` cookie เธชเธณเธซเธฃเธฑเธ protected page routes โ’ redirect เนเธ `/login` เธ—เธฑเธเธ—เธต (เนเธกเนเธ•เนเธญเธเธฃเธญ client-side JS)
- [x] **Cookieโ’Header Forwarding**: `passthrough()` เธญเนเธฒเธ cookie เนเธฅเนเธงเธชเนเธเน€เธเนเธ `x-cyms-token` custom header โ’ API route handler เธญเนเธฒเธเนเธ”เนเนเธเนเธเธญเธ (safety net)
- [x] เน€เธเธดเนเธก `allowedDevOrigins` เนเธ `next.config.ts` เธชเธณเธซเธฃเธฑเธ LAN testing

**Auth Session Persistence Fix (Critical Bug):**
- [x] **Root Cause**: `/api/auth/me` SQL query เนเธเนเธเธทเนเธญ table เธเธดเธ” `UserYards` (เนเธกเนเธกเธตเธญเธขเธนเนเนเธ DB) เนเธ—เธเธ—เธตเนเธเธฐเน€เธเนเธ `UserYardAccess` + เนเธเน `u.is_active = 1` (column เนเธกเนเธกเธต) เนเธ—เธ `u.status = 'active'`
- [x] **เธเธฅเธเธฃเธฐเธ—เธ**: Query fail silently โ’ catch block return `{ authenticated: false }` เธ—เธธเธเธเธฃเธฑเนเธ โ’ AuthProvider เธเธดเธ”เธงเนเธฒเนเธกเนเธกเธต session โ’ redirect เนเธ `/login`
- [x] **เนเธเนเนเธ**: เนเธเนเธเธทเนเธญ table + column เนเธซเนเธ•เธฃเธเธเธฑเธ schema.sql + เน€เธเธดเนเธก error logging เนเธ catch block
- [x] **เธฅเธ debug endpoint**: เธฅเธ `api/auth/debug/route.ts` เธ—เธตเนเธชเธฃเนเธฒเธเนเธงเนเธเธฑเนเธงเธเธฃเธฒเธง

**เธชเธ–เธฒเธเธฑเธ•เธขเธเธฃเธฃเธก Auth เธเธฑเธเธเธธเธเธฑเธ (Hybrid Approach):**
```
Login โ’ SET httpOnly cookie (cyms_token) + localStorage (cyms_session)
         โ“
New Tab โ’ Proxy เธ•เธฃเธงเธ cookie (page guard) โ…
         โ’ AuthProvider: เธฅเธญเธ localStorage (เธงเนเธฒเธ) โ’ เน€เธฃเธตเธขเธ /api/auth/me
         โ’ auth/me เธญเนเธฒเธ x-cyms-token header โ’ verify JWT โ’ เธ”เธถเธ user เธเธฒเธ DB โ’ return session โ…
         โ’ AuthProvider เน€เธเนเธ session เธฅเธ localStorage + state
```

---

## 10. เธเนเธญเธเธงเธฃเธฃเธฐเธงเธฑเธ (Known Issues)

| เธฃเธฒเธขเธเธฒเธฃ | เธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ” |
|--------|-----------|
| **TypeScript lint** | ~~API files เธกเธต implicit `any` type warnings เธชเธณเธซเธฃเธฑเธ `mssql`~~ โ’ เนเธเนเนเธฅเนเธงเธ”เนเธงเธข `src/types/mssql.d.ts` |
| **Auth proxy** | ~~เธขเธฑเธเนเธกเนเธกเธต middleware เธ•เธฃเธงเธ JWT เธ—เธตเน API routes~~ โ’ **เนเธเนเนเธฅเนเธง** `src/proxy.ts` (Next.js 16) เธ•เธฃเธงเธ JWT เธ—เธธเธ API route + page guard |
| **Auth session (เนเธเนเนเธฅเนเธง)** | ~~เน€เธเธดเธ” New Tab / Hard Refresh เนเธฅเนเธงเน€เธ”เนเธเธเธฅเธฑเธเธซเธเนเธฒ Login~~ โ’ **เนเธเนเนเธฅเนเธง** (10 เน€เธก.เธข. 2569) โ€” เธชเธฒเน€เธซเธ•เธธ: `auth/me` SQL query เนเธเน table `UserYards` (เนเธกเนเธกเธตเธญเธขเธนเนเธเธฃเธดเธ) เนเธ—เธเธ—เธตเนเธเธฐเน€เธเนเธ `UserYardAccess` + column `is_active` เนเธ—เธ `status` โ’ query fail silently โ’ return `authenticated: false` เธ—เธธเธเธเธฃเธฑเนเธ |
| **Pagination** | ~~เธ•เธฒเธฃเธฒเธเธ•เธนเนเนเธชเธ”เธ max 50 เธฃเธฒเธขเธเธฒเธฃ เธขเธฑเธเนเธกเนเธกเธต pagination~~ โ’ **เนเธเนเนเธฅเนเธง** Yard overview + Gate History + Invoices + CODECO + Demurrage = 25/เธซเธเนเธฒ |
| **Confirmation Dialogs** | ~~เนเธเน `window.confirm()` เธ—เธธเธเธเธธเธ”~~ โ’ **เนเธเนเนเธฅเนเธง** เน€เธเธฅเธตเนเธขเธเน€เธเนเธ `ConfirmDialog` custom modal เธ—เธฑเนเธ 8 เธเธธเธ” |
| **SQL Injection** | โ… **เธ•เธฃเธงเธเนเธฅเนเธง** โ€” เธ—เธธเธ API route เนเธเน parameterized queries, เนเธกเนเธเธเธเนเธญเธเนเธซเธงเน |
| **Automated Testing** | โ… **เธกเธตเนเธฅเนเธง** โ€” Jest + ts-jest, 5 suites / 146 tests เธเธฃเธญเธเธเธฅเธธเธก lib/ (containerValidation, utils, validators, auth, rateLimit) |
| **Credit Note / เนเธเธฅเธ”เธซเธเธตเน** | โ… **เธกเธตเนเธฅเนเธง** โ€” CN-YYYY-XXXXXX, modal เธเธฃเธญเธเน€เธซเธ•เธธเธเธฅ+เธขเธญเธ”, เธขเธญเธ”เธ•เธดเธ”เธฅเธ, auto-cancel เน€เธกเธทเนเธญเธฅเธ”เน€เธ•เนเธกเธเธณเธเธงเธ |
| **AR Aging Report** | โ… **เธกเธตเนเธฅเนเธง** โ€” เนเธ—เนเธ AR Aging เนเธขเธเธ•เธฒเธกเธฅเธนเธเธเนเธฒ, summary current/30/60/90+ เธงเธฑเธ + เธชเธตเธเธงเธฒเธกเน€เธชเธตเนเธขเธ |
| **Dashboard Range Toggle** | โ… **เธกเธตเนเธฅเนเธง** โ€” toggle 7 เธงเธฑเธ / 30 เธงเธฑเธ / 3 เน€เธ”เธทเธญเธ + เธฃเธงเธกเธฃเธฒเธขเธชเธฑเธเธ”เธฒเธซเนเธญเธฑเธ•เนเธเธกเธฑเธ•เธดเธชเธณเธซเธฃเธฑเธ 30d/90d |
| **2FA (TOTP)** | เธกเธต flag `two_fa_enabled` เนเธ•เนเธขเธฑเธเนเธกเนเธกเธต TOTP implementation |
| **Device Binding** | เธกเธต field `bound_device_mac` เนเธ•เนเธขเธฑเธเนเธกเน enforce เธ•เธญเธ login |
| **Password Policy** | โ… **เธกเธตเนเธฅเนเธง** โ€” configurable min_length, uppercase, lowercase, number, special char + strength meter UI |
| **Account Lockout** | โ… **เธกเธตเนเธฅเนเธง** โ€” lock after N failed attempts, auto-unlock after duration, Admin unlock UI |
| **Payment Gateway** | เธขเธฑเธเนเธกเนเธกเธต QR Code / payment integration |
| **Audit Trail** | ~~UI placeholder~~ โ’ เนเธเนเนเธฅเนเธง เธกเธต Audit Log API + UI |
| **CSS lint warnings** | `@variant`, `@theme` = Tailwind v4 directives เธเธเธ•เธด (IDE lint เนเธกเนเธฃเธนเนเธเธฑเธ เนเธ•เน build เธชเธณเน€เธฃเนเธ) |
| **Timezone (เนเธเนเนเธฅเนเธง)** | ~~EIR เธงเธฑเธเธ—เธตเนเน€เธฅเธทเนเธญเธ 7 เธเธก.~~ โ’ เนเธเนเนเธฅเนเธงเนเธ”เธขเนเธชเน `useUTC: false` เนเธ `db.ts` (เธเนเธญเธเธเธฑเธ mssql driver เธ•เธตเธเธงเธฒเธก DATETIME2 เน€เธเนเธ UTC เธเนเธณเธเนเธญเธ) |
| **Notification Cross-Browser (เนเธเนเนเธฅเนเธง)** | ~~เธเธ” "เธญเนเธฒเธเนเธฅเนเธงเธ—เธฑเนเธเธซเธกเธ”" เนเธ Chrome โ’ เน€เธเธดเธ” Edge เธขเธฑเธเน€เธซเนเธ badge~~ โ’ เนเธเนเนเธฅเนเธง เน€เธเธดเนเธก `notif_last_read_at` เนเธ `Users` table + `PATCH /api/notifications` เธเธฑเธเธ—เธถเธ DB + `GET` เธชเนเธ `last_read_at` เธเธฅเธฑเธเธกเธฒ โ€” เธเธดเธเธเนเธ—เธธเธ browser/device |

---

## 11. เธเธณเธชเธฑเนเธเธ—เธตเนเนเธเนเธเนเธญเธข

```bash
# เธฃเธฑเธเนเธเธฃเน€เธเธ (Port 3005)
npm run dev
# โ’ http://localhost:3005

# Setup DB เนเธซเธกเน (เธชเธฃเนเธฒเธ DB + tables)
node scripts/setup-db.js

# Seed เธเนเธญเธกเธนเธฅเธ—เธฑเนเธเธซเธกเธ”
node scripts/seed-users.js
node scripts/seed-permissions.js
node scripts/seed-containers.js

# Build production
npm run build
npm start
# โ’ http://localhost:3005

# เธชเธฃเนเธฒเธเธ•เธฒเธฃเธฒเธ EDI Endpoints + Send Log
node scripts/migrate-edi-endpoints.js

# เธชเธฃเนเธฒเธเธ•เธฒเธฃเธฒเธ DemurrageRates + default rates
node scripts/migrate-demurrage.js

# ๐งช เธฃเธฑเธ Tests เธ—เธฑเนเธเธซเธกเธ” (194 tests: 146 lib + 48 API integration)
npm test

# Watch mode (re-run เน€เธกเธทเนเธญเนเธเนเนเธเนเธ”)
npm run test:watch

# เธฃเธฑเธ test เน€เธเธเธฒเธฐ suite
npx jest containerValidation        # lib unit tests
npx jest "api/__tests__"             # API integration tests เน€เธ—เนเธฒเธเธฑเนเธ
npx jest "api/__tests__/billing"     # เน€เธเธเธฒเธฐ billing
npx jest "api/__tests__/mnr"         # เน€เธเธเธฒเธฐ M&R

# Migration: Customer Portal
node scripts/migrate-customer-portal.js

# Migration: Password Policy & Account Lockout
node scripts/migrate-password-policy.js

# Migration: Inter-Yard Transfer (to_yard_id column)
node scripts/migrate-transfer-yard.js

# Migration: Tariff Matrix (customer_id + cargo_status on StorageRateTiers)
node scripts/migrate-tariff-matrix.js

# Migration: Prefix One-to-Many (drop UQ_Prefix, add is_primary + UNIQUE pair)
node scripts/migrate-prefix-multi.js

# Migration: Owner/Billing Separation (container_owner_id + billing_customer_id + is_soc)
node scripts/migrate-gate-owner.js
```

---

> **เธเธนเนเธชเธฃเนเธฒเธ**: AI Assistant (Antigravity)  
> **เธงเธฑเธเธ—เธตเนเธญเธฑเธเน€เธ”เธ—เธฅเนเธฒเธชเธธเธ”**: 12 เน€เธกเธฉเธฒเธขเธ 2569  
> **เน€เธญเธเธชเธฒเธฃเน€เธเธดเนเธกเน€เธ•เธดเธก**: `src/lib/schema.sql` (SQL schema), `.env.local` (config)
