"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { usePathname, useRouter } from "@/src/i18n/routing";
import {
  Settings as SettingsIcon,
  Moon,
  Sun,
  Globe,
  Server,
  Check,
} from "lucide-react";

export default function SettingsPage() {
  const t = useTranslations("Settings");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") {
      setTheme(saved);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
    }
  }, []);

  const changeTheme = (newTheme: "light" | "dark") => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const changeLanguage = (nextLocale: string) => {
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t("title")}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          {t("subtitle")}
        </p>
      </div>

      <div className="space-y-5">
        {/* Appearance Section */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-subtle space-y-4">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
            {t("appearance")}
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => changeTheme("light")}
              className={`p-3.5 rounded-lg border text-left flex items-center justify-between transition-colors cursor-pointer ${
                theme === "light"
                  ? "border-emerald-600 dark:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-100"
                  : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <Sun size={18} className="text-amber-500" />
                <span className="text-sm font-medium">{t("lightMode")}</span>
              </div>
              {theme === "light" && <Check size={16} className="text-emerald-600 dark:text-emerald-400" />}
            </button>

            <button
              onClick={() => changeTheme("dark")}
              className={`p-3.5 rounded-lg border text-left flex items-center justify-between transition-colors cursor-pointer ${
                theme === "dark"
                  ? "border-emerald-600 dark:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-100"
                  : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <Moon size={18} className="text-indigo-400" />
                <span className="text-sm font-medium">{t("darkMode")}</span>
              </div>
              {theme === "dark" && <Check size={16} className="text-emerald-600 dark:text-emerald-400" />}
            </button>
          </div>
        </div>

        {/* Language Selection */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-subtle space-y-4">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
            {t("language")}
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => changeLanguage("en")}
              className={`p-3.5 rounded-lg border text-left flex items-center justify-between transition-colors cursor-pointer ${
                locale === "en"
                  ? "border-emerald-600 dark:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-100"
                  : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <Globe size={18} className="text-emerald-500" />
                <span className="text-sm font-medium">English (Global)</span>
              </div>
              {locale === "en" && <Check size={16} className="text-emerald-600 dark:text-emerald-400" />}
            </button>

            <button
              onClick={() => changeLanguage("bn")}
              className={`p-3.5 rounded-lg border text-left flex items-center justify-between transition-colors cursor-pointer ${
                locale === "bn"
                  ? "border-emerald-600 dark:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-100"
                  : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <Globe size={18} className="text-emerald-500" />
                <span className="text-sm font-medium">বাংলা (Bengali)</span>
              </div>
              {locale === "bn" && <Check size={16} className="text-emerald-600 dark:text-emerald-400" />}
            </button>
          </div>
        </div>

        {/* Platform Info */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-subtle space-y-4">
          <div className="flex items-center gap-2">
            <Server size={18} className="text-zinc-500" />
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
              {t("platformInfo")}
            </span>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-sm">
            <div className="py-2.5 flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Platform</span>
              <span className="font-mono font-medium text-zinc-900 dark:text-zinc-200">Saaya Admin Console v2.0</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Database Engine</span>
              <span className="font-mono font-medium text-zinc-900 dark:text-zinc-200">Google Firestore + RTDB</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-zinc-500 dark:text-zinc-400">Developer</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-200">Harit Vikas Bio-Technologies</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
