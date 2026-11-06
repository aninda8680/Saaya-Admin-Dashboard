import AdminGuard from "@/src/components/AdminGuard";
import Sidebar from "@/src/components/Sidebar";
import Navbar from "@/src/components/Navbar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Navbar />
          <main className="flex-1 bg-gray-50">{children}</main>
        </div>
      </div>
    </AdminGuard>
  );
}
