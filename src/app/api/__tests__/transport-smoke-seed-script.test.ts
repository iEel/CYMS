import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function exists(relativePath: string) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

describe('Transport smoke seed script', () => {
  it('defines deterministic smoke fixture constants', () => {
    expect(exists('scripts/transport-smoke-fixture.cjs')).toBe(true);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fixture = require(path.join(repoRoot, 'scripts/transport-smoke-fixture.cjs')) as {
      SMOKE_PREFIX: string;
      SMOKE_CUSTOMER: { customer_code: string; customer_name: string; is_trucking: boolean; portal_enabled: boolean };
      SMOKE_USERS: {
        trucking: { username: string; portalRole: string };
        driver: { username: string; portalRole: string };
      };
      SMOKE_CONTAINER: { container_number: string; status: string };
      SMOKE_BOOKING: { booking_number: string; status: string };
      buildPreviewRows: () => Array<{ entity: string; identifier: string; action: string }>;
      isSmokeIdentifier: (value: unknown) => boolean;
    };

    expect(fixture.SMOKE_PREFIX).toBe('SMOKE-TRANSPORT');
    expect(fixture.SMOKE_CUSTOMER).toMatchObject({
      customer_code: 'SMK-TRUCK',
      customer_name: 'SMOKE TRANSPORT CO., LTD.',
      is_trucking: true,
      portal_enabled: true,
    });
    expect(fixture.SMOKE_USERS.trucking).toMatchObject({
      username: 'smoke_transport_trucking',
      portalRole: 'trucking_coordinator',
    });
    expect(fixture.SMOKE_USERS.driver).toMatchObject({
      username: 'smoke_transport_driver',
      portalRole: 'driver_user',
    });
    expect(fixture.SMOKE_CONTAINER).toMatchObject({
      container_number: 'SMKU2026001',
      status: 'in_yard',
    });
    expect(fixture.SMOKE_BOOKING).toMatchObject({
      booking_number: 'SMOKE-TRANSPORT-BK-001',
      status: 'approved',
    });
    expect(fixture.buildPreviewRows().map((row) => row.entity)).toEqual(
      expect.arrayContaining(['customer', 'user', 'container', 'booking', 'gate_out_request']),
    );
    expect(fixture.isSmokeIdentifier('SMOKE-TRANSPORT test')).toBe(true);
    expect(fixture.isSmokeIdentifier('real-customer')).toBe(false);
  });

  it('is preview-first and requires an explicit confirm flag for writes', () => {
    expect(exists('scripts/seed-transport-smoke.js')).toBe(true);
    const source = read('scripts/seed-transport-smoke.js');

    expect(source).toContain('--confirm');
    expect(source).toContain('--reset-smoke-job');
    expect(source).toContain('preview');
    expect(source).toContain('buildPreviewRows');
    expect(source).toContain('No database changes were made');
  });

  it('does not include broad destructive deletes against core tables', () => {
    const source = read('scripts/seed-transport-smoke.js');

    expect(source).not.toMatch(/\bDELETE\s+FROM\s+Users\b/i);
    expect(source).not.toMatch(/\bTRUNCATE\s+TABLE\s+Users\b/i);
    expect(source).not.toMatch(/\bDELETE\s+FROM\s+Customers\b/i);
    expect(source).not.toMatch(/\bTRUNCATE\s+TABLE\s+Customers\b/i);
    expect(source).not.toMatch(/\bDELETE\s+FROM\s+Containers\b/i);
    expect(source).not.toMatch(/\bTRUNCATE\s+TABLE\s+Containers\b/i);
    expect(source).not.toMatch(/\bDELETE\s+FROM\s+Bookings\b/i);
    expect(source).not.toMatch(/\bTRUNCATE\s+TABLE\s+Bookings\b/i);
  });

  it('documents smoke-only user password behavior', () => {
    const source = read('scripts/seed-transport-smoke.js');

    expect(source).toContain('smoke users only');
    expect(source).toContain('smoke_transport_driver');
    expect(source).toContain('smoke_transport_trucking');
    expect(source).toContain('SmokeDriver123!');
    expect(source).toContain('SmokeTransport123!');
  });

  it('repairs zero-identity smoke rows so transport job ids are valid', () => {
    const source = read('scripts/seed-transport-smoke.js');

    expect(source).toContain('hasDbValue');
    expect(source).toContain('reseedIdentityToCurrentMax');
    expect(source).toContain('deleteInvalidSmokeBooking');
    expect(source).toContain('deleteInvalidSmokeGateOutRequest');
    expect(source).toContain('requestId <= 0');
    expect(source).toContain('bookingId <= 0');
  });
});
