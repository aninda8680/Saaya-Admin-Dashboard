import { db } from "@/lib/firebase";
import { collection, query, orderBy, where, getDocs } from "firebase/firestore";

export const downloadCsv = (filename: string, csvContent: string) => {
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportCustomReadings = async (
  deviceId: string,
  exportType: "specific" | "range" | "all",
  exportStartDate: string,
  exportEndDate: string,
  callbacks: {
    onStart: () => void;
    onSuccess: () => void;
    onError: (err: any) => void;
    onEnd: () => void;
  }
) => {
  callbacks.onStart();
  try {
    let q;
    const ref = collection(db, "devices", deviceId, "readings");
    if (exportType === "all") {
      q = query(ref, orderBy("ts", "desc"));
    } else if (exportType === "specific" && exportStartDate) {
      const start = new Date(`${exportStartDate}T00:00:00`);
      const end = new Date(`${exportStartDate}T23:59:59.999`);
      q = query(ref, where("ts", ">=", start), where("ts", "<=", end), orderBy("ts", "desc"));
    } else if (exportType === "range" && exportStartDate && exportEndDate) {
      const start = new Date(`${exportStartDate}T00:00:00`);
      const end = new Date(`${exportEndDate}T23:59:59.999`);
      q = query(ref, where("ts", ">=", start), where("ts", "<=", end), orderBy("ts", "desc"));
    } else {
      alert("Please select valid dates.");
      callbacks.onEnd();
      return;
    }

    const snap = await getDocs(q);
    if (snap.empty) {
      alert("No readings found for the selected options.");
      callbacks.onEnd();
      return;
    }

    const rows = snap.docs.map(d => {
      const r = d.data();
      let dateStr = "—";
      let timeStr = "—";
      if (r.ts) {
        try {
          const dateObj = r.ts.toDate();
          dateStr = dateObj.toLocaleDateString();
          const h = String(dateObj.getHours()).padStart(2, '0');
          const m = String(dateObj.getMinutes()).padStart(2, '0');
          const s = String(dateObj.getSeconds()).padStart(2, '0');
          timeStr = `${h}:${m}:${s}`;
        } catch {
          dateStr = String(r.ts);
        }
      }
      return [
        `"${dateStr}"`,
        `"${timeStr}"`,
        r.temperature ?? "",
        r.moisture ?? "",
        r.ph ?? "",
        r.ec ?? "",
        r.n ?? "",
        r.p ?? "",
        r.k ?? "",
        r.battery ?? "",
        r.latitude ?? "",
        r.longitude ?? ""
      ].join(",");
    });

    const headers = ["Date", "Time", "Temperature (C)", "Moisture (%)", "pH", "EC", "N", "P", "K", "Battery (%)", "Latitude", "Longitude"].join(",");
    const csvContent = [headers, ...rows].join("\r\n");
    const filename = `readings_${deviceId}_${exportType}.csv`;
    downloadCsv(filename, csvContent);
    callbacks.onSuccess();
  } catch (err) {
    console.error(err);
    alert("Error exporting data.");
    callbacks.onError(err);
  } finally {
    callbacks.onEnd();
  }
};

export const exportDailySummariesCsv = (dailySums: any[], deviceId: string) => {
  if (!dailySums.length) return alert("No daily summaries to export.");
  const headers = ["Date", "Avg Temperature (C)", "Avg Moisture (%)", "Avg pH", "Avg EC", "Avg N", "Avg P", "Avg K", "Readings Count"];
  const rows = dailySums.map(ds => [
    ds.id,
    ds.avg?.temperature?.toFixed(2) ?? "",
    ds.avg?.moisture?.toFixed(2) ?? "",
    ds.avg?.ph?.toFixed(2) ?? "",
    ds.avg?.ec?.toFixed(2) ?? "",
    ds.avg?.n?.toFixed(0) ?? "",
    ds.avg?.p?.toFixed(0) ?? "",
    ds.avg?.k?.toFixed(0) ?? "",
    ds.count ?? ""
  ]);
  const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
  downloadCsv(`daily_summaries_${deviceId}.csv`, csvContent);
};
