import { upsertPortalEntityAccess } from '../portalEntityAccess';

function makeDb() {
  const query = jest.fn().mockResolvedValue({ recordset: [] });
  const input = jest.fn().mockReturnThis();
  const request = jest.fn(() => ({ input, query }));
  return { request, input, query };
}

describe('portal entity access grants', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('upserts a parameterized active grant for an entity', async () => {
    const db = makeDb();

    await upsertPortalEntityAccess({
      db,
      customerId: 42,
      entityType: 'booking',
      entityId: 7,
      entityRef: 'BK-7',
      accessRole: 'booking_customer',
      sourceTable: 'Bookings',
      sourceId: 7,
    });

    expect(db.input).toHaveBeenCalledWith('customerId', expect.anything(), 42);
    expect(db.input).toHaveBeenCalledWith('entityType', expect.anything(), 'booking');
    expect(db.input).toHaveBeenCalledWith('entityId', expect.anything(), 7);
    expect(db.input).toHaveBeenCalledWith('entityRef', expect.anything(), 'BK-7');
    expect(db.input).toHaveBeenCalledWith('accessRole', expect.anything(), 'booking_customer');
    expect(db.query.mock.calls[0][0]).toContain('PortalEntityAccess');
    expect(db.query.mock.calls[0][0]).toContain('IF EXISTS');
    expect(db.query.mock.calls[0][0]).toContain('UPDATE PortalEntityAccess');
    expect(db.query.mock.calls[0][0]).toContain('INSERT INTO PortalEntityAccess');
  });

  it('includes permission scope and valid windows when upserting a grant', async () => {
    const db = makeDb();

    await upsertPortalEntityAccess({
      db,
      customerId: 42,
      entityType: 'eir',
      entityId: 77,
      entityRef: 'EIR-77',
      accessRole: 'owner',
      sourceTable: 'GateTransactions',
      sourceId: 77,
      permissionScope: { canDownload: true },
      validFrom: '2026-01-01T00:00:00.000Z',
      validUntil: '2026-12-31T23:59:59.000Z',
    });

    expect(db.input).toHaveBeenCalledWith('permissionScope', expect.anything(), '{"canDownload":true}');
    expect(db.input).toHaveBeenCalledWith('validFrom', expect.anything(), '2026-01-01T00:00:00.000Z');
    expect(db.input).toHaveBeenCalledWith('validUntil', expect.anything(), '2026-12-31T23:59:59.000Z');
    expect(db.query.mock.calls[0][0]).toContain('permission_scope = COALESCE(@permissionScope, permission_scope)');
    expect(db.query.mock.calls[0][0]).toContain('valid_until = COALESCE(@validUntil, valid_until)');
    expect(db.query.mock.calls[0][0]).toContain('permission_scope');
    expect(db.query.mock.calls[0][0]).toContain('valid_until');
  });

  it('skips invalid grants without hitting the database', async () => {
    const db = makeDb();

    await upsertPortalEntityAccess({
      db,
      customerId: null,
      entityType: 'container',
      entityId: null,
      entityRef: null,
      accessRole: 'owner',
      sourceTable: 'Containers',
    });

    expect(db.request).not.toHaveBeenCalled();
  });

  it('does not throw when grant logging fails', async () => {
    const db = makeDb();
    db.query.mockRejectedValueOnce(new Error('missing table'));

    await expect(upsertPortalEntityAccess({
      db,
      customerId: 42,
      entityType: 'invoice',
      entityId: 9,
      entityRef: 'INV-9',
      accessRole: 'invoice_customer',
      sourceTable: 'Invoices',
      sourceId: 9,
    })).resolves.toBeUndefined();

    expect(console.error).toHaveBeenCalledWith('⚠️ Portal entity access grant failed:', expect.any(Error));
  });
});
