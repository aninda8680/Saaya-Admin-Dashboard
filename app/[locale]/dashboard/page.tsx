"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import {
  Smartphone,
  Users,
  Radio,
  ArrowRight,
  AlertTriangle,
  ChevronRight,
  FileSpreadsheet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/routing";
import { Badge } from "@/components/ui/Badge";
import { CopyButton } from "@/components/ui/CopyButton";
import {
  MetricSkeleton,
  TableSkeleton,
  AlertSkeleton,
  Skeleton,
} from "@/components/ui/Skeleton";

interface DeviceSummary {
  id: string;
  status: string;
  battery?: number;
  ownerName?: string;
  lastSeen?: any;
}

export default function DashboardPage() {
  const t = useTranslations("Dashboard");
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [totalDevices, setTotalDevices] = useState<number>(0);
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [offlineCount, setOfflineCount] = useState<number>(0);
  const [recentDevices, setRecentDevices] = useState<DeviceSummary[]>([]);
  const [alertDevices, setAlertDevices] = useState<DeviceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardMetrics();
  }, []);

  const fetchDashboardMetrics = async () => {
    setLoading(true);
    try {
      // 1. Fetch customers
      const customersSnap = await getDocs(collection(db, "customers"));
      setTotalUsers(customersSnap.size);

      const deviceToOwnerMap: Record<string, string> = {};
      customersSnap.docs.forEach((doc) => {
        const data = doc.data();
        const fullName =
          `${data.firstName || ""} ${data.lastName || ""}`.trim() ||
          data.name ||
          "Customer";
        if (Array.isArray(data.devices)) {
          data.devices.forEach((item: any) => {
            const devId =
              typeof item === "object" && item !== null
                ? item.deviceId || item.id || String(item)
                : String(item);
            if (devId && devId.trim()) {
              deviceToOwnerMap[devId.trim()] = fullName;
            }
          });
        }
      });

      // 2. Fetch devices
      const devicesSnap = await getDocs(collection(db, "devices"));
      const devicesList: DeviceSummary[] = [];
      let online = 0;
      let offline = 0;

      devicesSnap.docs.forEach((d) => {
        const devData = d.data();
        const rawStatus = (devData.status || "offline").toLowerCase();
        // Devices are either online or offline
        const status = rawStatus === "online" ? "online" : "offline";
        const devItem: DeviceSummary = {
          id: d.id,
          status,
          battery: devData.battery,
          ownerName: deviceToOwnerMap[d.id] || devData.ownerName || "Unassigned",
          lastSeen: devData.lastSeen || devData.updatedAt || devData.createdAt,
        };

        if (status === "online") online++;
        else offline++;

        devicesList.push(devItem);
      });

      setTotalDevices(devicesList.length);
      setOnlineCount(online);
      setOfflineCount(offline);

      setRecentDevices(devicesList.slice(0, 6));

      // Attention devices
      const alerts = devicesList.filter(
        (d) => d.status === "offline" || (d.battery !== undefined && d.battery < 20)
      );
      setAlertDevices(alerts.slice(0, 5));
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const healthRate =
    totalDevices > 0
      ? Math.round((onlineCount / totalDevices) * 100)
      : 100;

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "—";
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return String(timestamp);
  };

  return (
    <div className="p-5 sm:p-8 lg:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t("title")}
          </h1>
          <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 mt-1">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/devices"
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 transition-colors shadow-xs"
          >
            {t("viewDevices")}
          </Link>
          <Link
            href="/dashboard/users"
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 transition-colors shadow-xs"
          >
            {t("manageUsers")}
          </Link>
        </div>
      </div>

      {/* Top Telemetry KPI Bar - Legible, Big Numbers (4 KPIs) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </>
        ) : (
          <>
            {/* Total Probes */}
            <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-subtle">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
                {t("totalDevices")}
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100 tabular-nums">
                  {totalDevices}
                </span>
                <span className="text-xs text-zinc-400">deployed</span>
              </div>
            </div>

            {/* Online Probes */}
            <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-subtle">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
                  {t("activeOnline")}
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {onlineCount}
                </span>
                <span className="text-xs text-emerald-600/80 font-medium">streaming</span>
              </div>
            </div>

            {/* Offline Probes */}
            <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-subtle">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
                {t("offlineDevices")}
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-bold font-mono tracking-tight text-zinc-500 dark:text-zinc-400 tabular-nums">
                  {offlineCount}
                </span>
                <span className="text-xs text-zinc-400">offline</span>
              </div>
            </div>

            {/* Total Customers */}
            <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-subtle">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
                {t("totalUsers")}
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100 tabular-nums">
                  {totalUsers}
                </span>
                <span className="text-xs text-zinc-400">clients</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Fleet Distribution Line */}
      <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-subtle space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            {t("fleetDistribution")}
          </span>
          {loading ? (
            <Skeleton className="h-4 w-32" />
          ) : (
            <span className="font-mono text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {healthRate}% Connectivity Score
            </span>
          )}
        </div>

        <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden flex">
          {loading ? (
            <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-full animate-pulse" />
          ) : totalDevices > 0 ? (
            <>
              <div
                style={{ width: `${(onlineCount / totalDevices) * 100}%` }}
                className="bg-emerald-500 h-full transition-all"
                title={`Online: ${onlineCount}`}
              />
              <div
                style={{ width: `${(offlineCount / totalDevices) * 100}%` }}
                className="bg-zinc-300 dark:bg-zinc-700 h-full transition-all"
                title={`Offline: ${offlineCount}`}
              />
            </>
          ) : (
            <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-full" />
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-5 pt-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
        ) : (
          <div className="flex items-center gap-5 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 font-mono pt-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              Online ({onlineCount})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-400 inline-block" />
              Offline ({offlineCount})
            </span>
          </div>
        )}
      </div>

      {/* Main Grid: Active Probes Table & Fleet Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Probes Table */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-subtle overflow-hidden">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
              {t("recentActivity")}
            </h2>
            <Link
              href="/dashboard/devices"
              className="text-xs sm:text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1 font-medium transition-colors"
            >
              <span>View all devices</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          {loading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : (
            <>
              {/* Mobile Card View (Phone: < 640px) */}
              <div className="block sm:hidden divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {recentDevices.length > 0 ? (
                  recentDevices.map((d) => (
                    <div key={d.id} className="p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/dashboard/devices/${d.id}`}
                          className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400"
                        >
                          {d.id}
                        </Link>
                        <Badge variant={d.status === "online" ? "online" : "offline"} dot>
                          {d.status.toUpperCase()}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-xs text-zinc-500 font-sans">
                        <span className="text-zinc-700 dark:text-zinc-300 font-medium truncate max-w-[180px]">
                          {d.ownerName}
                        </span>
                        <span className="font-mono text-zinc-400">
                          {formatDate(d.lastSeen)}
                        </span>
                      </div>

                      <Link
                        href={`/dashboard/devices/${d.id}`}
                        className="w-full py-2 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <span>Inspect</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-zinc-400 font-sans text-sm">
                    {t("noActivity")}
                  </div>
                )}
              </div>

              {/* Desktop Table View (>= 640px) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse min-w-[500px]">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 uppercase tracking-wider bg-zinc-50/75 dark:bg-zinc-900/50">
                      <th className="py-3 px-4">Device ID</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Owner</th>
                      <th className="py-3 px-4">Last Connection</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono">
                    {recentDevices.length > 0 ? (
                      recentDevices.map((d) => (
                        <tr
                          key={d.id}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                            <Link
                              href={`/dashboard/devices/${d.id}`}
                              className="hover:underline hover:text-emerald-600 dark:hover:text-emerald-400"
                            >
                              {d.id}
                            </Link>
                          </td>
                          <td className="py-3 px-4 font-sans">
                            <Badge
                              variant={d.status === "online" ? "online" : "offline"}
                              dot
                            >
                              {d.status.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 font-sans text-sm text-zinc-700 dark:text-zinc-300 truncate max-w-[150px]">
                            {d.ownerName}
                          </td>
                          <td className="py-3 px-4 text-zinc-500 text-xs">
                            {formatDate(d.lastSeen)}
                          </td>
                          <td className="py-3 px-4 text-right font-sans">
                            <Link
                              href={`/dashboard/devices/${d.id}`}
                              className="text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1"
                            >
                              <span>Inspect</span>
                              <ArrowRight size={13} />
                            </Link>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-zinc-400 font-sans text-sm">
                          {t("noActivity")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Right Col: Attention Required & Telemetry Summary */}
        <div className="space-y-5">
          {/* Alerts Card */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-subtle space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle size={15} className="text-amber-500" />
                <span>{t("attentionRequired")}</span>
              </h3>
              <span className="text-xs font-mono font-medium text-zinc-400">
                {loading ? "..." : `${alertDevices.length} flagged`}
              </span>
            </div>

            <div className="space-y-2.5">
              {loading ? (
                <AlertSkeleton />
              ) : alertDevices.length > 0 ? (
                alertDevices.map((d) => (
                  <Link
                    key={`alert-${d.id}`}
                    href={`/dashboard/devices/${d.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        {d.id}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-semibold uppercase px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {d.status === "offline" ? "No Signal" : "Low Batt"}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-zinc-500 py-3 text-center">
                  {t("allHealthy")}
                </p>
              )}
            </div>
          </div>

          {/* Quick Fleet Export Card */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-subtle space-y-2.5">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
              Fleet Data Export
            </span>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Generate and download comprehensive device telemetry logs and daily soil sensor summaries.
            </p>
            <div className="pt-2">
              <Link
                href="/dashboard/devices"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 transition-colors"
              >
                <FileSpreadsheet size={15} />
                <span>Go to Fleet Export</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
