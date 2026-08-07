"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, collection, getDocs, query, orderBy, limit, where
} from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import styles from "@/app/premium.module.css";
import {
  ArrowLeft, Smartphone, Battery, Thermometer, Activity, Clock,
  Wifi, WifiOff, BarChart2, Calendar, TrendingUp, Droplets,
  FlaskConical, Zap, Info, Hash, Download, FileSpreadsheet, X,
} from "lucide-react";

import { exportCustomReadings, exportDailySummariesCsv } from "./exportUtils";

// ─── helpers ────────────────────────────────────────────────────────────────
function fmt(v: number | undefined, digits = 1, unit = "") {
  return v !== undefined ? `${v.toFixed(digits)}${unit}` : "—";
}
function fmtTs(ts: any) {
  if (!ts) return "—";
  try { return ts.toDate().toLocaleString(); } catch { return String(ts); }
}
function BatteryBar({ pct }: { pct?: number }) {
  if (pct === undefined) return <span className="text-[var(--text-secondary)]">—</span>;
  const color = pct > 50 ? "#2ECC71" : pct > 20 ? "#F39C12" : "#E74C3C";
  return (
    <div className="flex items-center gap-3">
      <div style={{ width: 120, height: 12, background: "#eee", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 6, transition: "width 0.6s" }} />
      </div>
      <span style={{ color, fontWeight: 700 }}>{pct}%</span>
    </div>
  );
}

// ─── mini-bar chart for monthly/yearly graph data ────────────────────────────
function MiniBarChart({ data, label }: { data: Record<string, number>; label: string }) {
  const entries = Object.entries(data).sort((a, b) => Number(a[0]) - Number(b[0]));
  if (entries.length === 0) return <p className="text-[var(--text-secondary)] text-sm">No graph data</p>;
  const max = Math.max(...entries.map(([, v]) => v), 0.001);
  return (
    <div>
      <p className="text-xs text-[var(--text-secondary)] mb-2">{label}</p>
      <div className="flex items-end gap-1" style={{ height: 64 }}>
        {entries.map(([k, v]) => (
          <div key={k} className="flex flex-col items-center flex-1" title={`${label} ${k}: ${v.toFixed(2)}`}>
            <div style={{
              height: `${(v / max) * 56}px`, minHeight: 2,
              background: "linear-gradient(to top, #0FA56F, #2ECC71)",
              borderRadius: 3, width: "100%",
            }} />
            <span className="text-[9px] text-[var(--text-secondary)] mt-1">{k}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── line chart for single day graph ────────────────────────────────────
function SingleDayLineChart({ data, label, unit }: { data: { time: string; value: number }[]; label: string; unit?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <div style={{ height: 350 }} className="pt-4" />;

  if (data.length === 0) return <p className="text-[var(--text-secondary)] text-sm">No graph data for this date</p>;

  return (
    <div style={{ width: '100%', height: 350 }} className="pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 5, right: 16, bottom: 20, left: 0 }}
          style={{ background: "transparent" }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fill: "var(--chart-axis-text)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border-color)" }}
            minTickGap={30}
            label={{ value: "Time", position: "insideBottom", offset: -15, fill: "var(--chart-axis-text)", fontSize: 12 }}
          />
          <YAxis
            tick={{ fill: "var(--chart-axis-text)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v.toFixed(1)}${unit || ''}`}
            width={75}
          />
          <RechartsTooltip
            contentStyle={{ backgroundColor: "var(--glass-bg)", borderColor: "var(--border-color)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
            itemStyle={{ color: "#0FA56F", fontWeight: 600 }}
            labelStyle={{ color: "var(--text-secondary)", marginBottom: 4 }}
            cursor={{ stroke: "var(--border-color)", strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="value"
            name={label}
            stroke="#0FA56F"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: "#0FA56F", stroke: "transparent", strokeWidth: 0 }}
            connectNulls={true}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── section card ────────────────────────────────────────────────────────────
function Section({ title, icon, children, headerRight }: { title: string; icon: React.ReactNode; children: React.ReactNode; headerRight?: React.ReactNode }) {
  return (
    <div className={`${styles.glassPanel} p-6`}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-bold text-[#0FA56F] flex items-center gap-2">
          {icon} {title}
        </h3>
        {headerRight}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <div className="text-[var(--text-secondary)] text-sm py-2 border-b border-[var(--td-border)]">{label}</div>
      <div className="text-sm font-medium text-[var(--text-primary)] py-2 border-b border-[var(--td-border)]">{value}</div>
    </>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────
export default function DeviceDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [device, setDevice]               = useState<any>(null);
  const [liveLatest, setLiveLatest]       = useState<any>(null);
  const [statusDoc, setStatusDoc]         = useState<any>(null);
  const [readings, setReadings]           = useState<any[]>([]);
  const [dailySums, setDailySums]         = useState<any[]>([]);
  const [monthlySums, setMonthlySums]     = useState<any[]>([]);
  const [monthlyGraph, setMonthlyGraph]   = useState<any>(null);   // one doc
  const [yearlyGraph, setYearlyGraph]     = useState<any>(null);   // one doc
  const [loading, setLoading]             = useState(true);
  const [totalReadingsCount, setTotalReadingsCount] = useState<number>(0);
  const [selectedDate, setSelectedDate]   = useState<string>("");
  const [singleDayEntity, setSingleDayEntity] = useState<string>("temperature");
  const [isLoadingReadings, setIsLoadingReadings] = useState(false);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState<"specific" | "range" | "all">("specific");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => { if (id) fetchAll(); }, [id]);

  const fetchAll = async () => {
    try {
      // 1. Root device doc
      const snap = await getDoc(doc(db, "devices", id));
      let ownerId: string | null = null;
      let ownerName: string | null = null;

      // Details sub-collection (ownerUserId)
      try {
        const detSnap = await getDocs(collection(db, "devices", id, "details"));
        if (!detSnap.empty) {
          const d = detSnap.docs.find(d => d.data().role === "owner") || detSnap.docs[0];
          ownerId = d.data().ownerUserId ?? null;
          if (ownerId) {
            const cSnap = await getDoc(doc(db, "customers", ownerId));
            if (cSnap.exists()) {
              const c = cSnap.data();
              ownerName = `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.name || null;
            }
          }
        }
      } catch (err) { console.warn("Failed to fetch details:", err); }
      setDevice(snap.exists() ? { id: snap.id, ownerUserId: ownerId, ownerName, ...snap.data() } : null);

      // 2. live/latest
      try {
        const liveSnap = await getDoc(doc(db, "devices", id, "live", "latest"));
        if (liveSnap.exists()) setLiveLatest(liveSnap.data());
      } catch (err) { console.warn("Failed to fetch live/latest:", err); }

      // 3. status/current
      try {
        const stSnap = await getDoc(doc(db, "devices", id, "status", "current"));
        if (stSnap.exists()) setStatusDoc(stSnap.data());
        else {
          // fallback: old schema stored in live/status
          const oldSnap = await getDoc(doc(db, "devices", id, "live", "status"));
          if (oldSnap.exists()) setStatusDoc(oldSnap.data());
        }
      } catch (err) { console.warn("Failed to fetch status/current:", err); }

      // 4. readings (last 10 or selected date)
      try {
        let q;
        if (!selectedDate) {
          q = query(collection(db, "devices", id, "readings"), orderBy("ts", "desc"), limit(10));
        } else {
          const start = new Date(`${selectedDate}T00:00:00`);
          const end = new Date(`${selectedDate}T23:59:59.999`);
          q = query(
            collection(db, "devices", id, "readings"),
            where("ts", ">=", start),
            where("ts", "<=", end),
            orderBy("ts", "desc")
          );
        }
        const rSnap = await getDocs(q);
        setReadings(rSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch { /* index may be missing */ }

      // 5. dailySummaries (last 7)
      try {
        const dsSnap = await getDocs(collection(db, "devices", id, "dailySummaries"));
        const all = dsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        all.sort((a, b) => b.id.localeCompare(a.id));
        setDailySums(all.slice(0, 7));
      } catch { /* */ }

      // 6. monthlySummaries (last 6)
      try {
        const msSnap = await getDocs(collection(db, "devices", id, "monthlySummaries"));
        const all = msSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const total = all.reduce((sum, ms: any) => sum + (ms.count || 0), 0);
        setTotalReadingsCount(total);
        all.sort((a, b) => b.id.localeCompare(a.id));
        setMonthlySums(all.slice(0, 6));
      } catch { /* */ }

      // 7. monthly graph (current month)
      try {
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const mgSnap = await getDoc(doc(db, "devices", id, "monthly", monthKey));
        if (mgSnap.exists()) setMonthlyGraph({ id: mgSnap.id, ...mgSnap.data() });
      } catch { /* */ }

      // 8. yearly graph (current year)
      try {
        const yearKey = String(new Date().getFullYear());
        const ygSnap = await getDoc(doc(db, "devices", id, "yearly", yearKey));
        if (ygSnap.exists()) setYearlyGraph({ id: ygSnap.id, ...ygSnap.data() });
      } catch { /* */ }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReadingsForDate = async (dateStr: string) => {
    setIsLoadingReadings(true);
    try {
      let q;
      if (!dateStr) {
        q = query(collection(db, "devices", id, "readings"), orderBy("ts", "desc"), limit(10));
      } else {
        const start = new Date(`${dateStr}T00:00:00`);
        const end = new Date(`${dateStr}T23:59:59.999`);
        q = query(
          collection(db, "devices", id, "readings"),
          where("ts", ">=", start),
          where("ts", "<=", end),
          orderBy("ts", "desc")
        );
      }
      const rSnap = await getDocs(q);
      setReadings(rSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.warn("Failed to fetch readings for date:", err);
    } finally {
      setIsLoadingReadings(false);
    }
  };

  useEffect(() => {
    if (!id || loading) return;
    fetchReadingsForDate(selectedDate);
  }, [selectedDate]);

  // Build single day graph data
  const singleDayChartData = useMemo(() => {
    if (!selectedDate || readings.length === 0) return [];
    
    // Sort readings chronologically
    const sortedReadings = [...readings].sort((a, b) => {
      if (!a.ts || !b.ts) return 0;
      return a.ts.toMillis() - b.ts.toMillis();
    });

    const data: { time: string; value: number }[] = [];
    
    sortedReadings.forEach(r => {
      if (!r.ts) return;
      let d;
      try { d = r.ts.toDate(); } catch { return; }
      
      const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      
      if (r[singleDayEntity] !== undefined && !isNaN(Number(r[singleDayEntity]))) {
        data.push({
          time: timeStr,
          value: Number(r[singleDayEntity])
        });
      }
    });

    return data;
  }, [readings, selectedDate, singleDayEntity]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-[#0FA56F] font-medium animate-pulse">
      Loading device data…
    </div>
  );
  if (!device) return (
    <div className={styles.dashboardContent}>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[#0FA56F] mb-6">
        <ArrowLeft size={16} /> Back
      </button>
      <div className="p-8 text-center text-[var(--text-secondary)]">Device not found.</div>
    </div>
  );

  // Merge live data from both possible locations
  const live = liveLatest ?? statusDoc ?? {};
  const battery: number | undefined = live.battery ?? statusDoc?.battery;
  const temperature: number | undefined = live.temperature;
  const moisture: number | undefined = live.moisture;
  const ph: number | undefined = live.ph;
  const lastOnline = statusDoc?.lastOnlineAt ?? live.updatedAt;

  let badgeClass = styles.badgeOffline;
  if (device.status === "online") badgeClass = styles.badgeOnline;
  else if (device.status === "standby") badgeClass = styles.badgeActive;

  // Build month/year graph datasets
  const monthlyDays: Record<string, number> = {};
  const yearlyMonths: Record<string, number> = {};
  if (monthlyGraph?.days) Object.entries(monthlyGraph.days).forEach(([k, v]: any) => { monthlyDays[k] = Number(v) || 0; });
  if (yearlyGraph?.months) Object.entries(yearlyGraph.months).forEach(([k, v]: any) => { yearlyMonths[k] = Number(v) || 0; });

  const handleCustomExport = async () => {
    await exportCustomReadings(
      device.id,
      exportType,
      exportStartDate,
      exportEndDate,
      {
        onStart: () => setIsExporting(true),
        onSuccess: () => setIsExportModalOpen(false),
        onError: () => {},
        onEnd: () => setIsExporting(false),
      }
    );
  };

  return (
    <div className={styles.dashboardContent}>
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[#0FA56F] mb-6 transition-colors font-medium">
        <ArrowLeft size={16} /> Back to Devices
      </button>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div className="flex items-center gap-4">
          <div className={`${styles.statIconWrapper} ${styles.purple}`} style={{ width: 52, height: 52 }}>
            <Smartphone size={26} />
          </div>
          <div>
            <h2 className={styles.pageTitle}>
              Device: <span className="text-[#0FA56F]">{device.id}</span>
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className={`${styles.badge} ${badgeClass}`}>{device.status || "unknown"}</span>
              {device.firmwareVersion && (
                <span className="text-xs text-[var(--text-secondary)] font-mono bg-[var(--td-border)] px-2 py-0.5 rounded">
                  fw {device.firmwareVersion}
                </span>
              )}
              {totalReadingsCount > 0 && (
                <span className="text-xs text-[#0FA56F] font-mono bg-[var(--td-border)] px-2 py-0.5 rounded">
                  {totalReadingsCount.toLocaleString()} readings taken
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Top KPI cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {/* Battery */}
        <div className={`${styles.glassPanel} ${styles.statCard}`}>
          <div className={styles.statHeader}>
            <span>Battery</span>
            <div className={`${styles.statIconWrapper} ${styles.green}`}><Battery size={18} /></div>
          </div>
          <BatteryBar pct={battery} />
        </div>

        {/* Temperature */}
        <div className={`${styles.glassPanel} ${styles.statCard}`}>
          <div className={styles.statHeader}>
            <span>Temperature</span>
            <div className={`${styles.statIconWrapper} ${styles.blue}`}><Thermometer size={18} /></div>
          </div>
          <p className={styles.statValue} style={{ fontSize: "1.75rem" }}>
            {fmt(temperature, 1, "°C")}
          </p>
        </div>

        {/* Moisture */}
        <div className={`${styles.glassPanel} ${styles.statCard}`}>
          <div className={styles.statHeader}>
            <span>Moisture</span>
            <div className={`${styles.statIconWrapper} ${styles.blue}`}><Droplets size={18} /></div>
          </div>
          <p className={styles.statValue} style={{ fontSize: "1.75rem" }}>
            {fmt(moisture, 1, "%")}
          </p>
        </div>

        {/* pH */}
        <div className={`${styles.glassPanel} ${styles.statCard}`}>
          <div className={styles.statHeader}>
            <span>pH Level</span>
            <div className={`${styles.statIconWrapper} ${styles.purple}`}><FlaskConical size={18} /></div>
          </div>
          <p className={styles.statValue} style={{ fontSize: "1.75rem" }}>
            {fmt(ph, 2)}
          </p>
        </div>
      </div>

      {/* ── Row 2: System Info + Status ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* System Information */}
        <Section title="System Information" icon={<Info size={18} />}>
          <div className="grid grid-cols-2 gap-x-4">
            <InfoRow label="Device ID" value={<span className="font-mono text-[#0FA56F]">{device.id}</span>} />
            <InfoRow label="Firmware" value={device.firmwareVersion || "Unknown"} />
            <InfoRow label="Status" value={
              <span className={`${styles.badge} ${badgeClass}`}>{device.status || "unknown"}</span>
            } />
            <InfoRow label="Owner" value={
              device.ownerUserId ? (
                <Link href={`/dashboard/users?id=${device.ownerUserId}`}
                  className="text-[#0FA56F] underline hover:text-[#0FA56F] transition-colors font-mono"
                  title={`UID: ${device.ownerUserId}`}>
                  {device.ownerName || device.ownerUserId}
                </Link>
              ) : <span className="text-[var(--text-secondary)]">—</span>
            } />
            <InfoRow label="Owner UID" value={
              <span className="font-mono text-xs text-[var(--text-secondary)] break-all">{device.ownerUserId || "—"}</span>
            } />
            <InfoRow label="Created At" value={fmtTs(device.createdAt)} />
            {device.lastSeen && <InfoRow label="Last Seen" value={fmtTs(device.lastSeen)} />}
            {device.owner && <InfoRow label="Owner Field" value={<span className="font-mono text-xs">{device.owner}</span>} />}
          </div>
        </Section>

        {/* Live Status */}
        <Section title="Live Status (status/current)" icon={<Wifi size={18} />}>
          <div className="grid grid-cols-2 gap-x-4">
            <InfoRow label="Battery" value={<BatteryBar pct={battery} />} />
            <InfoRow label="Last Online" value={fmtTs(lastOnline)} />
            {live.updatedAt && <InfoRow label="Data Updated" value={fmtTs(live.updatedAt)} />}
            {live.temperature !== undefined && <InfoRow label="Temperature" value={`${live.temperature}°C`} />}
            {live.moisture !== undefined && <InfoRow label="Moisture" value={`${live.moisture}%`} />}
            {live.ph !== undefined && <InfoRow label="pH" value={String(live.ph)} />}
            {live.humidity !== undefined && <InfoRow label="Humidity" value={`${live.humidity}%`} />}
            {live.light !== undefined && <InfoRow label="Light" value={String(live.light)} />}
            {Object.keys(live).filter(k => !["battery","temperature","moisture","ph","updatedAt","humidity","light"].includes(k)).map(k => (
              <InfoRow key={k} label={k} value={String(live[k])} />
            ))}
          </div>
          {!Object.keys(live).length && (
            <p className="text-[var(--text-secondary)] text-sm text-center py-4">No live data available</p>
          )}
        </Section>
      </div>

      {/* ── Row 3: Raw Readings ─────────────────────────── */}
      <div className="mb-6">

        {/* Raw Readings */}
        <Section 
          title={selectedDate ? `Readings for ${selectedDate} — Reading count: ${isLoadingReadings ? '...' : readings.length}` : "Recent Raw Readings (last 10)"} 
          icon={<Activity size={18} />}
          headerRight={
            <div className="flex items-center gap-2">
              {selectedDate && (
                <button 
                  onClick={() => setSelectedDate("")} 
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs transition-colors"
                >
                  Clear filter
                </button>
              )}
              <input 
                type="date" 
                className="bg-[var(--td-bg)] border border-[var(--td-border)] text-[var(--text-primary)] rounded px-3 py-1.5 text-xs outline-none focus:border-[#0FA56F]"
                style={{ colorScheme: "var(--calendar-scheme)" }}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                onClick={(e) => {
                  try {
                    if ("showPicker" in e.target) {
                      (e.target as HTMLInputElement).showPicker();
                    }
                  } catch (err) {}
                }}
              />
            </div>
          }
        >
          <div className="overflow-x-auto">
            {isLoadingReadings ? (
              <div className="py-12 flex justify-center items-center text-[var(--text-secondary)] text-sm animate-pulse">
                Fetching readings...
              </div>
            ) : (
              <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--td-border)] text-[var(--text-secondary)] uppercase tracking-wide">
                  <th className="pb-2 pr-3">Timestamp</th>
                  <th className="pb-2 pr-3">Temp °C</th>
                  <th className="pb-2 pr-3">Moisture %</th>
                  <th className="pb-2 pr-3">pH</th>
                  <th className="pb-2 pr-3">EC</th>
                  <th className="pb-2 pr-3">N</th>
                  <th className="pb-2 pr-3">P</th>
                  <th className="pb-2 pr-3">K</th>
                  <th className="pb-2 pr-3">Lat</th>
                  <th className="pb-2 pr-3">Lng</th>
                  <th className="pb-2">Battery %</th>
                </tr>
              </thead>
              <tbody>
                {readings.length > 0 ? readings.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--td-border)] hover:bg-[var(--nav-item-active-bg)] transition-colors">
                    <td className="py-2 pr-3 text-[var(--text-secondary)] font-mono text-[10px] whitespace-nowrap">{fmtTs(r.ts)}</td>
                    <td className="py-2 pr-3 font-semibold text-[var(--text-primary)]">{fmt(r.temperature, 1)}</td>
                    <td className="py-2 pr-3 font-semibold text-[var(--text-primary)]">{fmt(r.moisture, 1)}</td>
                    <td className="py-2 pr-3 font-semibold text-[var(--text-primary)]">{fmt(r.ph, 2)}</td>
                    <td className="py-2 pr-3 font-semibold text-[var(--text-primary)]">{fmt(r.ec, 2)}</td>
                    <td className="py-2 pr-3 font-semibold text-[var(--text-primary)]">{fmt(r.n, 0)}</td>
                    <td className="py-2 pr-3 font-semibold text-[var(--text-primary)]">{fmt(r.p, 0)}</td>
                    <td className="py-2 pr-3 font-semibold text-[var(--text-primary)]">{fmt(r.k, 0)}</td>
                    <td className="py-2 pr-3 font-semibold text-[var(--text-primary)]">{fmt(r.latitude, 6)}</td>
                    <td className="py-2 pr-3 font-semibold text-[var(--text-primary)]">{fmt(r.longitude, 6)}</td>
                    <td className="py-2 font-semibold text-[var(--text-primary)]">{r.battery !== undefined ? `${r.battery}%` : "—"}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={11} className="py-6 text-center text-[var(--text-secondary)]">No raw readings found for this selection</td></tr>
                )}
              </tbody>
            </table>
            )}
          </div>
        </Section>
      </div>

      {/* ── Row 4: Daily Summaries ──────────────────────────────────────── */}
      <div className="mb-6">
        {/* Daily Summaries */}
        <Section title="Daily Summaries (last 7 days)" icon={<Calendar size={18} />}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--td-border)] text-[var(--text-secondary)] uppercase tracking-wide">
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2 pr-3">Avg Temp</th>
                  <th className="pb-2 pr-3">Avg Moist.</th>
                  <th className="pb-2 pr-3">Avg pH</th>
                  <th className="pb-2 pr-3">Avg EC</th>
                  <th className="pb-2 pr-3">Avg N</th>
                  <th className="pb-2 pr-3">Avg P</th>
                  <th className="pb-2 pr-3">Avg K</th>
                  <th className="pb-2 pr-3">Avg Lat</th>
                  <th className="pb-2 pr-3">Avg Lng</th>
                  <th className="pb-2 pr-3">Sum Readings</th>
                  <th className="pb-2">Count</th>
                </tr>
              </thead>
              <tbody>
                {dailySums.length > 0 ? dailySums.map((ds, i) => (
                  <tr key={i} className="border-b border-[var(--td-border)] hover:bg-[var(--nav-item-active-bg)] transition-colors">
                    <td className="py-2 pr-3 text-[#0FA56F] font-semibold font-mono">{ds.id}</td>
                    <td className="py-2 pr-3 text-[var(--text-primary)]">{fmt(ds.avg?.temperature, 1, "°C")}</td>
                    <td className="py-2 pr-3 text-[var(--text-primary)]">{fmt(ds.avg?.moisture, 1, "%")}</td>
                    <td className="py-2 pr-3 text-[var(--text-primary)]">{fmt(ds.avg?.ph, 2)}</td>
                    <td className="py-2 pr-3 text-[var(--text-primary)]">{fmt(ds.avg?.ec, 2)}</td>
                    <td className="py-2 pr-3 text-[var(--text-primary)]">{fmt(ds.avg?.n, 0)}</td>
                    <td className="py-2 pr-3 text-[var(--text-primary)]">{fmt(ds.avg?.p, 0)}</td>
                    <td className="py-2 pr-3 text-[var(--text-primary)]">{fmt(ds.avg?.k, 0)}</td>
                    <td className="py-2 pr-3 text-[var(--text-primary)]">{fmt(ds.avg?.latitude, 6)}</td>
                    <td className="py-2 pr-3 text-[var(--text-primary)]">{fmt(ds.avg?.longitude, 6)}</td>
                    <td className="py-2 pr-3 text-[var(--text-secondary)]">{ds.sum?.temperature?.toFixed(1) ?? "—"}</td>
                    <td className="py-2 text-[var(--text-secondary)]">{ds.count ?? "—"}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={12} className="py-6 text-center text-[var(--text-secondary)]">No daily summaries yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      {/* ── Row 4: Monthly Summaries ──────────────────────────────────────── */}
      <div className="mb-6">
        <Section title="Monthly Summaries" icon={<TrendingUp size={18} />}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--td-border)] text-[var(--text-secondary)] uppercase tracking-wide">
                  <th className="pb-2 pr-4">Month</th>
                  <th className="pb-2 pr-4">Avg Temp</th>
                  <th className="pb-2 pr-4">Avg Moist.</th>
                  <th className="pb-2 pr-4">Avg pH</th>
                  <th className="pb-2 pr-4">Avg EC</th>
                  <th className="pb-2 pr-4">Avg N</th>
                  <th className="pb-2 pr-4">Avg P</th>
                  <th className="pb-2 pr-4">Avg K</th>
                  <th className="pb-2 pr-4">Avg Lat</th>
                  <th className="pb-2 pr-4">Avg Lng</th>
                  <th className="pb-2 pr-4">Sum Readings</th>
                  <th className="pb-2">Count</th>
                </tr>
              </thead>
              <tbody>
                {monthlySums.length > 0 ? monthlySums.map((ms, i) => (
                  <tr key={i} className="border-b border-[var(--td-border)] hover:bg-[var(--nav-item-active-bg)] transition-colors">
                    <td className="py-2 pr-4 text-[#0FA56F] font-semibold font-mono">{ms.id}</td>
                    <td className="py-2 pr-4 text-[var(--text-primary)]">{fmt(ms.avg?.temperature, 1, "°C")}</td>
                    <td className="py-2 pr-4 text-[var(--text-primary)]">{fmt(ms.avg?.moisture, 1, "%")}</td>
                    <td className="py-2 pr-4 text-[var(--text-primary)]">{fmt(ms.avg?.ph, 2)}</td>
                    <td className="py-2 pr-4 text-[var(--text-primary)]">{fmt(ms.avg?.ec, 2)}</td>
                    <td className="py-2 pr-4 text-[var(--text-primary)]">{fmt(ms.avg?.n, 0)}</td>
                    <td className="py-2 pr-4 text-[var(--text-primary)]">{fmt(ms.avg?.p, 0)}</td>
                    <td className="py-2 pr-4 text-[var(--text-primary)]">{fmt(ms.avg?.k, 0)}</td>
                    <td className="py-2 pr-4 text-[var(--text-primary)]">{fmt(ms.avg?.latitude, 6)}</td>
                    <td className="py-2 pr-4 text-[var(--text-primary)]">{fmt(ms.avg?.longitude, 6)}</td>
                    <td className="py-2 pr-4 text-[var(--text-secondary)]">{ms.sum?.temperature?.toFixed(1) ?? "—"}</td>
                    <td className="py-2 text-[var(--text-secondary)]">{ms.count ?? "—"}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className="py-6 text-center text-[var(--text-secondary)]">No monthly summaries yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      {/* ── Single Day Graph ─────────────────────────── */}
      <div className="mb-6">
        <Section 
          title={`Single Day Graph ${selectedDate ? `— ${selectedDate}` : ""}`}
          icon={<BarChart2 size={18} />}
          headerRight={
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                className="bg-[var(--td-bg)] border border-[var(--td-border)] text-[var(--text-primary)] rounded px-3 py-1.5 text-xs outline-none focus:border-[#0FA56F]"
                style={{ colorScheme: "var(--calendar-scheme)" }}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                onClick={(e) => {
                  try {
                    if ("showPicker" in e.target) {
                      (e.target as HTMLInputElement).showPicker();
                    }
                  } catch (err) {}
                }}
              />
              <select
                value={singleDayEntity}
                onChange={(e) => setSingleDayEntity(e.target.value)}
                className="bg-[var(--glass-bg)] border border-[var(--td-border)] text-[var(--text-primary)] rounded px-3 py-1.5 text-xs outline-none focus:border-[#0FA56F] font-medium"
              >
                <option value="temperature" className="bg-[var(--bg-color)]">Temperature (°C)</option>
                <option value="moisture" className="bg-[var(--bg-color)]">Moisture (%)</option>
                <option value="ph" className="bg-[var(--bg-color)]">pH</option>
                <option value="ec" className="bg-[var(--bg-color)]">EC</option>
                <option value="n" className="bg-[var(--bg-color)]">Nitrogen (N)</option>
                <option value="p" className="bg-[var(--bg-color)]">Phosphorus (P)</option>
                <option value="k" className="bg-[var(--bg-color)]">Potassium (K)</option>
              </select>
              {selectedDate && (
                <button 
                  onClick={() => setSelectedDate("")} 
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs transition-colors ml-2 hidden sm:block"
                >
                  Clear filter
                </button>
              )}
            </div>
          }
        >
          {selectedDate ? (
            <SingleDayLineChart 
              data={singleDayChartData} 
              label={singleDayEntity.charAt(0).toUpperCase() + singleDayEntity.slice(1)} 
              unit={
                singleDayEntity === 'temperature' ? '°C' : 
                singleDayEntity === 'moisture' ? '%' : 
                singleDayEntity === 'ec' ? ' mS/cm' :
                ['n', 'p', 'k'].includes(singleDayEntity) ? ' mg/kg' : ''
              }
            />
          ) : (
            <div className="py-8 text-center text-[var(--text-secondary)] text-sm flex flex-col items-center justify-center border border-dashed border-[var(--td-border)] rounded-lg">
              <Calendar size={24} className="mb-2 text-[var(--text-secondary)] opacity-50" />
              <p>Please select a date to view the daily graph.</p>
            </div>
          )}
        </Section>
      </div>

      {/* ── Row 5: Graph Data (monthly + yearly) ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        <Section title={`Monthly Graph Data${monthlyGraph ? ` — ${monthlyGraph.id}` : ""}`} icon={<BarChart2 size={18} />}>
          {Object.keys(monthlyDays).length > 0 ? (
            <div className="space-y-4">
              <MiniBarChart data={monthlyDays} label="Avg Temperature per Day (°C)" />
              {monthlyGraph?.moisture?.days && (
                <MiniBarChart data={monthlyGraph.moisture.days} label="Avg Moisture per Day (%)" />
              )}
            </div>
          ) : (
            <p className="text-[var(--text-secondary)] text-sm text-center py-4">No monthly graph data for current month</p>
          )}
        </Section>

        <Section title={`Yearly Graph Data${yearlyGraph ? ` — ${yearlyGraph.id}` : ""}`} icon={<Zap size={18} />}>
          {Object.keys(yearlyMonths).length > 0 ? (
            <div className="space-y-4">
              <MiniBarChart data={yearlyMonths} label="Avg Temperature per Month (°C)" />
            </div>
          ) : (
            <p className="text-[var(--text-secondary)] text-sm text-center py-4">No yearly graph data for current year</p>
          )}
        </Section>
      </div>

      {/* ── Footer: Export Section ───────────────────────────────────────────── */}
      <div className={`${styles.glassPanel} p-6 flex flex-col md:flex-row items-center justify-between gap-4`} style={{ borderStyle: "dashed" }}>
        <div className="flex items-center gap-4">
          <FileSpreadsheet size={24} className="text-[#0FA56F] shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Data Export</p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Download the device data as CSV for offline analysis. 
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 bg-[var(--nav-item-active-bg)] text-[#0FA56F] border border-[var(--border-color)] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0FA56F] hover:text-white transition-colors"
          >
            <Download size={16} /> Raw Readings
          </button>
          <button 
            onClick={() => exportDailySummariesCsv(dailySums, device.id)}
            className="flex items-center gap-2 bg-[var(--nav-item-active-bg)] text-[#0FA56F] border border-[var(--border-color)] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0FA56F] hover:text-white transition-colors"
          >
            <Download size={16} /> Daily Summaries
          </button>
        </div>
      </div>

      {/* ── Export Modal ─────────────────────────────────────────────────── */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`${styles.glassPanel} w-full max-w-md p-6 relative`} style={{ background: "var(--glass-bg)", borderColor: "var(--border-color)" }}>
            <button 
              onClick={() => setIsExportModalOpen(false)}
              className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-[var(--text-primary)]">
              <Download size={20} className="text-[#0FA56F]" />
              Export Custom Data
            </h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-2">Export Scope</label>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={() => setExportType("specific")}
                    className={`py-2 px-3 text-sm rounded-lg border transition-colors ${exportType === "specific" ? "bg-[#0FA56F]/10 border-[#0FA56F] text-[#0FA56F]" : "border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[#0FA56F]/50"}`}
                  >
                    Specific Day
                  </button>
                  <button 
                    onClick={() => setExportType("range")}
                    className={`py-2 px-3 text-sm rounded-lg border transition-colors ${exportType === "range" ? "bg-[#0FA56F]/10 border-[#0FA56F] text-[#0FA56F]" : "border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[#0FA56F]/50"}`}
                  >
                    Date Range
                  </button>
                  <button 
                    onClick={() => setExportType("all")}
                    className={`py-2 px-3 text-sm rounded-lg border transition-colors ${exportType === "all" ? "bg-[#0FA56F]/10 border-[#0FA56F] text-[#0FA56F]" : "border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[#0FA56F]/50"}`}
                  >
                    All Data
                  </button>
                </div>
              </div>

              {exportType !== "all" && (
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-2">
                    {exportType === "specific" ? "Select Date" : "Start Date"}
                  </label>
                  <input 
                    type="date" 
                    className="w-full bg-[var(--td-bg)] border border-[var(--td-border)] text-[var(--text-primary)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0FA56F]"
                    style={{ colorScheme: "var(--calendar-scheme)" }}
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    onClick={(e) => { try { if ("showPicker" in e.target) { (e.target as HTMLInputElement).showPicker(); } } catch {} }}
                  />
                </div>
              )}

              {exportType === "range" && (
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-2">End Date</label>
                  <input 
                    type="date" 
                    className="w-full bg-[var(--td-bg)] border border-[var(--td-border)] text-[var(--text-primary)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0FA56F]"
                    style={{ colorScheme: "var(--calendar-scheme)" }}
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    onClick={(e) => { try { if ("showPicker" in e.target) { (e.target as HTMLInputElement).showPicker(); } } catch {} }}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--td-border)] transition-colors"
                disabled={isExporting}
              >
                Cancel
              </button>
              <button 
                onClick={handleCustomExport}
                disabled={isExporting || (exportType !== "all" && !exportStartDate) || (exportType === "range" && !exportEndDate)}
                className="flex items-center gap-2 bg-[#0FA56F] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#0e9363] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? "Exporting..." : "Download CSV"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
