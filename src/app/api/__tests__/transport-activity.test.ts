import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';

import { getDb } from '@/lib/db';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));

const mockedGetDb = getDb as jest.Mock;

type QueryResult = { recordset: unknown[] };
type TransportActivityRoute = { GET(request: NextRequest): Promise<Response> };

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

function transportGet(pathname: string, userId = 21) {
  return new NextRequest(`http://localhost${pathname}`, {
    headers: { 'x-user-id': String(userId) },
  });
}

function loadTransportActivityRoute() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../transport/activity/route') as TransportActivityRoute;
}

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

const driverActor = {
  user_id: 21,
  customer_id: 44,
  role_code: 'customer',
  customer_portal_role: 'driver_user',
};

const coordinatorActor = {
  user_id: 31,
  customer_id: 44,
  role_code: 'customer',
  customer_portal_role: 'trucking_coordinator',
};

const requestJob = {
  request_id: 88,
};

const gateJob = {
  transaction_id: 77,
};

const activityRow = {
  activity_id: 1,
  action: 'confirm_job',
  previous_status: 'requested',
  new_status: 'confirmed',
  note: null,
  proof_url: null,
  actor_mode: 'driver',
  created_at: '2026-06-04T08:00:00.000Z',
  invoice_amount: 1200,
  billing_clearance: 'clear',
  internal_note: 'internal only',
  customer_inventory: 'hidden inventory',
};

const proofRow = {
  proof_id: 1,
  proof_type: 'pickup',
  file_url: '/uploads/gate/2026-06/proof.jpg',
  note: 'container photo',
  created_at: '2026-06-04T08:05:00.000Z',
  invoice_number: 'INV-1',
  billing_status: 'hidden billing',
  internal_note: 'hide proof note',
};

const unsafeActivityRow = {
  ...activityRow,
  proof_url: 'https://evil.test/x.jpg',
};

const unsafeProofRow = {
  ...proofRow,
  file_url: '/uploads/../secret.jpg',
};

function expectActivityQueries(queries: string) {
  expect(queries).toContain('TransportJobActivities');
  expect(queries).toContain('TransportJobProofs');
  expect(queries).toContain('job_source = @jobSource');
  expect(queries).toContain('job_id = @jobId');
  expect(queries).toMatch(/ORDER BY\s+a\.created_at\s+DESC/i);
  expect(queries).toMatch(/ORDER BY\s+p\.created_at\s+DESC/i);
}

describe('Transport activity API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lets a driver view activity for their own request job', async () => {
    const route = loadTransportActivityRoute();
    const db = makeDb([
      q([driverActor]),
      q([requestJob]),
      q([activityRow]),
      q([proofRow]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(transportGet('/api/transport/activity?job_id=request-88'));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      jobId: 'request-88',
      activities: [
        {
          activityId: 1,
          action: 'confirm_job',
          previousStatus: 'requested',
          newStatus: 'confirmed',
          note: null,
          proofUrl: null,
          actorMode: 'driver',
          createdAt: '2026-06-04T08:00:00.000Z',
        },
      ],
      proofs: [
        {
          proofId: 1,
          proofType: 'pickup',
          fileUrl: '/uploads/gate/2026-06/proof.jpg',
          note: 'container photo',
          createdAt: '2026-06-04T08:05:00.000Z',
        },
      ],
    });
    const queries = db.queries.join('\n');
    expect(queries).toContain('FROM GateOutRequests gor');
    expect(queries).toContain('LEFT JOIN GateTransactions g');
    expect(queries).toContain('LEFT JOIN Bookings b');
    expect(queries).toContain('gor.request_id = @requestId');
    expect(queries).toContain('driver_user_id = @transportUserId');
    expectActivityQueries(queries);
    expect(db.input).toHaveBeenCalledWith('transportUserId', expect.anything(), 21);
    expect(db.input).toHaveBeenCalledWith('transportCustomerId', expect.anything(), 44);
    expect(db.input).toHaveBeenCalledWith('requestId', expect.anything(), 88);
    expect(db.input).toHaveBeenCalledWith('jobSource', expect.anything(), 'gate_out_request');
    expect(db.input).toHaveBeenCalledWith('jobId', expect.anything(), 88);
  });

  it('lets a driver view activity for their own gate job', async () => {
    const route = loadTransportActivityRoute();
    const db = makeDb([
      q([driverActor]),
      q([gateJob]),
      q([activityRow]),
      q([proofRow]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(transportGet('/api/transport/activity?job_id=gate-77'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobId).toBe('gate-77');
    expect(body.activities).toHaveLength(1);
    expect(body.proofs).toHaveLength(1);
    const queries = db.queries.join('\n');
    expect(queries).toContain('FROM GateTransactions g');
    expect(queries).toContain('LEFT JOIN GateOutRequests gor');
    expect(queries).toContain('g.transaction_id = @transactionId');
    expect(queries).toContain('driver_user_id = @transportUserId');
    expectActivityQueries(queries);
    expect(db.input).toHaveBeenCalledWith('transportUserId', expect.anything(), 21);
    expect(db.input).toHaveBeenCalledWith('transactionId', expect.anything(), 77);
    expect(db.input).toHaveBeenCalledWith('jobSource', expect.anything(), 'gate_transaction');
    expect(db.input).toHaveBeenCalledWith('jobId', expect.anything(), 77);
  });

  it('does not let a driver view another driver request', async () => {
    const route = loadTransportActivityRoute();
    const db = makeDb([
      q([driverActor]),
      q([]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(transportGet('/api/transport/activity?job_id=request-88'));

    expect(res.status).toBe(404);
    const queries = db.queries.join('\n');
    expect(queries).toContain('gor.request_id = @requestId');
    expect(queries).toContain('driver_user_id = @transportUserId');
    expect(queries).not.toContain('TransportJobActivities');
    expect(queries).not.toContain('TransportJobProofs');
  });

  it('does not let a driver view an inaccessible gate job', async () => {
    const route = loadTransportActivityRoute();
    const db = makeDb([
      q([driverActor]),
      q([]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(transportGet('/api/transport/activity?job_id=gate-77'));

    expect(res.status).toBe(404);
    const queries = db.queries.join('\n');
    expect(queries).toContain('FROM GateTransactions g');
    expect(queries).toContain('LEFT JOIN GateOutRequests gor');
    expect(queries).toContain('g.transaction_id = @transactionId');
    expect(queries).toContain('driver_user_id = @transportUserId');
    expect(queries).not.toContain('TransportJobActivities');
    expect(queries).not.toContain('TransportJobProofs');
  });

  it('lets a trucking coordinator view same-company request activity', async () => {
    const route = loadTransportActivityRoute();
    const db = makeDb([
      q([coordinatorActor]),
      q([requestJob]),
      q([activityRow]),
      q([proofRow]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(transportGet('/api/transport/activity?job_id=request-88', 31));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobId).toBe('request-88');
    expect(body.activities).toHaveLength(1);
    expect(body.proofs).toHaveLength(1);
    const queries = db.queries.join('\n');
    expect(queries).toContain('@transportCustomerId');
    expect(queries).toContain('trucking_company_id = @transportCustomerId');
    expectActivityQueries(queries);
    expect(db.input).toHaveBeenCalledWith('transportCustomerId', expect.anything(), 44);
  });

  it('lets a trucking coordinator view same-company gate activity', async () => {
    const route = loadTransportActivityRoute();
    const db = makeDb([
      q([coordinatorActor]),
      q([gateJob]),
      q([activityRow]),
      q([proofRow]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(transportGet('/api/transport/activity?job_id=gate-77', 31));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobId).toBe('gate-77');
    expect(body.activities).toHaveLength(1);
    expect(body.proofs).toHaveLength(1);
    const queries = db.queries.join('\n');
    expect(queries).toContain('FROM GateTransactions g');
    expect(queries).toContain('g.transaction_id = @transactionId');
    expect(queries).toContain('@transportCustomerId');
    expect(queries).toContain('trucking_company_id = @transportCustomerId');
    expectActivityQueries(queries);
    expect(db.input).toHaveBeenCalledWith('transportCustomerId', expect.anything(), 44);
    expect(db.input).toHaveBeenCalledWith('jobSource', expect.anything(), 'gate_transaction');
    expect(db.input).toHaveBeenCalledWith('jobId', expect.anything(), 77);
  });

  it('returns only activity and proof fields without invoice, billing, internal, or inventory data', async () => {
    const route = loadTransportActivityRoute();
    const db = makeDb([
      q([driverActor]),
      q([{ ...requestJob, invoice_amount: 9000, internal_note: 'hidden job' }]),
      q([activityRow]),
      q([proofRow]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(transportGet('/api/transport/activity?job_id=request-88'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(['activities', 'jobId', 'proofs']);
    expect(Object.keys(body.activities[0]).sort()).toEqual([
      'action',
      'activityId',
      'actorMode',
      'createdAt',
      'newStatus',
      'note',
      'previousStatus',
      'proofUrl',
    ]);
    expect(Object.keys(body.proofs[0]).sort()).toEqual([
      'createdAt',
      'fileUrl',
      'note',
      'proofId',
      'proofType',
    ]);
    const payload = JSON.stringify(body);
    expect(payload).not.toContain('invoice');
    expect(payload).not.toContain('billing');
    expect(payload).not.toContain('internal');
    expect(payload).not.toContain('inventory');
    expect(payload).not.toContain('hidden job');
    expect(payload).not.toContain('internal only');
    expect(payload).not.toContain('hidden inventory');

    const source = read('src/app/api/transport/activity/route.ts');
    expect(source).toContain('requireTransportPortalActor');
    expect(source).toContain('buildTransportJobAccessSql');
    expect(source).toContain('resolveTransportJobId');
    expect(source).toContain("'transport.activity.view'");
    expect(source).not.toContain('AuditLog');
    expect(source).not.toContain('Invoices');
    expect(source).not.toContain('BillingClearances');
    expect(source).not.toContain('invoice_amount');
    expect(source).not.toContain('billing_clearance');
    expect(source).not.toContain('internal_note');
    expect(source).not.toContain('customer_inventory');
    expect(source).not.toContain('CustomerInventory');
  });

  it('scrubs unsafe proof URLs from activity and proof payloads', async () => {
    const route = loadTransportActivityRoute();
    const db = makeDb([
      q([driverActor]),
      q([requestJob]),
      q([unsafeActivityRow]),
      q([unsafeProofRow]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(transportGet('/api/transport/activity?job_id=request-88'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activities[0].proofUrl).toBeNull();
    expect(body.proofs[0].fileUrl).toBeNull();
    const payload = JSON.stringify(body);
    expect(payload).not.toContain('https://evil.test/x.jpg');
    expect(payload).not.toContain('/uploads/../secret.jpg');
    expect(payload).not.toContain('evil.test');
    expect(payload).not.toContain('secret.jpg');
  });

  it('returns 400 for invalid job ids before job lookup or activity reads', async () => {
    const route = loadTransportActivityRoute();
    const db = makeDb([q([driverActor])]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(transportGet('/api/transport/activity?job_id=invoice-1'));

    expect(res.status).toBe(400);
    const queries = db.queries.join('\n');
    expect(queries).not.toContain('GateOutRequests');
    expect(queries).not.toContain('GateTransactions');
    expect(queries).not.toContain('TransportJobActivities');
    expect(queries).not.toContain('TransportJobProofs');
  });
});
