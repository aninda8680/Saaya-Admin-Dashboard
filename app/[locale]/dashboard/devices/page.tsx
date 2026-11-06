"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import {
  Smartphone,
  ChevronRight,
  HelpCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/routing";
import { Badge } from "@/components/ui/Badge";
import { CopyButton } from "@/components/ui/CopyButton";
import { SearchInput } from "@/components/ui/Input";
import { TableSkeleton } from "@/components/ui/Skeleton";

type Device = {
  id: string;
  status: string;
  firmwareVersion: string;
  owner?: string;
  ownerName?: string;
  lastSeen?: any;
};

export default function DevicesPage() {
  const t = useTranslations("Devices");
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline" | "unassigned">("all");

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const snapshot = await getDocs(collection(db, "devices"));
      const devicesData = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Device[];

      const deviceIdsInDb = new Set(devicesData.map((d) => String(d.id).trim()));

      const customersSnap = await getDocs(collection(db, "customers"));
      const deviceToOwnerMap: Record<string, { id: string; name: string }> = {};

      customersSnap.docs.forEach((d) => {
        const customerId = d.id;
        const customerData = d.data();
        const fullName =
          `${customerData.firstName || ""} ${customerData.lastName || ""}`.trim() ||
          customerData.name ||
          "Customer";

        if (customerData.devices && Array.isArray(customerData.devices)) {
          customerData.devices.forEach((deviceItem: any) => {
            let deviceIdStr = "";
            if (typeof deviceItem === "object" && deviceItem !== null) {
              if (deviceItem.deviceId) {
                deviceIdStr = String(deviceItem.deviceId);
              } else if (deviceItem.id) {
                deviceIdStr = String(deviceItem.id);
              } else {
                deviceIdStr = String(deviceItem);
              }
            } else {
              deviceIdStr = String(deviceItem);
            }

            deviceIdStr = deviceIdStr.trim();

            if (deviceIdStr && deviceIdStr !== "[object Object]") {
              deviceToOwnerMap[deviceIdStr] = { id: customerId, name: fullName };

              if (!deviceIdsInDb.has(deviceIdStr)) {
                devicesData.push({
                  id: deviceIdStr,
                  status: "unknown",
                  firmwareVersion: "unknown",
                });
                deviceIdsInDb.add(deviceIdStr);
              }
            }
          });
        }
      });

      await Promise.all(
        devicesData.map(async (device) => {
          if (deviceToOwnerMap[device.id]) {
            device.owner = deviceToOwnerMap[device.id].id;
            device.ownerName = deviceToOwnerMap[device.id].name;
          }

          try {
            const statusSnap = await getDoc(
              doc(db, "devices", device.id, "status", "current")
            );
            if (statusSnap.exists()) {
              const statusData = statusSnap.data();
              device.lastSeen =
                statusData.lastOnlineAt || statusData.updatedAt || device.lastSeen;
            } else {
              const liveSnap = await getDoc(
                doc(db, "devices", device.id, "live", "latest")
              );
              if (liveSnap.exists()) {
                const liveData = liveSnap.data();
                device.lastSeen = liveData.updatedAt || device.lastSeen;
              }
            }
          } catch (e) {
            console.warn("Failed to fetch last seen for device", device.id, e);
          }
        })
      );

      devicesData.sort((a, b) => a.id.localeCompare(b.id));
      setDevices(devicesData);
    } catch (error) {
      console.error("Error fetching devices:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "—";
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return String(timestamp);
  };

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        d.id.toLowerCase().includes(query) ||
        (d.ownerName && d.ownerName.toLowerCase().includes(query)) ||
        (d.owner && d.owner.toLowerCase().includes(query));

      if (!matchesSearch) return false;

      const st = (d.status || "offline").toLowerCase();
      if (statusFilter === "all") return true;
      if (statusFilter === "online") return st === "online";
      if (statusFilter === "offline") return st === "offline" || st === "unknown" || st === "standby";
      if (statusFilter === "unassigned") return !d.owner;

      return true;
    });
  }, [devices, searchQuery, statusFilter]);

  const counts = useMemo(() => {
    return {
      all: devices.length,
      online: devices.filter((d) => (d.status || "").toLowerCase() === "online").length,
      offline: devices.filter((d) => {
        const s = (d.status || "").toLowerCase();
        return s === "offline" || s === "unknown" || s === "standby";
      }).length,
      unassigned: devices.filter((d) => !d.owner).length,
    };
  }, [devices]);

  return (
    <div className="p-5 sm:p-8 lg:p-10 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-150">
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
      </div>

      {/* Control Bar: Search & Filter Chips */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="w-full sm:w-96">
          <SearchInput
            placeholder={t("searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery("")}
            className="text-sm py-2"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
              statusFilter === "all"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <span>{t("filterAll")}</span>
            <span className="font-mono text-xs opacity-75">{counts.all}</span>
          </button>

          <button
            onClick={() => setStatusFilter("online")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
              statusFilter === "online"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>{t("filterOnline")}</span>
            <span className="font-mono text-xs opacity-75">{counts.online}</span>
          </button>

          <button
            onClick={() => setStatusFilter("offline")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
              statusFilter === "offline"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <span>{t("filterOffline")}</span>
            <span className="font-mono text-xs opacity-75">{counts.offline}</span>
          </button>

          <button
            onClick={() => setStatusFilter("unassigned")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
              statusFilter === "unassigned"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <span>{t("filterUnassigned")}</span>
            <span className="font-mono text-xs opacity-75">{counts.unassigned}</span>
          </button>
        </div>
      </div>

      {/* Table Container - Responsive: Card View on Mobile, Full Table on Desktop */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-subtle">
        {loading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : (
          <>
            {/* Mobile Card View (Phone Screens: < 640px) */}
            <div className="block sm:hidden divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {filteredDevices.map((device) => {
                const st = (device.status || "offline").toLowerCase();
                const badgeVariant: "online" | "offline" = st === "online" ? "online" : "offline";

                return (
                  <div key={device.id} className="p-4 space-y-3">
                    {/* Header: ID + Status Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Link
                          href={`/dashboard/devices/${device.id}`}
                          className="font-mono font-bold text-base text-zinc-900 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400 truncate"
                        >
                          {device.id}
                        </Link>
                        <CopyButton value={device.id} label="Device ID" />
                      </div>
                      <Badge variant={badgeVariant} dot>
                        {st.toUpperCase()}
                      </Badge>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-50 dark:bg-zinc-800/40 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800">
                      <div>
                        <span className="text-zinc-400 font-sans block text-[11px] uppercase tracking-wider mb-0.5">
                          {t("colOwner")}
                        </span>
                        {device.owner ? (
                          <Link
                            href={`/dashboard/users?id=${device.owner}`}
                            className="font-medium text-zinc-800 dark:text-zinc-200 hover:text-emerald-600 dark:hover:text-emerald-400 truncate block font-sans"
                            title={`UID: ${device.owner}`}
                          >
                            {device.ownerName || "Customer"}
                          </Link>
                        ) : (
                          <span className="text-zinc-400 italic font-sans">{t("unassigned")}</span>
                        )}
                      </div>

                      <div>
                        <span className="text-zinc-400 font-sans block text-[11px] uppercase tracking-wider mb-0.5">
                          {t("colLastSeen")}
                        </span>
                        <span className="font-mono text-zinc-600 dark:text-zinc-400 text-xs block">
                          {formatDate(device.lastSeen)}
                        </span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <Link
                      href={`/dashboard/devices/${device.id}`}
                      className="w-full py-2.5 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 text-zinc-900 dark:text-zinc-100 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <span>{t("viewTelemetry")}</span>
                      <ChevronRight size={14} />
                    </Link>
                  </div>
                );
              })}

              {filteredDevices.length === 0 && (
                <div className="py-12 text-center text-zinc-400 font-sans">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <HelpCircle size={24} className="opacity-40" />
                    <span className="text-sm font-medium">{t("noDevices")}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Table View (>= 640px) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-900/50 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">{t("colId")}</th>
                    <th className="py-3.5 px-4">{t("colStatus")}</th>
                    <th className="py-3.5 px-4">{t("colOwner")}</th>
                    <th className="py-3.5 px-4">{t("colLastSeen")}</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono">
                  {filteredDevices.map((device) => {
                    const st = (device.status || "offline").toLowerCase();
                    const badgeVariant: "online" | "offline" = st === "online" ? "online" : "offline";

                    return (
                      <tr
                        key={device.id}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                      >
                        {/* ID */}
                        <td className="py-3.5 px-4 font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/dashboard/devices/${device.id}`}
                              className="hover:underline hover:text-emerald-600 dark:hover:text-emerald-400"
                              title={`Inspect ${device.id}`}
                            >
                              {device.id}
                            </Link>
                            <CopyButton value={device.id} label="Device ID" />
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 font-sans">
                          <Badge variant={badgeVariant} dot>
                            {st.toUpperCase()}
                          </Badge>
                        </td>

                        {/* Owner */}
                        <td className="py-3.5 px-4 font-sans text-sm text-zinc-700 dark:text-zinc-300">
                          {device.owner ? (
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/dashboard/users?id=${device.owner}`}
                                className="font-medium hover:underline hover:text-emerald-600 dark:hover:text-emerald-400"
                                title={`UID: ${device.owner}`}
                              >
                                {device.ownerName || "Customer"}
                              </Link>
                              <CopyButton value={device.owner} label="Owner UID" />
                            </div>
                          ) : (
                            <span className="text-zinc-400 italic">
                              {t("unassigned")}
                            </span>
                          )}
                        </td>

                        {/* Last Seen */}
                        <td className="py-3.5 px-4 text-zinc-500 text-xs">
                          {formatDate(device.lastSeen)}
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-right font-sans">
                          <Link
                            href={`/dashboard/devices/${device.id}`}
                            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                          >
                            <span>{t("viewTelemetry")}</span>
                            <ChevronRight size={14} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredDevices.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-zinc-400 font-sans">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <HelpCircle size={24} className="opacity-40" />
                          <span className="text-sm font-medium">{t("noDevices")}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="text-xs sm:text-sm text-zinc-500 px-1 font-mono">
        Showing {filteredDevices.length} of {devices.length} devices
      </div>
    </div>
  );
}
