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

  // --- New subscriber (GET miss → single create POST) ---

  it('returns pending_verification for new subscriber', async () => {
    vi.stubGlobal('fetch', buildFetchMock([
      // GET search → empty
      {
        match: (url) => url.includes('/subscribers?email='),
        response: { data: [] },
      },
      // POST create → success
      {
        match: (url, opts) => opts?.method === 'POST' && url.endsWith('/subscribers'),
        response: { data: { id: 1, email: 'new@example.com' } },
      },
    ]));

    const req = makeSubscribeRequest({ email: 'new@example.com' });
    const res = await handleSubscribe(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('pending_verification');
    expect(body.success).toBe(true);
    expect(body.redirect_url).toBe('https://kozlov.ski/thank-you/');
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

  // --- Regression: leading comma + email_verified preservation ---

  it('does not produce leading comma when subscriber has no prior lead magnets', async () => {
    const sub = senderSubscriber({ email: 'verified@example.com', email_verified: 'yes', lead_magnets: '' });

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
    expect(capturedBody.fields.lead_magnets).toBe('temporal-joins-cheatsheet');
  });

  it('preserves email_verified when updating lead magnets', async () => {
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
    expect(capturedBody.fields.email_verified).toBe('yes');
  });

  // --- Existing unverified (GET miss → fresh confirmation sent) ---

  it('sends fresh confirmation for unverified subscriber not found via GET', async () => {
    vi.stubGlobal('fetch', buildFetchMock([
      // GET search → empty
      {
        match: (url) => url.includes('/subscribers?email='),
        response: { data: [] },
      },
      // POST create → success (creates or updates subscriber with fields + automation)
      {
        match: (url, opts) => opts?.method === 'POST' && url.endsWith('/subscribers'),
        response: { data: { id: 50, email: 'old@example.com' } },
      },
    ]));

    const req = makeSubscribeRequest({ email: 'old@example.com' });
    const res = await handleSubscribe(req, env);
    const body = await res.json();
    expect(body.status).toBe('pending_verification');
    expect(body.success).toBe(true);
  });

  // --- Sender.net API error ---

  it('returns error when Sender.net create fails', async () => {
    vi.stubGlobal('fetch', buildFetchMock([
      // GET search → empty
      {
        match: (url) => url.includes('/subscribers?email='),
        response: { data: [] },
      },
      // POST create → fail
      {
        match: (url, opts) => opts?.method === 'POST' && url.endsWith('/subscribers'),
        response: { message: 'Rate limited' },
        status: 429,
      },
    ]));

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
