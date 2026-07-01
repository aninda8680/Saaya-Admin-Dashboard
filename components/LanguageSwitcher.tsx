"use client";

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/src/i18n/routing';

export default function LanguageSwitcher({ className = "absolute top-4 right-4 z-50" }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLocale = e.target.value;
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <div className={className}>
      <select
        value={locale}
        onChange={handleLanguageChange}
        className="bg-slate-800 border border-slate-600 text-slate-200 rounded-md px-3 py-1.5 text-sm outline-none focus:border-blue-500 transition-colors shadow-sm cursor-pointer"
      >
        <option value="en">English</option>
        <option value="bn">বাংলা (Bengali)</option>
      </select>
    </div>
  );
}
