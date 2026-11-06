"use client";

import { usePathname } from "@/src/i18n/routing";
import { Link } from "@/src/i18n/routing";
import {
  LayoutDashboard,
  Users,
  Smartphone,
  Settings,
  LogOut,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";

interface SidebarProps {
  onLogout: () => void;
  userEmail?: string;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({
  onLogout,
  userEmail,
  isMobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("Sidebar");

  const navItems = [
    { name: t("dashboard"), path: "/dashboard", icon: LayoutDashboard },
    { name: t("devices"), path: "/dashboard/devices", icon: Smartphone },
    { name: t("users"), path: "/dashboard/users", icon: Users },
    { name: t("settings"), path: "/dashboard/settings", icon: Settings },
  ];

  const content = (
    <div className="flex flex-col h-full justify-between p-4 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 transition-colors">
      <div>
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 py-3 mb-6">
          <Link href="/dashboard" className="flex items-center gap-3" onClick={onCloseMobile}>
            <img
              src="/HV_logo_TM_nobg.png"
              alt="Harit Vikas"
              className="w-9 h-9 object-contain"
            />
            <div className="flex flex-col leading-snug">
              <span className="font-bold text-base tracking-tight text-zinc-900 dark:text-zinc-100">
                Saaya
              </span>
              <span className="text-xs text-zinc-500 font-medium">
                Harit Vikas
              </span>
            </div>
          </Link>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.path ||
              (item.path !== "/dashboard" && pathname.startsWith(item.path));

            return (
              <Link
                key={item.path}
                href={item.path as any}
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-xs"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                }`}
              >
                <Icon
                  size={18}
                  className={
                    isActive
                      ? "text-zinc-900 dark:text-zinc-100"
                      : "text-zinc-400 dark:text-zinc-500"
                  }
                />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Footer Area */}
      <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5">
        <div className="px-2.5 py-2 flex flex-col">
          <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
            {userEmail || "admin@saaya.app"}
          </span>
          <span className="text-xs text-zinc-400 font-mono mt-0.5">Console Admin</span>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
        >
          <LogOut size={14} />
          <span>{t("logout")}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex w-60 flex-col shrink-0 h-screen sticky top-0 z-40">
        {content}
      </aside>

      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden bg-zinc-950/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={onCloseMobile}
        >
          <div
            className="w-68 max-w-[85vw] h-full shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {content}
          </div>
        </div>
      )}
    </>
  );
}
