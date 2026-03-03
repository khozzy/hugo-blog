const TOKEN_EXPIRY_MS = 48 * 60 * 60 * 1000; // 48 hours

export function base64urlEncode(bytes) {
  const binString = Array.from(new Uint8Array(bytes), (b) => String.fromCharCode(b)).join('');
  return btoa(binString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (str.length % 4)) % 4);
  const binString = atob(padded);
  return Uint8Array.from(binString, (c) => c.charCodeAt(0));
}

async function getHmacKey(secret) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function hmacSign(payload, secret) {
  const key = await getHmacKey(secret);
  const enc = new TextEncoder();
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return base64urlEncode(sig);
}

async function hmacVerify(payload, signature, secret) {
  const key = await getHmacKey(secret);
  const enc = new TextEncoder();
  const sigBytes = base64urlDecode(signature);
  return crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(payload));
}

export async function generateConfirmToken(email, leadMagnet, secret) {
  const payload = JSON.stringify({
    email,
    lead_magnet: leadMagnet || '',
    exp: Date.now() + TOKEN_EXPIRY_MS,
  });
  const encodedPayload = base64urlEncode(new TextEncoder().encode(payload));
  const signature = await hmacSign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export async function validateConfirmToken(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;

  const valid = await hmacVerify(encodedPayload, signature, secret);
  if (!valid) return null;

  try {
    const json = JSON.parse(new TextDecoder().decode(base64urlDecode(encodedPayload)));
    if (!json.email || !json.exp) return null;
    if (Date.now() > json.exp) return null;
    return { email: json.email, leadMagnet: json.lead_magnet || '' };
  } catch {
    return null;
  }
}
