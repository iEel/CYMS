import fs from 'fs';
import path from 'path';

describe('Gate Out focused search', () => {
  const routePath = path.join(process.cwd(), 'src/app/api/gate/out-search/route.ts');
  const route = fs.existsSync(routePath) ? fs.readFileSync(routePath, 'utf8') : '';

  it('exposes a Gate Out specific endpoint guarded by gate.out and yard access', () => {
    expect(route).toContain('requireAnyPermission');
    expect(route).toContain("'gate.out'");
    expect(route).toContain('requireYardAccess');
    expect(route).toContain('yard_id');
    expect(route).toContain('q');
  });

  it('searches only container number and booking number for Gate Out', () => {
    expect(route).toContain('c.container_number LIKE @search');
    expect(route).toContain('b.booking_number LIKE @search');
    expect(route).not.toContain('c.shipping_line LIKE @search');
    expect(route).not.toContain('b.vessel_name LIKE @search');
  });

  it('filters out containers that cannot be gated out', () => {
    expect(route).toContain("c.status <> 'gated_out'");
    expect(route).toContain('c.yard_id = @yardId');
    expect(route).toContain('b.yard_id = @yardId');
    expect(route).toContain("bc.status <> 'released'");
  });

  it('returns container and booking result shapes', () => {
    expect(route).toContain("result_type: 'container'");
    expect(route).toContain("result_type: 'booking'");
    expect(route).toContain('containers:');
    expect(route).toContain('selectable');
  });
});
