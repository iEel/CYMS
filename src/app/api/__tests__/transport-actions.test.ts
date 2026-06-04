import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';

import { getDb } from '@/lib/db';

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
}));

const repoRoot = path.resolve(__dirname, '../../../..');
const mockedGetDb = getDb as jest.Mock;

type QueryResult = { recordset: unknown[]; rowsAffected?: number[] };
type TransportActionsRoute = { POST(request: NextRequest): Promise<Response> };

function q(recordset: unknown[], rowsAffected?: number[]): QueryResult {
  return rowsAffected ? { recordset, rowsAffected } : { recordset };
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

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function transportPost(body: Record<string, unknown>, userId = 21) {
  return new NextRequest('http://localhost/api/transport/actions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-user-id': String(userId) },
    body: JSON.stringify(body),
  });
}

function loadTransportActionsRoute() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../transport/actions/route') as TransportActionsRoute;
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

function requestJob(status = 'requested') {
  return {
    request_id: 88,
    status,
    gate_transaction_id: null,
    driver_user_id: 21,
    trucking_company_id: 44,
    booking_id: 7,
  };
}

function expectGuardedStatusUpdate(queries: string) {
  expect(queries).toMatch(/UPDATE\s+gor\s+SET[\s\S]*status\s*=\s*@newStatus/i);
  expect(queries).toContain('FROM GateOutRequests gor');
  expect(queries).toContain('LEFT JOIN GateTransactions g');
  expect(queries).toContain('LEFT JOIN Bookings b');
  expect(queries).toContain('gor.request_id = @requestId');
  expect(queries).toContain('gor.status IN');
}

function expectNoStatusUpdate(queries: string) {
  expect(queries).not.toMatch(/UPDATE\s+(?:GateOutRequests|gor)\b/i);
}

function expectGuardedProofInserts(queries: string) {
  expect(queries).toContain('BEGIN TRAN');
  expect(queries).toContain('ROLLBACK');
  expect(queries).toContain('COMMIT');
  expect(queries).toContain('@proofRows');
  expect(queries).toContain('@activityRows');
  expect(queries).toMatch(/INSERT\s+INTO\s+TransportJobProofs[\s\S]*SELECT[\s\S]*FROM\s+GateOutRequests\s+gor/i);
  expect(queries).toMatch(/INSERT\s+INTO\s+TransportJobActivities[\s\S]*SELECT[\s\S]*FROM\s+GateOutRequests\s+gor/i);
  expect(queries).toContain('LEFT JOIN GateTransactions g');
  expect(queries).toContain('LEFT JOIN Bookings b');
  expect(queries).toContain('gor.request_id = @requestId');
  expect(queries).toContain('gor.status IN');
  expect(queries).toContain('driver_user_id = @transportUserId');
}

describe('Transport action migration', () => {
  it('keeps action workflow DDL in canonical migration files only', () => {
    const migration = read('scripts/migrate-runtime-core-schema.js');
    const schema = read('src/lib/schema.sql');
    const transportRouteCandidates = [
      'src/app/api/transport/actions/route.ts',
      'src/app/api/transport/activity/route.ts',
      'src/app/api/transport/jobs/route.ts',
    ];

    expect(migration).toContain("OBJECT_ID('TransportJobActivities'");
    expect(migration).toContain("OBJECT_ID('TransportJobProofs'");
    expect(migration).toContain('IX_TransportJobActivities_Job');
    expect(migration).toContain('IX_TransportJobProofs_Job');

    expect(schema).toContain('TransportJobActivities');
    expect(schema).toContain('TransportJobProofs');

    for (const relativePath of transportRouteCandidates) {
      const absolutePath = path.join(repoRoot, relativePath);
      if (!fs.existsSync(absolutePath)) continue;

      const source = fs.readFileSync(absolutePath, 'utf8');
      expect(source).not.toMatch(/\bCREATE\s+TABLE\b/i);
      expect(source).not.toMatch(/\bALTER\s+TABLE\b/i);
    }
  });
});

describe('Transport actions API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lets an assigned driver confirm their own request job', async () => {
    const route = loadTransportActionsRoute();
    const db = makeDb([
      q([driverActor]),
      q([requestJob('requested')]),
      q([], [1]),
      q([]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.POST(transportPost({ job_id: 'request-88', action: 'confirm_job' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      action: 'confirm_job',
      status: 'confirmed',
    });
    const queries = db.queries.join('\n');
    expectGuardedStatusUpdate(queries);
    expect(queries).toContain('INSERT INTO TransportJobActivities');
    expect(queries).toContain('driver_user_id = @transportUserId');
    expect(db.input).toHaveBeenCalledWith('transportUserId', expect.anything(), 21);
    expect(db.input).toHaveBeenCalledWith('requestId', expect.anything(), 88);
    expect(db.input).toHaveBeenCalledWith('newStatus', expect.anything(), 'confirmed');
  });

  it.each(['pending', 'issue_reported'])(
    'lets an assigned driver confirm a request job from %s',
    async (status) => {
      const route = loadTransportActionsRoute();
      const db = makeDb([
        q([driverActor]),
        q([requestJob(status)]),
        q([], [1]),
        q([]),
      ]);
      mockedGetDb.mockResolvedValue(db);

      const res = await route.POST(transportPost({ job_id: 'request-88', action: 'confirm_job' }));

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({
        success: true,
        action: 'confirm_job',
        status: 'confirmed',
      });
      const queries = db.queries.join('\n');
      expectGuardedStatusUpdate(queries);
      expect(queries).toContain('INSERT INTO TransportJobActivities');
      expect(db.input).toHaveBeenCalledWith('newStatus', expect.anything(), 'confirmed');
    },
  );

  it('does not let a driver update another driver-assigned request', async () => {
    const route = loadTransportActionsRoute();
    const db = makeDb([
      q([driverActor]),
      q([]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.POST(transportPost({ job_id: 'request-88', action: 'confirm_job' }));

    expect(res.status).toBe(404);
    const queries = db.queries.join('\n');
    expect(queries).toContain('gor.request_id = @requestId');
    expect(queries).toContain('driver_user_id = @transportUserId');
    expectNoStatusUpdate(queries);
    expect(queries).not.toContain('INSERT INTO TransportJobActivities');
  });

  it('lets a trucking coordinator mark a company request as arrived at gate', async () => {
    const route = loadTransportActionsRoute();
    const db = makeDb([
      q([coordinatorActor]),
      q([requestJob('confirmed')]),
      q([], [1]),
      q([]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.POST(
      transportPost({ job_id: 'request-88', action: 'mark_arrived' }, 31),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      action: 'mark_arrived',
      status: 'at_gate',
    });
    const queries = db.queries.join('\n');
    expect(queries).toContain('@transportCustomerId');
    expectGuardedStatusUpdate(queries);
    expect(db.input).toHaveBeenCalledWith('transportCustomerId', expect.anything(), 44);
    expect(db.input).toHaveBeenCalledWith('newStatus', expect.anything(), 'at_gate');
  });

  it('lets an assigned driver mark an issue-reported request as arrived at gate', async () => {
    const route = loadTransportActionsRoute();
    const db = makeDb([
      q([driverActor]),
      q([requestJob('issue_reported')]),
      q([], [1]),
      q([]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.POST(transportPost({ job_id: 'request-88', action: 'mark_arrived' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      action: 'mark_arrived',
      status: 'at_gate',
    });
    const queries = db.queries.join('\n');
    expectGuardedStatusUpdate(queries);
    expect(queries).toContain('INSERT INTO TransportJobActivities');
    expect(db.input).toHaveBeenCalledWith('newStatus', expect.anything(), 'at_gate');
  });

  it('rejects completed gate transaction jobs', async () => {
    const route = loadTransportActionsRoute();
    const db = makeDb([q([driverActor])]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.POST(transportPost({ job_id: 'gate-99', action: 'confirm_job' }));

    expect(res.status).toBe(400);
    const queries = db.queries.join('\n');
    expectNoStatusUpdate(queries);
    expect(queries).not.toContain('UPDATE GateTransactions');
    expect(queries).not.toContain('INSERT INTO GateTransactions');
    expect(queries).not.toContain('INSERT INTO TransportJobActivities');
    expect(queries).not.toContain('INSERT INTO TransportJobProofs');
  });

  it.each(['request-x', 'invoice-1'])(
    'returns 400 for invalid job id %s before job lookup or mutation',
    async (jobId) => {
      const route = loadTransportActionsRoute();
      const db = makeDb([q([driverActor])]);
      mockedGetDb.mockResolvedValue(db);

      const res = await route.POST(transportPost({ job_id: jobId, action: 'confirm_job' }));

      expect(res.status).toBe(400);
      const queries = db.queries.join('\n');
      expect(queries).not.toContain('GateOutRequests');
      expect(queries).not.toContain('GateTransactions');
      expect(queries).not.toContain('TransportJobActivities');
      expect(queries).not.toContain('TransportJobProofs');
    },
  );

  it.each(['released', 'completed', 'cancelled', 'rejected'])(
    'returns 409 for final request status %s',
    async (status) => {
      const route = loadTransportActionsRoute();
      const db = makeDb([
        q([driverActor]),
        q([requestJob(status)]),
      ]);
      mockedGetDb.mockResolvedValue(db);

      const res = await route.POST(transportPost({ job_id: 'request-88', action: 'confirm_job' }));

      expect(res.status).toBe(409);
      const queries = db.queries.join('\n');
      expectNoStatusUpdate(queries);
      expect(queries).not.toContain('INSERT INTO TransportJobActivities');
    },
  );

  it('returns 409 when confirm_job would downgrade an at_gate request', async () => {
    const route = loadTransportActionsRoute();
    const db = makeDb([
      q([driverActor]),
      q([requestJob('at_gate')]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.POST(transportPost({ job_id: 'request-88', action: 'confirm_job' }));

    expect(res.status).toBe(409);
    const queries = db.queries.join('\n');
    expectNoStatusUpdate(queries);
    expect(queries).not.toContain('INSERT INTO TransportJobActivities');
    expect(queries).not.toContain('INSERT INTO TransportJobProofs');
  });

  it('returns 409 when mark_arrived would skip a requested request', async () => {
    const route = loadTransportActionsRoute();
    const db = makeDb([
      q([driverActor]),
      q([requestJob('requested')]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.POST(transportPost({ job_id: 'request-88', action: 'mark_arrived' }));

    expect(res.status).toBe(409);
    const queries = db.queries.join('\n');
    expectNoStatusUpdate(queries);
    expect(queries).not.toContain('INSERT INTO TransportJobActivities');
    expect(queries).not.toContain('INSERT INTO TransportJobProofs');
  });

  it('returns 409 when the guarded status update affects no rows', async () => {
    const route = loadTransportActionsRoute();
    const db = makeDb([
      q([driverActor]),
      q([requestJob('requested')]),
      q([], [0]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.POST(transportPost({ job_id: 'request-88', action: 'confirm_job' }));

    expect(res.status).toBe(409);
    const queries = db.queries.join('\n');
    expectGuardedStatusUpdate(queries);
    expect(queries).not.toContain('INSERT INTO TransportJobActivities');
    expect(queries).not.toContain('INSERT INTO TransportJobProofs');
  });

  it('requires a non-empty note for report_issue and records valid issues', async () => {
    const route = loadTransportActionsRoute();
    const invalidDb = makeDb([
      q([driverActor]),
      q([requestJob('confirmed')]),
    ]);
    mockedGetDb.mockResolvedValue(invalidDb);

    const invalidRes = await route.POST(
      transportPost({ job_id: 'request-88', action: 'report_issue', note: '   ' }),
    );

    expect(invalidRes.status).toBe(400);
    expect(invalidDb.queries.join('\n')).not.toContain('UPDATE GateOutRequests');

    const validDb = makeDb([
      q([driverActor]),
      q([requestJob('confirmed')]),
      q([], [1]),
      q([]),
    ]);
    mockedGetDb.mockResolvedValue(validDb);

    const validRes = await route.POST(
      transportPost({ job_id: 'request-88', action: 'report_issue', note: 'Seal mismatch' }),
    );

    expect(validRes.status).toBe(200);
    await expect(validRes.json()).resolves.toEqual({
      success: true,
      action: 'report_issue',
      status: 'issue_reported',
    });
    const queries = validDb.queries.join('\n');
    expectGuardedStatusUpdate(queries);
    expect(queries).toContain('INSERT INTO TransportJobActivities');
    expect(validDb.input).toHaveBeenCalledWith('newStatus', expect.anything(), 'issue_reported');
    expect(validDb.input).toHaveBeenCalledWith('note', expect.anything(), 'Seal mismatch');
  });

  it('requires upload proofs to live under uploads and records valid proofs without changing status', async () => {
    const route = loadTransportActionsRoute();
    const invalidDb = makeDb([
      q([driverActor]),
      q([requestJob('confirmed')]),
    ]);
    mockedGetDb.mockResolvedValue(invalidDb);

    const invalidRes = await route.POST(
      transportPost({
        job_id: 'request-88',
        action: 'add_proof',
        proof_url: 'https://example.test/proof.jpg',
      }),
    );

    expect(invalidRes.status).toBe(400);
    expect(invalidDb.queries.join('\n')).not.toContain('TransportJobProofs');

    const traversalDb = makeDb([
      q([driverActor]),
      q([requestJob('confirmed')]),
    ]);
    mockedGetDb.mockResolvedValue(traversalDb);

    const traversalRes = await route.POST(
      transportPost({
        job_id: 'request-88',
        action: 'add_proof',
        proof_url: '/uploads/../secret.jpg',
      }),
    );

    expect(traversalRes.status).toBe(400);
    expect(traversalDb.queries.join('\n')).not.toContain('TransportJobProofs');

    const validDb = makeDb([
      q([driverActor]),
      q([requestJob('confirmed')]),
      q([{ success: 1, proofRows: 1, activityRows: 1 }]),
    ]);
    mockedGetDb.mockResolvedValue(validDb);

    const validRes = await route.POST(
      transportPost({
        job_id: 'request-88',
        action: 'add_proof',
        proof_url: '/uploads/transport/request-88-arrival.jpg',
        note: 'Arrived photo',
      }),
    );

    expect(validRes.status).toBe(200);
    await expect(validRes.json()).resolves.toEqual({
      success: true,
      action: 'add_proof',
      status: 'confirmed',
    });
    const queries = validDb.queries.join('\n');
    expect(queries).toContain('INSERT INTO TransportJobProofs');
    expect(queries).toContain('INSERT INTO TransportJobActivities');
    expectGuardedProofInserts(queries);
    expectNoStatusUpdate(queries);
    expect(validDb.input).toHaveBeenCalledWith('proofUrl', expect.anything(), '/uploads/transport/request-88-arrival.jpg');
    expect(validDb.input).toHaveBeenCalledWith('proofType', expect.anything(), 'pickup');
  });

  it('returns 409 when the atomic add_proof batch reports a partial insert conflict', async () => {
    const route = loadTransportActionsRoute();
    const db = makeDb([
      q([driverActor]),
      q([requestJob('confirmed')]),
      q([{ success: 0, proofRows: 1, activityRows: 0 }], [1, 1]),
    ]);
    mockedGetDb.mockResolvedValue(db);

    const res = await route.POST(
      transportPost({
        job_id: 'request-88',
        action: 'add_proof',
        proof_url: '/uploads/transport/request-88-arrival.jpg',
      }),
    );

    expect(res.status).toBe(409);
    const queries = db.queries.join('\n');
    expectGuardedProofInserts(queries);
    expectNoStatusUpdate(queries);
  });

  it('keeps transport actions source free of billing and internal fields', () => {
    const source = read('src/app/api/transport/actions/route.ts');

    expect(source).toContain('requireTransportPortalActor');
    expect(source).toContain('buildTransportJobAccessSql');
    expect(source).toContain('resolveTransportJobId');
    expect(source).toContain("transport.jobs.action");
    expect(source).toContain('TransportJobActivities');
    expect(source).toContain('TransportJobProofs');
    expect(source).not.toContain('Invoices');
    expect(source).not.toContain('BillingClearances');
    expect(source).not.toContain('invoice_amount');
    expect(source).not.toContain('billing_clearance');
    expect(source).not.toContain('internal_note');
  });
});
