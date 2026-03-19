# 📋 CYMS — Developer Handoff Document
> **Container Yard Management System** (ระบบบริหารจัดการลานตู้คอนเทนเนอร์อัจฉริยะ)  
> ส่งมอบงาน: 19 มีนาคม 2569 | เวอร์ชัน: เฟส 1-9 + FR1-4 สมบูรณ์ (75%)

---

## 1. ภาพรวมโปรเจค

**CYMS** คือระบบบริหารลานตู้คอนเทนเนอร์แบบรวมศูนย์ รองรับหลายสาขา (Multi-Yard) ทำงาน Real-time ผ่าน Web + PWA

### สถานะปัจจุบัน

| เฟส | รายละเอียด | สถานะ |
|-----|-----------|-------|
| **เฟส 1** | วางรากฐาน — โปรเจค, Design System, DB Schema | ✅ เสร็จ |
| **เฟส 2** | ล็อกอิน, Dashboard, ตั้งค่าระบบ, RBAC | ✅ เสร็จ |
| **เฟส 3** | จัดการลาน, 3D Viewer, Auto-Allocation, ค้นหาตู้, Yard Audit, **PWA Card View** | ✅ เสร็จ |
| **เฟส 4** | Gate In/Out, EIR, ตรวจสภาพตู้, OCR, Seal Photo, Signature, Inter-Yard Transfer | ✅ เสร็จ |
| **เฟส 5** | ปฏิบัติการ, Job Queue, Smart Shifting, **Tablet-optimized buttons** | ✅ เสร็จ |
| **เฟส 6** | EDI, Booking/Manifest, Seal Validation, **CSV/Excel file import** | ✅ เสร็จ |
| **เฟส 7** | ซ่อมบำรุง M&R, EOR, CEDEX | ✅ เสร็จ |
| **เฟส 8** | บัญชี Billing, Tariff, Hold/Release | ✅ เสร็จ |
| **เฟส 9** | PWA, Toast, UI Polish, Print | ✅ เสร็จ |

---

## 2. Tech Stack

| ส่วน | เทคโนโลยี | เวอร์ชัน |
|------|----------|---------|
| **Framework** | Next.js (App Router) | 14+ |
| **Language** | TypeScript | 5.x |
| **Runtime** | Node.js | v24.13.0 |
| **Styling** | Tailwind CSS | v3 |
| **3D Rendering** | Three.js | latest |
| **Database** | MS SQL Server (แยก Server) | ผ่าน `mssql` package |
| **Auth** | JWT + bcrypt | `jsonwebtoken` + `bcryptjs` |
| **OCR** | Tesseract.js | `tesseract.js` |
| **Excel/CSV** | SheetJS | `xlsx` |
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

# File Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

### 3.3 Setup Database

```bash
# 1. สร้างฐานข้อมูล + ตาราง (14 ตาราง)
node scripts/setup-db.js

# 2. Seed ข้อมูลผู้ใช้ (5 demo accounts)
node scripts/seed-users.js

# 3. Seed สิทธิ์ (29 permissions × 6 roles)
node scripts/seed-permissions.js

# 4. Seed ข้อมูลตู้ (10 zones + ~925 containers)
node scripts/seed-containers.js
```

### 3.4 รันโปรเจค

```bash
npm run dev
# เปิด http://localhost:3005
```

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
│   ├── seed-permissions.js       # Seed 29 permissions × 6 roles
│   └── seed-containers.js        # Seed 10 zones + 925 containers
│
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout (fonts, providers)
│   │   ├── page.tsx              # Root redirect (→ login or dashboard)
│   │   ├── globals.css           # Tailwind + custom styles
│   │   ├── login/
│   │   │   └── page.tsx          # หน้า Login (glassmorphism)
│   │   │
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx        # Dashboard layout (sidebar + topbar + auth check)
│   │   │   ├── dashboard/page.tsx   # หน้า Dashboard (KPI cards)
│   │   │   ├── yard/page.tsx     # หน้าจัดการลาน (4 tabs: ภาพรวม/ค้นหา/จัดวางตู้/ตรวจนับ)
│   │   │   ├── gate/page.tsx     # หน้า Gate (4 tabs: Gate-In/Gate-Out/ประวัติ/ย้ายข้ามลาน + EIR Modal)
│   │   │   ├── operations/page.tsx # หน้าปฏิบัติการ (3 tabs: Job Queue/สร้างงาน/Shifting)
│   │   │   ├── edi/page.tsx      # หน้า EDI (3 tabs: Bookings/นำเข้า/ตรวจซีล)
│   │   │   ├── mnr/page.tsx      # หน้า M&R (3 tabs: EOR/สร้าง EOR/CEDEX)
│   │   │   ├── billing/page.tsx  # หน้าบัญชี (4 tabs: ใบแจ้งหนี้/สร้างบิล/Tariff/Hold)
│   │   │   └── settings/
│   │   │       ├── page.tsx              # หน้าตั้งค่า (tab navigation)
│   │   │       ├── CompanySettings.tsx    # CRUD ข้อมูลองค์กร
│   │   │       ├── YardsSettings.tsx      # CRUD ลาน + โซน
│   │   │       ├── UsersSettings.tsx      # CRUD ผู้ใช้งาน
│   │   │       └── PermissionsMatrix.tsx  # Permission Matrix (29×6)
│   │   │
│   │   └── api/
│   │       ├── auth/login/route.ts         # POST login → JWT
│   │       ├── containers/route.ts         # GET/POST/PUT + position check
│   │       ├── gate/
│   │       │   ├── route.ts                # GET/POST gate transactions
│   │       │   ├── eir/route.ts            # GET EIR data for display/print
│   │       │   └── transfer/route.ts       # POST inter-yard transfer
│   │       ├── operations/
│   │       │   ├── route.ts                # GET/POST/PUT work orders
│   │       │   └── shift/route.ts          # POST smart shifting (LIFO)
│   │       ├── edi/
│   │       │   ├── bookings/route.ts       # GET/POST/PUT bookings
│   │       │   └── validate/route.ts       # POST seal cross-validation
│   │       ├── mnr/route.ts                    # GET/POST/PUT repair orders (EOR)
│   │       ├── billing/
│   │       │   ├── tariffs/route.ts        # GET/POST/PUT tariffs
│   │       │   └── invoices/route.ts       # GET/POST/PUT invoices + Hold/Release
│   │       ├── settings/
│   │       │   ├── company/route.ts        # GET/POST company profile
│   │       │   ├── users/route.ts          # GET/POST/PUT users
│   │       │   ├── yards/route.ts          # GET/POST/PUT/DELETE yards
│   │       │   ├── zones/route.ts          # GET/POST/PUT/DELETE zones
│   │       │   └── permissions/route.ts    # GET/PUT permission matrix
│   │       └── yard/
│   │           ├── stats/route.ts          # GET yard statistics
│   │           ├── allocate/route.ts       # POST auto-allocation (+ size_restriction)
│   │           ├── audit/route.ts          # GET/POST yard audit
│   │           └── audit-log/route.ts     # GET/POST audit history log
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx       # Left sidebar (collapsible + role-based menus)
│   │   │   └── Topbar.tsx        # Top header (search, yard switcher, notifications)
│   │   ├── providers/
│   │   │   ├── AuthProvider.tsx  # Auth context (login/logout/session)
│   │   │   └── ToastProvider.tsx # Toast notifications (success/error/warning/info)
│   │   ├── yard/
│   │   │   ├── YardViewer3D.tsx      # Three.js 3D yard viewer
│   │   │   ├── ContainerSearch.tsx   # Instant search + detail panel
│   │   │   └── YardAudit.tsx         # Audit checklist per zone/bay
│   │   └── gate/
│   │       ├── ContainerInspection.tsx  # 6-side SVG damage marking + photo + grade
│   │       ├── CameraOCR.tsx            # Camera + Tesseract.js OCR scanning
│   │       ├── PhotoCapture.tsx         # Camera/upload photo capture (seal, damage)
│   │       └── SignaturePad.tsx         # Canvas digital signature pad
│   │
│   ├── types/
│   │   ├── index.ts             # Shared TypeScript interfaces
│   │   └── mssql.d.ts           # mssql type declaration
│   │
│   └── lib/
│       ├── db.ts                 # MS SQL connection pool (mssql)
│       ├── auth.ts               # JWT create/verify functions
│       ├── utils.ts              # formatDateTime, formatTime, etc.
│       └── schema.sql            # SQL schema reference (14 tables)
│
└── package.json
```

---

## 5. Database Schema

### ตาราง (14 ตาราง)

| ตาราง | คอลัมน์หลัก | หน้าที่ |
|-------|------------|--------|
| `CompanyProfile` | name, address, tax_id, logo_url | ข้อมูลบริษัท |
| `Yards` | yard_name, address, lat/lng, status | สาขาลาน |
| `YardZones` | zone_name, zone_type, max_bay/row/tier | โซนในลาน |
| `Roles` | role_name, description | บทบาท (6 roles) |
| `Permissions` | module, action, description | สิทธิ์ (29 permissions) |
| `RolePermissions` | role_id, permission_id | Permission matrix |
| `Users` | username, password_hash, role_id, status | ผู้ใช้งาน |
| `UserYardAccess` | user_id, yard_id | สิทธิ์เข้าถึงลาน |
| `ApprovalHierarchy` | approver_id, level | สายอนุมัติ |
| `Containers` | container_number, size, type, status, zone/bay/row/tier | ตู้คอนเทนเนอร์ |
| `Customers` | customer_name, type, contact | ลูกค้า |
| `ISOContainerCodes` | iso_code, description | รหัส ISO ตู้ |
| `DocumentFormats` | doc_type, prefix, running_number | เลขเอกสาร |
| `GateTransactions` | container_id, transaction_type, driver_name, truck_plate, eir_number | บันทึก Gate In/Out |
| `WorkOrders` | container_id, order_type, from/to positions, priority, status | คำสั่งงานรถยก |
| `Bookings` | booking_number, booking_type, vessel_name, container_count, seal_number | Booking/Manifest |
| `RepairOrders` | eor_number, container_id, damage_details, estimated_cost, status | ใบซ่อม EOR |
| `Tariffs` | charge_type, rate, unit, free_days | อัตราค่าบริการ |
| `Invoices` | invoice_number, customer_id, charge_type, grand_total, status | ใบแจ้งหนี้ |
| `AuditLog` | user_id, action, details, timestamp | บันทึกการใช้งาน |

### Zone Types

| Type | ตัวอย่าง | ข้อจำกัด |
|------|---------|----------|
| `dry` | Zone A, B, C | ตู้ทั่วไป, max tier 4-5 |
| `reefer` | Zone R1 | ตู้เย็นเท่านั้น, มีปลั๊ก |
| `hazmat` | Zone H | ตู้อันตราย, max tier 2 |
| `empty` | Zone E | ตู้เปล่า, max tier 6 |
| `repair` | Zone M | ตู้ซ่อม, max tier 2 |

---

## 6. API Reference

### Authentication

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/api/auth/login` | `{ username, password }` | `{ token, user, yards }` |

### Containers

| Method | Endpoint | Params/Body | Response |
|--------|----------|-------------|----------|
| GET | `/api/containers` | `?yard_id=1&zone_id=&status=&search=` | `ContainerData[]` |
| GET | `/api/containers` | `?check_position=1&zone_id=X&bay=Y&row=Z&tier=W` | Conflict check — `{ conflict: {...} \| null }` |
| POST | `/api/containers` | `{ container_number, size, type, yard_id, zone_id, bay, row, tier, ... }` | Gate-In record |
| PUT | `/api/containers` | `{ container_id, bay, row, tier, status }` | Move/status update |

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
| GET | `/api/gate?yard_id=X&type=gate_in&date=today` | ดึงรายการ gate transactions |
| POST | `/api/gate` | Gate-In/Gate-Out — `{ transaction_type, container_number, driver_name, ... }` → EIR |
| GET | `/api/gate/eir?transaction_id=X` | ดึงข้อมูล EIR สำหรับแสดง/พิมพ์ |

### Operations

| Method | Endpoint | คำอธิบาย |
|--------|----------|---------|
| GET | `/api/operations?yard_id=X&status=pending` | ดึง Work Orders |
| POST | `/api/operations` | สร้าง Work Order — `{ order_type, container_id, to_zone/bay/row/tier, priority }` |
| PUT | `/api/operations` | อัปเดทสถานะ — `{ order_id, action: assign/start/complete/cancel }` |
| POST | `/api/operations/shift` | Smart Shifting — `{ container_id, yard_id }` → LIFO plan |

### Settings

| Method | Endpoint | คำอธิบาย |
|--------|----------|---------|
| GET/POST | `/api/settings/company` | Company profile CRUD |
| GET/POST/PUT | `/api/settings/users` | User management |
| GET/POST/PUT/DELETE | `/api/settings/yards` | Yard management (DELETE ตรวจตู้ก่อนลบ) |
| GET/POST/PUT/DELETE | `/api/settings/zones` | Zone management (DELETE ตรวจตู้ก่อนลบ) |
| GET/PUT | `/api/settings/permissions` | Permission matrix toggle |

---

## 7. ฟีเจอร์หลักที่สร้างเสร็จ

### 7.1 ระบบ Login + Auth
- หน้า Login แบบ Glassmorphism + animated background
- JWT token (8 ชม.) + bcrypt password hashing
- Auth context ผ่าน `AuthProvider` (localStorage session)
- Audit log ทุกการ login

### 7.2 Dashboard
- KPI cards (ตู้ทั้งหมด, Gate-In/Out วันนี้, อัตราเต็ม)
- Quick Action buttons
- Yard Status overview

### 7.3 ตั้งค่าระบบ (Settings)
- **Company Profile**: CRUD → DB
- **User Management**: CRUD + role + yard access
- **Permission Matrix**: 29 permissions × 6 roles, toggle realtime
- **Yards + Zones**: CRUD + Edit/Delete → DB (ป้องกันลบหากยังมีตู้อยู่)

### 7.4 จัดการลาน (Yard Management)

4 แท็บ:

#### แท็บ "ภาพรวม"
- สถิติ 5 การ์ด (ตู้ทั้งหมด, ในลาน, ค้างจ่าย, ซ่อม, อัตราเต็ม)
- 2D/3D toggle
- **2D**: Zone cards + occupancy bars
- **3D**: Three.js — ตู้สมจริง (สัดส่วนจริง 20ft/40ft/45ft)
- ตารางตู้ + filter + search

#### แท็บ "ค้นหาตู้" (Split Screen)
- **ซ้าย**: Instant search → รายชื่อตู้ + รายละเอียด
- **ขวา**: 3D Viewer — **X-Ray Mode** (ตู้อื่นโปร่งใส) + **Beacon สีเหลือง** + กล้องซูม smooth

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

#### แท็บ "Gate-In (รับเข้า)"
- ฟอร์มกรอกข้อมูลตู้ (เลขตู้, ขนาด, ประเภท, สายเรือ, ซีล) + คนขับ/ทะเบียนรถ + Booking Ref
- กดรับตู้ → สร้าง Container + GateTransaction + **ออก EIR อัตโนมัติ**
- รองรับตู้ที่เคย gate-out ไปแล้วกลับเข้ามาใหม่ (re-enter)

#### แท็บ "Gate-Out (ปล่อยออก)"
- ค้นหาตู้ในลาน → เลือกตู้ → กรอกคนขับ/ทะเบียน → ปล่อยออก
- อัปเดท container status → `gated_out` + Clear bay/row/tier + **ออก EIR อัตโนมัติ**

#### แท็บ "ประวัติวันนี้"
- ตาราง transactions วันนี้ + ลิงก์ดู EIR ทุกรายการ

### 7.6 EIR (Equipment Interchange Receipt)
- Modal แสดง EIR พร้อมปุ่มพิมพ์
- เลข EIR ออกอัตโนมัติ (EIR-IN-YYYY-XXXXXX / EIR-OUT-YYYY-XXXXXX)
- ข้อมูลครบ: ตู้, คนขับ, รถ, ซีล, ลาน, พิกัด, ผู้ดำเนินการ

### 7.7 ตรวจสภาพตู้ (Container Inspection)
- แผนผัง 6 ด้าน: Front, Back, Left, Right, Top, Floor
- กดมาร์กจุดเสียหาย (dent, hole, rust, scratch, crack, missing_part)
- ระดับความรุนแรง: minor / major / severe
- Auto-grade: A (ดี), B (พอใช้), C (ชำรุด), D (ชำรุดหนัก)
- เก็บข้อมูลเป็น JSON ใน GateTransactions.damage_report

### 7.8 ปฏิบัติการ (Operations)

3 แท็บ:

#### แท็บ "Job Queue"
- ตาราง Work Orders + status workflow (pending → assigned → in_progress → completed)
- ปุ่มรับงาน / เริ่ม / เสร็จ / ยกเลิก
- Filter ตาม status
- เมื่อกด "เสร็จ" → อัปเดตพิกัดตู้ใน DB อัตโนมัติ

#### แท็บ "สร้างงาน"
- เลือกประเภท: ย้ายตู้ / หลบตู้ / จัดเรียง
- ค้นหาตู้ → เลือก → กำหนดปลายทาง (Zone/Bay/Row/Tier)
- ตั้งความสำคัญ (ด่วนมาก / ด่วน / ปกติ / ต่ำ)

#### แท็บ "Smart Shifting" (LIFO)
- ค้นหาตู้ล่างที่ต้องดึงออก
- ระบบวิเคราะห์ตู้ที่ซ้อนข้างบน (LIFO)
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
| **X-Ray Mode** | ตู้อื่น opacity 8% + beacon สีเหลือง + วงแหวนบนพื้น |
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
- **ฟังก์ชัน**: ใช้ `formatDate()`, `formatDateTime()`, `formatTime()`, `formatShortDate()` จาก `@/lib/utils.ts` เท่านั้น
  - `formatDate()` → `19/03/2026`
  - `formatDateTime()` → `19/03/2026 14:30`
  - `formatTime()` → `14:30:00`
  - `formatShortDate()` → `19 มี.ค. 69` (แสดงย่อภาษาไทย)
- **ห้ามใช้** inline `toLocaleDateString()` / `toLocaleTimeString()` โดยตรง

---

## 9. งานที่เหลือ (เฟส 5-9)

### เฟส 4: Gate In/Out + ตรวจสภาพตู้ (✅ เสร็จ — ยังเหลือบางส่วน)
- [x] ฟอร์ม Gate-In (เลขตู้, ขนาด, ประเภท, สายเรือ, ซีล, คนขับ, ทะเบียนรถ)
- [x] ฟอร์ม Gate-Out (ค้นหาตู้ → ปล่อยออก → EIR)
- [x] ออกเอกสาร EIR อัตโนมัติ
- [x] ตรวจสภาพตู้ดิจิทัล (แผนผัง 6 ด้าน + damage marking)
- [ ] PWA สแกน OCR เลขตู้ (Tesseract.js)
- [ ] ย้ายตู้ข้ามสาขา (Inter-Yard Transfer)

### เฟส 5: ปฏิบัติการหน้างาน (✅ เสร็จ — ยังเหลือบางส่วน)
- [x] Job Queue รถยก (Work Orders + status workflow)
- [x] Smart Shifting Logic (Virtual LIFO)
- [ ] แอป Surveyor (PWA Offline) — ใช้ YardAudit ที่ทำไว้แล้วแทน

### เฟส 6: เชื่อมโยง EDI สายเรือ (✅ เสร็จ)
- [x] Booking/Manifest นำเข้า + จัดการสถานะ
- [x] Seal Cross-Validation
- [ ] Customer Master + EDI Config (ISO auto-import)

### เฟส 7: ซ่อมบำรุง M&R (✅ เสร็จ)
- [x] สร้างใบ EOR + CEDEX codes + คำนวณราคาอัตโนมัติ
- [x] Approval workflow (draft→submit→approve→repair→complete)

### เฟส 8: บัญชีการเงิน (✅ เสร็จ)
- [x] Tariff ตั้งค่าบริการ (Storage, LOLO, M&R, Washing, PTI, Reefer)
- [x] Auto-billing + VAT 7%
- [x] Hold/Release workflow
- [x] Invoice status workflow (draft→issued→paid→credit_note)

### เฟส 9: ปรับแต่ง & PWA (✅ เสร็จ)
- [x] PWA Service Worker (Network-first API, Cache-first assets)
- [x] Toast Notification System (success/error/warning/info)
- [x] PWA meta tags + manifest + SVG icons + favicon
- [x] CSS: Toast animation, Pulse glow, Focus ring, Print styles
- [ ] Offline-First IndexedDB (เลื่อนไป future — ระบบ online-first เพียงพอแล้ว)

---

## 10. ข้อควรระวัง (Known Issues)

| รายการ | รายละเอียด |
|--------|-----------|
| **TypeScript lint** | ~~API files มี implicit `any` type warnings สำหรับ `mssql`~~ → แก้แล้วด้วย `src/types/mssql.d.ts` |
| **Auth middleware** | ยังไม่มี middleware ตรวจ JWT ที่ API routes (ปัจจุบันตรวจแค่ฝั่ง client) |
| **Settings แท็บ 4-7** | ลูกค้า, CEDEX, บัญชี, กฎอัตโนมัติ — ยังเป็น placeholder |
| **Pagination** | ตารางตู้แสดง max 50 รายการ ยังไม่มี pagination |
| **Approval Hierarchy** | UI placeholder ยังไม่เชื่อมต่อ DB |
| **Audit Trail** | ~~UI placeholder ยังไม่แสดงข้อมูลจริง~~ → แก้แล้ว มี Audit Log API + UI ที่แสดงประวัติจริงจาก DB |

---

## 11. คำสั่งที่ใช้บ่อย

```bash
# รันโปรเจค (Port 3005)
npm run dev
# → http://localhost:3005

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
```

---

> **ผู้สร้าง**: AI Assistant (Antigravity)  
> **วันที่**: 19 มีนาคม 2569  
> **เอกสารเพิ่มเติม**: `src/lib/schema.sql` (SQL schema), `.env.local` (config)
