import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleSubscribe } from '../src/subscribe-worker.js';
import { SENDER_API_URL } from '../src/sender.js';
import { mockEnv, makeSubscribeRequest, buildFetchMock, senderSubscriber } from './helpers.js';

describe('handleSubscribe', () => {
  let env;

  beforeEach(() => {
    env = mockEnv();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Validation errors ---

  it('returns 403 for disallowed origin', async () => {
    const req = makeSubscribeRequest({ email: 'a@b.com' }, { origin: 'https://evil.com' });
    const res = await handleSubscribe(req, env);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/Origin not allowed/);
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('https://api.kozlov.ski/subscribe', {
      method: 'POST',
      headers: { Origin: 'https://kozlov.ski', 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await handleSubscribe(req, env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid JSON/);
  });

  it('returns 400 for missing email', async () => {
    const req = makeSubscribeRequest({});
    const res = await handleSubscribe(req, env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid email/);
  });

  it('returns 400 for invalid email', async () => {
    const req = makeSubscribeRequest({ email: 'not-an-email' });
    const res = await handleSubscribe(req, env);
    expect(res.status).toBe(400);
  });

  // --- New subscriber (GET miss, probe creates new) ---

  it('returns pending_verification for new subscriber', async () => {
    const now = new Date().toISOString();
    vi.stubGlobal('fetch', buildFetchMock([
      // GET search → empty
      {
        match: (url) => url.includes('/subscribers?email='),
        response: { data: [] },
      },
      // POST probe → new subscriber (created just now)
      {
        match: (url, opts) => opts?.method === 'POST' && url.endsWith('/subscribers'),
        response: { data: { id: 1, email: 'new@example.com', created: now } },
      },
      // GET by ID → full subscriber data
      {
        match: (url) => url.match(/\/subscribers\/\d+$/),
        response: { data: senderSubscriber({ id: 1, email: 'new@example.com', created: now }) },
      },
    ]));

    const req = makeSubscribeRequest({ email: 'new@example.com' });
    const res = await handleSubscribe(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('pending_verification');
    expect(body.success).toBe(true);
  });

  // --- Existing verified subscriber found via GET ---

  it('returns existing for verified subscriber found via GET', async () => {
    const sub = senderSubscriber({ email: 'verified@example.com', email_verified: 'yes' });
    vi.stubGlobal('fetch', buildFetchMock([
      // GET search → finds subscriber
      {
        match: (url) => url.includes('/subscribers?email='),
        response: { data: [sub] },
      },
      // GET by ID → full data
      {
        match: (url) => url.match(/\/subscribers\/\d+$/),
        response: { data: sub },
      },
    ]));

    const req = makeSubscribeRequest({ email: 'verified@example.com' });
    const res = await handleSubscribe(req, env);
    const body = await res.json();
    expect(body.status).toBe('existing');
    expect(body.redirect_url).toContain('/thank-you/');
  });

  // --- Existing verified + lead magnet ---

  it('returns existing with incentive redirect for verified subscriber with lead magnet', async () => {
    const sub = senderSubscriber({ email: 'verified@example.com', email_verified: 'yes' });
    vi.stubGlobal('fetch', buildFetchMock([
      // GET search → finds subscriber
      {
        match: (url) => url.includes('/subscribers?email='),
        response: { data: [sub] },
      },
      // GET by ID → full data
      {
        match: (url) => url.match(/\/subscribers\/\d+$/),
        response: { data: sub },
      },
      // POST update fields (for lead magnet delivery)
      {
        match: (url, opts) => opts?.method === 'POST' && url.endsWith('/subscribers'),
        response: { data: sub },
      },
    ]));

    const req = makeSubscribeRequest({ email: 'verified@example.com', lead_magnet: 'temporal-joins-cheatsheet' });
    const res = await handleSubscribe(req, env);
    const body = await res.json();
    expect(body.status).toBe('existing');
    expect(body.redirect_url).toContain('/thank-you/temporal-joins-cheatsheet/');
  });

  // --- Existing verified + second lead magnet (comma-separated append) ---

  it('appends new lead magnet to existing comma-separated list', async () => {
    const sub = senderSubscriber({ email: 'verified@example.com', email_verified: 'yes', lead_magnets: 'temporal-joins-cheatsheet' });

    let capturedBody;
    vi.stubGlobal('fetch', buildFetchMock([
      {
        match: (url) => url.includes('/subscribers?email='),
        response: { data: [sub] },
      },
      {
        match: (url) => url.match(/\/subscribers\/\d+$/),
        response: { data: sub },
      },
      {
        match: (url, opts) => opts?.method === 'POST' && url.endsWith('/subscribers'),
        response: (url, opts) => {
          capturedBody = JSON.parse(opts.body);
          return { data: sub };
        },
      },
    ]));

    const req = makeSubscribeRequest({ email: 'verified@example.com', lead_magnet: 'second-cheatsheet' });
    const res = await handleSubscribe(req, env);
    const body = await res.json();
    expect(body.status).toBe('existing');
    expect(capturedBody.fields.lead_magnets).toBe('temporal-joins-cheatsheet,second-cheatsheet');
  });

  it('moves re-requested lead magnet to end of list', async () => {
    const sub = senderSubscriber({ email: 'verified@example.com', email_verified: 'yes', lead_magnets: 'temporal-joins-cheatsheet,second-cheatsheet' });

    let capturedBody;
    vi.stubGlobal('fetch', buildFetchMock([
      {
        match: (url) => url.includes('/subscribers?email='),
        response: { data: [sub] },
      },
      {
        match: (url) => url.match(/\/subscribers\/\d+$/),
        response: { data: sub },
      },
      {
        match: (url, opts) => opts?.method === 'POST' && url.endsWith('/subscribers'),
        response: (url, opts) => {
          capturedBody = JSON.parse(opts.body);
          return { data: sub };
        },
      },
    ]));

    const req = makeSubscribeRequest({ email: 'verified@example.com', lead_magnet: 'temporal-joins-cheatsheet' });
    const res = await handleSubscribe(req, env);
    const body = await res.json();
    expect(body.status).toBe('existing');
    expect(capturedBody.fields.lead_magnets).toBe('second-cheatsheet,temporal-joins-cheatsheet');
  });

  // --- Existing unverified via probe (GET miss, old created timestamp) ---

  it('returns existing_unverified when probe reveals old unverified subscriber', async () => {
    const oldDate = new Date(Date.now() - 60000).toISOString(); // 60s ago
    const sub = senderSubscriber({ id: 50, email: 'old@example.com', created: oldDate, email_verified: 'no' });

    vi.stubGlobal('fetch', buildFetchMock([
      // GET search → empty (indexing delay)
      {
        match: (url) => url.includes('/subscribers?email='),
        response: { data: [] },
      },
      // POST probe → returns old subscriber
      {
        match: (url, opts) => opts?.method === 'POST' && url.endsWith('/subscribers'),
        response: { data: { id: 50, email: 'old@example.com', created: oldDate } },
      },
      // GET by ID → full data with email_verified: no
      {
        match: (url) => url.match(/\/subscribers\/\d+$/),
        response: { data: sub },
      },
    ]));

    const req = makeSubscribeRequest({ email: 'old@example.com' });
    const res = await handleSubscribe(req, env);
    const body = await res.json();
    expect(body.status).toBe('existing_unverified');
    expect(body.success).toBe(true);
  });

  // --- Existing verified via probe (GET miss, old created, verified) ---

  it('returns existing when probe reveals old verified subscriber', async () => {
    const oldDate = new Date(Date.now() - 60000).toISOString();
    const sub = senderSubscriber({ id: 51, email: 'old-verified@example.com', created: oldDate, email_verified: 'yes' });

    vi.stubGlobal('fetch', buildFetchMock([
      // GET search → empty
      {
        match: (url) => url.includes('/subscribers?email='),
        response: { data: [] },
      },
      // POST probe → returns old subscriber
      {
        match: (url, opts) => opts?.method === 'POST' && url.endsWith('/subscribers'),
        response: { data: { id: 51, email: 'old-verified@example.com', created: oldDate } },
      },
      // GET by ID → full data with email_verified: yes
      {
        match: (url) => url.match(/\/subscribers\/\d+$/),
        response: { data: sub },
      },
    ]));

    const req = makeSubscribeRequest({ email: 'old-verified@example.com' });
    const res = await handleSubscribe(req, env);
    const body = await res.json();
    expect(body.status).toBe('existing');
    expect(body.redirect_url).toContain('/thank-you/');
  });

  // --- Sender.net API error ---

  it('returns error when Sender.net create fails', async () => {
    const now = new Date().toISOString();
    vi.stubGlobal('fetch', buildFetchMock([
      // GET search → empty
      {
        match: (url) => url.includes('/subscribers?email='),
        response: { data: [] },
      },
      // POST probe → new subscriber
      {
        match: (url, opts) => opts?.method === 'POST' && url.endsWith('/subscribers'),
        response: (() => {
          let callCount = 0;
          return (url, opts) => {
            callCount++;
            if (callCount === 1) {
              // First POST = probe → new subscriber
              return { data: { id: 1, email: 'fail@example.com', created: now } };
            }
            // Second POST = create → error (handled via status)
            return { message: 'Rate limited' };
          };
        })(),
        status: (() => {
          // Need to return different statuses for different calls
          // This won't work with the simple mock — let's restructure
        })(),
      },
      // GET by ID
      {
        match: (url) => url.match(/\/subscribers\/\d+$/),
        response: { data: senderSubscriber({ id: 1, email: 'fail@example.com', created: now }) },
      },
    ]));

    // The mock above is too complex for the simple buildFetchMock.
    // Let's use a custom fetch mock instead.
    let postCallCount = 0;
    vi.stubGlobal('fetch', async (url, opts) => {
      const urlStr = url.toString();
      if (urlStr.includes('/subscribers?email=')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (urlStr.match(/\/subscribers\/\d+$/)) {
        return new Response(JSON.stringify({ data: senderSubscriber({ id: 1, email: 'fail@example.com', created: now }) }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      if (opts?.method === 'POST' && urlStr.endsWith('/subscribers')) {
        postCallCount++;
        if (postCallCount === 1) {
          // probe → new
          return new Response(JSON.stringify({ data: { id: 1, email: 'fail@example.com', created: now } }), {
            status: 200, headers: { 'Content-Type': 'application/json' },
          });
        }
        // create → fail
        return new Response(JSON.stringify({ message: 'Rate limited' }), {
          status: 429, headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unhandled fetch: ${opts?.method || 'GET'} ${urlStr}`);
    });

    const req = makeSubscribeRequest({ email: 'fail@example.com' });
    const res = await handleSubscribe(req, env);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('Rate limited');
  });

  // --- CORS headers present in responses ---

  it('includes CORS headers in success response', async () => {
    const sub = senderSubscriber({ email: 'cors@example.com', email_verified: 'yes' });
    vi.stubGlobal('fetch', buildFetchMock([
      {
        match: (url) => url.includes('/subscribers?email='),
        response: { data: [sub] },
      },
      {
        match: (url) => url.match(/\/subscribers\/\d+$/),
        response: { data: sub },
      },
    ]));

    const req = makeSubscribeRequest({ email: 'cors@example.com' });
    const res = await handleSubscribe(req, env);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://kozlov.ski');
  });
});
