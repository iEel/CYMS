import fs from 'fs';
import path from 'path';

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function quotedLiteral(value: string) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`['"\`]${escaped}['"\`]`);
}

const portalVisibilityRoutes = [
  'src/app/api/portal/containers/route.ts',
  'src/app/api/portal/bookings/route.ts',
  'src/app/api/portal/eir/route.ts',
  'src/app/api/portal/invoices/route.ts',
  'src/app/api/portal/document-bundle/route.ts',
];

const insecureBodyCustomerIdVisibilityPatterns = [
  /\b(?:const|let|var)\s+(?:cid|customerId|portalCustomerId)\s*=\s*body\.customer_id\b/,
  /\.input\(\s*['"`](?:cid|customerId|customer_id)['"`][\s\S]{0,120}\bbody\.customer_id\b/,
  /\b(?:portal\w*VisibilitySql|whereClause|filterClauses|filters|conditions)\b[\s\S]{0,160}\bbody\.customer_id\b/,
  /\bbody\.customer_id\b[\s\S]{0,160}\b(?:portal\w*VisibilitySql|whereClause|filterClauses|filters|conditions)\b/,
];

describe('customer portal data leakage prevention', () => {
  it.each(portalVisibilityRoutes)('%s derives portal visibility from the token customer id', (routePath) => {
    const source = readSource(routePath);

    expect(source).toContain('getPortalCustomerId(request)');
    expect(source).not.toMatch(/searchParams\.get\(\s*'customer_id'\s*\)/);
    expect(source).not.toMatch(/searchParams\.get\(\s*"customer_id"\s*\)/);

    for (const pattern of insecureBodyCustomerIdVisibilityPatterns) {
      expect(source).not.toMatch(pattern);
    }
  });

  it('keeps invoice listing visibility on invoice grants instead of container grants', () => {
    const source = readSource('src/app/api/portal/invoices/route.ts');

    expect(source).toContain('portalInvoiceVisibilitySql');
    expect(source).not.toContain('portalContainerVisibilitySql');
  });

  it('does not assign invoice grants to driver or trucking parties', () => {
    const source = readSource('src/lib/portalGrantRules.ts');

    expect(source).toMatch(/'driver'/);
    expect(source).toMatch(/'trucking'/);
    expect(source).toMatch(/function\s+buildInvoicePartyGrants/);
    expect(source).toMatch(/accessRole:\s*'invoice_customer'/);
    expect(source).not.toMatch(/entityType:\s*'invoice'[\s\S]{0,240}accessRole:\s*'(?:driver|trucking)'/);
    expect(source).not.toMatch(/accessRole:\s*'(?:driver|trucking)'[\s\S]{0,240}entityType:\s*'invoice'/);
  });

  it('keeps authenticated gate EIR private while public EIR remains explicitly public', () => {
    const source = readSource('src/proxy.ts');
    const publicApiPaths = source.match(/PUBLIC_API_PATHS\s*=\s*\[[\s\S]*?\]/)?.[0] || '';

    expect(publicApiPaths).toMatch(quotedLiteral('/api/public/eir'));
    expect(publicApiPaths).not.toMatch(quotedLiteral('/api/gate/eir'));
  });

  it.each([
    'src/app/api/portal/eir/route.ts',
    'src/app/api/portal/eir-pdf/route.ts',
  ])('%s sanitizes portal EIR output behind portal action checks', (routePath) => {
    const source = readSource(routePath);

    expect(source).toContain('requirePortalAction');
    expect(source).toContain('buildEirViewPayload');
  });

  it('does not reintroduce cross-yard booking fallback in grant reconciliation SQL', () => {
    const insecureFallback = 'OR gt.yard_id IS NULL OR b.yard_id IS NULL';

    expect(readSource('src/lib/portalGrantReconciler.ts')).not.toContain(insecureFallback);
    expect(readSource('src/lib/schema.sql')).not.toContain(insecureFallback);
  });
});
