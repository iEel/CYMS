import fs from 'fs';
import path from 'path';

describe('Gate Out request persistence', () => {
  const routePath = path.join(process.cwd(), 'src/app/api/gate/out-requests/route.ts');
  const route = fs.existsSync(routePath) ? fs.readFileSync(routePath, 'utf8') : '';
  const gateRoute = fs.readFileSync(path.join(process.cwd(), 'src/app/api/gate/route.ts'), 'utf8');
  const gateOut = fs.readFileSync(path.join(process.cwd(), 'src/app/(dashboard)/gate/GateOutTab.tsx'), 'utf8');
  const migration = fs.readFileSync(path.join(process.cwd(), 'scripts/migrate-runtime-core-schema.js'), 'utf8');
  const schema = fs.readFileSync(path.join(process.cwd(), 'src/lib/schema.sql'), 'utf8');

  it('adds a migration-backed GateOutRequests table for durable release sessions', () => {
    expect(migration).toContain("OBJECT_ID('GateOutRequests', 'U')");
    expect(migration).toContain('CREATE TABLE GateOutRequests');
    expect(migration).toContain('work_order_id INT NULL');
    expect(migration).toContain('billing_clearance_id INT NULL');
    expect(migration).toContain('gate_transaction_id INT NULL');
    expect(migration).toContain('trucking_company_id INT NULL');
    expect(migration).toContain('driver_user_id INT NULL');
    expect(migration).toContain('IX_GateOutRequests_Transport');
    expect(migration).toContain('UPDATE gor');
    expect(schema).toContain('CREATE TABLE GateOutRequests');
    expect(schema).toContain('trucking_company_id INT NULL');
    expect(schema).toContain('driver_user_id INT NULL');
    expect(schema).toContain('IX_GateOutRequests_Transport');
  });

  it('exposes a yard-scoped API for listing, creating, and updating Gate Out requests', () => {
    expect(route).toContain('export async function GET');
    expect(route).toContain('export async function POST');
    expect(route).toContain('export async function PATCH');
    expect(route).toContain('requireAnyPermission');
    expect(route).toContain('requireYardAccess');
    expect(route).toContain('GateOutRequests');
    expect(route).toContain('WorkOrders');
    expect(route).toContain('gor.trucking_company_id');
    expect(route).toContain('gor.driver_user_id');
    expect(route).toContain("WHEN status = 'at_gate' THEN 'at_gate'");
    expect(route).toContain("work_order_status IN ('pending', 'assigned', 'in_progress')");
    expect(route).toContain("work_order_status = 'completed'");
  });

  it('persists request context from Gate Out and restores it without localStorage-only state', () => {
    expect(gateOut).toContain('/api/gate/out-requests');
    expect(gateOut).toContain('loadGateOutRequests');
    expect(gateOut).toContain('applyGateOutRequest');
    expect(gateOut).toContain('selectedGateOutRequest');
    expect(gateOut).toContain('gate_out_request_id: selectedGateOutRequest?.request_id || undefined');
    expect(gateOut).not.toContain('gateout_driver_');
  });

  it('persists trucking company and driver user assignment for transport portal pickup jobs', () => {
    expect(route).toContain(".input('truckingCompanyId', sql.Int, positiveInt(body.trucking_company_id))");
    expect(route).toContain(".input('driverUserId', sql.Int, positiveInt(body.driver_user_id))");
    expect(route).toContain('trucking_company_id = COALESCE(@truckingCompanyId, trucking_company_id)');
    expect(route).toContain('driver_user_id = COALESCE(@driverUserId, driver_user_id)');
    expect(route).toContain('trucking_company_id, driver_user_id');
    expect(route).toContain('@truckingCompanyId, @driverUserId');
  });

  it('marks the durable request released when the final Gate Out EIR is issued', () => {
    expect(gateRoute).toContain('gate_out_request_id');
    expect(gateRoute).toContain('UPDATE GateOutRequests');
    expect(gateRoute).toContain("status = 'released'");
    expect(gateRoute).toContain('gate_transaction_id = @gateTransactionId');
    expect(gateRoute).toContain('eir_number = @eirNumber');
  });
});
