#!/usr/bin/env node

const baseUrl = (process.env.CYMS_E2E_BASE_URL || 'http://localhost:3005').replace(/\/$/, '');

async function request(path, options = {}) {
  const started = Date.now();
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: 'manual',
    ...options,
  });
  return {
    path,
    status: response.status,
    location: response.headers.get('location'),
    ms: Date.now() - started,
    text: await response.text().catch(() => ''),
  };
}

function assertStatus(result, allowedStatuses) {
  if (!allowedStatuses.includes(result.status)) {
    throw new Error(`${result.path} expected ${allowedStatuses.join('/')} but got ${result.status}`);
  }
}

function assertContains(result, needle) {
  if (!result.text.includes(needle)) {
    throw new Error(`${result.path} expected response to include "${needle}"`);
  }
}

async function run() {
  const checks = [];

  const login = await request('/login');
  assertStatus(login, [200]);
  assertContains(login, 'CYMS');
  checks.push(login);

  const manifest = await request('/manifest.json');
  assertStatus(manifest, [200]);
  assertContains(manifest, 'CYMS');
  checks.push(manifest);

  const authMe = await request('/api/auth/me');
  assertStatus(authMe, [200, 401]);
  checks.push(authMe);

  const publicEir = await request('/eir/SMOKE-EIR-NOT-FOUND');
  assertStatus(publicEir, [200, 404]);
  checks.push(publicEir);

  const portalContainers = await request('/portal/containers');
  assertStatus(portalContainers, [200, 302, 401, 403]);
  checks.push(portalContainers);

  const documentTemplates = await request('/settings?tab=document-templates');
  assertStatus(documentTemplates, [200, 302, 401, 403]);
  checks.push(documentTemplates);

  const continuousPrint = await request('/billing/print/continuous?preview=sample&type=tax_invoice_receipt');
  assertStatus(continuousPrint, [200, 302, 401, 403]);
  checks.push(continuousPrint);

  const dashboard = await request('/dashboard');
  assertStatus(dashboard, [200, 302, 307, 308]);
  if ([302, 307, 308].includes(dashboard.status) && !String(dashboard.location || '').includes('/login')) {
    throw new Error(`/dashboard redirected to unexpected location: ${dashboard.location}`);
  }
  checks.push(dashboard);

  console.log(`E2E smoke passed against ${baseUrl}`);
  for (const check of checks) {
    console.log(`- ${check.path} ${check.status} ${check.ms}ms`);
  }
}

run().catch((error) => {
  console.error('E2E smoke failed');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
