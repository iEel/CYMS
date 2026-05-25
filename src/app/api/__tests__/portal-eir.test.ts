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

type QueryResult = { recordset: unknown[] };

function q(recordset: unknown[]): QueryResult {
  return { recordset };
}

function makeDb(queue: QueryResult[]) {
  const queries: string[] = [];
  const input = jest.fn().mockReturnThis();
  const query = jest.fn().mockImplementation((statement: string) => {
    queries.push(statement);
    return Promise.resolve(queue.shift() || q([]));
  });
  const request = jest.fn(() => ({ input, query }));
  return { request, input, query, queries };
}

function portalRequest(path: string) {
  return new NextRequest(`http://localhost${path}`, {
    headers: { 'x-customer-id': '42', 'x-user-id': '9' },
  });
}

const damageReport = {
  condition_grade: 'C',
  inspector_notes: 'Dent on left panel',
  points: [{ id: 'p1', side: 'left', x: 42, y: 55, type: 'dent', severity: 'major', note: 'Dent' }],
  photo_evidence: [{ id: 'front', url: '/uploads/front.jpg', category: 'front', label: 'Front', taken_at: '' }],
  photo_completeness: { required: 5, completed: 4, total: 4, missing_categories: ['ด้านซ้าย'] },
};

const eirRow = {
  transaction_id: 77,
  eir_number: 'EIR-IN-2026-000077',
  transaction_type: 'gate_in',
  created_at: '2026-05-21T08:00:00.000Z',
  container_number: 'MSKU1234567',
  size: '20',
  type: 'GP',
  shipping_line: 'MSK',
  is_laden: false,
  seal_number: 'SEAL-1',
  driver_name: 'Somchai',
  truck_plate: '70-1234',
  truck_company: 'ACME Truck',
  booking_ref: 'BK-77',
  yard_name: 'Main Yard',
  yard_code: 'MY',
  zone_name: 'A',
  bay: 1,
  row: 2,
  tier: 3,
  processed_by_name: 'Operator',
  notes: 'Portal EIR',
  damage_report: JSON.stringify(damageReport),
};

describe('Customer Portal EIR', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('downloads Portal EIR PDF with the sanitized customer EIR fields', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const route = require('../portal/eir-pdf/route') as typeof import('../portal/eir-pdf/route');
    const db = makeDb([
      q([{ customer_portal_role: 'customer_admin' }]),
      q([{ ...eirRow, access_role: 'booking_customer', permission_scope: null }]),
      q([{ company_name: 'CYMS', address: 'Bangkok', phone: '02', tax_id: '010' }]),
      q([]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(portalRequest('/api/portal/eir-pdf?eir_number=EIR-IN-2026-000077'));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(mockedGenerateEIRPDF).toHaveBeenCalledWith(expect.objectContaining({
      eir_number: 'EIR-IN-2026-000077',
      damage_report: expect.objectContaining({
        condition_grade: 'C',
        points: expect.arrayContaining([expect.objectContaining({ side: 'left', type: 'dent' })]),
      }),
    }));
    expect(mockedGenerateEIRPDF.mock.calls[0][0]).not.toHaveProperty('container_grade');
    expect(mockedGenerateEIRPDF.mock.calls[0][0]).not.toHaveProperty('truck_company');
    expect(mockedGenerateEIRPDF.mock.calls[0][0].damage_report).not.toHaveProperty('photo_completeness');
    const combinedSql = db.queries.join('\n');
    expect(combinedSql).toContain('PortalEntityAccess');
    expect(combinedSql).toContain("pea.entity_type = 'eir'");
    expect(combinedSql).toContain("pea.entity_type = 'gate_transaction'");
    expect(combinedSql).toContain('EIRAccessLog');
  });

  it('returns Portal-scoped EIR JSON with parsed damage report and document lifecycle', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const route = require('../portal/eir/route') as typeof import('../portal/eir/route');
    const db = makeDb([
      q([{ customer_portal_role: 'customer_admin' }]),
      q([{ ...eirRow, access_role: 'booking_customer', permission_scope: null }]),
      q([{ company_name: 'CYMS', address: 'Bangkok', phone: '02', email: 'ops@example.test', logo_url: '', tax_id: '010' }]),
      q([{
        lifecycle_id: 1,
        document_type: 'eir',
        document_number: 'EIR-IN-2026-000077',
        status: 'issued',
        action: 'issued',
        event_type: 'created',
        user_name: 'Operator',
        yard_name: 'Main Yard',
        created_at: '2026-05-21T08:00:00.000Z',
        reason: 'Internal reason',
        details: '{"private":true}',
        internal_note: 'private note',
        billing_clearance_id: 123,
      }]),
      q([]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(portalRequest('/api/portal/eir?eir_number=EIR-IN-2026-000077'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      eir: {
        eir_number: 'EIR-IN-2026-000077',
        damage_report: {
          condition_grade: 'C',
          points: [{ side: 'left', type: 'dent', severity: 'major', note: 'Dent' }],
        },
      },
      lifecycle: [{ lifecycle_id: 1 }],
    });
    expect(body.eir).not.toHaveProperty('container_grade');
    expect(body.eir).not.toHaveProperty('truck_company');
    expect(body.eir.damage_report).not.toHaveProperty('photo_completeness');
    expect(body.lifecycle[0]).toEqual({
      lifecycle_id: 1,
      document_type: 'eir',
      document_number: 'EIR-IN-2026-000077',
      status: 'issued',
      action: 'issued',
      event_type: 'created',
      user_name: 'Operator',
      yard_name: 'Main Yard',
      created_at: '2026-05-21T08:00:00.000Z',
    });
    expect(body.lifecycle[0]).not.toHaveProperty('reason');
    expect(body.lifecycle[0]).not.toHaveProperty('details');
    expect(body.lifecycle[0]).not.toHaveProperty('internal_note');
    expect(body.lifecycle[0]).not.toHaveProperty('billing_clearance_id');
    const combinedSql = db.queries.join('\n');
    expect(combinedSql).toContain('PortalEntityAccess');
    expect(combinedSql).toContain("pea.entity_type = 'eir'");
    expect(combinedSql).toContain("pea.entity_type = 'gate_transaction'");
    expect(combinedSql).toContain('DocumentLifecycle');
    expect(combinedSql).toContain('EIRAccessLog');
  });
});
