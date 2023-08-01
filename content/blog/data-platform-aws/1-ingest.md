---
title: "Affordable data collection at scale"
date: 2023-07-02T12:05:02+02:00
draft: true
mermaid: true
index: 1
---

> This article is part of ["Practical Data Platform on Amazon AWS 📊"]({{< ref "/blog/data-platform-aws" >}}) series.


### Why it matters?
- solution suits both structured and unstructured data, which is desired for both analytical as engineering workloads,
- it works both with real-time streaming and batch data processing,
- it's scalable and cost-efficient, with proper configuration both storage and processing tiers are decoupled and highly optimized,
- adherence to regulatory and compliance requirements for data protection and safeguarding sensitive information.

### What you will learn?
- how certain AWS services play together to provide a serverless data platform,
- no-code approach to deliver infrastructure capable of collecting, transforming and querying underlying data almost free of charge,
- practical difference between representing files in JSON and Parquet format
- how to query streaming data in quasi real-time using SQL language
---

## Story background
Imagine a new bio-hacking startup. You as an owner are obviously interested in monitoring user behaviour, discovering insights and calculating relevant metrics satisfying investors scrutiny.

Since the first release of app, when the telemetry process is still young, you decided to keep track of three basic facts - `anonymous app visit`, `account registration` and `measurement record` (meaning that the user logs some of his medical data for further analysis).  

We expect an exponential user growth in near future and therefore are bracing for solid, scalable and secure mechanism for data collection. To accelerate the development progress we generated a set of user sessions as a Markov Decision Process, where each state has a certain transition probability. 

{{< mermaid >}}
---
title: User session state transition probabilities diagram
---
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

A synthetic dataset contains 100k distinct user sessions consisting of one or more events that we are going to use in this exercise ([source code](xxx)). To make things event more realistic we intentionally included some duplicated events.

## Layman's system architecture
The first approach might involve creating a dedicated service process exposing HTTP collector endpoint, performing initial data processing and pushing it downstream for storage (database or file system).

![Naive Approach Diagram](../images/naive-approach.png)

This design would work, but it has a few serious downsides:
- scalability issues (provisioned resources might not handle excess traffic),
- maintenance burden (each new proprietary component increases the system's complexity)
- wheel reinvention (handle exceptions and communication with other components)

We don't want to spend extra engineering resources on developing and maintaining such solution. Let's skip to the desired proposal.

## Native components of Amazon AWS

To accomplish the goal we put the following AWS services in our crosshairs:
- [Kinesis Data Firehose](https://docs.aws.amazon.com/firehose/latest/dev/basic-deliver.html) service for securely ingesting and storing incoming payload,
- [S3](https://aws.amazon.com/s3/) and [Glue](https://aws.amazon.com/glue/) as a storage layer and logical data catalogue,
- [Athena](https://aws.amazon.com/athena/) as a query engine allowing us to access the underlying data with declarative semantics.

> **Note about data security**
> 
> Since we are dealing with medical records we need to adhere to strict regulations regarding sensitive data. Possible law infringes or data breaches might be disastrous for our company.
> 
> By encrypting data _at-rest_ and _in-transit_, we can meet regulatory and compliance requirements for data protection and safeguard sensitive information.
> 
> Cryptographic features of Amazon AWS are designed to meet various compliance requirements, including GDPR, HIPAA, and PCI DSS. By undergoing regular audits and certifications to validate its security practices and compliance with industry standards.

### Storing data as JSON
Kinesis Firehose works by exposing an endpoint consuming events. It collects them and buffers for a predefined time (or amount of data). When the thresholds are met, it dumps a batch of data to predefined location, which in our case is S3.

In the first example we will focus on storing data in native format - as JSON objects. 

```terraform
resource "aws_kinesis_firehose_delivery_stream" "json_firehose_stream" {
  name        = "${var.firehose_stream_name}_json"
  destination = "extended_s3"

  server_side_encryption {
    enabled = true
    key_type = "AWS_OWNED_CMK"
  }

  extended_s3_configuration {
    role_arn   = aws_iam_role.firehose_delivery_role.arn
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

```

By looking at the Terraform resource declaration there are some non-trivial things going on here already. Let's start from the top:

We are utilizing the _server side encryption_ feature, which means that our data will be automatically encrypted at-rest using the AWS owned keys. It's also possible to use our own cryptographic keys, here but we would like to leverage AWS's compliance certifications and ensure your data meets the necessary regulatory requirements.

Next we are configuring the S3 sink. Notice the _dynamic partitioning_ allowing us to process contents of each incoming objects and depending on it's attribute determine the desired storage path. We leverage it to construct the Hive-like file path structure that will enable us the "_predicate projection_" feature boosting query effectiveness later. By design, we bucket events by tuple of name and processing date.

```
s3://<bucket>/events_raw/json/name=<event_name>/d=<etl_date>
```

Notice, that the date in path (`d=` prefix), stands for the "message processing timestamp" (not the event generation timestamp). This is a deliberate decision, facilitating future incremental data processing.

> Pay attention to the total amount of partitions within a batch (combinations of parameters composing an object path). When this count exceeds the account [quotas](https://docs.aws.amazon.com/firehose/latest/dev/limits.html), Kinesis Firehose will yield the _"The number of active partitions has exceeded the configured limit"_ error. 

Next we utilize the [_data processors_](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-kinesisfirehose-deliverystream-processor.html) to transform and process streaming data before delivering it to the destination. In this case each incoming object is processed by `MetadataExtractionQuery` processor extracting specified parameters from message payload. Those might be later used to build the object path dynamically.

[//]: # (END)

> **Firehose object delimiters for text payloads**
> 
> Mind the way producer emits the events. By default, Kinesis Data Firehose buffers incoming payload by concatenating them, without applying any delimiter. So, for a series of incoming JSON messages, the file dropped on S3 might have the following structure
> ```
> {...}{...}{...}
> ```
>
> This is tricky because the stored file does not meet the requirements for the properly formatted JSON file and might impact downstream processes. Tools like AWS Athena will continue to operate, but will give the incorrect results, which might be tricky to spot at first. In past there were workaround including creating a custom Lambda functions adding delimiters to records, but now this task is as simple as configuring the delivery stream properly with `AppendDelimiterToRecords` _data processor_.


### Storing data in Parquet format
Let's create a second Kinesis Firehose delivery, which will be very similar to the JSON one described above. The main difference is that we are utilizing the _"Record format conversion"_ feature enabling real-time data conversion between formats (in this case JSON to Parquet).

Notice the `parquet_ser_de` [output serializer configuration](https://docs.aws.amazon.com/firehose/latest/APIReference/API_ParquetSerDe.html) block allowing to specify things like the compression or the HDFS block size. However, to make the comparison more fair we will retain the default settings.

```terraform
resource "aws_kinesis_firehose_delivery_stream" "parquet_firehose_stream" {
    # ...
 
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
```

This declaration also requires us to specify the schema for the underlying data, which will be defined in subsequent section.

## Data ingestion
Now that the Kinesis Delivery Streams are ready, let's put some data there. Having our synthetic dataset generated, we will transfer it in batches using the [`put_record_batch`](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/firehose/client/put_record_batch.html) API operation to each stream separately ([source code](...)).

The dataset itself contains 700k+ raw events storing 165 MB.

We want to have initial sneak-peak on how the data is stored and the overall S3 bucket stats.

```bash
# JSON sink bucket stats
$ aws s3 ls s3://<bucket>/events_raw/json/ --recursive --human-readable --summarize

# ...
Total Objects: 21
Total Size: 44.1 MiB
```


```bash
# Parquet sink bucket stats
$ aws s3 ls s3://<bucket>/events_raw/parquet/ --recursive --human-readable --summarize

# ...
Total Objects: 15
Total Size: 39.5 MiB
```

```bash
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
```

Both streams managed to reduce size almost 4 times due to data compression chosen. Parquet is still slightly more efficient because of internal binary format representation.

## Querying data
Since the streaming data is now being stored in S3 in regular time interval, let's move to the actual data analysis. We leverage AWS Glue service to provide a logical representation of the data structure and AWS Athena as a distributed compute engine.

Let's start with declaring resources for two AWS Glue tables (`events_json` and `events_parquet`).

```terraform
resource "aws_glue_catalog_table" "events_json" {
  database_name = aws_glue_catalog_database.glue_db.name
  name          = "events_json"

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
    location      = "s3://${aws_s3_bucket.sink.id}/events_raw/json/"
    input_format  = "org.apache.hadoop.mapred.TextInputFormat"
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
```

```terraform
resource "aws_glue_catalog_table" "events_parquet" {
  database_name = aws_glue_catalog_database.glue_db.name
  name          = "events_parquet"

  table_type = "EXTERNAL_TABLE"

  parameters = {
    EXTERNAL = "TRUE"
    "classification" : "parquet"
  }

  # ... (removed duplicated code for brevity)

  storage_descriptor {
    location      = "s3://${aws_s3_bucket.sink.id}/events_raw/parquet/"
    input_format  = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat"

    ser_de_info {
      serialization_library = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"

      parameters = {
        "serialization.format" = 1
      }
    }

    # ...
}
```

We need to deliberately mention each data column within our data as well as partition keys that constitute a path to object (used for the later _"predicate pushdown"_ optimization). We also set the `EXTERNAL` property, indicating that the table metadata is stored inside AWS Glue Data Catalog but the data resides in external data source (S3 in this case).

![AWG Glue tables](../images/aws_glue_tables.png)

Glue also enables more automatic way of discovering and registering tables based on the underlying by using Glue Crawlers. However, we prefer to have more control about the process, therefore declare things manually. 

- Athena can read compressed and encrypted files

Before querying the table, partitions metadata need to be refreshed. Make it happen with executing either Athena query:
- `MSCK REPAIR TABLE sensors_json;` to automatically discover the partition structure,
- or manually for each directory `ALTER TABLE sensors_json ADD PARTITION (sensor_id="...", dt="...") LOCATION "s3://..."` 


### Storing data as Parquet files


In case of the first query Athena is utilizing the Parquet's _"projection pushdown"_ capability allowing it to scan only relevant columns. In this case only `measure` is considered, since `sensor_id` is a partition key. Because Athena's pricing model is a function of the data scanned, that has a direct implication on the final AWS bill.


> It's important to note that while Amazon S3 managed keys provide a secure and convenient solution for encryption, some organizations may have specific requirements or regulations that necessitate the use of customer-managed keys (SSE-KMS). Customer-managed keys offer additional control and ownership over encryption keys but require more management overhead.
> 

## Cost analysis
The pessimistic [AWS costs estimations](https://calculator.aws) for running the following examples are less than a dollar and are broken down below. The most significant part belongs to AWS Athena, but the assumption was that there are 100 full scan queries (not very optimal) daily for a month and no caching is used.  

| **Service**           | **Input (monthly)**         | **Cost**  |
|-----------------------|-----------------------------|-----------|
| Kinesis Data Firehose | 700k events (1kB each)      | $0.10     |
| S3                    | 0.01 GB                     | $0.00     |
| Glue                  | 2 tables                    | $0.00     |
| Athena                | 100 full scan queries daily | $0.73     |
|                       |                             | **$0.83** |

## Closing thoughts
We saw that AWS Kinesis Data Firehose provides a surprisingly simple mechanism for scalable data storage. By utilizing the _"dynamic partitioning"_ we can leverage of the _"predicate pushdown"_ by physically organizing rows into directories.

Then, we enabled the _"Record format conversion"_ feature, transforming data into as Parquet files. This allows us to take the next advantage of the _"projection pushdown"_ feature - only file's blocks containing relevant data was scanned.

Presented solution is still not perfect:
- significant amount of small files created in each directory (result of setting the buffering window),
- data is partitioned by the processing timestamp (`dt`), but it would make more sense to use the `event_time` from the payload instead,
- Hive partitions as columns (https://iceberg.apache.org/docs/latest/partitioning/#icebergs-hidden-partitioning)
- Only data query capabilities

---
The code for reproduction is free and available [here](https://github.com/khozzy/aws-data-lake/tree/master)