/**
 * Cloudflare Worker for Beehiiv Newsletter Subscription
 *
 * This worker acts as a secure proxy to the Beehiiv API, keeping the API key
 * server-side while allowing form submissions from the blog.
 *
 * Environment variables (set via wrangler secret):
 * - BEEHIIV_API_KEY: Your Beehiiv API key
 * - BEEHIIV_PUBLICATION_ID: Your Beehiiv publication ID
 *
 * Environment variables (set in wrangler.toml):
 * - ALLOWED_ORIGINS: Comma-separated list of allowed origins
 */

const BEEHIIV_API_URL = 'https://api.beehiiv.com/v2';

/**
 * Check if the origin is allowed
 */
function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) return false;
  const origins = allowedOrigins.split(',').map((o) => o.trim());
  return origins.some((allowed) => {
    if (allowed.includes('*')) {
      const pattern = new RegExp('^' + allowed.replace(/\*/g, '.*') + '$');
      return pattern.test(origin);
    }
    return origin === allowed;
  });
}

/**
 * Create CORS headers
 */
function getCorsHeaders(origin, allowedOrigins) {
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };

  if (isOriginAllowed(origin, allowedOrigins)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

/**
 * Validate email address
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Handle OPTIONS preflight request
 */
function handleOptions(request, env) {
  const origin = request.headers.get('Origin');
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin, env.ALLOWED_ORIGINS),
  });
}

/**
 * Handle POST subscription request
 */
async function handleSubscribe(request, env) {
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin, env.ALLOWED_ORIGINS);

  // Check origin
  if (!isOriginAllowed(origin, env.ALLOWED_ORIGINS)) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const { email, campaign, lead_magnet, page_url } = body;

  // Validate email
  if (!email || !isValidEmail(email)) {
    return new Response(JSON.stringify({ error: 'Invalid email address' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // Build Beehiiv API payload
  const payload = {
    email: email,
    reactivate_existing: false,
    send_welcome_email: true,
  };

  // Add UTM parameters
  if (campaign) {
    payload.utm_source = 'website';
    payload.utm_medium = 'subscribe_form';
    payload.utm_campaign = campaign;
  }

  // Add referring URL
  if (page_url) {
    payload.referring_site = page_url;
  }

  // Add custom fields (lead_magnet)
  if (lead_magnet) {
    payload.custom_fields = [
      {
        name: 'lead_magnet',
        value: lead_magnet,
      },
    ];
  }

  // Call Beehiiv API
  try {
    const response = await fetch(
      `${BEEHIIV_API_URL}/publications/${env.BEEHIIV_PUBLICATION_ID}/subscriptions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.BEEHIIV_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();
    console.log(result);

    if (!response.ok) {
      console.error('Beehiiv API error:', result);
      return new Response(
        JSON.stringify({
          error: result.message || 'Subscription failed',
        }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Successfully subscribed!',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error) {
    console.error('Worker error:', error);
    return new Response(
      JSON.stringify({
        error: 'An error occurred. Please try again.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}

/**
 * Main request handler
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Only handle /subscribe endpoint
    if (url.pathname !== '/subscribe') {
      return new Response('Not Found', { status: 404 });
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(request, env);
    }

    // Handle subscription POST
    if (request.method === 'POST') {
      return handleSubscribe(request, env);
    }

    return new Response('Method Not Allowed', { status: 405 });
  },
};
