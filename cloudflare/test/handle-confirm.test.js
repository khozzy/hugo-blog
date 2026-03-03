import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleConfirm, CANONICAL_SITE_URL } from '../src/subscribe-worker.js';
import { generateConfirmToken } from '../src/crypto.js';
import { mockEnv, makeConfirmRequest, buildFetchMock, senderSubscriber } from './helpers.js';

describe('handleConfirm', () => {
  let env;

  beforeEach(() => {
    env = mockEnv();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Missing token ---

  it('returns 400 HTML error for missing token', async () => {
    const req = new Request('https://api.kozlov.ski/confirm');
    const res = await handleConfirm(req, env);
    expect(res.status).toBe(400);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('Missing confirmation token');
  });

  // --- Invalid token ---

  it('returns 400 HTML error for invalid token', async () => {
    const req = makeConfirmRequest('garbage-token');
    const res = await handleConfirm(req, env);
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain('invalid or has expired');
  });

  // --- Tampered token ---

  it('returns 400 HTML error for tampered token', async () => {
    const token = await generateConfirmToken('user@example.com', '', env.CONFIRM_SECRET);
    const tampered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
    const req = makeConfirmRequest(tampered);
    const res = await handleConfirm(req, env);
    expect(res.status).toBe(400);
  });

  // --- Valid token without lead magnet ---

  it('redirects to /thank-you/confirmed/ for valid token without lead magnet', async () => {
    const token = await generateConfirmToken('user@example.com', '', env.CONFIRM_SECRET);

    vi.stubGlobal('fetch', buildFetchMock([
      {
        match: (url, opts) => opts?.method === 'POST' && url.endsWith('/subscribers'),
        response: { data: senderSubscriber({ email: 'user@example.com', email_verified: 'yes' }) },
      },
    ]));

    const req = makeConfirmRequest(token);
    const res = await handleConfirm(req, env);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(`${CANONICAL_SITE_URL}/thank-you/confirmed/`);
  });

  // --- Valid token with lead magnet ---

  it('redirects to incentive URL for valid token with lead magnet', async () => {
    const token = await generateConfirmToken('user@example.com', 'temporal-joins-cheatsheet', env.CONFIRM_SECRET);

    vi.stubGlobal('fetch', buildFetchMock([
      {
        match: (url, opts) => opts?.method === 'POST' && url.endsWith('/subscribers'),
        response: { data: senderSubscriber({ email: 'user@example.com', email_verified: 'yes' }) },
      },
    ]));

    const req = makeConfirmRequest(token);
    const res = await handleConfirm(req, env);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('/thank-you/temporal-joins-cheatsheet/');
  });

  // --- Valid token with unknown lead magnet (no incentive URL) ---

  it('redirects to generic confirmed page for unknown lead magnet', async () => {
    const token = await generateConfirmToken('user@example.com', 'unknown-magnet', env.CONFIRM_SECRET);

    vi.stubGlobal('fetch', buildFetchMock([
      {
        match: (url, opts) => opts?.method === 'POST' && url.endsWith('/subscribers'),
        response: { data: senderSubscriber({ email: 'user@example.com', email_verified: 'yes' }) },
      },
    ]));

    const req = makeConfirmRequest(token);
    const res = await handleConfirm(req, env);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(`${CANONICAL_SITE_URL}/thank-you/confirmed/`);
  });

  // --- Sender.net update failure ---

  it('returns 400 HTML error when Sender.net update fails', async () => {
    const token = await generateConfirmToken('user@example.com', '', env.CONFIRM_SECRET);

    vi.stubGlobal('fetch', buildFetchMock([
      {
        match: (url, opts) => opts?.method === 'POST' && url.endsWith('/subscribers'),
        response: { message: 'Internal error' },
        status: 500,
      },
    ]));

    const req = makeConfirmRequest(token);
    const res = await handleConfirm(req, env);
    expect(res.status).toBe(400);
    const html = await res.text();
    expect(html).toContain('Something went wrong');
  });

  // --- Confirm sets correct fields ---

  it('sends correct fields to Sender.net on confirm', async () => {
    const token = await generateConfirmToken('user@example.com', 'temporal-joins-cheatsheet', env.CONFIRM_SECRET);

    let capturedBody;
    vi.stubGlobal('fetch', async (url, opts) => {
      if (opts?.method === 'POST') {
        capturedBody = JSON.parse(opts.body);
        return new Response(JSON.stringify({ data: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });

    const req = makeConfirmRequest(token);
    await handleConfirm(req, env);

    expect(capturedBody.email).toBe('user@example.com');
    expect(capturedBody.fields.email_verified).toBe('yes');
    expect(capturedBody.fields.confirmation_url).toBe('');
    expect(capturedBody.fields.send_incentive).toBeUndefined();
    expect(capturedBody.trigger_automation).toBe(true);
  });
});
