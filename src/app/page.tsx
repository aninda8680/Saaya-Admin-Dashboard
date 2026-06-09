import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Saaya Dashboard</h1>
        <p className="text-gray-600 mb-6">Welcome to the Saaya Admin System</p>
        <Link
          href="/admin/login"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Go to Admin Login
        </Link>
      </div>
    </div>
  );
}
