import { NextRequest, NextResponse } from 'next/server';
import {
  getPortalCustomerId,
  portalContainerVisibilitySql,
  portalGateVisibilitySql,
} from '../portalAccess';

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/portal/test', { headers });
}

describe('portal access policy helpers', () => {
  it('parses the portal customer id from proxy headers', () => {
    expect(getPortalCustomerId(makeRequest({ 'x-customer-id': '42' }))).toBe(42);
  });

  it('rejects missing or invalid portal customer ids', async () => {
    const missing = getPortalCustomerId(makeRequest());
    const invalid = getPortalCustomerId(makeRequest({ 'x-customer-id': 'not-a-number' }));

    expect(missing).toBeInstanceOf(NextResponse);
    expect(invalid).toBeInstanceOf(NextResponse);
    expect((missing as NextResponse).status).toBe(403);
    await expect((invalid as NextResponse).json()).resolves.toMatchObject({
      error: expect.stringContaining('ไม่พบข้อมูลลูกค้า'),
    });
  });

  it('builds container visibility from owner, gate billing, invoices, and bookings', () => {
    const sql = portalContainerVisibilitySql('c');

    expect(sql).toContain('c.container_owner_id = @cid');
    expect(sql).toContain('GateTransactions');
    expect(sql).toContain('billing_customer_id = @cid');
    expect(sql).toContain('Invoices');
    expect(sql).toContain('BookingContainers');
    expect(sql).not.toContain('c.customer_id');
  });

  it('builds gate visibility from gate owner/billing plus container policy', () => {
    const sql = portalGateVisibilitySql('g', 'c');

    expect(sql).toContain('g.container_owner_id = @cid');
    expect(sql).toContain('g.billing_customer_id = @cid');
    expect(sql).toContain('c.container_owner_id = @cid');
    expect(sql).not.toContain('c.customer_id');
  });
});
