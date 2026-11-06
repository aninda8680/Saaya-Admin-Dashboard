"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/src/i18n/routing";

export default function LanguageSwitcher({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLocale = e.target.value;
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <select
        value={locale}
        onChange={handleLanguageChange}
        aria-label="Select language"
        className="bg-transparent border border-zinc-200 dark:border-zinc-800 rounded-md text-zinc-600 dark:text-zinc-400 text-xs py-1 px-2 outline-none cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 font-mono transition-colors"
      >
        <option value="en" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
          EN
        </option>
        <option value="bn" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
          বাংলা
        </option>
      </select>
    </div>
  );
}
