import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRequestActor, requireYardAccess } from '@/lib/apiAuth';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/apiAuth', () => ({
  requireRequestActor: jest.fn(),
  requireYardAccess: jest.fn(),
}));

const mockedGetDb = getDb as jest.Mock;
const mockedRequireRequestActor = requireRequestActor as jest.Mock;
const mockedRequireYardAccess = requireYardAccess as jest.Mock;

function makeDb() {
  const queries: string[] = [];
  const query = jest.fn().mockImplementation((statement: string) => {
    queries.push(statement);
    if (statement.includes('notif_last_read_at')) {
      return Promise.resolve({ recordset: [{ notif_last_read_at: new Date('2026-05-22T00:00:00Z') }] });
    }
    if (statement.includes('FROM GateTransactions')) {
      return Promise.resolve({ recordset: [{ event_type: 'gate_in', container_number: 'MSKU1234567', event_time: new Date('2026-05-22T01:00:00Z'), size: '40', type: 'HC', eir_number: 'EIR-1' }] });
    }
    if (statement.includes('FROM WorkOrders')) {
      return Promise.resolve({ recordset: [{ event_type: 'move', container_number: 'TLLU7654321', status: 'pending', event_time: new Date('2026-05-21T23:00:00Z') }] });
    }
    return Promise.resolve({ recordset: [] });
  });
  const chain = { input: jest.fn().mockReturnThis(), query };
  return { request: jest.fn(() => chain), queries };
}

describe('notification center API', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const route = require('../notifications/route') as typeof import('../notifications/route');

  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireRequestActor.mockReturnValue({ userId: 9, role: 'yard_manager' });
    mockedRequireYardAccess.mockResolvedValue({ ok: true });
  });

  it('returns notification center metadata with deep links and unread count', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(new NextRequest('http://localhost/api/notifications?yard_id=1&limit=20&source=all'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.notifications[0]).toEqual(expect.objectContaining({ href: expect.any(String), unread: true }));
    expect(body.unread_count).toBe(1);
    expect(body.source_counts).toEqual(expect.objectContaining({ gate: 1, work_order: 1 }));
    expect(db.queries.join('\n')).toContain('FROM GateTransactions');
  });
});
