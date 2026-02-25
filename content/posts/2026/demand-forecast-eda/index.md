---
title: "Before You Forecast: What 1.5M Retail Transactions Taught Me About Data Quality"
slug: demand-forecast-eda
date: 2026-02-25T08:00:00+01:00
author: Norbert
draft: true
summary: "A client handed me 1.5M rows of POS data and asked for daily demand forecasts. The EDA showed us the forecasting plan was wrong before we trained a single model."
params:
  toc: true
tags:
  - Data Engineering
  - Machine Learning
---

A client handed me 1.5 million rows of point-of-sale data from a pet retail chain. Dozens of stores, 20,000+ products, a full year of transactions. The ask was straightforward: build daily demand forecasts.

It was tempting to jump straight into SageMaker. The dataset was there, the infrastructure was ready, and AutoML promises to handle feature engineering, model selection, and hyperparameter tuning for you. Point it at a CSV, define your target column, and let it run. You'd have a leaderboard of candidate models by end of day.

I almost did exactly that. Instead, I spent a week on EDA first.

That week saved months of wasted work. The EDA told me the forecasting plan was wrong — not "the data needs cleaning" wrong. Structurally wrong — the kind of wrong where AutoML would diligently train, tune, and deploy models that produce confident predictions quietly misleading inventory decisions for months before anyone noticed.

This post walks through what I found, why it mattered, and how it redirected the entire project. If you're building demand forecasts on retail data, these are the checks you should run before writing a single line of model code.

## The Setup

The dataset was a CSV export of report orders from their POS system — roughly 330MB, covering September 2024 through September 2025. Each row represented a transaction line: a product sold at a specific store on a specific date.

After renaming columns, dropping identifiers, and basic cleaning, the working dataset looked like this:

| Column | Description |
|--------|-------------|
| `date` | Transaction date |
| `store_id` | Store identifier (with `multi_store_id` as parent hierarchy) |
| `item_id` | Product identifier |
| `item_brand` | Brand name (~630 distinct brands) |
| `item_category` | Extracted from breadcrumb hierarchy |
| `item_unit_price` | Listed unit price |
| `item_unit_net_price` | Net price per unit |
| `item_discount_amount` | Discount applied |
| `item_promo_applied` | Whether a promotion was active (binary) |
| `demand` | Quantity sold — the target variable |

**1.5M rows. 13 columns. ~60 stores. ~20K items.**

The forecasting grain was `(date, store_id, item_id)` — predict how many units of a specific product will sell at a specific store on a given day.

For any time-series forecasting problem, it helps to think about your features in three categories:

- **Target**: `demand` — units sold per day per store per item
- **Static covariates** (properties of the series that don't change over time): store hierarchy (`multi_store_id`, `store_id`, `store_town`, `store_postcode`), item hierarchy (`item_id`, `item_brand`, `item_category`)
- **Dynamic known covariates** (features that change over time and can be known in advance): `item_promo_applied`, `item_unit_net_price`

This distinction matters because static covariates let the model learn that "stores in the same region behave similarly" or "items in the same category share demand patterns." Dynamic covariates let it learn that "when this item goes on promotion, demand jumps." SageMaker's DeepAR and AutoML both support this structure — you just need the data to be clean enough to carry the signal.

Sounds straightforward. It wasn't.

## Sanity Checks: Where the Cracks Appeared

### Duplicate keys

The first check was uniqueness of the series key. If `(date, store_id, item_id)` is supposed to be our prediction grain, each combination should appear exactly once.

It didn't. **746 groups had duplicate rows.** Some had two entries, some had three. Looking at a specific example — same store, same item, same date — one row had a normal price and 1 unit sold, the other had `unit_price = 0`, no net price, and `demand = 0`.

The root cause turned out to be the export query itself. The software engineers who built the data extract didn't fully understand the POS database layout. The underlying tables had multiple record types — actual sales, inventory adjustments, manual corrections — distinguished by conditions they hadn't accounted for in their joins. The query mixed these together, producing duplicate keys where a real sale and an inventory event for the same product on the same day got exported as two separate rows.

This is a common trap. The people who build the export are rarely the people who'll use the data for modeling. They write a query that looks correct, produces reasonable row counts, and passes a spot check. But subtle join conditions — the difference between a sale record and an adjustment record, or how the system distinguishes a return from a void — are domain knowledge buried in the database schema. Without it, you get a dataset that looks clean but carries structural duplicates that silently corrupt your target variable.

### Negative demand and discounts

- **55 rows** with negative demand (likely returns)
- **2,672 rows** with negative discounts (surcharges? data entry errors?)
- A small fraction (~0.001%) of non-integer demand — not a bug, these were weight-based items

Individually, each of these is minor. Together, they signal that the data pipeline between POS and analytics wasn't designed with forecasting in mind. It was designed for financial reporting, where these edge cases net out in aggregation. For time-series forecasting, they don't.

I bounced this back to the development team to investigate. The negative demand rows and negative discounts weren't something we could resolve from the data alone — they needed someone with access to the POS system's business logic to confirm whether these were returns, voids, surcharges, or export artifacts. This is the kind of finding that EDA surfaces early, before it becomes a silent bias baked into a deployed model.

### Promotions without discounts

Some rows were flagged as promotional (`item_promo_applied = 1`) but had zero discount. If you're planning to use promotion status as a covariate — and you should, since promos are the strongest demand lever in retail — this undermines the signal. Is the promo flag unreliable? Or do some promotions not involve price discounts (e.g., shelf placement, bundling)?

Without knowing which, the feature is noisy at best and misleading at worst.

### Pricing identity failures

I expected a simple identity to hold: `unit_price - discount ≈ net_price`. It didn't. Certain stores showed systematic pricing mismatches over time, visible as clear spikes when plotted. The worst offenders had consistent errors across months — suggesting a configuration issue in the POS system rather than random noise.

When I checked within-day price consistency for the same item at the same store, the results were worse. Some items showed max/min price ratios above 25x on the same day. The typical causes: line-level vs. basket-level discounts recorded differently, mixed pack sizes under one product ID, returns posted as negative price lines.

**Why it matters for forecasting**: if your model learns "when price drops, demand rises," but the price data is incoherent, the model is learning noise. Price elasticity estimates become meaningless.

### The POS system wasn't used for what we thought

As the sanity checks accumulated, a pattern emerged: this wasn't just "messy data." The client was using their POS system in ways it wasn't designed for — or more precisely, in ways that make perfect sense for running a store but break assumptions that forecasting models depend on.

A few examples:

- **Product renaming without new IDs.** Staff would rename items in the POS (correcting typos, updating descriptions) while keeping the same SKU and product ID. From a store operations perspective, nothing changed — it's the same product on the same shelf. From a data perspective, the "comment" field (which carried the product name and variant) became inconsistent across time for the same `item_id`. If you'd used product names for deduplication or matching, you'd have phantom product splits.
- **Inventory adjustments recorded as transactions.** Stock corrections, write-offs, and inter-store transfers appeared in the same transaction stream as actual customer purchases. Some zero-demand rows with `unit_price = 0` weren't sales at all — they were inventory events masquerading as demand data.
- **Manual price overrides.** Some items had `unit_price = 0` because the cashier entered the price manually at the register rather than scanning a barcode. The system recorded a transaction, but without a reliable price. These rows still contributed to aggregate demand counts.

None of these are bugs. They're the reality of how a multi-store retail operation uses its POS day-to-day. But they're invisible if you skip EDA and feed the CSV straight into AutoML. SageMaker would happily treat inventory adjustments as demand signals and manual price overrides as price drops. The resulting forecasts would be confidently wrong.

## Store Coverage: The Ghost Stores

Next, I looked at whether stores reported data consistently. I built a date spine — every day in the date range, crossed with every store — and checked for gaps.

About 10 stores had **no data on most days**. Not low sales. No data at all. These weren't closed stores (they appeared sporadically), they were stores with unreliable POS reporting. Weekends showed predictable dips, but the real signal was the stores that were structurally absent.

If you include these stores in training, you're teaching the model that "no data = no demand." But "no data" and "zero demand" are fundamentally different things. One means the store was closed or the system was down. The other means products were available and nobody bought them. Confusing the two produces a forecast that's systematically biased downward.

## The Intermittency Problem

This is where the project pivoted.

Every forecasting problem has an implicit assumption: the thing you're predicting happens often enough to learn patterns from. For demand forecasting, that means products need to sell with some regularity. But how regular is "enough"?

### Measuring the active window

I computed the "active window" for each store-item combination — the contiguous period between when an item first appeared at a store and when it last appeared. This is the window where that item was listed, available, and theoretically purchasable. Then I measured how many of those days actually had sales.

The numbers were stark:

| Metric | Value |
|--------|-------|
| Average lifespan | **133 days** |
| Average days with sales | **7.6 days** |
| Average activity rate | **0.38** |

A typical product is listed at a store for over four months, but only sells on 7-8 of those days. That's a **5.7% fill rate** if you look at the raw average, though the distribution matters more than the mean.

This distinction between "listed" and "selling" is critical. The dataset doesn't contain rows for days when nothing sold — there's no explicit zero. If you naively fill missing dates with `demand = 0`, you're assuming every item was available every day of its active window. But some of those zero-demand days might be stockouts (product unavailable), not lack of customer interest. Without inventory-on-hand data, you can't tell the difference. And that distinction is the difference between "nobody wanted this" and "we ran out."

### Syntetos-Boylan Classification

To understand the scale of the problem, I used the **Syntetos-Boylan Classification (SBC)** framework. SBC classifies demand patterns along two dimensions:

- **Average inter-demand interval (ADI)** — how long between consecutive non-zero demand events
- **Coefficient of variation of demand size (CV²)** — how variable the non-zero quantities are when sales do occur

This produces four quadrants:

{{< mermaid >}}
quadrantChart
    title Syntetos-Boylan Classification
    x-axis "Low CV2" --> "High CV2"
    y-axis "Low ADI" --> "High ADI"
    quadrant-1 Lumpy
    quadrant-2 Intermittent
    quadrant-3 Smooth
    quadrant-4 Erratic
{{< /mermaid >}}

| Quadrant | What it means | Best method |
|----------|---------------|-------------|
| **Smooth** | Sells often, consistent quantities | Standard methods (ETS, ARIMA) |
| **Erratic** | Sells often, but wildly varying quantities | Standard methods with caution |
| **Intermittent** | Sells rarely, but consistent when it does | Croston's method |
| **Lumpy** | Sells rarely AND in unpredictable quantities | SBA, ADIDA |

The SBC framework matters because it directly prescribes the modeling approach. You don't pick a forecasting method based on what's trendy or what your cloud provider offers — you pick it based on your demand pattern.

When I classified the ~199K store-item pairs in this dataset, the vast majority fell into the **intermittent** and **lumpy** quadrants. These are items that sell once every few weeks — sometimes once a month — and when they do sell, the quantity varies. Trying to predict daily demand for a product that sells 7 times in 133 days isn't forecasting. It's guessing.

### Why this kills standard models

**This is the finding that changed the project direction.** Standard time-series models (ARIMA, Prophet, even neural forecasters like DeepAR) assume reasonably continuous demand signals. When 60%+ of your series are mostly zeros with occasional spikes, these models either:

1. **Predict near-zero every day** — technically accurate (the mode is zero), practically useless for inventory planning
2. **Overfit to the rare non-zero events** — learn noise rather than signal
3. **Smooth everything into a meaningless average** — predict 0.05 units/day, which is neither zero nor one

None of these help someone decide how much stock to order. And if you'd fed this data into SageMaker AutoML without understanding the intermittency structure, this is exactly what you'd get — a well-tuned model that's confidently useless.

The right methods for intermittent demand work differently. **Croston's method** decomposes the problem into two separate forecasts: one for the inter-demand interval (when will the next sale happen?) and one for the demand size (how much will sell when it does?). **SBA (Syntetos-Boylan Approximation)** corrects Croston's upward bias. **ADIDA (Aggregate-Disaggregate Intermittent Demand Approach)** temporally aggregates the data to reduce zeros, forecasts at the aggregate level, then disaggregates back. These aren't exotic — they're the standard toolkit for this exact problem. But you only reach for them if you know your demand is intermittent. And you only know that if you do the EDA.

## Calendar Effects

Despite the intermittency, aggregate demand still showed meaningful calendar patterns:

- **Day-of-week effect**: clear weekday/weekend split, with Saturdays showing higher demand
- **Month-of-year**: some seasonal variation, though the dataset only spans 12 months — not enough for robust seasonal decomposition
- **Payday proximity**: a slight uplift near the 25th and month-end, as expected in retail
- **Holidays**: visible dips on public holidays, though the sample size per holiday was small

These patterns are useful but only at the aggregate level. For individual items selling 7 times in 4 months, calendar features add noise rather than signal.

## What the Data Told Us

The EDA pointed to three strategic shifts, all visible before any model was trained — and all invisible to AutoML:

### 1. Don't forecast daily — forecast weekly

Daily demand for most items is a stream of zeros with occasional ones. Weekly aggregation compresses the sparsity. An item selling 7 times in 133 days (~0.05/day) becomes ~0.37/week — still sparse, but meaningfully different from zero in more periods. The forecast becomes "this item sells about once every 2-3 weeks at this store" rather than "zero, zero, zero, zero, one, zero, zero..."

This also aligns better with how the business actually uses forecasts. Nobody restocks daily. Replenishment cycles are weekly at best.

### 2. Don't forecast items — forecast categories

With 20,000+ items and most falling into intermittent or lumpy demand, the signal is at the category level. A store might sell an unpredictable mix of specific dog food brands on any given week, but the total "dry dog food" category has a smoother, more forecastable demand curve. Forecast the category, then allocate downward based on historical item-level shares.

The static covariates — brand, category, store hierarchy — become more useful here. Instead of trying to learn patterns for 20K sparse item-level series, the model learns category-level demand shaped by store characteristics.

### 3. Match the method to the demand pattern

The Syntetos-Boylan Classification told us which items need which approach. Smooth and erratic items can use standard methods. Intermittent items need Croston or SBA. Lumpy items need ADIDA or should be aggregated to a higher hierarchy. SageMaker's DeepAR can technically handle zeros, but it's overkill when the demand pattern is structurally intermittent rather than complex — and it won't outperform purpose-built intermittent demand methods on this type of data.

## The Takeaway

If I'd pointed SageMaker AutoML at this dataset on day one, it would have delivered results by end of week. A leaderboard of models, ranked by RMSE or MAPE, with the winning model deployed behind an endpoint. And every single one of those models would have been solving the wrong problem — trained on inventory adjustments masquerading as demand, learning price elasticities from incoherent pricing data, predicting daily demand for items that sell seven times a quarter.

AutoML is a powerful tool. But it optimizes within the problem you define. It doesn't tell you whether you've defined the right problem.

EDA isn't a checkbox you tick before the "real work" of model training. For demand forecasting, **the EDA is the strategic decision layer.** It tells you:

- Whether your data actually supports the prediction problem you've defined
- How your POS system's operational quirks show up as data quality issues
- What granularity makes sense (daily vs. weekly, item vs. category)
- Which modeling approach matches your demand patterns (smooth vs. intermittent vs. lumpy)
- Which covariates carry real signal vs. noise

In this case, the data said: "Your 1.5M rows look impressive, but 60% of the series you want to forecast are mostly empty. Your price data is internally inconsistent. Your POS records mix real sales with inventory noise. And ten of your stores are ghosts."

The right response wasn't to clean harder and train anyway. It was to redefine the problem.

That's what EDA is for.
