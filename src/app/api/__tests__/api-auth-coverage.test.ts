import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

const highRiskMutationRoutes = [
  'src/app/api/approval-reviews/route.ts',
  'src/app/api/billing/clearance/route.ts',
  'src/app/api/billing/auto-calculate/route.ts',
  'src/app/api/billing/gate-check/route.ts',
  'src/app/api/billing/gate-in-check/route.ts',
  'src/app/api/billing/invoices/route.ts',
  'src/app/api/billing/payment-settings/route.ts',
  'src/app/api/billing/tariffs/route.ts',
  'src/app/api/billing/demurrage/route.ts',
  'src/app/api/bookings/containers/route.ts',
  'src/app/api/documents/numbering/route.ts',
  'src/app/api/edi/bookings/route.ts',
  'src/app/api/edi/codeco/send/route.ts',
  'src/app/api/edi/endpoints/route.ts',
  'src/app/api/edi/schedule/route.ts',
  'src/app/api/edi/templates/route.ts',
  'src/app/api/edi/validate/route.ts',
  'src/app/api/gate/route.ts',
  'src/app/api/gate/transfer/route.ts',
  'src/app/api/gate/transfer/receive/route.ts',
  'src/app/api/mnr/route.ts',
  'src/app/api/mnr/cedex/route.ts',
  'src/app/api/yard/audit-log/route.ts',
  'src/app/api/yard/audit/route.ts',
  'src/app/api/attachments/route.ts',
  'src/app/api/operations/route.ts',
  'src/app/api/operations/shift/route.ts',
  'src/app/api/containers/route.ts',
  'src/app/api/settings/allocation-rules/route.ts',
  'src/app/api/settings/company/route.ts',
  'src/app/api/settings/customers/portal/route.ts',
  'src/app/api/settings/email/route.ts',
  'src/app/api/settings/photo-retention/route.ts',
  'src/app/api/settings/photo-retention/cleanup/route.ts',
  'src/app/api/settings/prefix-mapping/route.ts',
  'src/app/api/settings/rate-limit/route.ts',
  'src/app/api/settings/security/route.ts',
  'src/app/api/settings/storage-rates/route.ts',
  'src/app/api/settings/yards/route.ts',
  'src/app/api/settings/zones/route.ts',
];

const spoofableActorPatterns = [
  /\bbody\.user_id\b/,
  /\bbody\.admin_user_id\b/,
  /\bbody\.approved_by\b/,
  /\bbody\.uploaded_by\b/,
  /\buser_id\b\s*:\s*z\./,
  /\bapproved_by\b\s*:\s*z\./,
  /\buploaded_by\b\s*:\s*z\./,
  /\brequestedBy\s*:\s*user_id\b/,
  /\bapprovedBy\s*:\s*approved_by\b/,
  /\buserId\s*:\s*user_id\b/,
];

describe('high-risk API mutation routes use server-derived actors', () => {
  it.each(highRiskMutationRoutes)('%s does not trust actor ids from request bodies', (relativePath) => {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

    for (const pattern of spoofableActorPatterns) {
      expect(source).not.toMatch(pattern);
    }

    const bodyDestructures = source.match(/const\s*\{[^}]*\}\s*=\s*(?:body|parsed\.data)/g) || [];
    for (const destructure of bodyDestructures) {
      expect(destructure).not.toMatch(/\b(user_id|approved_by|uploaded_by)\b/);
    }
  });

  it.each(highRiskMutationRoutes)('%s has a server-side actor or permission guard', (relativePath) => {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

    expect(source).toMatch(/\b(requirePermission|requireAnyPermission|requireRequestActor|requireRole|requireAttachmentView|requireAttachmentUpload)\s*\(/);
  });

  it('attachments GET has its own attachment view guard before selecting attachment file URLs', () => {
    const source = fs.readFileSync(path.join(repoRoot, 'src/app/api/attachments/route.ts'), 'utf8');
    const getMatch = source.match(/export\s+async\s+function\s+GET[\s\S]*?\n}\n\nexport\s+async\s+function\s+POST/);
    expect(getMatch?.[0]).toBeDefined();

    const getSource = getMatch?.[0] || '';
    const guardIndex = getSource.search(/\brequireAttachmentView\s*\(/);
    const selectIndex = getSource.indexOf('SELECT attachment_id');

    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(selectIndex).toBeGreaterThanOrEqual(0);
    expect(guardIndex).toBeLessThan(selectIndex);

    const helperSource = fs.readFileSync(path.join(repoRoot, 'src/lib/attachmentAccess.ts'), 'utf8');
    expect(helperSource).toMatch(/\brequirePermission\s*\(/);
    expect(helperSource).toContain('documents.attachment.view');
    expect(helperSource).toContain('resolveAttachmentEntityScope');
    expect(helperSource).toContain('requireYardAccess');
  });
});
