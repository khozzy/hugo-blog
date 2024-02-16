---
title: "Developers Guide to Data Lakes with Apache Iceberg"
<!-- slug: budget-data-lake-with-aws -->
date: 2024-02-08T10:54:39+01:00
author: Norbert
draft: true
tags:
- Data Engineering
---
## Why it matters? 🚀
- Data Lakes architecture draws very clear line between data storage and computation. It faciliates easier switch between different providers.
- Lower the bills by packing the storage layer with full-fledged database-like features.
- Data gravity?

## Your levarage
- Problems when using Hive and distributed object storage for processing huge amounts of data,
- Setup local research environment using [MinIO](https://min.io/) as data layer and both Apache Spark and Trino as the query engines,

---

## Apache Iceberg 101

Apache Iceberg is one of the most popular open **table format** implementation introduced by Netflix. It promises to solve three pressing issues regarding data processing:
1. **Atomic transactions** - Failing updates/appends won't leave the system in corrupted state,
2. **Consistent updates** - Preventing reads from failing or returning incomplete results during writes. Also handling potentially concurrent writes that conflict,
3. **Data & Metadata Scalability** - Avoiding bottlenecks with object store APIs and related metadata when tables grow to the size of thousands of partitions and billions of files.

You can think of it a a layer between physical data and information about how they are structured. A layer between the query engine and the data.

{{< admonition note "Once upon a time in Netflix land" >}} In past, Netflix data processing stack included Hive and S3. They struggled with issues around data consistency and performance. The problem stems from the fact that Hive keeps track of data at the *"folder"* level, so when many concurrent operations were executed, *file listings* operation quickly become a bottleneck. Moreover, because of the fact that distributed object storages are eventually consistent, there was a chance for certain files to appear missing.  {{< /admonition >}}

Iceberg solves many Hive bottlenecks. Instead of tracking data files using both a central metastore for partitions and a file system for individual files (like Hive) it lists all files using a tree structure persisted within a _snapshot_. 

{{< admonition info  "Snapshot">}}
The state of a table at some point in time, including the set of all data files.
{{< /admonition >}}

Every write or delete produces a new snapshot that reuses as much of the previous snapshot's metadata. Valid snapshots are stored in the table metadata file, along with a reference to the current snapshot. Commits replace the path of the current table metadata file using an atomic operation. This ensures that all updates to table data and metadata are atomic, and is the basis for serializable isolation. This leads to some interesiting properites:

- linear history of table changes,
- table rollback,
- safe file-level operations (ie. housekeeping)


{{< admonition info  "Concurrent write operations">}}
Iceberg supports multiple concurrent writes using optimistic concurrency.

Each writer assumes that no other writers are operating and writes out new table metadata for an operation. Then, the writer attempts to commit by atomically swapping the new table metadata file for the existing metadata file.

If the atomic swap fails because another writer has committed, the failed writer retries by writing a new metadata tree based on the new current table state.

[(source)](https://iceberg.apache.org/docs/latest/reliability/#concurrent-write-operations)
{{< /admonition >}}

### Table Spec

{{< figure src="images/iceberg-metadata.png" caption="Overview of Iceberg Table Spec [(source)](https://iceberg.apache.org/spec/#overview)." >}}

There are a few mentionable elements from the specification diagram, starting from the bottom:

- **Data file** - physical data files, formatted as Parquet, Avro or ORC files.
- **Manifest file** - contains a list of paths to related _data files_ with additional statistics (sorting, column boundaries, ...) used for query planning.
- **Manifest list** - Allows to reuse manifest files across many snapshots,
- **Matadata file (snapshot)** - maintains table state. All changes to table state create a new metadata file and replace the old metadata with an atomic swap. It tracks the table schema, partitioning config, custom properties, and snapshots of the table contents,
- **Catalog** - points to the most recent table snapshot.


## Infrastructure
...
### Data Storage
MinIO as a drop-in replacement for Amazon S3

```bash
docker-compose up -d minio
aws --endpoint-url http://localhost:9000 s3 mb s3://staging
aws --endpoint-url http://localhost:9000 s3 mb s3://wh-hadoop
aws --endpoint-url http://localhost:9000 s3 mb s3://wh-jdbc
```

> Setting the network alias for the container as well as the `MINIO_DOMAIN` environment variable is crucial for the solution to function correctly.  

### Metadata Catalog


{{< admonition info  "Catalogs">}}
TODO: Why not Hadoop. Why JDBC. Preferred Nessie over REST. Hadoop configured in repo.
{{< /admonition >}}

### Query engines

#### Apache Spark
Hadoop catalog configuration in the `spark-defaults.conf`. 
```properties
spark.sql.extensions                     org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions

spark.sql.defaultCatalog                 icebergcat
spark.sql.catalog.icebergcat             org.apache.iceberg.spark.SparkCatalog
spark.sql.catalog.icebergcat.type        hadoop
spark.sql.catalog.icebergcat.warehouse   s3a://warehouse
spark.sql.catalog.icebergcat.s3.endpoint http://minio:9000
spark.sql.catalog.icebergcat.io-impl     org.apache.iceberg.aws.s3.S3FileIO
spark.sql.catalogImplementation          in-memory

spark.hadoop.fs.s3a.endpoint             http://minio:9000
```

#### Trino
_"SQL at Any Scale, on Any Storage, in Any Environment"_ ~ [Trino: The Definitive Guide](https://trino.io/trino-the-definitive-guide.html).

{{< figure src="images/trino.png" caption="Commander Bun Bun" >}}

Trino is an open-source distributed query engine. It can efficiently query data against disparate data sources (relational DBs, NoSQL, key-value stores, object storage systems, Kafka, ...) using the ANSI-SQL syntax. It does not require to migrate the data to the central location before quering it, therefore decoupling compute from storage.

Some use-cases include:
- leveraging SQL skills to query data spanning different formats (useful for dashboarding and analytics),
- a new way of running ETL jobs across various data sources (think about dbt project),
- _federated querying_ combining data from various sources in a single statement,
- create a "virtual data warehouse" by defining a semantic layer from other datasources,
- data lakehouse query engine

{{< admonition note "Once upon a time in Facebook land" >}} Facebook is pionieer in two areas here. First they created Apache Hive to query the data using the Hadoop cluster, giving birth to a First-Generation table format.

Four years later, in 2012, Hive was unable to support the need for interactive queries (at this time cluster was digging through around 250 PB of data). After hitting a limits, they started to work on another, open-source project, designed to read data whery it live via pluggable connector system. Meet Presto (first connector was Hive). One year later, the project was used in production settings and spotted by other companies (Netflix, Linkedin and others.).

Later things moved quickly. Teradata made huge contributions to the project, AWS extended EMR offerings with Presto, and added the Athena service and Starburst made a business by trying to offer Presto everywhere.

In 2020, the project was renamed to Trino to avoid confusions with the legacy versions.
{{< /admonition >}}

## Environment setup
[Github repository](https://github.com/khozzy/iceberg-recipies).

For the purpose of the exercies we will utilize JDBC catalog using Postgres database, and will try to use two query engines interchangebly - Spark and Trino.

For the preparation we need to make sure to provision both the initial bucket for the data (in this case `s3://whjdbc`) and the metastore table structure. The first is obvious and can be accomplished in multiple ways, but for the metastore, there is a `JdbcUtil`[^jdbc_util] class in Iceberg source crafting required SQLs. The easiest way, that is also recommended by Trio docs[^trino_jdbc], is to just create a table using client like Spark.

```sql
-- Spark SQL
create table if not exists cat_jdbc.db.events (
    event_ts timestamp,
    level string,
    message string,
    stack_trace array<string>
)
using iceberg;
```

Spark used the configured `cat_jdbc` catalog to create a `db` database with `events` table. As the result two tables were created in the metastore:

- `iceberg_namespace_properties`
- `iceberg_tables`

Inside `iceberg_tables` there is one row, pointing to the latest snapshot file.

| catalog_name | table_namespace | table_name | metadata_location                                                                       | previous_metadata_location |
| ------------ | --------------- | ---------- | --------------------------------------------------------------------------------------- | -------------------------- |
| cat\_jdbc    | db              | events     | s3://whjdbc/db/events/metadata/00000-5b486875-7fb9-4c33-9753-2ed062a9c13d.metadata.json | NULL                       |

You can look at the file contents below:
```json
-- s3 cp s3://whjdbc/db/events/metadata/00000-5b486875-7fb9-4c33-9753-2ed062a9c13d.metadata.json - | jq
{
  "format-version": 2,
  "table-uuid": "712cc655-720b-43f5-b629-240236d31438",
  "location": "s3://whjdbc/db/events",
  "last-sequence-number": 0,
  "last-updated-ms": 1708083471114,
  "last-column-id": 5,
  "current-schema-id": 0,
  "schemas": [
    {
      "type": "struct",
      "schema-id": 0,
      "fields": [
        {
          "id": 1,
          "name": "event_ts",
          "required": false,
          "type": "timestamptz"
        },
        {
          "id": 2,
          "name": "level",
          "required": false,
          "type": "string"
        },
        {
          "id": 3,
          "name": "message",
          "required": false,
          "type": "string"
        },
        {
          "id": 4,
          "name": "stack_trace",
          "required": false,
          "type": {
            "type": "list",
            "element-id": 5,
            "element": "string",
            "element-required": false
          }
        }
      ]
    }
  ],
  "default-spec-id": 0,
  "partition-specs": [
    {
      "spec-id": 0,
      "fields": []
    }
  ],
  "last-partition-id": 999,
  "default-sort-order-id": 0,
  "sort-orders": [
    {
      "order-id": 0,
      "fields": []
    }
  ],
  "properties": {
    "owner": "spark",
    "write.parquet.compression-codec": "zstd"
  },
  "current-snapshot-id": -1,
  "refs": {},
  "snapshots": [],
  "statistics": [],
  "snapshot-log": [],
  "metadata-log": []
}
```


## Dive into Apache Iceberg

### Basics
- ACID?
- V1, V2 specs (https://iceberg.apache.org/spec/)?
- Merge on Read?

Before we begin we need to initialize JDBC catalog, the easiest way is to create a table in Spark.
https://github.com/apache/iceberg/blob/212355e13b3a8c40441725a260ae6e69bb1a0a9e/core/src/main/java/org/apache/iceberg/jdbc/JdbcCatalog.java#L66




### Schema evolution
Iceberg handles schema evolution more elegantly than Hive. In Hive, the functionality varies depending on the underneath file type. For example formats that use column names, like Parquet, operations deletes will be straigtforward, but for CSV file, where column position matters will be more problematic. This behaviour is susceptible to causing user errors if someone executes one of the unsupported operations on the wrong table.

Iceberg provides corectness guarantess by supporting a small subset of columnar file types (Parquet, Avro, ORC) capable of representing an internal schema within a file.

### Hidden partitioning
It's challenging the grasp the intricacies of Hive partitioning. For example, to partition the data by the timestamp field, you need to create a derived column (like a date) and make sure it is the last column in table's DDL of `VARCHAR` type. You end up with having duplicated data, and you need to somehow inform the consumers of the table which column to use for efficient data query.

Iceberg solves this issues by maintaining internal *partition specification*, and neither the user nor the consumer needs to know about it to take advantage of it. It can partition timestamps by year, month, day, and hour granularity. It can also use a categorical column, to store rows together and speed up queries. Moreover, the partition layout can evolve seamlessly if needed[^partition-evolution].

```sql
-- Spark SQL DDL
-- Creating partitioned table 
CREATE TABLE cat_jdbc.spark.logs (
    event_ts timestamp,
    level string,
    message string,
    stack_trace array<string>)
USING iceberg
PARTITIONED BY (days(event_ts));

-- Insert dummy rows
INSERT INTO cat_jdbc.spark.logs
VALUES
    (
        timestamp '2023-01-01 12:00:00.000001',
        'INFO',
        'App started', 
        NULL
    ),
    (
        timestamp '2023-01-02 13:20:00.000001',
        'ERROR',
        'Exception',
        array('java.lang.Exception: Stack trace at java.base/java.lang.Thread.dumpStack(Thread.java:1380)')
    ),
    (
        timestamp '2023-01-02 15:45:00.000001',
        'WARN',
        'NullPointerException',
        array('java.lang.NullPointerException: Stack trace at java.base/java.lang.Thread.dumpStack(Thread.java:1380)')
    );
```

Then, you can inspect the object storage directory layout.
{{< figure src="images/iceberg_partitions.png" caption="Partitions directory layout in Minio" >}}

{{< admonition info  >}}
You might take a sneak-peak into partitioning metadata[^spark-query-partitions][^trino-metadata] by executing the following query:

```sql
-- Spark SQL
select * from cat_jdbc.spark.logs.partitions

-- Trino
use warehouse.spark;
select * from "logs$partitions";
```
{{< figure src="images/trino_partitions_metadata.png" caption="Partitions metadata from Trino" >}}

[^spark-query-partitions]: https://iceberg.apache.org/docs/latest/spark-queries/#partitions
[^trino-metadata]: https://trino.io/docs/current/connector/iceberg.html#partitions-table
{{< /admonition >}}

{{< admonition info "Predicate pushdown" >}}
We might take a look at the physical query plan using the generated by both query engines to verify that only selected regions of data are scanned.

```sql
-- Spark SQL
explain
select * from cat_jdbc.spark.logs
where cast(event_ts as date) = '2023-01-02';

-- Trino
explain
select * from warehouse.spark.logs
where date_trunc('day', event_ts) = date('2023-01-02');
```

{{< figure src="images/spark-partition-query-plan.png" caption="Unfortunatelly, the query plan in Spark isn't very informative to actually verify if the predicate pushdown works as intended at the first glance. However, [this thread](https://github.com/apache/iceberg/issues/2517) explains that if `BatchScan` operation is configured with the `filters` attribute, the feature should work as expected." >}}

{{< figure src="images/trino-partition-query-plan.png" caption="The documentation of [Trino predicate pushdown](https://trino.io/docs/current/optimizer/pushdown.html) supports the claim that the feature works as intended: _If predicate pushdown for a specific clause is succesful, the `EXPLAIN` plan for the query does not include a `ScanFilterProject` operation for that clause._" >}}
{{< /admonition >}}

To change the table layout, partitioning structure you might create a snapshot of a new table might be crea

- https://iceberg.apache.org/docs/latest/spark-ddl/#replace-table-as-select
- https://trino.io/docs/current/connector/iceberg.html#replacing-tables

### Time travel
Replacing tables


### Write-Audit-Publish (WAP)
Branches

### GDPR regulations and auditing

{{< rawhtml >}}
<blockquote class="twitter-tweet" data-media-max-width="560"><p lang="en" dir="ltr">Here is my advice for running SQL queries in VSCode. Adding this keybinding will transfer the line to the underlying terminal process. Works great with DuckDb or Spark SQL. Even better with SQLFluff.<a href="https://twitter.com/hashtag/dataengineering?src=hash&amp;ref_src=twsrc%5Etfw">#dataengineering</a> <a href="https://twitter.com/hashtag/vscode?src=hash&amp;ref_src=twsrc%5Etfw">#vscode</a> <a href="https://t.co/yfWxTWHwnA">pic.twitter.com/yfWxTWHwnA</a></p>&mdash; Norbert Kozlowski (@don_khozzy) <a href="https://twitter.com/don_khozzy/status/1755535763750387728?ref_src=twsrc%5Etfw">February 8, 2024</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script> 
{{< /rawhtml >}}


## Resources
- https://medium.com/expedia-group-tech/a-short-introduction-to-apache-iceberg-d34f628b6799
- https://github.com/zsvoboda/ngods-stocks
- https://github.com/ivrore/apache-iceberg-minio-spark
- https://blog.cloudera.com/optimization-strategies-for-iceberg-tables/

<!-- Footnotes -->
[^trino_jdbc]: https://trino.io/docs/current/connector/metastores.html?highlight=jdbc#jdbc-catalog
[^jdbc_util]: https://github.com/apache/iceberg/blob/main/core/src/main/java/org/apache/iceberg/jdbc/JdbcUtil.java
[^partition-evolution]: https://iceberg.apache.org/docs/latest/evolution/#partition-evolution
