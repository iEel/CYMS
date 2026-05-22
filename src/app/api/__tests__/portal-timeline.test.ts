import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));

const mockedGetDb = getDb as jest.Mock;

function makeDb() {
  const queries: string[] = [];
  const query = jest.fn().mockImplementation((statement: string) => {
    queries.push(statement);
    if (statement.includes('FROM Bookings b')) {
      return Promise.resolve({ recordset: [{ booking_id: 77, booking_number: 'BK-1' }] });
    }
    if (statement.includes('FROM GateTransactions g')) {
      return Promise.resolve({ recordset: [{ event_type: 'gate_in', title: 'Gate In', event_time: '2026-05-21T08:00:00.000Z', container_number: 'MSKU1234567' }] });
    }
    if (statement.includes('FROM ReeferTemperatureChecks rc')) {
      return Promise.resolve({ recordset: [{ event_type: 'reefer_check', title: 'Reefer Check', event_time: '2026-05-21T09:00:00.000Z', container_number: 'MSKU1234567' }] });
    }
    if (statement.includes('FROM ReeferExceptions e')) {
      return Promise.resolve({ recordset: [{ event_type: 'reefer_exception', title: 'Reefer Exception', event_time: '2026-05-21T10:00:00.000Z', container_number: 'MSKU1234567' }] });
    }
    return Promise.resolve({ recordset: [] });
  });
  const input = jest.fn().mockReturnThis();
  const request = jest.fn(() => ({ input, query }));
  return { request, input, queries };
}

function req(url: string) {
  return new NextRequest(url, { headers: { 'x-customer-id': '42' } });
}

describe('GET /api/portal/timeline', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const route = require('../portal/timeline/route') as typeof import('../portal/timeline/route');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a read-only booking timeline scoped by portal grants', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(req('http://localhost/api/portal/timeline?booking_id=77'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.timeline).toHaveLength(3);
    expect(body.timeline[0]).toEqual(expect.objectContaining({ event_type: 'reefer_exception' }));
    expect(body.read_only).toBe(true);
    expect(db.input).toHaveBeenCalledWith('cid', expect.anything(), 42);
    expect(db.input).toHaveBeenCalledWith('bookingId', expect.anything(), 77);
    expect(db.queries.join('\n')).toContain('PortalEntityAccess');
    expect(db.queries.join('\n')).toContain("pea.entity_type = 'booking'");
  });

  it('requires a portal customer session', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);

    const res = await route.GET(new NextRequest('http://localhost/api/portal/timeline?booking_id=77'));
    expect(res.status).toBe(403);
  });
});
