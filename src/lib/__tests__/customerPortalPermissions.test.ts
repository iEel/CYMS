import { NextRequest, NextResponse } from 'next/server';

import {
  getCustomerPortalActions,
  hasPortalAction,
  normalizeCustomerPortalRole,
  requirePortalAction,
} from '../customerPortalPermissions';

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/customer-portal/test', { headers });
}

function makeDb(recordset: unknown[]) {
  const query = jest.fn().mockResolvedValue({ recordset });
  const input = jest.fn().mockReturnThis();
  const request = jest.fn(() => ({ input, query }));
  return { request, input, query };
}

describe('customer portal action policy', () => {
  it('grants customer_admin all baseline portal actions including grade view and invoice download', () => {
    const actions = getCustomerPortalActions('customer_admin');

    expect(actions).toEqual(new Set([
      'portal.container.view',
      'portal.booking.view',
      'portal.booking.create',
      'portal.document.download',
      'portal.invoice.view',
      'portal.invoice.download',
      'portal.dispute.create',
      'portal.eir.view',
      'portal.eir.download',
      'portal.eir.grade.view',
      'portal.reefer.view',
      'portal.reefer.download',
      'portal.reefer.exception.view',
      'portal.reefer.exception.dispute',
      'portal.trucking.view',
      'portal.driver.view',
    ]));
  });

  it('allows operations_user to view EIRs without invoice or EIR grade access', () => {
    expect(hasPortalAction('operations_user', 'portal.eir.view')).toBe(true);
    expect(hasPortalAction('operations_user', 'portal.invoice.view')).toBe(false);
    expect(hasPortalAction('operations_user', 'portal.eir.grade.view')).toBe(false);
  });

  it('allows billing_user to view and download invoices', () => {
    expect(hasPortalAction('billing_user', 'portal.invoice.view')).toBe(true);
    expect(hasPortalAction('billing_user', 'portal.invoice.download')).toBe(true);
  });

  it('allows driver_user driver portal access without invoice access', () => {
    expect(hasPortalAction('driver_user', 'portal.driver.view')).toBe(true);
    expect(hasPortalAction('driver_user', 'portal.invoice.view')).toBe(false);
  });

  it('falls back unknown roles to customer_admin for backward compatibility', () => {
    expect(normalizeCustomerPortalRole('legacy_admin')).toBe('customer_admin');
    expect(hasPortalAction('legacy_admin', 'portal.invoice.download')).toBe(true);
  });

  it('rejects portal action checks without a valid user id header', async () => {
    const db = makeDb([]);
    const result = await requirePortalAction(makeRequest(), db, 'portal.container.view');

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
    expect(db.request).not.toHaveBeenCalled();
  });

  it('queries active customer portal users with a parameterized user id', async () => {
    const db = makeDb([{ customer_portal_role: 'billing_user' }]);
    const result = await requirePortalAction(
      makeRequest({ 'x-user-id': '42' }),
      db,
      'portal.invoice.download'
    );

    expect(result).toEqual({
      userId: 42,
      customerPortalRole: 'billing_user',
      actions: getCustomerPortalActions('billing_user'),
    });
    expect(db.input).toHaveBeenCalledWith('userId', expect.anything(), 42);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM Users'));
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('status ='));
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('customer_id IS NOT NULL'));
  });

  it('forbids active portal users missing the requested action', async () => {
    const db = makeDb([{ customer_portal_role: 'operations_user' }]);
    const result = await requirePortalAction(
      makeRequest({ 'x-user-id': '77' }),
      db,
      'portal.invoice.view'
    );

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });
});
