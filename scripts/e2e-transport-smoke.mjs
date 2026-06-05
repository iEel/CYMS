#!/usr/bin/env node

import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const {
  SMOKE_USERS,
  SMOKE_CONTAINER,
  SMOKE_PROOF,
} = require('./transport-smoke-fixture.cjs');

const baseUrl = (process.env.CYMS_E2E_BASE_URL || 'http://localhost:3005').replace(/\/$/, '');
const username = process.env.CYMS_TRANSPORT_SMOKE_USERNAME || SMOKE_USERS.driver.username;
const password = process.env.CYMS_TRANSPORT_SMOKE_PASSWORD || SMOKE_USERS.driver.password;
const deviceId = process.env.CYMS_TRANSPORT_SMOKE_DEVICE_ID || 'transport-smoke-device';

async function request(path, options = {}) {
  const { sessionCookie, json, headers = {}, ...fetchOptions } = options;
  const started = Date.now();
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: 'manual',
    ...fetchOptions,
    headers: sessionCookie ? { cookie: sessionCookie, ...headers } : headers,
    body: json === undefined ? fetchOptions.body : JSON.stringify(json),
  });
  const text = await response.text().catch(() => '');
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  return {
    path,
    status: response.status,
    headers: response.headers,
    location: response.headers.get('location'),
    ms: Date.now() - started,
    text,
    body,
  };
}

function assertStatus(result, allowedStatuses) {
  if (!allowedStatuses.includes(result.status)) {
    throw new Error(`${result.path} expected ${allowedStatuses.join('/')} but got ${result.status}: ${result.text.slice(0, 300)}`);
  }
}

function assertBody(result) {
  if (!result.body || typeof result.body !== 'object') {
    throw new Error(`${result.path} did not return a JSON object`);
  }
  return result.body;
}

function getSessionCookie(loginResult) {
  const setCookie = loginResult.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('/api/auth/login did not return set-cookie');
  }
  const sessionCookie = setCookie.split(';')[0];
  if (!sessionCookie.startsWith('cyms_token=')) {
    throw new Error(`/api/auth/login returned unexpected cookie: ${sessionCookie}`);
  }
  return sessionCookie;
}

async function postTransportAction(sessionCookie, jobId, action, extra = {}) {
  const result = await request('/api/transport/actions', {
    method: 'POST',
    sessionCookie,
    headers: { 'content-type': 'application/json' },
    json: {
      job_id: jobId,
      action,
      ...extra,
    },
  });
  assertStatus(result, [200]);
  const body = assertBody(result);
  if (body.success !== true || body.action !== action) {
    throw new Error(`/api/transport/actions did not accept ${action}: ${result.text}`);
  }
  return result;
}

async function run() {
  const checks = [];

  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    json: { username, password, device_id: deviceId },
  });
  assertStatus(login, [200]);
  const sessionCookie = getSessionCookie(login);
  checks.push(login);

  const me = await request('/api/auth/me', { sessionCookie });
  assertStatus(me, [200]);
  const meBody = assertBody(me);
  const session = meBody.session && typeof meBody.session === 'object' ? meBody.session : meBody;
  if (session.role !== 'customer') {
    throw new Error(`/api/auth/me expected customer role but got ${session.role}`);
  }
  checks.push(me);

  const capabilities = await request('/api/transport/capabilities', { sessionCookie });
  assertStatus(capabilities, [200]);
  const capabilityBody = assertBody(capabilities);
  if (capabilityBody.transport?.enabled !== true) {
    throw new Error('/api/transport/capabilities did not enable transport');
  }
  checks.push(capabilities);

  const jobs = await request('/api/transport/jobs', { sessionCookie });
  assertStatus(jobs, [200]);
  const jobsBody = assertBody(jobs);
  const job = Array.isArray(jobsBody.jobs)
    ? jobsBody.jobs.find((item) => {
      return (
        typeof item?.jobId === 'string' &&
        item.jobId.startsWith('request-') &&
        item.containerNumber === SMOKE_CONTAINER.container_number
      );
    })
    : null;
  if (!job) {
    throw new Error(`/api/transport/jobs did not include seeded request- job for ${SMOKE_CONTAINER.container_number}`);
  }
  const jobId = job.jobId;
  checks.push(jobs);

  checks.push(await postTransportAction(sessionCookie, jobId, 'confirm_job'));
  checks.push(await postTransportAction(sessionCookie, jobId, 'add_proof', {
    proof_url: SMOKE_PROOF.url,
    proof_type: SMOKE_PROOF.type,
    note: `${SMOKE_CONTAINER.container_number} smoke proof`,
  }));
  checks.push(await postTransportAction(sessionCookie, jobId, 'report_issue', {
    note: `${SMOKE_CONTAINER.container_number} smoke issue check`,
  }));
  checks.push(await postTransportAction(sessionCookie, jobId, 'mark_arrived'));

  const activity = await request(`/api/transport/activity?job_id=${encodeURIComponent(jobId)}`, { sessionCookie });
  assertStatus(activity, [200]);
  const activityBody = assertBody(activity);
  const actions = Array.isArray(activityBody.activities)
    ? activityBody.activities.map((item) => item.action)
    : [];
  for (const action of ['confirm_job', 'add_proof', 'report_issue', 'mark_arrived']) {
    if (!actions.includes(action)) {
      throw new Error(`/api/transport/activity missing action ${action} for ${jobId}`);
    }
  }
  const proofUrls = Array.isArray(activityBody.proofs)
    ? activityBody.proofs.map((item) => item.fileUrl)
    : [];
  if (!proofUrls.includes(SMOKE_PROOF.url)) {
    throw new Error(`/api/transport/activity missing proof ${SMOKE_PROOF.url} for ${jobId}`);
  }
  checks.push(activity);

  console.log(`Transport E2E smoke passed against ${baseUrl}`);
  console.log(`- job ${jobId} / container ${SMOKE_CONTAINER.container_number}`);
  for (const check of checks) {
    console.log(`- ${check.path} ${check.status} ${check.ms}ms`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error('Transport E2E smoke failed');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
