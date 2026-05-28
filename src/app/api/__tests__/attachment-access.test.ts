import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requirePermission, requireRequestActor, requireYardAccess } from '@/lib/apiAuth';
import { ensureAttachmentCenter, logAttachment } from '@/lib/attachmentCenter';
import { GET, POST } from '../attachments/route';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/apiAuth', () => ({
  requirePermission: jest.fn(),
  requireRequestActor: jest.fn(),
  requireYardAccess: jest.fn(),
}));
jest.mock('@/lib/attachmentCenter', () => ({
  ensureAttachmentCenter: jest.fn(),
  logAttachment: jest.fn(),
}));

const mockedGetDb = getDb as jest.Mock;
const mockedRequirePermission = requirePermission as jest.Mock;
const mockedRequireRequestActor = requireRequestActor as jest.Mock;
const mockedRequireYardAccess = requireYardAccess as jest.Mock;
const mockedEnsureAttachmentCenter = ensureAttachmentCenter as jest.Mock;
const mockedLogAttachment = logAttachment as jest.Mock;

function makeDb({
  attachments = [],
  scopeRows = [{ entity_id: 44, entity_number: 'CONT44', yard_id: 7 }],
}: {
  attachments?: unknown[];
  scopeRows?: unknown[];
} = {}) {
  const statements: string[] = [];
  const query = jest.fn(async (statement: string) => {
    statements.push(statement);
    if (statement.includes('FROM Containers')) return { recordset: scopeRows };
    if (statement.includes('FROM EntityAttachments')) return { recordset: attachments };
    return { recordset: [] };
  });
  const input = jest.fn().mockReturnThis();
  return { request: jest.fn(() => ({ input, query })), input, query, statements };
}

function makeGetRequest() {
  return new NextRequest('http://localhost/api/attachments?entity_type=container&entity_id=44', {
    headers: { 'x-user-id': '9', 'x-user-role': 'gate_clerk' },
  });
}

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/attachments', {
    method: 'POST',
    headers: { 'x-user-id': '42', 'x-user-role': 'gate_clerk' },
    body: JSON.stringify(body),
  });
}

describe('attachment center access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequirePermission.mockImplementation((_request, _db, permissionCode) => {
      const userId = permissionCode === 'documents.attachment.upload' ? 42 : 9;
      return Promise.resolve({ userId, role: 'gate_clerk' });
    });
    mockedRequireRequestActor.mockReturnValue({ userId: 999, role: 'gate_clerk' });
    mockedRequireYardAccess.mockResolvedValue({ userId: 9, role: 'gate_clerk' });
    mockedEnsureAttachmentCenter.mockResolvedValue(undefined);
    mockedLogAttachment.mockResolvedValue({ attachment_id: 7 });
  });

  it('denies GET when actor lacks attachment read permission before querying attachments', async () => {
    const db = makeDb({ attachments: [{ attachment_id: 1, file_url: 'https://example.test/leak.pdf' }] });
    mockedGetDb.mockResolvedValue(db);
    mockedRequirePermission.mockResolvedValueOnce(
      NextResponse.json({ error: 'forbidden' }, { status: 403 })
    );

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(403);
    expect(mockedRequirePermission).toHaveBeenCalledWith(
      expect.anything(),
      db,
      'documents.attachment.view',
      'คุณไม่มีสิทธิ์ดูเอกสารแนบ'
    );
    expect(mockedEnsureAttachmentCenter).not.toHaveBeenCalled();
    expect(db.request).not.toHaveBeenCalled();
  });

  it('returns attachments only after attachment read permission passes', async () => {
    const attachments = [{ attachment_id: 2, file_url: 'https://example.test/ok.pdf' }];
    const db = makeDb({ attachments });
    mockedGetDb.mockResolvedValue(db);

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockedRequirePermission.mock.invocationCallOrder[0]).toBeLessThan(
      mockedEnsureAttachmentCenter.mock.invocationCallOrder[0]
    );
    expect(mockedEnsureAttachmentCenter).toHaveBeenCalledWith(db);
    expect(db.request).toHaveBeenCalledTimes(2);
    expect(mockedRequireYardAccess).toHaveBeenCalledWith(
      expect.anything(),
      db,
      7,
      'คุณไม่มีสิทธิ์เข้าถึงเอกสารแนบของลานนี้'
    );
    expect(db.statements.join('\n')).toContain('FROM Containers');
    expect(db.statements.join('\n')).toContain('AND (@yardId IS NULL OR yard_id = @yardId OR yard_id IS NULL)');
    expect(body).toEqual({ attachments });
  });

  it('denies GET when the resolved attachment entity is in a yard the actor cannot access', async () => {
    const db = makeDb({ attachments: [{ attachment_id: 2, file_url: 'https://example.test/leak.pdf' }] });
    mockedGetDb.mockResolvedValue(db);
    mockedRequireYardAccess.mockResolvedValueOnce(
      NextResponse.json({ error: 'forbidden yard' }, { status: 403 })
    );

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(403);
    expect(db.statements.join('\n')).toContain('FROM Containers');
    expect(db.statements.join('\n')).not.toContain('FROM EntityAttachments');
  });

  it('uses upload permission actor for POST and stores uploadedBy from that actor', async () => {
    const db = makeDb();
    mockedGetDb.mockResolvedValue(db);
    mockedRequirePermission.mockResolvedValueOnce({ userId: 42, role: 'gate_clerk' });

    const res = await POST(makePostRequest({
      entity_type: 'container',
      entity_id: 44,
      file_url: 'https://example.test/upload.pdf',
      uploaded_by: 12345,
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockedRequirePermission).toHaveBeenCalledWith(
      expect.anything(),
      db,
      'documents.attachment.upload',
      'คุณไม่มีสิทธิ์อัปโหลดเอกสารแนบ'
    );
    expect(mockedRequireRequestActor).not.toHaveBeenCalled();
    expect(mockedLogAttachment).toHaveBeenCalledWith(expect.objectContaining({
      db,
      uploadedBy: 42,
      fileUrl: 'https://example.test/upload.pdf',
      yardId: 7,
      entityId: 44,
      entityNumber: 'CONT44',
    }));
    expect(body).toEqual({ success: true, attachment: { attachment_id: 7 } });
  });
});
