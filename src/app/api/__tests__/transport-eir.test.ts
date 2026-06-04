import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';

import { getDb } from '@/lib/db';

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
}));

const mockedGetDb = getDb as jest.Mock;

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

function transportRequest(path: string, userId = 21) {
  return new NextRequest(`http://localhost${path}`, {
    headers: { 'x-user-id': String(userId), 'user-agent': 'jest' },
  });
}

const eirRow = {
  transaction_id: 77,
  eir_number: 'EIR-OUT-2026-000077',
  transaction_type: 'gate_out',
  created_at: '2026-06-04T09:00:00.000Z',
  gate_datetime: '2026-06-04T09:00:00.000Z',
  container_number: 'ONEU1234567',
  size: '20',
  type: 'GP',
  shipping_line: 'ONE',
  is_laden: false,
  seal_number: 'SEAL-1',
  driver_name: 'Driver One',
  driver_phone: '0812345678',
  truck_plate: '1กก-1234',
  truck_company: 'Fast Trucking',
  booking_ref: 'BK-001',
  yard_name: 'Main Yard',
  yard_code: 'MY',
  zone_name: 'A',
  bay: 1,
  row: 2,
  tier: 0,
  processed_by_name: 'Gate Staff',
  notes: 'visible note',
  damage_report: JSON.stringify({ condition_grade: 'C', points: [] }),
  container_grade: 'C',
  invoice_amount: 5000,
  billing_clearance: 'clear',
  internal_note: 'internal only',
};

describe('Transport EIR API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns driver EIR copy through centralized visibility and logs access', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const route = require('../transport/eir/route') as typeof import('../transport/eir/route');
    const db = makeDb([
      q([{ user_id: 21, customer_id: 44, role_code: 'customer', customer_portal_role: 'driver_user' }]),
      q([eirRow]),
      q([{ company_name: 'CYMS', address: 'Bangkok', phone: '02', tax_id: '010' }]),
      q([{ lifecycle_id: 1, document_type: 'eir', document_number: 'EIR-OUT-2026-000077', internal_note: 'hide' }]),
      q([]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(transportRequest('/api/transport/eir?eir_number=EIR-OUT-2026-000077'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.eir).toEqual(expect.objectContaining({
      eir_number: 'EIR-OUT-2026-000077',
      copy_type_label: 'Driver Copy',
      driver_name: 'Driver One',
      driver_phone: '0812345678',
      truck_plate: '1กก-1234',
    }));
    expect(body.eir).not.toHaveProperty('container_grade');
    expect(body.eir).not.toHaveProperty('invoice_amount');
    expect(body.eir).not.toHaveProperty('billing_clearance');
    expect(body.eir).not.toHaveProperty('internal_note');
    expect(JSON.stringify(body)).not.toContain('internal only');
    expect(JSON.stringify(body)).not.toContain('hide');
    expect(db.input).toHaveBeenCalledWith('transportUserId', expect.anything(), 21);
    expect(db.queries.join('\n')).toContain('driver_user_id = @transportUserId');
    expect(db.queries.join('\n')).toContain('EIRAccessLog');
  });

  it('wires trucking EIR through the transport policy and never returns billing fields', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/transport/eir/route.ts'),
      'utf8',
    ) + fs.readFileSync(path.join(process.cwd(), 'src/lib/transportPortalAccess.ts'), 'utf8');

    expect(source).toContain('requireTransportPortalActor');
    expect(source).toContain('buildTransportEirAccessSql');
    expect(source).toContain('buildEirViewPayload');
    expect(source).toContain('logEirAccess');
    expect(source).toContain("actor.mode === 'driver' ? 'driver' : 'trucking'");
    expect(source).toContain("transport.eir.view");
    expect(source).toContain('@transportCustomerId');
    expect(source).toContain('@transportUserId');
    expect(source).not.toContain('Invoices');
    expect(source).not.toContain('BillingClearances');
    expect(source).not.toContain('invoice_amount');
    expect(source).not.toContain('billing_clearance');
    expect(source).not.toContain('internal_note');
  });
});
