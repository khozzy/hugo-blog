---
title: "Activity Schema: The Data Model That Fixed My QA Debugging"
slug: activity-schema
date: 2025-06-04T08:00:00+01:00
author: Norbert
draft: false
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

That's the premise of _Activity Schema_ - and after using it on an internal project, I'm convinced it's the right model for event-driven domains. I built it for a QA team debugging event sequences across 4+ codebases and a million daily users - and it delivered. Catching sequence bugs that would have taken hours to find with traditional joins. Faster debugging cycles. Systematic anomaly detection that became part of daily workflows.

This post isn't a tutorial. It's a mental model. I want you to understand _why_ this approach works, _when_ it makes sense, and _what tradeoffs_ you're signing up for.

## When Events Misbehave

The use case where Activity Schema proved itself was debugging a VOD player. Different app versions were emitting events in invalid order - playback starting before player initialization, buffering sessions without end events. Telemetry chaos.

The scale made traditional debugging impractical: 4+ separate codebases (web, mobile, TV, partner extensions), each with multiple active app versions, roughly 1M DAU, playback heartbeats every minute, and 10 distinct player activities. Correlating sequences across this volume meant joining massive tables repeatedly just to answer basic questions.

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

{{< admonition type="example" title="Before/After: A Conversion Query" open=true >}}
**Business question**: "For every user who converted to paid, what was the last video they watched before subscribing, and how many videos total?"

| Metric | Star Schema | Activity Schema |
|--------|-------------|-----------------|
| Tables | 4 | 1 |
| JOINs | 5 | 2 |
| Lines | 30 | 27 |
| Mental model | "How do these tables relate?" | "What's my cohort? What do I append?" |

Same answer, different mental load. The Activity Schema query follows one repeatable pattern. The star schema requires mapping four tables and their relationships before you write a single line.

**Sample output** (identical from both approaches):

| user_id | converted_at | plan_type | last_video_title | videos_watched_before |
|---------|--------------|-----------|------------------|----------------------|
| user_042 | 2025-06-01 14:32 | paid | Breaking Bad S01E01 | 12 |
| user_087 | 2025-06-02 09:15 | paid | The Office Pilot | 3 |
| user_156 | 2025-06-02 18:45 | paid | Planet Earth II | 27 |
| user_203 | 2025-06-03 11:20 | paid | NULL | 0 |

User 203 converted without watching any videos first - a referral or direct signup worth investigating.

{{< rawhtml >}}
<details>
<summary><strong>Star Schema SQL</strong> (30 lines, 4 tables, 5 JOINs)</summary>
{{< /rawhtml >}}

```sql
WITH subscription_events AS (
    SELECT s.user_id, s.started_at AS converted_at, s.plan_type
    FROM subscriptions s
    WHERE s.plan_type = 'paid'
),
last_video_before_conversion AS (
    SELECT vv.user_id, vv.video_id, vv.started_at,
           ROW_NUMBER() OVER (
               PARTITION BY vv.user_id ORDER BY vv.started_at DESC
           ) AS rn
    FROM video_views vv
    INNER JOIN subscription_events se
        ON vv.user_id = se.user_id AND vv.started_at < se.converted_at
),
video_count_before_conversion AS (
    SELECT vv.user_id, COUNT(*) AS videos_watched_before
    FROM video_views vv
    INNER JOIN subscription_events se
        ON vv.user_id = se.user_id AND vv.started_at < se.converted_at
    GROUP BY vv.user_id
)
SELECT u.user_id, u.name, se.converted_at, se.plan_type,
       v.title AS last_video_title, vc.videos_watched_before
FROM subscription_events se
LEFT JOIN users u ON se.user_id = u.user_id
LEFT JOIN last_video_before_conversion lv
    ON se.user_id = lv.user_id AND lv.rn = 1
LEFT JOIN videos v ON lv.video_id = v.video_id
LEFT JOIN video_count_before_conversion vc ON se.user_id = vc.user_id;
```

{{< rawhtml >}}
</details>

<details>
<summary><strong>Activity Schema SQL</strong> (27 lines, 1 table, 2 JOINs)</summary>
{{< /rawhtml >}}

```sql
WITH cohort AS (
    SELECT entity AS user_id, ts AS converted_at,
           JSON_VALUE(features, '$.plan_type') AS plan_type
    FROM activity_stream
    WHERE activity = 'subscription_started'
      AND JSON_VALUE(features, '$.plan_type') = 'paid'
),
last_video_before AS (
    SELECT entity, ts,
           JSON_VALUE(features, '$.title') AS title,
           ROW_NUMBER() OVER (PARTITION BY entity ORDER BY ts DESC) AS rn
    FROM activity_stream
    WHERE activity = 'video_start'
),
videos_count_before AS (
    SELECT entity, COUNT(*) AS videos_watched_before
    FROM activity_stream WHERE activity = 'video_start'
    GROUP BY entity
)
SELECT c.user_id, c.converted_at, c.plan_type,
       lv.title AS last_video_title,
       COALESCE(vc.videos_watched_before, 0) AS videos_watched_before
FROM cohort c
LEFT JOIN last_video_before lv
    ON c.user_id = lv.entity AND lv.rn = 1 AND lv.ts < c.converted_at
LEFT JOIN videos_count_before vc ON c.user_id = vc.entity;
```

{{< rawhtml >}}
</details>
{{< /rawhtml >}}

{{< /admonition >}}

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

{{< gumroad url="https://nkozlovski.gumroad.com/l/kopcm" headline="Get the SQL Cheat Sheet" description="All 12 temporal join patterns as runnable DuckDB examples. Dialect reference included for BigQuery, Snowflake, and Redshift." button="Download Free" >}}

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

**Compliance and QA**

This is where I saw it work firsthand. Validating event sequences becomes explicit. "Find sessions where `video_start` happened before `player_ready`" is a temporal join that returns NULLs on the append side. What used to be multi-hour debugging sessions turned into five-minute queries.

Regulatory rules often require proving order: "approval happened before execution", "consent collected before data processing". The join returns NULL when sequence is violated - compliance checks become queries, not audits.

**Customer 360 / User Journey Teams**

"What did user X do before churning?" becomes a single self-join instead of a multi-table expedition. Customer timelines live in one place. Dynamic cohorts based on behavioral sequences - "users who viewed pricing 3+ times before signing up" vs "impulse converters" - are aggregate temporal joins that feed directly into marketing systems or personalization engines.

**Feature Engineering for ML**

Temporal relationships map directly to ML features: "time since last X", "count of Y before Z", "first value of A after cohort". Instead of bespoke feature pipelines per model, you have a standard vocabulary. A churn model and a fraud model use the same append patterns - just different activities.

The value isn't the single table - it's that temporal relationships become composable building blocks for any downstream system that needs behavioral context.

## The Tradeoffs

I shipped this internally but the project ended before broader adoption. Here's what I learned about the tradeoffs:

**You need a documented vocabulary**

The 12 temporal relationships are powerful, but your team needs to internalize them. "Last before" vs "first after" is intuitive once you get it - but there's a learning curve. Documentation and examples become essential.

Beyond the relationships, you also need consistent, documented activity names. Is it `video_start` or `videoStarted` or `playback_started`? Without a canonical list of activities and their meanings, queries become guesswork. The schema is simple, but governance is not optional.

**Features JSON can get bloated**

Stuffing contextual data into a JSON column is flexible but dangerous without discipline. Every producer adding "just one more field" leads to bloated payloads with inconsistent keys across activity types. Query syntax varies by warehouse (DuckDB's `json_extract_string` vs BigQuery's `JSON_VALUE` vs Snowflake's `GET_PATH`). You need clear guidelines on what belongs in features vs what deserves its own activity.

**Not for every workload**

OLTP? No. Real-time dashboards with sub-second latency? Probably not. Activity Schema is optimized for analytical queries on incremental, historical event streams. Know your access patterns.

**Incremental updates need thought**

Late-arriving events, retroactive corrections, backfills - these are solvable but require explicit handling. The "single source of truth" promise holds only if your ingestion pipeline maintains it.

## Where It Didn't Fit

Not every evaluation ended with adoption. On a different project, we considered Activity Schema for marketing segmentation - the data team was spending 50% of sprint capacity (75% in peak sprints) on repetitive ad-hoc segment requests, blocking development work and creating bottlenecks for campaigns.

Activity Schema seemed promising: behavioral cohorts are exactly what temporal joins excel at. But we rejected it for three reasons:

**The learning curve was too steep for this team.** The temporal join vocabulary takes time to internalize. For a team already underwater with requests, adding a new mental model wasn't realistic. They needed relief now, not in three months.

**Columnar storage inefficiency.** The features JSON column fights columnar storage. Modern warehouses optimize for typed columns they can compress and scan efficiently - not nested JSON that requires parsing at query time. The syntax bloat of `JSON_VALUE(features, '$.field')` across every query adds friction and runtime overhead.

**Cross-entity analytics require multiple stream joins.** Segmentation often combines user-level, account-level, and organization-level attributes. Activity Schema's single-entity-per-stream assumption meant we'd need to join multiple activity streams anyway - erasing the "one table" simplicity.

We're now evaluating star schema versus OBT (One Big Table) for this use case.

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

**Are you solving an internal problem first?**

Activity Schema works well as a QA or debugging tool before committing to it for customer-facing analytics. Start with an internal use case - event sequence validation, anomaly detection, root cause analysis - where the stakes are lower and learning is faster. Once your team builds intuition, broader adoption becomes natural.

## Closing Thoughts

The internal project where I used Activity Schema ended before we could expand it beyond QA. But what I saw convinced me: for a team debugging event sequences daily, the model worked. Queries that used to require mental gymnastics became mechanical. The vocabulary took a few days to internalize - then it clicked.

If I were starting a greenfield analytics project today, I'd seriously consider Activity Schema for the core event layer. Not because it's simpler in every way - the temporal join vocabulary has a learning curve - but because it aligns the data model with how we actually ask questions about user behavior.

If you're drowning in joins, debugging event sequences, or building a Customer 360, consider giving it a shot. Start with a single internal use case. Build intuition before going all-in.

The spec lives at [activityschema.com](https://www.activityschema.com). The ideas are simple enough to fit on one page - which might be the strongest argument for trying it.

{{< gumroad url="https://nkozlovski.gumroad.com/l/kopcm" headline="Don't Rewrite These From Memory" description="12 copy-paste SQL patterns with generic templates and worked examples for each." button="Download Free" >}}
