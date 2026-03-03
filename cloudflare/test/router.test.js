import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from '../src/subscribe-worker.js';
import { mockEnv, buildFetchMock, senderSubscriber } from './helpers.js';

describe('router', () => {
  let env;

  beforeEach(() => {
    env = mockEnv();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- 404 for unknown paths ---

  it('returns 404 for unknown path', async () => {
    const req = new Request('https://api.kozlov.ski/unknown');
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).toBe('Not Found');
  });

  it('returns 404 for root path', async () => {
    const req = new Request('https://api.kozlov.ski/');
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(404);
  });

  // --- 405 for wrong method on /subscribe ---

  it('returns 405 for GET on /subscribe', async () => {
    const req = new Request('https://api.kozlov.ski/subscribe');
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(405);
    const text = await res.text();
    expect(text).toBe('Method Not Allowed');
  });

  it('returns 405 for PUT on /subscribe', async () => {
    const req = new Request('https://api.kozlov.ski/subscribe', { method: 'PUT' });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(405);
  });

  // --- CORS preflight ---

  it('returns 204 for OPTIONS on /subscribe', async () => {
    const req = new Request('https://api.kozlov.ski/subscribe', {
      method: 'OPTIONS',
      headers: { Origin: 'https://kozlov.ski' },
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://kozlov.ski');
  });

  it('returns 204 for OPTIONS even with disallowed origin (no Allow-Origin header)', async () => {
    const req = new Request('https://api.kozlov.ski/subscribe', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.com' },
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  // --- Routes to correct handlers ---

  it('routes POST /subscribe to handleSubscribe', async () => {
    const sub = senderSubscriber({ email: 'router@test.com', email_verified: 'yes' });
    vi.stubGlobal('fetch', buildFetchMock([
      { match: (url) => url.includes('/subscribers?email='), response: { data: [sub] } },
      { match: (url) => url.match(/\/subscribers\/\d+$/), response: { data: sub } },
    ]));

    const req = new Request('https://api.kozlov.ski/subscribe', {
      method: 'POST',
      headers: { Origin: 'https://kozlov.ski', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'router@test.com' }),
    });
    const res = await worker.fetch(req, env);
    const body = await res.json();
    expect(body.status).toBe('existing');
  });

  it('routes GET /confirm to handleConfirm', async () => {
    // No token → should get error page
    const req = new Request('https://api.kozlov.ski/confirm');
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(400);
    expect(res.headers.get('Content-Type')).toContain('text/html');
  });

  // --- /confirm only accepts GET ---

  it('returns 404 for POST on /confirm', async () => {
    const req = new Request('https://api.kozlov.ski/confirm', { method: 'POST' });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(404);
  });
});
