# 🚀 CYMS Deployment Guide — Ubuntu Server + Cloudflare Tunnel

> **Container Yard Management System**  
> Target: Ubuntu 22.04/24.04 LTS | Node.js 24 | MS SQL Server 2019+ | Nginx + Cloudflare Tunnel  
> ติดตั้งที่: `/var/www/container-yard-system`

---

## สารบัญ

1. [ข้อกำหนดเบื้องต้น](#1-ข้อกำหนดเบื้องต้น)
2. [เตรียม Ubuntu Server](#2-เตรียม-ubuntu-server)
3. [ติดตั้ง Node.js](#3-ติดตั้ง-nodejs)
4. [เชื่อมต่อ MS SQL Server (เครื่อง DB แยก)](#4-เชื่อมต่อ-ms-sql-server-เครื่อง-db-แยก)
5. [Deploy โปรเจค CYMS](#5-deploy-โปรเจค-cyms)
6. [ตั้งค่า Environment Variables](#6-ตั้งค่า-environment-variables)
7. [สร้าง Database + Seed ข้อมูล](#7-สร้าง-database--seed-ข้อมูล)
8. [Build + รัน Production](#8-build--รัน-production)
9. [ตั้งค่า PM2 (Process Manager)](#9-ตั้งค่า-pm2-process-manager)
10. [ตั้งค่า Nginx (Reverse Proxy)](#10-ตั้งค่า-nginx-reverse-proxy)
11. [ตั้งค่า Cloudflare Tunnel](#11-ตั้งค่า-cloudflare-tunnel)
12. [Firewall + Security](#12-firewall--security)
13. [Backup Strategy](#13-backup-strategy)
14. [อัปเดตระบบ](#14-อัปเดตระบบ)
15. [เคลียข้อมูลทดสอบ (ก่อนขึ้น Production)](#15-เคลียข้อมูลทดสอบ-ก่อนขึ้น-production)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. ข้อกำหนดเบื้องต้น

| รายการ | ขั้นต่ำ | แนะนำ |
|--------|---------|-------|
| **OS** | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| **CPU** | 2 cores | 4 cores |
| **RAM** | 4 GB | 8 GB |
| **Disk** | 40 GB SSD | 80+ GB SSD |
| **Node.js** | v20+ | v24 LTS |
| **MS SQL Server** | 2019 | 2022 |
| **Domain** | - | จด domain + Cloudflare DNS |

---

## 2. เตรียม Ubuntu Server

```bash
# อัปเดตระบบ
sudo apt update && sudo apt upgrade -y

# ติดตั้งเครื่องมือพื้นฐาน
sudo apt install -y curl wget git unzip build-essential software-properties-common

# ตั้ง Timezone เป็น Asia/Bangkok
sudo timedatectl set-timezone Asia/Bangkok
timedatectl
# → Time zone: Asia/Bangkok (ICT, +0700)

# สร้าง directory สำหรับ deploy
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
```

---

## 3. ติดตั้ง Node.js

ใช้ NodeSource repository เพื่อให้ได้ Node.js v24:

```bash
# ติดตั้ง Node.js 24 LTS
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

# ตรวจสอบเวอร์ชัน
node -v   # v24.x.x
npm -v    # 10.x.x

# ติดตั้ง PM2 สำหรับ process management
sudo npm install -g pm2
```

---

## 4. เชื่อมต่อ MS SQL Server (เครื่อง DB แยก)

> ⚠️ **CYMS ใช้ MS SQL Server ที่ติดตั้งบน Server แยกต่างหาก** ไม่ได้ติดตั้งบนเครื่องเดียวกับ App Server
> ตัวอย่างเช่น: App Server = `192.168.110.100`, DB Server = `192.168.110.106`

### 4.1 ข้อกำหนด DB Server

- MS SQL Server 2019+ ติดตั้งและทำงานอยู่แล้วบนเครื่องแยก
- เปิด TCP/IP port 1433 ให้ App Server เชื่อมต่อได้
- มี Login สำหรับ CYMS (sa หรือ user แยก)

### 4.2 ตรวจสอบการเชื่อมต่อจาก App Server

```bash
# ทดสอบ ping DB Server
ping 192.168.110.106

# ทดสอบ port 1433 (ถ้ามี sqlcmd)
sqlcmd -S 192.168.110.106 -U sa -P 'YOUR_SA_PASSWORD' -C -Q "SELECT @@VERSION"

# หรือใช้ telnet/nc เช็ค port
nc -zv 192.168.110.106 1433
```

### 4.3 สร้าง Database + User สำหรับ CYMS (รันบน DB Server)

```sql
-- รันบน DB Server (ผ่าน SSMS หรือ sqlcmd)
CREATE DATABASE CYMS_DB;
GO

-- (แนะนำ) สร้าง user แยกสำหรับ CYMS
CREATE LOGIN cyms_user WITH PASSWORD = 'CymsStr0ng!Pass';
USE CYMS_DB;
CREATE USER cyms_user FOR LOGIN cyms_user;
ALTER ROLE db_owner ADD MEMBER cyms_user;
GO
```

> 💡 **ถ้าใช้ Named Instance** (เช่น `ALPHA`) — ให้ระบุ `DB_INSTANCE=alpha` ใน `.env.local` ด้วย

---

## 5. Deploy โปรเจค CYMS

### 5.1 Clone จาก Git

```bash
cd /var/www
git clone https://github.com/iEel/CYMS.git container-yard-system
cd container-yard-system
```

### 5.2 ติดตั้ง Dependencies

```bash
npm install
```

> ⏱ ใช้เวลาประมาณ 2-5 นาที ขึ้นอยู่กับความเร็ว internet

### 5.3 Dependencies สำคัญ (อ้างอิง)

> ✅ **ไม่ต้องติดตั้งแยก** — ทุก package อยู่ใน `package.json` แล้ว คำสั่ง `npm install` ด้านบนจะติดตั้งให้ทั้งหมดอัตโนมัติ
> ตารางนี้เป็น **รายการอ้างอิง** ให้รู้ว่าระบบใช้ library อะไรบ้าง

| Package | หน้าที่ |
|---------|--------|
| `next` + `react` | Web framework (App Router) |
| `mssql` | MS SQL Server driver |
| `jsonwebtoken` + `bcryptjs` | JWT authentication + password hashing |
| `zod` | Runtime input validation |
| `ssh2-sftp-client` | SFTP file transfer (ส่ง EDI) |
| `jspdf` + `jspdf-autotable` | 📄 PDF report export (รองรับภาษาไทย) |
| `tesseract.js` | OCR สแกนเลขตู้ |
| `xlsx` | Excel/CSV import/export |
| `three` | 3D Yard Viewer |
| `qrcode.react` | QR Code สำหรับ EIR |

---

## 6. ตั้งค่า Environment Variables

```bash
# สร้างไฟล์ .env.local
nano /var/www/container-yard-system/.env.local
```

ใส่ค่าต่อไปนี้:

```env
# ===== Database =====
DB_SERVER=192.168.110.106
DB_PORT=1433
DB_NAME=CYMS_DB
DB_USER=sa
DB_PASSWORD=<รหัสผ่าน>
DB_INSTANCE=alpha              # ถ้าใช้ named instance (เช่น ALPHA)

# ===== JWT =====
JWT_SECRET=ใส่-random-string-ยาวๆ-อย่างน้อย-32-ตัว
JWT_EXPIRES_IN=8h

# ===== Email (Optional — ถ้าต้องการส่ง email) =====
# SMTP_HOST=smtp.office365.com
# SMTP_PORT=587
# SMTP_USER=noreply@yourcompany.com
# SMTP_PASS=your-email-password
# SMTP_FROM=noreply@yourcompany.com

# ===== Azure AD Email (Optional) =====
# AZURE_TENANT_ID=
# AZURE_CLIENT_ID=
# AZURE_CLIENT_SECRET=
# AZURE_MAIL_FROM=
```

**สร้าง JWT_SECRET แบบ random:**

```bash
openssl rand -base64 32
# → เอา output ไปใส่ JWT_SECRET
```

> ⚠️ **สำคัญ**: ตั้ง `DB_PASSWORD` และ `JWT_SECRET` ให้แข็งแรง ไม่ใช่ค่า default

---

## 7. สร้าง Database + Seed ข้อมูล

```bash
cd /var/www/container-yard-system

# 1. สร้าง Database + Tables
node scripts/setup-db.js

# 2. สร้าง Users เริ่มต้น (admin/operator/viewer)
node scripts/seed-users.js

# 3. สร้าง Permissions
node scripts/seed-permissions.js

# 4. (Optional) สร้างตู้ตัวอย่าง
node scripts/seed-containers.js

# 5. Migration scripts — รันทุกตัว
node scripts/migrate-billing.js
node scripts/migrate-gate-transactions.js
node scripts/migrate-work-orders.js
node scripts/migrate-edi-endpoints.js
node scripts/migrate-edi-mnr.js
node scripts/migrate-demurrage.js
node scripts/migrate-storage-tiers.js
node scripts/migrate-cedex.js
node scripts/update-cedex-thai.js
```

> ✅ ดูผลลัพธ์ — ทุก script ควรแสดงข้อความ `✅ ... สำเร็จ`

---

## 8. Build + รัน Production

### 8.1 Pre-deploy Checks + Build

```bash
cd /var/www/container-yard-system

# ตรวจคุณภาพโค้ดก่อน build
npm run lint
npx tsc --noEmit --pretty false

# Build production bundle
npm run build
# → สร้าง .next/ directory
# ⏱ ใช้เวลาประมาณ 1-3 นาที
```

> ✅ `npm run lint` ต้องไม่มี error ก่อน deploy ได้ แต่ warning บางรายการ เช่น `<img>` optimization หรือ unused variable ใน migration script อาจยังแสดงได้โดยไม่ทำให้คำสั่ง fail
>
> ℹ️ ระบบ EDI SFTP ใช้ `ssh2-sftp-client` และถูกตั้งค่าเป็น server external package ใน `next.config.ts` แล้ว ไม่ต้องติดตั้งแยก ให้ใช้ `npm install` จาก `package.json` ตามปกติ

### 8.2 ทดสอบรัน

```bash
# ทดสอบรัน production
npm start
# → http://localhost:3005
# กด Ctrl+C เพื่อหยุด
```

---

## 9. ตั้งค่า PM2 (Process Manager)

PM2 จะดูแลให้ CYMS ทำงานตลอด 24/7 และ restart อัตโนมัติเมื่อ crash หรือ reboot

### 9.1 สร้าง PM2 Config

```bash
nano /var/www/container-yard-system/ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'cyms',
    cwd: '/var/www/container-yard-system',
    script: 'node_modules/.bin/next',
    args: 'start -p 3005',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3005,
    },
    error_file: '/var/www/container-yard-system/logs/error.log',
    out_file: '/var/www/container-yard-system/logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
  }]
};
```

### 9.2 สร้าง Log Directory + เริ่ม PM2

```bash
# สร้าง log directory
mkdir -p /var/www/container-yard-system/logs

# เริ่มรัน
cd /var/www/container-yard-system
pm2 start ecosystem.config.js

# ตรวจสอบสถานะ
pm2 status
# → cyms | online | 0% | 150MB

# ดู logs
pm2 logs cyms

# ตั้ง PM2 auto-start เมื่อ reboot
pm2 save
pm2 startup
# → คัดลอกคำสั่งที่แสดงแล้วรัน (sudo env PATH=... pm2 startup ...)
```

### 9.3 คำสั่ง PM2 ที่ใช้บ่อย

```bash
pm2 status            # ดูสถานะ
pm2 logs cyms         # ดู logs
pm2 restart cyms      # restart
pm2 stop cyms         # หยุด
pm2 delete cyms       # ลบ
pm2 monit             # monitor dashboard (TUI)
```

---

## 10. ตั้งค่า Nginx (Reverse Proxy)

Nginx ทำหน้าที่เป็น reverse proxy ระหว่าง Cloudflare Tunnel กับ Next.js — ช่วยเรื่อง **gzip compression**, **static file caching**, **security headers**, และ **rate limiting**

### 10.1 ติดตั้ง Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# ตรวจสอบ
nginx -v
sudo systemctl status nginx
```

### 10.2 สร้าง Config สำหรับ CYMS

```bash
sudo nano /etc/nginx/sites-available/cyms
```

```nginx
upstream cyms_backend {
    server 127.0.0.1:3005;
    keepalive 64;
}

server {
    listen 80;
    server_name cyms.yourcompany.com;

    # — Gzip Compression —
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 1000;
    gzip_types
        text/plain text/css text/javascript
        application/javascript application/json application/xml
        image/svg+xml;

    # — Security Headers —
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # — Static Files Cache (Next.js _next/static) —
    location /_next/static/ {
        proxy_pass http://cyms_backend;
        proxy_cache_valid 200 60d;
        add_header Cache-Control "public, max-age=5184000, immutable";
    }

    # — Favicon + manifest —
    location ~* \.(ico|png|svg|webmanifest)$ {
        proxy_pass http://cyms_backend;
        add_header Cache-Control "public, max-age=86400";
    }

    # — API routes (no caching) —
    location /api/ {
        proxy_pass http://cyms_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;

        # SSE (Server-Sent Events) support
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
    }

    # — Default: proxy ทุก request ไป Next.js —
    location / {
        proxy_pass http://cyms_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # — Request size limit (upload files) —
    client_max_body_size 20M;

    # — Logs —
    access_log /var/log/nginx/cyms_access.log;
    error_log  /var/log/nginx/cyms_error.log;
}
```

### 10.3 เปิดใช้งาน + ทดสอบ

```bash
# เปิดใช้ site config
sudo ln -s /etc/nginx/sites-available/cyms /etc/nginx/sites-enabled/

# ลบ default site (optional)
sudo rm -f /etc/nginx/sites-enabled/default

# ทดสอบ config
sudo nginx -t
# → nginx: configuration file /etc/nginx/nginx.conf test is successful

# Reload
sudo systemctl reload nginx

# ทดสอบเข้า
curl -I http://localhost
# → HTTP/1.1 200 OK
```

> ✅ ตอนนี้ Nginx ฟัง port 80 แล้ว proxy ไปยัง Next.js port 3005

---

## 11. ตั้งค่า Cloudflare Tunnel

Cloudflare Tunnel ทำให้เข้าถึง CYMS จาก internet ได้โดย **ไม่ต้องเปิด port บน firewall** — ปลอดภัยกว่า expose port ตรง

### 10.1 ข้อกำหนด

- มี Cloudflare account (ฟรีได้)
- มี domain ที่ใช้ Cloudflare DNS (เช่น `cyms.yourcompany.com`)

### 10.2 ติดตั้ง cloudflared

```bash
# ดาวน์โหลด + ติดตั้ง cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
rm cloudflared.deb

# ตรวจสอบ
cloudflared --version
```

### 10.3 Login + สร้าง Tunnel

```bash
# Login (จะเปิด browser — ถ้าเป็น headless server ให้ copy URL ไปเปิดเอง)
cloudflared tunnel login

# สร้าง Tunnel
cloudflared tunnel create cyms
# → จดจำ Tunnel ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
# → สร้างไฟล์ credentials: ~/.cloudflared/xxxxxxxx.json
```

### 10.4 สร้าง Config File

```bash
nano ~/.cloudflared/config.yml
```

```yaml
tunnel: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx    # ← ใส่ Tunnel ID
credentials-file: /home/YOUR_USER/.cloudflared/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.json

ingress:
  - hostname: cyms.yourcompany.com
    service: http://localhost:80
  - service: http_status:404
```

> ⚠️ แก้ `hostname`, `tunnel`, `credentials-file` ให้ตรงกับของจริง

### 10.5 สร้าง DNS Record

```bash
cloudflared tunnel route dns cyms cyms.yourcompany.com
# → สร้าง CNAME record: cyms.yourcompany.com → xxxxxxxx.cfargotunnel.com
```

### 10.6 ทดสอบ Tunnel

```bash
# ทดสอบรัน (foreground)
cloudflared tunnel run cyms
# → เปิด browser ไป https://cyms.yourcompany.com
# → ควรเห็นหน้า Login ของ CYMS
# กด Ctrl+C เพื่อหยุด
```

### 10.7 ตั้ง cloudflared เป็น Service (Auto-start)

```bash
# ติดตั้งเป็น system service
sudo cloudflared service install

# เริ่ม service
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

# ตรวจสอบ
sudo systemctl status cloudflared
# → Active: active (running)
```

> ✅ ตอนนี้ `https://cyms.yourcompany.com` → Cloudflare Tunnel → Nginx :80 → Next.js :3005 พร้อม SSL อัตโนมัติจาก Cloudflare

---

## 12. Firewall + Security

เนื่องจากใช้ Cloudflare Tunnel → **ไม่ต้องเปิด port ใดๆ บน firewall เลย** (ยกเว้น SSH)

```bash
# เปิดเฉพาะ SSH
sudo ufw allow OpenSSH

# เปิด firewall
sudo ufw enable
sudo ufw status

# ผลลัพธ์ที่ถูกต้อง:
# Status: active
# To          Action  From
# --          ------  ----
# OpenSSH     ALLOW   Anywhere
```

> 🔒 Port 3005 (Next.js), 80 (Nginx) และ 1433 (SQL Server) **ไม่ต้องเปิด** — Cloudflare Tunnel จัดการให้

### Security Checklist

- [ ] เปลี่ยน SA password ให้แข็งแรง
- [ ] ตั้ง JWT_SECRET เป็น random string ยาว 32+ ตัว
- [ ] ปิด SSH root login (`PermitRootLogin no` ใน `/etc/ssh/sshd_config`)
- [ ] ตั้ง fail2ban สำหรับ SSH
- [ ] ใช้ Cloudflare Access (Optional) เพื่อเพิ่ม authentication layer

```bash
# (Optional) ติดตั้ง fail2ban ป้องกัน brute-force SSH
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## 13. Backup Strategy

### 12.1 Database Backup Script

```bash
# สร้าง backup directory
sudo mkdir -p /var/backups/cyms

# สร้าง backup script
sudo nano /var/backups/cyms/backup.sh
```

```bash
#!/bin/bash
# CYMS Database Backup Script
BACKUP_DIR="/var/backups/cyms"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/CYMS_DB_$DATE.bak"

# Backup via sqlcmd
/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'YOUR_SA_PASSWORD' -C -Q "
BACKUP DATABASE CYMS_DB 
TO DISK = '$BACKUP_FILE' 
WITH FORMAT, COMPRESSION, NAME = 'CYMS Full Backup $DATE';
"

# ลบ backup เก่ากว่า 30 วัน
find $BACKUP_DIR -name "CYMS_DB_*.bak" -mtime +30 -delete

echo "✅ Backup สำเร็จ: $BACKUP_FILE"
```

### 12.2 ตั้ง Cron Job (Backup อัตโนมัติทุกวัน ตี 2)

```bash
sudo chmod +x /var/backups/cyms/backup.sh

# เพิ่ม cron job
sudo crontab -e
# เพิ่มบรรทัด:
0 2 * * * /var/backups/cyms/backup.sh >> /var/backups/cyms/backup.log 2>&1
```

---

## 14. อัปเดตระบบ

เมื่อต้องการ deploy version ใหม่:

```bash
cd /var/www/container-yard-system

# 1. ดึงโค้ดใหม่
git pull origin master

# 2. ติดตั้ง dependencies ใหม่ (ถ้ามีเพิ่ม)
npm install

# 3. รัน migration scripts ใหม่ (ถ้ามี)
# node scripts/migrate-xxx.js

# 4. ตรวจและ Build ใหม่
npm run lint
npx tsc --noEmit --pretty false
npm run build

# 5. Restart
pm2 restart cyms

# ตรวจสอบ
pm2 logs cyms --lines 20
```

### สร้าง Deploy Script (Optional)

```bash
nano /var/www/container-yard-system/deploy.sh
```

```bash
#!/bin/bash
set -e
echo "🚀 Deploying CYMS..."

cd /var/www/container-yard-system
git pull origin master
npm install
npm run lint
npx tsc --noEmit --pretty false
npm run build
pm2 restart cyms

echo "✅ Deploy สำเร็จ!"
pm2 status
```

```bash
chmod +x /var/www/container-yard-system/deploy.sh
# ใช้: ./deploy.sh
```

---

## 15. เคลียข้อมูลทดสอบ (ก่อนขึ้น Production)

> ⚠️ **รันคำสั่งเหล่านี้ก่อนขึ้น Production** เพื่อลบข้อมูลตัวอย่างที่ใช้ทดสอบออกไป

### วิธีที่ 1: 🔥 ลบ DB ทั้งหมด + สร้างใหม่ (สะอาดที่สุด — แนะนำสำหรับครั้งแรก)

```sql
-- รันบน DB Server (ผ่าน SSMS)
DROP DATABASE CYMS_DB;
GO
CREATE DATABASE CYMS_DB;
GO
```

แล้วรัน setup scripts ใหม่ทั้งหมด (ดูขั้นตอนที่ 7):

```bash
cd /var/www/container-yard-system
node scripts/setup-db.js
node scripts/seed-users.js
node scripts/seed-permissions.js
# รัน migration scripts ทั้งหมด (step 7)
# ❌ ไม่ต้องรัน seed-containers.js (ข้อมูลตัวอย่าง)
```

### วิธีที่ 2: 🧹 ลบเฉพาะข้อมูลทดสอบ (เก็บตั้งค่าไว้)

ใช้ script สำเร็จรูป — ลบข้อมูลธุรกรรม แต่เก็บการตั้งค่าไว้:

```bash
cd /var/www/container-yard-system
node scripts/clear-test-data.js --confirm
```

| ลบ | เก็บ |
|-----|------|
| ตู้คอนเทนเนอร์, บิล, Gate, Work Orders | Users, Yards, Zones |
| M&R, Audit Logs, Holds | Customers, Tariff |
| EDI Logs, Bookings | CEDEX Codes, Company Profile |

หลังรันเสร็จ ลบไฟล์รูปที่ทดสอบด้วย:

```bash
rm -rf public/uploads/gate-photos/*
rm -rf public/uploads/exit-photos/*
rm -rf public/uploads/repair-photos/*
pm2 restart cyms
```

### วิธีที่ 3: 🗂️ แยก Database ใหม่ (ทดสอบ vs Production)

สร้าง database ใหม่บน DB Server แล้วเปลี่ยนค่าใน `.env.local`:

```sql
-- สร้าง DB ใหม่บน DB Server
CREATE DATABASE CYMS_PROD;
GO
```

```bash
# แก้ .env.local
DB_NAME=CYMS_PROD

# รัน setup scripts ทั้งหมด (เหมือนขั้นตอนที่ 7)
npm run build && pm2 restart cyms
```

> 💡 วิธีนี้ดีถ้าต้องการเก็บ DB ทดสอบไว้ด้วย เพื่อกลับมาใช้ทีหลัง

---

## 16. Troubleshooting

### CYMS ไม่ทำงาน

```bash
# ตรวจสอบ PM2
pm2 status
pm2 logs cyms --lines 50

# ตรวจสอบ port
sudo lsof -i :3005

# restart
pm2 restart cyms
```

### เชื่อมต่อ SQL Server ไม่ได้

```bash
# ตรวจสอบ service
sudo systemctl status mssql-server

# restart
sudo systemctl restart mssql-server

# ทดสอบเชื่อมต่อ
sqlcmd -S localhost -U cyms_user -P 'CymsStr0ng!Pass' -C -d CYMS_DB -Q "SELECT 1"

# ดู log
sudo cat /var/opt/mssql/log/errorlog | tail -50
```

### Nginx ไม่ทำงาน / 502 Bad Gateway

```bash
# ตรวจสอบ service
sudo systemctl status nginx

# ทดสอบ config
sudo nginx -t

# restart
sudo systemctl restart nginx

# ดู error log
tail -50 /var/log/nginx/cyms_error.log

# ตรวจว่า Next.js ยังทำงานอยู่
curl -I http://127.0.0.1:3005
# ถ้าไม่ได้ → pm2 restart cyms
```

### Cloudflare Tunnel ไม่ทำงาน

```bash
# ตรวจสอบ service
sudo systemctl status cloudflared

# restart
sudo systemctl restart cloudflared

# ดู log
sudo journalctl -u cloudflared --since "10 minutes ago"

# ทดสอบ manual
cloudflared tunnel run cyms
```

### Build ไม่ผ่าน / `.next` ถูกล็อกไฟล์

ถ้า `npm run build` เจอ error ประเภท `EPERM`, `permission denied`, `unlink .next/...` หรือสงสัยว่าไฟล์ build ถูก process เดิมล็อกอยู่ ให้หยุด PM2 แล้วล้าง `.next` ก่อน build ใหม่:

```bash
cd /var/www/container-yard-system
pm2 stop cyms
rm -rf .next
npm run build
pm2 restart cyms
```

ถ้า build fail เกี่ยวกับ SFTP/EDI ให้ตรวจว่า `next.config.ts` ยังมี external package ต่อไปนี้:

```ts
serverExternalPackages: ['node-cron', 'ssh2', 'ssh2-sftp-client']
```

### EDI SFTP ส่งไฟล์ไม่สำเร็จ

```bash
# ทดสอบ port SFTP จาก App Server
nc -zv <SFTP_HOST> 22

# ดู log ระบบ
pm2 logs cyms --lines 100
```

Checklist ที่ควรตรวจ:

- Endpoint type ต้องเป็น `sftp`
- Host, port, username, password ถูกต้อง
- Firewall เปิด port SFTP ระหว่าง App Server กับปลายทาง
- `remote_path` มีอยู่จริง และ user มีสิทธิ์เขียนไฟล์
- ตรวจประวัติที่หน้า `EDI & ข้อมูลล่วงหน้า` และ `Integration Logs`

### Out of Memory

```bash
# ดู memory usage
free -h
pm2 monit

# เพิ่ม swap (ถ้า RAM น้อย)
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## สรุป Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Internet                           │
│              https://cyms.yourcompany.com             │
└───────────────────────┬──────────────────────────────┘
                        │ SSL (auto by Cloudflare)
                        ▼
┌──────────────────────────────────────────────────────┐
│              Cloudflare Edge Network                  │
│              (CDN + DDoS Protection + WAF)            │
└───────────────────────┬──────────────────────────────┘
                        │ Cloudflare Tunnel (encrypted)
                        ▼
┌──────────────────────────────────────────────────────┐
│             Ubuntu Server                             │
│  ┌────────────────────────────────────────────────┐   │
│  │  cloudflared (tunnel daemon)                   │   │
│  └──────────────────┬─────────────────────────────┘   │
│                     │ http://localhost:80              │
│  ┌──────────────────▼─────────────────────────────┐   │
│  │  Nginx (reverse proxy)                         │   │
│  │  gzip + cache + security headers               │   │
│  └──────────────────┬─────────────────────────────┘   │
│                     │ http://127.0.0.1:3005           │
│  ┌──────────────────▼─────────────────────────────┐   │
│  │  PM2 → Next.js (CYMS)                         │   │
│  │  /var/www/container-yard-system                │   │
│  └──────────────────┬─────────────────────────────┘   │
│                     │ tcp://localhost:1433             │
│  ┌──────────────────▼─────────────────────────────┐   │
│  │  MS SQL Server 2022 Express                    │   │
│  │  Database: CYMS_DB                             │   │
│  └────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

---

## Quick Reference

| รายการ | คำสั่ง |
|--------|--------|
| เข้าถึง CYMS | `https://cyms.yourcompany.com` |
| ดู logs | `pm2 logs cyms` |
| Restart CYMS | `pm2 restart cyms` |
| Restart Nginx | `sudo systemctl restart nginx` |
| ทดสอบ Nginx config | `sudo nginx -t` |
| ดู Nginx logs | `tail -f /var/log/nginx/cyms_error.log` |
| Restart SQL Server | `sudo systemctl restart mssql-server` |
| Restart Tunnel | `sudo systemctl restart cloudflared` |
| Deploy ใหม่ | `cd /var/www/container-yard-system && ./deploy.sh` |
| Backup DB | `sudo /var/backups/cyms/backup.sh` |
| รัน Tests | `cd /var/www/container-yard-system && npm test` |
| อัปเดต CEDEX ภาษาไทย | `node scripts/update-cedex-thai.js` |
| Export PDF รายงาน | บัญชี → รายงาน → ปุ่ม PDF (client-side, ไม่ต้องตั้งค่าเพิ่ม) |

---

> **ผู้สร้าง**: AI Assistant (Antigravity)  
> **วันที่**: 24 มีนาคม 2569  
> **Project**: CYMS — Container Yard Management System
