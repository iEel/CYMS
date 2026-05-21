import fs from 'fs';
import path from 'path';

describe('Customer Portal UI', () => {
  const root = process.cwd();

  it('uses EIR In/Out as the direct document action instead of a separate view button', () => {
    const source = fs.readFileSync(path.join(root, 'src/app/(portal)/portal/containers/page.tsx'), 'utf8');

    expect(source).toContain('<FileText size={12} /> {doc.label}');
    expect(source).not.toContain('<Eye size={12} /> ดู');
    expect(source).not.toContain('title={`ดู ${doc.label}`}');
  });
});
