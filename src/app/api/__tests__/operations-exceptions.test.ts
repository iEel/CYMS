import fs from 'fs';
import path from 'path';
import { PERMISSION_SEEDS, ROLE_GRANTS } from '@/lib/rbacSeeds';

const root = process.cwd();

describe('Operational exception center RBAC', () => {
  it('seeds dedicated operations exception permissions and role grants', () => {
    const permissionsByCode = new Map(PERMISSION_SEEDS.map(permission => [permission.code, permission]));

    expect(permissionsByCode.get('operations.exceptions.view')).toMatchObject({
      module: 'operations',
      action: 'exceptions_view',
      description: 'ดูศูนย์รวม exception งานปฏิบัติการ',
    });
    expect(permissionsByCode.get('operations.exceptions.manage')).toMatchObject({
      module: 'operations',
      action: 'exceptions_manage',
      description: 'มอบหมาย รับทราบ ปิด หรือ ignore exception งานปฏิบัติการ',
      risk: 'medium',
    });

    expect(ROLE_GRANTS.supervisor).toEqual(expect.arrayContaining([
      'operations.exceptions.view',
      'operations.exceptions.manage',
    ]));
    expect(ROLE_GRANTS.yard_manager).toEqual(expect.arrayContaining([
      'operations.exceptions.view',
      'operations.exceptions.manage',
    ]));
    for (const roleCode of ['yard_planner', 'billing_officer', 'surveyor']) {
      expect(ROLE_GRANTS[roleCode]).toContain('operations.exceptions.view');
    }
  });

  it('backfills dedicated operations exception permissions for the expected role groups', () => {
    const migration = fs.readFileSync(path.join(root, 'scripts/migrate-runtime-core-schema.js'), 'utf8');

    expect(migration).toMatch(
      /r\.role_code IN \('yard_manager', 'supervisor'\)\s+AND p\.permission_code = 'operations\.exceptions\.manage'/
    );
    expect(migration).toMatch(
      /r\.role_code IN \('yard_manager', 'supervisor', 'surveyor', 'yard_planner', 'billing_officer'\)\s+AND p\.permission_code = 'operations\.exceptions\.view'/
    );
  });

  it('lets the Operations menu appear for exception-center-only users', () => {
    const sidebar = fs.readFileSync(path.join(root, 'src/components/layout/Sidebar.tsx'), 'utf8');

    expect(sidebar).toContain('operations.exceptions.view');
    expect(sidebar).toContain('billing_officer');
    expect(sidebar).toContain('yard.slot.move');
    expect(sidebar).toContain('yard.location.assign');
    expect(sidebar).toContain("href: '/operations'");
  });
});

describe('Operational exceptions API source integration', () => {
  const routePath = path.join(root, 'src/app/api/operations/exceptions/route.ts');
  const reeferRoutePath = path.join(root, 'src/app/api/reefer/exceptions/route.ts');
  const reeferSourcePath = path.join(root, 'src/lib/reeferExceptions.ts');

  it('defines an internal operations exception route with yard and permission guards', () => {
    expect(fs.existsSync(routePath)).toBe(true);
    const route = fs.readFileSync(routePath, 'utf8');

    expect(route).toContain('requireYardAccess');
    expect(route).toContain('operations.exceptions.view');
    expect(route).toContain('operations.exceptions.manage');
    expect(route).not.toContain("'reports.view'");
  });

  it('reads every operational exception source through existing source tables and helpers', () => {
    expect(fs.existsSync(routePath)).toBe(true);
    const route = fs.readFileSync(routePath, 'utf8');

    expect(route).toContain('ReeferExceptions');
    expect(route).toContain('ApprovalReviews');
    expect(route).toContain('GateOutRequests');
    expect(route).toContain('RECONCILIATION_ISSUE_DEFINITIONS');
    expect(route).toContain('runReconciliationIssue');
    expect(route).toContain('buildReconciliationIssueResponse');
    expect(route).toContain('normalizeReconciliationException');
  });

  it('does not run schema DDL from the operations exception route', () => {
    expect(fs.existsSync(routePath)).toBe(true);
    const route = fs.readFileSync(routePath, 'utf8');

    expect(route).not.toMatch(/\bOBJECT_ID\b/);
    expect(route).not.toMatch(/\bCOL_LENGTH\b/);
    expect(route).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(route).not.toMatch(/\bCREATE\s+TABLE\b/i);
  });

  it('parameterizes source filters and action upserts', () => {
    expect(fs.existsSync(routePath)).toBe(true);
    const route = fs.readFileSync(routePath, 'utf8');

    expect(route).toContain(".input('yardId'");
    expect(route).toContain(".input('status'");
    expect(route).toContain(".input('source'");
    expect(route).toMatch(/\.input\('actorId'|actorId\s*:/);
  });

  it('uses shared action helpers and never persists acknowledged action status', () => {
    expect(fs.existsSync(routePath)).toBe(true);
    const route = fs.readFileSync(routePath, 'utf8');

    expect(route).toContain('loadOperationalActionRecords');
    expect(route).toContain('upsertOperationalAction');
    expect(route).toMatch(/acknowledge[\s\S]*status:\s*'open'|statusByAction[\s\S]*acknowledge:\s*'open'/);
    expect(route).not.toMatch(/status:\s*['"]acknowledged['"]/);
    expect(route).not.toMatch(/status\s*=\s*['"]acknowledged['"]/);
  });

  it('applies operational action overlays to normalized reconciliation issues', () => {
    expect(fs.existsSync(routePath)).toBe(true);
    const route = fs.readFileSync(routePath, 'utf8');
    const overlayFunction = route.match(/function applyOperationalOverlays[\s\S]*?\n}\n\nfunction matchesSearch/)?.[0] || '';

    expect(overlayFunction).toContain('actionMap.get(itemActionKey(item))');
    expect(overlayFunction).not.toMatch(/item\.source\s*===\s*['"]reconciliation['"]/);
  });

  it('does not overlay source-owned approval or reefer exception state', () => {
    expect(fs.existsSync(routePath)).toBe(true);
    const route = fs.readFileSync(routePath, 'utf8');
    const overlayFunction = route.match(/function applyOperationalOverlays[\s\S]*?\n}\n\nfunction matchesSearch/)?.[0] || '';

    expect(overlayFunction).toMatch(/item\.source\s*===\s*['"]approval['"]/);
    expect(overlayFunction).toMatch(/item\.source\s*===\s*['"]reefer['"]/);
  });

  it('validates mutable exception actions by source contract', () => {
    expect(fs.existsSync(routePath)).toBe(true);
    const route = fs.readFileSync(routePath, 'utf8');

    expect(route).toContain('SOURCE_PATCH_ACTIONS');
    expect(route).toContain("reconciliation: ['assign', 'resolve', 'ignore']");
    expect(route).toContain("transport: ['assign', 'acknowledge']");
    expect(route).toContain("action ไม่ถูกต้องสำหรับ source นี้");
  });

  it('handles reefer assign as a source-owned action using assigned_to_user_id', () => {
    expect(fs.existsSync(routePath)).toBe(true);
    const route = fs.readFileSync(routePath, 'utf8');
    const reeferBranch = route.match(/if \(source === 'reefer'[\s\S]*?\n    }\n\n    if \(!entityId/)?.[0] || '';

    expect(reeferBranch).toContain("action === 'assign'");
    expect(reeferBranch).toContain('assigned_to_user_id');
    expect(reeferBranch).toContain('updateReeferExceptionAction');
    expect(reeferBranch).toContain('yardId');
    expect(reeferBranch).not.toContain('upsertOperationalAction');
    expect(reeferBranch).not.toContain('exception ไม่อยู่ในลานที่ระบุ');
  });

  it('routes reefer actions through the shared reefer update helper', () => {
    const reeferRoute = fs.readFileSync(reeferRoutePath, 'utf8');
    const reeferSource = fs.readFileSync(reeferSourcePath, 'utf8');

    expect(reeferRoute).toContain('updateReeferExceptionAction');
    expect(reeferSource).toContain('export async function updateReeferExceptionAction');
  });
});
