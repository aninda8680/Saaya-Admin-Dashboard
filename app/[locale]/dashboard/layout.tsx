"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/src/i18n/routing";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import Sidebar from "@/components/Sidebar";
import TopNavbar from "@/components/TopNavbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push("/login");
      } else {
        setUserEmail(user.email || undefined);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initialTheme = prefersDark ? "dark" : "light";
      setTheme(initialTheme);
      document.documentElement.setAttribute("data-theme", initialTheme);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-center justify-center shadow-lg">
            <img
              src="/HV_logo_TM_nobg.png"
              alt="Harit Vikas Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Loading Saaya Dashboard...
            </span>
            <span className="text-xs text-slate-400">Verifying secure admin credentials</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Sidebar Navigation */}
      <Sidebar
        onLogout={handleLogout}
        userEmail={userEmail}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopNavbar
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          userEmail={userEmail}
        />

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
