/**
 * aimUpload — Cloud Function
 *
 * Receives sensor readings from AIM IoT devices and fans them out into
 * Firestore sub-collections without ever touching or overwriting existing data:
 *
 *   devices/{deviceId}/readings/{autoId}        ← raw reading (addDoc, never overwrites)
 *   devices/{deviceId}/live/latest              ← overwrite with latest values only
 *   devices/{deviceId}/status/current           ← lastOnlineAt, battery (merge)
 *   devices/{deviceId}/dailySummaries/{YYYY-MM-DD}  ← running avg/min/max/count (merge)
 *   devices/{deviceId}/monthlySummaries/{YYYY-MM}   ← running avg/sum/count (merge)
 *   devices/{deviceId}/monthly/{YYYY-MM}            ← per-day avg graph data (merge)
 *   devices/{deviceId}/yearly/{YYYY}                ← per-month avg graph data (merge)
 *
 * Expected POST body (from device upload_firebase1):
 * {
 *   "deviceId": "8659",
 *   "data": {
 *     "moisture": 45.2,
 *     "temperature": 28.5,
 *     "ec": 320,
 *     "ph": 6.7,
 *     "n": 142,
 *     "p": 87,
 *     "k": 210,
 *     "latitude": 22.848276,
 *     "longitude": 88.63779,
 *     "altitude": 15.357,
 *     "satellites": 12,
 *     "status": "3D Fix",
 *     "gps_time": "21:15:30",
 *     "gps_date": "03/11/2026"
 *   }
 * }
 */

const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Safe number parse — returns 0 if NaN/undefined */
function n(v) {
  const x = parseFloat(v);
  return isNaN(x) ? 0 : x;
}

/**
 * Recalculate a running average and update Firestore atomically.
 * Uses a Firestore transaction to read-then-write so concurrent uploads
 * never corrupt the aggregated stats.
 *
 * @param {FirebaseFirestore.DocumentReference} ref
 * @param {object} newValues  - { temperature, moisture, ph, ec, n, p, k }
 */
async function updateSummaryDoc(ref, newValues) {
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const fields = ["temperature", "moisture", "ph", "ec", "n", "p", "k"];

    if (!snap.exists) {
      // First reading ever for this period — bootstrap the doc
      const avg = {};
      const min = {};
      const max = {};
      const sum = {};

      fields.forEach((f) => {
        const v = n(newValues[f]);
        avg[f] = v;
        min[f] = v;
        max[f] = v;
        sum[f] = v;
      });

      tx.set(ref, { avg, min, max, sum, count: 1, updatedAt: Timestamp.now() });
    } else {
      // Existing doc — update running stats without touching any other field
      const d = snap.data();
      const oldCount = d.count || 0;
      const newCount = oldCount + 1;

      const avg = d.avg || {};
      const min = d.min || {};
      const max = d.max || {};
      const sum = d.sum || {};

      fields.forEach((f) => {
        const v = n(newValues[f]);
        const oldSum = n(sum[f]);
        const newSum = oldSum + v;

        sum[f] = newSum;
        avg[f] = newSum / newCount;
        min[f] = min[f] !== undefined ? Math.min(n(min[f]), v) : v;
        max[f] = max[f] !== undefined ? Math.max(n(max[f]), v) : v;
      });

      tx.update(ref, {
        avg,
        min,
        max,
        sum,
        count: newCount,
        updatedAt: Timestamp.now(),
      });
    }
  });
}

/**
 * Update the monthly graph doc (one doc per month, keyed by day number).
 * Uses a running average per day slot — never deletes any existing day data.
 */
async function updateMonthlyGraph(deviceId, monthKey, dayStr, newValues) {
  const ref = db.doc(`devices/${deviceId}/monthly/${monthKey}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const fields = ["temperature", "moisture", "ph", "ec", "n", "p", "k"];

    if (!snap.exists) {
      const days = {};
      const dayCounts = {};
      fields.forEach((f) => {
        days[`${f}.${dayStr}`] = n(newValues[f]);
      });
      dayCounts[`_counts.${dayStr}`] = 1;
      tx.set(ref, { days: {}, _counts: {}, updatedAt: Timestamp.now() });
      // Use dot notation update after set
      const updateObj = { updatedAt: Timestamp.now() };
      fields.forEach((f) => {
        updateObj[`days.${f}_${dayStr}`] = n(newValues[f]);
      });
      updateObj[`_counts.day_${dayStr}`] = 1;
      tx.set(ref, updateObj, { merge: true });
    } else {
      const d = snap.data();
      const counts = d._counts || {};
      const oldCount = n(counts[`day_${dayStr}`]);
      const newCount = oldCount + 1;

      const updateObj = { updatedAt: Timestamp.now() };
      updateObj[`_counts.day_${dayStr}`] = newCount;

      fields.forEach((f) => {
        const key = `days.${f}_${dayStr}`;
        const oldAvg = n((d.days || {})[`${f}_${dayStr}`]);
        const newAvg = (oldAvg * oldCount + n(newValues[f])) / newCount;
        updateObj[key] = newAvg;
      });

      tx.update(ref, updateObj);
    }
  });
}

/**
 * Update the yearly graph doc (one doc per year, keyed by month number).
 * Uses a running average per month slot.
 */
async function updateYearlyGraph(deviceId, yearKey, monthNum, newValues) {
  const ref = db.doc(`devices/${deviceId}/yearly/${yearKey}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const fields = ["temperature", "moisture", "ph", "ec", "n", "p", "k"];

    if (!snap.exists) {
      const updateObj = { updatedAt: Timestamp.now() };
      fields.forEach((f) => {
        updateObj[`months.${f}_${monthNum}`] = n(newValues[f]);
      });
      updateObj[`_counts.month_${monthNum}`] = 1;
      tx.set(ref, updateObj);
    } else {
      const d = snap.data();
      const counts = d._counts || {};
      const oldCount = n(counts[`month_${monthNum}`]);
      const newCount = oldCount + 1;

      const updateObj = { updatedAt: Timestamp.now() };
      updateObj[`_counts.month_${monthNum}`] = newCount;

      fields.forEach((f) => {
        const key = `months.${f}_${monthNum}`;
        const oldAvg = n((d.months || {})[`${f}_${monthNum}`]);
        const newAvg = (oldAvg * oldCount + n(newValues[f])) / newCount;
        updateObj[key] = newAvg;
      });

      tx.update(ref, updateObj);
    }
  });
}

// ─── Cloud Function ──────────────────────────────────────────────────────────

exports.aimUpload = onRequest(
  {
    region: "asia-south1",
    cors: true,
    invoker: "public",
    timeoutSeconds: 30,
  },
  async (req, res) => {
    // Only accept POST
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { deviceId, data } = req.body;

    if (!deviceId || !data) {
      return res.status(400).json({ error: "Missing deviceId or data" });
    }

    const now = Timestamp.now();
    const jsNow = now.toDate();

    // IST offset = +5:30 = +330 minutes
    const istOffset = 330 * 60 * 1000;
    const istDate = new Date(jsNow.getTime() + istOffset);

    const yyyy = istDate.getUTCFullYear();
    const mm   = String(istDate.getUTCMonth() + 1).padStart(2, "0");
    const dd   = String(istDate.getUTCDate()).padStart(2, "0");

    const dateKey  = `${yyyy}-${mm}-${dd}`;          // "2026-11-03"
    const monthKey = `${yyyy}-${mm}`;                 // "2026-11"
    const yearKey  = String(yyyy);                    // "2026"
    const dayNum   = String(istDate.getUTCDate());    // "3"
    const monthNum = String(istDate.getUTCMonth() + 1); // "11"

    // Normalised sensor values (device sends "temp" in RTDB but "temperature" via CF)
    const sensorValues = {
      temperature: n(data.temperature ?? data.temp),
      moisture:    n(data.moisture),
      ph:          n(data.ph),
      ec:          n(data.ec),
      n:           n(data.n),
      p:           n(data.p),
      k:           n(data.k),
    };

    const gpsPayload = {
      latitude:   n(data.latitude),
      longitude:  n(data.longitude),
      altitude:   n(data.altitude),
      satellites: n(data.satellites),
      gpsStatus:  data.status || "Unknown",
      gpsTime:    data.gps_time || "",
      gpsDate:    data.gps_date || "",
    };

    try {
      // ── 1. Raw reading (addDoc — NEVER overwrites old data) ───────────────
      const readingRef = db
        .collection("devices")
        .doc(deviceId)
        .collection("readings");

      await readingRef.add({
        ts:          now,
        ...sensorValues,
        ...gpsPayload,
      });

      // ── 2. live/latest (overwrite with most recent) ────────────────────────
      await db
        .doc(`devices/${deviceId}/live/latest`)
        .set(
          {
            ...sensorValues,
            ...gpsPayload,
            updatedAt: now,
          },
          { merge: false }   // intentional full overwrite — it's "live"
        );

      // ── 3. status/current (merge — preserve other admin-set fields) ────────
      await db.doc(`devices/${deviceId}/status/current`).set(
        {
          lastOnlineAt: now,
          status:       "online",
          updatedAt:    now,
        },
        { merge: true }
      );

      // ── 4. Root device doc — update status + lastSeen (merge) ─────────────
      await db.doc(`devices/${deviceId}`).set(
        {
          status:   "online",
          lastSeen: now,
        },
        { merge: true }
      );

      // ── 5–8. Aggregations (run in parallel, all additive) ─────────────────
      await Promise.all([
        // 5. Daily summary
        updateSummaryDoc(
          db.doc(`devices/${deviceId}/dailySummaries/${dateKey}`),
          sensorValues
        ),

        // 6. Monthly summary
        updateSummaryDoc(
          db.doc(`devices/${deviceId}/monthlySummaries/${monthKey}`),
          sensorValues
        ),

        // 7. Monthly graph (day-by-day averages)
        updateMonthlyGraph(deviceId, monthKey, dayNum, sensorValues),

        // 8. Yearly graph (month-by-month averages)
        updateYearlyGraph(deviceId, yearKey, monthNum, sensorValues),
      ]);

      console.log(`[aimUpload] ✅ Device ${deviceId} — reading saved (${dateKey})`);
      return res.status(200).json({ success: true, deviceId, timestamp: dateKey });
    } catch (err) {
      console.error(`[aimUpload] ❌ Device ${deviceId} error:`, err);
      return res.status(500).json({ error: err.message });
    }
  }
);

