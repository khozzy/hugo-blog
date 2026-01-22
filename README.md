# Kozlov.ski Blog

Tag line: "Help Developers to get results with data products"

## Development mode

    git submodule add https://github.com/dillonzq/LoveIt.git themes/LoveIt

## Using the Subscribe Shortcode

In any post, you can add a custom subscribe form:

```markdown
{{</* subscribe
  headline="Get the Iceberg Migration Checklist"
  description="12 steps I use for every migration"
  campaign="iceberg-checklist"
  lead_magnet="iceberg-checklist"
  button="Get the Checklist"
*/>}}
```

Format it in a single line to prevent formatting issues.

## Per-Post Configuration

Override defaults in post front matter:

```yaml
params:
  subscribe:
    headline: "Get the companion checklist"
    description: "Download the PDF with all steps"
    campaign: "my-campaign"
    lead_magnet: "my-lead-magnet"
    button: "Download"
```

To disable the subscribe form on a specific post:

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
