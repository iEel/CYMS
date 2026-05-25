# 📋 CYMS — Developer Handoff Document
> **Container Yard Management System** (ระบบบริหารจัดการลานตู้คอนเทนเนอร์อัจฉริยะ)  
> ส่งมอบงาน: 12 เมษายน 2569 | อัปเดทล่าสุด: 22 พฤษภาคม 2569 | เวอร์ชัน: เฟส 1-9 + FR1-6 + NFR + Master Setup + Customer Management + Gate Auto-Allocation + EIR A5 + 2-Phase Gate-Out + File Storage + Notifications + **Tiered Billing + Printable Invoice/Receipt + PromptPay QR + Bay View + 3D Search Highlight + Container Detail Modal + Boxtech API + Prefix Mapping + Gate-In/Out Billing + SSE Real-Time Operations + Billing Reports + CODECO/EDI + SFTP/Email/Auto-Schedule + Production Readiness + Audit Trail + Pagination + ConfirmDialog + Automated Testing + Dashboard Analytics + Credit Note + AR Aging + Auto-Allocation DB Rules + M&R Hardening + PDF Export + Gate Component Decomposition + Billing Component Split + Password Policy & Account Lockout + TOTP 2FA + Trusted Device Binding + Inter-Yard Transfer + PWA Camera OCR + Offline Queue Flow Integration + Offline Outbox + RBAC Reports Module + Notification Cross-Browser Sync + Gate Reports + Reports Action Center + Security Hardening + Next.js 16 Proxy Migration + Auth Session Persistence Fix + Multi-Role Customer Master + Billing Clearance + Gate-Out Booking Picker + Booking Received/Released Progress + Customer Portal Document Bundle + Portal Dispute Requests + Booking ETA/Empty Return Guidance + Server-side RBAC Helper + Admin API Hardening + Portal Owner/Billing Visibility Fix + Portal Entity Access Grants + Customer Branch SQL Hardening + Runtime DDL Migration + Billing/M&R Test Drift Cleanup + Global Search & Real Yard Switcher + Gate Guided Workflow Panel + Gate Sticky Decision Bar + Yard Planning Heatmap & Forecast + Yard Planning WO Action + Gate Operational Guardrails + Billing Tariff Simulator + AR Dunning Action Center + AR Contact Audit + Supervisor Approval Inbox + ESLint Warning Cleanup + API Actor Attribution Hardening + API Yard Access Guard + Hard Approval Gates + Customer Portal Container Inventory + Admin Password Reset UX + Portal Overview/Inventory Summary Alignment + Portal EIR Inspection Parity + Portal EIR In/Out Actions + Direct EIR Buttons + Portal Booking Requests & Activity + Reefer Temperature Monitoring + Reefer Exception Workflow + Reefer Offline Walk Mode + Reefer Compliance Reports + Reefer Plug Planning + Staff Reefer Check History + Portal Customer Notifications + Reefer Escalation + Portal Notification Preferences + Booking Approval Inbox + Reefer SLA Dashboard + Portal Audit Trail + Operational Mobile Mode** (~100%)

---

## 1. ภาพรวมโปรเจค

**CYMS** คือระบบบริหารลานตู้คอนเทนเนอร์แบบรวมศูนย์ รองรับหลายสาขา (Multi-Yard) ทำงาน Real-time ผ่าน Web + PWA

### สถานะปัจจุบัน

| เฟส | รายละเอียด | สถานะ |
|-----|-----------|-------|
| **เฟส 1** | วางรากฐาน — โปรเจค, Design System, DB Schema | ✅ เสร็จ |
| **เฟส 2** | ล็อกอิน, Dashboard, ตั้งค่าระบบ, RBAC | ✅ เสร็จ |
| **เฟส 3** | จัดการลาน, 3D Viewer, **Bay Cross-Section View**, Auto-Allocation, ค้นหาตู้ + **3D Highlight + Detail Panel**, Yard Audit, **PWA Card View**, **Container Detail Modal** | ✅ เสร็จ |
| **เฟส 4** | Gate In/Out, EIR, ตรวจสภาพตู้, OCR, Seal Photo, Signature, Inter-Yard Transfer | ✅ เสร็จ |
| **เฟส 5** | ปฏิบัติการ, Job Queue, Smart Shifting, **Tablet-optimized buttons** | ✅ เสร็จ |
| **เฟส 6** | EDI, Booking/Manifest, Seal Validation, **CSV/Excel file import**, **CODECO Outbound (EDIFACT/CSV/JSON)**, **SFTP auto-upload**, **📧 Email delivery**, **⏰ Auto-Schedule (node-cron)** | ✅ เสร็จ |
| **เฟส 7** | ซ่อมบำรุง M&R, EOR, CEDEX, **Audit Trail, Zod Validation, Actual Cost Modal, CEDEX ภาษาไทย** | ✅ เสร็จ |
| **เฟส 8** | บัญชี Billing, Tariff, Hold/Release, **Tiered Storage Rates, Customer-specific Storage Rates, Gate-Out Billing, Gate-In Billing, Billing Clearance (Paid/Credit/No Charge/Waived), A4 Invoice/Receipt Print, Demurrage Calculator, AR Dunning Action Center** | ✅ เสร็จ |
| **เฟส 9** | PWA, Toast, UI Polish, Print | ✅ เสร็จ |

---

## 2. Tech Stack

| ส่วน | เทคโนโลยี | เวอร์ชัน |
|------|----------|---------|
| **Framework** | Next.js (App Router) | 16.1+ |
| **Language** | TypeScript | 5.x |
| **Runtime** | Node.js | v24.13.0 |
| **Styling** | Tailwind CSS | v4.2 (PostCSS, `@variant`, `@theme`) |
| **3D Rendering** | Three.js | latest |
| **Database** | MS SQL Server (แยก Server) | ผ่าน `mssql` package |
| **Auth** | JWT + bcrypt | `jose` (Edge-compatible) + `bcryptjs` |
| **OCR** | Tesseract.js | `tesseract.js` |
| **QR Code** | qrcode.react | `qrcode.react` |
| **Excel/CSV** | SheetJS | `xlsx` |
| **Boxtech API** | BIC Container DB (external) | REST API v2.0 |
| **SFTP Client** | ssh2-sftp-client | `ssh2-sftp-client` |
| **Validation** | Zod | `zod` |
| **PDF Export** | jsPDF + jspdf-autotable | ฟอนต์ Sarabun (Google Fonts, embedded base64) |
| **Testing** | Jest + ts-jest | `jest` + `ts-jest` |
| **Package Manager** | npm | - |

---

## 3. การ Setup โปรเจค

### 3.1 ติดตั้ง Dependencies

```bash
cd d:\Antigravity\container-yard-system
npm install
```

### 3.2 ตั้งค่า Environment Variables

ไฟล์ `.env.local` (ที่ root ของโปรเจค):

```env
# Database (MS SQL Server — แยก Server)
DB_SERVER=192.168.110.106
DB_INSTANCE=alpha
DB_NAME=CYMS_DB
DB_USER=sa
DB_PASSWORD=<รหัsผ่าน>
DB_PORT=1433

# Authentication (JWT)
JWT_SECRET=<secret-key>
JWT_EXPIRES_IN=8h

# Application
PORT=3005
NEXT_PUBLIC_APP_NAME=CYMS
NEXT_PUBLIC_APP_TITLE=ระบบบริหารจัดการลานตู้คอนเทนเนอร์อัจฉริยะ
NEXT_PUBLIC_DEFAULT_YARD_ID=1

# Payment QR (optional; ตั้งผ่านหน้า Billing → Payment QR ได้เช่นกัน)
PROMPTPAY_ID=<phone-or-tax-id>

# File Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Boxtech API (BIC Container Database)
BOXTECH_USERNAME=<email>
BOXTECH_PASSWORD=<password>
```

### 3.3 Setup Database

```bash
# 1. สร้างฐานข้อมูล + ตาราง (14 ตาราง)
node scripts/setup-db.js

# 2. Seed ข้อมูลผู้ใช้ (5 demo accounts)
node scripts/seed-users.js

# 3. Seed สิทธิ์ (40 permissions × 6 roles — รวม reports module)
node scripts/seed-permissions.js

# 4. Seed ข้อมูลตู้ (10 zones + ~925 containers)
node scripts/seed-containers.js

# 5. สร้างตาราง StorageRateTiers + ค่าเริ่มต้น
node scripts/migrate-storage-tiers.js

# 6. สร้างตาราง EDIEndpoints + EDISendLog
node scripts/migrate-edi-endpoints.js

# 7. สร้างตาราง DemurrageRates + ค่าเริ่มต้น
node scripts/migrate-demurrage.js
```

### 3.4 รันโปรเจค

```bash
npm run dev
# เปิด http://localhost:3005
```

> หมายเหตุ: `npm run dev` ใช้ Next dev server แบบ Webpack (`next dev --webpack -p 3005`) เป็นค่าเริ่มต้น เพื่อลด runtime overlay จาก Turbopack HMR cache/stale module ระหว่างพัฒนา 3D Yard; ถ้าต้องการทดสอบ Turbopack ให้ใช้ `npm run dev:turbo` แยกต่างหาก

### 3.5 บัญชีทดสอบ

| Username | Password | บทบาท | สิทธิ์ |
|----------|----------|-------|--------|
| `admin` | `admin123` | ผู้ดูแลระบบ | ทุกเมนู |
| `gate01` | `gate123` | พนักงานประตู | Gate In/Out |
| `survey01` | `survey123` | ช่างตรวจ | Survey, M&R |
| `driver01` | `driver123` | คนขับรถยก | RS Driver |
| `billing01` | `billing123` | บัญชี | Billing |

---

## 4. โครงสร้างโปรเจค

```
container-yard-system/
├── .env.local                    # ค่า config (DB, JWT, App)
├── scripts/
│   ├── setup-db.js               # สร้าง DB + 14 ตาราง
│   ├── seed-users.js             # Seed 5 demo users
│   ├── seed-permissions.js       # Seed 33 permissions × 6 roles (incl. customers module)
│   ├── seed-containers.js        # Seed 10 zones + 925 containers
│   ├── migrate-storage-tiers.js  # สร้างตาราง StorageRateTiers + ค่าเริ่มต้น 4 ขั้น
│   ├── migrate-edi-endpoints.js  # สร้างตาราง EDIEndpoints + EDISendLog (SFTP config)
│   ├── migrate-edi-schedule.js   # **เพิ่ม schedule columns** (schedule_enabled, schedule_cron, schedule_last_run, schedule_yard_id)
│   ├── migrate-edi-templates.js  # **📋 สร้างตาราง EDITemplates** + seed 3 default templates + เพิ่ม template_id ใน EDIEndpoints
│   ├── migrate-demurrage.js      # สร้างตาราง DemurrageRates + default rates
│   └── update-cedex-thai.js      # **🌐 อัปเดต CEDEX codes เป็นภาษาไทย** (29 codes)
│
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout (fonts, providers)
│   │   ├── page.tsx              # Root redirect (→ login or dashboard)
│   │   ├── globals.css           # Tailwind v4 + @variant dark + high-contrast theme
│   │   ├── login/
│   │   │   └── page.tsx          # หน้า Login (glassmorphism)
│   │   │
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx        # Dashboard layout (sidebar + topbar + auth check + **global fetch interceptor**)
│   │   │   ├── dashboard/page.tsx   # หน้า Dashboard (KPI cards: ตู้/อัตราเต็ม/Gate-In/Gate-Out/รายได้)
│   │   │   ├── yard/page.tsx     # หน้าจัดการลาน (4 tabs: ภาพรวม/ค้นหา/จัดวางตู้/ตรวจนับ) + **Dwell Days column** + **7 summary cards (incl. Overdue + Avg Dwell)**
│   │   │   ├── gate/
│   │   │   │   ├── page.tsx          # **🧩 Orchestrator** (95 lines) — tab switching + EIR modal + Timeline modal
│   │   │   │   ├── types.ts          # Shared types (Transaction, ContainerResult, BillingCharge, BillingData, BillingClearance, GateOutBooking) + CSS constants
│   │   │   │   ├── GateInTab.tsx     # Gate-In: auto-allocation + **ISO 6346 check digit** + **Boxtech auto-fill** + **prefix→customer** + billing + **Billing Clearance** + inspection + OCR + guided workflow panel
│   │   │   │   ├── GateOutTab.tsx    # Gate-Out: **2-Phase workflow** (ขอดึง → รอรถยก → ปล่อยออก) + billing + payment + **Booking Picker/Summary** + **Billing Clearance** + guided workflow panel
│   │   │   │   ├── HistoryTab.tsx    # ประวัติ Gate: search + date filter + pagination + **Excel export**
│   │   │   │   └── TransferTab.tsx   # ย้ายข้ามลาน: send transfer + receive in-transit
│   │   │   ├── operations/page.tsx # หน้าปฏิบัติการ (3 tabs: Job Queue/สร้างงาน/Shifting)
│   │   │   ├── edi/page.tsx      # หน้า EDI (4 tabs: Bookings/นำเข้า/ตรวจซีล/CODECO)
│   │   │   ├── mnr/page.tsx      # หน้า M&R (3 tabs: EOR/สร้าง EOR/รหัสความเสียหาย) + **actual_cost modal + notes field + user_id tracking**
│   │   │   ├── supervisor-review/page.tsx # Supervisor approval inbox + approve/reject review workflow
│   │   │   ├── billing/
│   │   │   │   ├── page.tsx              # หน้าบัญชี orchestrator (tabs + data fetch + modal state)
│   │   │   │   ├── BillingClearanceTab.tsx # Clearance audit UI + No Charge/Waived/Credit control list
│   │   │   │   ├── BillingReports.tsx    # Daily/monthly billing report + control report + PDF/Excel export
│   │   │   │   ├── CreditControlTab.tsx   # Customer credit limit/overdue/hold monitor
│   │   │   │   ├── ARAgingTab.tsx         # AR Aging report by customer
│   │   │   │   ├── ARDunningPanel.tsx     # AR dunning action center + reminder draft copy
│   │   │   │   ├── TariffSimulatorPanel.tsx # Billing tariff preview/simulation before saving rates
│   │   │   │   ├── billingTypes.ts        # Shared billing UI types
│   │   │   │   ├── billingUi.ts           # Shared billing labels/badges/export lazy loader
│   │   │   │   └── DemurrageTab.tsx       # **Demurrage Calculator** — overview + risk cards + editable rates + per-container calculator + timeline
│   │   │   └── settings/
│   │   │       ├── page.tsx              # หน้าตั้งค่า (12 tabs, รวม Rate Limit)
│   │   │       ├── CompanySettings.tsx    # CRUD ข้อมูลองค์กร (+ logo upload + branch)
│   │   │       ├── YardsSettings.tsx      # CRUD ลาน + โซน (+ branch สำนักงานใหญ่/สาขา)
│   │   │       ├── CustomerMaster.tsx     # **🏢 CRUD ลูกค้า Multi-role** (checkbox roles + branch manager + EDI prefix + customer_code display)
│   │   │       ├── UsersSettings.tsx      # CRUD ผู้ใช้งาน + unlock/reset trusted device binding
│   │   │       ├── SecuritySettings.tsx   # Password policy + account lockout + TOTP 2FA + trusted device policy
│   │   │       ├── PermissionsMatrix.tsx  # Permission Matrix (33×6 incl. customers)
│   │   │       ├── ApprovalHierarchy.tsx  # ลำดับชั้นอนุมัติ + วงเงิน
│   │   │       ├── EDIConfiguration.tsx   # SFTP/FTP/API/**Email** endpoints — CRUD + **⏰ Auto-Schedule UI** + **📋 Template Editor** (2-tab layout, **drag-and-drop** field mapping, live preview)
│   │   │       ├── SealMaster.tsx         # ประเภทซีล + prefix
│   │   │       ├── TieredStorageRate.tsx  # อัตราค่าฝากขั้นบันได
│   │   │       ├── AutoAllocationRules.tsx # 9 กฎจัดตู้อัตโนมัติ — **เชื่อม DB จริง** (fetch/save via `/api/settings/allocation-rules`)
│   │   │       ├── EquipmentRulesConfig.tsx # 8 กฎเครื่องจักร
│   │   │       ├── PrefixMapping.tsx       # **Prefix→Customer mapping** (จับคู่ BIC prefix กับลูกค้า)
│   │   │       └── RateLimitSettings.tsx   # **🔐 Rate Limit Settings** — toggle เปิด/ปิด + กำหนดค่า + สถิติ real-time
│   │   │
│   │   ├── billing/
│   │   │   └── print/
│   │   │       ├── page.tsx          # หน้าพิมพ์ A4 ใบแจ้งหนี้/ใบเสร็จ (standalone, ไม่มี sidebar)
│   │   │       └── report/
│   │   │           └── page.tsx      # **หน้าพิมพ์รายงานประจำวัน/ประจำเดือน** (A4, auto-print)
│   │   │
│   │   ├── eir/
│   │   │   └── [id]/
│   │   │       ├── page.tsx          # หน้าสาธารณะ EIR (QR scan target, ไม่ต้อง login)
│   │   │       └── EIRPublicView.tsx # Client component แสดงข้อมูล + รูปถ่ายความเสียหาย HD
│   │   │
│   │   └── api/
│   │       ├── auth/login/route.ts         # POST login → JWT + **🔐 Rate limit: 5 req/15min per IP** + TOTP challenge + trusted device enforcement
│   │       ├── auth/2fa/route.ts           # GET/POST TOTP 2FA status/setup/verify/disable
│   │       ├── auth/me/route.ts            # GET session restore — ตรวจ token จาก x-cyms-token header (proxy) หรือ cookie → ดึง user+role+yards จาก DB
│   │       ├── boxtech/route.ts           # **GET Boxtech proxy** (token cache + BIC + container lookup + prefix→customer)
│   │       ├── containers/
│   │       │   ├── route.ts               # GET/POST/PUT (dynamic fields) + position check
│   │       │   ├── detail/route.ts        # GET container detail + gate-in/out + damage_report + dwell days
│   │       │   └── timeline/route.ts      # **GET container timeline** — merged events from GateTransactions + AuditLog + Invoices
│   │       ├── gate/
│   │       │   ├── route.ts                # GET/POST gate transactions + **auto-allocation** + billing_clearance_id validation/link
│   │       │   ├── eir/route.ts            # GET EIR data (+ condition/grade/company info)
│   │       │   └── transfer/route.ts       # POST inter-yard transfer
│   │       ├── uploads/route.ts            # POST photo/logo upload (base64 → file → URL)
│   │       ├── notifications/route.ts      # GET activity feed (gate + work orders)
│   │       ├── operations/
│   │       │   ├── route.ts                # GET/POST/PUT work orders
│   │       │   ├── stream/route.ts         # **GET SSE stream** — real-time work order updates (polls DB every 5s)
│   │       │   └── shift/route.ts          # POST smart shifting (LIFO)
│   │       ├── edi/
│   │       │   ├── bookings/route.ts       # GET/POST/PUT bookings
│   │       │   ├── validate/route.ts       # POST seal cross-validation
│   │       │   ├── codeco/route.ts         # **GET CODECO outbound** — shared `ediFormatter` + optional `?template_id=X`
│   │       │   ├── codeco/send/route.ts    # **POST send** — reads template from endpoint config → **SFTP or Email**
│   │       │   ├── endpoints/route.ts      # **GET/POST/PUT/DELETE** EDI endpoint settings + **template_id** (DB CRUD)
│   │       │   ├── templates/route.ts      # **📋 GET/POST/PUT/DELETE** EDI Templates CRUD (system template protection + FK check)
│   │       │   └── schedule/route.ts       # **GET/PUT/POST** EDI schedule management + cron reload
│   │       ├── mnr/route.ts                    # GET/POST/PUT repair orders (EOR) — **Zod validation + logAudit + notes/created_by + reject→in_yard**
│   │       ├── mnr/cedex/route.ts               # GET/POST/PUT/DELETE CEDEX codes
│   │       ├── billing/
│   │       │   ├── tariffs/route.ts        # GET/POST/PUT tariffs
│   │       │   ├── invoices/route.ts       # GET/POST/PUT invoices + Hold/Release + notes (charges JSON)
│   │       │   ├── gate-check/route.ts     # POST Gate-Out billing — tiered per-size rates + fallback Tariff
│   │       │   ├── gate-in-check/route.ts  # **POST Gate-In billing** — per-container charges (LOLO, gate fee) + prefix→customer credit check
│   │       │   ├── clearance/route.ts      # **POST Billing Clearance** — paid/credit/no_charge/waived evidence before EIR
│   │       │   ├── payment-qr/route.ts     # **GET PromptPay QR** — fixed-amount EMV QR payload per invoice
│   │       │   ├── payment-settings/route.ts # **GET/PUT PromptPay settings** — SystemSettings `payment_promptpay`
│   │       │   ├── auto-calculate/route.ts # POST auto-billing (dwell time + tariff)
│   │       │   ├── erp-export/route.ts     # GET ERP export (CSV/JSON debit-credit) — **fixed: getDb() + date format DD/MM/YYYY HH:mm + customer credit/branch data**
│   │       │   ├── reports/route.ts         # **GET billing reports** — daily/monthly KPIs, charge breakdowns, top customers
│   │       │   ├── ar-aging/route.ts        # **GET AR Aging report** — ยอดค้างชำระแยกตามอายุ (current/30/60/90+ วัน) + แยกตามลูกค้า
│   │       │   ├── dunning-actions/route.ts # POST AR dunning contact/promise-to-pay audit log
│   │       │   └── demurrage/route.ts      # **GET/POST/PUT demurrage** — overview, single calc, rates CRUD
│   │       ├── portal/
│   │       │   ├── overview/route.ts        # Customer KPIs + recent gate activity
│   │       │   ├── containers/route.ts      # Customer inventory: summary/search/status + booking/EIR/invoice context via PortalEntityAccess
│   │       │   ├── invoices/route.ts        # Portal invoices + AR summary via invoice grants + visibility_role
│   │       │   ├── statement/route.ts       # Statement/AR aging summary via invoice grants
│   │       │   ├── bookings/route.ts        # Bookings + progress + ETA/empty-return metadata via booking grants + visibility_role
│   │       │   ├── bookings/detail/route.ts # Booking detail + container/EIR drilldown via booking grants
│   │       │   ├── reefer/route.ts           # Portal read-only RF temperature tracking via PortalEntityAccess
│   │       │   ├── eir/route.ts             # Portal-scoped EIR JSON for A5 modal + inspection panel via gate/container grants
│   │       │   ├── eir-pdf/route.ts         # Portal-scoped EIR PDF via gate/container grants
│   │       │   ├── invoice-pdf/route.ts     # Portal-scoped invoice/receipt/CN PDF via invoice grants
│   │       │   ├── document-bundle/route.ts # ZIP bundle: statement + invoice/EIR download index via grants
│   │       │   ├── disputes/route.ts        # POST invoice dispute request via invoice grants
│   │       │   └── grants/reconcile/route.ts # Admin preview/repair PortalEntityAccess grants
│   │       ├── reports/
│   │       │   ├── dwell/route.ts           # **📊 GET Container Dwell Report** — by shipping line (avg/max/min dwell) + overdue list (>${overdueDays}d) + distribution buckets (7/14/30d)
│   │       │   ├── mnr/route.ts             # **📊 GET M&R Report** — EOR summary KPIs + by status + 6-month trend + full EOR list with date range filter
│   │       │   └── reconciliation/route.ts  # **Action Center** — issue checks + row deep links/SLA + PATCH resolve/ignore
│   │       ├── search/route.ts              # **GET global search** — containers + gate history + invoices + bookings for Topbar quick jump
│   │       ├── reefer/
│   │       │   ├── checks/route.ts          # GET RF check queue + POST temperature/photo evidence
│   │       │   ├── exceptions/route.ts      # GET/PATCH reefer exception workflow (acknowledge/resolve/ignore/reopen)
│   │       │   └── policies/route.ts        # GET/POST configurable reefer check intervals/thresholds
│   │       ├── __tests__/                   # **🧪 API Integration Tests** — covers containers, mnr, reports, gate, billing, auth/2FA, no-runtime-DDL, portal, search
│   │       │   ├── containers.test.ts       # GET (list, position check, filters) + POST (create, UNIQUE)
│   │       │   ├── mnr.test.ts              # GET + POST (create EOR) + PUT (approve/reject/complete/404)
│   │       │   ├── reports.test.ts          # GET /reports/dwell + GET /reports/mnr + reconciliation action-center GET/PATCH
│   │       │   ├── gate.test.ts             # GET (list, date/search filter)
│   │       │   ├── billing.test.ts          # GET (list+stats) + POST (VAT calc) + PUT (pay/issue/cancel)
│   │       │   ├── auth-login.test.ts       # Login 2FA challenge + valid TOTP session creation
│   │       │   ├── auth-device-binding.test.ts # Login trusted-device auto-bind + mismatch rejection
│   │       │   ├── payment-qr.test.ts       # PromptPay QR endpoint + missing config guard
│   │       │   ├── settings-users-device-binding.test.ts # Admin reset trusted-device binding action
│   │       │   ├── auth-2fa.test.ts         # 2FA status/setup/verify validation
│   │       │   ├── component-boundaries.test.ts # Static guard: billing tabs must stay in focused component files
│   │       │   ├── portal-features.test.ts  # Portal dispute API + document bundle ZIP API
│   │       │   ├── portal-bookings.test.ts  # Portal booking API grant-based access policy
│   │       │   └── search.test.ts           # GET global search aggregation + yard filter + short query guard
│   │       ├── settings/
│   │       │   ├── company/route.ts        # GET/POST company profile (+ branch + logo URL)
│   │       │   ├── customers/route.ts      # **GET/POST/PUT/DELETE customers** — Multi-role boolean flags + auto customer_code + CustomerBranches CRUD + legacy migration
│   │       │   ├── users/route.ts          # GET/POST/PUT users
│   │       │   ├── yards/route.ts          # GET/POST/PUT/DELETE yards (+ branch auto-migrate)
│   │       │   ├── zones/route.ts          # GET/POST/PUT/DELETE zones
│   │       │   ├── permissions/route.ts    # GET/PUT permission matrix
│   │       │   ├── storage-rates/route.ts  # GET/POST tiered storage rates (per-size pricing)
│   │       │   ├── prefix-mapping/route.ts # **GET/POST/DELETE** prefix→customer mapping
│   │       │   ├── rate-limit/route.ts    # **🔐 GET/PUT** Rate Limit settings (toggle + config + stats)
│   │       │   └── allocation-rules/route.ts # **🏗️ GET/PUT** Auto-Allocation Rules (9 rules JSON → SystemSettings)
│   │       └── yard/
│   │           ├── stats/route.ts          # GET yard statistics
│   │           ├── allocate/route.ts       # POST auto-allocation (+ size_restriction)
│   │           ├── audit/route.ts          # GET/POST yard audit
│   │           └── audit-log/route.ts     # GET/POST audit history log
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx       # Left sidebar (collapsible + role-based menus + **สเมนู 'รายงาน' /reports BarChart3 icon**)
│   │   │   └── Topbar.tsx        # Top header (**global search**, real yard switcher, **offline outbox**, **notification bell**, dark/high-contrast toggle)
│   │   ├── offline/
│   │   │   └── OfflineOutbox.tsx # Queue monitor with queued/conflict/synced filters + retry/discard
│   │   ├── providers/
│   │   │   ├── AuthProvider.tsx  # Auth context (login/logout/session + TOTP challenge response + browser device id)
│   │   │   └── ToastProvider.tsx # Toast notifications (success/error/warning/info)
│   │   ├── ui/
│   │   │   └── ConfirmDialog.tsx     # **🎨 Custom ConfirmDialog** — reusable modal (danger/warning/info variants, backdrop blur, Escape key, auto-focus cancel)
│   │   ├── yard/
│   │   │   ├── YardViewer3D.tsx      # Three.js 3D yard viewer (+ X-Ray highlight + floating label)
│   │   │   ├── BayCrossSection.tsx   # Bay Cross-Section view (Row×Tier grid per bay) + **Dwell Days tooltip**
│   │   │   ├── ContainerSearch.tsx   # Instant search + detail panel + photos + EIR link + **Dwell Days badge**
│   │   │   ├── ContainerCardPWA.tsx  # Mobile card view + **Dwell Days badge**
│   │   │   ├── ContainerDetailModal.tsx  # Container detail modal (SVG inspection, photos, actions)
│   │   │   ├── YardPlanningPanel.tsx # Slot aging heatmap + move/release/congestion forecast panel + create WO action
│   │   │   └── YardAudit.tsx         # Audit checklist per zone/bay
│   │   ├── containers/
│   │   │   └── ContainerTimeline.tsx   # **Container Tracking Timeline** — visual vertical timeline (Gate-In→Move→Hold→Repair→Gate-Out)
│   │   ├── portal/
│   │   │   └── PortalInspectionModal.tsx # Customer Portal read-only inspection: 6-side SVG, damage points, photo evidence
│   │   └── gate/
│   │       ├── EIRDocument.tsx         # EIR A5 landscape print (physical 202×140mm area, readable print text, Portal, QR, condition, grade, signatures)
│   │       ├── ContainerInspection.tsx  # 6-side SVG damage marking + photo + grade
│   │       ├── GateWorkflowPanel.tsx    # Guided checklist/exception panel for Gate-In and Gate-Out
│   │       ├── GateDecisionBar.tsx      # Sticky billing/booking/evidence/supervisor decision summary
│   │       ├── GateGuardrailPanel.tsx   # Gate QR pass + duplicate seal/plate + driver/photo guardrails
│   │       ├── CameraOCR.tsx            # **📷 Full-screen PWA Camera OCR** — pre-warmed Tesseract worker, crop zone, smart container extraction (`extractContainerNumber` 4-strategy), confidence scoring, torch toggle, scan overlay, `loadedmetadata` race condition fix, `mode` prop (container/plate/seal/generic)
│   │       ├── PhotoCapture.tsx         # Camera/upload photo → **auto-upload to server** (URL, not base64)
│   │       └── SignaturePad.tsx         # Canvas digital signature pad
│   │
│   ├── types/
│   │   ├── index.ts             # Shared TypeScript interfaces
│   │   └── mssql.d.ts           # mssql type declaration
│   │
│   └── lib/
│       ├── db.ts                 # MS SQL connection pool (mssql, useUTC: false)
│       ├── auth.ts               # JWT create/verify functions
│       ├── totp.ts               # RFC 6238 TOTP helper (secret generation, verify window, otpauth URI)
│       ├── deviceBinding.ts      # Trusted browser device policy + id validation (uses legacy bound_device_mac column)
│       ├── promptPay.ts          # PromptPay EMV QR payload builder + CRC16 validation
│       ├── approvalInbox.ts      # Supervisor approval inbox priority/SLA/exposure builder
│       ├── arDunning.ts          # AR dunning stage/action/reminder draft + contact audit detail builder
│       ├── billingTariffSimulator.ts # Billing tariff preview math for per-day/per-container/fixed rates
│       ├── gateWorkflow.ts       # Gate-In/Out workflow step + exception + decision signal model used by guided UI
│       ├── gateOperationalGuardrails.ts # QR gate pass, duplicate seal/plate warning, driver/photo completeness model
│       ├── reconciliationActions.ts # Reports action-center row decoration, deep links, SLA aging, resolved/ignored filtering
│       ├── utils.ts              # formatDateTime, formatTime, **calcDwellDays** (Calendar Days +1), etc.
│       ├── containerValidation.ts # **ISO 6346 check digit** validation + size/type parser + **`extractContainerNumber()` (4-strategy OCR smart extraction)** + `extractTruckPlate()`
│       ├── offlineQueue.ts       # NFR1: IndexedDB offline queue + auto-sync + queued/synced/conflict metadata
│       ├── yardPlanning.ts       # Yard planning snapshot: slot aging risk, move recommendations, release/congestion forecast
│       ├── rateLimit.ts          # **🔐 Rate limiter** — in-memory per-IP, DB-backed config (login/API/upload)
│       ├── validators.ts         # **🔐 Zod schemas** — container numbers, gate, invoices, users, customers, EDI
│       ├── apiAuth.ts            # **🔐 withAuth() wrapper** — JWT + rate limiting + role-based access
│       ├── authFetch.ts          # **🔐 Client auth fetch** — auto-attach Bearer token + 401 redirect
│       ├── audit.ts              # **🔐 Centralized logAudit()** — non-fatal AuditLog INSERT
│       ├── eirPayload.ts         # Shared EIR payload builder: damage_report parse, condition/grade, company, lifecycle
│       ├── portalEntityAccess.ts # Non-fatal upsert helper for PortalEntityAccess grants
│       ├── portalAccess.ts       # Customer Portal access grants SQL helpers + visibility reason subquery
│       ├── portalContainerSummary.ts # Shared Portal container KPI buckets (total/in-yard/released/hold/repair)
│       ├── portalGrantReconciler.ts # Admin preview/repair missing/stale PortalEntityAccess grants
│       ├── portalBooking.ts      # Customer Portal booking ETA + empty-return instruction helpers
│       ├── reeferMonitoring.ts   # Reefer policy priority, due/overdue, and temperature status helpers
│       ├── reeferExceptions.ts   # Reefer exception draft + workflow transition helpers
│       ├── portalDocumentBundle.ts # Statement/invoice/EIR bundle index entries
│       ├── zipArchive.ts         # Small no-dependency ZIP writer for portal bundles
│       ├── ediFormatter.ts       # **📋 Shared CODECO formatter** — template-based CSV/JSON/EDIFACT (field mapping, headers, date format, delimiter)
│       ├── schema.sql            # SQL schema reference (incl. PortalEntityAccess)
│       └── __tests__/            # **🧪 Unit Tests** (Jest + ts-jest)
│           ├── containerValidation.test.ts  # ISO 6346 check digit + validation + parseSizeTypeCode (20 tests)
│           ├── utils.test.ts               # formatContainerNumber + status colors/labels (24 tests)
│           ├── validators.test.ts          # Zod schemas — gate, billing, users, customers (multi-role), EDI (60 tests)
│           ├── auth.test.ts                # JWT round-trip + tamper detection + role labels (16 tests)
│           ├── totp.test.ts                # RFC 6238 compatibility + verify window + otpauth URI
│           ├── deviceBinding.test.ts       # policy role matching + device id validation
│           ├── promptPay.test.ts           # PromptPay payload format + fixed amount + CRC
│           ├── approvalInbox.test.ts       # Supervisor inbox SLA/risk/exposure prioritization
│           ├── arDunning.test.ts           # AR dunning stage/action/reminder draft generation
│           ├── billingTariffSimulator.test.ts # Tariff simulator math + dwell scenarios
│           ├── gateWorkflow.test.ts        # Gate guided workflow status + exception + decision signal rules
│           ├── gateOperationalGuardrails.test.ts # QR pass + duplicate seal/plate + evidence guardrails
│           ├── reconciliationActions.test.ts # Reconciliation action row keys + deep links + status overlay
│           ├── offlineQueue.test.ts        # Offline queue request classification + outbox retry/conflict/clear helpers
│           ├── yardPlanning.test.ts        # Slot aging heatmap, move recommendation, WO target slot, release forecast
│           ├── portalEntityAccess.test.ts  # PortalEntityAccess upsert helper + non-fatal failure
│           ├── portalGrantReconciler.test.ts # PortalEntityAccess preview/repair source-of-truth SQL
│           ├── portalBooking.test.ts       # Portal ETA status + empty-return instruction helpers
│           ├── portalDocumentBundle.test.ts # Bundle entries + ZIP archive smoke test
│           └── rateLimit.test.ts            # store clearing + stats + client IP extraction (14 tests)
│
├── src/proxy.ts                  # **🔐 Next.js 16 Proxy** (เดิมคือ middleware.ts) — JWT enforcement ทุก /api/ + page guard + cookie→x-cyms-token forwarding
└── package.json
```

---

## 5. Database Schema

### ตาราง (14 ตาราง)

| ตาราง | คอลัมน์หลัก | หน้าที่ |
|-------|------------|--------|
| `CompanyProfile` | name, address, tax_id, logo_url (MAX), **branch_type, branch_number** | ข้อมูลบริษัท |
| `Yards` | yard_name, address, lat/lng, status, **branch_type, branch_number** | สาขาลาน |
| `YardZones` | zone_name, zone_type, max_bay/row/tier, **plug_capacity** | โซนในลาน + จำนวนปลั๊ก reefer จริงต่อ zone |
| `Roles` | role_name, description | บทบาท (6 roles) |
| `Permissions` | module, action, description | สิทธิ์ (รวม reefer.check.read / reefer.check.record / reefer.policy.manage) |
| `RolePermissions` | role_id, permission_id | Permission matrix |
| `Users` | username, password_hash, role_id, status, **two_fa_enabled, two_fa_secret, two_fa_confirmed_at, bound_device_mac, notif_last_read_at** | ผู้ใช้งาน + TOTP 2FA + trusted browser device id (`bound_device_mac` เป็นชื่อ legacy ไม่ใช่ MAC จริง) + timestamp อ่านแจ้งเตือนล่าสุด |
| `UserYardAccess` | user_id, yard_id | สิทธิ์เข้าถึงลาน |
| `ApprovalHierarchy` | approver_id, level | สายอนุมัติ |
| `Containers` | container_number, size, type, status, zone/bay/row/tier, **is_soc** (BIT, SOC=ตู้ลูกค้า), **container_owner_id** (FK→Customers) | ตู้คอนเทนเนอร์ + SOC/COC |
| `Customers` | customer_code (auto-gen `CUST-XXXXX`), customer_name, **is_line, is_forwarder, is_trucking, is_shipper, is_consignee** (Boolean flags), tax_id, address, billing_address, contact_name/phone/email, **default_payment_type** (CASH/CREDIT), credit_term, **edi_prefix** (บังคับเมื่อ is_line=1), is_active | ลูกค้า — **Multi-role** (1 บริษัท = หลายบทบาท) |
| `CustomerBranches` | customer_id (FK), branch_code (default '00000'), branch_name, billing_address, contact_name/phone/email, is_default, is_active | **สาขาลูกค้า** — หลายสาขาต่อ 1 บริษัท |
| `PortalEntityAccess` | customer_id, entity_type, entity_id/entity_ref, access_role, source_table/source_id, is_active | Source-of-truth สำหรับ Customer Portal visibility ต่อ `container` / `booking` / `gate_transaction` / `invoice` |
| `ReeferCheckPolicies` | scope_type, yard/customer/booking/container id, interval_hours, grace, min/max °C, is_active | Policy รอบตรวจตู้เย็นแบบ priority: container > booking > customer > yard > default |
| `ReeferTemperatureChecks` | container_id, booking_id, yard_id, customer_id, measured/set/supply/return °C, status, photo_url, checked_by | ประวัติการตรวจอุณหภูมิตู้ RF พร้อมรูปหลักฐานและ policy snapshot |
| `ReeferExceptions` | check_id, container_id, severity, status, reason, recommended_action, resolution_note, acknowledged/resolved user/time | Workflow ปิด loop เมื่ออุณหภูมินอกช่วง อ่านค่าไม่ได้ หรือไฟ/ปลั๊กมีปัญหา |
| `ISOContainerCodes` | iso_code, description | รหัส ISO ตู้ |
| `DocumentFormats` | doc_type, prefix, running_number | เลขเอกสาร |
| `GateTransactions` | container_id, transaction_type, driver_name, truck_plate, eir_number, **container_owner_id** (FK→Customers), **billing_customer_id** (FK→Customers), **billing_clearance_id** | บันทึก Gate In/Out — **แยกเจ้าของตู้/คนจ่ายเงิน** + ผูกหลักฐาน Billing Clearance ก่อนออก EIR |
| `WorkOrders` | container_id, order_type, from/to positions, priority, status | คำสั่งงานรถยก |
| `Bookings` | booking_number, booking_type, vessel_name, container_count, seal_number | Booking/Manifest |
| `RepairOrders` | eor_number, container_id, damage_details, estimated_cost, status | ใบซ่อม EOR |
| `Tariffs` | charge_type, rate, unit, free_days | อัตราค่าบริการ (LOLO, gate, etc.) |
| `StorageRateTiers` | tier_name, from_day, to_day, rate_20, rate_40, rate_45, sort_order, **customer_id** (FK→Customers, NULL=ค่าเริ่มต้น), **cargo_status** ('laden'/'empty'/'any') | อัตราค่าฝากตู้ขั้นบันได — **รองรับ rate เฉพาะลูกค้า + แยก Laden/Empty** |
| `DemurrageRates` | yard_id, customer_id, charge_type, free_days, rate_20/40/45, description, is_active | **อัตราค่า Demurrage/Detention** (แยกจาก Storage — ค่าปรับสายเรือ) |
| `Invoices` | invoice_number, customer_id, charge_type, grand_total, status, **notes (JSON charges)**, **balance_amount, receipt_number** | ใบแจ้งหนี้ + ยอดคงเหลือหลังรับชำระ/ลดหนี้ + เลขใบเสร็จเมื่อ paid |
| `BillingStatements` | statement_number, yard_id, customer_id, period_from/to, due_date, total/vat/grand_total, status, issued_by_user_id | เอกสารวางบิลรวมแบบ batch สำหรับลูกค้าเครดิต |
| `BillingStatementLines` | statement_id, invoice_id, line_number, line_total | รายการ invoice ที่ถูก lock เข้า statement |
| `BillingPayments` | payment_number, receipt_number, yard_id, customer_id, amount, payment_method/ref, status, received_by_user_id | เอกสารรับชำระเงิน + เลขใบเสร็จ |
| `BillingPaymentAllocations` | payment_id, invoice_id, allocated_amount, balance_after | กระจายยอดรับชำระเข้า invoice รองรับจ่ายบางส่วน/หลายใบ |
| `BillingClearances` | yard_id, transaction_type, container_id/container_number, customer_id, **clearance_type** (`paid`/`credit`/`no_charge`/`waived`), original_amount, final_amount, reason, invoice_id, approved_by, charges | หลักฐานว่า Gate In/Out เคลียร์ billing แล้วก่อนออก EIR |
| `AuditLog` | user_id, action, details, timestamp | บันทึกการใช้งาน |
| `PrefixMapping` | **prefix_code** (4 chars), **customer_id** (FK→Customers), **is_primary** (BIT), notes, UNIQUE(prefix_code, customer_id) | จับคู่ BIC prefix กับลูกค้า — **1:N (Halt Rule popup เมื่อ prefix มีหลายเจ้าของ)** |
| `EDIEndpoints` | name, shipping_line, type (sftp/ftp/api/**email**), host, port, username, password, remote_path, format, is_active, last_sent_at, last_status, **schedule_enabled**, **schedule_cron**, **schedule_yard_id**, **schedule_last_run**, **template_id** (FK→EDITemplates) | **ตั้งค่า endpoints สำหรับส่ง EDI + ⏰ Auto-Schedule + 📋 Template** |
| `EDISendLog` | endpoint_id (FK), message_type, filename, record_count, status (pending/sent/failed), error_message, sent_at | **ประวัติการส่ง EDI ทุกครั้ง** |
| `EDITemplates` | template_name, base_format (csv/json/edifact), description, **field_mapping** (JSON), csv_delimiter, date_format, edifact_version, edifact_sender, **is_system**, is_active | **📋 Template config สำหรับ CODECO format** — field order/rename/toggle, date format, delimiter |
| `SystemSettings` | **setting_key** (UNIQUE), **setting_value**, **updated_at** | **🔐 ค่าตั้งระบบ** (rate limit toggle/config) |

### Zone Types

| Type | ตัวอย่าง | ข้อจำกัด |
|------|---------|----------|
| `dry` | Zone A, B, C | ตู้ทั่วไป, max tier 4-5 |
| `reefer` | Zone R1 | ตู้เย็นเท่านั้น, มีปลั๊ก และตั้ง `plug_capacity` เป็นจำนวนปลั๊กจริงได้ |
| `hazmat` | Zone H | ตู้อันตราย, max tier 2 |
| `empty` | Zone E | ตู้เปล่า, max tier 6 |
| `repair` | Zone M | ตู้ซ่อม, max tier 2 |

---

## 6. API Reference

### Authentication

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/api/auth/login` | `{ username, password, totp_code?, device_id? }` | ถ้าเปิด 2FA: `{ requires_2fa: true }`; ถ้า device ไม่ตรง policy: `403`; ถ้าผ่าน: `{ token, user, yards }` + httpOnly cookie `cyms_token` |
| GET | `/api/auth/2fa` | — | `{ enabled, has_secret }` สำหรับ user ปัจจุบัน |
| POST | `/api/auth/2fa` | `{ action: 'setup' \| 'verify' \| 'disable', code? }` | setup คืน secret+otpauth URI, verify เปิดใช้งาน, disable ปิด 2FA |
| GET | `/api/auth/me` | — | `{ authenticated, session }` — restore session จาก cookie (New Tab/Refresh) |

### Containers

| Method | Endpoint | Params/Body | Response |
|--------|----------|-------------|----------|
| GET | `/api/containers` | `?yard_id=1&zone_id=&status=&search=` | `ContainerData[]` |
| GET | `/api/containers` | `?check_position=1&zone_id=X&bay=Y&row=Z&tier=W` | Conflict check — `{ conflict: {...} \| null }` |
| GET | `/api/containers/detail` | `?container_id=X` | Container + gate-in/out + damage_report + dwell_days |
| POST | `/api/containers` | `{ container_number, size, type, yard_id, zone_id, bay, row, tier, ... }` | Gate-In record |
| PUT | `/api/containers` | `{ container_id, status?, zone_id?, bay?, ... }` | **Dynamic update** — เฉพาะ fields ที่ส่งมา (ไม่ null ค่าอื่น) |

### Yard Management

| Method | Endpoint | คำอธิบาย |
|--------|----------|---------|
| GET | `/api/yard/stats?yard_id=1` | สถิติรวม + zone occupancy% |
| POST | `/api/yard/allocate` | Auto-allocation — `{ yard_id, size, type, shipping_line }` → Top 5 suggestions (+ size_restriction enforcement) |
| GET | `/api/yard/audit?zone_id=&yard_id=` | ดึงตู้สำหรับตรวจนับ |
| POST | `/api/yard/audit` | ส่งผลตรวจนับ → matched/misplaced/missing |
| GET | `/api/yard/audit-log?yard_id=&entity_type=&limit=` | ดึงประวัติ audit log |
| POST | `/api/yard/audit-log` | บันทึก audit log — `{ yard_id, action, entity_type, entity_id, details }` |

### Gate

| Method | Endpoint | คำอธิบาย |
|--------|----------|---------|
| GET | `/api/gate?yard_id=X&type=gate_in&date=today&search=` | ดึงรายการ gate transactions (date: `today` หรือ `YYYY-MM-DD`, search: เลขตู้/คนขับ/ทะเบียน/EIR) |
| POST | `/api/gate` | Gate-In/Gate-Out — `{ transaction_type, container_number, ... }` → **auto-allocate** + EIR + **auto Work Order** |
| GET | `/api/gate/eir?eir_number=X` | ดึงข้อมูล EIR (+ condition/grade/company info) |

### Uploads (File Storage)

| Method | Endpoint | คำอธิบาย |
|--------|----------|---------|
| POST | `/api/uploads` | อัปโหลดภาพ — `{ data: 'data:image/jpeg;base64,...', folder: 'photos', filename_prefix: 'photo' }` → `{ url: '/uploads/photos/2026-03/photo_xxx.jpg' }` |

### Notifications

| Method | Endpoint | คำอธิบาย |
|--------|----------|---------|
| GET | `/api/notifications?yard_id=X&limit=20&source=all` | ดึง activity feed — รวม Gate Transactions + Work Order updates, เรียงตามเวลาล่าสุด + ส่ง `last_read_at`, `unread_count`, `source_counts`, `href` ของแต่ละ notification กลับมา (ดึงจาก DB — ซิงค์ข้าม browser/device) |
| PATCH | `/api/notifications` | บันทึก read timestamp ลง DB — `{ user_id }` → `UPDATE Users SET notif_last_read_at = GETDATE()` → ส่ง `last_read_at` กลับมา |

### Operations

| Method | Endpoint | คำอธิบาย |
|--------|----------|---------|
| GET | `/api/operations?yard_id=X&status=pending` | ดึง Work Orders |
| POST | `/api/operations` | สร้าง Work Order — `{ order_type, container_id, to_zone/bay/row/tier, priority }` |
| PUT | `/api/operations` | อัปเดทสถานะ — `{ order_id, action: accept/complete/cancel }` + optional `{ to_zone_id, to_bay, to_row, to_tier }` สำหรับ position override |
| POST | `/api/operations/shift` | Smart Shifting — `{ container_id, yard_id }` → LIFO plan |

### Settings

| Method | Endpoint | คำอธิบาย |
|--------|----------|---------|
| GET/POST | `/api/settings/company` | Company profile CRUD (+ branch_type/branch_number) |
| GET/POST/PUT | `/api/settings/users` | User management |
| GET/POST/PUT/DELETE | `/api/settings/yards` | Yard management (+ branch, DELETE ตรวจตู้ก่อนลบ) |
| GET/POST/PUT/DELETE | `/api/settings/zones` | Zone management (DELETE ตรวจตู้ก่อนลบ) |
| GET/POST/PUT/DELETE | `/api/settings/customers` | **Customer CRUD** — Multi-role boolean flags (`is_line`, `is_forwarder`, `is_trucking`, `is_shipper`, `is_consignee`) + auto `customer_code` (CUST-XXXXX) + CustomerBranches + duplicate name/tax_id check + `?role=line\|trucking\|...` filter |
| GET/PUT | `/api/settings/permissions` | Permission matrix toggle (33 perms × 6 roles) |
| GET/POST | `/api/settings/storage-rates` | Tiered storage rate tiers (per-size: 20'/40'/45') |
| GET/POST/DELETE | `/api/settings/prefix-mapping` | **Prefix→Customer mapping** (prefix_code 4 chars + customer_id) |

### Billing

| Method | Endpoint | คำอธิบาย |
|--------|----------|---------|
| POST | `/api/billing/gate-check` | Gate-Out billing check — คำนวณค่าบริการจาก tiered rates (แยกราคาตามขนาดตู้) + ตรวจ paid invoices → `already_paid` flag |
| POST | `/api/billing/gate-in-check` | **Gate-In billing check** — ค่าบริการ per-container (LOLO, gate fee ฯลฯ) + ค้นลูกค้าจาก prefix→PrefixMapping → เช็ค credit_term |
| POST | `/api/billing/clearance` | **Billing Clearance ก่อนออก EIR** — บันทึกหลักฐาน `paid` / `credit` / `no_charge` / `waived`, ยอดเดิม/ยอดสุทธิ, invoice_id, reason, approved_by และ charge breakdown |
| GET/POST/PUT | `/api/billing/invoices` | CRUD ใบแจ้งหนี้ — supports `invoice_id` filter, stores charge breakdown in `notes` JSON |
| GET/POST | `/api/billing/statements` | **Billing Statement batch** — ออกเอกสารวางบิลรวมจาก invoice ค้างชำระ, lock รายการผ่าน `BillingStatementLines`, list/history สำหรับดูย้อนหลัง และพิมพ์ได้ที่ `/billing/print/statement?id=X&yard_id=Y` |
| GET/POST | `/api/billing/payments` | **Payment Allocation** — บันทึกรับชำระ, สร้าง payment/receipt number, กระจายยอดเข้า invoice และรองรับ partial payment ผ่าน `balance_amount` |
| GET | `/api/billing/payment-qr?invoice_id=X` | สร้าง PromptPay fixed-amount QR payload สำหรับ invoice ที่ยังไม่ชำระ |
| GET/PUT | `/api/billing/payment-settings` | ตั้งค่า PromptPay ID + merchant name สำหรับแสดง QR บน invoice print |
| GET/POST/PUT | `/api/billing/tariffs` | อัตราค่าบริการ (LOLO, gate, washing, etc.) |
| GET | `/api/billing/erp-export` | ERP export (CSV/JSON debit-credit) — **date: DD/MM/YYYY HH:mm, includes customer credit_term/branch/address/due_date; requires billing/report permission + yard access** |
| GET | `/api/billing/reports` | **Billing reports** — `?type=daily|monthly&date=YYYY-MM-DD&yard_id=X` → KPIs, charge breakdown, invoice list / top customers; requires billing/report permission |
| GET | `/api/billing/ar-aging` | **AR Aging report** — `?yard_id=X` → ยอดค้างชำระแยกตามอายุหนี้ (current/30/60/90+ วัน) + แยกตามลูกค้า; requires billing/report permission |
| GET | `/api/billing/demurrage?yard_id=X&mode=overview` | **Demurrage overview** — containers approaching/exceeding free days + risk levels (exceeded/warning/safe) |
| GET | `/api/billing/demurrage?yard_id=X&container_id=Y` | **Demurrage calculation** — single container charges (demurrage + detention) |
| GET | `/api/billing/demurrage?yard_id=X` | **Demurrage rates config** — ดึง rate ทั้งหมด |
| POST | `/api/billing/demurrage` | **Create demurrage rate** — `{ yard_id, charge_type, free_days, rate_20/40/45, description }` |
| PUT | `/api/billing/demurrage` | **Update/Delete rate** — `{ demurrage_id, ... }` or `{ demurrage_id, action: 'delete' }` (soft delete) |

### Boxtech API (Container Database)

| Method | Endpoint | คำอธิบาย |
|--------|----------|---------|
| GET | `/api/containers/timeline?container_id=X` | **Container Timeline** — unified events from GateTransactions + AuditLog + Invoices sorted by time |
| GET | `/api/containers/timeline?container_number=XXXX1234567` | **Container Timeline** — same, lookup by container_number |
| GET | `/api/boxtech?container_number=XXXX1234567` | Boxtech proxy — BIC code + container lookup + prefix→customer mapping → `{ shipping_line, size, type, customer, source }` |

### 📊 Gate Reports

| Method | Endpoint | คำอธิบาย |
|--------|----------|---------|
| GET | `/api/reports/gate?type=daily_in&yard_id=X&date=YYYY-MM-DD` | **Daily Gate In** — รายการตู้เข้ารายวัน + summary (total, laden, empty, 20/40/45) + byShippingLine |
| GET | `/api/reports/gate?type=daily_out&yard_id=X&date=YYYY-MM-DD` | **Daily Gate Out** — รายการตู้ออกรายวัน + summary |
| GET | `/api/reports/gate?type=summary_in&yard_id=X&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD` | **Summary Gate In** — 7 sections: KPI, สายเรือ Top 10, รายวัน, ขนาด, ประเภท, ชั่วโมง, ผู้ดำเนินการ |
| GET | `/api/reports/gate?type=summary_out&yard_id=X&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD` | **Summary Gate Out** — เหมือนกัน แต่เป็นตู้ออก |

### EDI (CODECO Outbound + SFTP/Email + Auto-Schedule + 📋 Templates)

| Method | Endpoint | คำอธิบาย |
|--------|----------|---------|
| GET | `/api/edi/codeco?yard_id=X&date_from=&date_to=&type=gate_in|gate_out&shipping_line=&format=json|csv|edifact&template_id=X` | **CODECO outbound** — generate CODECO with optional **template** (field mapping, custom headers, date format) |
| POST | `/api/edi/codeco/send` | **Send** — reads **template from endpoint config** → generate CODECO + upload via **SFTP or Email** → log results |
| GET | `/api/edi/codeco/send?endpoint_id=X` | **Send log history** — ประวัติการส่งทั้งหมด |
| GET/POST/PUT/DELETE | `/api/edi/endpoints` | **EDI endpoint CRUD** — manage configurations + **template_id** + **audit log** |
| GET/POST/PUT/DELETE | `/api/edi/templates` | **📋 EDI Template CRUD** — create/edit/duplicate/delete templates (system template protection + FK check before delete) |
| GET | `/api/edi/schedule` | **Schedule status** — ดึงสถานะ schedule ทุก endpoint |
| PUT | `/api/edi/schedule` | **Update schedule** — `{ endpoint_id, schedule_enabled, schedule_cron, schedule_yard_id }` + reload cron |
| POST | `/api/edi/schedule` | **Reload all schedules** — manual trigger เริ่ม cron ใหม่ทั้งหมด |

### 🔐 Security & Rate Limiting

| Method | Endpoint | คำอธิบาย |
|--------|----------|---------|
| GET | `/api/settings/rate-limit` | ดึงค่า Rate Limit settings (enabled, login/api/upload limits) |
| PUT | `/api/settings/rate-limit` | อัปเดตค่า Rate Limit settings (toggle + config) |
| `src/proxy.ts` | ทุก `/api/*` + protected pages | **🔐 JWT enforcement** — ตรวจ Bearer token / cookie ทุก API call, exempt: login, EIR — **uploads ต้อง login แล้ว** |
| `src/proxy.ts` | ทุก `/api/*` | **🔧 Header forwarding** — `passthrough()` อ่าน cookie `cyms_token` แล้วส่งเป็น `x-cyms-token` custom header + `x-user-id/x-user-role/x-customer-id` |
| `src/proxy.ts` | Protected pages | **🔒 Page guard** — ตรวจ cookie สำหรับ page routes (`/dashboard`, `/gate`, etc.) → redirect ไป `/login` ถ้าไม่มี/หมดอายุ |

---

## 7. ฟีเจอร์หลักที่สร้างเสร็จ

### 7.1 ระบบ Login + Auth
- หน้า Login แบบ Glassmorphism + animated background
- JWT token (8 ชม.) + bcrypt password hashing + **httpOnly cookie** (`cyms_token`)
- **Dual-layer session**: httpOnly cookie (server-side guard) + localStorage (client-side UI state)
- Auth context ผ่าน `AuthProvider` (localStorage session + **`/api/auth/me` fallback** สำหรับ New Tab/Hard Refresh)
- **Next.js 16 Proxy** (`src/proxy.ts`): ตรวจ cookie บน page routes + forward token ผ่าน `x-cyms-token` header ไปยัง API routes
- Audit log ทุกการ login

### 7.2 Dashboard
- KPI cards (ตู้ทั้งหมด, อัตราเต็ม, Gate-In วันนี้, **Gate-Out วันนี้**, รายได้วันนี้) — **5-column grid**
- **Gate-Out card** (**ใหม่**): แสดงจำนวน Gate-Out วันนี้ + เปรียบเทียบเมื่อวาน (ไอคอน DoorOpen สีแดง)
- **📈 Dashboard Charts** (Recharts): Gate Activity Bar Chart, Revenue Area Chart, Shipping Line Pie Chart, Dwell Time Distribution
- **Range Toggle**: เลือกช่วงเวลา **7 วัน / 30 วัน / 3 เดือน** — 30d/90d รวมเป็นรายสัปดาห์อัตโนมัติ
- Quick Action buttons
- Yard Status overview

### 7.3 ตั้งค่าระบบ (Settings — 11 แท็บ)
- **Company Profile**: CRUD → DB + **logo upload (local file storage → URL)** + **สาขา (สำนักงานใหญ่/สาขาที่)**
- **User Management**: CRUD + role + yard access
- **Permission Matrix**: **33 permissions × 6 roles**, toggle realtime (**รวม customers module**)
- **Yards + Zones**: CRUD + Edit/Delete → DB (ป้องกันลบหากยังมีตู้อยู่) + **สาขา (สำนักงานใหญ่/สาขาที่ + badge สี)**
- **Customer Master (🏢 Multi-role)**: CRUD ลูกค้า — **5 บทบาท checkbox** (สายเรือ/Forwarder/รถบรรทุก/ผู้ส่งออก/ผู้นำเข้า), `customer_code` auto-generate (CUST-XXXXX), เลขภาษี, ที่อยู่/ที่อยู่ออกบิล, ผู้ติดต่อ, **default_payment_type** (CASH/CREDIT), credit term, **EDI prefix** (บังคับเมื่อ is_line), **multi-branch manager** (เพิ่ม/ลบ/แก้ไขสาขา + กำหนดสาขาหลัก)
- **Approval Hierarchy**: ลำดับชั้นอนุมัติ + วงเงิน + auto-approve (ลากสลับตำแหน่ง)
- **EDI Configuration**: SFTP/FTP/API/**Email** endpoints — CRUD + **⏰ Auto-Schedule** (ความถี่ dropdown + time picker + cron presets) + **shipping line autocomplete** + แสดง last sent status/time
- **Seal Master**: ประเภทซีล + prefix + สี + บังคับถ่ายรูป
- **Tiered Storage Rate**: อัตราขั้นบันได (Free→Standard→Extended→Penalty) 20'/40'/45'
- **Auto-Allocation Rules**: 9 กฎ toggle — **เชื่อม DB จริง** (ค่าเริ่มต้นถ้าไม่มีใน DB) — แยกสายเรือ/ขนาด/ประเภท(GP/HC/RF/OT/FR/TK/DG)/LIFO/FIFO/max tier(แยก laden/empty)/กระจายตู้สม่ำเสมอ/ใกล้ประตู
- **Equipment Rules Config**: 8 กฎ toggle (shift limit, weight, cooldown, maintenance)
- **Prefix Mapping** (**ใหม่**): จับคู่ BIC prefix (4 ตัวอักษร เช่น MSCU, MEDU) กับลูกค้าในระบบ — รองรับหลาย prefix ต่อลูกค้า, auto-create table

### 7.4 จัดการลาน (Yard Management)

4 แท็บ:

#### แท็บ "ภาพรวม"
- สถิติ **7 การ์ด** (ตู้ทั้งหมด, ในลาน, ค้างจ่าย, ซ่อม, **Overdue (>30วัน)**, **Avg Dwell**, อัตราเต็ม)
  - **Overdue**: แสดงจำนวนตู้ค้างเกิน 30 วัน — สีแดงถ้ามี, สีเขียวถ้าไม่มี
  - **Avg Dwell**: ค่าเฉลี่ยจำนวนวันในลานทั้งหมด
  - คำนวณด้วย `calcDwellDays()` (Calendar Days +1)
  - **Compact mode**: เมื่ออยู่ Bay/3D/Search view การ์ด KPI จะย่อเป็นแถว compact เพื่อลดการเลื่อนก่อนถึงแผนผังลานบนจอแคบ
- **2D / Bay / 3D** toggle (3 มุมมอง)
- **2D**: Zone cards + occupancy bars
- **Yard Planning panel**: slot aging heatmap, move recommendations, daily release forecast, congestion forecast และปุ่มสร้าง Work Order จาก recommendation พร้อม target slot
- **API hardening**: `/api/yard/stats`, `GET /api/containers`, `check_position`, และ `/api/yard/allocate` บังคับ `yard_id` ที่ถูกต้อง + `requireYardAccess`; auto-allocation ไม่ fallback ไป yard 1 แล้ว และต้องมีสิทธิ์ `yard.location.assign` หรือ `yard.slot.move`
- **Bay**: (**ใหม่**) Bay Cross-Section — แสดง Row×Tier grid แยกตาม Bay + เลือก Zone + สี shipping line/status + hover tooltip + click detail + legend
- **3D**: Three.js — ตู้สมจริง (สัดส่วนจริง 20ft/40ft/45ft), toggle สีตู้ตาม `สายเรือ/สถานะ`, legend เปลี่ยนตาม color mode จริง, Hold/Repair ยังเด่นด้วยสีสถานะ, camera controls สำหรับ reset/top/focus selected container และ selected container action panel สำหรับเปิด detail/timeline/booking/billing ต่อทันที
- **Live Yard Layer**: หน้า Yard ต่อ `/api/operations/stream` ผ่าน SSE เพื่อแสดงสถานะ `Live Yard` และ refresh ข้อมูลลานอัตโนมัติเมื่อ Work Order มีการเปลี่ยนแปลง
- **PWA cache hardening**: `public/sw.js` ข้าม `/_next/` runtime/chunks ทั้งหมด และ bump cache เป็น `cyms-v3` เพื่อป้องกัน stale chunk ของ Next dev server ทำให้หน้า Yard/route ใหม่ค้างที่ loading หรือ hydrate ด้วย bundle เก่า
- ตารางตู้ + filter + search + **pagination** (25 ตู้/หน้า + ปุ่มเลขหน้า + รีเซ็ตอัตโนมัติเมื่อเปลี่ยน filter)
- **คลิกแถวตู้ → Container Detail Modal** (popup ตรงกลาง)

#### Container Detail Modal (คลิกแถวตู้)
- **ข้อมูลตู้**: เลขตู้, ขนาด/ประเภท, สายเรือ, ซีล, พิกัด, จำนวนวันในลาน
- **Gate-In**: วันที่, คนขับ, ทะเบียนรถ, เลข EIR (กดเปิด tab ใหม่)
- **แผนผังตรวจสภาพ (Read-Only SVG)**: 6 ด้าน + เกรด + จุดเสียหายกดดูรูป+รายละเอียด
- **รูปถ่าย**: gallery รูปตรวจสภาพ + จุดเสียหาย + ขาออก (กดขยายเต็มจอ)
- **Gate-Out** (ถ้ามี): วันที่, คนขับ, เลข EIR
- **Actions**: เปลี่ยนสถานะ (in_yard/hold/repair), ดู EIR

#### แท็บ "ค้นหาตู้" (Split Screen)
- **ซ้าย**: Instant search → รายชื่อ → **Detail Panel** (gate-in, เกรด, จุดเสียหาย, 📸 รูปถ่าย, ลิงก์ EIR)
- **ขวา**: 3D Viewer — **X-Ray Mode** (ตู้อื่น opacity 60%) + **Beacon สีเหลือง** + **Floating Label** (เลขตู้ + พิกัด + สายเรือ) + วงแหวนบนพื้น + กล้องซูม smooth
- **Accessibility**: ผลค้นหาแยก row select กับปุ่ม `3D` เป็น sibling buttons พร้อม `aria-label` เพื่อเลี่ยง nested button และ click behavior แปลกบน browser/assistive tech

#### แท็บ "จัดวางตู้" (Smart Auto-Allocation)
- ฟอร์มระบุตู้ (เลขตู้, ขนาด, ประเภท, สายเรือ)
- ปุ่ม "ขอแนะนำพิกัด" → เรียก API → แสดง Top 5 suggestions พร้อมคะแนน+เหตุผล
- เลือก suggestion → ยืนยันวางตู้ → Gate-In เข้าลานจริง

#### แท็บ "ตรวจนับ" (Yard Audit & Manual Override)
- เลือกโซน → Checklist แยกตาม Bay
- กดเช็กตู้ที่พบ → **ส่งผลตรวจนับจริง** ผ่าน API → สรุปผล % accuracy
- **Manual Override**: ปุ่มแก้ไขพิกัดตู้ (bay/row/tier) inline → บันทึก + audit log
- **Swap/Float**: เมื่อตู้ซ้อนทับ → modal เลือก Swap (สลับพิกัด) หรือ Float (ยกตู้เดิมออก)
- **ประวัติแก้ไข**: ดูตาราง audit log แสดง ใคร ย้ายตู้อะไร จากไหนไปไหน เมื่อไร

### 7.5 ประตู Gate (Gate In/Out)

3 แท็บ:

#### Guided Workflow Panel (✅ เสร็จ — 21 พ.ค. 2569)
- เพิ่ม `src/lib/gateWorkflow.ts` เป็น workflow model กลางสำหรับ Gate-In และ Gate-Out
- เพิ่ม `src/components/gate/GateWorkflowPanel.tsx` แสดง checklist แบบ step-by-step พร้อมสถานะ `done / active / pending / blocked`
- Gate-In แสดงลำดับ: Container check → Resolve customer → Billing clearance → Inspection evidence → Issue EIR
- Gate-Out แสดงลำดับ: Select container → Match booking → Billing clearance → Pickup request → Release and EIR
- Exception panel แจ้ง blocker สำคัญ เช่น billing hold, booking mismatch, prefix/customer conflict, missing inspection/seal photo, permission missing
- เพิ่ม `GateDecisionBar.tsx` เป็น sticky decision bar สรุป Billing / Booking / Evidence / Supervisor state พร้อม next decision สำหรับงานหน้าด่าน
- Unit test: `src/lib/__tests__/gateWorkflow.test.ts` ครอบคลุม billing blocker, ready-to-submit, booking mismatch + billing hold และ decision signals

#### Gate Operational Guardrails (✅ เสร็จ — 21 พ.ค. 2569)
- เพิ่ม `src/lib/gateOperationalGuardrails.ts` เป็น preflight model สำหรับ Gate-In/Gate-Out
- เพิ่ม `src/components/gate/GateGuardrailPanel.tsx` ใน Gate-In และ Gate-Out แสดง QR gate pass, driver/truck master completeness, photo evidence status และ preflight warnings
- โหลดประวัติ Gate วันนี้จาก `/api/gate?yard_id=...&date=today` เพื่อเตือน duplicate seal number และ truck plate ก่อนบันทึก
- Gate-In เช็กตู้ laden ที่ยังไม่มีรูปซีล และแสดงหมวดรูปตรวจสภาพที่ยังขาดจาก `photo_completeness`
- Gate-Out แนะนำรูปตู้ขาออกอย่างน้อย 2 รูปก่อน confirm release เพื่อช่วยลด dispute หลังออก EIR
- Unit test: `src/lib/__tests__/gateOperationalGuardrails.test.ts` ครอบคลุม QR payload, duplicate alert, seal/photo gap, exit photo recommendation

#### Operational Mobile Mode (✅ เสร็จ — 22 พ.ค. 2569)
- ปรับ `/mobile-ops` เป็น **PWA Quick Start** เท่านั้น ไม่ใช่ desktop module: บนมือถือ/PWA แสดงปุ่มใหญ่ไป `Gate`, `Yard`, `Reefer`, `M&R`, `Booking`, `ค้นหาตู้` โดย filter ตาม permission
- เอา `Mobile Ops` ออกจาก desktop Sidebar แล้ว; ถ้าเปิด `/mobile-ops` บน desktop จะแสดง notice ให้ใช้เมนูหลักแทน เพื่อลดความสับสนกับ module เดิม
- เพิ่ม **PWA Quick Actions** ใน `manifest.json`: `Gate In`, `Gate Out`, `Reefer Walk`, `Yard Search` และหน้า `/mobile-ops` แสดง quick tiles พร้อม `สถานะซิงค์`/`ติดตั้ง PWA` สำหรับมือถือ
- Verify: `npm test -- src/app/api/__tests__/mobile-ops-ui.test.ts --runInBand` ✅ (3 tests)

#### แท็บ "Gate-In (รับเข้า)"
- ฟอร์มกรอกข้อมูลตู้ (เลขตู้, ขนาด, ประเภท, สายเรือ, ซีล) + คนขับ/ทะเบียนรถ + Booking Ref
- กดรับตู้ → สร้าง Container + GateTransaction + **ออก EIR อัตโนมัติ**
- **Auto Allocation**: ถ้าไม่ระบุ zone → ระบบจัดพิกัด zone/bay/row/tier อัตโนมัติ
- แสดงพิกัดที่จัดให้ทันทีหลัง gate-in สำเร็จ
- **Auto Work Order**: สร้างคำสั่งย้ายตู้อัตโนมัติให้คนขับรถยก (ลำดับ: ปกติ) — notes รวม 🚛 ทะเบียนรถ + 👤 ชื่อคนขับ
- รองรับตู้ที่เคย gate-out ไปแล้วกลับเข้ามาใหม่ (re-enter)
- **ISO 6346 Check Digit Validation** (**ใหม่**):
  - ตรวจ check digit real-time เมื่อพิมพ์ครบ 11 หลัก
  - 🟢 ถูก → ขอบเขียว + "Check Digit OK"
  - 🔴 ผิด → ขอบแดง + แจ้งค่าที่ถูกต้อง + **บล็อกปุ่ม Gate-In**
- **Boxtech API Auto-Fill** (**ใหม่**):
  - เมื่อ check digit ผ่าน → เรียก Boxtech API ดึงข้อมูลสายเรือ/ขนาด/ประเภท
  - Auto-fill ช่อง shipping_line, size, type + badge "✅ Boxtech"
  - Token cache ฝั่ง server (auto-refresh)
- **Prefix → Customer Mapping** (**ใหม่**):
  - จับคู่ prefix กับลูกค้าจาก PrefixMapping table → แสดงชื่อลูกค้าทันที
- **Fallback — ตู้ prefix ไม่รู้จัก** (**ใหม่**):
  - ไม่บล็อก Gate-In — ปล่อยช่องสายเรือว่าง ให้พนักงานพิมพ์เอง
  - บันทึก `unknown_prefix_alert` ลง AuditLog → Admin เห็นเตือนไปเพิ่ม prefix
- **💰 Gate-In Billing** (**ใหม่**):
  - เมื่อ check digit ผ่าน → คำนวณค่าบริการ Gate-In อัตโนมัติ (LOLO, gate fee ฯลฯ จาก Tariffs — **ไม่รวม storage**)
  - **Billing Card**: ตารางรายการ + checkbox เลือก/ยกเลิก + แก้ไขราคาได้ + เพิ่มรายการเอง + VAT 7% + ยอดรวม
  - **เช็คเครดิตลูกค้า**: ดึง prefix 4 ตัวแรก → PrefixMapping → Customers → ตรวจ `credit_term`
    - **ลูกค้าเครดิต** → ปุ่ม "📄 วางบิล" (สร้างใบแจ้งหนี้ pending)
    - **ลูกค้าเงินสด** → เลือกวิธี (💵 เงินสด / 💳 โอน) → ปุ่ม "💰 ชำระเงิน"
  - หลังชำระ → ปุ่ม **"🖨️ พิมพ์ใบเสร็จ"** / **"🖨️ พิมพ์ใบแจ้งหนี้"**
  - **แยกปุ่มชัดเจน**: ชำระก่อน → จึงกด "รับตู้เข้าลาน + ออก EIR" (ปุ่มล็อกถ้ายังไม่ชำระ + แจ้งเตือน ⚠️)
  - ถ้าไม่มี Tariff charges หรือยอดสุทธิเป็น 0 → ต้องกด **ยืนยัน No Charge** เพื่อสร้าง Billing Clearance ก่อนออก EIR
  - ถ้าพนักงานยกเว้นรายการที่เดิมมีค่าใช้จ่ายจนยอดเป็น 0 → ต้องเลือก **Waived** และกรอกเหตุผล เพื่อเก็บ `approved_by`
  - บันทึก `processed_by` (user_id) ลง GateTransactions — แสดงชื่อผู้ดำเนินการในประวัติ
  - บันทึก `billing_clearance_id` ลง GateTransactions เพื่อผูก Gate/EIR กับหลักฐานเคลียร์เงิน
- **UX — Toast Banner**: หลัง Gate-In สำเร็จ → form reset ทันที (กรอกเลขตู้ใหม่ได้เลย) + toast banner เล็กๆ แสดง EIR number + ปุ่ม "พิมพ์ EIR" + ✕ ปิดได้ + auto-dismiss 15 วินาที

#### แท็บ "Gate-Out (ปล่อยออก)" — **2-Phase Workflow**

ขั้นตอนที่ 1 — **ขอดึงตู้**:
- ค้นหาตู้ในลาน → เลือกตู้ → กรอกคนขับ/ทะเบียน → **ชำระเงิน/วางบิลก่อน** → กดปุ่ม "ขอดึงตู้"
- **ปุ่ม "ขอดึงตู้" ล็อก** จนกว่าจะชำระเงิน (เงินสด) หรือวางบิล (ลูกค้าเครดิต) เสร็จ
- สร้าง Work Order ส่งไปหน้าปฏิบัติการ (**ยังไม่ออก EIR**) — notes รวม 🚛 ทะเบียนรถ + 👤 ชื่อคนขับ
- บันทึกข้อมูลคนขับลง localStorage (persist ข้ามหน้า)

ขั้นตอนที่ 2 — **รอรถยก**:
- แสดง 🚛 "รอรถยกนำตู้มาที่ประตู..." พร้อม step indicator
- เมื่อกลับมาค้นหาตู้เดิม ระบบตรวจ Work Order อัตโนมัติ → ข้ามไป Phase ที่ถูกต้อง

ขั้นตอนที่ 3 — **ปล่อยตู้ + ออก EIR**:
- ถ่ายรูปตู้ขาออก (ไม่บังคับ, สูงสุด 4 รูป) → อัปโหลดเป็นไฟล์อัตโนมัติ
- กดยืนยันปล่อยตู้ → อัปเดท container status + **ออก EIR อัตโนมัติ** (รวมข้อมูลคนขับจาก Phase 1)
- รูปถ่ายขาออกเก็บเป็น `exit_photos` ใน `damage_report` JSON (URL, ไม่ใช่ base64)

**💰 Gate-Out Billing**:
- เลือกตู้ → คำนวณค่าบริการอัตโนมัติจาก **Tiered Storage Rates** (ตามวันที่อยู่ + ขนาดตู้ 20'/40'/45')
- **Billing Card แสดงทุก Phase**: ไม่ว่าจะเป็น Phase 1/2/3 → billing card แสดงเสมอ
- **Checkbox เลือกรายการ**: storage/LOLO/gate เปิดอัตโนมัติ, ค่าล้าง/PTI/reefer/M&R ปิดไว้ — ติ๊กเลือกตามจริง
- **แก้ไขราคาได้**: ทุกรายการมีช่องกรอกราคา แก้ได้ทันที — ยอดรวม+VAT คำนวณใหม่ real-time
- **เพิ่มรายการเอง**: ปุ่ม "+ เพิ่มรายการค่าบริการ" → กรอกชื่อ + ราคา + ลบได้ (✕)
- **แยก Invoice ขาเข้า/ขาออก**: Gate-Out ไม่ดึง invoice ขาเข้ามาบล็อก — สร้าง invoice ใหม่ได้เสมอ
- **เช็คเครดิตลูกค้าผ่าน PrefixMapping**: ดึง prefix 4 ตัวแรก → PrefixMapping → Customers → ตรวจ `credit_term`
- รองรับ 2 วิธีจ่าย: 💵 เงินสด / 💳 โอน 
- **ลูกค้าเครดิต → ต้องวางบิลก่อน** กดขอดึงตู้ (ปุ่มขอดึงตู้ล็อกจนกว่าวางบิลเสร็จ)
- **Billing Clearance ก่อนขอดึงตู้/EIR**: รองรับ `paid`, `credit`, `no_charge`, `waived`; ยอด 0 แบบไม่มีรายการใช้ No Charge, ส่วนการยกเว้นค่าใช้จ่ายเดิมต้องมี reason
- หลังชำระ → ปุ่ม **"🖨️ พิมพ์ใบเสร็จ"** ขึ้นมาทันที
- ใบเสร็จ/ใบแจ้งหนี้บันทึก **เฉพาะรายการที่เลือก** + ราคาที่แก้ไข
- บันทึก `billing_clearance_id` ลง GateTransactions เพื่อให้ตรวจย้อนหลังได้ว่า Gate-Out รอบนั้นเคลียร์เงินด้วยเงื่อนไขใด
- **Gate-Out Booking Picker/Summary**: เมื่อมี Booking ที่เกี่ยวข้อง ระบบให้เลือก Booking ก่อนปล่อยออก และแสดง progress เช่น `จำนวนตู้: 3/5 received, 1/5 released`
- **UX — Toast Banner**: หลัง Gate-Out สำเร็จ → form reset ทันที + toast banner แสดง EIR print + auto-dismiss 15 วินาที
- **WO กรองเฉพาะรอบปัจจุบัน**: ดูเฉพาะ Work Orders ที่สร้างหลัง gate_in_date — ไม่ดึง WO เก่ามาข้าม Phase

#### แท็บ "ประวัติ Gate"
- ตาราง transactions + ลิงก์ดู EIR ทุกรายการ
- **ผู้ดำเนินการ**: แสดงชื่อ user ที่ทำ Gate-In/Out (จาก `processed_by` → Users.full_name)
- **Date picker**: เลือกดูประวัติวันไหนก็ได้ + ปุ่ม "วันนี้" สำหรับกลับมาวันปัจจุบัน
- **ช่องค้นหา**: ค้นหาด้วยเลขตู้, ชื่อคนขับ, ทะเบียนรถ, เลข EIR (กด Enter)
- **📄 Pagination** (**ใหม่**): 25 รายการ/หน้า + ปุ่มเลขหน้า + Prev/Next
- แสดงวันที่+เวลา + จำนวนรายการ

### 7.6 EIR (Equipment Interchange Receipt) — A5 Print
- **A5 Landscape** print layout พร้อมปุ่ม "พิมพ์ A5"; print CSS บังคับพื้นที่จริง `202mm × 139mm` บนกระดาษ A5 landscape margin 4mm และขยาย label/value เป็น 9–13px เพื่อไม่ให้ตัวหนังสือเล็ก/เหลือพื้นที่ครึ่งหน้า โดยไม่ตั้ง `body` เป็นขนาดเต็ม A5 เพื่อป้องกันหน้าเปล่าหน้า 2
- **React Portal**: render เป็น direct child ของ `<body>` — ป้องกัน print ซ้ำหลายหน้า
- เลข EIR ออกอัตโนมัติ (EIR-IN-YYYY-XXXXXX / EIR-OUT-YYYY-XXXXXX)
- ข้อมูลครบ: ตู้, คนขับ, รถ, ซีล, ลาน, พิกัด, ผู้ดำเนินการ
- **Company Header**: ชื่อบริษัท + (สำนักงานใหญ่) + ที่อยู่ + เลขประจำตัวผู้เสียภาษี + เบอร์โทร + โลโก้
- **สภาพตู้ (Container Condition)**: ✅ Sound / ⚠️ Damage (คำนวณจาก damage_report)
- **เกรดตู้ (Container Grade)**: A (สภาพดี) / B (สภาพพอใช้) / C (ใส่ของทั่วไป) / D (ห้ามใช้งาน)
- **QR Code**: สแกนเปิดหน้า `/eir/{eir_number}` → ดูรูปถ่าย + **รายงานความเสียหาย** (ไม่แสดงในเอกสาร)
- **ช่องลายเซ็น 3 ช่อง**: ผู้ตรวจสภาพตู้ / คนขับรถ / ผู้อนุมัติ
- **Print CSS**: `body > *:not(#eir-overlay) { display: none }` + Portal render
- **Public EIR Page** (`/eir/[id]`): หน้าสาธารณะ mobile-friendly — ข้อมูลตู้ + รูปถ่าย + รายงานความเสียหาย (กดขยายเต็มจอ)

### 7.7 ตรวจสภาพตู้ (Container Inspection)
- แผนผัง 6 ด้าน: Front, Back, Left, Right, Top, Floor
- กดมาร์กจุดเสียหาย (dent, hole, rust, scratch, crack, missing_part)
- ระดับความรุนแรง: minor / major / severe
- Auto-grade: A (ดี), B (พอใช้), C (ชำรุด), D (ชำรุดหนัก)
- เก็บข้อมูลเป็น JSON ใน GateTransactions.damage_report

### 7.8a File Storage (Local)
- รูปถ่ายทั้งหมด (Gate photo, Exit photo, Logo) **อัปโหลดเป็นไฟล์** ไม่ใช้ base64 ใน DB
- เก็บที่ `public/uploads/{folder}/{YYYY-MM}/` → เข้าถึงผ่าน URL path
- `PhotoCapture` component อัปโหลดอัตโนมัติ + แสดง loading overlay
- Fallback: ถ้าอัปโหลดไม่สำเร็จจะ fallback เป็น base64
- `/public/uploads` อยู่ใน `.gitignore`

### 7.8b Global Search + Real Yard Switcher (Topbar) (✅ เสร็จ — 21 พ.ค. 2569)
- ช่องค้นหาบนสุดใช้ **API กลางใหม่** `GET /api/search?q=&yard_id=&limit=` แทนการยิงเฉพาะ `/api/containers`
- ค้นหาข้าม 4 entity หลัก: Containers, GateTransactions/EIR, Invoices, Bookings
- ผลลัพธ์ normalized เป็น `{ id, kind, title, subtitle, meta, status, href }` เพื่อให้ UI แสดง badge/icon และ quick jump ได้สม่ำเสมอ
- มี short-query guard: คำค้นน้อยกว่า 2 ตัวอักษรคืน `{ results: [] }` และไม่แตะ DB
- Topbar มี debounce 250ms, loading state, empty state, กด Enter เพื่อเปิดผลลัพธ์แรก, Escape เพื่อปิด dropdown
- Quick jump อ่าน query string ปลายทางแล้ว: `/yard?search=`, `/gate?tab=history&search=`, `/billing?tab=invoices&invoice_id=`, `/booking?search=`
- Yard Switcher เปลี่ยนจาก `DEMO_YARDS` เป็นโหลดจาก `/api/settings/yards` จริง แล้วกรองด้วย `session.yardIds`
- ถ้า active yard ไม่อยู่ในลิสต์ที่ผู้ใช้เข้าถึงได้ ระบบจะสลับไป yard แรกที่เข้าถึงได้อัตโนมัติ
- Tests: `src/app/api/__tests__/search.test.ts` ครอบคลุม aggregation, yard binding, short query guard, DB error

### 7.8c Notification Bell (Topbar)
- กระดิ้งแจ้งเตือนทำงานได้จริง — ดึงกิจกรรมล่าสุดจาก Gate + Work Orders
- Badge ตัวเลขแสดงจำนวนที่ยังไม่อ่าน (สีแดง)
- กดกระดิ้ง → เปิด dropdown รายการแจ้งเตือน
- ไอคอนสีตามประเภท: 📥 Gate-In, 📤 Gate-Out, ✅ เสร็จ, 🆕 งานใหม่
- เวลาสัมพัทธ์ (3 min, 2 hr, 1 d) + จุดสีน้ำเงิน unread
- ปุ่ม "อ่านทั้งหมดแล้ว" → เรียก `PATCH /api/notifications` บันทึก timestamp ลง **Database** (ซิงค์ข้ามทุก browser และ device ของ user เดียวกัน)
- **Cross-Browser/Device Sync** (**แก้ไข 31 มี.ค. 2569**): สถานะ "อ่านแล้ว" เก็บใน `Users.notif_last_read_at` บน DB — เปิดหลาย tab/browser/device ไม่ flash badge ซ้ำ
- **Per-user read state**: แต่ละ user มี read timestamp แยกกันใน DB — ไม่ข้ามไปใช้ของ user อื่น
- `GET /api/notifications?user_id=Y` ส่ง `last_read_at` กลับมาพร้อมข้อมูล — frontend ใช้ค่านี้เปรียบเทียบ (ไม่ต้องพึ่ง localStorage อีกต่อไป)
- **Notification Center** (✅ เสร็จ — 22 พ.ค. 2569): เพิ่มหน้า `/notifications` สำหรับดู notification แบบเต็ม, filter `all/gate/work_order`, toggle `Unread only`, deep-link ไปหน้าที่เกี่ยวข้อง และ Topbar มีลิงก์ `ดูทั้งหมด`
- รีเฟรชอัตโนมัติทุก 30 วินาที

### E2E Smoke Tests (✅ เสร็จ — 22 พ.ค. 2569)
- เพิ่ม `scripts/e2e-smoke.mjs` และ npm script `test:e2e:smoke` แบบไม่พึ่ง dependency เพิ่ม โดยใช้ `CYMS_E2E_BASE_URL` หรือ default `http://localhost:3005`
- Smoke ครอบ public/protected/auth boundary: `/login`, `/manifest.json`, `/api/auth/me`, `/dashboard`
- Verify ล่าสุด: `npm run test:e2e:smoke` ✅ (`/login 200`, `/manifest.json 200`, `/api/auth/me 401`, `/dashboard 307`)

### 7.8 ปฏิบัติการ (Operations)

3 แท็บ:

#### แท็บ "Job Queue"
- ตาราง Work Orders + **2-button workflow** สำหรับคนขับรถยก:
  - 📥 **รับงาน** (pending → in_progress — ข้าม assigned)
  - ✅ **เสร็จ** (in_progress → completed + อัพเดทพิกัดตู้อัตโนมัติ)
- **SSE Real-Time** (**ใหม่**): เชื่อมต่อ `/api/operations/stream` ผ่าน EventSource — งานใหม่ขึ้นอัตโนมัติไม่ต้อง refresh + 🟢 Live indicator + auto-reconnect
- **⏱ Container Timeline** (**ใหม่**): ทุก Work Order มีปุ่มดู Container Timeline ของตู้นั้น (dynamic import)
- **Direction Badge** (**ใหม่**): 📤 ส่งออก (Gate-Out) / 📥 รับเข้า (Gate-In) แสดงชัดเจนบนการ์ดงาน
- **Truck/Driver Info** (**ใหม่**): 🚛 ทะเบียนรถ + 👤 ชื่อคนขับ แสดงในแต่ละ WO (ดึงจาก notes)
- **เปลี่ยนตำแหน่งวางตู้ได้**: กดเสร็จ → แสดงฟอร์มแก้ข Zone/Bay/Row/Tier (pre-fill ตำแหน่งเดิม, **Zone dropdown โหลดจาก API ถูกต้อง**) → ยืนยันเสร็จสิ้น
- Filter ตาม status
- ปุ่มยกเลิกสำหรับงานที่ยังไม่เริ่ม
- ปุ่ม Mobile ขนาดใหญ่ (48px+) สำหรับใส่ถุงมือกดได้

#### แท็บ "สร้างงาน"
- เลือกประเภท: ย้ายตู้ / หลบตู้ / จัดเรียง
- ค้นหาตู้ → เลือก → กำหนดปลายทาง (Zone/Bay/Row/Tier)
- ตั้งความสำคัญ (ด่วนมาก / ด่วน / ปกติ / ต่ำ)

#### แท็บ "Smart Shifting" (LIFO)
- ค้นหาตู้ล่างที่ต้องดึงออก
- ระบบวิเคราะห์ตู้ที่ซ้อนข้างบน (LIFO) — **รวมทุกสถานะ** (in_yard, repair, hold ฯลฯ) ยกเว้น gated_out
- แสดง: ตู้ที่ต้องหลบ + ตำแหน่งพักชั่วคราว + total moves

### 7.9 3D Yard Viewer (Three.js)

รายละเอียดเทคนิค:

| ฟีเจอร์ | รายละเอียด |
|---------|-----------|
| **สัดส่วนจริง** | 20ft=2.4×1.0×1.06, 40ft=4.9×1.0×1.06, 45ft HC ×1.12 |
| **สีตามสายเรือ** | Evergreen=เขียว, MSC=น้ำเงินเข้ม, Maersk=ฟ้า, COSCO=แดง, ONE=ชมพู, Yang Ming=เหลือง ฯลฯ |
| **รายละเอียดตู้** | Edge lines, corrugation (ลอนคลื่น), door lines + handles, corner posts 4 มุม, top rail |
| **Hover tooltip** | เลขตู้ \| ขนาด \| สายเรือ \| สถานะ \| พิกัด |
| **Click** | เลือกตู้ → detail panel |
| **X-Ray Mode** | ตู้อื่น opacity 60% + beacon สีเหลือง + วงแหวนบนพื้น + **floating label** (billboard) |
| **Camera** | OrbitControls + smooth lerp zoom (cubic easing) |
| **Stack** | Ground-up stacking — ไม่มีตู้ลอย |

### 7.6 Auto-Allocation Algorithm

Scoring system สำหรับแนะนำพิกัดวางตู้:

| กฎ | คะแนน |
|----|-------|
| Base score | 100 |
| สายเรือเดียวกันอยู่ Bay เดียวกัน | +30 |
| Tier ต่ำ (หยิบง่าย) | +5 ต่อชั้น |
| โซนว่างเยอะ (>50%) | +15 |
| Stack สูงเกิน tier 3 | -10 ต่อชั้น |
| ขนาดตู้ไม่ตรง zone size_restriction | filter |
| ตู้เย็น → Zone reefer เท่านั้น | filter |
| ตู้ hazmat → Zone hazmat เท่านั้น | filter |
| Zone repair → ไม่วางตู้ใหม่ | filter |

---

## 8. Design System — "Industrial Tech"

### สี

| กลุ่ม | Hex | ใช้งาน |
|-------|-----|--------|
| Primary | `#1E293B` | Sidebar, Header |
| Background | `#F8FAFC` / `#F1F5F9` | พื้นหลัง |
| Accent | `#3B82F6` | ปุ่มหลัก, Active |
| Success | `#10B981` | Available, อนุมัติ |
| Danger | `#EF4444` | Damage, Hold |
| Warning | `#F59E0B` | Pending, รอซ่อม |

### Typography
- **EN + ตัวเลข**: Inter
- **TH**: Sarabun
- **Dark Mode**: `class` strategy

### UI Patterns
- Skeleton Loading (ไม่ใช้ spinner)
- Glassmorphism (backdrop-blur + bg-opacity)
- Smooth transitions (150-300ms)

### Date / Time / Timezone
- **รูปแบบวันที่**: `dd/mm/yyyy` (เช่น 19/03/2026)
- **Timezone**: `Asia/Bangkok` (UTC+7) — ใช้ `timeZone: 'Asia/Bangkok'` ใน `toLocaleString`
- **เวลา**: 24 ชั่วโมง (เช่น 14:30)
- **ฟังก์ชัน**: ใช้ `formatDate()`, `formatDateTime()`, `formatTime()`, `formatShortDate()`, `calcDwellDays()` จาก `@/lib/utils.ts` เท่านั้น
  - `formatDate()` → `19/03/2026`
  - `formatDateTime()` → `19/03/2026 14:30`
  - `formatTime()` → `14:30:00`
  - `formatShortDate()` → `19 มี.ค. 69` (แสดงย่อภาษาไทย)
  - `calcDwellDays(gateInDate)` → จำนวนวัน Calendar Days (+1) — **ห้ามใช้ `Math.floor(diff/86400000)` inline**
- **ห้ามใช้** inline `toLocaleDateString()` / `toLocaleTimeString()` / inline dwell calculation โดยตรง

---

## 9. งานที่เหลือ (เฟส 5-9)

### เฟส 4: Gate In/Out + ตรวจสภาพตู้ (✅ เสร็จ — ยังเหลือบางส่วน)
- [x] ฟอร์ม Gate-In (เลขตู้, ขนาด, ประเภท, สายเรือ, ซีล, คนขับ, ทะเบียนรถ)
- [x] ฟอร์ม Gate-Out (ค้นหาตู้ → ปล่อยออก → EIR)
- [x] ออกเอกสาร EIR อัตโนมัติ
- [x] ตรวจสภาพตู้ดิจิทัล (แผนผัง 6 ด้าน + damage marking)
- [x] **📷 PWA OCR สแกนเลขตู้** (Tesseract.js) — **เสร็จแล้ว** (26 มี.ค. 2569):
  - Full-screen PWA camera UI (autoPlay + playsInline + loadedmetadata fix)
  - Crop zone: ตัดเฉพาะขยะกลาง 80%×30% สำหรับ container/seal เร็วขึ้น 3×
  - Pre-warm Tesseract worker ตอน mount — ไม่เสียเวลาตอน capture
  - `extractContainerNumber()` 4-strategy: Direct regex → O/0 I/1 noise correction → check digit auto-fix → fuzzy
  - Confidence score badge: High/Medium/Low + เตือนถ้า low
  - mode prop: `container` / `plate` / `seal` / `generic`
  - Animated scan overlay (corner brackets + scan line)
  - Torch/Flash toggle (บน device ที่รองรับ)
  - OCR progress bar
  - GateOutTab: เพิ่มปุ่ม scan สำหรับทะเบียนรถ + เลขซีล
- [x] ย้ายตู้ข้ามสาขา (Inter-Yard Transfer) — **เสร็จแล้ว** (6 bugs + smart allocate + to_yard_id + toast)

### เฟส 5: ปฏิบัติการหน้างาน (✅ เสร็จ — ยังเหลือบางส่วน)
- [x] Job Queue รถยก (Work Orders + status workflow)
- [x] Smart Shifting Logic (Virtual LIFO)
- [ ] แอป Surveyor (PWA Offline) — ใช้ YardAudit ที่ทำไว้แล้วแทน

### เฟส 6: เชื่อมโยง EDI สายเรือ (✅ เสร็จ)
- [x] Booking/Manifest นำเข้า + จัดการสถานะ
- [x] Seal Cross-Validation
- [x] Customer Master + EDI Config (ISO auto-import)
- [x] **CODECO Outbound** — สร้างข้อมูล Container Departure/Arrival Message (UN/EDIFACT D:95B:UN, CSV, JSON)
- [x] **SFTP Auto-Upload** — ส่ง CODECO ไฟล์ผ่าน SFTP อัตโนมัติให้สายเรือ (ssh2-sftp-client)
- [x] **📧 Email EDI Delivery** — ส่ง CODECO ผ่าน Email (SMTP/Azure Graph API) พร้อมไฟล์แนบ
- [x] **⏰ EDI Auto-Schedule (node-cron)** — ตั้งเวลาส่งอัตโนมัติ (ทุกชั่วโมง/วันละ2ครั้ง/ทุกวัน/ทุกสัปดาห์) + instrumentation.ts auto-init
- [x] **EDI Endpoints (DB)** — ตั้งค่า SFTP/FTP/API/Email endpoints เก็บใน DB จริง + CRUD API + Send Log
- [x] **Shipping Line Autocomplete** — พิมพ์ค้นหาสายเรือจากข้อมูลที่มีอยู่ (HTML datalist)
- [x] **📋 EDI Template System** — template-based format per shipping line: field mapping (**drag-and-drop** reorder), custom headers, date format, CSV delimiter, EDIFACT version — Config ผ่าน UI ไม่ต้องแก้โค้ด
- [x] **Shared CODECO Formatter** (`ediFormatter.ts`) — ลดโค้ดซ้ำ, รองรับ template config + legacy fallback
- [x] **CODECO Download Fix** — แก้ auth error ปุ่มดาวน์โหลด (fetch+blob แทน window.open)

### Customer Management — 🏢 Multi-Role Architecture (✅ เสร็จ)
- [x] **Multi-Role Customer Master** — ลูกค้า 1 บริษัท = หลายบทบาทพร้อมกัน ผ่าน Boolean flags:
  - `is_line` (สายเรือ/เจ้าของตู้), `is_forwarder` (ตัวแทน), `is_trucking` (รถบรรทุก), `is_shipper` (ผู้ส่งออก), `is_consignee` (ผู้นำเข้า)
  - UI: **Checkbox group** สี+ไอคอนแยกตามบทบาท — เลือกได้หลายรายการ
  - Legacy `customer_type` column เก็บไว้สำหรับ backward compatibility (auto-derive จาก flags)
- [x] **Customer Code Auto-Generation** — `CUST-XXXXX` (5 หลัก, auto-increment, ไม่ซ้ำ)
- [x] **Multi-Branch Support** — ตาราง `CustomerBranches` (branch_code + name + billing_address + contact + is_default)
  - UI: **Branch Manager** — เพิ่ม/ลบสาขา, กำหนดสาขาหลัก (radio), contact info ต่อสาขา
- [x] **EDI Prefix Validation** — ช่อง `edi_prefix` บังคับกรอกเมื่อ `is_line = true` (Zod refine rule)
- [x] **Duplicate Detection** — ตรวจซ้ำชื่อบริษัท + เลขผู้เสียภาษี (ทั้ง POST และ PUT)
- [x] **Payment Type** — `default_payment_type` (CASH/CREDIT) + แสดง credit term เมื่อเลือก CREDIT
- [x] **Auto-Migration** — API auto-migrate existing data: `shipping_line` → `is_line=1`, `trucker` → `is_trucking=1`, auto-gen customer_code
- [x] **Downstream Updates (17 files)** — ทุก API/UI ที่ใช้ `customer_type` อัปเดตเป็น boolean flags:
  - API: `gate-check`, `gate-in-check`, `ar-aging`, `boxtech`, `portal/overview`, `prefix-mapping`
  - UI: `GateInTab`, `GateOutTab`, `PrefixMapping`, `UsersSettings`, `billing/page`, `portal/page`
- [x] **RBAC customers module** — 4 permissions (create/read/update/delete), 33 ข้อรวม
- [x] **Billing autocomplete** — search + autocomplete ลูกค้า (ชื่อ/เลขภาษี) แทน dropdown
- [x] **Invoice + branch** — JOIN Yards/Customers เพื่อดึงข้อมูลสาขาสำหรับออกใบกำกับภาษี
- [x] **Logo upload fix** — ALTER COLUMN logo_url NVARCHAR(MAX) สำหรับ base64 image

### เฟส 7: ซ่อมบำรุง M&R (✅ เสร็จ + 🔧 Hardened)
- [x] สร้างใบ EOR + CEDEX codes + คำนวณราคาอัตโนมัติ
- [x] Approval workflow (draft→submit→approve→repair→complete)
- [x] **🌐 CEDEX ภาษาไทย** — แปล 29 รหัส (component/damage/repair) + tab label + header
- [x] **📝 Audit Trail** — `logAudit` ทุก action (eor_create/submit/approve/start_repair/complete/reject)
- [x] **✅ Zod Validation** — `createEORSchema` + `updateEORSchema` ตรวจ body ทั้ง POST/PUT
- [x] **💰 Actual Cost Modal** — กด "เสร็จ" แสดง modal ให้ใส่ค่าซ่อมจริง (pre-fill จากราคาประเมิน)
- [x] **📋 Notes + Created By** — บันทึกหมายเหตุ + ผู้สร้าง EOR
- [x] **🔄 Reject Revert** — ปฏิเสธ EOR → ตู้กลับเป็น `in_yard` (เดิมค้าง `under_repair`)
- [x] **🆔 User ID Tracking** — ทุก action ส่ง user_id จาก session เพื่อบันทึกใน audit

### เฟส 8: บัญชีการเงิน (✅ เสร็จ)
- [x] Tariff ตั้งค่าบริการ (Storage, LOLO, M&R, Washing, PTI, Reefer) + labels + number input UX
- [x] **Tariff Simulator** (✅ เสร็จ — 21 พ.ค. 2569) — เพิ่ม `src/lib/billingTariffSimulator.ts` และ `TariffSimulatorPanel.tsx` ในแท็บ Tariff เพื่อทดลอง dwell days/quantity, VAT, subtotal/grand total และ scenario 7/14/30 วันก่อนบันทึก rate
- [x] **Tiered Storage Rates** — อัตราขั้นบันได เชื่อมกับ DB จริง + API + live preview calculator
  - ตาราง `StorageRateTiers`: Free/Standard/Extended/Penalty + ราคาแยกตามขนาดตู้ (20'/40'/45')
  - ตั้งค่าที่: ตั้งค่าระบบ → ค่าฝาก | อัตราอื่นๆ (LOLO, gate): บัญชี → Tariff
- [x] **Gate-Out Billing Integration** — คำนวณค่าบริการอัตโนมัติที่ Gate-Out
  - ใช้ tiered rates + per-size pricing | Fallback เป็น flat Tariff
  - ตรวจ paid invoices → ป้องกัน duplicate payment
- [x] **Billing Clearance ก่อน Gate/EIR** — Gate-In และ Gate-Out ต้องเคลียร์รายการเรียกเก็บเงินก่อนทำธุรกรรมต่อ
  - รองรับ 4 ประเภท: `paid` (ชำระแล้ว), `credit` (ลูกค้าเครดิต/วางบิล), `no_charge` (ไม่มีค่าใช้จ่ายจริง), `waived` (มีค่าใช้จ่ายเดิมแต่อนุมัติยกเว้น)
  - `waived` ต้องกรอกเหตุผล และเก็บ `approved_by`; ทุกประเภทเก็บ charge breakdown, original_amount, final_amount
  - `GateTransactions.billing_clearance_id` ใช้เชื่อม Gate transaction/EIR กับหลักฐาน clearance
  - หมายเหตุ: ฝั่ง Gate UI บังคับ clearance ก่อน submit; ฝั่ง API ตรวจความถูกต้องเมื่อส่ง `billing_clearance_id` เข้ามา
- [x] Auto-billing (Dwell Time → Auto-Calculate API) + VAT 7%
- [x] Hold/Release workflow
- [x] Invoice status workflow (draft→issued→paid→credit_note)
- [x] **Printable A4 Invoice/Receipt** — `/billing/print?id=X&type=invoice|receipt`
  - Company header (logo + ชื่อ + สำนักงานใหญ่/สาขา + ที่อยู่ + เลขภาษี + โทร)
  - Customer info (ชื่อ + สาขา + ที่อยู่ + เลขภาษี)
  - **Itemized charges table** (แจกแจงทุกรายการจาก JSON notes)
  - VAT breakdown + จำนวนเงินเป็นตัวอักษรไทย
  - **PromptPay QR** สำหรับ invoice ที่ยังไม่ชำระ: ตั้งค่าได้ที่ Billing → Payment QR, QR เป็น fixed amount ตามยอด `grand_total`
  - ช่องลายเซ็น: **ผู้จ่าย / Paid by** (ซ้าย) + **ผู้รับเงิน / Received by** (ขวา) + auto-print
  - Receipt: หัวเอกสาร **"Receipt"** (ไม่มี Tax Invoice) + แสตมป์ "✅ ชำระเงินแล้ว" + ใช้ `receipt_number` แยกจาก `invoice_number` เมื่อชำระครบ
- [x] **Billing Statement batch** (✅ เสร็จ — 22 พ.ค. 2569) — เพิ่ม `GET/POST /api/billing/statements`, ตาราง `BillingStatements/BillingStatementLines`, ปุ่ม “ออกเอกสารวางบิลรวม” ที่ Billing → เอกสาร, กล่อง “ประวัติใบวางบิลรวม” สำหรับเปิด/พิมพ์ซ้ำย้อนหลัง และหน้า `/billing/print/statement` สำหรับ A4 statement โดย lock invoice ที่อยู่ใน statement แล้วไม่ให้วางบิลซ้ำ
- [x] **Payment Allocation** (✅ เสร็จ — 22 พ.ค. 2569) — เพิ่ม `GET/POST /api/billing/payments`, ตาราง `BillingPayments/BillingPaymentAllocations`, รับชำระแบบ partial/multi-invoice ผ่าน `balance_amount`, และ Payment Reconciliation สร้าง payment allocation แทนการ set paid ตรง ๆ
- [x] **Billing API read permission hardening** (✅ เสร็จ — 22 พ.ค. 2569) — `GET /api/billing/invoices`, `ar-aging`, `reports`, `credit-control`, `erp-export`, `statements`, `payments` require billing/report permission + yard access ฝั่ง server
- [x] ERP Export (CSV/JSON debit-credit entries) — **แก้ไข: getDb() fix, date format DD/MM/YYYY HH:mm, เพิ่ม customer credit_term/branch/address/due_date**
- [x] **Billing Reports** (ใหม่): รายงานประจำวัน + ประจำเดือน
  - แท็บ "รายงาน" ในหน้าบัญชี + หน้าพิมพ์ A4 แยก (`/billing/print/report`)
  - รายวัน: KPIs, สรุปสถานะ, gate activity, แจกแจงตามประเภทค่าบริการ, รายการ invoice
  - รายเดือน: KPIs, top customers, daily breakdown table
- [x] **AR Dunning Action Center** (✅ เสร็จ — 21 พ.ค. 2569) — เพิ่ม `src/lib/arDunning.ts` และ `ARDunningPanel.tsx` ใน AR Aging เพื่อจัด stage `friendly_reminder` / `second_notice` / `credit_hold_review` / `final_notice`, สรุป exposure, เรียงลำดับลูกค้าที่ต้องตาม, copy reminder draft และบันทึก contact attempt / promise-to-pay ผ่าน `POST /api/billing/dunning-actions` ลง audit log
- [x] **Payment Reconciliation** (✅ เสร็จ — 22 พ.ค. 2569) — เพิ่ม `PaymentReconciliationRows`, `GET/POST/PATCH /api/billing/payment-reconciliation` และแท็บ Billing → `Payment Reconciliation`: นำเข้า statement rows เป็น `pending`, match กับ invoice แล้วสร้าง `BillingPayments/BillingPaymentAllocations`, ปรับ `balance_amount` และ set paid เฉพาะเมื่อยอดเหลือ 0, หรือ ignore พร้อม note; บังคับ `billing.payment.receive` + yard access และ audit `payment_reconciliation_*`
- [x] **📄 PDF Export** (ใหม่) — client-side PDF ผ่าน jsPDF + jspdf-autotable
  - `src/lib/pdfExport.ts` — 3 ฟังก์ชั่นสำเร็จรูป:
    - `generateBillingReportPDF()` — รายงานประจำวัน/เดือน (KPIs, ตารางบิล, gate activity, ยอดรายวัน, top ลูกค้า)
    - `generateInvoicePDF()` — ใบแจ้งหนี้/ใบเสร็จ (ตารางรายการ + VAT + ช่องลายเซ็น)
    - `generateGateHistoryPDF()` — ประวัติ Gate (landscape, ตาราง transactions)
  - `src/lib/sarabunFont.ts` — Sarabun font (Google Fonts) embedded base64 รองรับภาษาไทย
  - Lazy import ใน billing page (`const loadPdfExport = () => import(...)`) ป้องกัน SSR bundle
  - ปุ่ม PDF สีแดง (ถัดจากปุ่มพิมพ์) ที่แท็บรายงาน
  - **หมายเหตุ**: headStyles ต้องใช้ `fontStyle: 'normal'` เพราะ Sarabun ลงทะเบียนเฉพาะ normal (bold จะ fallback เป็น helvetica)
- [x] **Hold Logic Fix** (**ใหม่**): ป้องกัน hold ตู้ที่ gate-out ไปแล้ว
  - API ตรวจ container status ก่อน hold + แสดงเฉพาะตู้ in_yard ในแท็บ Hold
- [x] **Print button at Gate-Out** — หลังชำระเงินมีปุ่มพิมพ์ใบเสร็จทันที
- [x] **Print button at Gate-In** — หลังชำระเงิน/วางบิลมีปุ่มพิมพ์ใบเสร็จ/ใบแจ้งหนี้ทันที
- [x] **Invoice datetime** — ใบแจ้งหนี้แสดงทั้งวันที่และเวลา (formatDateTime)
- [x] **Demurrage Calculator** (**ใหม่**) — แยก demurrage/detention จาก storage
  - ตาราง `DemurrageRates` (yard_id, charge_type, free_days, rate_20/40/45, customer_id)
  - แท็บ "Demurrage" ในหน้าบัญชี: Overview (ตู้เกิน/ใกล้/ปลอดภัย) + ค่า demurrage รวม
  - **Rates Config** (✏️ แก้ไข / + เพิ่ม / 🗑 ลบ) — inline editing ทุก field
  - **Calculator** — กดคำนวณรายตู้ (demurrage + detention breakdown + over_days × rate)
  - **Timeline** — ปุ่ม Clock เปิด Container Timeline ได้จากแต่ละตู้
  - **📄 Pagination** (**ใหม่**): 25 รายการ/หน้า + ปุ่มเลขหน้า (Overview tab)
  - **แยกจาก Storage**: Storage = ค่าฝากตู้ (รายได้ลาน), Demurrage = ค่าปรับสายเรือ

### Container Tracking Timeline (✅ เสร็จ)
- [x] **Timeline API** (`/api/containers/timeline`) — merge events จาก 3 แหล่ง:
  - GateTransactions (Gate-In, Gate-Out)
  - AuditLog (Move, Hold, Release, Status Change, Repair)
  - Invoices (Payment, Invoice Created)
- [x] **ContainerTimeline component** — visual vertical timeline + expand/collapse details
  - icon + สี ตาม event type + วันที่/เวลา + คำอธิบาย
  - รองรับทั้ง `container_id` และ `container_number` lookup
- [x] **ปุ่ม ⏱ Timeline ในหน้า Operations** — ทุก Work Order มีปุ่มดู timeline ของตู้นั้น
- [x] **Timeline modal ในหน้า Gate** — เชื่อมผ่าน container_id

### เฟส 9: ปรับแต่ง & PWA (✅ เสร็จ)
- [x] PWA Service Worker (Network-first API, Cache-first assets)
- [x] Toast Notification System (success/error/warning/info)
- [x] PWA meta tags + manifest + SVG icons + favicon
- [x] CSS: Toast animation, Pulse glow, Focus ring, Print styles
- [x] Offline-First IndexedDB → `offlineQueue.ts` (enqueue + auto-sync on online)
- [x] **Offline Queue Flow Integration** (✅ เสร็จ — 21 พ.ค. 2569):
  - `offlineFetch()` เพิ่ม operation metadata และ response `status: queued`
  - Auto-sync แยกผล `synced / failed / conflict` และแจ้ง toast จาก Topbar
  - Gate-In submit, Gate-Out pickup/release, PhotoCapture upload, Yard Audit save/position update, M&R photo/EOR/action update ใช้ offline queue แล้ว
  - UI สำคัญแสดงข้อความ “เข้าคิวออฟไลน์” แทนมองเป็น error เมื่อไม่มีเน็ต
- [x] **Offline Outbox UX** (✅ เสร็จ — 21 พ.ค. 2569):
  - Topbar มี outbox dropdown สำหรับดู queued/synced/conflict, retry รายการ, discard รายการ และ clear synced
  - `offlineQueue.ts` เพิ่ม `listQueuedRequests`, `retryQueuedRequest`, `markConflict`, `clearSynced` และเก็บ metadata `lastAttemptAt/lastError/lastHttpStatus/conflictReason`
  - Auto-sync ไม่ลบรายการที่สำเร็จทันที แต่ mark เป็น `synced` ให้ operator เห็นหลักฐานก่อนล้างเอง
  - Unit test: `src/lib/__tests__/offlineQueue.test.ts` ครอบคลุม list/remove/retry/conflict/clear synced

### 🧩 Component Decomposition (✅ เสร็จ — 21 พ.ค. 2569)
- [x] **Billing page split** — แยก `BillingClearanceTab`, `BillingReports`, `CreditControlTab`, `ARAgingTab` ออกจาก `billing/page.tsx` เป็น component files เฉพาะทาง
- [x] **Shared billing UI contracts** — เพิ่ม `billingTypes.ts` และ `billingUi.ts` สำหรับ prop/data types, label mapping, badge helpers และ lazy export loader
- [x] **Page orchestrator เบาลง** — `billing/page.tsx` เหลือบทบาทหลักเป็น tab orchestration, data loading, invoice/credit-note modal state
- [x] **Static boundary guard** — เพิ่ม `src/app/api/__tests__/component-boundaries.test.ts` เพื่อกัน regression ไม่ให้ย้าย tab ใหญ่กลับเข้า `page.tsx`

### NFR: Non-Functional Requirements (✅ เสร็จ)
- [x] NFR1: Offline-First — IndexedDB queue + `offlineFetch()` wrapper + auto-replay + operation status (`queued/synced/conflict`) สำหรับงานหน้าด่าน/Yard/M&R + Operator Outbox
- [x] NFR3b: High-Contrast Theme — `.high-contrast` CSS + ☀️ toggle (sidebar white bg, เส้นขอบหนา, ตัวอักษรใหญ่)
- [x] Dark Mode — `@variant dark (&:is(.dark *))` สำหรับ Tailwind v4 class strategy

### 🔐 Production Readiness (✅ เสร็จ)
- [x] **API Auth Proxy** — `src/proxy.ts` (Next.js 16, เดิมคือ `middleware.ts`) ตรวจ JWT บนทุก `/api/` route + protected page routes อัตโนมัติ (exempt: login, EIR)
  - **Page Guard**: ตรวจ `cyms_token` cookie สำหรับ page routes → redirect ไป `/login` ถ้าไม่มี/หมดอายุ (server-side, ไม่ต้องรอ JS)
  - **Cookie→Header Forwarding**: `passthrough()` อ่าน cookie แล้วส่งเป็น `x-cyms-token` custom header → API route handler อ่านได้แน่นอน
  - Client: global fetch interceptor ใน dashboard layout → auto-attach `Authorization: Bearer` + auto-redirect 401
  - `src/lib/apiAuth.ts`: `withAuth()` wrapper สำหรับ role-based access control
- [x] **Rate Limiting** — `src/lib/rateLimit.ts` + Settings UI + Toggle เปิด/ปิด
  - Login: 5 req/15 นาที, API: 100 req/นาที, Upload: 10 req/นาที
  - DB-backed config via `SystemSettings` table (cached 30s)
  - แท็บ "Rate Limit" ในตั้งค่า: toggle + ปรับค่า + สถิติ real-time (active IPs, blocked counts)
  - Login route returns 429 + `Retry-After` header เมื่อเกินกำหนด
- [x] **Input Validation (Zod)** — `src/lib/validators.ts`
  - Schemas: container numbers, gate transactions, invoices, users, customers, EDI endpoints
  - ใช้กับ Gate POST route → return 400 + error details เป็นภาษาไทย
- [x] **Complete Audit Trail** — `src/lib/audit.ts` (centralized logAudit helper)
  - ครอบคลุม 14+ routes: settings (9 routes), operations, billing, EDI endpoints

### Dwell Days Display + Calendar Days Formula (✅ เสร็จ)
- [x] **ตารางภาพรวม** — คอลัมน์ "อยู่ในลาน" แสดง X วัน พร้อม badge สี
- [x] **ค้นหาตู้** — badge จำนวนวันข้างผลลัพธ์
- [x] **Card View** — badge ใน location bar ของแต่ละ container card
- [x] **Bay View tooltip** — "อยู่ในลาน: X วัน" ใน hover tooltip
- [x] **Container Detail Modal** — "อยู่ลานแล้ว X วัน" แสดงตรงกับตาราง
- [x] **Summary Cards — Overdue + Avg Dwell** — รวม Dwell Time metrics เข้าภาพรวม (ลบ Dwell Time tab แยกออก)
- [x] **📅 Calendar Days (+1)** — สูตรนับวัน:
  - ตัดเวลาออก → เปรียบเทียบเฉพาะวันที่ → diff + 1
  - วันเข้า = Day 1 (เข้า 1 มี.ค. → วันนี้ 1 มี.ค. = **1 วัน**)
  - ใช้ฟังก์ชัน `calcDwellDays()` จาก `@/lib/utils.ts` **ทั้งระบบ** (6 จุด ใน 5 ไฟล์)
  - ไฟล์: `yard/page.tsx`, `containers/detail/route.ts`, `BayCrossSection.tsx`, `ContainerCardPWA.tsx`, `ContainerSearch.tsx`
- Color coding: 🟢 ≤7 วัน (ปกติ) | 🟡 8-14 วัน (เริ่มนาน) | 🔴 >14 วัน (ค้างลานนาน)

### 🧠 Yard Planning Heatmap + Forecast (✅ เสร็จ — 21 พ.ค. 2569)
- [x] **Slot aging heatmap** — `src/lib/yardPlanning.ts` รวม occupancy, avg/max dwell และ active count ต่อ zone แล้วจัดระดับ `low/watch/high/critical`
- [x] **Move recommendations** — แนะนำ pre-marshal ตู้พร้อมปล่อยที่อยู่ tier สูง/ค้างนาน และแยกตู้ hold/repair ให้เข้า repair review
- [x] **Create Work Order action** — recommendation เลือก target slot ว่างจาก zone ที่เหมาะสม แล้วสร้าง `WorkOrders` ผ่าน `/api/operations` ได้ทันทีพร้อม from/to slot และ note จากเหตุผล planning
- [x] **Daily release forecast** — สรุป ready today, next 3 days และ blocked count เพื่อช่วยวางแผนทีมหน้าลาน
- [x] **Congestion forecast** — แสดง zone ที่เริ่มเสี่ยง/วิกฤต พร้อมคำแนะนำ operational action
- [x] **UI integration** — เพิ่ม `src/components/yard/YardPlanningPanel.tsx` ในหน้า Yard Overview (2D view) ก่อน Yard Optimization
- [x] **Unit tests** — `src/lib/__tests__/yardPlanning.test.ts` ครอบคลุม heatmap risk, move recommendation, target slot สำหรับ Work Order และ release forecast

### 📄 Table Pagination (✅ เสร็จ)
- [x] **Gate History** — 25 รายการ/หน้า + ปุ่มเลขหน้า + Prev/Next
- [x] **Invoices** — 25 รายการ/หน้า + ปุ่มเลขหน้า + Prev/Next
- [x] **CODECO** — 25 รายการ/หน้า + ปุ่มเลขหน้า + Prev/Next
- [x] **Demurrage Overview** — 25 รายการ/หน้า + ปุ่มเลขหน้า + Prev/Next
- Pagination component: auto-reset เมื่อ filter เปลี่ยน, แสดง "แสดง X-Y จาก Z รายการ"

### 📊 Gate Reports (✅ เสร็จ)
- [x] **Daily Gate In Report** — เลือกวันที่ → ตารางรายการตู้เข้าทั้งหมด + summary cards (total/laden/empty/20/40/45) + byShippingLine + Export PDF/Excel
- [x] **Daily Gate Out Report** — เหมือนกัน แต่เป็นตู้ออก
- [x] **Summary Gate In Report** — Date Range → 7 sections:
  - KPI Cards (total, laden/empty, เฉลี่ย/วัน, Peak day)
  - Daily Trend Chart (CSS bar chart — ไม่ต้องติดตั้ง Recharts)
  - Top 10 Shipping Lines (rank + progress bar + laden vs empty)
  - By Container Size (20/40/45 + %)
  - By Container Type (GP/HC/RF/OT — RF เน้นสีพิเศษ)
  - Hour Heatmap (24 ชั่วโมง — สีเข้มขึ้นตามปริมาณ)
  - By Operator (ผู้ดำเนินการ + จำนวน)
- [x] **Summary Gate Out Report** — เหมือนกัน แต่เป็นตู้ออก
- [x] **Export ทั้ง 3 แบบ**: 📄 PDF (jsPDF landscape + Sarabun Thai) / 📊 Excel (xlsx) / 🖶️ Print
- เข้าถึงที่: หน้า Gate → แท็บ "รายงาน"
- ไฟล์: `api/reports/gate/route.ts`, `gate/GateReportTab.tsx`, เพิ่มใน `lib/pdfExport.ts`

### 🧭 Reports Action Center (✅ เสร็จ — 21 พ.ค. 2569)
- [x] **Reconciliation จาก dashboard เป็น workflow** — หน้า `/reports` แท็บ Reconciliation แสดง exception row พร้อม deep link กลับไปหน้าแก้จริง (`/gate`, `/billing`, `/booking`, `/mnr`, `/edi`)
- [x] **Resolve / Ignore with reason** — แต่ละ row มีช่อง audit note, ปุ่ม Resolve และ Ignore; Ignore บังคับกรอกเหตุผล
- [x] **SLA aging** — คำนวณ `sla_age_days` จาก `created_at` แล้วทำ badge สีเขียว/เหลือง/แดงตามอายุรายการ
- [x] **Persistent action state** — เพิ่มตาราง `ReconciliationActions` ใน `scripts/migrate-runtime-core-schema.js`; API `PATCH /api/reports/reconciliation` upsert status `open/resolved/ignored`

### 🛡️ Supervisor Approval Inbox (✅ เสร็จ — 21 พ.ค. 2569)
- [x] **Approval inbox focus** — หน้า `/supervisor-review` มี panel จัดลำดับ pending review ตาม SLA, risk และ financial exposure ก่อนรายการตาราง
- [x] **SLA breach/critical summary** — helper `src/lib/approvalInbox.ts` คำนวณ `pending_total`, `breached_sla`, `critical_total`, `financial_exposure`, `oldest_hours` และ queue ตามกลุ่ม Billing/Gate/Yard/Survey
- [x] **Quick focus controls** — กดรายการเร่งด่วนหรือ group count เพื่อ filter ตารางไปที่งานที่ต้อง review ก่อน
- [x] **Unit test** — `approvalInbox.test.ts` ครอบคลุม priority ordering, SLA breach summary, critical count และ ignore รายการที่ไม่ pending
- [x] **Default view ซ่อนรายการปิดแล้ว** — GET overlay action state และนับเฉพาะ open rows ใน summary; มี `closed_count` เพื่อบอกว่าซ่อน resolved/ignored ไปกี่รายการ
- [x] **Audit trail** — PATCH เขียน `AuditLog` action `reconciliation_resolved` / `reconciliation_ignored`
- [x] **Tests** — `src/lib/__tests__/reconciliationActions.test.ts` + `src/app/api/__tests__/reports.test.ts` ครอบคลุม deep link, SLA, resolved/ignored filtering, และ PATCH action update

### 🛡️ Security Hardening (✅ เสร็จ)
- [x] **[P0] JWT Fail-Fast** — `proxy.ts` + `auth/me` ใช้ `getJwtSecret()` — throw ทันทีถ้าไม่ตั้งค่า `JWT_SECRET` (ไม่มี fallback `cyms-default-secret` อีกต่อไป)
- [x] **[P0] Users API RBAC** — `api/settings/users` เฉพาะ `yard_manager` (403 สำหรับ role อื่น) + audit actor จาก JWT token ไม่ใช่จาก body (ปลอมไม่ได้)
- [x] **[P1] Proxy Header Forwarding** — `passthrough()` ใน `proxy.ts` อ่าน cookie แล้ว forward เป็น custom header `x-cyms-token` + `x-user-id/x-user-role` — portal + role-check ทำงานได้ถูกต้อง
- [x] **[P1] Uploads Security** — `api/uploads` เพิ่ม: auth check + folder whitelist (`photos/damage/eir/mnr/documents`) + จำกัดไฟล์สูงสุด 5MB + เฉพาะ jpeg/png/webp/gif

### 🔐 Server-side RBAC Helper + Admin API Hardening (✅ เสร็จ — 21 พ.ค. 2569)
- [x] **Reusable API auth helper** — `src/lib/apiAuth.ts` เพิ่ม `getRequestActor`, `requireRequestActor`, `requireRole`, `requirePermission` เพื่อให้ route handler อ่าน actor จาก proxy headers (`x-user-id`, `x-user-role`, `x-customer-id`) รูปแบบเดียวกัน
- [x] **Permissions API hardening** — `api/settings/permissions` ทั้ง `GET/PUT` ต้องเป็น `yard_manager` ก่อนเปิด DB connection และ audit ใช้ actor จาก proxy header ไม่รับ `user_id` จาก body
- [x] **Customer master mutation hardening** — `api/settings/customers` เฉพาะ `POST/PUT/DELETE` ต้องเป็น `yard_manager` และ audit actor จาก proxy header; `GET` ยังเปิดให้ authenticated operational modules ใช้ lookup ลูกค้าใน Gate/Billing/M&R ได้
- [x] **Users API refactor** — `api/settings/users` เปลี่ยนมาใช้ helper กลางแทน local role parsing เพื่อลด logic ซ้ำ
- [x] **Tests เพิ่มเติม** — `src/lib/__tests__/apiAuth.test.ts` + `src/app/api/__tests__/settings-permissions.test.ts` รวม 8 tests ครอบคลุม actor parsing, role denial, granular permission lookup และ permission-toggle audit actor

### 🔍 Code Review Improvements (✅ เสร็จ)
- [x] DB Pool auto-reconnect — `pool.connected` check ก่อน return
- [x] AuthProvider token expiry check — `isTokenExpired()` ก่อน restore session
- [x] `autoAllocate.ts` เปลี่ยน `any` → `ConnectionPool`
- [x] `GateReportTab` เปลี่ยน `setTimeout(...,0)` → `useEffect`
- [x] Gate Reports API เพิ่ม Zod validation บน query params (type enum + date format + yard_id)
- [x] PATCH notifications ดึง user_id จาก JWT token ไม่ใช่จาก body
- [x] **ConfirmDialog component** (`src/components/ui/ConfirmDialog.tsx`)
  - 3 variants: 🔴 danger, 🟡 warning, 🔵 info
  - Backdrop blur + smooth animations (animate-in, zoom-in-95, fade-in)
  - Auto-focus cancel button + Escape key to dismiss
- [x] **Replaced `window.confirm()` ทั้งหมด** — 8 จุด ใน 7 ไฟล์:
  - `DemurrageTab.tsx` — ลบ rate
  - `CustomerMaster.tsx` — ลบลูกค้า
  - `YardsSettings.tsx` — ลบลาน + ลบโซน (×2)
  - `EDIConfiguration.tsx` — ลบ Endpoint
  - `RateLimitSettings.tsx` — ล้าง Rate Limit (warning variant)
  - `PrefixMapping.tsx` — ลบ prefix
  - `mnr/page.tsx` — ลบ CEDEX

### 🔒 SQL Injection Audit (✅ เสร็จ)
- [x] **ตรวจสอบ 20+ API route files** — ไม่พบช่องโหว่ SQL injection
- [x] ทุกไฟล์ใช้ `mssql` parameterized queries (`.input()` + `@param`) อย่างถูกต้อง
- [x] Dynamic WHERE clauses ปลอดภัย — ใช้ hardcoded condition strings (เช่น `'w.yard_id = @yardId'`)
- [x] ไม่พบ string concatenation, `sql` tagged templates, หรือ `.raw()` calls
- คำแนะนำ: เพิ่ม Zod validation ให้ route อื่นๆ (ปัจจุบันมีแค่ `gate/route.ts`)

### 🔒 Customer Branch SQL Hardening (✅ เสร็จ — 21 พ.ค. 2569)
- [x] **Fixed dynamic branch delete** — `api/settings/customers` ไม่ใช้ `branchIds.join(',')` จาก request body แล้ว
- [x] **Helper กลาง** — `src/lib/customerBranches.ts` เพิ่ม `parseBranchId`, `collectExistingBranchIds`, `deleteRemovedCustomerBranches`
- [x] **Validation** — `branch_id` ต้องเป็น positive integer เท่านั้น ถ้า invalid return 400 ก่อน query
- [x] **Parameterized NOT IN** — ใช้ placeholders `@branchId0`, `@branchId1`, ... พร้อม `.input()` แทนการฝังค่า raw ลง SQL
- [x] **Tests เพิ่มเติม** — `src/lib/__tests__/customerBranches.test.ts` รวม 4 tests ครอบคลุม malicious branch id, duplicate handling และ parameterized delete

### 🧱 Runtime DDL Migration (✅ เสร็จ — 21 พ.ค. 2569)
- [x] **ย้าย direct request-time DDL ออกจาก core API routes** — ลบ schema guard ที่ `ALTER TABLE` / `CREATE TABLE` / `COL_LENGTH` จาก `api/gate`, `api/billing/invoices`, `api/mnr`, `api/customers/360`, `api/settings/customers`
- [x] **Migration script กลาง** — เพิ่ม `scripts/migrate-runtime-core-schema.js` สำหรับเติม columns/tables ที่ core routes เคยสร้างเอง ได้แก่ `Containers.container_grade`, `BillingClearances`, invoice document columns, M&R extended columns, customer role/credit/branch columns, `CustomerBranches`, และ owner/billing columns บน `GateTransactions`
- [x] **Batch 2 source-wide cleanup** — ย้าย DDL ที่เหลือออกจาก `src/app/api` และ `src/lib` รวม shared helpers (`documentLifecycle`, `documentNumber`, `customerCredit`, `attachmentCenter`, `approvalReview`, `integrationLog`) และ routes ที่เคย auto-migrate เช่น `containers`, `billing/clearance`, `billing/reports`, `edi/codeco`, `edi/templates`, `mnr/cedex`, `mnr/eor-pdf`, `settings/*`
- [x] **Migration script ขยายครบ** — `scripts/migrate-runtime-core-schema.js` ตอนนี้ครอบคลุม DocumentSequences, DocumentLifecycle, EntityAttachments, ApprovalReviews, IntegrationLogs, ReconciliationActions, EDITemplates, CEDEXCodes, StorageRateTiers, PrefixMapping, SystemSettings, Company/Yard branch fields และ granular RBAC permission columns
- [x] **Static regression test** — `src/app/api/__tests__/no-runtime-ddl.test.ts` ตรวจ production source ทั้ง `src/app/api` และ `src/lib` ไม่ให้มี `CREATE TABLE` / `ALTER TABLE` ใน runtime path อีก
- [x] **Deploy note** — production/staging ต้องรัน `node scripts/migrate-runtime-core-schema.js` ก่อน deploy version นี้ หาก DB เก่ายังไม่มี schema เหล่านี้

### ✅ Billing/M&R Test Drift Cleanup (✅ เสร็จ — 21 พ.ค. 2569)
- [x] **Document number mock alignment** — `billing.test.ts` และ `mnr.test.ts` mock `@/lib/documentNumber.nextDocumentNumber` โดยตรง หลัง production route เปลี่ยนมาใช้ `DocumentSequences`
- [x] **ลบ query queue เก่า** — test ไม่จำลอง `COUNT(*)` เพื่อออกเลขเอกสารใน route แล้ว จึงไม่ consume mock result ผิดลำดับ
- [x] **Assertion เพิ่มเติม** — billing ตรวจ `grand_total` จาก VAT 7% และ M&R ตรวจ `order.eor_id` เพื่อให้จับ regression ของ insert output ได้จริง
- [x] **Full suite กลับมาเขียว** — ล่าสุด `npm test -- --runInBand` ผ่าน 374/374 tests ทั้ง 25 suites

### 🧪 Automated Testing (✅ เสร็จ)
- [x] **Jest + ts-jest** — ติดตั้งและตั้งค่า Jest สำหรับ Next.js + TypeScript (path alias `@/*`, jose ESM handling)
- [x] **5 Test Suites / 154 Tests** — ครอบคลุม business logic สำคัญทั้งหมดใน `src/lib/`:
  - `containerValidation.test.ts` — ISO 6346 check digit calculation, full validation (valid/invalid), parseSizeTypeCode (20 tests)
  - `utils.test.ts` — formatContainerNumber, getStatusColor (ทุก status), getStatusLabel ภาษาไทย (24 tests)
  - `validators.test.ts` — Zod schemas ทั้ง 7 ตัว: containerNumber, gate in/out, invoice, user, **customer (multi-role + edi_prefix refine)**, EDI endpoint (60 tests)
  - `auth.test.ts` — JWT create/verify round-trip, tamper detection, getRoleLabel, ROLES constant (16 tests)
  - `rateLimit.test.ts` — clearRateLimitStores, getRateLimitStats, getClientIP (x-forwarded-for, x-real-ip, fallback) (14 tests)
- [x] **คำสั่ง**: `npm test` (verbose) / `npm run test:watch` (watch mode)
- [x] **ผลลัพธ์**: 154/154 tests passed, ~0.7s execution time

### Master Setup (✅ 6 ข้อ เสร็จ)
- [x] Approval Hierarchy, EDI Config, Seal Master
- [x] Tiered Storage Rate — **เชื่อม DB จริง** (API GET/POST) + live preview, Auto-Allocation Rules, Equipment Rules

### 📋 Booking Feature (✅ เสร็จ — 7 Phases)
- [x] **Phase 1 — Database**: ตาราง `BookingContainers` (junction Booking↔Container) + คอลัมน์ใหม่ใน `Bookings` (`valid_from`, `valid_to`, `received_count`, `released_count`)
- [x] **Phase 2 — API**: `api/edi/bookings/route.ts` เพิ่ม progress fields + server-side pagination (`OFFSET/FETCH NEXT`, `page`/`limit` params), `api/bookings/containers/route.ts` [NEW] (GET/POST/DELETE), `api/gate/route.ts` auto-link Booking on Gate-In + update released_count on Gate-Out + auto-complete Booking
- [x] **Phase 3 — Dedicated Page**: `booking/page.tsx` 3 แท็บ (รายการ Booking + สร้าง/นำเข้า CSV/Excel + สรุป KPI), ย้ายออกจากหน้า EDI, Sidebar เมนูใหม่ "📋 Booking"
- [x] **Phase 4 — Gate Integration**: Gate-In/Out `booking_ref` fields auto-link ผ่าน API (ไม่ต้องแก้ UI เพิ่ม)
- [x] **Phase 5 — Yard Display**: `ContainerDetailModal.tsx` แสดง booking_ref อยู่แล้ว
- [x] **Phase 6 — RBAC**: 4 permissions ใหม่ (`bookings:create/read/update/delete`) + เพิ่มใน `PermissionsMatrix.tsx`, `gate_clerk` ได้ create/read/update
- [x] **Phase 7 — Gate-Out Picker + Progress**: Gate-Out แสดงรายการ Booking ที่เกี่ยวข้องกับตู้/เลข booking ให้พนักงานเลือกก่อนปล่อยออก พร้อมข้อความ progress `received/released` เช่น `จำนวนตู้: 3/5 received, 1/5 released`

**Booking Flow:**
1. สร้าง Booking (หรือ Import CSV/Excel) → status: `pending`
2. ยืนยัน → status: `confirmed`
3. Gate-In ระบุ `booking_ref` หรือระบบจับคู่จากเลขตู้/booking → auto-link ตู้เข้า `BookingContainers` + `received_count++`
4. Gate-Out เลือก Booking จาก picker/summary → API validate/link booking ก่อนปล่อยออก → update `released_count++` → ถ้าครบ → auto-complete
5. หน้า Booking และ Gate-Out แสดง progress รับเข้า/ปล่อยออก เพื่อดูได้ว่าแต่ละ booking ใช้งานไปเท่าไรแล้ว

**Pagination:**
- API: `GET /api/edi/bookings?page=1&limit=20` → returns `{ bookings, total, totalPages, page, limit }`
- UI: ปุ่มเลขหน้า (sliding window 5 ปุ่ม) + prev/next + "แสดง X–Y จาก Z รายการ"

### 📧 Booking Email Notifications (✅ เสร็จ)
- [x] **Real-time Email**: ส่ง email เมื่อ Booking เปลี่ยนสถานะ (confirmed/completed/cancelled) + ตู้ Gate-In/Out
  - ส่งไปที่ `Customers.contact_email` ของเจ้าของ Booking
  - ใช้ `emailService.ts` (Azure Graph API + SMTP fallback) ที่มีอยู่แล้ว
  - Toggle เปิด/ปิดที่ Settings → Email: "แจ้งเมื่อ Booking เปลี่ยนสถานะ"
  - Non-blocking: email error ไม่กระทบ transaction
- [x] **Daily Summary**: `bookingScheduler.ts` (node-cron) + `api/cron/booking-summary/route.ts`
  - ตั้งเวลาส่งได้ (dropdown HH:MM) ที่หน้า Settings → Email
  - สรุป KPI: Active, ใหม่, ยืนยัน, เสร็จ, ตู้รับ/ออกวันนี้
  - ปุ่ม "ส่งสรุปตอนนี้" + แสดง timestamp ส่งล่าสุด
  - Scheduler init ผ่าน `instrumentation.ts` + auto-reload เมื่อบันทึก Settings
- [x] **Email Templates**: `bookingStatusEmail()` (status badge + progress bar), `bookingDailySummaryEmail()` (6 KPI cards + table)

### 📄 Gate Email + EIR PDF (✅ เสร็จ)
- [x] **Gate Email Notification**: ส่ง email แจ้ง admin เมื่อมี Gate-In/Out พร้อมแนบ EIR PDF
  - `lib/eirPdfGenerator.ts`: สร้าง EIR PDF ฝั่ง server ด้วย jsPDF + Sarabun Bold
  - 4 sections: Container Info, Location, Transport, Signature Lines
  - แนบไฟล์ `EIR_{eir_number}.pdf` กับ email อัตโนมัติ
  - Toggle: Settings → Email → "แจ้งเมื่อมีตู้ Gate-In / Gate-Out"
  - Non-blocking: email error ไม่กระทบ gate transaction
- [x] **Fonts**: `public/fonts/Sarabun-Bold.ttf`, `Sarabun-Italic.ttf` (โหลดจาก filesystem, cache ใน memory)

### 📥 Booking Import Template (✅ เสร็จ)
- [x] ปุ่ม "ดาวน์โหลด Template (.xlsx)" ที่หน้า Booking → สร้าง/นำเข้า
  - 13 คอลัมน์: `booking_number`, `booking_type`, `vessel_name`, `voyage_number`, `container_count`, `container_size`, `container_type`, `eta`, `seal_number`, `container_numbers`, `valid_from`, `valid_to`, `notes`
  - ไฟล์ `.xlsx` พร้อม 2 แถวตัวอย่าง + auto-size columns
  - `container_numbers`: คั่นด้วย `,` ในช่องเดียว → split เป็น array → auto-link `BookingContainers`

### 🌐 Customer Portal (✅ เสร็จ)
- [x] **Database**: `scripts/migrate-customer-portal.js`
  - `Users.customer_id` (FK → Customers) — link user กับบริษัทลูกค้า
  - `Customers.is_portal_enabled` — toggle เปิด/ปิด Portal
  - ตรวจและสร้าง `customer` role อัตโนมัติ
- [x] **Auth & Security**:
  - `auth.ts`: เพิ่ม `customerId` ใน `UserPayload`
  - `login/route.ts`: ดึง `customer_id` จาก Users → ใส่ใน JWT
  - `middleware.ts`: guard `/api/portal/*` (ต้อง role = customer) + ส่ง `x-customer-id` header
  - Login page: redirect customer role → `/portal`
  - **Data isolation**: ทุก portal API ใช้ `customer_id` จาก JWT เท่านั้น (ไม่รับจาก query params)
- [x] **Portal API** (`api/portal/`):
  - `overview`: KPIs + container summary buckets ชุดเดียวกับ `/portal/containers` + ค้างชำระ/Booking active + recent gate activity
  - `containers`: customer inventory แบบ paginated + summary tiles + status/search filter + latest booking/EIR/open invoice context โดย visibility มาจาก `PortalEntityAccess` เท่านั้น
  - `invoices`: invoices + summary (outstanding/paid)
  - `bookings`: bookings + progress (received/container_count), customer-created pending booking requests, ETA status + empty return instruction metadata
  - `eir`: Portal-scoped EIR JSON สำหรับ modal A5 + ผลตรวจสภาพ โดยใช้ `PortalEntityAccess`
  - `document-bundle`: ZIP download รวม `statement.json`, invoice/receipt/CN PDF links และ EIR PDF links
  - `disputes`: POST dispute request ต่อ invoice โดย verify ownership จาก `x-customer-id`
- [x] **Portal UI** (`app/(portal)/`):
  - Layout: responsive sidebar (desktop) + hamburger (mobile), auto-redirect non-customer
  - Overview: 4 KPI cards + recent gate activity
  - Containers: customer inventory list แบบ mobile cards + desktop table, summary tiles, server-side search/status tabs, booking/EIR/invoice context, visibility reason, เปิด EIR A5 modal, ดูผลตรวจสภาพ 6 ด้าน และดาวน์โหลด PDF
  - Invoices: summary cards (ค้างชำระ/ชำระแล้ว) + table + pagination + Download bundle + Dispute modal
  - Bookings: cards with progress bar + vessel info + pagination + ETA badge + create booking modal + overview/activity panel + empty return instruction panel
- [x] **Admin — จัดการลูกค้า**:
  - API `api/settings/customers/portal/route.ts`: สร้างบัญชี Portal
  - `CustomerMaster.tsx`: ปุ่ม 🔑 (KeyRound) สร้างบัญชี → แสดง username/password ใน alert
  - Username = contact_email, Password = สุ่ม 8 ตัว, auto-enable `is_portal_enabled`

### 🔐 Portal Entity Access Grants (✅ เสร็จ — 21 พ.ค. 2569)
- [x] **Policy decision** — fix policy เข้าระบบก่อน ยังไม่ทำหน้า configurable policy เพื่อลดความเสี่ยง data leakage และลด complexity
- [x] **Source-of-truth ใหม่** — เพิ่ม `PortalEntityAccess` เก็บ explicit grant ต่อ `container` / `booking` / `gate_transaction` / `invoice` ด้วย `access_role` เช่น `owner`, `billing`, `booking_customer`, `invoice_customer`
- [x] **Backfill จาก model เดิม** — `scripts/migrate-runtime-core-schema.js` สร้าง table/indexes และเติม grants จาก `Bookings.customer_id`, `Containers.container_owner_id`, `GateTransactions.container_owner_id/billing_customer_id`, `Invoices.customer_id`, และ `BookingContainers`
- [x] **Helper กลาง** — `src/lib/portalAccess.ts` เพิ่ม `portalEntityAccessSql`, `portalBookingVisibilitySql`, `portalInvoiceVisibilitySql`, `portalContainerVisibilitySql`, `portalGateVisibilitySql` และ `portalVisibilityReasonSql`
- [x] **Write-time grants** — `portalEntityAccess.ts` upsert grant แบบ non-fatal ตอนสร้าง/แก้ booking, ผูกตู้กับ booking, สร้าง invoice/credit note/revised invoice, และสร้าง GateTransaction เพื่อให้ข้อมูลใหม่เห็นใน portal โดยไม่ต้อง rerun migration
- [x] **Portal APIs updated** — `api/portal/containers`, `overview`, `bookings`, `bookings/detail`, `invoices`, `statement`, `eir-pdf`, `invoice-pdf`, `document-bundle`, `disputes` ใช้ grant table แทน direct `customer_id` / owner/billing SQL
- [x] **Visibility reason** — Portal containers/bookings/invoices ส่ง `visibility_role` กลับให้ UI แสดงว่ารายการนี้เห็นเพราะ `owner`, `billing`, `booking_customer`, หรือ `invoice_customer`
- [x] **Admin reconciler** — เพิ่ม `src/lib/portalGrantReconciler.ts` + `GET/POST /api/portal/grants/reconcile` สำหรับ `yard_manager` เท่านั้น: preview missing/stale grants แล้ว repair โดย insert grants ที่ควรมี และ deactivate เฉพาะ stale grants ที่มาจาก managed source tables (`Bookings`, `BookingContainers`, `Containers`, `GateTransactions`, `Invoices`) พร้อม audit `portal_grants_reconcile_repair`
- [x] **Migration รันแล้วบน DB จริง** — `node scripts/migrate-runtime-core-schema.js` ผ่านหลัง aggregate duplicate container grants ให้เหลือหนึ่ง grant ต่อ `(customer, entity, role)`
- [x] **Tests เพิ่มเติม** — `portalAccess.test.ts`, `portalEntityAccess.test.ts`, `portalGrantReconciler.test.ts`, `portal-containers.test.ts`, `portal-bookings.test.ts`, `portal-features.test.ts`, `portal-grant-reconcile.test.ts` ครอบคลุม grant-based SQL, write-time grant helper, reconciler และ portal route policy
- ทำหน้า configurable policy ภายหลังเมื่อมี use case จริง เช่น shipping line/forwarder/trucker/shipper ต้องเห็นข้อมูลคนละ scope โดยต้องมี admin-only + audit + preview affected records + default deny

### 🔄 Portal Enhancements — Auto-refresh & Self-service PDF (✅ เสร็จ)
- [x] **Auto-refresh Polling (30 วินาที)**:
  - Overview: `setInterval(fetchData, 30000)` + refresh button + last updated timestamp
  - Containers: เหมือนกัน — ลูกค้าเห็น status update ทุก 30s
- [x] **Self-service PDF Downloads**:
  - `api/portal/eir-pdf`: EIR PDF download (reuse `eirPdfGenerator.ts`, ตรวจสิทธิ์ผ่าน `PortalEntityAccess`, ส่ง condition/grade/damage_report เข้า PDF)
  - `api/portal/invoice-pdf`: Invoice PDF with Thai font (jsPDF + Sarabun, ตรวจสิทธิ์ผ่าน `PortalEntityAccess`)
  - Overview: ลิงก์ "EIR PDF" ที่ทุกแถว gate activity
  - Invoices: ปุ่ม "PDF" ทุกแถว (ทั้ง mobile cards + desktop table)
- [x] **Data Isolation**: ทุก PDF endpoint ใช้ `PortalEntityAccess` — ลูกค้าดาวน์โหลดได้เฉพาะเอกสารที่มี grant เท่านั้น

### 📄 Customer Portal EIR + Inspection Parity (✅ เสร็จ — 21 พ.ค. 2569)
- [x] **Portal-scoped EIR JSON** — เพิ่ม `GET /api/portal/eir?eir_number=` ให้คืน payload แบบเดียวกับ `/api/gate/eir` แต่บังคับสิทธิ์ผ่าน `PortalEntityAccess` (`gate_transaction` + container linkage) และส่ง `lifecycle`
- [x] **Shared EIR payload** — เพิ่ม `src/lib/eirPayload.ts` สำหรับ parse `damage_report`, คำนวณ `container_condition`, `container_grade`, company profile และ document lifecycle เพื่อลด drift ระหว่าง main/portal
- [x] **EIR modal เหมือนหน้าหลัก** — หน้า `/portal/containers` กด `ดู` แล้วเปิด `EIRDocument` A5 modal ตัวเดียวกับฝั่งพนักงาน แทนการ download PDF อย่างเดียว
- [x] **EIR In/Out actions** — Container inventory แสดงเอกสาร `EIR In` และ `EIR Out` แยกกัน ถ้ามีทั้งขาเข้า/ขาออก โดยตัวปุ่ม `EIR In/Out` เปิดเอกสารทันที และ `ผลตรวจ` เป็น action รอง; ถอดปุ่ม PDF ออกจากหน้า Containers
- [x] **Inspection panel** — เพิ่ม `PortalInspectionModal` แบบ read-only: 6-side SVG, damage point marker, severity, inspector note, photo evidence และ photo completeness
- [x] **PDF parity** — `api/portal/eir-pdf` ส่ง condition/grade/damage_report เข้า `eirPdfGenerator`; PDF มี section Container Inspection + damage summary

**Verify ล่าสุด:**
- `npm test -- src/app/api/__tests__/portal-eir.test.ts --runInBand` ✅ (2 tests)
- `npm test -- src/app/api/__tests__/portal-ui.test.ts --runInBand` ✅ (2 tests)
- `npm test -- src/app/api/__tests__/portal-containers.test.ts --runInBand` ✅ (3 tests)
- `npm test -- src/app/api/__tests__/portal-eir.test.ts src/app/api/__tests__/portal-containers.test.ts src/app/api/__tests__/portal-overview.test.ts --runInBand` ✅ (6 tests)
- `npm test -- --runInBand` ✅ (49 suites / 524 tests)
- `npx tsc --noEmit --pretty false` ✅
- `npm run lint` ✅

### 📋 Customer Portal Booking Requests + Activity (✅ เสร็จ — 22 พ.ค. 2569)
- [x] **Customer-created booking request** — เพิ่ม `POST /api/portal/bookings` สำหรับ customer role โดยอ่าน `customer_id` จาก `x-customer-id` เท่านั้น ไม่รับจาก body, บังคับสถานะเริ่มต้น `pending`, และ insert ลง `Bookings` เดิมเพื่อให้พนักงานรับต่อในหน้า `/booking`
- [x] **Portal grants ตอนสร้าง** — หลังสร้าง booking จะ upsert `PortalEntityAccess` ให้ลูกค้าเห็น booking ตัวเองทันที (`booking_customer`); ถ้ามีเลขตู้ล่วงหน้าจะสร้าง `BookingContainers` และ grant container ref แบบ `booking_customer`
- [x] **Create booking modal** — หน้า `/portal/bookings` เพิ่มปุ่ม `สร้าง Booking` พร้อมฟอร์มเลข booking, ประเภท, จำนวน/ขนาด/ประเภทตู้, ETA, vessel/voyage, seal, container numbers และ notes โดยส่ง `yard_id` จาก active yard ใน session
- [x] **Booking overview** — detail modal เพิ่ม `ภาพรวม Booking`: จำนวนที่ขอ, เข้าลานแล้ว, ออกลานแล้ว, คงเหลือ, ETA, progress Gate In/Gate Out และข้อความ `รอพนักงานยืนยัน` สำหรับ pending request
- [x] **Container activity** — เปลี่ยนตารางตู้ใน booking เป็น `กิจกรรมตู้ใน Booking` แสดงสถานะตู้, รับเข้า booking, Gate In, Gate Out และลิงก์ EIR In/Out ที่ลูกค้ามีสิทธิ์ดู
- [x] **Customer read-only audit trail** — เพิ่ม `GET /api/portal/timeline` สำหรับ booking/container timeline โดยใช้ `PortalEntityAccess` ตรวจสิทธิ์ก่อนทุกครั้ง และหน้า `/portal/bookings` detail แสดง panel `Audit Trail` แบบ read-only รวม gate events, reefer checks และ reefer exceptions
- [x] **Staff booking approval inbox** — เพิ่ม `GET/PATCH /api/edi/bookings/approval` สำหรับพนักงานที่มี `booking.manage` เท่านั้น: list pending booking ที่ลูกค้าสร้าง, approve → `confirmed`, reject → `cancelled`, request info → คง `pending` พร้อม note; บังคับ `requireYardAccess()` และ audit `booking_approval_*`
- [x] **EDI approval tab** — หน้า `/edi` เพิ่ม tab `Booking Approval` แสดง pending/RF pending, รายละเอียดลูกค้า/ETA/จำนวนตู้ และ action `อนุมัติ`, `ขอข้อมูล`, `ปฏิเสธ`
- [x] **Customer booking amendment workflow** — เพิ่ม `PortalBookingAmendments`, `POST/GET /api/portal/bookings/amendments` และ `GET/PATCH /api/edi/bookings/amendments`; ลูกค้าขอแก้ไข/ยกเลิกได้เฉพาะ booking ที่มี `PortalEntityAccess`, สถานะเริ่ม `pending`, และ backend พนักงานเท่านั้นที่ apply change เข้า `Bookings` พร้อม audit `booking_amendment_*`
- [x] **Portal amendment UI + staff inbox** — หน้า `/portal/bookings` detail เพิ่มปุ่ม `ขอแก้ไข Booking` / `ขอยกเลิก Booking`; หน้า `/edi` เพิ่ม panel `Amendment Requests` ให้พนักงาน approve/reject ก่อนข้อมูลจริงเปลี่ยน
- [x] **Customer booking document upload** — เพิ่ม `GET/POST /api/portal/bookings/documents` ให้ลูกค้าแนบเอกสารกับ booking ที่ตนมี grant เท่านั้น โดยบันทึกลง `EntityAttachments` ด้วย `source='portal'`; หน้า `/portal/bookings` detail เพิ่ม `เอกสารที่ส่งแล้ว` + upload image/PDF และหน้า `/edi` เพิ่ม `Customer Documents` ให้พนักงานเปิดดูประกอบการอนุมัติ
- [x] **Tests** — เพิ่ม coverage ใน `portal-bookings.test.ts` เพื่อยืนยัน pending creation + session customer scope + portal grants และ `portal-ui.test.ts` เพื่อกัน UI ถอยกลับเป็น read-only

**Verify ล่าสุด:**
- `npm test -- src/app/api/__tests__/portal-booking-documents.test.ts src/app/api/__tests__/portal-ui.test.ts src/app/api/__tests__/booking-approval-ui.test.ts --runInBand` ✅ (9 tests)
- `npm test -- src/app/api/__tests__/portal-booking-amendments.test.ts src/app/api/__tests__/portal-ui.test.ts src/app/api/__tests__/booking-approval-ui.test.ts --runInBand` ✅
- `npm test -- src/app/api/__tests__/portal-timeline.test.ts src/app/api/__tests__/portal-ui.test.ts --runInBand` ✅ (6 tests)
- `npm test -- src/app/api/__tests__/booking-approval-inbox.test.ts src/app/api/__tests__/booking-approval-ui.test.ts --runInBand` ✅ (3 tests)
- `npm test -- src/app/api/__tests__/portal-bookings.test.ts src/app/api/__tests__/portal-ui.test.ts --runInBand` ✅ (5 tests)
- `npm test -- --runInBand` ✅ (49 suites / 524 tests)
- `npx tsc --noEmit --pretty false` ✅
- `npm run lint` ✅

### 🌡️ Reefer Temperature Monitoring (✅ เสร็จ — 22 พ.ค. 2569)
- [x] **Policy รอบตรวจที่กำหนดได้** — เพิ่ม `ReeferCheckPolicies` ใช้ priority แบบ server-side: `container > booking > customer > yard > default`; ตั้ง `interval_hours`, `warning_grace_minutes`, `min_temp_c`, `max_temp_c`
- [x] **คิวตรวจฝั่งพนักงาน** — หน้า `/reefer` แสดงตู้ `RF` ในลาน, latest temperature, due/overdue/not checked, booking context และปุ่ม `บันทึกอุณหภูมิ`
- [x] **บันทึกอุณหภูมิ + รูปหลักฐาน** — `POST /api/reefer/checks` อ่าน `container/customer/booking` จาก DB เท่านั้น ไม่รับ customer จาก body, บันทึก measured/set/supply/return °C, status, notes, photo_url และ policy snapshot พร้อม audit `reefer_check_record`
- [x] **Portal read-only tracking** — หน้า `/portal/reefer` + `GET /api/portal/reefer` ให้ลูกค้าเห็นเฉพาะตู้ RF ที่มี `PortalEntityAccess` grant, ดู latest check และประวัติ/รูปหลักฐานได้แบบ read-only
- [x] **RBAC/yard guard** — เพิ่ม permission `reefer.check.read`, `reefer.check.record`, `reefer.policy.manage`; API พนักงานบังคับ `requireYardAccess()` และ permission ฝั่ง server
- [x] **Migration** — `scripts/migrate-runtime-core-schema.js` สร้าง `ReeferCheckPolicies`, `ReeferTemperatureChecks`, indexes และ default policy ทุก 4 ชม. + grace 30 นาที
- [x] **Exception workflow** — เพิ่ม `ReeferExceptions` และ `GET/PATCH /api/reefer/exceptions`; เมื่อ check เป็น `out_of_range`, `unreadable`, หรือ `power_issue` ระบบเปิด exception อัตโนมัติ พร้อม severity/action แนะนำ และหน้า `/reefer` มี action `รับทราบ`, `ปิดงาน`, `Ignore`
- [x] **RBAC เพิ่มเติม** — เพิ่ม `reefer.exception.manage` ให้ supervisor/surveyor/yard_manager เพื่อรับทราบและปิด exception โดยยังบังคับ yard access ฝั่ง server
- [x] **Mobile/offline walk mode** — หน้า `/reefer` เพิ่ม `โหมดเดินตรวจ` สำหรับสแกน/ค้นเลขตู้, filter `ต้องตรวจ / Exception / ทั้งหมด`, และเปลี่ยนการบันทึกเป็น `offlineFetch('/api/reefer/checks', ..., { operation: 'reefer_check' })` เพื่อ queue เมื่อ offline พร้อมแจ้งสถานะ queued ให้พนักงาน
- [x] **Reefer compliance reports** — เพิ่ม `GET /api/reports/reefer` พร้อม `reports.view` + `requireYardAccess()`: summary compliance rate, trend ตามช่วงวันที่, open exceptions, และสรุปตามลูกค้า; หน้า `/reports` เพิ่ม tab `Reefer Compliance` สำหรับ supervisor/manager ดูภาพรวมงานตู้เย็น
- [x] **Reefer check SLA dashboard** — `GET /api/reports/reefer` เพิ่ม `sla` summary (`total_open`, `overdue_exceptions`, `critical_breaches`, `unacknowledged_open`, `avg_resolution_minutes`) และ enrich `openExceptions` ด้วย escalation metadata; หน้า `/reports` แสดง KPI `SLA Breach`, `Open SLA`, `ยังไม่รับทราบ`, `Avg Close` พร้อม column SLA ต่อ exception
- [x] **RF booking policy + plug planning** — เพิ่ม `ensureReeferBookingPolicy()` ให้ portal/staff booking ที่ `container_type=RF` auto-create `ReeferCheckPolicies` scope `booking` แบบ idempotent; เพิ่ม `GET /api/reefer/plug-plan` สำหรับ plug capacity/current RF/upcoming RF/projected shortage และหน้า `/reefer` แสดง panel `Plug Planning`
- [x] **Actual reefer plug capacity** — เพิ่ม `YardZones.plug_capacity` และช่อง `จำนวนปลั๊กจริง` ใน Settings > สาขาลานและโซน; plug plan ใช้ค่านี้เป็น source of truth ถ้าตั้งไว้ และ fallback เป็น `max_bay × max_row` สำหรับ zone เก่า/ยังไม่กรอก
- [x] **Staff reefer check history** — `GET /api/reefer/checks?yard_id=&container_id=` ส่ง `history` 100 รายการล่าสุดแบบ yard-scoped + permission `reefer.check.read`; หน้า `/reefer` เพิ่มปุ่ม `ประวัติ` ต่อแถว เปิด modal แสดง summary, timeline อุณหภูมิ measured/set/supply/return, ผู้ตรวจ, note, รูปหลักฐาน และ exception context ให้พนักงานดูย้อนหลังได้เหมือน Portal แต่มีข้อมูลปฏิบัติการมากกว่า
- [x] **Reefer walk position display** — `GET /api/reefer/checks` ส่ง `zone_name`, `bay`, `row`, `tier`; หน้า `/reefer` แสดง `ตำแหน่งปัจจุบัน` ในคิวเดินตรวจ, modal บันทึกอุณหภูมิ และ modal ประวัติ เพื่อให้พนักงานหา RF container ได้เร็วขึ้น (`Zone R1 · Bay 04 · Row 02 · Tier 01` หรือ fallback `ยังไม่ระบุ slot`)
- [x] **Customer portal notifications** — เพิ่ม `GET /api/portal/notifications` ที่ใช้ `PortalEntityAccess`/portal visibility เดิมเท่านั้น เพื่อแจ้งลูกค้าเรื่อง open reefer exception และ booking status ล่าสุด; หน้า `/portal` เพิ่ม panel `การแจ้งเตือนล่าสุด` พร้อม deep-link ไป `/portal/reefer` หรือ `/portal/bookings`
- [x] **Escalation rule** — เพิ่ม `deriveReeferEscalation()` แบบ server-side policy โดยไม่เพิ่ม schema: `critical` breach หลัง 30 นาที, `high` 120 นาที, `medium` 240 นาที, `low` 480 นาที; `GET /api/reefer/exceptions` และคิวหน้า `/reefer` ส่ง/แสดง `escalation_level`, `breached`, due/age minutes เพื่อให้ supervisor เห็นงานที่ต้องเร่งทันที
- [x] **Customer notification preferences** — เพิ่ม `PortalNotificationPreferences` + `GET/PUT /api/portal/notification-preferences`; ใช้ customer id จาก portal session/header เท่านั้น, default เปิดทุกประเภท และ `GET /api/portal/notifications` filter ฝั่ง server ตาม preference พร้อม fallback default ถ้ายังไม่ได้ migrate

**Verify ล่าสุด:**
- `npm test -- src/app/api/__tests__/reefer-api.test.ts src/app/api/__tests__/reefer-ui.test.ts --runInBand --cacheDirectory ./.next/jest-cache` ✅ (6 tests)
- `npm test -- src/app/api/__tests__/reefer-plug-plan.test.ts src/app/api/__tests__/yard-zone-plug-capacity.test.ts --runInBand --cacheDirectory ./.next/jest-cache` ✅ (3 tests)
- `node scripts/migrate-runtime-core-schema.js` ✅ (เพิ่ม `YardZones.plug_capacity` และ rerun schema guards)
- `npx tsc --noEmit --pretty false` ✅
- `npm run lint` ✅
- `npm test -- src/app/api/__tests__/reefer-reports.test.ts --runInBand` ✅ (3 tests)
- `npm test -- src/app/api/__tests__/portal-notification-preferences.test.ts src/app/api/__tests__/portal-notifications.test.ts src/app/api/__tests__/portal-ui.test.ts --runInBand` ✅ (8 tests)
- `npm test -- src/lib/__tests__/reeferEscalation.test.ts src/app/api/__tests__/reefer-exceptions.test.ts src/app/api/__tests__/reefer-ui.test.ts --runInBand` ✅ (8 tests)
- `npm test -- src/app/api/__tests__/reefer-ui.test.ts --runInBand` ✅ (2 tests)
- `npm test -- src/app/api/__tests__/reefer-reports.test.ts src/app/api/__tests__/yard-access-guard.test.ts --runInBand` ✅ (35 tests)
- `npm test -- src/lib/__tests__/reeferBookingPolicy.test.ts src/app/api/__tests__/reefer-plug-plan.test.ts src/app/api/__tests__/reefer-ui.test.ts src/app/api/__tests__/portal-bookings.test.ts src/app/api/__tests__/yard-access-guard.test.ts --runInBand` ✅ (44 tests)
- `npm test -- src/app/api/__tests__/portal-notifications.test.ts src/app/api/__tests__/portal-ui.test.ts --runInBand` ✅ (5 tests)
- `npm test -- src/lib/__tests__/reeferMonitoring.test.ts src/app/api/__tests__/reefer-api.test.ts src/app/api/__tests__/reefer-ui.test.ts src/app/api/__tests__/yard-access-guard.test.ts --runInBand` ✅ (38 tests)
- `npm test -- src/lib/__tests__/reeferExceptions.test.ts src/app/api/__tests__/reefer-exceptions.test.ts src/app/api/__tests__/reefer-ui.test.ts src/app/api/__tests__/yard-access-guard.test.ts --runInBand` ✅ (38 tests)
- `node scripts/migrate-runtime-core-schema.js` ✅ (สร้าง/seed reefer tables + permissions)
- `npx tsc --noEmit --pretty false` ✅
- `npm run lint` ✅
- `npm test -- --runInBand` ✅ (54 suites / 546 tests)
- HTTP smoke: `http://localhost:3005/reefer` และ `http://localhost:3005/portal/reefer` คืน 200 ✅

### 📦 Customer Portal Container Inventory (✅ เสร็จ — 21 พ.ค. 2569)
- [x] **API inventory context** — `GET /api/portal/containers` ใช้ fixed server-side visibility ผ่าน `PortalEntityAccess` แล้ว enrich รายการตู้ด้วย latest booking, EIR gate-in/gate-out แยกกัน, open invoice count/amount, dwell days และ `visibility_role` สำหรับ backend/debug
- [x] **Server-side search/filter** — รองรับ `search`, `status`, `page`, `limit` แบบ parameterized และส่ง `summary` กลับมาสำหรับ total/in-yard/released/on-hold/repair
- [x] **Overview alignment** — `api/portal/overview` และ `api/portal/containers` ใช้ `portalContainerSummary.ts` ชุดเดียวกัน: `released` รวม `released` + `gated_out`, และส่ง `on_hold`/`repair` เหมือนกัน
- [x] **Schema-safe gate context** — latest gate ในหน้า Containers lookup ผ่าน `GateTransactions.container_id` เท่านั้น ไม่อ้าง `g.container_number` ที่ไม่มีใน DB จริง
- [x] **Portal UI inventory view** — หน้า `/portal/containers` เพิ่ม summary tiles, status tabs, search debounce, auto-refresh 30 วินาที และตาราง/การ์ดที่แสดงบริบทตู้พร้อม EIR In/Out modal + inspection actions หรือไปหน้า invoice; ไม่แสดงคอลัมน์ `visibility_role` ให้ลูกค้า
- [x] **Policy ยืนยัน** — ลูกค้าเห็นตู้จาก grant เท่านั้น โดย grant มาจาก owner/billing/booking/invoice linkage ฝั่ง backend; ไม่รับ customer id จาก query/body และไม่เปิด configurable policy ในรอบนี้

**Verify ล่าสุด:**
- `npm test -- src/app/api/__tests__/portal-overview.test.ts src/app/api/__tests__/portal-containers.test.ts --runInBand` ✅ (4 tests)
- API check จริงด้วย customer token: `/api/portal/overview` และ `/api/portal/containers?limit=5` คืน `summary` ตรงกัน ✅
- `npm test -- --runInBand` ✅ (47 suites / 516 tests)
- `npx tsc --noEmit --pretty false` ✅
- `npm run lint` ✅

### 📦 Customer Portal Self-Service Bundle + Dispute (✅ เสร็จ — 21 พ.ค. 2569)
- [x] **Document bundle download** — `GET /api/portal/document-bundle` สร้าง ZIP แบบไม่พึ่ง dependency เพิ่ม โดยมี `statement.json`, `invoices.csv`, `eir-documents.csv` พร้อมลิงก์ PDF ที่ผ่าน portal scope เดิม
- [x] **Invoice dispute request** — `POST /api/portal/disputes` ตรวจ invoice grant ผ่าน `PortalEntityAccess` ก่อน insert ลง `PortalDisputes`; UI หน้า Invoices มี modal เลือกประเภทและข้อความ
- [x] **Booking ETA** — `portalBooking.ts` คำนวณ `eta_status` (`today/soon/overdue/scheduled/completed/no ETA`) และส่งให้ `/api/portal/bookings` + detail
- [x] **Empty return instruction** — booking type `empty_return` ได้คำแนะนำ/cut-off/steps ใน API และแสดง panel ใน booking detail
- [x] **Migration** — `scripts/migrate-runtime-core-schema.js` เพิ่มตาราง `PortalDisputes` + `PortalEntityAccess` + indexes และรันแล้วบน DB จริง
- [x] **Tests** — `portalBooking.test.ts`, `portalDocumentBundle.test.ts`, `portal-features.test.ts` ครอบคลุม helper, ZIP smoke test, dispute ownership check และ bundle route

### 👥 User Management UX (✅ เสร็จ)
- [x] **Tab-based Filtering**: 3 แท็บ (ทั้งหมด / 👤 พนักงาน / 🏢 ลูกค้า) + count badges
- [x] **Search**: ค้นหาด้วยชื่อหรือ username
- [x] **Pagination**: 10 รายการ/หน้า + page numbers + ellipsis + info text
- [x] **Delete**: ปุ่มลบ + ConfirmDialog + FK cleanup (UserYardAccess) + ป้องกันลบตัวเอง
- [x] **Company Badge**: แสดง 🏢 ชื่อบริษัทใต้ username สำหรับ customer users
- [x] **Sectioned Form**: แบ่งฟอร์มเป็น 3 ส่วน (Account / Personal / Role & Permissions)
- [x] **Yard Checkboxes**: multi-select checkbox + "เลือกทั้งหมด" สำหรับกำหนดลานเข้าถึง

### 🔐 EIR Number Security Hardening (✅ เสร็จ)
- [x] **ปัญหา**: EIR page เป็น public (QR scan access) + EIR number เป็นเลขเรียงลำดับ → เดาได้
- [x] **แก้ไข**: เพิ่ม random 6-char hex suffix
  - ก่อน: `EIR-IN-2026-000001` (guessable)
  - หลัง: `EIR-IN-2026-000001-a3f8b2` (16^6 = ~16M ความเป็นไปได้)
  - ใช้ `crypto.randomUUID().slice(0,6)` — ทุกใบมี hex เฉพาะตัว
  - Lookup ด้วย full string → เปลี่ยนแค่เลขลำดับ + hex ไม่ตรง → 404
- [x] **Transfer numbers**: ใช้ format เดียวกัน `TRF-YYYY-XXXXXX-randomhex`

### 🔐 Password Policy & Account Lockout (✅ เสร็จ)

**ไฟล์ที่เกี่ยวข้อง:**
- `src/lib/passwordPolicy.ts` — validation logic + strength meter + config loader
- `src/lib/totp.ts` — RFC 6238 TOTP generation/verification + otpauth URI
- `src/lib/deviceBinding.ts` — trusted browser device policy + device id validation
- `src/app/api/settings/security/route.ts` — GET policy+locked users, PUT update config/unlock
- `src/app/api/auth/login/route.ts` — lockout enforcement (count, lock, auto-unlock)
- `src/app/api/auth/2fa/route.ts` — 2FA status/setup/verify/disable สำหรับ user ปัจจุบัน
- `src/app/api/settings/users/route.ts` — password validation on create/update, unlock action, reset device binding
- `src/app/(dashboard)/settings/SecuritySettings.tsx` — Admin UI แท็บ "ความปลอดภัย"
- `src/app/(dashboard)/settings/UsersSettings.tsx` — User CRUD + password policy hints/validation + password reset unlock behavior
- `src/app/login/page.tsx` — lockout feedback (remaining time, attempts warning) + TOTP challenge input
- `scripts/migrate-password-policy.js` — DB migration
- `scripts/migrate-runtime-core-schema.js` — เติม `two_fa_*` + `bound_device_mac` columns ใน Users table

**Password Policy (configurable via Admin UI):**
- [x] ความยาวขั้นต่ำ (default 8, range 6-32)
- [x] บังคับตัวพิมพ์ใหญ่ (A-Z) — toggle
- [x] บังคับตัวพิมพ์เล็ก (a-z) — toggle
- [x] บังคับตัวเลข (0-9) — toggle
- [x] บังคับอักขระพิเศษ (!@#$%...) — toggle
- [x] Real-time password strength meter (4 ระดับ: อ่อนมาก/อ่อน/ปานกลาง/แข็งแรง)
- [x] UsersSettings แสดง policy ที่ใช้จริง, ตัวอย่างรหัสผ่าน, show/hide password, client-side validation และ error รายข้อจาก backend

**Account Lockout:**
- [x] นับ failed login attempts ต่อ user
- [x] ล็อคอัตโนมัติเมื่อถึง max (default 5 ครั้ง, configurable 3-20)
- [x] Auto-unlock หลังหมดเวลา (default 30 นาที, configurable 5-1440)
- [x] Admin ปลดล็อคได้จาก 2 ที่: SecuritySettings tab + UsersSettings inline button
- [x] Admin reset password จาก UsersSettings แล้ว reset `failed_login_count` + `locked_at` อัตโนมัติ เพื่อให้ user ลอง login ใหม่ได้ทันที
- [x] Login page แสดง countdown + remaining attempts warning (≤ 3 ครั้ง)
- [x] Reset counter เป็น 0 เมื่อ login สำเร็จ
- [x] `locked_at` พร้อม lockout badge 🔒 ใน Users table

**Two-Factor Authentication (TOTP):**
- [x] ผู้ใช้เปิดใช้ 2FA ได้จาก Settings → Security โดยสแกน QR/secret ด้วย authenticator app
- [x] Login ตรวจ password ก่อน จากนั้นถ้า user เปิด 2FA จะ return `requires_2fa` และรอรหัส 6 หลักก่อนออก JWT/cookie
- [x] Verify ใช้ TOTP time-step 30 วินาที + adjacent window เพื่อรองรับ clock drift เล็กน้อย
- [x] Disable ต้องกรอกรหัส TOTP ปัจจุบันก่อนล้าง secret
- [x] Audit log ครอบคลุม setup started, enabled, disabled

**Trusted Device Binding:**
- [x] ใช้ browser device id แบบสุ่มจาก `AuthProvider` ส่งเป็น `device_id` ตอน login (ไม่ใช้ MAC address จริง เพราะ browser อ่าน MAC ไม่ได้)
- [x] Policy อยู่ใน Settings → Security: เปิด/ปิด, auto-bind อุปกรณ์แรก, เลือก role ที่ต้อง enforce
- [x] ค่า default ปิดอยู่ แต่ถ้าเปิดจะ enforce role `rs_driver` เป็นค่าเริ่มต้น
- [x] ถ้า user มี binding แล้วและ `device_id` ไม่ตรง จะ reject login ด้วย `403 device_mismatch`
- [x] Admin ล้าง binding ได้จาก UsersSettings เพื่อให้ user ผูก browser/device ใหม่

**DB Columns (Users table):**
```sql
failed_login_count  INT DEFAULT 0          -- จำนวน login ผิดติดต่อกัน
locked_at           DATETIME2 NULL         -- เวลาที่ถูกล็อค (NULL = ไม่ถูกล็อค)
password_changed_at DATETIME2 NULL         -- เวลาเปลี่ยนรหัสผ่านล่าสุด
two_fa_enabled      BIT DEFAULT 0          -- เปิด/ปิด TOTP 2FA
two_fa_secret       NVARCHAR(128) NULL     -- Base32 secret สำหรับ authenticator app
two_fa_confirmed_at DATETIME2 NULL         -- เวลา verify เปิด 2FA สำเร็จ
bound_device_mac    NVARCHAR(128) NULL     -- Trusted browser device id (legacy column name)
notif_last_read_at  DATETIME2 NULL         -- เวลาที่อ่านการแจ้งเตือนล่าสุด (ซิงค์ข้าม browser)
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

**Verify ล่าสุด:**
- `npm test -- src/app/api/__tests__/settings-users-device-binding.test.ts --runInBand` ✅ (2 tests)
- `npm test -- --runInBand` ✅ (46 suites / 514 tests)
- `npx tsc --noEmit --pretty false` ✅
- `npm run lint` ✅

### 🚚 Inter-Yard Transfer Hardening (✅ เสร็จ)

**ไฟล์ที่เกี่ยวข้อง:**
- `src/lib/autoAllocate.ts` — shared smart allocation module (แยกจาก gate/route.ts)
- `src/app/api/gate/transfer/route.ts` — send transfer (fix column name + to_yard_id + audit)
- `src/app/api/gate/transfer/receive/route.ts` — receive transfer (smart allocate + to_yard_id filter + fix column)
- `src/app/(dashboard)/gate/TransferTab.tsx` — toast feedback + user_id
- `scripts/migrate-transfer-yard.js` — DB migration (to_yard_id column + backfill)

**แก้ไข 6 จุด:**
- [x] **Column name** — `row_pos` → `[row]` (ตรงกับ schema)
- [x] **to_yard_id** — เพิ่ม column ใน GateTransactions เพื่อ filter ตู้ที่กำลังมุ่งหน้าไปลานปลายทาง
- [x] **Notes structure** — เก็บ `to_yard_id` ใน column แยก + user notes เป็น structured JSON
- [x] **Smart auto-allocate** — Transfer receive ใช้ `autoAllocate()` เดียวกับ Gate-In (size/type/reefer/line/spread)
- [x] **Audit user_id** — ส่ง user_id จาก frontend + เก็บใน AuditLog
- [x] **Toast feedback** — แสดง toast เมื่อส่ง/รับตู้สำเร็จ

**Shared module `src/lib/autoAllocate.ts`:**
- แยก autoAllocate() ออกจาก gate/route.ts เป็น shared lib
- ใช้ร่วมกันทั้ง Gate-In และ Transfer Receive
- พิจารณา: size segregation, reefer/DG zone, shipping line grouping, spread-even, nearest-gate, max tier

### 🔄 Next.js 16 Proxy Migration + Auth Session Fix (✅ เสร็จ)

**ไฟล์ที่เกี่ยวข้อง:**
- `src/proxy.ts` — Next.js 16 Proxy (แทนที่ `middleware.ts` ซึ่ง deprecated ใน Next.js 16)
- `src/app/api/auth/me/route.ts` — Session restore endpoint (แก้ SQL bug)
- `src/app/api/auth/login/route.ts` — Login + httpOnly cookie

**Next.js 16 Proxy Migration:**
- [x] เปลี่ยนจาก `middleware.ts` → `proxy.ts` ตามมาตรฐาน Next.js 16
- [x] Export function `proxy()` แทน `middleware()`
- [x] **Page Guard (server-side)**: ตรวจ `cyms_token` cookie สำหรับ protected page routes → redirect ไป `/login` ทันที (ไม่ต้องรอ client-side JS)
- [x] **Cookie→Header Forwarding**: `passthrough()` อ่าน cookie แล้วส่งเป็น `x-cyms-token` custom header → API route handler อ่านได้แน่นอน (safety net)
- [x] เพิ่ม `allowedDevOrigins` ใน `next.config.ts` สำหรับ LAN testing

**Auth Session Persistence Fix (Critical Bug):**
- [x] **Root Cause**: `/api/auth/me` SQL query ใช้ชื่อ table ผิด `UserYards` (ไม่มีอยู่ใน DB) แทนที่จะเป็น `UserYardAccess` + ใช้ `u.is_active = 1` (column ไม่มี) แทน `u.status = 'active'`
- [x] **ผลกระทบ**: Query fail silently → catch block return `{ authenticated: false }` ทุกครั้ง → AuthProvider คิดว่าไม่มี session → redirect ไป `/login`
- [x] **แก้ไข**: แก้ชื่อ table + column ให้ตรงกับ schema.sql + เพิ่ม error logging ใน catch block
- [x] **ลบ debug endpoint**: ลบ `api/auth/debug/route.ts` ที่สร้างไว้ชั่วคราว

**สถาปัตยกรรม Auth ปัจจุบัน (Hybrid Approach):**
```
Login → SET httpOnly cookie (cyms_token) + localStorage (cyms_session)
         ↓
New Tab → Proxy ตรวจ cookie (page guard) ✅
         → AuthProvider: ลอง localStorage (ว่าง) → เรียก /api/auth/me
         → auth/me อ่าน x-cyms-token header → verify JWT → ดึง user จาก DB → return session ✅
         → AuthProvider เก็บ session ลง localStorage + state
```

### 🔐 API Actor Attribution Hardening (✅ เสร็จ — 21 พ.ค. 2569)

**ไฟล์ที่เกี่ยวข้อง:**
- `src/lib/apiAuth.ts` — เพิ่ม `requireAnyPermission()` สำหรับ route ที่ยอมรับได้หลาย permission โดยอ่าน actor จาก proxy headers เท่านั้น
- `src/app/api/approval-reviews/route.ts`
- `src/app/api/billing/clearance/route.ts`
- `src/app/api/billing/invoices/route.ts`
- `src/app/api/gate/route.ts`
- `src/app/api/mnr/route.ts`
- `src/app/api/yard/audit-log/route.ts`
- `src/app/api/attachments/route.ts`
- `src/app/api/operations/route.ts`
- `src/app/api/containers/route.ts`
- `src/app/api/__tests__/api-auth-coverage.test.ts`

**สิ่งที่แก้แล้ว:**
- [x] Mutation API ชุดเสี่ยงไม่รับ `user_id`, `approved_by`, `uploaded_by` จาก request body แล้ว
- [x] Audit/approval/document lifecycle ใช้ `actor.userId` จาก `x-user-id` ที่ `proxy.ts` inject หลังตรวจ JWT
- [x] Billing/Gate/M&R/Operations/Containers ใส่ server-side permission guard ก่อนเขียนข้อมูล
- [x] Attachment และ manual audit-log API ต้องมี authenticated actor ก่อนบันทึก
- [x] เพิ่ม static Jest coverage กัน regressions ไม่ให้ route เสี่ยงกลับไป trust actor จาก body อีก

**Verify ล่าสุด:**
- `npm test -- src/app/api/__tests__/api-auth-coverage.test.ts --runInBand` ✅
- `npm test -- src/lib/__tests__/apiAuth.test.ts src/app/api/__tests__/api-auth-coverage.test.ts --runInBand` ✅
- `npm run lint` ✅

### 🧭 API Yard Access Guard (✅ เสร็จ — 21 พ.ค. 2569)

**ไฟล์ที่เกี่ยวข้อง:**
- `src/lib/apiAuth.ts` — เพิ่ม `requireYardAccess()` ตรวจ `UserYardAccess` โดย `yard_manager` bypass ได้
- `src/lib/__tests__/apiAuth.test.ts` — unit test helper สำหรับ missing/allowed/denied yard
- `src/app/api/__tests__/yard-access-guard.test.ts` — static coverage กัน route yard-scoped ลืม guard และกัน `yard_id || 1`
- Route หลักที่ครอบคลุม: Gate, Inter-Yard Transfer, Billing invoices/clearance/reports/AR/demurrage/export, M&R, Operations/SSE, Dashboard, Global Search, Notifications, Documents Numbering, CODECO/EDI Schedule, Storage Rates, Reconciliation, Yard Audit

**สิ่งที่แก้แล้ว:**
- [x] API ที่อ่าน/เขียนข้อมูลตาม `yard_id` ต้องตรวจสิทธิ์ลานจาก server ก่อน query/mutate
- [x] ตัด default `yard_id || 1` ใน request handlers และ runtime scheduler path ที่เสี่ยงอ่าน/เขียนผิดลาน
- [x] Global Search/Dashboard/Reports/Billing export ต้องมี explicit `yard_id` และ actor มีสิทธิ์ในลานนั้น
- [x] Inter-Yard Transfer ตรวจสิทธิ์ทั้งลานต้นทางและปลายทาง พร้อม audit ด้วย actor จาก server
- [x] Notifications เลิกใช้ `user_id` จาก query เพื่ออ่าน `last_read_at`; ใช้ actor จาก header แทน

**Verify ล่าสุด:**
- `npm test -- src/app/api/__tests__/api-auth-coverage.test.ts src/app/api/__tests__/yard-access-guard.test.ts src/lib/__tests__/apiAuth.test.ts src/app/api/__tests__/search.test.ts --runInBand` ✅ (66 tests)
- `npm run lint` ✅
- `npx tsc --noEmit --pretty false` ยัง fail จาก test type drift เดิมใน `portal-features.test.ts` และ `customerBranches.test.ts` (ไม่ใช่ไฟล์ที่แก้ในหัวข้อนี้)

### 🧯 Hard Approval Gates (✅ เสร็จ — 21 พ.ค. 2569)

**ไฟล์ที่เกี่ยวข้อง:**
- `src/lib/approvalReview.ts` — เพิ่ม `requireApprovalForAction()` สำหรับ hard gate + pending approval response
- `src/lib/__tests__/approvalReview.test.ts`
- `src/app/api/__tests__/hard-approval-gates.test.ts`
- `src/app/api/billing/clearance/route.ts`
- `src/app/api/billing/invoices/route.ts`
- `src/app/api/gate/route.ts`
- `src/app/api/containers/route.ts`

**Policy ที่ใช้ตอนนี้:**
- ผู้ทำรายการต้องมี permission ปกติของ action ก่อน เช่น `billing.waive.request`, `billing.credit_note.create`, `gate.out`
- ถ้า action เสี่ยงและผู้ทำรายการไม่มี approval permission จะ **ไม่ mutate ข้อมูล** แต่สร้าง `ApprovalReviews.status = pending_review` แล้วตอบ `202 { pending_approval: true, review_id }`
- ถ้า actor มี approval permission หรือเป็น `yard_manager` จะดำเนินการทันที และบันทึก `approved_by` เป็น actor server-side

**Hard gate ที่ครอบคลุมแล้ว:**
- [x] Billing Clearance แบบ `waived`, `no_charge`, หรือส่วนลดที่ `final_amount < original_amount`
- [x] Credit Note creation
- [x] Cancel invoice หลังออกเอกสาร
- [x] Billing hold release
- [x] Gate-Out เมื่อ container ยังติด `billing_hold`
- [x] Container grade override หลังบันทึก
- [x] Container billing hold override

**Verify ล่าสุด:**
- `npm test -- src/lib/__tests__/approvalReview.test.ts src/app/api/__tests__/hard-approval-gates.test.ts src/app/api/__tests__/api-auth-coverage.test.ts --runInBand` ✅ (30 tests)
- `npm run lint` ✅
- `npx tsc --noEmit --pretty false` ยัง fail จาก test type drift เดิมใน `portal-features.test.ts` และ `customerBranches.test.ts`

### 🔁 Portal Grant Reconciler/Admin Repair (✅ เสร็จ — 21 พ.ค. 2569)

**ไฟล์ที่เกี่ยวข้อง:**
- `src/lib/portalGrantReconciler.ts`
- `src/lib/__tests__/portalGrantReconciler.test.ts`
- `src/app/api/portal/grants/reconcile/route.ts`
- `src/app/api/__tests__/portal-grant-reconcile.test.ts`

**Policy ที่ใช้ตอนนี้:**
- ยังใช้ fixed server-side policy ตาม owner/billing/booking/invoice linkage ไม่เปิดหน้า config policy กว้าง ๆ เพื่อลด data leakage
- Expected grants มาจาก `Bookings.customer_id`, `BookingContainers`, `Containers.container_owner_id`, `GateTransactions.container_owner_id/billing_customer_id`, และ `Invoices.customer_id/container_id`
- Repair จะ insert เฉพาะ grant ที่ควรมี และ deactivate เฉพาะ active stale grants ที่ `source_table` อยู่ใน managed source tables เท่านั้น เพื่อไม่ไปปิด future/manual grants นอก policy นี้

**Admin API:**
- `GET /api/portal/grants/reconcile?limit=` — preview `missing` / `stale` grants
- `POST /api/portal/grants/reconcile?limit=` — repair grants + บันทึก audit `portal_grants_reconcile_repair`
- ทั้งสอง endpoint จำกัดเฉพาะ `yard_manager` ก่อนเปิด DB connection

**Verify ล่าสุด:**
- `npm test -- src/lib/__tests__/portalGrantReconciler.test.ts src/app/api/__tests__/portal-grant-reconcile.test.ts --runInBand` ✅ (6 tests)

### 🧭 Operator Workflow Polish (✅ เสร็จ — 21 พ.ค. 2569)

**ไฟล์ที่เกี่ยวข้อง:**
- `src/components/gate/GateDecisionBar.tsx`
- `src/lib/gateWorkflow.ts`
- `src/app/api/billing/dunning-actions/route.ts`
- `src/app/(dashboard)/billing/ARDunningPanel.tsx`
- `src/components/yard/YardPlanningPanel.tsx`
- `src/lib/yardPlanning.ts`
- `src/lib/portalAccess.ts`

**สิ่งที่เพิ่ม:**
- [x] Gate-In/Gate-Out มี sticky decision bar สรุป `Billing`, `Booking`, `Evidence`, `Supervisor` และ next action
- [x] AR Dunning บันทึก contact attempt / promise-to-pay ลง audit log ผ่าน actor จาก server
- [x] Yard Planning recommendation สร้าง Work Order ได้ทันทีพร้อม from/to slot และ note จากเหตุผล planning
- [x] Customer Portal แสดง `visibility_role` เพื่อบอกว่ารายการเห็นได้เพราะ owner/billing/booking/invoice grant

**Verify ล่าสุด:**
- `npm test -- src/lib/__tests__/gateWorkflow.test.ts src/lib/__tests__/arDunning.test.ts src/app/api/__tests__/billing-dunning-actions.test.ts src/lib/__tests__/yardPlanning.test.ts src/lib/__tests__/portalAccess.test.ts src/app/api/__tests__/portal-containers.test.ts src/app/api/__tests__/portal-bookings.test.ts src/app/api/__tests__/portal-features.test.ts --runInBand` ✅ (25 tests)
- `npm run lint` ✅
- `npx tsc --noEmit --pretty false` ✅
- `npm test -- --runInBand` ✅ (64 suites / 584 tests)

---

## 10. ข้อควรระวัง (Known Issues)

| รายการ | รายละเอียด |
|--------|-----------|
| **ESLint** | ✅ **clean แล้ว** — ล่าสุด `npm run lint` ผ่านแบบไม่มี warnings; เก็บ unused bindings, hook deps, a11y alt text และ raw image previews ผ่าน `RawImage` wrapper |
| **Auth proxy** | ~~ยังไม่มี middleware ตรวจ JWT ที่ API routes~~ → **แก้แล้ว** `src/proxy.ts` (Next.js 16) ตรวจ JWT ทุก API route + page guard |
| **Auth session (แก้แล้ว)** | ~~เปิด New Tab / Hard Refresh แล้วเด้งกลับหน้า Login~~ → **แก้แล้ว** (10 เม.ย. 2569) — สาเหตุ: `auth/me` SQL query ใช้ table `UserYards` (ไม่มีอยู่จริง) แทนที่จะเป็น `UserYardAccess` + column `is_active` แทน `status` → query fail silently → return `authenticated: false` ทุกครั้ง |
| **Pagination** | ~~ตารางตู้แสดง max 50 รายการ ยังไม่มี pagination~~ → **แก้แล้ว** Yard overview + Gate History + Invoices + CODECO + Demurrage = 25/หน้า |
| **Confirmation Dialogs** | ~~ใช้ `window.confirm()` ทุกจุด~~ → **แก้แล้ว** เปลี่ยนเป็น `ConfirmDialog` custom modal ทั้ง 8 จุด |
| **SQL Injection** | ✅ **แก้แล้ว** — customer branch update ใช้ validated positive integer + parameterized `NOT IN` placeholders |
| **Automated Testing** | ✅ **กลับมาเขียวแล้ว** — ล่าสุด full `npm test -- --runInBand` ผ่าน 54 suites / 546 tests; เพิ่ม global search + TOTP 2FA + trusted device binding + PromptPay QR + Gate guided workflow + Gate operational guardrails + Billing tariff simulator + AR dunning action center + Supervisor approval inbox + Portal entity access grants + Reports action center + Offline queue + component boundary + Customer Portal bundle/dispute/ETA + Yard Planning + Reefer Monitoring/Exception tests แล้ว, billing/M&R mock flow อัปเดตให้ตรงกับ `DocumentSequences` แล้ว และมี static guard กัน runtime DDL ทั้ง `src/app/api` + `src/lib` |
| **Credit Note / ใบลดหนี้** | ✅ **มีแล้ว** — CN-YYYY-XXXXXX, modal กรอกเหตุผล+ยอด, ยอดติดลบ, auto-cancel เมื่อลดเต็มจำนวน |
| **AR Aging Report** | ✅ **มีแล้ว** — แท็บ AR Aging แยกตามลูกค้า, summary current/30/60/90+ วัน + สีความเสี่ยง |
| **Dashboard Range Toggle** | ✅ **มีแล้ว** — toggle 7 วัน / 30 วัน / 3 เดือน + รวมรายสัปดาห์อัตโนมัติสำหรับ 30d/90d |
| **2FA (TOTP)** | ✅ **มีแล้ว** — Settings Security เปิด/ปิดได้ด้วย QR/secret, Login รองรับ `requires_2fa`, API `/api/auth/2fa`, audit log และ migration columns |
| **Device Binding** | ✅ **มีแล้ว** — enforce ผ่าน trusted browser device id ตาม policy/role, auto-bind อุปกรณ์แรกได้, admin ล้าง binding ได้จาก UsersSettings (`bound_device_mac` เป็นชื่อ legacy ไม่ใช่ MAC จริง) |
| **Password Policy** | ✅ **มีแล้ว** — configurable min_length, uppercase, lowercase, number, special char + strength meter UI |
| **Account Lockout** | ✅ **มีแล้ว** — lock after N failed attempts, auto-unlock after duration, Admin unlock UI |
| **Payment Gateway** | ✅ **มี PromptPay QR แล้ว** — เป็น manual-payment QR บน invoice print + Billing → Payment QR settings; ยังไม่ใช่ automatic settlement/provider webhook |
| **Audit Trail** | ~~UI placeholder~~ → แก้แล้ว มี Audit Log API + UI |
| **CSS lint warnings** | `@variant`, `@theme` = Tailwind v4 directives ปกติ (IDE lint ไม่รู้จัก แต่ build สำเร็จ) |
| **Timezone (แก้แล้ว)** | ~~EIR วันที่เลื่อน 7 ชม.~~ → แก้แล้วโดยใส่ `useUTC: false` ใน `db.ts` (ป้องกัน mssql driver ตีความ DATETIME2 เป็น UTC ซ้ำซ้อน) |
| **Notification Cross-Browser (แก้แล้ว)** | ~~กด "อ่านแล้วทั้งหมด" ใน Chrome → เปิด Edge ยังเห็น badge~~ → แก้แล้ว เพิ่ม `notif_last_read_at` ใน `Users` table + `PATCH /api/notifications` บันทึก DB + `GET` ส่ง `last_read_at` กลับมา — ซิงค์ทุก browser/device |

---

## 11. คำสั่งที่ใช้บ่อย

```bash
# รันโปรเจค (Port 3005)
npm run dev
# → http://localhost:3005

# ทดลอง Turbopack แยกจาก default dev flow
npm run dev:turbo

# Setup DB ใหม่ (สร้าง DB + tables)
node scripts/setup-db.js

# Seed ข้อมูลทั้งหมด
node scripts/seed-users.js
node scripts/seed-permissions.js
node scripts/seed-containers.js

# Build production
npm run build
npm start
# → http://localhost:3005

# สร้างตาราง EDI Endpoints + Send Log
node scripts/migrate-edi-endpoints.js

# สร้างตาราง DemurrageRates + default rates
node scripts/migrate-demurrage.js

# 🧪 รัน Tests ทั้งหมด (ล่าสุด 54 suites / 546 tests ผ่าน)
npm test

# Watch mode (re-run เมื่อแก้โค้ด)
npm run test:watch

# รัน test เฉพาะ suite
npx jest containerValidation        # lib unit tests
npx jest "api/__tests__"             # API integration tests เท่านั้น
npx jest "api/__tests__/billing"     # เฉพาะ billing
npx jest "api/__tests__/mnr"         # เฉพาะ M&R

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

# Migration: Runtime Core Schema (runtime DDL cleanup + TOTP 2FA + trusted device columns)
node scripts/migrate-runtime-core-schema.js
```

---

> **ผู้สร้าง**: AI Assistant (Antigravity)  
> **วันที่อัพเดทล่าสุด**: 21 พฤษภาคม 2569
> **เอกสารเพิ่มเติม**: `src/lib/schema.sql` (SQL schema), `.env.local` (config)
