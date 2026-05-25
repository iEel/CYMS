import { NextRequest } from 'next/server';
import { logEirAccess } from '@/lib/eirAccessLog';

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
}));

function makeDb() {
  const query = jest.fn().mockResolvedValue({ recordset: [] });
  const input = jest.fn().mockReturnThis();
  const request = jest.fn(() => ({ input, query }));

  return { request, input, query };
}

describe('EIR access logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('inserts durable EIR access log details from the request', async () => {
    const db = makeDb();
    const request = new NextRequest('http://localhost/api/eir', {
      headers: {
        'x-forwarded-for': '10.0.0.5, 10.0.0.6',
        'user-agent': 'jest',
      },
    });

    await logEirAccess({
      db,
      request,
      eirNumber: 'EIR-IN-2026-000001',
      gateTransactionId: 123,
      userId: 7,
      customerId: 42,
      viewType: 'portal',
      action: 'view',
    });

    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][0]).toMatch(/INSERT\s+INTO\s+EIRAccessLog/i);
    expect(db.query.mock.calls[0][0]).toMatch(/accessed_at[\s\S]*GETDATE\(\)/i);

    expect(db.input).toHaveBeenCalledWith('eirNumber', expect.anything(), 'EIR-IN-2026-000001');
    expect(db.input).toHaveBeenCalledWith('gateTransactionId', expect.anything(), 123);
    expect(db.input).toHaveBeenCalledWith('userId', expect.anything(), 7);
    expect(db.input).toHaveBeenCalledWith('customerId', expect.anything(), 42);
    expect(db.input).toHaveBeenCalledWith('viewType', expect.anything(), 'portal');
    expect(db.input).toHaveBeenCalledWith('action', expect.anything(), 'view');
    expect(db.input).toHaveBeenCalledWith('ipAddress', expect.anything(), '10.0.0.5');
    expect(db.input).toHaveBeenCalledWith('userAgent', expect.anything(), 'jest');
  });
});
