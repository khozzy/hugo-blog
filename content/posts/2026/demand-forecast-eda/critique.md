# Content Critique: demand-forecast-eda

## Scores

| Criterion | Score | Justification |
|---|---|---|
| Persona fit | 5/10 | Data science / ML case study, not a data engineering architectural decision piece — "The Stuck Senior" building pipelines will find it interesting but not directly applicable. |
| Lindy test | 7/10 | "Do EDA before modeling" and intermittent demand classification (SBC, Croston) are durable; SageMaker/AutoML framing will age. |
| Specificity | 8/10 | Strong concrete numbers (746 duplicates, 57% zero-share, 199K windows, SBC split) grounded in real data. |
| Differentiation | 6/10 | "I almost used AutoML but EDA saved me" is a well-worn genre; the intermittency analysis is distinctive but takes too long to reach. |
| Engagement bait | 2/10 (low = good) | No fluff, no hollow clickbait — title is slightly sensational ("1.5M rows") but earned by content. |

## 1. Structure & Flow

**The post buries the lede.** The genuinely novel insight — the bimodal intermittency structure and the SBC classification — doesn't arrive until roughly 60% through the article. Everything before it (duplicate keys, negative demand, pricing identity failures, POS misuse, ghost stores) is important context but reads like a checklist of data quality findings. Each subsection under "Sanity Checks" follows the same pattern: "I checked X, it was broken, here's why." By the fourth one, the reader's attention is flagging.

The "Setup" section is too long. The column table, the three-category feature breakdown (target / static / dynamic covariates), and the SageMaker structure discussion are preamble that could be compressed to 3 sentences. The reader doesn't need to know what `item_unit_net_price` is or that SageMaker's DeepAR supports static covariates at this point in the narrative.

**Suggested restructure:** Lead with the intermittency finding and SBC classification (the actual insight), then use the data quality issues as supporting evidence for "why you can't just throw this at AutoML." The current structure is chronological (here's what I did in order). The better structure is argumentative (here's the conclusion, here's the proof).

## 2. Audience Fit

This is the biggest concern. Your target persona is "The Stuck Senior" — a senior/lead data engineer working on pipelines, warehouses, and platforms. This post is fundamentally a **data science / forecasting** case study. The persona pain points are: drowning in complexity, unclear Senior-to-Staff path, can't articulate decisions to leadership. This post addresses none of those directly.

A data engineer reading this will think: "Cool forecasting analysis, but I don't build demand models. I build the pipeline that feeds them." The bridge between this content and the data engineering persona is implicit at best. The POS data quality section is the closest to their world, but it's framed as "things I found during EDA" rather than "here's how pipeline design causes downstream modeling failures."

**To fix this:** Either reframe the entire post through a data engineering lens ("How your pipeline design silently kills downstream ML models") or acknowledge frankly that this is a data science post and adjust your tags accordingly. The current framing tries to be both and succeeds at neither for the stated persona.

## 3. Specificity & Depth

This is the post's strongest dimension. The numbers are real, the charts support the claims, and the SBC framework is properly explained with thresholds and quadrant definitions. The Pareto/Lorenz analysis connecting volume concentration to demand intermittency is particularly well done — that chart earns its place.

**However**, there are gaps:

- **No code.** Not a single code snippet. For a technical audience, showing the SBC classification logic, the zero-share computation, or even the duplicate detection query would add enormous credibility and utility. The post tells you *what* to check but not *how* to check it.
- **No mention of what happened next.** You say the project pivoted. Pivoted to what, exactly? Did you implement Croston's method? Did the weekly + category aggregation work? The three strategic shifts are recommendations, not results. The reader is left at the cliffhanger.
- **SBC thresholds are missing.** You describe the framework and show the quadrant chart but never state the actual ADI and CV-squared cutoff values you used for classification. For a reader trying to replicate this, that's a critical omission.

## 4. Title & Hook

The title `"Before You Forecast: What 1.5M Retail Transactions Taught Me About Data Quality"` has two problems:

1. **"Data Quality" undersells the finding.** The real insight is about demand intermittency structure and problem redefinition, not data quality. Data quality is the first half of the post; the second (better) half is about something deeper.
2. **"1.5M rows" is a weak flex.** In 2026, 1.5M rows is small. Any senior engineer has dealt with billions. It reads as trying to impress people who don't work with data, which is not your audience.

The summary is better than the title — "the forecasting plan was wrong before we trained a single model" is a strong hook.

**Better title candidates:**

- "66% of Our Demand Series Were Unforecastable. We Found Out Before Training a Single Model."
- "Why AutoML Confidently Solved the Wrong Forecasting Problem"
- "The Intermittency Problem: When Two-Thirds of Your Time Series Are Mostly Zeros"

## 5. Technical Accuracy

Mostly solid, with a few soft spots:

- **DeepAR contradiction.** Line 203 says DeepAR "assumes continuous demand signals." Line 242 says it "can technically handle zeros." DeepAR was specifically designed for sparse, intermittent demand with its negative binomial likelihood. AWS's own documentation positions it for exactly this use case. The better claim is that DeepAR can *handle* zeros but still struggles when 97% of observations are zero because the signal-to-noise ratio is catastrophic, not because of a structural assumption violation.
- **The "average activity rate of 0.38"** seems inconsistent with "57% have zero share near 1.0." The average is being dragged up by the 33.6% smooth-demand items, which makes it a misleading summary statistic. You should flag this yourself rather than leaving it for the reader to notice.

## 6. Writing Quality

The prose is generally clean but has recurring patterns that weaken it:

- **Repeated "confidently wrong" motif.** Variations of "confidently wrong," "confidently useless," "confident predictions quietly misleading" appear at least three times. Once is a good phrase. Three times is a crutch.
- **Overuse of the dash.** Almost every paragraph has an em-dash parenthetical (~15 instances). Creates a rhythm where every sentence has a qualification bolted on. Reads as hedging.
- **"Stark" appears twice** (lines 129, 183). Noticeable in a single post.
- The 35-word clause after the dash on line 21 collapses under its own weight. Break it up.

## 7. SEO & Discoverability

The slug `demand-forecast-eda` is reasonable but generic. Someone searching for this topic would more likely search "intermittent demand forecasting," "retail demand forecasting EDA," or "Syntetos-Boylan classification example." None of these phrases appear in the title or first paragraph.

Tags are `Data Engineering` and `Machine Learning`, but the post is really about `Demand Forecasting`, `EDA`, and `Intermittent Demand` — none of which appear as tags.

No CTA. No `{{< gumroad >}}` shortcode, no `{{< subscribe >}}` shortcode. A downloadable "Demand Forecasting EDA Checklist" would be a natural lead magnet here.

## 8. Missing Pieces

- **No code at all.** Show the SBC classification logic. Show the zero-share computation. Show the duplicate detection. Your persona wants to take this and apply it tomorrow.
- **No link to a notebook or repo.** Even without client data, a synthetic example or template notebook would be enormous value-add.
- **No "what happened next."** The post ends at diagnosis. Where's the treatment? Even a brief "Part 2 coming" or a paragraph on outcomes would close the loop.
- **No discussion of the business conversation.** You had to tell a client their forecasting plan was structurally wrong. How did that conversation go? What did you show them? That is the Staff/Principal-level skill your persona desperately wants to learn, and you completely skip it.
- **No SBC threshold values** used in the classification.

## 9. What Works Well

- **The SBC analysis and Pareto overlay are genuinely excellent.** The bimodal insight (smooth vs. lumpy with nothing in between) mapping to the Pareto volume curve is Staff-level analysis.
- **The "POS system wasn't used for what we thought" section** is the most distinctive part. Product renaming without new IDs, inventory adjustments in the transaction stream, manual price overrides — real-world operational details no textbook covers. Practitioner credibility shines here.
- **The three strategic shifts** (weekly not daily, categories not items, match method to demand pattern) are concrete, actionable recommendations.
- **Charts are well-chosen and well-captioned.** Alt text is thorough. The Pareto chart with the color gradient mapping zero-share is particularly effective visual storytelling.

## Single Biggest Improvement

**Add a "Presenting to the Client" section.** Describe how you took these EDA findings — ghost stores, bimodal intermittency, the SBC classification — and presented them to a non-technical stakeholder to redirect a project that was already scoped and budgeted. Show what you showed them. Describe how you framed "your plan is wrong" as "here's a better plan." That is the Staff/Principal-level skill your persona cannot find anywhere else, and it would make this post truly differentiated from every other "I did EDA and it mattered" blog post.
