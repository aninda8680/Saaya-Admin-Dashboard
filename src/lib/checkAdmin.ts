import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/client";

export async function checkAdmin(uid: string) {
  const ref = doc(db, "admins", uid);
  const snapshot = await getDoc(ref);
  return snapshot.exists();
}
