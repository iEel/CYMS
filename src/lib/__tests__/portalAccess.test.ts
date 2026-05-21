import { NextRequest, NextResponse } from 'next/server';
import {
  getPortalCustomerId,
  portalBookingVisibilitySql,
  portalContainerVisibilitySql,
  portalEntityAccessSql,
  portalGateVisibilitySql,
  portalVisibilityReasonSql,
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

  it('builds entity access checks against PortalEntityAccess grants', () => {
    const sql = portalEntityAccessSql('booking', 'b.booking_id', 'b.booking_number');

    expect(sql).toContain('PortalEntityAccess');
    expect(sql).toContain("pea.entity_type = 'booking'");
    expect(sql).toContain('pea.entity_id = b.booking_id');
    expect(sql).toContain('pea.entity_ref = b.booking_number');
    expect(sql).toContain('pea.is_active = 1');
  });

  it('builds container visibility from explicit portal entity grants', () => {
    const sql = portalContainerVisibilitySql('c');

    expect(sql).toContain('PortalEntityAccess');
    expect(sql).toContain("pea.entity_type = 'container'");
    expect(sql).toContain('pea.entity_id = c.container_id');
    expect(sql).toContain('pea.entity_ref = c.container_number');
    expect(sql).not.toContain('GateTransactions');
    expect(sql).not.toContain('Invoices');
    expect(sql).not.toContain('BookingContainers');
    expect(sql).not.toContain('c.customer_id');
  });

  it('builds booking visibility from explicit portal entity grants', () => {
    const sql = portalBookingVisibilitySql('b');

    expect(sql).toContain("pea.entity_type = 'booking'");
    expect(sql).toContain('pea.entity_id = b.booking_id');
    expect(sql).toContain('pea.entity_ref = b.booking_number');
    expect(sql).not.toContain('b.customer_id = @cid');
  });

  it('builds gate visibility from gate transaction grants plus container policy', () => {
    const sql = portalGateVisibilitySql('g', 'c');

    expect(sql).toContain("pea.entity_type = 'gate_transaction'");
    expect(sql).toContain('pea.entity_id = g.transaction_id');
    expect(sql).toContain('pea.entity_ref = g.eir_number');
    expect(sql).toContain("pea.entity_type = 'container'");
    expect(sql).not.toContain('g.container_owner_id = @cid');
    expect(sql).not.toContain('g.billing_customer_id = @cid');
    expect(sql).not.toContain('c.customer_id');
  });

  it('builds a visibility reason subquery from the active portal grant', () => {
    const sql = portalVisibilityReasonSql('container', 'c.container_id', 'c.container_number');

    expect(sql).toContain('SELECT TOP 1 pea.access_role');
    expect(sql).toContain('PortalEntityAccess');
    expect(sql).toContain("pea.entity_type = 'container'");
    expect(sql).toContain('pea.entity_id = c.container_id');
    expect(sql).toContain('pea.entity_ref = c.container_number');
    expect(sql).toContain('ORDER BY CASE pea.access_role');
  });
});
