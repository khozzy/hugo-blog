export const SENDER_API_URL = 'https://api.sender.net/v2';

export const SENDER_COLUMN_MAP = {
  'Lead magnets': 'lead_magnets',
  'Email verified': 'email_verified',
  'Confirmation URL': 'confirmation_url',
};

// Parse Sender.net columns array into {key: value} using SENDER_COLUMN_MAP
export function parseSubscriberFields(subscriber) {
  if (Array.isArray(subscriber?.columns)) {
    const fields = {};
    for (const col of subscriber.columns) {
      const rawKey = col.title || col.name || col.key;
      if (rawKey && col.value !== undefined) {
        const key = SENDER_COLUMN_MAP[rawKey] || rawKey.toLowerCase().replace(/\s+/g, '_');
        fields[key] = col.value ?? '';
      }
    }
    return fields;
  }
  if (subscriber?.fields && typeof subscriber.fields === 'object' && !Array.isArray(subscriber.fields)) {
    return { ...subscriber.fields };
  }
  return {};
}

// Shared Sender.net API fetch helper
export async function senderFetch(path, env, { method = 'GET', body } = {}) {
  const headers = { Authorization: `Bearer ${env.SENDER_API_TOKEN}`, Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${SENDER_API_URL}${path}`, {
    method, headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function fetchSubscriberById(id, env) {
  const { ok, data } = await senderFetch(`/subscribers/${id}`, env);
  return ok ? (data?.data || null) : null;
}

export async function updateSubscriberFields(email, fields, env) {
  const { ok, status, data } = await senderFetch('/subscribers', env, {
    method: 'POST',
    body: { email, fields, groups: [env.SENDER_GROUP_ID], trigger_automation: true },
  });
  const accepted = ok || status === 422;
  return { ok: accepted, result: data };
}

// Resolve subscriber state via GET search.
// Returns { fields }.
export async function resolveSubscriber(email, env) {
  const { data: getResult } = await senderFetch(`/subscribers?email=${encodeURIComponent(email)}`, env);
  const matched = getResult?.data?.find((s) => s.email === email) || null;

  if (matched?.id) {
    const subscriber = await fetchSubscriberById(matched.id, env) || matched;
    const fields = parseSubscriberFields(subscriber);
    console.log('Sender.net resolved via GET:', { email, id: matched.id, fields });
    return { fields };
  }

  console.log('Sender.net subscriber not found:', { email });
  return { fields: {} };
}
