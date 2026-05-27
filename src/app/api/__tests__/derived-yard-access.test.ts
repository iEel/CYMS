import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import * as documentActivityRoute from '../documents/activity/route';
import * as entityTimelineRoute from '../entity-timeline/route';
import * as customer360Route from '../customers/360/route';
import * as integrationLogsRoute from '../integrations/logs/route';
import * as readableAuditTrailRoute from '../audit-trail/readable/route';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/auth', () => ({ verifyToken: jest.fn() }));
jest.mock('@/lib/rateLimit', () => ({
  getClientIP: jest.fn().mockReturnValue('127.0.0.1'),
  rateLimitAPI: jest.fn().mockResolvedValue({ success: true, retryAfterMs: 0 }),
}));

const mockedGetDb = getDb as jest.Mock;

type QueryResult = { recordset: unknown[] };
type QueryHandler = (statement: string, inputs: Record<string, unknown>) => QueryResult;
type MockDbRequest = {
  input: (name: string, _type: unknown, value: unknown) => MockDbRequest;
  query: (statement: string) => Promise<QueryResult>;
};

function makeRequest(url: string, role = 'operations_viewer') {
  return new NextRequest(url, {
    method: 'GET',
    headers: {
      'x-user-id': '17',
      'x-user-role': role,
    },
  });
}

function makeDb(handleQuery: QueryHandler, options: { allowYardAccess?: boolean } = {}) {
  const statements: string[] = [];
  const yardAccessChecks: unknown[] = [];
  const allowYardAccess = options.allowYardAccess ?? true;

  const db = {
    statements,
    yardAccessChecks,
    request: jest.fn(() => {
      const inputs: Record<string, unknown> = {};
      const request: MockDbRequest = {
        input: jest.fn((name: string, _type: unknown, value: unknown): MockDbRequest => {
          inputs[name] = value;
          return request;
        }),
        query: jest.fn(async (statement: string): Promise<QueryResult> => {
          statements.push(statement);
          if (statement.includes('FROM Roles r')) {
            return { recordset: [{ granted: 1 }] };
          }
          if (statement.includes('FROM UserYardAccess')) {
            yardAccessChecks.push(inputs.yardId);
            return { recordset: allowYardAccess ? [{ allowed: 1 }] : [] };
          }
          return handleQuery(statement, inputs);
        }),
      };
      return request;
    }),
  };

  return db;
}

describe('derived yard access for read routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('documents activity selects lifecycle yard ids for post-query access checks', async () => {
    const db = makeDb((statement) => {
      if (statement.includes('FROM DocumentLifecycle dl')) {
        return {
          recordset: [{
            lifecycle_id: 1,
            document_type: 'invoice',
            document_id: 10,
            document_number: 'INV-001',
            event_type: 'created',
            metadata: null,
            created_at: '2026-05-28T00:00:00.000Z',
            user_name: 'Ops User',
            yard_name: 'A Yard',
            yard_id: 5,
          }],
        };
      }
      return { recordset: [] };
    });
    mockedGetDb.mockResolvedValue(db);

    const res = await documentActivityRoute.GET(makeRequest('http://localhost/api/documents/activity?document_number=INV-001'));

    expect(res.status).toBe(200);
    const documentQuery = db.statements.find(statement => statement.includes('FROM DocumentLifecycle dl'));
    expect(documentQuery).toMatch(/SELECT TOP \(@limit\)[\s\S]*\bdl\.yard_id\b[\s\S]*FROM DocumentLifecycle dl/);
    expect(db.yardAccessChecks).toEqual([5]);
  });

  it('entity timeline checks positive derived yard ids and strips internal yard ids from the response', async () => {
    const db = makeDb((statement) => {
      if (statement.includes('FROM AuditLog a')) {
        return {
          recordset: [
            {
              event_type: 'audit',
              event_name: 'updated',
              entity_type: 'container',
              entity_id: 99,
              entity_number: null,
              status: null,
              description: 'updated',
              actor_name: 'Ops User',
              created_at: '2026-05-28T00:00:00.000Z',
              details: null,
              yard_id: 5,
            },
            {
              event_type: 'attachment',
              event_name: 'photo',
              entity_type: 'container',
              entity_id: 99,
              entity_number: 'CONT99',
              status: 'image/jpeg',
              description: 'photo.jpg',
              actor_name: 'Ops User',
              created_at: '2026-05-28T00:01:00.000Z',
              details: null,
              yard_id: null,
            },
          ],
        };
      }
      return { recordset: [] };
    });
    mockedGetDb.mockResolvedValue(db);

    const res = await entityTimelineRoute.GET(makeRequest('http://localhost/api/entity-timeline?entity_type=container&entity_id=99'));
    const body = await res.json();

    expect(res.status).toBe(200);
    const timelineQuery = db.statements.find(statement => statement.includes('FROM AuditLog a'));
    expect(timelineQuery).toMatch(/SELECT event_type[\s\S]*\byard_id\b[\s\S]*FROM \(/);
    expect(db.yardAccessChecks).toEqual([5]);
    expect(body.timeline).toHaveLength(2);
    expect(body.timeline[0]).not.toHaveProperty('yard_id');
    expect(body.timeline[1]).not.toHaveProperty('yard_id');
  });

  it('documents activity returns 403 when derived yard access is denied after querying', async () => {
    const db = makeDb((statement) => {
      if (statement.includes('FROM DocumentLifecycle dl')) {
        return {
          recordset: [{
            lifecycle_id: 1,
            document_type: 'invoice',
            document_id: 10,
            document_number: 'INV-001',
            event_type: 'created',
            metadata: null,
            created_at: '2026-05-28T00:00:00.000Z',
            user_name: 'Ops User',
            yard_name: 'A Yard',
            yard_id: 5,
          }],
        };
      }
      return { recordset: [] };
    }, { allowYardAccess: false });
    mockedGetDb.mockResolvedValue(db);

    const res = await documentActivityRoute.GET(makeRequest('http://localhost/api/documents/activity?document_number=INV-001'));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain('ลานนี้');
    expect(db.yardAccessChecks).toEqual([5]);
  });

  it('entity timeline returns 403 when derived yard access is denied after querying', async () => {
    const db = makeDb((statement) => {
      if (statement.includes('FROM AuditLog a')) {
        return {
          recordset: [{
            event_type: 'audit',
            event_name: 'updated',
            entity_type: 'container',
            entity_id: 99,
            entity_number: null,
            status: null,
            description: 'updated',
            actor_name: 'Ops User',
            created_at: '2026-05-28T00:00:00.000Z',
            details: null,
            yard_id: 5,
          }],
        };
      }
      return { recordset: [] };
    }, { allowYardAccess: false });
    mockedGetDb.mockResolvedValue(db);

    const res = await entityTimelineRoute.GET(makeRequest('http://localhost/api/entity-timeline?entity_type=container&entity_id=99'));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain('ลานนี้');
    expect(db.yardAccessChecks).toEqual([5]);
  });

  it('entity timeline scopes attachments by supplied yard_id and strips internal yard ids', async () => {
    const db = makeDb((statement) => {
      if (statement.includes('FROM AuditLog a')) {
        return {
          recordset: [{
            event_type: 'attachment',
            event_name: 'photo',
            entity_type: 'container',
            entity_id: 99,
            entity_number: 'CONT99',
            status: 'image/jpeg',
            description: 'photo.jpg',
            actor_name: 'Ops User',
            created_at: '2026-05-28T00:01:00.000Z',
            details: null,
            yard_id: 7,
          }],
        };
      }
      return { recordset: [] };
    });
    mockedGetDb.mockResolvedValue(db);

    const res = await entityTimelineRoute.GET(makeRequest('http://localhost/api/entity-timeline?entity_type=container&entity_id=99&yard_id=7'));
    const body = await res.json();

    expect(res.status).toBe(200);
    const timelineQuery = db.statements.find(statement => statement.includes('FROM EntityAttachments ea'));
    expect(timelineQuery).toMatch(/FROM EntityAttachments ea[\s\S]*AND \(@yardId IS NULL OR ea\.yard_id = @yardId\)/);
    expect(db.yardAccessChecks).toEqual([7]);
    expect(body.timeline).toHaveLength(1);
    expect(body.timeline[0]).not.toHaveProperty('yard_id');
  });

  it.each([
    ['customer 360', customer360Route.GET, 'http://localhost/api/customers/360?customer_id=10'],
    ['integration logs', integrationLogsRoute.GET, 'http://localhost/api/integrations/logs'],
    ['readable audit trail', readableAuditTrailRoute.GET, 'http://localhost/api/audit-trail/readable?container_id=99'],
  ])('%s blocks omitted yard_id for non-yard_manager users', async (_name, handler, url) => {
    const db = makeDb(() => ({ recordset: [] }));
    mockedGetDb.mockResolvedValue(db);

    const res = await handler(makeRequest(url));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('yard_id');
  });

  it('customer 360 allows yard_manager to omit yard_id', async () => {
    const db = makeDb((statement) => {
      if (statement.includes('FROM Customers') && statement.includes('WHERE customer_id = @customerId')) {
        return {
          recordset: [{
            customer_id: 10,
            customer_code: 'CUST-010',
            customer_name: 'Acme Logistics',
            tax_id: null,
            address: null,
            billing_address: null,
            contact_name: null,
            contact_phone: null,
            contact_email: null,
            default_payment_type: 'CASH',
            credit_term: 0,
            credit_limit: 0,
            credit_hold: 0,
            credit_hold_reason: null,
            is_line: 0,
            is_forwarder: 0,
            is_trucking: 0,
            is_shipper: 0,
            is_consignee: 0,
          }],
        };
      }
      return { recordset: [] };
    });
    mockedGetDb.mockResolvedValue(db);

    const res = await customer360Route.GET(makeRequest('http://localhost/api/customers/360?customer_id=10', 'yard_manager'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.customer.customer_id).toBe(10);
    expect(db.yardAccessChecks).toEqual([]);
  });

  it('integration logs allows yard_manager to omit yard_id', async () => {
    const db = makeDb((statement) => {
      if (statement.includes('COUNT(*) AS total')) {
        return {
          recordset: [{
            total: 1,
            success_count: 1,
            failed_count: 0,
            retrying_count: 0,
            total_records: 3,
          }],
        };
      }
      if (statement.includes('FROM IntegrationLogs')) {
        return {
          recordset: [{
            integration_log_id: 1,
            yard_id: 5,
            system: 'EDI',
            status: 'success',
            record_count: 3,
          }],
        };
      }
      return { recordset: [] };
    });
    mockedGetDb.mockResolvedValue(db);

    const res = await integrationLogsRoute.GET(makeRequest('http://localhost/api/integrations/logs', 'yard_manager'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.logs).toHaveLength(1);
    expect(body.stats.total).toBe(1);
    expect(db.yardAccessChecks).toEqual([]);
  });

  it('readable audit trail allows yard_manager to omit yard_id', async () => {
    const db = makeDb((statement) => {
      if (statement.includes("OBJECT_ID('BillingClearances', 'U')")) {
        return { recordset: [{ exists_flag: 0 }] };
      }
      if (statement.includes('FROM AuditLog a')) {
        return {
          recordset: [{
            log_id: 1,
            action: 'container_update',
            entity_type: 'container',
            entity_id: 99,
            details: JSON.stringify({ container_number: 'CONT99' }),
            created_at: '2026-05-28T00:00:00.000Z',
            full_name: 'Yard Manager',
            username: 'manager',
          }],
        };
      }
      return { recordset: [] };
    });
    mockedGetDb.mockResolvedValue(db);

    const res = await readableAuditTrailRoute.GET(makeRequest('http://localhost/api/audit-trail/readable?container_id=99', 'yard_manager'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.logs[0].actor_name).toBe('Yard Manager');
    expect(db.yardAccessChecks).toEqual([]);
  });
});
