"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getCountFromServer } from "firebase/firestore";
import { Users, Smartphone } from "lucide-react";
import styles from "../premium.module.css";
import { logToServer } from "../actions";

export default function Dashboard() {
  const [totalUsers, setTotalUsers] = useState<number | "-">("-");
  const [totalDevices, setTotalDevices] = useState<number | "-">("-");
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    fetchDashboardDataStandard();
  }, []);

  const fetchDashboardDataStandard = async () => {
    setFetching(true);
    await logToServer("========================================");
    await logToServer("Started fetching dashboard data...");
    
    try {
      // Fetch Total Users
      const usersSnap = await getCountFromServer(collection(db, "customers"));
      setTotalUsers(usersSnap.data().count);
      await logToServer(`✅ Total Users fetched: ${usersSnap.data().count}`);

      // Fetch Total Devices (Standard collection query)
      const devicesSnap = await getCountFromServer(collection(db, "devices"));
      setTotalDevices(devicesSnap.data().count);
      await logToServer(`✅ Total Devices fetched: ${devicesSnap.data().count}`);
      
      await logToServer("========================================");
    } catch (error: any) {
      console.error("Error fetching dashboard data:", error);
      await logToServer(`❌ Error fetching data: ${error.message || error}`);
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className={styles.dashboardContent}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Dashboard Overview</h2>
        <p className={styles.pageSubtitle}>Monitor your system metrics and user activity.</p>
      </div>

      <div className={styles.statsGrid}>
        <div className={`${styles.glassPanel} ${styles.statCard}`}>
          <div className={styles.statHeader}>
            <span>Total Users</span>
            <div className={`${styles.statIconWrapper} ${styles.blue}`}>
              <Users size={20} />
            </div>
          </div>
          <p className={styles.statValue}>{totalUsers}</p>
        </div>
        
        <div className={`${styles.glassPanel} ${styles.statCard}`}>
          <div className={styles.statHeader}>
            <span>Total Devices</span>
            <div className={`${styles.statIconWrapper} ${styles.purple}`}>
              <Smartphone size={20} />
            </div>
          </div>
          <p className={styles.statValue}>{totalDevices}</p>
        </div>
      </div>
    </div>
  );
}
