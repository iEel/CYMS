import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../..');

const highRiskMutationRoutes = [
  'src/app/api/approval-reviews/route.ts',
  'src/app/api/billing/clearance/route.ts',
  'src/app/api/billing/invoices/route.ts',
  'src/app/api/gate/route.ts',
  'src/app/api/mnr/route.ts',
  'src/app/api/yard/audit-log/route.ts',
  'src/app/api/attachments/route.ts',
  'src/app/api/operations/route.ts',
  'src/app/api/containers/route.ts',
];

const spoofableActorPatterns = [
  /\bbody\.user_id\b/,
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

    expect(source).toMatch(/\b(requirePermission|requireAnyPermission|requireRequestActor|requireRole)\s*\(/);
  });
});
