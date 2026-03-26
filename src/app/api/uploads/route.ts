import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { logAudit } from '@/lib/audit';

// POST — Upload photo (base64 → file)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, folder = 'photos', filename_prefix = 'photo' } = body;
    // data = base64 data URL like "data:image/jpeg;base64,/9j/..."

    if (!data || !data.startsWith('data:')) {
      return NextResponse.json({ error: 'Invalid image data' }, { status: 400 });
    }

    // Parse base64
    const matches = data.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json({ error: 'Invalid base64 format' }, { status: 400 });
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const buffer = Buffer.from(matches[2], 'base64');

    // Create directory: public/uploads/{folder}/{YYYY-MM}
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder, yearMonth);

    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = now.getTime();
    const random = Math.random().toString(36).substring(2, 8);
    const fileName = `${filename_prefix}_${timestamp}_${random}.${ext}`;
    const filePath = path.join(uploadDir, fileName);

    // Write file
    await writeFile(filePath, buffer);

    // Return public URL path
    const urlPath = `/uploads/${folder}/${yearMonth}/${fileName}`;

    await logAudit({ action: 'file_upload', entityType: 'upload', details: { folder, filename: fileName, size: buffer.length, url: urlPath } });

    return NextResponse.json({
      success: true,
      url: urlPath,
      size: buffer.length,
    });
  } catch (error) {
    console.error('❌ Upload error:', error);
    return NextResponse.json({ error: 'อัปโหลดไฟล์ไม่สำเร็จ' }, { status: 500 });
  }
}
