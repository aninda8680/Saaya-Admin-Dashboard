"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import styles from "../../premium.module.css";
import { Users as UsersIcon, Copy } from "lucide-react";

import Link from "next/link";

type Customer = {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  status: string;
  createdAt?: any;
  devices?: any[];
};

export default function UsersPage() {
  const [users, setUsers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, "customers"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleDateString();
    }
    return "Invalid Date";
  };

  return (
    <div className={styles.dashboardContent}>
      <div className={styles.pageHeader}>
        <div className="flex items-center gap-3">
          <div className={`${styles.statIconWrapper} ${styles.blue} mb-2`}>
            <UsersIcon size={24} />
          </div>
          <h2 className={styles.pageTitle}>Users Management</h2>
        </div>
        <p className={styles.pageSubtitle}>View and manage registered customers.</p>
      </div>

      <div className={styles.dataTableContainer}>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading users...</div>
        ) : (
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Customer UID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Linked Devices</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <span title={user.id} className="text-[#2ECC71]">
                        {user.id.substring(0, 4)}......
                      </span>
                      <button 
                        onClick={() => navigator.clipboard.writeText(user.id)}
                        className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-[#0FA56F] transition-colors"
                        title="Copy Full UID"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </td>
                  <td className="font-medium">
                    {user.firstName || user.lastName 
                      ? `${user.firstName || ''} ${user.lastName || ''}`.trim() 
                      : user.name || 'Unknown'}
                  </td>
                  <td>{user.email}</td>
                  <td>
                    {user.devices && user.devices.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {user.devices.map((deviceItem, index) => {
                          // Handle both string arrays and arrays of objects like { deviceId: '...' }
                          const deviceIdString = typeof deviceItem === 'object' && deviceItem !== null 
                            ? (deviceItem as any).deviceId 
                            : String(deviceItem);
                            
                          if (!deviceIdString) return null;

                          return (
                            <Link key={`${deviceIdString}-${index}`} href={`/dashboard/devices/${deviceIdString}`}>
                              <span className={`${styles.badge} ${styles.badgeOnline} !text-[10px] !px-2 !py-0.5 hover:opacity-80 transition-opacity cursor-pointer`} title={`View Device ${deviceIdString}`}>
                                {deviceIdString}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">None</span>
                    )}
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
