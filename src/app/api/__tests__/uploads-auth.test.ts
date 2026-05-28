import { NextRequest } from 'next/server';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { logAudit } from '@/lib/audit';
import * as route from '../uploads/route';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/audit', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn().mockResolvedValue({ userId: 999, role: 'gate_clerk' }),
}));

const mockedExistsSync = existsSync as jest.Mock;
const mockedMkdir = mkdir as jest.Mock;
const mockedWriteFile = writeFile as jest.Mock;
const mockedLogAudit = logAudit as jest.Mock;

function makeUploadRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/uploads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function actorHeaders(userId = '77') {
  return {
    'x-user-id': userId,
    'x-user-role': 'gate_clerk',
  };
}

describe('uploads route proxy-authenticated sessions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedExistsSync.mockReturnValue(false);
  });

  it('returns 401 when proxy actor headers are missing', async () => {
    const res = await route.POST(makeUploadRequest({
      data: 'data:image/png;base64,aGVsbG8=',
      folder: 'documents',
    }));

    expect(res.status).toBe(401);
    expect(mockedWriteFile).not.toHaveBeenCalled();
  });

  it('accepts proxy actor headers without an Authorization header', async () => {
    const res = await route.POST(makeUploadRequest({
      data: 'data:image/png;base64,aGVsbG8=',
      folder: 'documents',
      filename_prefix: 'booking_document',
    }, actorHeaders()));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.url).toMatch(/^\/uploads\/documents\//);
    expect(mockedMkdir).toHaveBeenCalledWith(expect.stringContaining('documents'), { recursive: true });
    expect(mockedWriteFile).toHaveBeenCalledWith(expect.stringContaining('booking_document_'), expect.any(Buffer));
  });

  it('writes audit with the proxy actor userId', async () => {
    await route.POST(makeUploadRequest({
      data: 'data:image/png;base64,aGVsbG8=',
      folder: 'documents',
    }, actorHeaders('123')));

    expect(mockedLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 123,
      action: 'file_upload',
      entityType: 'upload',
    }));
  });

  it('still rejects invalid folder after auth passes', async () => {
    const res = await route.POST(makeUploadRequest({
      data: 'data:image/png;base64,aGVsbG8=',
      folder: '../private',
    }, actorHeaders()));

    expect(res.status).toBe(400);
    expect(mockedWriteFile).not.toHaveBeenCalled();
    expect(mockedLogAudit).not.toHaveBeenCalled();
  });

  it('still rejects invalid data after auth passes', async () => {
    const res = await route.POST(makeUploadRequest({
      data: 'not-a-data-url',
      folder: 'documents',
    }, actorHeaders()));

    expect(res.status).toBe(400);
    expect(mockedWriteFile).not.toHaveBeenCalled();
    expect(mockedLogAudit).not.toHaveBeenCalled();
  });
});
