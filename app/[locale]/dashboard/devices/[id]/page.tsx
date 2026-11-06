"use client";

import { useEffect, useState, useMemo } from "react";
import { db, auth } from "@/lib/firebase";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  onSnapshot,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowLeft,
  Activity,
  BarChart2,
  Calendar,
  TrendingUp,
  Download,
  FileSpreadsheet,
  MapPin,
  Settings,
  Power,
  PowerOff,
  Radio,
  Clock,
  AlertTriangle,
} from "lucide-react";

import { exportCustomReadings, exportDailySummariesCsv } from "./exportUtils";
import { Badge } from "@/components/ui/Badge";
import { CopyButton } from "@/components/ui/CopyButton";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { Modal } from "@/components/ui/Modal";
import { Link } from "@/src/i18n/routing";
import {
  DeviceDetailSkeleton,
  TelemetryLogsSkeleton,
} from "@/components/ui/Skeleton";

// Helpers
function fmt(v: number | undefined, digits = 1, unit = "") {
  return v !== undefined && v !== null ? `${Number(v).toFixed(digits)}${unit}` : "—";
}

function fmtTs(ts: any) {
  if (!ts) return "—";
  try {
    return ts.toDate().toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return String(ts);
  }
}

// Mini Bar Chart
function MiniBarChart({ data, label }: { data: Record<string, number>; label: string }) {
  const entries = Object.entries(data).sort((a, b) => Number(a[0]) - Number(b[0]));
  if (entries.length === 0) {
    return <p className="text-zinc-400 text-sm py-4 text-center font-mono">No data</p>;
  }
  const max = Math.max(...entries.map(([, v]) => v), 0.001);

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
        {label}
      </span>
      <div className="flex items-end gap-1.5 h-20 pt-2 border-b border-zinc-200 dark:border-zinc-800">
        {entries.map(([k, v]) => (
          <div
            key={k}
            className="flex flex-col items-center flex-1 h-full justify-end group relative"
          >
            <div
              style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
              className="w-full bg-zinc-700 dark:bg-zinc-300 group-hover:bg-emerald-500 rounded-t transition-colors"
            />
            <span className="text-xs text-zinc-400 mt-1 font-mono">{k}</span>
            <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900 text-white text-xs px-1.5 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-20 font-mono">
              {k}: {v.toFixed(1)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Single Day Line Chart
function SingleDayLineChart({
  data,
  label,
  unit,
}: {
  data: { time: string; value: number }[];
  label: string;
  unit?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-72 w-full animate-pulse bg-zinc-100 dark:bg-zinc-800 rounded-lg" />;
  }

  if (data.length === 0) {
    return (
      <div className="h-72 flex flex-col items-center justify-center text-zinc-400 text-sm gap-1.5 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg font-mono">
        <Activity size={24} className="opacity-30" />
        <span>No sensor points recorded for this date</span>
      </div>
    );
  }

  return (
    <div className="w-full h-80 pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 25, left: -10 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="var(--border-subtle)" vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fill: "var(--chart-axis-text)", fontSize: 11, fontFamily: "monospace" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border-subtle)" }}
            minTickGap={30}
          />
          <YAxis
            tick={{ fill: "var(--chart-axis-text)", fontSize: 11, fontFamily: "monospace" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${Number(v).toFixed(1)}${unit || ""}`}
            width={65}
          />
          <RechartsTooltip
            contentStyle={{
              backgroundColor: "var(--bg-surface)",
              borderColor: "var(--border-subtle)",
              borderRadius: "8px",
              color: "var(--text-primary)",
              fontSize: "12px",
              fontFamily: "monospace",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            }}
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="value"
            name={label}
            stroke="#10b981"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: "#10b981", stroke: "#ffffff", strokeWidth: 2 }}
            connectNulls={true}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function DeviceDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [activeTab, setActiveTab] = useState<"overview" | "logs" | "analytics" | "diagnostics">(
    "overview"
  );
  const [device, setDevice] = useState<any>(null);
  const [liveLatest, setLiveLatest] = useState<any>(null);
  const [statusDoc, setStatusDoc] = useState<any>(null);
  const [readings, setReadings] = useState<any[]>([]);
  const [dailySums, setDailySums] = useState<any[]>([]);
  const [monthlySums, setMonthlySums] = useState<any[]>([]);
  const [monthlyGraph, setMonthlyGraph] = useState<any>(null);
  const [yearlyGraph, setYearlyGraph] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [totalReadingsCount, setTotalReadingsCount] = useState<number>(0);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [singleDayEntity, setSingleDayEntity] = useState<string>("temperature");
  const [isLoadingReadings, setIsLoadingReadings] = useState(false);

  const [readingsLimit, setReadingsLimit] = useState<number>(20);

  // Export Modal
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState<"specific" | "range" | "all">("specific");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const unsubs: (() => void)[] = [];

    // 1. Root device doc
    unsubs.push(
      onSnapshot(doc(db, "devices", id), async (snap) => {
        let ownerId: string | null = null;
        let ownerName: string | null = null;
        try {
          const detSnap = await getDocs(collection(db, "devices", id, "details"));
          if (!detSnap.empty) {
            const d = detSnap.docs.find((d) => d.data().role === "owner") || detSnap.docs[0];
            ownerId = d.data().ownerUserId ?? null;
            if (ownerId) {
              const cSnap = await getDoc(doc(db, "customers", ownerId));
              if (cSnap.exists()) {
                const c = cSnap.data();
                ownerName = `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.name || null;
              }
            }
          }
        } catch {}

        const deviceData = snap.exists()
          ? snap.data()
          : { status: "unknown", firmwareVersion: "unknown" };
        setDevice({ id, ownerUserId: ownerId, ownerName, ...deviceData });
        setLoading(false);
      })
    );

    // 2. live/latest
    unsubs.push(
      onSnapshot(doc(db, "devices", id, "live", "latest"), (docSnap) => {
        if (docSnap.exists()) setLiveLatest(docSnap.data());
      })
    );

    // 3. status/current
    unsubs.push(
      onSnapshot(doc(db, "devices", id, "status", "current"), async (stSnap) => {
        if (stSnap.exists()) setStatusDoc(stSnap.data());
        else {
          try {
            const oldSnap = await getDoc(doc(db, "devices", id, "live", "status"));
            if (oldSnap.exists()) setStatusDoc(oldSnap.data());
          } catch {}
        }
      })
    );

    // 4. dailySummaries
    unsubs.push(
      onSnapshot(collection(db, "devices", id, "dailySummaries"), (dsSnap) => {
        const all = dsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        all.sort((a, b) => b.id.localeCompare(a.id));
        setDailySums(all.slice(0, 7));
      })
    );

    // 5. monthlySummaries
    unsubs.push(
      onSnapshot(collection(db, "devices", id, "monthlySummaries"), (msSnap) => {
        const all = msSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const total = all.reduce((sum, ms: any) => sum + (ms.count || 0), 0);
        setTotalReadingsCount(total);
        all.sort((a, b) => b.id.localeCompare(a.id));
        setMonthlySums(all.slice(0, 6));
      })
    );

    // 6. monthly graph
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    unsubs.push(
      onSnapshot(doc(db, "devices", id, "monthly", monthKey), (mgSnap) => {
        if (mgSnap.exists()) setMonthlyGraph({ id: mgSnap.id, ...mgSnap.data() });
      })
    );

    // 7. yearly graph
    const yearKey = String(new Date().getFullYear());
    unsubs.push(
      onSnapshot(doc(db, "devices", id, "yearly", yearKey), (ygSnap) => {
        if (ygSnap.exists()) setYearlyGraph({ id: ygSnap.id, ...ygSnap.data() });
      })
    );

    return () => unsubs.forEach((u) => u());
  }, [id]);

  // Query Readings
  useEffect(() => {
    if (!id || loading) return;

    setIsLoadingReadings(true);
    let q;
    if (!selectedDate) {
      q = query(
        collection(db, "devices", id, "readings"),
        orderBy("ts", "desc"),
        limit(readingsLimit)
      );
    } else {
      const start = new Date(`${selectedDate}T00:00:00`);
      const end = new Date(`${selectedDate}T23:59:59.999`);
      q = query(
        collection(db, "devices", id, "readings"),
        where("ts", ">=", start),
        where("ts", "<=", end),
        orderBy("ts", "desc"),
        limit(readingsLimit)
      );
    }

    const unsub = onSnapshot(
      q,
      (rSnap) => {
        setReadings(rSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setIsLoadingReadings(false);
      },
      (err) => {
        console.error("Readings query error:", err);
        setIsLoadingReadings(false);
      }
    );

    return () => unsub();
  }, [id, selectedDate, readingsLimit, loading]);

  const singleDayChartData = useMemo(() => {
    if (!selectedDate || readings.length === 0) return [];
    const sorted = [...readings].sort((a, b) => {
      if (!a.ts || !b.ts) return 0;
      return a.ts.toMillis() - b.ts.toMillis();
    });

    const data: { time: string; value: number }[] = [];
    sorted.forEach((r) => {
      if (!r.ts) return;
      let d;
      try {
        d = r.ts.toDate();
      } catch {
        return;
      }
      const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(
        2,
        "0"
      )}`;
      if (r[singleDayEntity] !== undefined && !isNaN(Number(r[singleDayEntity]))) {
        data.push({
          time: timeStr,
          value: Number(r[singleDayEntity]),
        });
      }
    });

    return data;
  }, [readings, selectedDate, singleDayEntity]);

  if (loading) {
    return <DeviceDetailSkeleton />;
  }

  if (!device) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 font-medium"
        >
          <ArrowLeft size={16} /> Back to Devices
        </button>
        <div className="p-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <AlertTriangle size={28} className="text-amber-500 mx-auto mb-2" />
          <h2 className="text-base font-semibold">Device Not Found</h2>
          <p className="text-sm text-zinc-400 mt-1 font-mono">
            ID: {id}
          </p>
        </div>
      </div>
    );
  }

  const live = liveLatest ?? statusDoc ?? {};
  const battery: number | undefined = live.battery ?? statusDoc?.battery;
  const temperature: number | undefined = live.temperature;
  const moisture: number | undefined = live.moisture;
  const ph: number | undefined = live.ph;
  const ec: number | undefined = live.ec;
  const n: number | undefined = live.n;
  const p: number | undefined = live.p;
  const k: number | undefined = live.k;
  const lastOnline = statusDoc?.lastOnlineAt ?? live.updatedAt;

  const st = (device.status || "offline").toLowerCase();
  const badgeVariant: "online" | "offline" = st === "online" ? "online" : "offline";

  const monthlyDays: Record<string, number> = {};
  const yearlyMonths: Record<string, number> = {};
  if (monthlyGraph?.days) {
    Object.entries(monthlyGraph.days).forEach(([k, v]: any) => {
      monthlyDays[k] = Number(v) || 0;
    });
  }
  if (yearlyGraph?.months) {
    Object.entries(yearlyGraph.months).forEach(([k, v]: any) => {
      yearlyMonths[k] = Number(v) || 0;
    });
  }

  // Admin Actions
  const handleSetStatus = async (newStatus: "online" | "offline") => {
    if (!id || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      await updateDoc(doc(db, "devices", id), { status: newStatus });
      await setDoc(
        doc(db, "devices", id, "status", "current"),
        { status: newStatus, updatedAt: new Date() },
        { merge: true }
      );
    } catch (e) {
      console.error("Failed to update status", e);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleReduceBattery = async () => {
    if (!id || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      const currentBattery = battery !== undefined ? battery : 100;
      const newBattery = Math.max(0, currentBattery - 5);
      await setDoc(
        doc(db, "devices", id, "status", "current"),
        { battery: newBattery, updatedAt: new Date() },
        { merge: true }
      );
    } catch (e) {
      console.error("Failed to reduce battery", e);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleCustomExport = async () => {
    await exportCustomReadings(device.id, exportType, exportStartDate, exportEndDate, {
      onStart: () => setIsExporting(true),
      onSuccess: () => setIsExportModalOpen(false),
      onError: () => {},
      onEnd: () => setIsExporting(false),
    });
  };

  const tabs = [
    { id: "overview", label: "Live Telemetry" },
    {
      id: "logs",
      label: "Readings Log",
      badge: readings.length,
    },
    { id: "analytics", label: "Diurnal Trends" },
    { id: "diagnostics", label: "Diagnostics & Simulator" },
  ];

  return (
    <div className="p-5 sm:p-8 lg:p-10 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Back Button */}
      <div>
        <Link
          href="/dashboard/devices"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to Device Fleet</span>
        </Link>
      </div>

      {/* Header Info Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
              {device.id}
            </h1>
            <CopyButton value={device.id} label="Device ID" size={16} />
            <Badge variant={badgeVariant} dot>
              {st.toUpperCase()}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs sm:text-sm text-zinc-500 font-mono">
            {device.firmwareVersion && <span>Firmware: v{device.firmwareVersion}</span>}
            {totalReadingsCount > 0 && <span>• {totalReadingsCount.toLocaleString()} readings processed</span>}
            {device.ownerName && (
              <span className="font-sans">
                • Client:{" "}
                <Link
                  href={`/dashboard/users?id=${device.ownerUserId}`}
                  className="font-semibold text-zinc-800 dark:text-zinc-200 hover:underline"
                >
                  {device.ownerName}
                </Link>
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Button
            size="md"
            variant="outline"
            icon={<Download size={15} />}
            onClick={() => setIsExportModalOpen(true)}
            className="text-sm px-4 py-2"
          >
            Export CSV
          </Button>
          <Button
            size="md"
            variant="secondary"
            icon={<FileSpreadsheet size={15} />}
            onClick={() => exportDailySummariesCsv(dailySums, device.id)}
            className="text-sm px-4 py-2"
          >
            Daily Summaries
          </Button>
        </div>
      </div>

      {/* Telemetry HUD Strip - Large High-Contrast Instrumentation Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* Temp */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-subtle">
          <span className="text-xs font-mono font-semibold text-zinc-500 uppercase tracking-wider block">
            TEMP
          </span>
          <div className="mt-1.5 flex items-baseline gap-1 font-mono">
            <span className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
              {fmt(temperature, 1)}
            </span>
            <span className="text-xs text-zinc-400 font-semibold">°C</span>
          </div>
        </div>

        {/* Moisture */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-subtle">
          <span className="text-xs font-mono font-semibold text-zinc-500 uppercase tracking-wider block">
            MOISTURE
          </span>
          <div className="mt-1.5 flex items-baseline gap-1 font-mono">
            <span className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
              {fmt(moisture, 1)}
            </span>
            <span className="text-xs text-zinc-400 font-semibold">%</span>
          </div>
        </div>

        {/* pH */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-subtle">
          <span className="text-xs font-mono font-semibold text-zinc-500 uppercase tracking-wider block">
            PH
          </span>
          <div className="mt-1.5 flex items-baseline gap-1 font-mono">
            <span className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
              {fmt(ph, 2)}
            </span>
          </div>
        </div>

        {/* EC */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-subtle">
          <span className="text-xs font-mono font-semibold text-zinc-500 uppercase tracking-wider block">
            EC
          </span>
          <div className="mt-1.5 flex items-baseline gap-1 font-mono">
            <span className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
              {fmt(ec, 2)}
            </span>
            <span className="text-xs text-zinc-400">mS</span>
          </div>
        </div>

        {/* Nitrogen */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-subtle">
          <span className="text-xs font-mono font-semibold text-zinc-500 uppercase tracking-wider block">
            NITROGEN
          </span>
          <div className="mt-1.5 flex items-baseline gap-1 font-mono">
            <span className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
              {fmt(n, 0)}
            </span>
            <span className="text-xs text-zinc-400">mg</span>
          </div>
        </div>

        {/* Phosphorus */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-subtle">
          <span className="text-xs font-mono font-semibold text-zinc-500 uppercase tracking-wider block">
            PHOSPHORUS
          </span>
          <div className="mt-1.5 flex items-baseline gap-1 font-mono">
            <span className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
              {fmt(p, 0)}
            </span>
            <span className="text-xs text-zinc-400">mg</span>
          </div>
        </div>

        {/* Potassium */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-subtle">
          <span className="text-xs font-mono font-semibold text-zinc-500 uppercase tracking-wider block">
            POTASSIUM
          </span>
          <div className="mt-1.5 flex items-baseline gap-1 font-mono">
            <span className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
              {fmt(k, 0)}
            </span>
            <span className="text-xs text-zinc-400">mg</span>
          </div>
        </div>

        {/* Battery */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-subtle">
          <span className="text-xs font-mono font-semibold text-zinc-500 uppercase tracking-wider block">
            BATTERY
          </span>
          <div className="mt-1.5 flex items-baseline gap-1 font-mono">
            <span
              className={`text-2xl sm:text-3xl font-bold tabular-nums ${
                battery !== undefined && battery < 20
                  ? "text-rose-500"
                  : battery !== undefined && battery < 50
                  ? "text-amber-500"
                  : "text-zinc-900 dark:text-zinc-100"
              }`}
            >
              {battery !== undefined ? battery : "—"}
            </span>
            <span className="text-xs text-zinc-400 font-semibold">%</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as any)}
      />

      {/* Tab 1: Live Specs & Hardware Details */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Live Data Attributes */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-subtle space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                  Live Telemetry Payload
                </span>
                <span className="text-xs font-mono text-zinc-500">
                  {fmtTs(live.updatedAt || lastOnline)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm font-mono">
                <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-500 text-xs block">Temperature</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 text-base">{fmt(temperature, 1, " °C")}</span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-500 text-xs block">Moisture</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 text-base">{fmt(moisture, 1, " %")}</span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-500 text-xs block">pH Acidity</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 text-base">{fmt(ph, 2)}</span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-500 text-xs block">EC Salinity</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 text-base">{fmt(ec, 2, " mS/cm")}</span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-500 text-xs block">Humidity</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 text-base">{fmt(live.humidity, 1, " %")}</span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-500 text-xs block">Light Intensity</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 text-base">{fmt(live.light, 0, " lx")}</span>
                </div>
              </div>
            </div>

            {/* Hardware Identity & Assignment */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-subtle space-y-4">
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider block pb-3 border-b border-zinc-100 dark:border-zinc-800">
                Hardware Configuration
              </span>

              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-sm">
                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-zinc-500 font-sans">Probe ID</span>
                  <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{device.id}</span>
                </div>
                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-zinc-500 font-sans">Assigned Client</span>
                  {device.ownerUserId ? (
                    <Link
                      href={`/dashboard/users?id=${device.ownerUserId}`}
                      className="font-semibold text-emerald-600 hover:underline"
                    >
                      {device.ownerName || device.ownerUserId}
                    </Link>
                  ) : (
                    <span className="text-zinc-400 italic">Unassigned</span>
                  )}
                </div>
                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-zinc-500 font-sans">Firmware Build</span>
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">
                    {device.firmwareVersion || "v1.0.0"}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-zinc-500 font-sans">Last Connection</span>
                  <span className="font-mono text-zinc-500 text-xs">{fmtTs(lastOnline)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Location Map */}
          {live.latitude !== undefined && live.longitude !== undefined && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-subtle space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                  <MapPin size={16} className="text-emerald-600" />
                  <span>GPS Field Coordinates</span>
                </span>
                <span className="font-mono text-xs sm:text-sm text-zinc-500">
                  {live.latitude}, {live.longitude}
                </span>
              </div>
              <div className="w-full h-72 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://maps.google.com/maps?q=${live.latitude},${live.longitude}&z=15&output=embed`}
                  style={{ border: 0 }}
                  title="Device Location"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Historical Logs Table */}
      {activeTab === "logs" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-subtle overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                  Raw Telemetry Log
                </h3>
                <span className="text-xs text-zinc-500 font-mono mt-0.5 block">
                  {selectedDate ? `Date: ${selectedDate}` : `Showing last ${readings.length} records`}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                {selectedDate && (
                  <button
                    onClick={() => setSelectedDate("")}
                    className="text-xs sm:text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium hover:underline"
                  >
                    Clear filter
                  </button>
                )}
                <input
                  type="date"
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 font-mono outline-none"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
                <select
                  value={readingsLimit}
                  onChange={(e) => setReadingsLimit(Number(e.target.value))}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 font-mono outline-none"
                >
                  <option value={20}>20 rows</option>
                  <option value={50}>50 rows</option>
                  <option value={100}>100 rows</option>
                </select>
              </div>
            </div>

            {isLoadingReadings ? (
              <TelemetryLogsSkeleton count={6} />
            ) : (
              <>
                {/* Mobile Telemetry Log Cards (< 768px) */}
                <div className="block md:hidden divide-y divide-zinc-100 dark:divide-zinc-800/80">
                  {readings.length > 0 ? (
                    readings.map((r, i) => (
                      <div key={i} className="p-4 space-y-3 font-mono">
                        {/* Header: Timestamp + Battery */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            {fmtTs(r.ts)}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold">
                            Batt: {r.battery !== undefined ? `${r.battery}%` : "—"}
                          </span>
                        </div>

                        {/* Physical Soil Conditions */}
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800">
                            <span className="text-[10px] text-zinc-400 block font-sans">TEMP</span>
                            <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                              {fmt(r.temperature, 1)}°
                            </span>
                          </div>
                          <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800">
                            <span className="text-[10px] text-zinc-400 block font-sans">MOIST</span>
                            <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                              {fmt(r.moisture, 1)}%
                            </span>
                          </div>
                          <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800">
                            <span className="text-[10px] text-zinc-400 block font-sans">pH</span>
                            <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                              {fmt(r.ph, 2)}
                            </span>
                          </div>
                          <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800">
                            <span className="text-[10px] text-zinc-400 block font-sans">EC</span>
                            <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                              {fmt(r.ec, 2)}
                            </span>
                          </div>
                        </div>

                        {/* NPK Nutrients */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-1.5 rounded bg-zinc-50/60 dark:bg-zinc-800/20 border border-zinc-100 dark:border-zinc-800">
                            <span className="text-[10px] text-zinc-400 block font-sans">N</span>
                            <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                              {fmt(r.n, 0)} <span className="text-[10px] font-normal text-zinc-400">mg/kg</span>
                            </span>
                          </div>
                          <div className="p-1.5 rounded bg-zinc-50/60 dark:bg-zinc-800/20 border border-zinc-100 dark:border-zinc-800">
                            <span className="text-[10px] text-zinc-400 block font-sans">P</span>
                            <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                              {fmt(r.p, 0)} <span className="text-[10px] font-normal text-zinc-400">mg/kg</span>
                            </span>
                          </div>
                          <div className="p-1.5 rounded bg-zinc-50/60 dark:bg-zinc-800/20 border border-zinc-100 dark:border-zinc-800">
                            <span className="text-[10px] text-zinc-400 block font-sans">K</span>
                            <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                              {fmt(r.k, 0)} <span className="text-[10px] font-normal text-zinc-400">mg/kg</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-10 text-center text-zinc-400 font-sans text-sm">
                      No sensor readings found for this selection
                    </div>
                  )}
                </div>

                {/* Desktop Spreadsheet Table (>= 768px) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse font-mono min-w-[700px]">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-500 bg-zinc-50/75 dark:bg-zinc-900/50 uppercase">
                        <th className="py-3 px-3.5">Timestamp</th>
                        <th className="py-3 px-3.5">Temp (°C)</th>
                        <th className="py-3 px-3.5">Moist (%)</th>
                        <th className="py-3 px-3.5">pH</th>
                        <th className="py-3 px-3.5">EC</th>
                        <th className="py-3 px-3.5">N</th>
                        <th className="py-3 px-3.5">P</th>
                        <th className="py-3 px-3.5">K</th>
                        <th className="py-3 px-3.5">Batt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                      {readings.length > 0 ? (
                        readings.map((r, i) => (
                          <tr
                            key={i}
                            className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                          >
                            <td className="py-2.5 px-3.5 text-zinc-500 text-xs whitespace-nowrap">
                              {fmtTs(r.ts)}
                            </td>
                            <td className="py-2.5 px-3.5 font-bold text-zinc-900 dark:text-zinc-100">
                              {fmt(r.temperature, 1)}
                            </td>
                            <td className="py-2.5 px-3.5 font-bold text-zinc-900 dark:text-zinc-100">
                              {fmt(r.moisture, 1)}
                            </td>
                            <td className="py-2.5 px-3.5 font-bold text-zinc-900 dark:text-zinc-100">
                              {fmt(r.ph, 2)}
                            </td>
                            <td className="py-2.5 px-3.5 font-bold text-zinc-900 dark:text-zinc-100">
                              {fmt(r.ec, 2)}
                            </td>
                            <td className="py-2.5 px-3.5 font-bold text-zinc-900 dark:text-zinc-100">
                              {fmt(r.n, 0)}
                            </td>
                            <td className="py-2.5 px-3.5 font-bold text-zinc-900 dark:text-zinc-100">
                              {fmt(r.p, 0)}
                            </td>
                            <td className="py-2.5 px-3.5 font-bold text-zinc-900 dark:text-zinc-100">
                              {fmt(r.k, 0)}
                            </td>
                            <td className="py-2.5 px-3.5 text-zinc-500">
                              {r.battery !== undefined ? `${r.battery}%` : "—"}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9} className="py-10 text-center text-zinc-400 font-sans text-sm">
                            No sensor readings found for this selection
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Daily Summaries */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-subtle overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                Daily Summaries (Last 7 Days)
              </h3>
              <Button
                size="sm"
                variant="ghost"
                icon={<Download size={14} />}
                onClick={() => exportDailySummariesCsv(dailySums, device.id)}
                className="text-xs"
              >
                CSV
              </Button>
            </div>

            {/* Mobile Daily Summary Cards (< 640px) */}
            <div className="block sm:hidden divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {dailySums.length > 0 ? (
                dailySums.map((ds, i) => (
                  <div key={i} className="p-4 space-y-2.5 font-mono">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                        {ds.id}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {ds.count ?? 0} samples
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-850 border border-zinc-100 dark:border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block font-sans">AVG TEMP</span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{fmt(ds.avg?.temperature, 1, "°C")}</span>
                      </div>
                      <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-850 border border-zinc-100 dark:border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block font-sans">AVG MOIST</span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{fmt(ds.avg?.moisture, 1, "%")}</span>
                      </div>
                      <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-850 border border-zinc-100 dark:border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block font-sans">AVG pH</span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{fmt(ds.avg?.ph, 2)}</span>
                      </div>
                      <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-850 border border-zinc-100 dark:border-zinc-800">
                        <span className="text-[10px] text-zinc-400 block font-sans">AVG EC</span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{fmt(ds.avg?.ec, 2)}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-zinc-400 font-sans text-sm">
                  No daily summaries computed yet
                </div>
              )}
            </div>

            {/* Desktop Table (>= 640px) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse font-mono min-w-[550px]">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-500 bg-zinc-50/75 dark:bg-zinc-900/50 uppercase">
                    <th className="py-3 px-3.5">Date</th>
                    <th className="py-3 px-3.5">Avg Temp</th>
                    <th className="py-3 px-3.5">Avg Moist</th>
                    <th className="py-3 px-3.5">Avg pH</th>
                    <th className="py-3 px-3.5">Avg EC</th>
                    <th className="py-3 px-3.5">Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {dailySums.length > 0 ? (
                    dailySums.map((ds, i) => (
                      <tr
                        key={i}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                      >
                        <td className="py-2.5 px-3.5 font-bold text-zinc-900 dark:text-zinc-100">
                          {ds.id}
                        </td>
                        <td className="py-2.5 px-3.5">{fmt(ds.avg?.temperature, 1, "°C")}</td>
                        <td className="py-2.5 px-3.5">{fmt(ds.avg?.moisture, 1, "%")}</td>
                        <td className="py-2.5 px-3.5">{fmt(ds.avg?.ph, 2)}</td>
                        <td className="py-2.5 px-3.5">{fmt(ds.avg?.ec, 2)}</td>
                        <td className="py-2.5 px-3.5 text-zinc-500">{ds.count ?? "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-400 font-sans text-sm">
                        No daily summaries computed yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Trends & Diurnal Charts */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-subtle space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                Diurnal Sensor Curve
              </span>
              <div className="flex items-center gap-2.5">
                <input
                  type="date"
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 font-mono outline-none"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
                <select
                  value={singleDayEntity}
                  onChange={(e) => setSingleDayEntity(e.target.value)}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-xs sm:text-sm font-mono text-zinc-900 dark:text-zinc-100 outline-none"
                >
                  <option value="temperature">Temperature (°C)</option>
                  <option value="moisture">Moisture (%)</option>
                  <option value="ph">pH Level</option>
                  <option value="ec">EC (mS/cm)</option>
                  <option value="n">Nitrogen (mg/kg)</option>
                  <option value="p">Phosphorus (mg/kg)</option>
                  <option value="k">Potassium (mg/kg)</option>
                </select>
              </div>
            </div>

            {selectedDate ? (
              <SingleDayLineChart
                data={singleDayChartData}
                label={singleDayEntity.toUpperCase()}
                unit={
                  singleDayEntity === "temperature"
                    ? "°C"
                    : singleDayEntity === "moisture"
                    ? "%"
                    : singleDayEntity === "ec"
                    ? " mS/cm"
                    : ["n", "p", "k"].includes(singleDayEntity)
                    ? " mg/kg"
                    : ""
                }
              />
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-zinc-400 text-sm gap-2 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg font-mono">
                <Calendar size={22} className="opacity-40" />
                <span>Select a date above to render the high-resolution trend curve</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-subtle space-y-3">
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider block pb-2 border-b border-zinc-100 dark:border-zinc-800">
                Monthly Aggregation (°C)
              </span>
              <MiniBarChart data={monthlyDays} label="Daily Mean Temperature" />
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-subtle space-y-3">
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider block pb-2 border-b border-zinc-100 dark:border-zinc-800">
                Yearly Aggregation (°C)
              </span>
              <MiniBarChart data={yearlyMonths} label="Monthly Mean Temperature" />
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Diagnostics & Hardware Simulator */}
      {activeTab === "diagnostics" && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-subtle space-y-4">
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider block pb-3 border-b border-zinc-100 dark:border-zinc-800">
              Hardware State Simulator
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 space-y-3">
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 block">
                  Simulate Connection State
                </span>
                <div className="flex flex-wrap gap-2.5">
                  <Button
                    size="md"
                    variant="primary"
                    disabled={isUpdatingStatus || st === "online"}
                    icon={<Power size={14} />}
                    onClick={() => handleSetStatus("online")}
                    className="text-xs px-3 py-1.5"
                  >
                    Force Online
                  </Button>
                  <Button
                    size="md"
                    variant="danger"
                    disabled={isUpdatingStatus || st === "offline"}
                    icon={<PowerOff size={14} />}
                    onClick={() => handleSetStatus("offline")}
                    className="text-xs px-3 py-1.5"
                  >
                    Force Offline
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    Battery Simulation
                  </span>
                  <span className="font-mono text-sm font-bold">
                    {battery !== undefined ? `${battery}%` : "—"}
                  </span>
                </div>
                <Button
                  size="md"
                  variant="outline"
                  disabled={isUpdatingStatus || battery === 0}
                  onClick={handleReduceBattery}
                  className="text-xs px-3 py-1.5"
                >
                  Simulate -5% Battery
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Export Telemetry Data"
        icon={<Download size={18} />}
        footer={
          <>
            <Button
              variant="ghost"
              size="md"
              onClick={() => setIsExportModalOpen(false)}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              loading={isExporting}
              onClick={handleCustomExport}
            >
              Download CSV
            </Button>
          </>
        }
      >
        <div className="space-y-4 font-sans text-sm">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-2">
              Export Scope
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setExportType("specific")}
                className={`py-2 px-3 text-xs sm:text-sm rounded-lg border font-semibold transition-colors cursor-pointer ${
                  exportType === "specific"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900"
                    : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                Specific Day
              </button>
              <button
                type="button"
                onClick={() => setExportType("range")}
                className={`py-2 px-3 text-xs sm:text-sm rounded-lg border font-semibold transition-colors cursor-pointer ${
                  exportType === "range"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900"
                    : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                Date Range
              </button>
              <button
                type="button"
                onClick={() => setExportType("all")}
                className={`py-2 px-3 text-xs sm:text-sm rounded-lg border font-semibold transition-colors cursor-pointer ${
                  exportType === "all"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900"
                    : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                All Data
              </button>
            </div>
          </div>

          {exportType !== "all" && (
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                {exportType === "specific" ? "Target Date" : "Start Date"}
              </label>
              <input
                type="date"
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 font-mono outline-none"
                value={exportStartDate}
                onChange={(e) => setExportStartDate(e.target.value)}
              />
            </div>
          )}

          {exportType === "range" && (
            <div>
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                End Date
              </label>
              <input
                type="date"
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 font-mono outline-none"
                value={exportEndDate}
                onChange={(e) => setExportEndDate(e.target.value)}
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
