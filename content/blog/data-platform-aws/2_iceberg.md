---
title: "Apache Iceberg for the rescue"
date: 2023-07-03T12:05:02+02:00
draft: true
index: 2
---

## Creating Iceberg table
```sql
-- https://docs.aws.amazon.com/athena/latest/ug/querying-iceberg-creating-tables.html
CREATE TABLE events_iceberg (
    sensor_id int,
    measure float,
    event_time timestamp)
PARTITIONED BY (sensor_id, day(event_time))
LOCATION 's3://kozlovski-data/events_iceberg'
TBLPROPERTIES ( 'table_type' = 'ICEBERG' )
```
or CTAS table creation

```sql
INSERT INTO events_iceberg("sensor_id", "measure", "event_time")
SELECT "sensor_id", "measure", "event_time" FROM sensors_json;
```

## The Iceberg advantage
Now that your data is in an Iceberg table you can take advantage of DML to run updates, deletes, and upserts on your data.

Athena [DDL](https://docs.aws.amazon.com/athena/latest/ug/ddl-reference.html) and [DML](https://docs.aws.amazon.com/athena/latest/ug/dml-queries-functions-operators.html).
 


### Optimization
Optimize and vacuum https://docs.aws.amazon.com/athena/latest/ug/querying-iceberg-data-optimization.html
```sql
OPTIMIZE iceberg_table REWRITE DATA USING BIN_PACK;
```

`MSCK REPAIR` is not needed since Iceberg keeps track of all metadata itself

To optimize query times, all predicates are pushed down to where the data lives.

## Limitations
Leverage Apache Spark as compute engine to make use of WAP workflow or to create sorted table (z-order).

https://www.dremio.com/blog/how-z-ordering-in-apache-iceberg-helps-improve-performance/

## Links
- https://aws.amazon.com/blogs/big-data/perform-upserts-in-a-data-lake-using-amazon-athena-and-apache-iceberg/
- https://aws.amazon.com/blogs/big-data/use-apache-iceberg-in-a-data-lake-to-support-incremental-data-processing/
- https://aws.amazon.com/blogs/big-data/orca-securitys-journey-to-a-petabyte-scale-data-lake-with-apache-iceberg-and-aws-analytics/
- https://stackoverflow.com/questions/58550593/alternative-to-create-more-than-100-partitions-on-athena-ctas
- https://catalog.us-east-1.prod.workshops.aws/workshops/9981f1a1-abdc-49b5-8387-cb01d238bb78/en-US/90-athena-acid