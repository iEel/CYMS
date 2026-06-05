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
      q([
        {
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
          proof_count: 2,
          last_activity_at: '2026-06-04T08:15:00.000Z',
          billing_clearance: 'clear',
          invoice_amount: 1200,
          credit_hold_reason: 'hidden',
          internal_note: 'internal only',
        },
        {
          job_id: 'gate-99',
          source: 'gate_transaction',
          status: 'released',
          container_number: 'ONEU7654321',
          booking_number: 'BK-002',
          transaction_type: 'gate_out',
          yard_name: 'Main Yard',
          zone_name: 'B',
          bay: 3,
          row_no: 4,
          tier: 1,
          requested_at: null,
          gate_datetime: null,
          driver_name: 'Driver Two',
          truck_plate: '2กก-5678',
          eir_number: 'EIR-99',
          proof_count: 0,
          last_activity_at: null,
        },
      ]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(transportRequest('/api/transport/jobs'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toMatchObject({ open: 1, atGate: 0, releasedToday: 0, attention: 0 });
    expect(body.jobs[0]).toEqual(expect.objectContaining({
      jobId: 'request-88',
      source: 'gate_out_request',
      status: 'requested',
      containerNumber: 'ONEU1234567',
      bookingNumber: 'BK-001',
      yardSlot: 'A-1-2-0',
      driverName: 'Driver One',
      truckPlate: '1กก-1234',
      availableActions: ['confirm_job', 'report_issue', 'add_proof'],
      proofCount: 2,
      lastActivityAt: '2026-06-04T08:15:00.000Z',
    }));
    expect(body.jobs[1]).toEqual(expect.objectContaining({
      jobId: 'gate-99',
      source: 'gate_transaction',
      status: 'released',
      availableActions: [],
      proofCount: 0,
    }));
    expect(body.jobs[1].lastActivityAt).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('invoice_amount');
    expect(JSON.stringify(body)).not.toContain('billing_clearance');
    expect(JSON.stringify(body)).not.toContain('credit_hold_reason');
    expect(JSON.stringify(body)).not.toContain('internal only');
    expect(db.input).toHaveBeenCalledWith('transportUserId', expect.anything(), 21);
    expect(db.queries.join('\n')).toContain('driver_user_id = @transportUserId');
  });

  it('maps request status to action route transition sets', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const route = require('../transport/jobs/route') as typeof import('../transport/jobs/route');
    const db = makeDb([
      q([{ user_id: 21, customer_id: 44, role_code: 'customer', customer_portal_role: 'driver_user' }]),
      q([
        { job_id: 'request-1', source: 'gate_out_request', status: 'confirmed', container_number: 'ONEU0000001' },
        { job_id: 'request-2', source: 'gate_out_request', status: 'issue_reported', container_number: 'ONEU0000002' },
        { job_id: 'request-3', source: 'gate_out_request', status: 'released', container_number: 'ONEU0000003' },
        { job_id: 'request-4', source: 'gate_out_request', status: 'pending', container_number: 'ONEU0000004' },
        { job_id: 'request-5', source: 'gate_out_request', status: 'at_gate', container_number: 'ONEU0000005' },
      ]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(transportRequest('/api/transport/jobs'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobs).toEqual([
      expect.objectContaining({
        jobId: 'request-1',
        availableActions: ['mark_arrived', 'report_issue', 'add_proof'],
      }),
      expect.objectContaining({
        jobId: 'request-2',
        availableActions: ['confirm_job', 'mark_arrived', 'add_proof'],
      }),
      expect.objectContaining({
        jobId: 'request-3',
        availableActions: [],
      }),
      expect.objectContaining({
        jobId: 'request-4',
        availableActions: ['confirm_job', 'report_issue', 'add_proof'],
      }),
      expect.objectContaining({
        jobId: 'request-5',
        availableActions: ['report_issue', 'add_proof'],
      }),
    ]);
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
    expect(source).toContain('TransportJobProofs');
    expect(source).toContain('TransportJobActivities');
    expect(source).toContain('proof_count');
    expect(source).toContain('last_activity_at');
    expect(source).not.toContain('Invoices');
    expect(source).not.toContain('BillingClearances');
    expect(source).not.toContain('invoice_amount');
    expect(source).not.toContain('billing_clearance');
    expect(source).not.toContain('internal_note');
  });
});
