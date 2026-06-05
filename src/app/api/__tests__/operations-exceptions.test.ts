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

describe('Operational exception center UI', () => {
  const pagePath = path.join(root, 'src/app/(dashboard)/operations/page.tsx');
  const componentPath = path.join(root, 'src/components/operations/OperationalExceptionCenter.tsx');

  it('adds a permission-gated Exception Center tab without requiring yard move rights', () => {
    const page = fs.readFileSync(pagePath, 'utf8');

    expect(page).toContain('OperationalExceptionCenter');
    expect(page).toContain('Exception Center');
    expect(page).toContain('useSearchParams');
    expect(page).toContain('operations.exceptions.view');
    expect(page).toContain('operations.exceptions.manage');
    expect(page).toContain("id: 'exceptions'");
    expect(page).toContain('allowed: canViewExceptions');
    expect(page).toContain('canManageExceptions');
    expect(page).toContain("searchParams.get('tab')");
    expect(page).toContain("searchParams.get('source')");
    expect(page).toContain('initialSource={exceptionInitialSource}');
  });

  it('renders exception filters, summary metrics, API calls, and action labels', () => {
    expect(fs.existsSync(componentPath)).toBe(true);
    const component = fs.existsSync(componentPath) ? fs.readFileSync(componentPath, 'utf8') : '';

    expect(component).toContain('/api/operations/exceptions');
    expect(component).toContain('include_closed');
    expect(component).toContain('initialSource');
    expect(component).toContain('ActionInputDialog');
    expect(component).toContain('allowed_actions');
    expect(component).toContain('Total open');
    expect(component).toContain('Critical');
    expect(component).toContain('Warning');
    expect(component).toContain('SLA breached');
    for (const label of ['Assign', 'Acknowledge', 'Resolve', 'Ignore', 'Reopen', 'Open detail']) {
      expect(component).toContain(label);
    }
  });

  it('submits valid patch identity fields and blocks reefer text assignment in the MVP', () => {
    expect(fs.existsSync(componentPath)).toBe(true);
    const component = fs.existsSync(componentPath) ? fs.readFileSync(componentPath, 'utf8') : '';

    expect(component).toContain("method: 'PATCH'");
    expect(component).toContain('issue_code');
    expect(component).toContain('entity_id');
    expect(component).toContain('entity_ref');
    expect(component).toContain('exception_id');
    expect(component).toContain('assigned_to');
    expect(component).toContain('note');
    expect(component).toContain("item.source === 'reefer' && action === 'assign'");
    expect(component).toContain('Reefer assign requires a user ID');
    expect(component).not.toContain('assigned_to_user_id: Number(values.assigned_to)');
  });

  it('deep-links dashboard and reports into the Exception Center', () => {
    const dashboard = fs.readFileSync(path.join(root, 'src/app/(dashboard)/dashboard/page.tsx'), 'utf8');
    const reports = fs.readFileSync(path.join(root, 'src/app/(dashboard)/reports/page.tsx'), 'utf8');

    expect(dashboard).toContain('/operations?tab=exceptions');
    expect(reports).toContain('/operations?tab=exceptions&source=reconciliation');
    expect(reports).toContain('/operations?tab=exceptions&source=reefer');
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
