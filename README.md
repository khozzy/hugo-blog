# Kozlov.ski Blog

Tag line: "Help Developers to get results with data products"

## Development mode

    git submodule add https://github.com/dillonzq/LoveIt.git themes/LoveIt

## Incentives (Lead Magnets)

Lead magnets are PDFs built from markdown and distributed via Gumroad.

### Building Gumroad Bundles

```bash
just incentives                    # Build all
just incentive <product-slug>      # Build one
```

### Structure

```
incentives/<product-slug>/
├── content.md      # PDF source
└── assets/         # Bundled files

dist/incentives/    # Output (gitignored)
```

### Using the Gumroad Shortcode

Link to a Gumroad product in blog posts:

```markdown
{{</* gumroad
  url="https://yourname.gumroad.com/l/product"
  headline="Get the Guide"
  description="Step-by-step checklist."
  button="Download Free"
*/>}}
```

### Workflow

1. Create `incentives/<slug>/content.md`
2. Build: `just incentive <slug>`
3. Upload PDF to Gumroad ($0 product)
4. Add shortcode to blog post with Gumroad URL
5. Gumroad → Beehiiv webhook syncs subscribers

## Subscribe Shortcode (Email Capture)

For inline email capture without a lead magnet:

```markdown
{{</* subscribe
  headline="Stay updated"
  description="Join engineers who get deep-dives on data architecture."
  campaign="newsletter"
  button="Subscribe"
*/>}}
```

To disable the end-of-post subscribe form:

```yaml
params:
  subscribe:
    enable: false
```

# TODO:

- Tagline
- Blog name
- Content review skill (roast, gaps)
- Blog pages and general layout
- SEO expert
