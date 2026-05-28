import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAnyPermission, requirePermission, requireRequestActor } from '@/lib/apiAuth';
import { ensureAttachmentCenter, logAttachment } from '@/lib/attachmentCenter';
import { GET, POST } from '../attachments/route';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));
jest.mock('@/lib/apiAuth', () => ({
  requireAnyPermission: jest.fn(),
  requirePermission: jest.fn(),
  requireRequestActor: jest.fn(),
}));
jest.mock('@/lib/attachmentCenter', () => ({
  ensureAttachmentCenter: jest.fn(),
  logAttachment: jest.fn(),
}));

const mockedGetDb = getDb as jest.Mock;
const mockedRequireAnyPermission = requireAnyPermission as jest.Mock;
const mockedRequirePermission = requirePermission as jest.Mock;
const mockedRequireRequestActor = requireRequestActor as jest.Mock;
const mockedEnsureAttachmentCenter = ensureAttachmentCenter as jest.Mock;
const mockedLogAttachment = logAttachment as jest.Mock;

function makeDb(recordset: unknown[] = []) {
  const query = jest.fn().mockResolvedValue({ recordset });
  const input = jest.fn().mockReturnThis();
  return { request: jest.fn(() => ({ input, query })), input, query };
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
    mockedRequireAnyPermission.mockResolvedValue({ userId: 9, role: 'gate_clerk' });
    mockedRequirePermission.mockResolvedValue({ userId: 42, role: 'gate_clerk' });
    mockedRequireRequestActor.mockReturnValue({ userId: 999, role: 'gate_clerk' });
    mockedEnsureAttachmentCenter.mockResolvedValue(undefined);
    mockedLogAttachment.mockResolvedValue({ attachment_id: 7 });
  });

  it('denies GET when actor lacks attachment read permission before querying attachments', async () => {
    const db = makeDb([{ attachment_id: 1, file_url: 'https://example.test/leak.pdf' }]);
    mockedGetDb.mockResolvedValue(db);
    mockedRequireAnyPermission.mockResolvedValueOnce(
      NextResponse.json({ error: 'forbidden' }, { status: 403 })
    );

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(403);
    expect(mockedRequireAnyPermission).toHaveBeenCalledWith(
      expect.anything(),
      db,
      expect.arrayContaining([
        'documents.attachment.view',
        'gate.eir.print',
        'survey.inspect',
        'mnr.eor.create',
        'mnr.eor.update',
        'billing.invoice.create',
        'reports.view',
      ]),
      'คุณไม่มีสิทธิ์ดูเอกสารแนบ'
    );
    expect(mockedEnsureAttachmentCenter).not.toHaveBeenCalled();
    expect(db.request).not.toHaveBeenCalled();
  });

  it('returns attachments only after attachment read permission passes', async () => {
    const attachments = [{ attachment_id: 2, file_url: 'https://example.test/ok.pdf' }];
    const db = makeDb(attachments);
    mockedGetDb.mockResolvedValue(db);

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockedRequireAnyPermission.mock.invocationCallOrder[0]).toBeLessThan(
      mockedEnsureAttachmentCenter.mock.invocationCallOrder[0]
    );
    expect(mockedEnsureAttachmentCenter).toHaveBeenCalledWith(db);
    expect(db.request).toHaveBeenCalledTimes(1);
    expect(body).toEqual({ attachments });
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
    }));
    expect(body).toEqual({ success: true, attachment: { attachment_id: 7 } });
  });
});
