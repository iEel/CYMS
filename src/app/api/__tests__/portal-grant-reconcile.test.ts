import { NextRequest } from 'next/server';
import { GET, POST } from '../portal/grants/reconcile/route';
import { getDb } from '@/lib/db';
import {
  previewPortalEntityAccessGrants,
  repairPortalEntityAccessGrants,
} from '@/lib/portalGrantReconciler';
import { logAudit } from '@/lib/audit';

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
  getClientIP: jest.fn().mockReturnValue('127.0.0.1'),
  rateLimitAPI: jest.fn().mockResolvedValue({ success: true, retryAfterMs: 0 }),
}));

jest.mock('@/lib/portalGrantReconciler', () => ({
  previewPortalEntityAccessGrants: jest.fn(),
  repairPortalEntityAccessGrants: jest.fn(),
}));

jest.mock('@/lib/audit', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

const mockedGetDb = getDb as jest.Mock;
const mockedPreview = previewPortalEntityAccessGrants as jest.Mock;
const mockedRepair = repairPortalEntityAccessGrants as jest.Mock;
const mockedLogAudit = logAudit as jest.Mock;

function request(method: string, role = 'yard_manager') {
  return new NextRequest('http://localhost/api/portal/grants/reconcile', {
    method,
    headers: {
      'x-user-id': '7',
      'x-user-role': role,
    },
  });
}

describe('/api/portal/grants/reconcile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetDb.mockResolvedValue({ request: jest.fn() });
    mockedPreview.mockResolvedValue({ missing: [], stale: [], summary: { missing_count: 0, stale_count: 0 } });
    mockedRepair.mockResolvedValue({
      before: { missing: [{ id: 1 }], stale: [{ id: 2 }], summary: { missing_count: 1, stale_count: 1 } },
      after: { missing: [], stale: [], summary: { missing_count: 0, stale_count: 0 } },
      repaired_missing: 1,
      deactivated_stale: 1,
    });
  });

  it('rejects non-admin preview before opening the database', async () => {
    const res = await GET(request('GET', 'gate_clerk'));

    expect(res.status).toBe(403);
    expect(mockedGetDb).not.toHaveBeenCalled();
    expect(mockedPreview).not.toHaveBeenCalled();
  });

  it('previews grants for yard managers', async () => {
    const res = await GET(request('GET'));

    expect(res.status).toBe(200);
    expect(mockedGetDb).toHaveBeenCalled();
    expect(mockedPreview).toHaveBeenCalled();
  });

  it('repairs grants and records the actor in audit log', async () => {
    const res = await POST(request('POST'));

    expect(res.status).toBe(200);
    expect(mockedRepair).toHaveBeenCalled();
    expect(mockedLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      action: 'portal_grants_reconcile_repair',
      entityType: 'portal_entity_access',
    }));
  });
});
