"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/contexts/AuthContext";
import { checkAdmin } from "@/src/lib/checkAdmin";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    async function verify() {
      if (!user) {
        router.push("/admin/login");
        return;
      }
      const admin = await checkAdmin(user.uid);
      if (!admin) {
        router.push("/admin/login");
        return;
      }
      setAllowed(true);
    }
    if (!loading) verify();
  }, [user, loading, router]);

  if (!allowed) return <p>Loading...</p>;
  return <>{children}</>;
}
