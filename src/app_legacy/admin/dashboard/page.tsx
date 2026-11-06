export default function Dashboard() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Saaya Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm font-medium">Total Users</h3>
          <p className="text-3xl font-bold mt-2">-</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm font-medium">Total Devices</h3>
          <p className="text-3xl font-bold mt-2">-</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm font-medium">Active Today</h3>
          <p className="text-3xl font-bold mt-2">-</p>
        </div>
      </div>
    </div>
  );
}
