# Social Content — Demand Forecast EDA Post

## LinkedIn Post 1 — The Story Hook (flagship)

```
I almost pointed SageMaker at 1.5M rows and called it a day.

A client handed me POS data from a pet retail chain.
~60 stores, 20K products, a full year of transactions.
The ask: daily demand forecasts.

AutoML was ready. Infrastructure was ready.
I could have had a leaderboard of models by Friday.

Instead, I spent a week on EDA.

What I found:

→ 746 duplicate keys from a flawed export (inventory adjustments mixed with real sales)
→ 10 "ghost stores" with no data on most days — silently biasing demand downward
→ Pricing mismatches up to 75x within the same day-store-item
→ 66% of demand series classified as lumpy (Syntetos-Boylan framework)
→ Only 39 out of ~199K store-item pairs had truly continuous demand

That last one changed the entire project direction.

Standard models (ARIMA, Prophet, DeepAR) assume continuous demand.
When 66% of your series are mostly zeros with unpredictable spikes,
these models either predict near-zero every day or smooth everything
into a meaningless average.

AutoML would have produced confident predictions.
Every single one would have been solving the wrong problem.

The strategic pivot:
— Forecast weekly, not daily
— Forecast categories, not individual items
— Match the method to the demand pattern (Croston/SBA for lumpy, ETS/ARIMA for smooth)

EDA isn't a checkbox before the "real work" of model training.
For demand forecasting, the EDA is the strategic decision layer.

It tells you whether you've defined the right problem —
something AutoML will never do.

Full analysis with the complete framework in the comments.

What's the most expensive shortcut you've seen a team take with ML?
```

*Link to post goes in first comment.*

---

## LinkedIn Post 2 — The Contrarian Take

```
"Just point AutoML at it and let it find the best model."

This advice costs companies months.

AutoML optimizes within the problem you define.
It doesn't validate whether you've defined the right problem.

I had 1.5M rows of retail POS data.
AutoML would have happily:

— Trained on inventory adjustments masquerading as demand signals
— Learned price elasticities from data with 75x within-day pricing mismatches
— Predicted daily demand for items that sell 7 times per quarter
— Treated missing store data as zero demand (it wasn't)

The output? A well-tuned model that's confidently useless.

One week of EDA revealed that 66% of the series were lumpy —
mostly zeros with occasional unpredictable spikes.
Standard time-series models can't handle that.
But you only know this if you look before you train.

The items easiest to forecast are the ones where forecasting
adds the least value (the store already knows to restock them).

The items hardest to forecast — lumpy, low-volume, long-tail —
are exactly where a good forecast would matter most.
And those are where standard models fail.

AutoML is a powerful tool.
But a powerful tool aimed at the wrong problem
just gets you to the wrong answer faster.

Do the EDA first.
```

---

## LinkedIn Post 3 — The Lesson (shorter, mid-week)

```
The strategic paradox of demand forecasting:

The items easiest to forecast are the ones where
forecasting adds the LEAST value.

High-volume, smooth-demand products?
The store already knows to restock those.
ETS and ARIMA work great. Nobody needed your model.

Low-volume, lumpy products?
They sell 7 times in 4 months.
Standard models predict near-zero every day.
These are where a good forecast would actually change decisions.
And these are where every standard method fails.

In the dataset I analyzed:
— 66% of ~199K store-item pairs were lumpy
— Only 39 had truly continuous demand
— 19% of windows generated 80% of total volume

The answer wasn't "clean harder and train anyway."

It was: redefine the problem.
Weekly instead of daily. Categories instead of items.
Match the method to the demand pattern.

Most ML projects fail not because the model was wrong,
but because the problem was wrong.
```

---

## X/Twitter Thread

```
Tweet 1:
I had 1.5M rows of retail POS data and a request for daily demand forecasts.

I almost jumped straight into SageMaker AutoML.

Instead, I spent a week on EDA.

That week saved months. Here's what I found: 🧵

Tweet 2:
First check: uniqueness of the series key.

(date, store_id, item_id) should appear once.

It didn't. 746 groups had duplicates.

Root cause: the POS export mixed real sales with inventory adjustments. The people who built the extract didn't know the difference.

Tweet 3:
Then I checked store coverage.

~10 stores had no data on most days. Not low sales — no data at all.

If you include these, you teach the model "no data = no demand."

But "no data" ≠ "zero demand." One is a system failure. The other is information.

Tweet 4:
The real finding: demand intermittency.

I classified ~199K store-item pairs using the Syntetos-Boylan framework:
— 66% lumpy (rare sales, unpredictable quantities)
— 33% smooth
— Only 39 pairs (0.02%) had truly continuous demand

Tweet 5:
Why this kills standard models:

ARIMA, Prophet, DeepAR all assume continuous demand.

With mostly-zero series, they either:
→ Predict near-zero daily (technically correct, practically useless)
→ Overfit to rare spikes
→ Smooth into a meaningless average

None help someone decide how much to order.

Tweet 6:
The strategic paradox:

Items easiest to forecast → least value from forecasting (store already restocks them)
Items hardest to forecast → most value from forecasting (lumpy long-tail)

Standard models work on the wrong side of this equation.

Tweet 7:
The pivot:
→ Weekly forecasts, not daily (compresses sparsity)
→ Category-level, not item-level (smoother signal)
→ Croston/SBA for lumpy items, ETS/ARIMA for smooth
→ All visible before training a single model

Tweet 8:
AutoML optimizes within the problem you define.

It doesn't tell you whether you've defined the right problem.

EDA isn't a checkbox. For demand forecasting, it's the strategic decision layer.

Full write-up with frameworks, charts, and the complete analysis: [link]
```

---

## X Standalone Post (hot take)

```
AutoML's biggest failure mode isn't picking the wrong algorithm.

It's confidently solving the wrong problem.

In a 1.5M-row retail dataset, 66% of demand series were lumpy — mostly zeros with unpredictable spikes.

AutoML would have diligently trained, tuned, and deployed models that predict near-zero every day.

Technically accurate. Strategically useless.

One week of EDA caught it. No model needed.
```

---

## Posting Strategy

| Content | Platform | Purpose | When |
|---------|----------|---------|------|
| Post 1 (Story) | LinkedIn | Drive traffic to blog | Publish day (Tue/Wed AM) |
| Post 2 (Contrarian) | LinkedIn | Build authority, engagement | 2-3 days after Post 1 |
| Post 3 (Lesson) | LinkedIn | Reinforce insight, light engagement | Following week |
| Thread | X | Drive traffic + followers | Publish day (sync with LinkedIn) |
| Standalone | X | Engagement / repost bait | Day after thread |

**Notes:**
- All LinkedIn posts: put the blog link in the **first comment**, not the post body
- X thread: link goes in the final tweet only
- Engage actively in the first hour after each post (reply to every comment)
- Post 1 is the flagship — if one of these gets traction, double down on that angle for follow-ups
