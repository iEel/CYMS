import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('portal booking upload UI auth contract', () => {
  it('allows cookie-restored sessions to upload and only adds Authorization when a token exists', () => {
    const source = read('src/app/(portal)/portal/bookings/page.tsx');
    const uploadStart = source.indexOf('const uploadBookingDocument = async');
    const uploadEnd = source.indexOf('const uploadData = await uploadRes.json()', uploadStart);
    const uploadSource = source.slice(uploadStart, uploadEnd);

    expect(uploadSource).not.toContain('if (!session?.token)');
    expect(uploadSource).not.toContain("setDocumentError('ไม่พบ session สำหรับอัปโหลดไฟล์')");
    expect(uploadSource).toContain("const uploadHeaders: Record<string, string> = { 'Content-Type': 'application/json' };");
    expect(uploadSource).toContain('if (session?.token) uploadHeaders.Authorization = `Bearer ${session.token}`;');
    expect(uploadSource).toContain('headers: uploadHeaders');
  });
});
