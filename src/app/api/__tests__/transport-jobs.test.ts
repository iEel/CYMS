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
    headers: { 'x-user-id': String(userId) },
  });
}

describe('Transport jobs API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns driver-scoped operational jobs without billing or internal fields', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const route = require('../transport/jobs/route') as typeof import('../transport/jobs/route');
    const db = makeDb([
      q([{ user_id: 21, customer_id: 44, role_code: 'customer', customer_portal_role: 'driver_user' }]),
      q([{
        job_id: 'request-88',
        source: 'gate_out_request',
        status: 'requested',
        container_number: 'ONEU1234567',
        booking_number: 'BK-001',
        transaction_type: 'gate_out',
        yard_name: 'Main Yard',
        zone_name: 'A',
        bay: 1,
        row_no: 2,
        tier: 0,
        requested_at: '2026-06-04T08:00:00.000Z',
        gate_datetime: null,
        driver_name: 'Driver One',
        truck_plate: '1กก-1234',
        eir_number: null,
        billing_clearance: 'clear',
        invoice_amount: 1200,
        credit_hold_reason: 'hidden',
        internal_note: 'internal only',
      }]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(transportRequest('/api/transport/jobs'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toMatchObject({ open: 1, atGate: 0, releasedToday: 0, attention: 0 });
    expect(body.jobs).toEqual([
      expect.objectContaining({
        jobId: 'request-88',
        source: 'gate_out_request',
        status: 'requested',
        containerNumber: 'ONEU1234567',
        bookingNumber: 'BK-001',
        yardSlot: 'A-1-2-0',
        driverName: 'Driver One',
        truckPlate: '1กก-1234',
      }),
    ]);
    expect(JSON.stringify(body)).not.toContain('invoice_amount');
    expect(JSON.stringify(body)).not.toContain('billing_clearance');
    expect(JSON.stringify(body)).not.toContain('credit_hold_reason');
    expect(JSON.stringify(body)).not.toContain('internal only');
    expect(db.input).toHaveBeenCalledWith('transportUserId', expect.anything(), 21);
    expect(db.queries.join('\n')).toContain('driver_user_id = @transportUserId');
  });

  it('uses trucking company predicates and active trucking grants for coordinators', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/transport/jobs/route.ts'),
      'utf8',
    ) + fs.readFileSync(path.join(process.cwd(), 'src/lib/transportPortalAccess.ts'), 'utf8');

    expect(source).toContain('requireTransportPortalActor');
    expect(source).toContain('buildTransportJobAccessSql');
    expect(source).toContain("transport.jobs.view");
    expect(source).toContain('@transportCustomerId');
    expect(source).toContain("pea.access_role = 'trucking'");
    expect(source).toContain('GateOutRequests');
    expect(source).toContain('GateTransactions');
    expect(source).not.toContain('Invoices');
    expect(source).not.toContain('BillingClearances');
    expect(source).not.toContain('invoice_amount');
    expect(source).not.toContain('billing_clearance');
    expect(source).not.toContain('internal_note');
  });
});
