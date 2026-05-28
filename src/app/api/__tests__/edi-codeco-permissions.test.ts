import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requirePermission, requireYardAccess } from '@/lib/apiAuth';
import { GET } from '../edi/codeco/route';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/apiAuth', () => ({
  requirePermission: jest.fn(),
  requireYardAccess: jest.fn(),
}));

const repoRoot = path.resolve(__dirname, '../../../..');
const mockedGetDb = getDb as jest.Mock;
const mockedRequirePermission = requirePermission as jest.Mock;
const mockedRequireYardAccess = requireYardAccess as jest.Mock;

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function makeDb() {
  const queries: string[] = [];
  const input = jest.fn().mockReturnThis();
  const query = jest.fn().mockImplementation((statement: string) => {
    queries.push(statement);
    return Promise.resolve({ recordset: [] });
  });

  return {
    request: jest.fn(() => ({ input, query })),
    queries,
  };
}

function makeRequest() {
  return new NextRequest('http://localhost/api/edi/codeco?yard_id=1&format=json', {
    headers: { 'x-user-id': '9', 'x-user-role': 'supervisor' },
  });
}

describe('CODECO export permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires integration permission before querying gate transactions and keeps yard access', () => {
    const source = read('src/app/api/edi/codeco/route.ts');

    expect(source).toContain('requirePermission');
    expect(source).toContain('integration.send');
    expect(source).not.toContain('integration.logs.view');
    expect(source.indexOf('requirePermission')).toBeLessThan(source.indexOf('SELECT g.transaction_id'));
    expect(source).toContain('requireYardAccess');
  });

  it('rejects actors without integration.send before running the CODECO export query', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);
    mockedRequirePermission.mockResolvedValue(
      NextResponse.json({ error: 'คุณไม่มีสิทธิ์ export CODECO' }, { status: 403 })
    );

    const res = await GET(makeRequest());

    expect(res.status).toBe(403);
    expect(mockedRequirePermission).toHaveBeenCalledWith(
      expect.anything(),
      db,
      'integration.send',
      'คุณไม่มีสิทธิ์ export CODECO'
    );
    expect(mockedRequireYardAccess).not.toHaveBeenCalled();
    expect(db.queries.some(query => query.includes('SELECT g.transaction_id'))).toBe(false);
  });
});
