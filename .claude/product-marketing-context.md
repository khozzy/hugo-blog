# Product Marketing Context

*Last updated: 2026-02-25*

## Product Overview
**One-liner:** First-principles data engineering blog that helps senior engineers make better architectural decisions.
**What it does:** kozlov.ski publishes deep-dive technical articles on data engineering, data modeling, and ML — grounded in real-world projects, not toy examples. Each post provides mental models and decision frameworks that help engineers think at a Staff/Principal level about data architecture.
**Product category:** Technical blog / engineering publication (how people find it: "data engineering blog", "data architecture deep-dives")
**Product type:** Content-led personal brand with lead magnets (free resources via Gumroad), email list (Beehiiv), and future paid products.
**Business model:** Currently free content → email list growth → lead magnets → future paid product (TBD). Monetization through Gumroad digital products and eventual course/product launch.

## Target Audience
**Target companies:** Mid-to-large tech companies and data-intensive organizations (retail, fintech, media, SaaS) — anywhere data pipelines, warehouses, or platforms are core infrastructure.
**Decision-makers:** Individual contributors — Senior/Lead/Staff Data Engineers, Analytics Engineers, and Data Platform Engineers (5-10+ years experience).
**Primary use case:** Getting unstuck — moving from "just coding pipelines" to making strategic architectural decisions and articulating them to leadership.
**Jobs to be done:**
- "Help me evaluate whether this architecture is the right one" (decision frameworks)
- "Give me the vocabulary to justify technical choices to my VP" (bridging technical/business)
- "Show me what Staff-level thinking looks like in data engineering" (career growth)
**Use cases:**
- Evaluating orchestration tools (Airflow vs simpler patterns)
- Choosing data modeling approaches (star schema vs Activity Schema)
- Running EDA before jumping to ML/AutoML
- Building lakehouse architectures (Iceberg, Spark, Trino)
- Making build-vs-buy decisions on data infrastructure

## Personas
| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Senior DE ("The Stuck Senior") | Doing impactful work, not just writing DAGs | Drowning in complexity, unclear path to Staff/Principal, can't articulate decisions to leadership | Mental models, decision frameworks, and vocabulary to operate at the next level |
| Tech Lead / Staff DE | Architectural quality, team velocity | Inherited tech debt, cargo-culted tool choices, justifying technical investments | First-principles analysis that validates (or challenges) their instincts with concrete evidence |
| Data Platform Lead | Platform reliability, developer experience | Scaling infrastructure, vendor decisions, managing complexity | Battle-tested patterns from real projects, not vendor marketing |

## Problems & Pain Points
**Core problem:** Senior data engineers know something is wrong with how they're building systems — too much complexity, too many tools, too little strategic thinking — but lack frameworks to articulate what "better" looks like or how to get there.
**Why alternatives fall short:**
- Most data engineering content is tutorial-level ("How to set up Airflow") — not decision-level ("Should you use Airflow?")
- Vendor blogs optimize for product adoption, not honest architectural evaluation
- Conference talks are too high-level; Stack Overflow is too narrow
- Generic "thought leadership" lacks the technical depth to be actionable
**What it costs them:** Months of wasted engineering effort on wrong architectural choices. Technical debt that compounds. Stalled careers because they can't demonstrate strategic thinking.
**Emotional tension:** "Am I just a pipeline plumber? I have 8 years of experience but I still feel like I'm guessing on the big decisions."

## Competitive Landscape
**Direct:** Other data engineering blogs (e.g., Seattle Data Guy, Data Engineering Weekly, Start Data Engineering) — tend toward tutorials and news roundups rather than first-principles analysis of architectural decisions.
**Secondary:** Platform vendor blogs (Databricks, Snowflake, dbt Labs) — high production quality but inherently biased toward their own tooling.
**Indirect:** Books (Designing Data-Intensive Applications, Fundamentals of Data Engineering) — excellent but static; don't cover emerging patterns or provide the "I just dealt with this last week" credibility.

## Differentiation
**Key differentiators:**
- Real project examples, not toy demos (1.5M-row demand forecasting, production VOD player debugging)
- Contrarian framing that challenges defaults ("The Hidden Cost of 'Just Add Airflow'")
- Academic rigor (Ph.D. in AI) combined with practitioner credibility (15 years building systems)
- Bridges technical depth with business communication (speaks to both ICs and leadership)
**How we do it differently:** Every post starts from a real problem encountered in production, applies first-principles reasoning, and delivers a transferable mental model — not just a how-to.
**Why that's better:** Readers don't just learn a technique — they develop the judgment to know *when* and *why* to apply it. This is the gap between Senior and Staff.
**Why readers choose us:** Depth you can't get from a tutorial. Honesty you can't get from a vendor. Practicality you can't get from a textbook.

## Objections & Anti-Personas
| Objection | Response |
|-----------|----------|
| "I don't have time for long reads" | Each post is structured with clear takeaways and a decision framework — skim the headers for the model, deep-read for the evidence. |
| "This is too niche / specific to your setup" | The specific examples are the vehicle; the mental models are universal. Activity Schema isn't about one table — it's about when denormalization beats normalization. |
| "I can just ask ChatGPT" | LLMs give you the average answer. These posts give you the experienced answer — what you'd learn after making the mistake yourself. |

**Anti-persona:** Junior engineers looking for step-by-step tutorials. Content marketing managers looking for "data trends" listicles. People who want quick fixes without understanding tradeoffs.

## Switching Dynamics
**Push:** Frustration with shallow content that doesn't match their real-world complexity. Tired of vendor-sponsored "best practices" that always end with "use our product."
**Pull:** "Finally someone who writes about the decisions I actually face" — depth, honesty, real examples.
**Habit:** Staying in the comfort zone of tutorial consumption. Defaulting to whatever tool the team already uses without questioning it.
**Anxiety:** "Will this be another blog that publishes three posts then goes silent?" — consistency and quality signals matter.

## Customer Language
**How they describe the problem:**
- "I'm just gluing tools together, I'm not designing anything"
- "We picked Airflow because everyone uses it, and now we're stuck"
- "I can't explain to my manager why this architecture is wrong"
- "I've been a senior for 4 years and I don't know what Staff-level looks like"
**How they describe us:**
- [TODO: Capture verbatim reader feedback as it comes in]
**Words to use:** first principles, tradeoffs, decision framework, mental model, architectural thinking, depth, real-world, production, technical debt, complexity budget
**Words to avoid:** best practices (without qualification), simple/easy (when it isn't), thought leader, guru, ninja, 10x, disrupt, leverage (as verb)
**Glossary:**
| Term | Meaning |
|------|---------|
| First principles | Reasoning from fundamental truths rather than by analogy or convention |
| The Stuck Senior | Target persona: experienced engineer who feels plateaued |
| Complexity budget | The idea that every architectural choice has a complexity cost, and you should spend it deliberately |
| Lindy test | Will this content/idea still matter in 5 years? |

## Brand Voice
**Tone:** Direct, confident, occasionally irreverent — but never dismissive. Technical authority earned through specifics, not claimed through credentials.
**Style:** Conversational but precise. Uses "you" and "I." Leads with the story/problem, not the solution. Concrete examples before abstract principles.
**Personality:** Rigorous, opinionated, practical, honest, experienced.

## Proof Points
**Metrics:**
- [TODO: Add blog traffic, email subscriber count, Gumroad sales as they grow]
**Customers:**
- [TODO: Notable readers, companies, shares]
**Testimonials:**
> [TODO: Capture reader quotes as they come in]
**Value themes:**
| Theme | Proof |
|-------|-------|
| Real-world depth | Demand forecast post: found 66% of series unforecastable before training a model, from a real 1.5M-row client project |
| Contrarian clarity | Airflow post: challenges the default orchestration choice with a concrete decision framework |
| First-principles modeling | Activity Schema post: one-table design that solved production QA debugging across 4 codebases and 1M DAU |
| Academic + practitioner | Ph.D. in AI + 15 years building production systems — not just theory, not just war stories |

## Goals
**Business goal:** Build an engaged email list of 1,000+ senior data engineers as foundation for a future paid product.
**Conversion action:** Subscribe to email list (via in-post CTAs and Gumroad lead magnets).
**Current metrics:**
- 0 subscribers
- 0 Gumroad purchases
