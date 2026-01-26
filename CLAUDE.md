# CLAUDE.md

## Project: Data Engineering Blog (kozlov.ski)
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

## Platforms I Use

- **Blog**: https://kozlov.ski (Hugo)
- Gumroad (monetization, incentive distribution), Beehiiv (optional newsletter)
- LinkedIn (primary), X - social distribution

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

## Workflows

### Strategy

- Each long-form blog posts can yield 5-10 short-form pieces: key insights, contrarian takes, "one thing I learned" threads
- Short-form content is posted on Linkedin and X, gets user attention and drives traffic to long-form version
- Each short-form post should either
  a. drive traffic to your long-form (build email list),
  b. test an idea for future long-form,
  c. build relationship with target persona

### Content Ideation

1. Start with persona pain points
2. Apply Lindy test
3. Find contrarian angle
4. Connect to trends (if authentic)
5. Suggest repurposing across formats


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

## Others
- Existing posts are located in `content/posts` directory.
- The theme is extended via `layouts/` directory.
- Automatic deployment to GitHub Pages via `.github/workflows/hugo.yml` on push to main branch. Uses Hugo Extended v0.135.0.
