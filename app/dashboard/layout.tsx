"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { LayoutDashboard, Users, Smartphone, LogOut, Sun, Moon } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import styles from "../premium.module.css";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push("/login");
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
      document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading) {
    return (
      <div className={styles.pageContainer} style={{ justifyContent: "center", alignItems: "center" }}>
        <div className="animate-pulse">
          <img src="/HV_logo_TM_nobg.png" alt="HV Logo" style={{ width: '140px', height: '140px', objectFit: 'contain' }} />
        </div>
      </div>
    );
  }

  const navItems = [
    { name: "Overview", path: "/dashboard", icon: LayoutDashboard },
    { name: "Users", path: "/dashboard/users", icon: Users },
    { name: "Devices", path: "/dashboard/devices", icon: Smartphone },
  ];

  return (
    <div className={styles.pageContainer}>
      <div className={styles.dashboardLayout}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarBrand}>
            <img src="/HV_logo_TM_nobg.png" alt="HV Logo" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
            <span>Saaya Dashboard</span>
          </div>

          <div className={styles.sidebarNav}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`${styles.sidebarNavItem} ${isActive ? styles.active : ""}`}
                >
                  <Icon size={20} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

          <div className={styles.sidebarFooter}>
            <div className={styles.sidebarUser}>
              <span className={styles.userEmail}>{auth.currentUser?.email || "admin@saaya.app"}</span>
            </div>
            <button onClick={handleLogout} className={styles.sidebarLogoutBtn}>
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className={`${styles.mainContentArea} relative`}>
          {mounted && (
            <button 
              onClick={toggleTheme}
              className="absolute top-8 right-8 p-2 rounded-full transition-colors z-50 hover:opacity-80"
              style={{ backgroundColor: "var(--border-color)", color: "var(--text-primary)" }}
              title="Toggle Theme"
            >
              {theme === "light" ? <Moon size={22} /> : <Sun size={22} />}
            </button>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
