"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { Lock, Mail, AlertCircle, ArrowRight } from "lucide-react";
import Image from "next/image";
import styles from "../app/premium.module.css";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setError("");
    
    // Client-side validation
    if (!email.trim() && !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    if (!email.trim()) {
      setError("Email address cannot be empty.");
      return;
    }
    if (!password.trim()) {
      setError("Password cannot be empty.");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log("UID:", auth.currentUser?.uid);
      router.push("/dashboard");
    } catch (err: any) {
      console.log(err);
      
      // Parse Firebase errors
      const code = err.code;
      if (code === "auth/user-not-found") {
        setError("No user found with this email address.");
      } else if (code === "auth/wrong-password") {
        setError("Incorrect password. Please try again.");
      } else if (code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (code === "auth/invalid-credential") {
        setError("Invalid email or password.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many failed login attempts. Please try again later.");
      } else {
        setError("Login failed. Please check your credentials.");
      }
      
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      login();
    }
  };

  return (
    <div className={styles.loginPageContainer}>
      <div className={styles.loginCenter}>
        <div className={styles.loginCard}>
          <div className="flex justify-center mb-6">
            <img src="/HV_logo_TM_nobg.png" alt="HV Logo" style={{ width: '160px', height: '160px', objectFit: 'contain' }} />
          </div>
          <h1 className={styles.loginTitle}>Admin Access</h1>
          
          {error && (
            <div className={styles.errorMessage}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
          
          <div className="space-y-5">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail size={18} className="text-slate-400" />
              </div>
              <input
                type="email"
                placeholder="Email Address"
                className={styles.loginInputField}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
            </div>
            
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock size={18} className="text-slate-400" />
              </div>
              <input
                type="password"
                placeholder="Password"
                className={styles.loginInputField}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
            </div>
            
            <button
              onClick={login}
              disabled={loading}
              className={styles.submitBtn}
            >
              {loading ? "Authenticating..." : "Sign In"}
              {!loading && <ArrowRight size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
