"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import {
  Users as UsersIcon,
  Smartphone,
  X,
  Mail,
  HelpCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/routing";
import { useSearchParams } from "next/navigation";
import { CopyButton } from "@/components/ui/CopyButton";
import { SearchInput } from "@/components/ui/Input";
import { TableSkeleton } from "@/components/ui/Skeleton";

type Customer = {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  status: string;
  createdAt?: any;
  devices?: any[];
};

function UsersContent() {
  const t = useTranslations("Users");
  const searchParams = useSearchParams();
  const initialIdQuery = searchParams.get("id") || "";

  const [users, setUsers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialIdQuery);
  const [deviceFilter, setDeviceFilter] = useState<"all" | "hasDevices" | "noDevices">("all");

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (initialIdQuery) {
      setSearchQuery(initialIdQuery);
    }
  }, [initialIdQuery]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "customers"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Customer[];

      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
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
      });
    }
    return String(timestamp);
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const q = searchQuery.toLowerCase().trim();
      const fullName = (
        user.firstName || user.lastName
          ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
          : user.name || ""
      ).toLowerCase();
      const email = (user.email || "").toLowerCase();
      const uid = user.id.toLowerCase();

      const matchesSearch =
        !q || fullName.includes(q) || email.includes(q) || uid.includes(q);

      if (!matchesSearch) return false;

      const deviceCount = user.devices?.length || 0;
      if (deviceFilter === "hasDevices") return deviceCount > 0;
      if (deviceFilter === "noDevices") return deviceCount === 0;

      return true;
    });
  }, [users, searchQuery, deviceFilter]);

  const counts = useMemo(() => {
    return {
      all: users.length,
      hasDevices: users.filter((u) => u.devices && u.devices.length > 0).length,
      noDevices: users.filter((u) => !u.devices || u.devices.length === 0).length,
    };
  }, [users]);

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

      {/* Deep Link Active Filter Alert */}
      {initialIdQuery && searchQuery === initialIdQuery && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-sm">
          <div className="flex items-center gap-2">
            <span>Filtered by Customer UID:</span>
            <code className="bg-white dark:bg-zinc-900 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 font-mono font-bold">
              {initialIdQuery}
            </code>
          </div>
          <button
            onClick={() => setSearchQuery("")}
            className="flex items-center gap-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 text-xs font-semibold cursor-pointer"
          >
            <span>Show all customers</span>
            <X size={14} />
          </button>
        </div>
      )}

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
            onClick={() => setDeviceFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
              deviceFilter === "all"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <span>{t("filterAll")}</span>
            <span className="font-mono text-xs opacity-75">{counts.all}</span>
          </button>

          <button
            onClick={() => setDeviceFilter("hasDevices")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
              deviceFilter === "hasDevices"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <span>{t("filterWithDevices")}</span>
            <span className="font-mono text-xs opacity-75">{counts.hasDevices}</span>
          </button>

          <button
            onClick={() => setDeviceFilter("noDevices")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
              deviceFilter === "noDevices"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <span>{t("filterNoDevices")}</span>
            <span className="font-mono text-xs opacity-75">{counts.noDevices}</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      {/* Table Container - Responsive: Card View on Mobile, Full Table on Desktop */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-subtle">
        {loading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : (
          <>
            {/* Mobile Card View (Phone Screens: < 640px) */}
            <div className="block sm:hidden divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {filteredUsers.map((user) => {
                const fullName =
                  user.firstName || user.lastName
                    ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                    : user.name || "Customer";
                const isHighlighted = initialIdQuery && user.id === initialIdQuery;

                return (
                  <div
                    key={user.id}
                    className={`p-4 space-y-3 ${
                      isHighlighted ? "bg-zinc-100/70 dark:bg-zinc-800/50" : ""
                    }`}
                  >
                    {/* Header: Name + UID */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-semibold text-base text-zinc-900 dark:text-zinc-100 block truncate">
                          {fullName}
                        </span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300"
                            title={user.id}
                          >
                            {user.id.length > 8 ? `${user.id.substring(0, 6)}…` : user.id}
                          </span>
                          <CopyButton value={user.id} label="UID" size={13} />
                        </div>
                      </div>
                      <span className="text-zinc-400 font-mono text-xs shrink-0">
                        {formatDate(user.createdAt)}
                      </span>
                    </div>

                    {/* Email */}
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
                      <Mail size={14} className="text-zinc-400 shrink-0" />
                      <span className="truncate">{user.email || "—"}</span>
                    </div>

                    {/* Linked Devices */}
                    <div className="pt-1">
                      <span className="text-[11px] font-sans font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">
                        {t("colDevices")} ({user.devices?.length || 0})
                      </span>
                      {user.devices && user.devices.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {user.devices.map((deviceItem, index) => {
                            const devIdStr =
                              typeof deviceItem === "object" && deviceItem !== null
                                ? (deviceItem as any).deviceId || (deviceItem as any).id
                                : String(deviceItem);

                            if (!devIdStr) return null;

                            return (
                              <Link
                                key={`${devIdStr}-${index}`}
                                href={`/dashboard/devices/${devIdStr}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors border border-zinc-200/60 dark:border-zinc-700/60"
                                title={`Inspect probe ${devIdStr}`}
                              >
                                <Smartphone size={12} className="text-emerald-500" />
                                <span>{devIdStr}</span>
                              </Link>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="font-sans text-zinc-400 italic text-xs">
                          {t("noDevices")}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredUsers.length === 0 && (
                <div className="py-12 text-center text-zinc-400 font-sans">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <UsersIcon size={24} className="opacity-40" />
                    <span className="text-sm font-medium">{t("noUsers")}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Table View (>= 640px) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-900/50 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">{t("colUid")}</th>
                    <th className="py-3.5 px-4">{t("colName")}</th>
                    <th className="py-3.5 px-4">{t("colEmail")}</th>
                    <th className="py-3.5 px-4">{t("colDevices")}</th>
                    <th className="py-3.5 px-4">{t("colJoined")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono">
                  {filteredUsers.map((user) => {
                    const fullName =
                      user.firstName || user.lastName
                        ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                        : user.name || "Customer";
                    const isHighlighted = initialIdQuery && user.id === initialIdQuery;

                    return (
                      <tr
                        key={user.id}
                        className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors ${
                          isHighlighted ? "bg-zinc-100/70 dark:bg-zinc-800/50" : ""
                        }`}
                      >
                        {/* UID */}
                        <td className="py-3.5 px-4 text-zinc-700 dark:text-zinc-300">
                          <div className="flex items-center gap-2">
                            <span
                              className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-xs font-semibold"
                              title={user.id}
                            >
                              {user.id.length > 8 ? `${user.id.substring(0, 6)}…` : user.id}
                            </span>
                            <CopyButton value={user.id} label="UID" size={14} />
                          </div>
                        </td>

                        {/* Name */}
                        <td className="py-3.5 px-4 font-sans font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                          {fullName}
                        </td>

                        {/* Email */}
                        <td className="py-3.5 px-4 font-sans text-zinc-600 dark:text-zinc-400 text-sm">
                          <div className="flex items-center gap-2">
                            <Mail size={14} className="text-zinc-400 shrink-0" />
                            <span>{user.email || "—"}</span>
                          </div>
                        </td>

                        {/* Linked Devices */}
                        <td className="py-3.5 px-4">
                          {user.devices && user.devices.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 max-w-sm">
                              {user.devices.map((deviceItem, index) => {
                                const devIdStr =
                                  typeof deviceItem === "object" && deviceItem !== null
                                    ? (deviceItem as any).deviceId || (deviceItem as any).id
                                    : String(deviceItem);

                                if (!devIdStr) return null;

                                return (
                                  <Link
                                    key={`${devIdStr}-${index}`}
                                    href={`/dashboard/devices/${devIdStr}`}
                                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                    title={`Inspect probe ${devIdStr}`}
                                  >
                                    <Smartphone size={12} />
                                    <span>{devIdStr}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="font-sans text-zinc-400 italic text-sm">
                              {t("noDevices")}
                            </span>
                          )}
                        </td>

                        {/* Joined Date */}
                        <td className="py-3.5 px-4 text-zinc-500 text-xs">
                          {formatDate(user.createdAt)}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-zinc-400 font-sans">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <UsersIcon size={24} className="opacity-40" />
                          <span className="text-sm font-medium">{t("noUsers")}</span>
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
        Showing {filteredUsers.length} of {users.length} customers
      </div>
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={6} cols={5} />}>
      <UsersContent />
    </Suspense>
  );
}
