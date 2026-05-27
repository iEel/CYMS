import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { generateEIRPDF } from '@/lib/eirPdfGenerator';

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
}));

jest.mock('@/lib/eirPdfGenerator', () => ({
  generateEIRPDF: jest.fn(() => Buffer.from('%PDF-portal-eir')),
}));

const mockedGetDb = getDb as jest.Mock;
const mockedGenerateEIRPDF = generateEIRPDF as jest.Mock;

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function portalRequest(pathname: string) {
  return new NextRequest(`http://localhost${pathname}`, {
    headers: { 'x-customer-id': '42', 'x-user-id': '9' },
  });
}

function makeExactOnlyDb() {
  const queries: string[] = [];
  const input = jest.fn().mockReturnThis();
  const query = jest.fn().mockImplementation((statement: string) => {
    queries.push(statement);
    if (statement.includes('FROM Users')) {
      return Promise.resolve({ recordset: [{ customer_portal_role: 'customer_admin' }] });
    }
    if (statement.includes('FROM GateTransactions g')) {
      expect(statement).toContain("pea.entity_type = 'eir'");
      expect(statement).toContain("pea.entity_type = 'gate_transaction'");
      expect(statement).not.toContain("pea.entity_type = 'container'");
      return Promise.resolve({ recordset: [] });
    }
    return Promise.resolve({ recordset: [] });
  });
  const request = jest.fn(() => ({ input, query }));
  return { request, input, query, queries };
}

describe('portal EIR and gate exact grants', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    'src/app/api/portal/eir/route.ts',
    'src/app/api/portal/eir-pdf/route.ts',
  ])('%s does not admit container grants in full EIR detail queries', (routePath) => {
    const source = readSource(routePath);

    expect(source).toContain('portalEirVisibilitySql');
    expect(source).not.toContain("pea.entity_type = 'container'");
    expect(source).not.toContain('allowContainerFallback: true');
  });

  it('uses exact EIR grants for EIR entries in the document bundle', () => {
    const source = readSource('src/app/api/portal/document-bundle/route.ts');

    expect(source).toContain('portalEirExactVisibilitySql');
    expect(source).not.toContain('portalGateExactVisibilitySql');
    expect(source).not.toContain('allowContainerFallback: true');
  });

  it('keeps container timeline gate events at summary level when scoped by container visibility', () => {
    const source = readSource('src/app/api/portal/timeline/route.ts');

    expect(source).toContain('portalContainerVisibilitySql');
    expect(source).not.toContain('driver_phone');
    expect(source).not.toContain('signature');
    expect(source).not.toContain('billing');
    expect(source).not.toContain('photo');
    expect(source).not.toContain('damage_report');
    expect(source).not.toContain('g.remarks AS detail');
  });

  it('does not return EIR JSON detail when exact EIR or gate grants are absent', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const route = require('../portal/eir/route') as typeof import('../portal/eir/route');
    const db = makeExactOnlyDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(portalRequest('/api/portal/eir?eir_number=EIR-IN-2026-000077'));

    expect(res.status).toBe(404);
    expect(db.queries.join('\n')).toContain('PortalEntityAccess');
  });

  it('does not return EIR PDF when exact EIR or gate grants are absent', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const route = require('../portal/eir-pdf/route') as typeof import('../portal/eir-pdf/route');
    const db = makeExactOnlyDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(portalRequest('/api/portal/eir-pdf?eir_number=EIR-IN-2026-000077'));

    expect(res.status).toBe(404);
    expect(mockedGenerateEIRPDF).not.toHaveBeenCalled();
    expect(db.queries.join('\n')).toContain('PortalEntityAccess');
  });
});
