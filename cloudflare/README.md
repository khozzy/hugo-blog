# Cloudflare Workers

Cloudflare Workers for kozlov.ski blog infrastructure.

## Workers

### sender-subscribe-proxy

Secure proxy for Sender.net newsletter subscriptions with self-built double opt-in. Keeps API tokens server-side while allowing form submissions from the blog.

#### `POST /subscribe`

**Payload:**

```json
{
  "email": "user@example.com",
  "lead_magnet": "optional-lead-magnet-id",
  "page_url": "https://kozlov.ski/post-slug"
}
```

**Subscription flows:**

- **New subscriber**: Creates subscriber with `email_verified: "no"` and a signed `confirmation_url` → Sender.net automation sends "Confirm your email" → returns `pending_verification` (no redirect, inline message shown).
- **Existing verified subscriber** (with new lead magnet): Appends to `lead_magnets` field → redirects to incentive page.
- **Existing verified subscriber** (no lead magnet): Returns "already subscribed" with redirect to `/thank-you/`.
- **Existing unverified subscriber**: Generates fresh confirmation token, updates `confirmation_url` (triggers resend automation) → returns `pending_verification`.

#### `GET /confirm?token=<token>`

Validates the HMAC-signed confirmation token, marks the subscriber as verified, and redirects:

- **Valid token, has lead magnet**: Sets `email_verified=yes` → redirects to incentive thank-you page.
- **Valid token, no lead magnet**: Sets `email_verified=yes` → redirects to `/thank-you/confirmed/`.
- **Already verified**: Idempotent redirect to appropriate page.
- **Invalid/expired token**: Returns an HTML error page.

## Sender.net Setup

1. Create account at [sender.net](https://www.sender.net/)
2. Generate API token: Settings → API access tokens
3. Create 3 custom fields:
   - `lead_magnets` (Text) — comma-separated history of all incentives
   - `email_verified` (Text) — `"yes"` / `"no"`, tracks double opt-in status
   - `confirmation_url` (Text) — merge tag for confirmation email link
4. Create group: "Newsletter"
5. Set up automations (see below)

### Automations

**Automation 1 — Confirm email (new subscriber):**
- Trigger: "Subscriber added to group" → Newsletter
- Condition: `email_verified` = `"no"`
- Action: Send email with `{$confirmation_url}` button ("Confirm your email")

**Automation 2 — Resend confirmation:**
- Trigger: "Subscriber field updated" → `confirmation_url`
- Condition: `email_verified` = `"no"` AND `confirmation_url` non-empty
- Action: Send confirmation email with `{$confirmation_url}` button

## Security

- **HMAC-SHA256 tokens** with 48h expiry — unforgeable without `CONFIRM_SECRET`
- **Token replay is harmless** — already-verified check makes confirmation idempotent
- **Same response for new + unverified-existing** prevents email enumeration
- Generate secret: `openssl rand -base64 32`

## Local Development

```bash
cp .dev.vars.example .dev.vars
npm i

# Development server
npm run dev

# Login to Cloudflare
wrangler login

# CloudFlare deploy
npm run deploy

# Set production secrets (SENDER_API_TOKEN + CONFIRM_SECRET)
npm run deploy:secrets

# Logs
npm run tail
```

Update Hugo `config.toml` with your worker URL:

```toml
[params.subscribe]
workerUrl = "https://sender-subscribe-proxy.YOUR-SUBDOMAIN.workers.dev/subscribe"
```

### Testing the API

Test the subscription endpoint:

```bash
# New subscriber with lead magnet
curl -X POST https://api.kozlov.ski/subscribe \
  -H "Content-Type: application/json" \
  -H "Origin: https://kozlov.ski" \
  -d '{
    "email": "khozzy+20@gmail.com",
    "lead_magnet": "temporal-joins-cheatsheet"
  }'

# Expected response (new subscriber — pending verification):
# {
#   "success": true,
#   "message": "Almost there! Check your inbox and click the confirmation link...",
#   "status": "pending_verification"
# }

# Expected response (existing verified subscriber with lead magnet):
# {
#   "success": true,
#   "message": "Welcome back! Your download is ready.",
#   "redirect_url": "https://kozlov.ski/thank-you/temporal-joins-cheatsheet/",
#   "status": "existing"
# }
```

```bash
# Newsletter only (no lead magnet)
curl -X POST https://api.kozlov.ski/subscribe \
  -H "Content-Type: application/json" \
  -H "Origin: https://kozlov.ski" \
  -d '{
    "email": "khozzy+n1@gmail.com"
  }'
```