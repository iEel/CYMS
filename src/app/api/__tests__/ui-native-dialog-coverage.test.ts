import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();

const TARGETS = [
  'src/app/(dashboard)/settings/PortalAccessControl.tsx',
  'src/app/(dashboard)/gate/GateInTab.tsx',
  'src/app/(dashboard)/gate/GateOutTab.tsx',
  'src/app/(dashboard)/billing/page.tsx',
  'src/app/(dashboard)/billing/PaymentReconciliationTab.tsx',
  'src/app/billing/print/continuous/page.tsx',
  'src/app/(dashboard)/reefer/page.tsx',
  'src/app/(dashboard)/edi/page.tsx',
];

describe('native browser dialog cleanup', () => {
  it.each(TARGETS)('%s does not use native prompt/confirm dialogs', relativePath => {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

    expect(source).not.toContain('window.prompt');
    expect(source).not.toContain('window.confirm');
  });
});
