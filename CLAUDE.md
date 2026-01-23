# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal blog at kozlov.ski built with Hugo. The blog focuses on data engineering, data science, and software development topics. The author is transitioning from Data Engineering contractor to Content Creator by building audience, creating content, and eventually launching a product.

## Mission

1. Create timeless content establishing authority in data engineering
2. Grow engaged audience of senior engineers
3. Identify and validate product opportunities
4. Develop recognizable personal brand

## Positioning

**Niche**: Engineering First Principles Applied to Data

**Value proposition**: Depth that helps engineers make better architectural decisions, leaders justify technical choices, and senior ICs develop Staff/Principal-level thinking.

## Target Persona: "The Stuck Senior"

Senior/Lead Engineer (5-10+ years) working with data (pipelines, warehouses, platforms).

**Pain points**:

- Drowning in complexity and technical debt
- Unclear path Senior → Staff/Principal
- Can't articulate decisions to leadership
- Feels like "just coding" without strategic impact

**Needs**: Mental models for complexity, vocabulary for technical decisions, frameworks for architectural choices, validation that their experience matters.

**Channels**: LinkedIn (primary), Tech Twitter/X, Hacker News, company Slack, engineering blogs.

## My Unfair Advantages

Use these to differentiate from generic content:

- 15 years Software Engineering (Python, Java, TypeScript, Infra, CI/CD) → real examples, nuanced takes
- Ph.D. in AI → academic rigor, credibility
- Team leadership + C-level communication → bridge technical/business language
- Current data engineering work → fresh, real-world problems

## Content Guidelines

### Do

- Push for specificity and concrete examples
- Apply "Lindy test" - will this matter in 5 years?
- Look for contrarian angles on common advice
- Suggest patience - this is a long game
- Flag drift from core positioning

### Don't

- Write generic content applicable to any field
- Use hollow engagement bait
- Prioritize virality over reputation
- Recommend inauthentic tactics

## Platforms

- **Blog**: https://kozlov.ski (Hugo)
- **Email**: Beehiiv newsletter
- **Social**: LinkedIn (primary)
- **Existing posts**: See `content/posts` directory

## Strategy

- Each long-form blog posts can yield 5-10 short-form pieces: key insights, contrarian takes, "one thing I learned" threads
- Short-form content is posted on Linkedin and X, gets user attention and drives traffic to long-form version
- Each short-form post should either
  a. drive traffic to your long-form (build email list),
  b. test an idea for future long-form,
  c. build relationship with target persona

## Analytics (in progress)

### Metrics to Track

**Leading**: Post engagement, blog traffic, subscriber growth, comment quality
**Lagging**: Inbound opportunities, DMs from target audience, brand recognition

## Workflows

### Content Ideation

1. Start with persona pain points
2. Apply Lindy test
3. Find contrarian angle
4. Connect to trends (if authentic)
5. Suggest repurposing across formats

### Strategy Review

1. Ask about recent engagement data
2. Identify patterns - what resonates?
3. Suggest experiments
4. Challenge assumptions
5. Prioritize audience trust over quick wins

## Development Commands

Assume the server is always running

```bash
# Start development server with drafts
just dev
# Or directly:
hugo serve --disableFastRender --buildDrafts --gc

# Production build (used by GitHub Actions)
hugo --gc --minify

# Build all incentive PDFs + asset bundles
just incentives

# Build a single incentive PDF + asset bundle
just incentive <name>
```

## Content Structure

Posts are organized in `content/posts/` with year-based subdirectories (2024/, 2025/). Each post is a page bundle with its own directory containing `index.md` and associated assets (images, JSON data files).

### Post Front Matter

```yaml
---
title: "Post Title"
slug: post-url-slug # Used for permalink (configured as :slug)
date: 2024-09-30T08:00:00+01:00
author: Norbert
draft: true # Is a post a draft
summary: "Brief description"
params:
  toc: true # Table of contents
  plotly: true # Enable Plotly.js for charts
tags:
  - Tag Name
---
```

## Incentives (Lead Magnets)

Lead magnets are managed as standalone products in the `incentives/` directory, built as PDFs, and distributed via Gumroad.

### Structure

```
incentives/
└── <product-slug>/
    ├── content.md       # Source markdown for the PDF
    └── assets/          # Images, config files bundled with the guide

dist/incentives/                    # Build outputs (gitignored)
├── <product-slug>.pdf              # Main PDF guide
└── <product-slug>-assets.zip       # Asset bundle (if assets/ exists)
```

### Distribution Workflow

1. Create/edit `incentives/<product>/content.md`
2. Run `just incentive <product>` to build PDF + asset bundle
3. Upload to Gumroad as $0 product:
   - PDF (primary deliverable)
   - Asset zip (if generated - contains config files, etc.)
4. Use gumroad shortcode in blog post with the Gumroad URL
5. Gumroad captures email on download → webhook syncs to Beehiiv

### PDF Styling

Shared CSS for PDF generation: `assets/pdf/kozlovski-pdf.css`

### Build Script

The `scripts/build_incentive.py` script builds PDFs from markdown content.

**Pipeline**: `content.md` → pandoc/extra (Docker) → temp.html → weasyprint (Docker) → output.pdf

**Features**:
- Converts markdown to PDF via Docker containers (pandoc + weasyprint)
- Zips assets directory if present

## Custom Hugo Shortcodes

Located in `layouts/shortcodes/`:

- **plotly**: Embeds Plotly.js charts from JSON files
  ```
  {{< plotly json="plots/chart.json" height="400px" >}}
  ```
- **audio**: Embeds audio player (uses Plyr.js)
  ```
  {{< audio src="https://..." caption="Description" >}}
  ```
- **rawhtml**: Renders raw HTML content
- **gumroad**: CTA block linking to Gumroad product (for lead magnets)
  ```
  {{< gumroad
      url="https://yourname.gumroad.com/l/product"
      headline="Get the Guide"
      description="Step-by-step checklist."
      button="Download Free"
  >}}
  ```
- **subscribe**: Inline email capture form (Beehiiv integration)

## Layout Customizations

The theme is extended via `layouts/`:

- `layouts/posts/single.html`: Custom post template with Beehiiv newsletter embed
- `layouts/partials/assets.html`: Asset loading customizations
- `layouts/partials/head/`: Head section customizations

## Theme

Uses LoveIt theme as a git submodule in `themes/LoveIt/`. Initialize with:

```bash
git submodule update --init --recursive
```

## Deployment

Automatic deployment to GitHub Pages via `.github/workflows/hugo.yml` on push to main branch. Uses Hugo Extended v0.135.0.
