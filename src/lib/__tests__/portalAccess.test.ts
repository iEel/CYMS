import { NextRequest, NextResponse } from 'next/server';
import {
  getPortalCustomerId,
  portalBookingVisibilitySql,
  portalContainerVisibilitySql,
  portalEirExactVisibilitySql,
  portalEirVisibilitySql,
  portalEntityAccessSql,
  portalGateExactVisibilitySql,
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
    expect(sql).toContain('pea.valid_from IS NULL OR pea.valid_from <= GETDATE()');
    expect(sql).toContain('pea.valid_until IS NULL OR pea.valid_until >= GETDATE()');
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

  it('builds exact gate visibility from gate transaction grants only', () => {
    const sql = portalGateExactVisibilitySql('g');

    expect(sql).toContain("pea.entity_type = 'gate_transaction'");
    expect(sql).toContain('pea.entity_id = g.transaction_id');
    expect(sql).toContain('pea.entity_ref = g.eir_number');
    expect(sql).not.toContain("pea.entity_type = 'container'");
  });

  it('builds gate visibility from exact grants by default', () => {
    const sql = portalGateVisibilitySql('g', 'c');

    expect(sql).toContain("pea.entity_type = 'gate_transaction'");
    expect(sql).toContain('pea.entity_id = g.transaction_id');
    expect(sql).toContain('pea.entity_ref = g.eir_number');
    expect(sql).not.toContain("pea.entity_type = 'container'");
    expect(sql).not.toContain('g.container_owner_id = @cid');
    expect(sql).not.toContain('g.billing_customer_id = @cid');
    expect(sql).not.toContain('c.customer_id');
  });

  it('can explicitly include container fallback in gate visibility for summaries', () => {
    const sql = portalGateVisibilitySql('g', 'c', { allowContainerFallback: true });

    expect(sql).toContain("pea.entity_type = 'gate_transaction'");
    expect(sql).toContain("pea.entity_type = 'container'");
  });

  it('builds exact eir visibility from active valid-window eir or gate grants only', () => {
    const sql = portalEirExactVisibilitySql('g');

    expect(sql).toContain("pea.entity_type = 'eir'");
    expect(sql).toContain('pea.entity_id = g.transaction_id');
    expect(sql).toContain('pea.entity_ref = g.eir_number');
    expect(sql).toContain('pea.valid_from IS NULL OR pea.valid_from <= GETDATE()');
    expect(sql).toContain('pea.valid_until IS NULL OR pea.valid_until >= GETDATE()');
    expect(sql).toContain("pea.entity_type = 'gate_transaction'");
    expect(sql).not.toContain("pea.entity_type = 'container'");
  });

  it('builds eir visibility from exact grants by default', () => {
    const sql = portalEirVisibilitySql('g', 'c');

    expect(sql).toContain("pea.entity_type = 'eir'");
    expect(sql).toContain('pea.entity_id = g.transaction_id');
    expect(sql).toContain('pea.entity_ref = g.eir_number');
    expect(sql).toContain('pea.valid_from IS NULL OR pea.valid_from <= GETDATE()');
    expect(sql).toContain('pea.valid_until IS NULL OR pea.valid_until >= GETDATE()');
    expect(sql).toContain("pea.entity_type = 'gate_transaction'");
    expect(sql).not.toContain("pea.entity_type = 'container'");
  });

  it('can explicitly include container fallback in eir visibility for summaries', () => {
    const sql = portalEirVisibilitySql('g', 'c', { allowContainerFallback: true });

    expect(sql).toContain("pea.entity_type = 'eir'");
    expect(sql).toContain("pea.entity_type = 'gate_transaction'");
    expect(sql).toContain("pea.entity_type = 'container'");
  });

  it('builds a visibility reason subquery from the active portal grant', () => {
    const sql = portalVisibilityReasonSql('container', 'c.container_id', 'c.container_number');

    expect(sql).toContain('SELECT TOP 1 pea.access_role');
    expect(sql).toContain('PortalEntityAccess');
    expect(sql).toContain("pea.entity_type = 'container'");
    expect(sql).toContain('pea.entity_id = c.container_id');
    expect(sql).toContain('pea.entity_ref = c.container_number');
    expect(sql).toContain('pea.valid_from IS NULL OR pea.valid_from <= GETDATE()');
    expect(sql).toContain('pea.valid_until IS NULL OR pea.valid_until >= GETDATE()');
    expect(sql).toContain('ORDER BY CASE pea.access_role');
  });
});
