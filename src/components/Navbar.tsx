"use client";

import { signOut } from "firebase/auth";
import { auth } from "@/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const { user } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/admin/login");
  };

  return (
    <nav className="bg-white shadow-sm border-b px-6 py-4 flex justify-between items-center">
      <h1 className="text-xl font-semibold">Admin Panel</h1>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">{user?.email}</span>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
