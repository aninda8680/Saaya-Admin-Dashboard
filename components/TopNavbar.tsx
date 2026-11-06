"use client";

import { usePathname } from "@/src/i18n/routing";
import { Link } from "@/src/i18n/routing";
import { Sun, Moon, ChevronRight, Menu } from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";
import { useTranslations } from "next-intl";

interface TopNavbarProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenMobileSidebar: () => void;
  userEmail?: string;
}

export default function TopNavbar({
  theme,
  onToggleTheme,
  onOpenMobileSidebar,
  userEmail,
}: TopNavbarProps) {
  const pathname = usePathname();
  const tNav = useTranslations("Navbar");
  const tSide = useTranslations("Sidebar");

  const segments = pathname.split("/").filter(Boolean);

  const getBreadcrumbLabel = (seg: string, idx: number) => {
    if (seg === "dashboard" && idx === 0) return tSide("dashboard");
    if (seg === "devices") return tSide("devices");
    if (seg === "users") return tSide("users");
    if (seg === "settings") return tSide("settings");
    return seg;
  };

  return (
    <header className="h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8 transition-colors">
      {/* Left: Hamburger & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="md:hidden p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label={tNav("menu")}
        >
          <Menu size={18} />
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm font-medium">
          <Link
            href="/dashboard"
            className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            Saaya
          </Link>
          {segments.length > 0 && <ChevronRight size={14} className="text-zinc-300 dark:text-zinc-600" />}

          {segments.map((seg, idx) => {
            const isLast = idx === segments.length - 1;
            const pathUrl = `/${segments.slice(0, idx + 1).join("/")}`;
            const label = getBreadcrumbLabel(seg, idx);

            return (
              <div key={pathUrl} className="flex items-center gap-2">
                {isLast ? (
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {label}
                  </span>
                ) : (
                  <>
                    <Link
                      href={pathUrl as any}
                      className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                    >
                      {label}
                    </Link>
                    <ChevronRight size={14} className="text-zinc-300 dark:text-zinc-600" />
                  </>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Right: Language, Theme, User */}
      <div className="flex items-center gap-2.5">
        <LanguageSwitcher compact />

        <button
          onClick={onToggleTheme}
          className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title={theme === "light" ? tNav("themeDark") : tNav("themeLight")}
          aria-label="Toggle theme"
        >
          {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center text-xs font-bold font-mono ml-1">
          {userEmail ? userEmail.charAt(0).toUpperCase() : "A"}
        </div>
      </div>
    </header>
  );
}
