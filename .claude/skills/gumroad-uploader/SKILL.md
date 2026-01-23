---
name: gumroad-uploader
description: |
  Generate Gumroad product listing content for lead magnets built from the incentives/ directory.
  Use when: (1) preparing to upload a new incentive/lead magnet to Gumroad,
  (2) needing product name, description, cover image prompts, or CTA copy,
  (3) user mentions "gumroad", "upload product", or "create listing" for an incentive.

  Reads content.md and related blog post to generate brand-consistent copy.
---

# Gumroad Product Uploader

Generate Gumroad listing content for incentives/lead magnets.

## Workflow

1. **Identify the product** - Read `incentives/<product-slug>/content.md`
2. **Read related blog post** - Find the corresponding post in `content/posts/` for context
3. **Generate listing content** - Produce all fields needed for Gumroad upload

## Output Format

Generate the following for each product:

### Product Name
Short, benefit-focused title (max ~60 chars). Format: `[Topic]: [Deliverable Type]`

Example: `Mautic on Kubernetes: Deployment Checklist`

### Product Type
Select one:
- `Digital product` (default for checklists, guides, templates)
- `E-book` (for longer educational content)
- `Course or tutorial` (for video/lesson-based content)
- `Bundle` (for multiple files/resources)

### Price
- `$0` for free lead magnets (standard for email capture)
- Suggest a price only if user explicitly requests paid product

### Product Description
Write for Gumroad's product page. Structure:

```
[1-2 sentence hook addressing pain point]

**What's inside:**
- [Deliverable 1]
- [Deliverable 2]
- [Deliverable 3]

**Perfect for:** [target persona in 1 sentence]

[Optional: mention the related blog post as "companion to [title]"]
```

Keep under 500 characters for optimal display.

### Cover Image Prompt (1280x720px horizontal)
Generate an image generation prompt following this template:

```
Clean, professional tech illustration for "[Product Title]".
[2-3 visual elements representing the content].
Color palette: deep blue (#1a365d) and teal (#0d9488) accents on white/light gray background.
Modern, minimal style. No text overlay. 16:9 aspect ratio.
```
Suggest using Ideogram service for image consistency.

### Thumbnail Prompt (600x600px square)
Generate a simplified version:

```
Minimal icon-style illustration for "[Topic]".
Single [key visual element] centered.
Deep blue (#1a365d) with teal (#0d9488) accent.
Clean white background. Square format.
```

### CTA Summary (for blog integration)
Format for the gumroad shortcode:

```
Headline: [Action verb] + [Benefit] (max 8 words)
Description: [What they get] + [Outcome/benefit] (max 20 words)
Button: [Action verb] + Free (e.g., "Download Free", "Get it Free")
```

### "You'll Get..." Summary
Bullet list for Gumroad's "what's included" section:

```
- [PDF/Guide name] ([page count] pages)
- [Asset 1 description]
- [Asset 2 description]
```

## Brand Guidelines

- **Tone**: Direct, practical, no fluff. Speak to senior engineers.
- **Focus**: Emphasize time saved, complexity reduced, decisions clarified
- **Avoid**: Marketing buzzwords, hype, vague promises
- **Colors**: Deep blue (#1a365d), teal (#0d9488), clean whites/grays

## Example Output

For `mautic-deployment-guide`:

**Product Name:** Mautic 5.x on Kubernetes: Deployment Checklist

**Product Type:** Digital product

**Price:** $0

**Description:**
Skip the trial-and-error. This 22-step checklist walks you through deploying Mautic 5.x on Kubernetes from scratch.

**What's inside:**
- Step-by-step deployment checklist with verification commands
- All Helm values files (MariaDB, Mailhog, Mautic)
- Troubleshooting reference for common issues

**Perfect for:** Data engineers setting up self-hosted marketing automation.

Companion to "How to Set Up Mautic 5.x on Kubernetes" on kozlov.ski.

**Cover Image Prompt:**
Clean, professional tech illustration for "Mautic on Kubernetes Deployment".
Kubernetes wheel icon connected to database and email icons via clean lines.
Color palette: deep blue (#1a365d) and teal (#0d9488) accents on white/light gray background.
Modern, minimal style. No text overlay. 16:9 aspect ratio.

**Thumbnail Prompt:**
Minimal icon-style illustration for "Kubernetes deployment".
Single Kubernetes wheel icon centered with checkmark overlay.
Deep blue (#1a365d) with teal (#0d9488) accent.
Clean white background. Square format.

**CTA Summary:**
- Headline: Get the Deployment Checklist
- Description: 22-step checklist for Mautic on Kubernetes. From cluster setup to first API call.
- Button: Download Free

**You'll Get:**
- Deployment Guide PDF (8 pages)
- mariadb-values.yaml - Database configuration
- mailhog-values.yaml - Email testing setup
- mautic-values.yaml - Mautic Helm configuration
- Supporting ConfigMaps and services
