"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import styles from "../../premium.module.css";
import { Smartphone, Copy } from "lucide-react";

import Link from "next/link";

type Device = {
  id: string;
  status: string;
  firmwareVersion: string;
  owner?: string;
  ownerName?: string;
  lastSeen?: any;
};

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      // 1. Fetch devices
      const snapshot = await getDocs(collection(db, "devices"));
      const devicesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Device[];
      
      // 2. Fetch customers to build device -> owner map
      const customersSnap = await getDocs(collection(db, "customers"));
      const deviceToOwnerMap: Record<string, { id: string, name: string }> = {};
      
      customersSnap.docs.forEach(doc => {
        const customerId = doc.id;
        const customerData = doc.data();
        const fullName = `${customerData.firstName || ''} ${customerData.lastName || ''}`.trim() || customerData.name || 'Unknown';
        
        if (customerData.devices && Array.isArray(customerData.devices)) {
          customerData.devices.forEach((deviceItem: any) => {
            const deviceIdStr = typeof deviceItem === 'object' && deviceItem !== null 
              ? deviceItem.deviceId 
              : String(deviceItem);
            if (deviceIdStr) {
              deviceToOwnerMap[deviceIdStr] = { id: customerId, name: fullName };
            }
          });
        }
      });

      // 3. Inject owner
      devicesData.forEach(device => {
        if (deviceToOwnerMap[device.id]) {
          device.owner = deviceToOwnerMap[device.id].id;
          device.ownerName = deviceToOwnerMap[device.id].name;
        }
      });
      
      // Sort by status or ID locally
      devicesData.sort((a, b) => a.id.localeCompare(b.id));
      
      setDevices(devicesData);
    } catch (error) {
      console.error("Error fetching devices:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    if (timestamp.toDate) {
      return timestamp.toDate().toLocaleString();
    }
    return "Unknown";
  };

  return (
    <div className={styles.dashboardContent}>
      <div className={styles.pageHeader}>
        <div className="flex items-center gap-3">
          <div className={`${styles.statIconWrapper} ${styles.purple} mb-2`}>
            <Smartphone size={24} />
          </div>
          <h2 className={styles.pageTitle}>Devices Management</h2>
        </div>
        <p className={styles.pageSubtitle}>Monitor and manage all connected IoT devices.</p>
      </div>

      <div className={styles.dataTableContainer}>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading devices...</div>
        ) : (
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Device ID</th>
                <th>Status</th>
                <th>Owner Name</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => {
                let badgeClass = styles.badgeOffline;
                if (device.status === 'online') badgeClass = styles.badgeOnline;
                else if (device.status === 'standby') badgeClass = styles.badgeActive; // using active color for standby
                
                return (
                  <tr key={device.id}>
                    <td className="font-mono text-sm font-semibold text-[#0FA56F]">
                      <Link href={`/dashboard/devices/${device.id}`} className="hover:text-[#0e9363] underline transition-colors" title={`View Device ${device.id}`}>
                        {device.id}
                      </Link>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${badgeClass}`}>
                        {device.status || 'unknown'}
                      </span>
                    </td>
                    <td className="font-medium text-gray-800">
                      {device.owner ? (
                        <div className="flex items-center gap-2">
                          <Link href={`/dashboard/users?id=${device.owner}`} className="text-[#0FA56F] hover:text-[#0e9363] underline transition-colors font-semibold" title={`UID: ${device.owner}`}>
                            {device.ownerName}
                          </Link>
                          <button 
                            onClick={() => navigator.clipboard.writeText(device.owner!)}
                            className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-[#0FA56F] transition-colors"
                            title="Copy Owner UID"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 font-normal">Unassigned</span>
                      )}
                    </td>
                    <td>{formatDate(device.lastSeen)}</td>
                  </tr>
                );
              })}
              {devices.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-500">No devices found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
