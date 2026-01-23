# Future Content Ideas

- Data Model For User Growth Analytics (growth accounting)
  - https://github.com/DataExpert-io/data-engineer-handbook/blob/main/intermediate-bootcamp/materials/4-applying-analytical-patterns/lecture-lab/growth_accounting.sql
- Structuring multi-tenant dbt projects
- Unified Star Schema modelling explained
- Zach Wilson excerpts
- User Segmentation


## Analytics

  Link Analytics Services

  Dub.co

  Modern link management, developer-friendly.

  - Features: Custom domains, click analytics, QR codes, API
  - ETL-friendly: REST API, webhooks for click events, CSV export
  - Gating: No native gating, but can redirect through your own form first
  - Pricing: Free tier (1k links, 1k clicks/mo), $24/mo for more
  - API example:
  curl https://api.dub.co/links/stats?linkId=xxx \
    -H "Authorization: Bearer $DUB_API_KEY"

  Short.io

  Solid analytics, good API.

  - Features: Custom domains, detailed click stats (geo, device, referrer)
  - ETL-friendly: REST API, webhooks, bulk export
  - Pricing: Free (1k links), $19/mo for API access
  - Data: Clicks with timestamp, IP (hashed), user agent, referrer

  Rebrandly

  Enterprise-ish but has good data access.

  - Features: Link tracking, UTM builder, workspaces
  - ETL-friendly: API, webhooks, integrations (Zapier)
  - Pricing: Free tier limited, $29/mo for API

  ---
  Gated Delivery Platforms

  These actually gate content (email required before download):

  Gumroad

  $0 products = free lead magnets with email capture.

  - Features: Email gate, payment processing, audience management
  - ETL-friendly: API, webhooks for purchases/signups, CSV export
  - Data available: Email, name, timestamp, IP, custom fields
  - Webhook payload:
  {
    "email": "user@example.com",
    "product_id": "xxx",
    "created_at": "2024-01-15T10:30:00Z",
    "ip_country": "US"
  }

  Lemon Squeezy

  Modern Gumroad alternative, better DX.

  - Features: Digital delivery, email capture, subscriptions
  - ETL-friendly: REST API, webhooks, good docs
  - Pricing: 5% + 50¢ per transaction (free for $0 products)

  SendOwl

  Focused purely on digital delivery.

  - Features: PDF stamping, drip delivery, email gates
  - ETL-friendly: API, webhooks, Zapier
  - Pricing: $9/mo starter

  ---
  Developer-First Options

  Cloudflare R2 + Workers

  Build exactly what you need.

  User clicks link
    → Worker logs event to D1/Analytics Engine
    → Returns signed R2 URL (expires in 5 min)

  - ETL-friendly: You own the data, query via API or direct DB access
  - Cost: Essentially free at your scale
  - Effort: Few hours to build, full control forever

  Vercel + Edge Middleware

  Similar pattern, different stack.

  // middleware.ts
  export function middleware(request: Request) {
    await logDownload(request) // to Postgres, Tinybird, etc.
    return NextResponse.redirect(signedS3Url)
  }

  ---
  Analytics Warehouses (the ETL destination)

  Where to centralize the data:
  ┌────────────┬──────────────────┬────────────┬────────────────────┐
  │  Service   │    Ingestion     │   Query    │        Cost        │
  ├────────────┼──────────────────┼────────────┼────────────────────┤
  │ Tinybird   │ HTTP API, Kafka  │ SQL API    │ Free tier generous │
  ├────────────┼──────────────────┼────────────┼────────────────────┤
  │ Motherduck │ Direct, S3       │ DuckDB SQL │ Free tier          │
  ├────────────┼──────────────────┼────────────┼────────────────────┤
  │ Supabase   │ REST, webhooks   │ Postgres   │ Free tier          │
  ├────────────┼──────────────────┼────────────┼────────────────────┤
  │ BigQuery   │ Streaming, batch │ SQL        │ Free 1TB/mo        │
  └────────────┴──────────────────┴────────────┴────────────────────┘
  ---
  Recommended Stack for Your Stage

  Simple (now):
  Dub.co (tracking) + Gumroad (gating)
           ↓ webhooks
        Tinybird or Supabase
           ↓ query when needed
        Your analysis

  Custom (later):
  Your form → captures email → sends to Beehiiv
           → logs to Supabase
           → redirects to R2 signed URL
           → R2 Worker logs download completion

  ---
  Data Schema to Plan For

  Whatever you choose, structure for this:

  downloads (
    id,
    email,
    incentive_slug,      -- 'mautic-deployment-guide'
    source,              -- 'linkedin', 'organic', 'newsletter'
    utm_campaign,
    downloaded_at,
    ip_country,
    user_agent
  )

  This lets you answer: "Which incentive converts best from LinkedIn?" or "What's my download rate by traffic source?"

  ---
  Want me to detail the Dub.co + Gumroad setup, or sketch out the custom R2 Worker approach?


    Cleanest path:
  Blog post → CTA "Get the guide"
      ↓
  Gumroad ($0 product) → captures email, delivers PDF
      ↓
  Zapier/webhook → adds to Beehiiv with tag "mautic-guide"
      ↓
  Beehiiv automation → welcome sequence

  You get: gated downloads with analytics (Gumroad), proper email marketing (Beehiiv), data sync between them.