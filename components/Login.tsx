"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "@/src/i18n/routing";
import { auth } from "@/lib/firebase";
import { Lock, Mail, AlertCircle, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Login() {
  const router = useRouter();
  const t = useTranslations("Login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setError("");

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
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.push("/dashboard");
    } catch (err: any) {
      console.error(err);
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
    <div
      className="min-h-screen w-full flex flex-col justify-between text-white relative overflow-hidden"
      style={{
        backgroundColor: "#0a1312",
        backgroundImage: `
          radial-gradient(circle at 15% 20%, rgba(15, 165, 111, 0.18) 0%, transparent 45%),
          radial-gradient(circle at 85% 80%, rgba(46, 204, 113, 0.14) 0%, transparent 45%)
        `,
      }}
    >
      {/* Top Header */}
      <header className="w-full flex items-center justify-between p-6 sm:px-10 max-w-7xl mx-auto z-10">
        <div className="flex items-center gap-4">
          <img
            src="/HV_logo_TM_nobg.png"
            alt="Harit Vikas Logo"
            className="w-14 h-14 sm:w-16 sm:h-16 object-contain filter drop-shadow-md"
          />
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-2xl sm:text-3xl tracking-tight text-white">
              Saaya
            </span>
            <span className="text-sm sm:text-base font-semibold text-emerald-400 tracking-wide mt-0.5">
              Harit Vikas
            </span>
          </div>
        </div>
        <LanguageSwitcher className="[&_select]:border-emerald-500/30 [&_select]:text-emerald-200 [&_select]:bg-emerald-950/60 [&_select]:text-sm [&_select]:py-2 [&_select]:px-3" />
      </header>

      {/* Centered Glass Login Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 z-10">
        <div
          className="w-full max-w-[440px] rounded-2xl p-8 sm:p-10 transition-all"
          style={{
            background: "rgba(13, 27, 24, 0.8)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(46, 204, 113, 0.25)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 40px -5px rgba(15, 165, 111, 0.25)",
          }}
        >
          {/* Logo & Brand Title */}
          <div className="flex flex-col items-center text-center mb-7">
            <div className="mb-4 flex items-center justify-center">
              <img
                src="/HV_logo_TM_nobg.png"
                alt="Harit Vikas Logo"
                className="w-24 h-24 sm:w-28 sm:h-28 object-contain filter drop-shadow-[0_4px_16px_rgba(15,165,111,0.3)]"
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {t("title")}
            </h1>
            <p className="text-sm text-emerald-300/80 mt-1.5 max-w-[320px]">
              {t("subtitle")}
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2.5">
              <AlertCircle size={18} className="shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-emerald-100/90 mb-1.5">
                {t("emailLabel")}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400/70">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  placeholder={t("emailPlaceholder")}
                  className="w-full rounded-xl border border-emerald-500/20 bg-slate-950/60 text-white placeholder:text-slate-500 text-sm py-2.5 pl-10 pr-3.5 transition-all outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-emerald-100/90 mb-1.5">
                {t("passwordLabel")}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400/70">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={t("passwordPlaceholder")}
                  className="w-full rounded-xl border border-emerald-500/20 bg-slate-950/60 text-white placeholder:text-slate-500 text-sm py-2.5 pl-10 pr-10 transition-all outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-emerald-300"
                  title={showPassword ? t("hidePassword") : t("showPassword")}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Signature Green Submit Button */}
            <button
              onClick={login}
              disabled={loading}
              className="w-full mt-2 py-3.5 px-4 rounded-xl text-white font-semibold text-sm sm:text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed outline-none cursor-pointer"
              style={{
                background: "linear-gradient(135deg, #0FA56F, #2ECC71)",
                boxShadow: "0 10px 25px -5px rgba(15, 165, 111, 0.45)",
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "linear-gradient(135deg, #0e9363, #29b765)";
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "linear-gradient(135deg, #0FA56F, #2ECC71)";
              }}
            >
              {loading ? t("submitting") : t("submit")}
              {!loading && <ArrowRight size={18} />}
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center p-6 text-sm text-emerald-400/70 z-10">
        <span>Saaya Telemetry Console • Harit Vikas Bio-Technologies</span>
      </footer>
    </div>
  );
}
