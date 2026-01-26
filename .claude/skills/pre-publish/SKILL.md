---
name: pre-publish
description: |
  Pre-publish checklist for blog posts before going live.
  Use when: (1) a post is ready to publish (draft: false), (2) user mentions "publish", "go live",
  "pre-publish check", or "ready to ship", (3) reviewing a post before removing draft status.

  Validates frontmatter, SEO, Gumroad/subscribe shortcodes, and content structure.
---

# Pre-Publish Checklist

Run this checklist before publishing any blog post.

## Workflow

1. Read the post file from `content/posts/`
2. Run each check below
3. Output results as a checklist with pass/fail status
4. List specific issues to fix

## Checklist

### Frontmatter (Required)

```yaml
---
title: "Full Title Here"           # Required, descriptive
slug: url-friendly-slug            # Required, kebab-case, used in permalink
date: 2025-01-26T08:00:00+01:00    # Required, ISO format with timezone
author: Norbert                    # Required
draft: false                       # Must be false for publishing
summary: "1-2 sentence hook"       # Required for SEO/social cards
params:
  toc: true                        # Optional, enable for long posts
  plotly: true                     # Only if using plotly shortcode
  subscribe:
    enable: false                  # Usually false (uses inline CTAs instead)
tags:
  - Data Engineering               # At least one tag required
---
```

**Check each field:**
- [ ] `title` - Present, descriptive, no trailing punctuation
- [ ] `slug` - Present, kebab-case, concise
- [ ] `date` - Present, valid ISO format, not in the future
- [ ] `author` - Present (should be "Norbert")
- [ ] `draft` - Set to `false`
- [ ] `summary` - Present, 1-2 sentences, hooks the reader
- [ ] `tags` - At least one tag present

### SEO / Discoverability

- [ ] **Title length**: 50-60 characters optimal for search results
- [ ] **Summary**: Acts as meta description, 150-160 chars optimal
- [ ] **Slug**: Contains target keyword, no stop words
- [ ] **No emojis in title/summary**: Keep professional for SEO

### Lead Magnet Integration

Check for monetization/list-building shortcodes:

**Option A: `subscribe` shortcode (Beehiiv)**
```hugo
{{< subscribe
  headline="Get the Cheatsheet"
  description="One-page reference for X"
  campaign="post-slug"
  lead_magnet="descriptive-id"
  button="Send it"
>}}
```

**Option B: `gumroad` shortcode (Gumroad product)**
```hugo
{{< gumroad
  url="https://nkozlovski.gumroad.com/l/PRODUCT"
  headline="Get the Guide"
  description="What they receive and why it's useful"
  button="Download Free"
>}}
```

**Checks:**
- [ ] At least one CTA present (subscribe or gumroad)
- [ ] CTA placed mid-post AND/OR end-of-post
- [ ] `campaign` matches post slug (for subscribe)
- [ ] `lead_magnet` ID is descriptive and unique (for subscribe)
- [ ] Gumroad `url` is valid and product exists (for gumroad)
- [ ] Headline is specific, not generic ("Get it" → bad)

### Content Structure

- [ ] **Opening hook**: First paragraph addresses persona pain point
- [ ] **No orphaned shortcodes**: All `{{< ... >}}` properly closed
- [ ] **Images have captions**: `{{< figure src="..." caption="..." >}}`
- [ ] **Code blocks have language**: ` ```sql ` not ` ``` `
- [ ] **No broken links**: Internal links use relative paths
- [ ] **Admonitions closed**: `{{< admonition >}}...{{< /admonition >}}`
- [ ] **Incentive leakage**: No incentive links or references are accessible in the content.

### Pre-Publish Actions

If incentive exists in `incentives/<name>/`:
- [ ] Incentive PDF built (`just incentive <name>`)
- [ ] Gumroad product created and URL correct
- [ ] Product is set to $0 (for free lead magnets)

### Final Verification

```bash
# Preview locally with drafts disabled
hugo serve --disableFastRender --gc

# Check the post renders at expected URL
# http://localhost:1313/<slug>/
```

## Output Format

```
## Pre-Publish Check: [Post Title]

### Frontmatter
- [x] title: "Activity Schema: The Data Model..."
- [x] slug: activity-schema
- [ ] draft: **still true** → set to false
...

### SEO
- [x] Title length: 52 chars (optimal)
- [ ] Summary length: 203 chars → trim to ~160

### Lead Magnets
- [x] subscribe shortcode at line 117
- [x] subscribe shortcode at line 327
- [ ] Missing Gumroad product link (if incentive exists)

### Issues to Fix
1. Set `draft: false` in frontmatter
2. Trim summary to 160 chars
3. Create Gumroad product for temporal-joins-cheatsheet

### Ready to Publish: NO
```
