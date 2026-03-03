/**
 * Cloudflare Worker for Sender.net Newsletter Subscription
 *
 * Secure proxy to the Sender.net API — keeps the API token server-side
 * while allowing form submissions from the blog.
 *
 * Implements self-built double opt-in: new subscribers receive a
 * cryptographically signed confirmation link via Sender.net automation.
 *
 * Environment variables (wrangler secret): SENDER_API_TOKEN, CONFIRM_SECRET
 * Environment variables (wrangler.toml):   ALLOWED_ORIGINS, SENDER_GROUP_ID
 */

import { generateConfirmToken, validateConfirmToken } from './crypto.js';
import { senderFetch, resolveSubscriber, updateSubscriberFields } from './sender.js';

export const CANONICAL_SITE_URL = 'https://kozlov.ski';
const CONFIRM_BASE_URL = 'https://api.kozlov.ski/confirm';

const INCENTIVE_URLS = {
  'temporal-joins-cheatsheet': `${CANONICAL_SITE_URL}/thank-you/temporal-joins-cheatsheet/`,
  'mautic-deployment-guide': `${CANONICAL_SITE_URL}/thank-you/mautic-deployment-guide/`,
  'demand-forecast-eda': `${CANONICAL_SITE_URL}/thank-you/demand-forecast-eda/`,
};

function errorPage(message) {
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Confirmation Error</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f9fafb}
.card{max-width:420px;padding:2rem;text-align:center;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
h1{font-size:1.25rem;color:#991b1b}p{color:#6b7280;line-height:1.6}
a{color:#2563eb;text-decoration:none}a:hover{text-decoration:underline}</style>
</head><body><div class="card"><h1>Confirmation Failed</h1><p>${message}</p>
<p><a href="${CANONICAL_SITE_URL}">Back to kozlov.ski</a></p></div></body></html>`;
  return new Response(html, {
    status: 400,
    headers: { 'Content-Type': 'text/html;charset=utf-8' },
  });
}

export function corsHeaders(origin, allowedOrigins) {
  const allowed = new Set(allowedOrigins.split(',').map((s) => s.trim()));
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  if (allowed.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return { headers, originAllowed: allowed.has(origin) };
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function handleOptions(request, env) {
  const origin = request.headers.get('Origin');
  const { headers } = corsHeaders(origin, env.ALLOWED_ORIGINS);
  return new Response(null, { status: 204, headers });
}

export async function handleSubscribe(request, env) {
  const origin = request.headers.get('Origin');
  const { headers: cors, originAllowed } = corsHeaders(origin, env.ALLOWED_ORIGINS);
  const json = (body) => new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', ...cors },
  });
  const jsonError = (error, status) => new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });

  if (!originAllowed) {
    return jsonError('Origin not allowed', 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const { email, lead_magnet } = body;

  if (!email || !isValidEmail(email)) {
    return jsonError('Invalid email address', 400);
  }

  const incentiveUrl = INCENTIVE_URLS[lead_magnet] || '';

  try {
    const { fields, isExistingUnverified } = await resolveSubscriber(email, env);
    const isVerified = fields.email_verified === 'yes';

    if (isExistingUnverified) {
      return json({
        success: true,
        message: "You've already signed up! Please check your inbox (and spam folder) for the confirmation email.",
        redirect_url: `${CANONICAL_SITE_URL}/thank-you/`,
        status: 'existing_unverified',
      });
    }

    if (!isVerified) {
      const confirmToken = await generateConfirmToken(email, lead_magnet, env.CONFIRM_SECRET);
      const confirmUrl = `${CONFIRM_BASE_URL}?token=${confirmToken}`;

      const { ok: createOk, status: createStatus, data: createResult } = await senderFetch('/subscribers', env, {
        method: 'POST',
        body: {
          email,
          groups: [env.SENDER_GROUP_ID],
          trigger_automation: true,
          fields: {
            email_verified: 'no',
            confirmation_url: confirmUrl,
            ...(lead_magnet && { lead_magnets: lead_magnet }),
          },
        },
      });

      if (!createOk) {
        const error = createResult?.message
          || (createResult?.errors && Object.values(createResult.errors).flat()[0])
          || 'Subscription failed';
        console.error('Sender.net API error:', createResult);
        return jsonError(error, createStatus);
      }

      return json({
        success: true,
        message: 'Almost there! Check your inbox and click the confirmation link to complete your subscription.',
        redirect_url: `${CANONICAL_SITE_URL}/thank-you/`,
        status: 'pending_verification',
      });
    }

    if (lead_magnet) {
      const existing = (fields.lead_magnets || '').split(',').map((s) => s.trim()).filter((m) => m !== lead_magnet);
      existing.push(lead_magnet);

      await updateSubscriberFields(email, {
        lead_magnets: existing.join(','),
      }, env);

      return json({
        success: true,
        message: 'Welcome back! Your download is ready.',
        redirect_url: incentiveUrl || `${CANONICAL_SITE_URL}/thank-you/`,
        status: 'existing',
      });
    }

    return json({
      success: true,
      message: "You're already subscribed!",
      redirect_url: `${CANONICAL_SITE_URL}/thank-you/`,
      status: 'existing',
    });
  } catch (error) {
    console.error('Worker error:', error);
    return jsonError('An error occurred. Please try again.', 500);
  }
}

export async function handleConfirm(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return errorPage('Missing confirmation token. Please use the link from your email.');
  }

  const result = await validateConfirmToken(token, env.CONFIRM_SECRET);
  if (!result) {
    return errorPage('This confirmation link is invalid or has expired. Please subscribe again to receive a new link.');
  }

  const { email, leadMagnet } = result;
  const incentiveUrl = INCENTIVE_URLS[leadMagnet] || '';

  try {
    const confirmFields = {
      email_verified: 'yes',
      confirmation_url: '',
    };

    console.log('Sender.net confirm:', { email, leadMagnet, fields: confirmFields });

    const { ok: confirmOk, result: confirmResult } = await updateSubscriberFields(email, confirmFields, env);

    if (!confirmOk) {
      console.error('Sender.net update error on confirm:', confirmResult);
      return errorPage('Something went wrong confirming your email. Please try again.');
    }

    const redirectUrl = incentiveUrl || `${CANONICAL_SITE_URL}/thank-you/confirmed/`;
    return Response.redirect(redirectUrl, 302);
  } catch (error) {
    console.error('Confirm handler error:', error);
    return errorPage('An unexpected error occurred. Please try again.');
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/confirm' && request.method === 'GET') {
      return handleConfirm(request, env);
    }

    if (url.pathname === '/subscribe') {
      if (request.method === 'OPTIONS') {
        return handleOptions(request, env);
      }
      if (request.method === 'POST') {
        return handleSubscribe(request, env);
      }
      return new Response('Method Not Allowed', { status: 405 });
    }

    return new Response('Not Found', { status: 404 });
  },
};
