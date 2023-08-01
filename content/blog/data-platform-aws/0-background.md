---
title: "Background"
date: 2023-07-01T12:05:02+02:00
draft: true
index: 0
---


## About the Data
For the rest of the series we assume that we are working in IoT domain, where certain devices emit a continuous stream of sensor readings:

```
...
{'sensor_id': 4, 'measure': 151.46, 'event_time': '2023-07-21 03:28:29.000000'}
{'sensor_id': 4, 'measure': 139.5, 'event_time': '2023-07-20 20:45:02.000000'}
{'sensor_id': 8, 'measure': 170.06, 'event_time': '2023-07-20 23:44:47.000000'}
{'sensor_id': 4, 'measure': 136.36, 'event_time': '2023-07-22 17:52:08.000000'}
{'sensor_id': 8, 'measure': 166.61, 'event_time': '2023-07-22 17:36:13.000000'}
{'sensor_id': 0, 'measure': 138.95, 'event_time': '2023-07-20 16:09:26.000000'}
...
```

There are 10 distinct sensor IDs, each of them emit a random temperature reading with a certain status assigned ([source](https://github.com/khozzy/aws-data-lake/blob/646857c5a685b6d60a548b6bd7b9457d07c73091/code/gen_temp.py)). In each case we will limit ourselves to 25,000 data samples, which should be representative enough.
