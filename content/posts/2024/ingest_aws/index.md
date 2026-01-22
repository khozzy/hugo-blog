---
title: "From Ingestion to Insight: Creating a Budget-Friendly Data Lake with AWS"
slug: budget-data-lake-with-aws
summary: "Build a serverless, cost-efficient data lake on AWS using Kinesis Firehose, S3, Glue, and Athena. Learn dynamic partitioning, JSON vs Parquet trade-offs, and query optimization techniques that keep your AWS bill under a dollar."
date: 2024-02-02T12:05:02+02:00
author: Norbert
draft: false
subscribe:
  enable: false
tags:
  - Data Engineering
  - Cloud Computing
---

## Why it matters? 🚀

- The solution is equipped to handle both structured and unstructured data, a crucial aspect for both analytical and engineering tasks.
- It is capable of facilitating both real-time streaming and batch data processing.
- With proper configuration, it proves to be cost-efficient and scalable; both storage and processing tiers are decoupled and highly optimized.
- The solution adheres to regulatory and compliance requirements, ensuring data protection and the safeguarding of sensitive information.

## What you will learn?

- How specific AWS services synergize to provide a serverless data platform.
- A no-code approach to establishing an infrastructure capable of collecting, transforming, and querying underlying data with minimal cost implications.
- The practical distinctions between representing files in JSON and Parquet formats.
- Techniques for querying streaming data in quasi real-time using the SQL language.

---

## Story background

Imagine being the owner of a cutting-edge bio-hacking startup. Naturally, your focus lies in meticulously monitoring user behavior, uncovering invaluable insights, and computing pertinent metrics that stand up to the scrutiny of potential investors.

Since the initial release of your app, during the early stages of the telemetry process, you made the strategic decision to meticulously track three fundamental events: the occurrence of an `anonymous_app_visit`, the completion of an `account_registration`, and the creation of a `measurement_record` (which signifies users inputting their medical data for subsequent analysis).

Anticipating an exponential surge in user growth in the near future, we are actively preparing a robust, scalable, and highly secure mechanism for efficient data collection. To expedite the development progress, a set of user sessions was modeled as a _Markov Decision Process_, where each state carries a specific transition probability.

{{< mermaid >}}
stateDiagram-v2
anonymous_visited: Anonymous app visit
account_created: Account created
measurement_recorded: Measurement recorded
interest_lost: Lost interest

    [*] --> anonymous_visited
    anonymous_visited --> anonymous_visited: 40%
    anonymous_visited --> account_created: 40%
    anonymous_visited --> interest_lost: 20%

    account_created --> measurement_recorded: 70%
    account_created --> interest_lost: 30%

    measurement_recorded --> measurement_recorded: 90%
    measurement_recorded --> interest_lost: 10%

    interest_lost --> interest_lost: 100%
    interest_lost --> [*]

{{< /mermaid >}}

In preparation, we have compiled a synthetic dataset comprising 100,000 distinct user sessions, each encompassing one or more events. This dataset will be utilized in the exercises ahead ([source code](xxx)). To emulate real-world scenarios, intentional inclusion of duplicated events adds an extra layer of authenticity.

## Layman's system architecture

In the initial approach, our strategy involves creating a dedicated service process that exposes an HTTP collector endpoint. This process performs the initial data processing and subsequently transmits the processed data downstream for storage, either in a database or a file system.

{{< figure src="images/naive-approach.png" caption="Naive Approach System Architecture." >}}

While this design could be functional, it comes with several notable drawbacks:

- **Scalability Challenges**: The allocated resources might struggle to manage high levels of incoming traffic.
- **Maintenance Complexities**: Introducing each new proprietary component adds to the overall system complexity and maintenance workload.
- **Reinventing the Wheel**: There's a risk of duplicating efforts by independently handling exceptional cases and communication with other system components.

We understand the importance of optimizing our engineering resources and avoiding unnecessary upkeep. That's why we're excited to present a more refined proposal that addresses these concerns.

## Native components of Amazon AWS

To accomplish the goal we put the following AWS services in our crosshairs:

- The [Kinesis Data Firehose](https://docs.aws.amazon.com/firehose/latest/dev/basic-deliver.html) service: This allows us to securely ingest and store incoming payloads.
- [S3](https://aws.amazon.com/s3/) and [Glue](https://aws.amazon.com/glue/): These form the storage layer and logical data catalog, ensuring efficient data management.
- [Athena](https://aws.amazon.com/athena/): As a query engine, Athena enables us to access underlying data using declarative semantics.

> **🚨 Attention: Data Security 🚨**
>
> Given our engagement with medical records, we must uphold rigorous regulations pertaining to sensitive data. Potential legal violations or data breaches could have severe consequences for our company.
>
> By implementing data encryption measures for both data at rest and data in transit, we can effectively fulfill regulatory and compliance prerequisites for data protection, thus ensuring the safety of sensitive information.
>
> We have the opportunity to utilize the cryptographic capabilities offered by Amazon AWS, which have been specifically designed to fulfill diverse compliance requirements such as GDPR, HIPAA, and PCI DSS. Amazon AWS undergoes regular audits and certifications to validate its security practices and demonstrate its adherence to industry standards.

### Storing data as JSON

Kinesis Firehose operates by exposing an endpoint to consume events, subsequently gathering and buffering them for a predetermined duration or data volume. Once these thresholds are reached, it efficiently deposits a batch of data into a predefined location. In our specific scenario, this location is none other than Amazon S3.

For the initial illustration, our emphasis will be on the storage of data in its native form - as JSON objects.

{{< highlight tf "noClasses=false, tabWidth=2" >}}
resource "aws_kinesis_firehose_delivery_stream" "json_firehose_stream" {
name = "${var.firehose_stream_name}\_json"
destination = "extended_s3"

server_side_encryption {
enabled = true
key_type = "AWS_OWNED_CMK"
}

extended_s3_configuration {
role_arn = aws_iam_role.firehose_delivery_role.arn
bucket_arn = aws_s3_bucket.sink.arn

    buffer_size     = 64 # mb
    buffer_interval = 60 # sec

    compression_format = "GZIP"

    prefix              = "events_raw/json/name=!{partitionKeyFromQuery:event_name}/d=!{timestamp:yyyy-MM-dd}/"
    error_output_prefix = "errors/json/d=!{timestamp:yyyy-MM-dd}/!{firehose:error-output-type}/"

    dynamic_partitioning_configuration {
      enabled = "true"
    }

    processing_configuration {
      enabled = "true"

      processors {
        type = "MetadataExtraction"
        parameters {
          parameter_name  = "JsonParsingEngine"
          parameter_value = "JQ-1.6"
        }
        parameters {
          parameter_name  = "MetadataExtractionQuery"
          parameter_value = "{event_name:.name, event_date:.tstamp | split(\".\")[0] | strptime(\"%Y-%m-%d %H:%M:%S\") | strftime(\"%Y-%m\")}"
        }
      }
    }

}
}
{{< / highlight >}}

When examining the Terraform resource declaration, we can observe several intricate aspects in play. Let's begin from the top:

We are making use of the _server-side encryption_ feature. This implies that our data will be automatically encrypted at rest using AWS-owned keys. While it's also possible to use our own cryptographic keys, we prefer to capitalize on AWS's compliance certifications, ensuring that your data meets the necessary regulatory requirements.

Moving on, we are configuring the S3 sink. Notably, the implementation involves _dynamic partitioning_, which allows us to process the contents of each incoming object. Depending on its attributes, we determine the desired storage path. We utilize this technique to construct a Hive-like file path structure. This structure facilitates the utilization of the "_predicate projection_" feature, which significantly enhances query effectiveness at a later stage. As part of the design, we categorize events by a tuple of name and processing date.

```
s3://<bucket>/events_raw/json/name=<event_name>/d=<etl_date>
```

Please take note that the date in the path (prefixed with `d=`) represents the "message processing timestamp" rather than the event generation timestamp. This deliberate choice aims to facilitate future incremental data processing.

> It's crucial to monitor the total number of partitions within a batch, which are combinations of parameters forming an object path. If this count exceeds the account [quotas](https://docs.aws.amazon.com/firehose/latest/dev/limits.html), Kinesis Firehose will generate the _"The number of active partitions has exceeded the configured limit"_ error.

Subsequently, we make use of [_data processors_](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-kinesisfirehose-deliverystream-processor.html) to transform and process streaming data before sending it to the destination. In this scenario, each incoming object undergoes processing by the `MetadataExtractionQuery` processor, which extracts specified parameters from the message payload. These parameters might subsequently be employed to dynamically construct the object path.

> **Delimiters for text payloads in Kinesis Firehose**
>
> Pay close attention to the way the producer emits events. By default, Kinesis Data Firehose buffers incoming payloads by concatenating them without applying any delimiters. Consequently, for a series of incoming JSON messages, the file dropped on S3 might exhibit the following structure:
>
> ```
> {...}{...}{...}
> ```
>
> This situation is tricky because the stored file does not meet the requirements for a properly formatted JSON file, which could impact downstream processes. Although tools like AWS Athena will continue to operate, they may produce incorrect results that could be challenging to identify initially. In the past, workarounds involved creating custom Lambda functions to add delimiters to records. However, now this task is as simple as configuring the delivery stream properly with the `AppendDelimiterToRecords` data processor.

### Efficient Data Storage with Parquet Format

Let's proceed to create a secondary Kinesis Firehose delivery configuration, closely resembling the JSON setup mentioned earlier. The primary distinction here lies in our utilization of the _"Record format conversion"_ feature, facilitating seamless real-time data transformation from JSON to the optimized Parquet format.

Observe the configuration block for `parquet_ser_de` [output serializer configuration](https://docs.aws.amazon.com/firehose/latest/APIReference/API_ParquetSerDe.html), which offers the flexibility to define parameters such as compression techniques and HDFS block size. For the sake of a more equitable comparison, we will, however, retain the default settings.

{{< highlight tf "noClasses=false, tabWidth=2">}}
resource "aws_kinesis_firehose_delivery_stream" "parquet_firehose_stream" {
#...

    data_format_conversion_configuration {
      input_format_configuration {
        deserializer {
          hive_json_ser_de {}
        }
      }

      output_format_configuration {
        serializer {
          parquet_ser_de {
            compression = "GZIP"
          }
        }
      }

      schema_configuration {
        database_name = aws_glue_catalog_database.glue_db.name
        table_name    = aws_glue_catalog_table.events_parquet.name
        role_arn      = aws_iam_role.firehose_delivery_role.arn
      }
    }

    # ...

}
{{< / highlight >}}

This declaration also necessitates that we specify the schema for the underlying data, which will be defined in the subsequent section.

{{< subscribe
  headline="Skip the Copy-Paste"
  description="Get the complete Terraform module for this setup. Both JSON and Parquet Firehose streams, Glue tables, IAM roles—ready to deploy."
  campaign="budget-data-lake-with-aws"
  lead_magnet="aws-data-lake-terraform"
  button="Send the Code"
>}}

## Data ingestion

With the Kinesis Delivery Streams now prepared, it's time to populate them with data. Once our synthetic dataset is generated, we will transfer it in batches using the [`put_record_batch`](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/firehose/client/put_record_batch.html) API operation. This transfer will be done separately for each stream. You can find the [source code](...) for this process here.

The dataset itself comprises over 700,000 raw events, amounting to a total storage of 165 MB.

Our aim is to gain an initial sneak peek into how the data is stored and to gather an overview of the statistics for the S3 bucket as a whole.

{{< highlight bash "noClasses=false, tabWidth=2">}}

# JSON sink bucket stats

$ aws s3 ls s3://<bucket>/events_raw/json/ --recursive --human-readable --summarize

# ...

Total Objects: 21
Total Size: 44.1 MiB
{{< / highlight >}}

{{< highlight bash "noClasses=false, tabWidth=2">}}

# Parquet sink bucket stats

$ aws s3 ls s3://<bucket>/events_raw/parquet/ --recursive --human-readable --summarize

# ...

Total Objects: 20
Total Size: 39.5 MiB
{{< / highlight >}}

{{< highlight bash "noClasses=false, tabWidth=2">}}

# First few rows from decompressed JSON file

aws s3 cp s3://<bucket>/events_raw/json/name=anonymous_visited/d=2023-07-31/<file>.gz - | gzip -d | head
{"name": "anonymous_visited", "tstamp": "2023-06-18 14:27:52.000000", "payload": "{\"dvce_os\": \"Android 4.3.1\", \"session_id\": \"FQMDaWRSHuZGMOJKzQIn\"}", "payload_md5": "000016e7e672dddb6b7cdd607c4e372b"}
{"name": "anonymous_visited", "tstamp": "2023-07-13 23:37:36.000000", "payload": "{\"dvce_os\": \"Android 4.4.4\", \"session_id\": \"jskhzgwpJlsaQNXaHtug\"}", "payload_md5": "000255049d7957c9c6215603e2b08705"}
{"name": "anonymous_visited", "tstamp": "2021-10-21 22:33:11.000000", "payload": "{\"dvce_os\": \"Android 2.2.3\", \"session_id\": \"CRZxPoPbwxseqSxQeDRm\"}", "payload_md5": "00042a7dc53777728a0aeaa356708a89"}
{"name": "anonymous_visited", "tstamp": "2022-05-16 16:54:37.000000", "payload": "{\"dvce_os\": \"Android 4.1.1\", \"session_id\": \"KJKjskuxPPEjzLJrUvzV\"}", "payload_md5": "000431121dbd8621cf2405ebc214666c"}
{"name": "anonymous_visited", "tstamp": "2023-07-14 19:31:06.000000", "payload": "{\"dvce_os\": \"Android 2.0.1\", \"session_id\": \"IgCPBUmXUlTfjTHojLon\"}", "payload_md5": "00044ea8461e0996d3d673202902ab41"}
{"name": "anonymous_visited", "tstamp": "2022-11-13 23:38:12.000000", "payload": "{\"dvce_os\": \"Android 4.0.2\", \"session_id\": \"VnvTGRFUkAyOGFSbbdaU\"}", "payload_md5": "00048dc6f7ebd7d4c98c04e689c0b1ad"}
{"name": "anonymous_visited", "tstamp": "2022-12-17 04:11:56.000000", "payload": "{\"dvce_os\": \"Android 2.2.1\", \"session_id\": \"zfcjSCXzeYjvTGCBvKSS\"}", "payload_md5": "0004f9872cef650f84fcf734b9e58722"}
{"name": "anonymous_visited", "tstamp": "2023-07-20 14:00:00.000000", "payload": "{\"dvce_os\": \"Android 3.2.3\", \"session_id\": \"UmrcciBVaxuKftXTYmKG\"}", "payload_md5": "000566837b27bbda0310798ce0e63bf5"}
{"name": "anonymous_visited", "tstamp": "2023-05-01 18:28:29.000000", "payload": "{\"dvce_os\": \"Android 3.2.5\", \"session_id\": \"NLgsXzWGntGebfDEFEkL\"}", "payload_md5": "0005a3b04e32ecc08dad9c6990194c9f"}
{"name": "anonymous_visited", "tstamp": "2021-07-25 19:55:18.000000", "payload": "{\"dvce_os\": \"Android 2.3.4\", \"session_id\": \"itAqBfmzNBaLAlydARtE\"}", "payload_md5": "0005d027655753217b46305bdc40e035"}
{{< / highlight >}}

Both streams have successfully reduced their sizes by almost 4 times, thanks to the chosen data compression method. Notably, Parquet format exhibits slightly superior efficiency due to its internal binary format representation.

## Data Querying

With the streaming data being consistently stored in Amazon S3 at regular time intervals, we can now delve into the core of data analysis. Our approach involves harnessing the capabilities of AWS Glue, which offers a sophisticated logical portrayal of the data's structure. Additionally, we employ AWS Athena, a distributed computing engine.

To initiate the process, we commence by defining the necessary resources for two AWS Glue tables: `events_json` and `events_parquet`.

{{< highlight tf "noClasses=false, tabWidth=2" >}}
resource "aws_glue_catalog_table" "events_json" {
database_name = aws_glue_catalog_database.glue_db.name
name = "events_json"

table_type = "EXTERNAL_TABLE"

parameters = {
"EXTERNAL" : "true",
"classification" : "json"
}

partition_keys {
name = "name"
type = "string"
}

partition_keys {
name = "d"
type = "string"
}

storage_descriptor {
location = "s3://${aws_s3_bucket.sink.id}/events_raw/json/"
input_format = "org.apache.hadoop.mapred.TextInputFormat"
output_format = "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat"

    ser_de_info {
      serialization_library = "org.openx.data.jsonserde.JsonSerDe"
    }

    columns {
      name = "tstamp"
      type = "timestamp"
    }

    columns {
      name = "payload"
      type = "string"
    }

    columns {
      name = "payload_md5"
      type = "string"
    }

}
}
{{< / highlight >}}

{{< highlight tf "noClasses=false, tabWidth=2" >}}
resource "aws_glue_catalog_table" "events_parquet" {
database_name = aws_glue_catalog_database.glue_db.name
name = "events_parquet"

table_type = "EXTERNAL_TABLE"

parameters = {
EXTERNAL = "TRUE"
"classification" : "parquet"
}

# ... (removed duplicated code for brevity)

storage_descriptor {
location = "s3://${aws_s3_bucket.sink.id}/events_raw/parquet/"
input_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat"
output_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat"

    ser_de_info {
      serialization_library = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"

      parameters = {
        "serialization.format" = 1
      }
    }

    # ...

}
{{< / highlight >}}

[//]: # "LOL END, Rewrite this section to be grammatically correct, acting as a data engineering expert targeting prospects for the software development company:"

We must deliberately mention each data column within our data and partition keys constituting a path to the object (used for the later _"predicate pushdown"_ optimization). We also set the `EXTERNAL` property, indicating that the table metadata is stored inside AWS Glue Data Catalog, but the data resides in the external data source (S3).

{{< figure src="images/aws_glue_tables.png" caption="Created tables in AWS Glue web console." >}}

Glue also enables a more automatic way of discovering and registering tables based on the underlying by using _Glue Crawlers_. However, we prefer to have more control over the process, therefore, declare things manually.

> **Pro-tip**: Occasionally, modifications to AWS Glue tables may not be propagated accurately. If you encounter unusual behavior, it is recommended to delete the table and then recreate it.

Now that everything is in place, let's attempt to execute some queries in Athena. Interestingly, upon attempting to preview the table, you will notice that there are no results available at this stage. This is because the existing partitions have not been registered in the Glue metastore. There are at least two approaches to resolve this::

1. Utilize the `MSCK REPAIR TABLE <table_name>;` command to automatically discover the recursive partition structure at the given location.
2. Alternatively, you can opt for a manual approach for each directory by using the `ALTER TABLE <table_name> ADD PARTITION (event_name="...", d="...") LOCATION "s3://..."` command.

It's important to note that this action needs to be repeated whenever a new partition becomes available.

{{< figure src="images/events_json_select.png" caption="Structure of the `events_json` table. Notice that partitions appear as a table's columns." >}}

Let's imagine that we're interested in obtaining an aggregated view of anonymous user sessions that occurred in June 2023. The corresponding SQL query could be formulated as follows::

{{< highlight sql "noClasses=false, tabWidth=2" >}}
WITH
    junes_anonymous_visits AS (
        SELECT *
        FROM kozlovski.events_json
        WHERE name = 'anonymous_visited' 
            AND DATE_TRUNC('month', tstamp) = date('2023-06-01')
    ),
    extracted AS (
        SELECT DISTINCT
            date_trunc('day', tstamp) AS day,
            json_extract_scalar(payload, '$.session_id') AS session_id
        FROM junes_anonymous_visits
    ),
    groupped AS (
        SELECT
            day,
            COUNT(*)
        FROM extracted
        GROUP BY 1
    )
SELECT * FROM groupped ORDER BY 1;
{{< / highlight >}}

Long story short, we can leverage the declarative SQL syntax alongside proprietary functions (like parsing JSON objects) to model and query the underlying data. Moreover, Athena transiently handles compressed and encrypted data.

Let's execute the query above using two created tables as a source and observe the metadata.

{{< figure src="images/athena_json.png" caption="8.18 MB of data scanned when using the `events_json` table." >}}
{{< figure src="images/athena_parquet.png" caption="4.19 MB of data scanned when using the `events_parquet` table." >}}

In both cases, we see that the amount of data scanned is significantly less than the total data stored on S3 buckets. That is caused by the _predicate projection_ feature, deciding what the location of the objects is - in this case, only `anonymous_visited` partition is investigated (located in its own subdirectory structure). Utilization of Parquet format is even more efficient by leveraging the _predicate pushdown_ scanning only the relevant portions of the file (containing columns of interest). Since Athena's pricing model is a function of the data scanned, that directly affects the final AWS bill.

## Cost estimation

The projected AWS cost estimates for operating the provided examples amount to less than a dollar. A detailed breakdown is provided below. The largest portion of the cost can be attributed to AWS Athena. It's important to note that this estimation is based on the assumption of 100 full-scan queries (which might not be very optimal) being executed daily for a month, without accounting for any caching mechanisms. For more information, you can refer to the [AWS cost calculator](https://calculator.aws).

| **Service**           | **Input (monthly)**         | **Cost**  |
| --------------------- | --------------------------- | --------- |
| Kinesis Data Firehose | 700k events (1kB each)      | $0.10     |
| S3                    | 0.01 GB                     | $0.00     |
| Glue                  | 2 tables                    | $0.00     |
| Athena                | 100 full scan queries daily | $0.73     |
|                       |                             | **$0.83** |

## Closing thoughts

We have observed that AWS Kinesis Data Firehose offers a remarkably straightforward mechanism for achieving scalable data ingestion.

By making use of the concept of _"dynamic partitioning"_, we can effectively harness the power of _"predicate pushdown"_ by physically organizing rows into directories. Moreover, through the activation of the _"Record format conversion"_ feature, we can seamlessly convert data into Parquet files during the data's flight. This, in turn, empowers us to further benefit from the _"projection pushdown"_ capability, as it enables the scanning of only those file blocks that contain pertinent data.

While the solution presented represents a great initial stride, it does carry certain noteworthy limitations:

1. The optimal efficiency of Parquet files is typically achieved when the file size maintains a range of around 64-128MB. Accomplishing this might involve extending the buffering window of Kinesis Firehose, albeit at the expense of increased solution latency. Presently, the size of generated files is contingent upon the velocity of incoming data, which in turn increases the likelihood of generating numerous smaller files, consequently introducing additional computational overhead.
2. To execute queries with efficiency, data analysts are required to possess an understanding of the data partitioning scheme (the physical layout of the data).
3. The range of available Data Manipulation Language (DML) operations is rather limited, precluding updates and deletes. Furthermore, a mechanism to control access to the data is noticeably absent.

In the subsequent posts, we will delve into potential strategies for addressing these concerns.

---

{{< subscribe
  headline="Get the Production-Ready Terraform"
  description="Deploy this entire stack in minutes. Kinesis Firehose, S3, Glue catalog, Athena—all wired up with encryption and dynamic partitioning. The same code I use."
  campaign="budget-data-lake-with-aws"
  lead_magnet="aws-data-lake-terraform"
  button="Get the Module"
>}}

The code for reproduction is free of charge and available [here](https://github.com/khozzy/aws-data-lake/tree/master).
