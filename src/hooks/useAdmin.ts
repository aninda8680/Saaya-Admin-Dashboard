import { useEffect, useState } from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import { checkAdmin } from "@/src/lib/checkAdmin";

export function useAdmin() {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function verify() {
      if (!user) {
        setIsAdmin(false);
        setChecking(false);
        return;
      }
      const admin = await checkAdmin(user.uid);
      setIsAdmin(admin);
      setChecking(false);
    }
    if (!loading) verify();
  }, [user, loading]);

  return { isAdmin, checking };
}
