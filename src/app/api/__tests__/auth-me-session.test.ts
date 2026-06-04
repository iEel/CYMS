import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('/api/auth/me session hardening', () => {
  it('does not return the raw JWT in session while still reading header and cookie tokens', () => {
    const source = read('src/app/api/auth/me/route.ts');
    const sessionStart = source.indexOf('const session = {');
    const sessionEnd = source.indexOf('return NextResponse.json({ authenticated: true, session })');
    const sessionSource = source.slice(sessionStart, sessionEnd);

    expect(sessionSource).not.toMatch(/^\s*token\s*[:,]/m);
    expect(sessionSource).not.toContain('token, // ส่ง token');
    expect(source).toContain("request.headers.get('x-cyms-token')");
    expect(source).toContain("request.cookies.get('cyms_token')");
  });

  it('returns customer portal role in restored customer sessions', () => {
    const source = read('src/app/api/auth/me/route.ts');
    const sessionStart = source.indexOf('const session = {');
    const sessionEnd = source.indexOf('return NextResponse.json({ authenticated: true, session })');
    const sessionSource = source.slice(sessionStart, sessionEnd);

    expect(source).toContain('u.customer_portal_role');
    expect(sessionSource).toContain('customerPortalRole');
  });
});
