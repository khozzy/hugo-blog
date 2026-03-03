/**
 * Shared test utilities: mock env, request builders, fetch mock builder.
 */

export function mockEnv(overrides = {}) {
  return {
    SENDER_API_TOKEN: 'test-api-token',
    CONFIRM_SECRET: 'test-confirm-secret',
    ALLOWED_ORIGINS: 'https://kozlov.ski,http://localhost:1313',
    SENDER_GROUP_ID: 'group-123',
    ...overrides,
  };
}

export function makeRequest(url, options = {}) {
  const { method = 'GET', origin = 'https://kozlov.ski', body, headers = {} } = options;
  const reqHeaders = new Headers(headers);
  if (origin) reqHeaders.set('Origin', origin);
  if (body && !reqHeaders.has('Content-Type')) reqHeaders.set('Content-Type', 'application/json');

  return new Request(url, {
    method,
    headers: reqHeaders,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

export function makeSubscribeRequest(body, options = {}) {
  return makeRequest('https://api.kozlov.ski/subscribe', {
    method: 'POST',
    body,
    ...options,
  });
}

export function makeConfirmRequest(token) {
  return makeRequest(`https://api.kozlov.ski/confirm?token=${token}`);
}

/**
 * Build a mock for global fetch that maps URL patterns to responses.
 *
 * Usage:
 *   const fetchMock = buildFetchMock([
 *     { match: (url, opts) => url.includes('/subscribers?email='), response: { data: [] } },
 *     { match: (url, opts) => opts?.method === 'POST' && url.endsWith('/subscribers'), response: { data: { id: 1 } } },
 *   ]);
 *   vi.stubGlobal('fetch', fetchMock);
 */
export function buildFetchMock(handlers) {
  return async (url, opts) => {
    for (const handler of handlers) {
      if (handler.match(url.toString(), opts)) {
        const status = handler.status ?? 200;
        const body = typeof handler.response === 'function' ? handler.response(url, opts) : handler.response;
        return new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    throw new Error(`Unhandled fetch: ${opts?.method || 'GET'} ${url}`);
  };
}

export function senderSubscriber({
  id = 100,
  email = 'test@example.com',
  created = new Date().toISOString(),
  email_verified = 'no',
  lead_magnets = '',
  confirmation_url = '',
} = {}) {
  return {
    id,
    email,
    created,
    columns: [
      { title: 'Email verified', value: email_verified },
      { title: 'Lead magnets', value: lead_magnets },
      { title: 'Confirmation URL', value: confirmation_url },
    ],
  };
}
