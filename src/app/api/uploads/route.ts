import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { logAudit } from '@/lib/audit';
import { verifyToken } from '@/lib/auth';

// [Security] whitelist ของ folder ที่อนุญาต — ป้องกัน path traversal
const ALLOWED_FOLDERS = new Set(['photos', 'damage', 'eir', 'mnr', 'documents']);

// [Security] จำกัดขนาดไฟล์ 5MB (base64 ~= 4/3 ของต้นฉบับ)
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

// POST — Upload photo (base64 → file) — ต้องมี Bearer token
export async function POST(request: NextRequest) {
  try {
    // [Security] ตรวจสอบ auth token เพิ่มเติม (middleware ยังเช็คก่อนถึงที่นี่แล้ว)
    // แต่เช็คอีกรอบในกรณีที่ route path เปลี่ยนแล้ว PUBLIC_PATHS อาจยัง miss
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'ไม่ได้รับอนุญาต — กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }
    const user = await verifyToken(authHeader.slice(7));
    if (!user) {
      return NextResponse.json({ error: 'Token ไม่ถูกต้องหรือหมดอายุ' }, { status: 401 });
    }

    const body = await request.json();
    const { data, folder = 'photos', filename_prefix = 'photo' } = body;

    // [Security] Whitelist folder — ป้องกัน path traversal เช่น "../../../etc/passwd"
    const sanitizedFolder = String(folder).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!ALLOWED_FOLDERS.has(sanitizedFolder)) {
      return NextResponse.json(
        { error: `folder ไม่ถูกต้อง อนุญาตเฉพาะ: ${[...ALLOWED_FOLDERS].join(', ')}` },
        { status: 400 }
      );
    }

    if (!data || !data.startsWith('data:')) {
      return NextResponse.json({ error: 'Invalid image data' }, { status: 400 });
    }

    // Parse base64
    const matches = data.match(/^data:image\/(jpeg|png|jpg|webp|gif);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json({ error: 'รูปแบบไม่ถูกต้อง รองรับ: jpeg, png, webp, gif' }, { status: 400 });
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const buffer = Buffer.from(matches[2], 'base64');

    // [Security] จำกัดขนาดไฟล์
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `ไฟล์ใหญ่เกินไป (สูงสุด ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB)` },
        { status: 413 }
      );
    }

    // [Security] Sanitize filename_prefix
    const safePrefix = String(filename_prefix).replace(/[^a-z0-9_-]/gi, '').slice(0, 30) || 'photo';

    // Create directory: public/uploads/{folder}/{YYYY-MM}
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', sanitizedFolder, yearMonth);

    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = now.getTime();
    const random = Math.random().toString(36).substring(2, 8);
    const fileName = `${safePrefix}_${timestamp}_${random}.${ext}`;
    const filePath = path.join(uploadDir, fileName);

    // Write file
    await writeFile(filePath, buffer);

    // Return public URL path
    const urlPath = `/uploads/${sanitizedFolder}/${yearMonth}/${fileName}`;

    await logAudit({
      userId: user.userId,
      action: 'file_upload',
      entityType: 'upload',
      details: { folder: sanitizedFolder, filename: fileName, size: buffer.length, url: urlPath },
    });

    return NextResponse.json({ success: true, url: urlPath, size: buffer.length });
  } catch (error) {
    console.error('❌ Upload error:', error);
    return NextResponse.json({ error: 'อัปโหลดไฟล์ไม่สำเร็จ' }, { status: 500 });
  }
}
