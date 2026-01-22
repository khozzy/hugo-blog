# SQL Patterns Reference (removed from main post)

These patterns were trimmed from the main blog post to create space for the cheat sheet CTA.

## Aggregate patterns

```sql
WITH cohort AS (
    SELECT entity, ts
    FROM activity_stream
    WHERE activity = 'cohort_activity'
)
SELECT c.*, COUNT(a.entity) as append_count  -- or SUM, AVG, etc.
FROM cohort c
LEFT JOIN activity_stream a
    ON c.entity = a.entity
    AND a.activity = 'append_activity'
    -- Ever: no time filter
    -- Before: AND a.ts < c.ts
    -- After: AND a.ts > c.ts
GROUP BY c.entity, c.ts
```

## In Between pattern (bounded by next cohort occurrence)

```sql
WITH cohort AS (
    SELECT entity, ts,
           LEAD(ts) OVER (PARTITION BY entity ORDER BY ts) as next_cohort_ts
    FROM activity_stream
    WHERE activity = 'cohort_activity'
)
SELECT c.*, a.some_feature
FROM cohort c
LEFT JOIN activity_stream a
    ON c.entity = a.entity
    AND a.activity = 'append_activity'
    AND a.ts > c.ts
    AND (a.ts < c.next_cohort_ts OR c.next_cohort_ts IS NULL)
```
