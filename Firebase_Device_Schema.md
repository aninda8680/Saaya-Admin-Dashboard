# Firebase Database Schema: IoT Devices

This document outlines the database schema for the 7 sub-collections created under each specific IoT device (`devices/{deviceId}`) in the Firestore database.

The system is built on a **"Write heavy, Read light"** architecture. Cloud Functions do the heavy mathematical aggregation and graph data formatting immediately upon data upload, ensuring the dashboard apps load instantly even with large datasets.

---

## 1. `live`
* **Purpose:** Stores **only the single most recent** data reading. Every time the device uploads data, it overwrites the existing document here.
* **Use Case:** Provides an extremely fast way for the frontend real-time dashboard to grab the absolute latest sensor values without having to search through historical data. 
* **Document Name:** `latest`

## 2. `status`
* **Purpose:** Keeps track of the device's basic operational health. It stores the `lastOnlineAt` timestamp and the `battery` percentage.
* **Use Case:** Used to show if a device is offline/online and how much battery it has left.
* **Document Name:** `current`

## 3. `readings`
* **Purpose:** Stores **all raw, individual data uploads** (e.g., every 30 seconds). It includes a built-in TTL (Time-To-Live) feature that automatically deletes data older than 30 days.
* **Use Case:** Acts as the full historical log for the last month. Used to plot a graph showing every single minute of a specific day.
* **Document Name:** The exact timestamp (e.g., `2026-05-12 14:30:45`)

## 4. `dailySummaries`
* **Purpose:** Aggregates all the readings from a single day and calculates mathematical summaries: `avg` (average), `max`, `min`, `sum`, and `count` (number of uploads).
* **Use Case:** Useful for quickly identifying the highest, lowest, or average metrics for a specific date without recalculating thousands of raw data points.
* **Document Name:** The Date (e.g., `2026-05-12`)

## 5. `monthlySummaries`
* **Purpose:** Similar to daily summaries, but calculates the running `avg`, `sum`, and `count` for an entire calendar month.
* **Use Case:** Good for displaying high-level statistics like "Average Monthly Moisture" on an admin panel or summary report.
* **Document Name:** The Year-Month (e.g., `2026-05`)

## 6. `monthly` (Graph Data)
* **Purpose:** Specifically formatted to feed data into **Monthly Graphs**. A single document holds the average value for every day of the month as an object (e.g., `days.1`, `days.2`, `days.12`, etc.).
* **Use Case:** Highly optimized for Firebase read performance. The frontend graph only has to download **one** document to plot a full 30-day line chart.
* **Document Name:** The Year-Month (e.g., `2026-05`)

## 7. `yearly` (Graph Data)
* **Purpose:** Specifically formatted to feed data into **Yearly Graphs**. A single document holds the average value for every month of the year (e.g., `months.1`, `months.2`, etc.).
* **Use Case:** Similar to the monthly graphs, the frontend only has to download **one** document to plot a 12-month line chart.
* **Document Name:** The Year (e.g., `2026`)
