# Cloudflare Workers

Cloudflare Workers for kozlov.ski blog infrastructure.

## Workers

### beehiiv-subscribe-proxy

Secure proxy for Beehiiv newsletter subscriptions. Keeps API keys server-side while allowing form submissions from the blog.

**Endpoint:** `POST /subscribe`

**Payload:**

```json
{
  "email": "user@example.com",
  "campaign": "optional-campaign-name",
  "lead_magnet": "optional-lead-magnet-id",
  "page_url": "https://kozlov.ski/post-slug"
}
```

## Local Development

```bash
cp .dev.vars.example .dev.vars
npm install

# Development server
npm run dev

# Login to Cloudflare
wrangler login

# Set production secrets
npm run secret:api-key
npm run secret:pub-id

# CloudFlare deploy
npm run deploy

# Logs
npm run tail
```

Update Hugo `config.toml` with your worker URL:

```toml
[params.subscribe]
workerUrl = "https://beehiiv-subscribe-proxy.YOUR-SUBDOMAIN.workers.dev/subscribe"
```

## Cloudflare Worker (Newsletter API Proxy)

The newsletter subscription form uses a Cloudflare Worker to securely proxy requests to Beehiiv API.

### Beehiiv Setup

1. Create a custom field named `lead_magnet` in Beehiiv dashboard (Settings > Custom Fields)
2. Get your API key from Beehiiv settings
3. Note your Publication ID

### Testing the API

Test the subscription endpoint:

```bash
# Success case
curl -X POST https://beehiiv-subscribe-proxy.nkozlowski.workers.dev/subscribe \
  -H "Content-Type: application/json" \
  -H "Origin: https://kozlov.ski" \
  -d '{
    "email": "khozzy@gmail.com",
    "campaign": "test-campaign",
    "lead_magnet": "test-checklist",
    "page_url": "https://kozlov.ski/posts/testo"
  }'

# Expected response: {"success":true,"message":"Successfully subscribed!"}

# Error case (invalid email)
curl -X POST api.kozlov.ski/subscribe \
  -H "Content-Type: application/json" \
  -H "Origin: https://kozlov.ski" \
  -d '{"email": "invalid"}'

# Expected response: {"error":"Invalid email address"}
```
