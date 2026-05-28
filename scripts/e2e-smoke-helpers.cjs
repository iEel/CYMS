function isProtectedRedirectStatus(status) {
  return [302, 307, 308].includes(status);
}

function assertProtectedPageRedirect(result, baseUrl = process.env.CYMS_E2E_BASE_URL || 'http://localhost:3005') {
  if (!isProtectedRedirectStatus(result.status)) {
    return;
  }

  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const location = String(result.location || '');
  if (!location) {
    throw new Error(`${result.path} redirected to missing location`);
  }

  let redirectUrl;
  try {
    redirectUrl = new URL(location, normalizedBaseUrl);
  } catch {
    throw new Error(`${result.path} redirected to invalid location: ${location}`);
  }

  const expectedPath =
    redirectUrl.pathname === '/login' ||
    redirectUrl.pathname.startsWith('/login/') ||
    redirectUrl.pathname === '/auth' ||
    redirectUrl.pathname.startsWith('/auth/');
  if (redirectUrl.origin !== new URL(normalizedBaseUrl).origin || !expectedPath) {
    throw new Error(`${result.path} redirected to unexpected location: ${location}`);
  }
}

module.exports = {
  assertProtectedPageRedirect,
  isProtectedRedirectStatus,
};
