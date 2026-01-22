---
title: "Activity Schema: The Data Model I Haven't Shipped Yet"
slug: activity-schema
date: 2025-06-04T08:00:00+01:00
author: Norbert
draft: true
summary: "One table. Temporal joins. No foreign keys. Activity Schema is a radical simplification for event analytics - here's when it makes sense and what tradeoffs to expect."
params:
  toc: true
  subscribe:
    enable: false
tags:
  - Data Engineering
  - Data Modeling
---

What if your entire analytics warehouse was one table? No foreign keys. No 15-table joins. Just events, entities, and time.

That's the premise of _Activity Schema_ - and after a year of circling it, I'm convinced it's the right model for event-driven domains. I haven't shipped it to production yet, but exploring it changed how I think about analytics modeling.

This post isn't a tutorial. It's a mental model. I want you to understand _why_ this approach works, _when_ it makes sense, and _what tradeoffs_ you're signing up for.

## When Events Misbehave

The use case that led me to Activity Schema was debugging a VOD player. Different app versions were emitting events in invalid order - playback starting before player initialization, buffering sessions without end events. Telemetry chaos.

To answer "which versions have broken event sequences?", you need to compare timestamps across event types for the same session. In a traditional schema, that means joining the `playback_events` table to `player_events` to `buffering_events`, matching on playback session IDs, and praying your timestamps are consistent.

It works. Until someone asks "show me all sessions where buffering ended but never started." Now you need outer joins. Then "group by app version and count the anomalies." Now you're writing window functions across joined tables.

**The query complexity isn't the real problem. The real problem is that every new question requires a new mental model of how the tables relate.**

## One Table, Temporal Joins

Activity Schema takes a different approach. Instead of normalizing events into separate tables by type, you store everything in a single stream:

| ts                  | activity     | entity      | features                |
| ------------------- | ------------ | ----------- | ----------------------- |
| 2025-06-04 10:00:01 | player_ready | session_123 | {app_version: "2.1.0"}  |
| 2025-06-04 10:00:03 | video_start  | session_123 | {asset_id: "movie_456"} |
| 2025-06-04 10:00:15 | buffer_start | session_123 | {buffer_id: "buf_789"}  |

Every row is an **activity** performed by an **entity** at a specific **time**, with optional **features** as context.

The magic happens when you query. Instead of foreign key joins, you use **temporal joins** - self-joins based on time relationships.

## Temporal Joins

Temporal joins replace foreign keys with time-based relationships. Every query follows the same pattern:

1. **Define a cohort** - the primary activity that sets your row count
2. **Append related data** - join other activities based on when they happened relative to the cohort

The cohort is your anchor. Append operations add columns, never rows. This eliminates fan-traps by design.

### The Twelve Relationships

There are exactly 12 ways to relate activities in time, organized into 3 families × 4 temporal positions:

|               | Ever               | Before              | After              | In Between                   |
| ------------- | ------------------ | ------------------- | ------------------ | ---------------------------- |
| **First**     | First ever append  | First append before | First append after | First append between cohorts |
| **Last**      | Last ever append   | Last append before  | Last append after  | Last append between cohorts  |
| **Aggregate** | Aggregate all ever | Aggregate before    | Aggregate after    | Aggregate between cohorts    |

**Temporal positions:**

- **Ever** - all occurrences regardless of cohort timing (static)
- **Before** - occurrences _before_ the cohort activity
- **After** - occurrences _after_ the cohort activity
- **In Between** - occurrences between cohort activity and the _next_ cohort activity

**Families:**

- **First** - earliest occurrence (use `ORDER BY ts ASC`)
- **Last** - most recent occurrence (use `ORDER BY ts DESC`)
- **Aggregate** - count, sum, average, or other aggregation across all matching occurrences

Once you internalize these 12 patterns, you can express almost any analytics question.

### Query Blueprints

Every temporal join follows the same structure. The variations come from two choices:

1. **Window ordering**: `ASC` for First, `DESC` for Last
2. **Time filter**: none for Ever, `< c.ts` for Before, `> c.ts` for After, bounded for In Between

Here's the First/Last pattern - the foundation for 8 of the 12 relationships:

```sql
WITH cohort AS (
    SELECT entity, ts, ...
    FROM activity_stream
    WHERE activity = 'cohort_activity'
),
append AS (
    SELECT entity, ts, some_feature,
           ROW_NUMBER() OVER (
               PARTITION BY entity
               ORDER BY ts ASC       -- ASC for First, DESC for Last
           ) as rn
    FROM activity_stream
    WHERE activity = 'append_activity'
)
SELECT c.*, a.some_feature
FROM cohort c
LEFT JOIN append a
    ON c.entity = a.entity
    AND a.rn = 1
    -- Ever: no time filter
    -- Before: AND a.ts < c.ts
    -- After: AND a.ts > c.ts
```

Aggregate and In Between patterns follow similar logic with `GROUP BY` and `LEAD()` window functions respectively.

{{< subscribe headline="Get the SQL Cheat Sheet" description="All 12 temporal join patterns as copy-paste SQL for BigQuery, Snowflake, DuckDB, and Redshift. Print it, bookmark it, share it with your team." button="Send it" campaign="activity-schema" lead_magnet="temporal-joins-cheatsheet" >}}

## Relationships in Practice

Below are three detailed examples - one from each family. The patterns adapt to all 12 relationships by changing the window ordering and time filter.

### Last Before (Last Family)

For every cohort activity, append the most recent occurrence of another activity _that happened before it_.

**Example question**: "For every video start, what was the last screen the user viewed?"

**Raw activity stream:**

| ts       | activity    | entity    | features            |
| -------- | ----------- | --------- | ------------------- |
| 10:00:00 | screen_view | session_1 | {screen: "browse"}  |
| 10:00:45 | screen_view | session_1 | {screen: "details"} |
| 10:01:00 | video_start | session_1 | {asset: "movie_A"}  |
| 10:05:00 | screen_view | session_1 | {screen: "browse"}  |
| 10:05:30 | video_start | session_1 | {asset: "movie_B"}  |

**After temporal join** (cohort: `video_start`, append: `screen_view`, last before):

| ts       | activity    | entity    | asset   | last_screen_before |
| -------- | ----------- | --------- | ------- | ------------------ |
| 10:01:00 | video_start | session_1 | movie_A | details            |
| 10:05:30 | video_start | session_1 | movie_B | browse             |

Each video start gets the screen that was viewed _immediately before it_ - different values for each cohort row.

### First After (First Family)

For every cohort activity, append the earliest occurrence of another activity _that happened after it_.

**Example question**: "For every player_ready event, how long until video actually started?"

**Raw activity stream:**

| ts       | activity     | entity     | features         |
| -------- | ------------ | ---------- | ---------------- |
| 10:00:00 | player_ready | playback_1 | {version: "2.1"} |
| 10:00:03 | video_start  | playback_1 | {}               |
| 10:10:00 | player_ready | playback_2 | {version: "2.1"} |
| 10:10:08 | video_start  | playback_2 | {}               |
| 10:20:00 | player_ready | playback_3 | {version: "2.0"} |

**After temporal join** (cohort: `player_ready`, append: `video_start`, first after):

| ts       | activity     | entity     | version | video_start_ts | time_to_start |
| -------- | ------------ | ---------- | ------- | -------------- | ------------- |
| 10:00:00 | player_ready | playback_1 | 2.1     | 10:00:03       | 3 sec         |
| 10:10:00 | player_ready | playback_2 | 2.1     | 10:10:08       | 8 sec         |
| 10:20:00 | player_ready | playback_3 | 2.0     | NULL           | NULL          |

The NULL reveals playback_3 never started - a QA signal worth investigating.

### Aggregate In Between (Aggregate Family)

Count, sum, or average activities that occurred between two points.

**Example question**: "For every completed delivery, how many status updates happened between pickup and dropoff?"

**Raw activity stream:**

| ts    | activity      | entity  | features               |
| ----- | ------------- | ------- | ---------------------- |
| 08:00 | pickup        | order_1 | {}                     |
| 08:15 | status_update | order_1 | {status: "in_transit"} |
| 08:45 | status_update | order_1 | {status: "nearby"}     |
| 09:00 | dropoff       | order_1 | {}                     |
| 10:00 | pickup        | order_2 | {}                     |
| 11:30 | dropoff       | order_2 | {}                     |

**After temporal join** (cohort: `dropoff`, bounded by `pickup`, aggregate: count `status_update`):

| ts    | activity | entity  | pickup_ts | updates_during_delivery |
| ----- | -------- | ------- | --------- | ----------------------- |
| 09:00 | dropoff  | order_1 | 08:00     | 2                       |
| 11:30 | dropoff  | order_2 | 10:00     | 0                       |

Order 2 had no status updates between pickup and dropoff - maybe worth flagging.

### Adapting Patterns

The remaining 9 relationships follow the same structure:

- **Ever variants** (First Ever, Last Ever, Aggregate All Ever): Remove the time filter entirely. The result is static across all cohort rows for the same entity.
- **Before variants**: Add `AND a.ts < c.ts` to get occurrences before the cohort.
- **After variants**: Add `AND a.ts > c.ts` to get occurrences after the cohort.
- **In Between variants**: Use `LEAD()` to find the next cohort occurrence and bound the window.

Swap `ORDER BY ts ASC` for First, `ORDER BY ts DESC` for Last.

## Building Intuition

The mental shift takes time. You stop thinking "which tables do I join?" and start asking:

1. **What's my anchor?** (cohort activity)
2. **What do I need to know?** (append activity)
3. **Which family?** (First, Last, or Aggregate)
4. **Which temporal position?** (Ever, Before, After, or In Between)

For the VOD player debugging case:

- **Cohort**: `video_start` events
- **Append**: `player_ready`
- **Family**: First (we want the earliest)
- **Position**: Before (must happen before video starts)
- If the join returns NULL, you found your bug - video started without player initialization.

## Who Benefits Most

Activity Schema isn't universally better. It shines in specific contexts:

**Data Analysts**

One table to query. No need to memorize schema relationships or hunt for the right join keys. The question "what happened before X?" translates directly to a cohort + append pattern. New analysts onboard faster because there's one mental model to learn, not a sprawling ERD.

**Customer 360 / User Journey Teams**

"What did user X do before churning?" becomes a single self-join instead of a multi-table expedition. Customer timelines live in one place. Dynamic cohorts based on behavioral sequences - "users who viewed pricing 3+ times before signing up" vs "impulse converters" - are aggregate temporal joins that feed directly into marketing systems or personalization engines.

**Event-Driven Domains**

- Video streaming: playback sequences, buffering analysis, QoE metrics
- Logistics: pickup to transit to delivery chains
- E-commerce: browse to cart to checkout funnels
- IoT/Telemetry: sensor event sequences, anomaly detection

Anywhere events flow in sequences, Activity Schema fits naturally.

**Feature Engineering for ML**

Temporal relationships map directly to ML features: "time since last X", "count of Y before Z", "first value of A after cohort". Instead of bespoke feature pipelines per model, you have a standard vocabulary. A churn model and a fraud model use the same append patterns - just different activities.

**Root Cause Analysis**

When something breaks, the investigation is "what preceded this?" That's a temporal join. No specialized root-cause tooling needed - analysts explore causality directly.

**Leading Indicator Discovery**

"What behaviors predict conversion?" becomes exploratory SQL. Append various activities before `converted` events, look for patterns in the features.

**SLA and Operational Metrics**

"Time to first response", "time between pickup and delivery" - these aren't derived metrics requiring complex transformations. They're the raw output of temporal joins. Feed directly into operational dashboards or alerting.

**Compliance and QA**

Validating event sequences becomes explicit. "Find sessions where `video_start` happened before `player_ready`" is a temporal join that returns NULLs on the append side. Regulatory rules often require proving order: "approval happened before execution", "consent collected before data processing". The join returns NULL when sequence is violated - compliance checks become queries, not audits.

**Behavioral A/B Test Analysis**

Beyond "did variant A convert more?" - you can ask "what did variant A users do differently before converting?" Compare the appended activity patterns between groups to understand _why_ something worked.

The value isn't the single table - it's that temporal relationships become composable building blocks for any downstream system that needs behavioral context.

## The Tradeoffs

I haven't shipped this to production. Here's what gave me pause:

**You need a documented vocabulary**

The 12 temporal relationships are powerful, but your team needs to internalize them. "Last before" vs "first after" is intuitive once you get it - but there's a learning curve. Documentation and examples become essential.

Beyond the relationships, you also need consistent, documented activity names. Is it `video_start` or `videoStarted` or `playback_started`? Without a canonical list of activities and their meanings, queries become guesswork. The schema is simple, but governance is not optional.

**Features JSON can get bloated**

Stuffing contextual data into a JSON column is flexible but dangerous without discipline. Every producer adding "just one more field" leads to bloated payloads with inconsistent keys across activity types. Query syntax varies by warehouse (DuckDB's `json_extract_string` vs BigQuery's `JSON_VALUE` vs Snowflake's `GET_PATH`). You need clear guidelines on what belongs in features vs what deserves its own activity.

**Not for every workload**

OLTP? No. Real-time dashboards with sub-second latency? Probably not. Activity Schema is optimized for analytical queries on incremental, historical event streams. Know your access patterns.

**Incremental updates need thought**

Late-arriving events, retroactive corrections, backfills - these are solvable but require explicit handling. The "single source of truth" promise holds only if your ingestion pipeline maintains it.

## When to Consider This

Ask yourself these questions:

**Is your data fundamentally event-based?**

If you're modeling entities that _do things over time_ - users, sessions, orders, devices - Activity Schema maps naturally. If you're modeling static reference data or slowly-changing dimensions, stick with traditional approaches.

**Are your analysts struggling with joins?**

When simple questions require complex multi-table queries, the schema is fighting the questions. Activity Schema realigns the data model with how questions are actually asked.

**Do you need flexible, ad-hoc analysis?**

Star schemas optimize for known queries. Activity Schema optimizes for exploratory analysis where the questions aren't predetermined. The tradeoff: you need temporal join literacy instead of ERD literacy.

**Can you invest in the vocabulary?**

This isn't a drop-in replacement. Your team needs training, documentation, and practice. If you're moving fast with a small team, the overhead might not pay off. If you're building a platform for many analysts, the investment compounds.

## Closing Thoughts

I still haven't shipped Activity Schema to production. But writing this crystallized why I keep coming back to it.

The promise isn't to give you the one and only approach towards simplifying your warehouse. It's a different mental model - one where time is the primary relationship, not foreign keys. For event-driven domains, that matches reality more closely than dimensional modeling ever did.

If you're drowning in joins, debugging event sequences, or building a Customer 360, consider giving it a shot. Start with a single use case. Build intuition before going all-in.

The spec lives at [activityschema.com](https://www.activityschema.com). The ideas are simple enough to fit on one page - which might be the strongest argument for trying it.

{{< subscribe headline="Don't Rewrite These From Memory" description="The 12 temporal join patterns for BigQuery, Snowflake, DuckDB, and Redshift - ready to copy-paste." button="Send it" campaign="activity-schema" lead_magnet="temporal-joins-cheatsheet" >}}
