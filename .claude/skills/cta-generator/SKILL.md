---
name: cta-generator
description: |
  Generate high-converting subscribe form CTAs and lead magnet strategies for blog posts.
  Use when: (1) analyzing a post to suggest incentives, (2) generating CTA copy for subscribe shortcodes,
  (3) recommending content gating strategies (stripping sections as lead magnets), (4) creating
  post-specific lead_magnet identifiers for Beehiiv segmentation.
---

# CTA Generator

Generate post-specific subscribe CTAs with lead magnet strategies for the kozlov.ski blog.

## Workflow

### 1. Read the Post
Read the full post content from `content/posts/` to understand:
- Core topic and framework taught
- Sections that could be extracted as bonuses
- Code, templates, or reference material present
- Target persona pain points addressed

### 2. Identify Incentive Opportunities
Consult [references/incentive-patterns.md](references/incentive-patterns.md) to match post type to incentive strategy.

**Evaluate each option**:
- **Reference Card**: Can the post's framework fit on one page?
- **Implementation Kit**: Is there code that could be expanded for multiple platforms?
- **Checklist**: Is there a process that could become actionable steps?
- **Content Stripping**: Are there sections that could be gated without harming post value?

### 3. Generate CTA Options
For each viable incentive, create CTA copy using patterns from [references/cta-formulas.md](references/cta-formulas.md).

**Output format for each option**:
```markdown
## Option N: [Incentive Type]

**Lead magnet**: [What they receive]

**Effort to create**: Low / Medium / High

**Content changes needed**: [None / Strip section X / Add placeholder]

**CTA Copy**:
{{< subscribe
  headline="[Headline]"
  description="[Description]"
  campaign="[post-slug]"
  lead_magnet="[descriptive-id]"
  button="[Button text]"
>}}

**Placement**: [Mid-post after section X / End of post / Both]
```

### 4. Recommend Content Restructuring (if applicable)
If stripping content would create a strong incentive:

1. Identify the section to remove
2. Explain what remains valuable in the post
3. Suggest the exact cut point
4. Provide before/after structure

**Rule**: The post must remain standalone valuable. Stripping creates "bonus" not "ransom."

## Subscribe Shortcode Reference

```hugo
{{< subscribe
  headline="Get the Checklist"
  description="12 steps for migration"
  campaign="my-campaign"
  lead_magnet="my-checklist"
  button="Get it"
>}}
```

**Parameters**:
- `headline`: CTA headline (short, value-focused)
- `description`: What they get + why it's useful (1-2 sentences)
- `campaign`: UTM campaign value, typically post slug
- `lead_magnet`: Beehiiv custom field for segmentation (kebab-case)
- `button`: Button text (default: "Subscribe")

## Quality Checklist

Before finalizing recommendations:
- [ ] Incentive matches post type (see incentive-patterns.md)
- [ ] Headline is specific, not generic
- [ ] Description mentions format and scope
- [ ] lead_magnet ID is descriptive and unique
- [ ] Post remains valuable if content is stripped
- [ ] Aligns with "The Stuck Senior" persona
