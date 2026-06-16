import React, { useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { Navigate } from "react-router-dom";
import { LogOut, ShieldX, RefreshCw, Mail, AlertTriangle } from "lucide-react";

export default function RegistrationPage() {
  const { user, signOut, loading } = useAuth();
  const [isChecking, setIsChecking] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-sm font-medium tracking-widest text-slate-400 animate-pulse">VERIFYING credentials...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.status === "approved") return <Navigate to="/" replace />;

  const handleCheckStatus = () => {
    setIsChecking(true);
    if (user?.uid) {
      localStorage.removeItem(`app_user_role_${user.uid}`);
      localStorage.removeItem(`app_user_role_${user.uid}_status`);
    }
    setTimeout(() => {
      setIsChecking(false);
      window.location.reload();
    }, 1200);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6 relative overflow-hidden select-none">
      {/* Visual background ambient glow circles */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl" />

      <div className="w-full max-w-lg bg-slate-900/80 border border-slate-800/80 backdrop-blur-md rounded-2xl shadow-2xl p-8 text-center space-y-8 relative z-10 transition-all">
        
        {/* Animated Restriced Access Lock Graphic */}
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-red-950/40 border border-red-500/30 text-red-500 flex items-center justify-center rounded-2xl mb-4 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
            <ShieldX className="w-8 h-8" />
          </div>
          <span className="text-red-500 text-xs font-bold tracking-widest uppercase bg-red-950/60 border border-red-900/50 px-3 py-1 rounded-full">
            RESTRICTED PORTAL
          </span>
        </div>

        {/* Title and Explanation */}
        <div className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Access Pre-Enrolled Only</h1>
          <p className="text-slate-400 font-medium text-sm max-w-sm mx-auto leading-relaxed">
            Welcome to <span className="text-white font-semibold">RG PRS</span>. This gateway is restricted to pre-authorized administrative staff and educators of Rajarshi Gurukul.
          </p>
        </div>

        {/* Badged current user email */}
        <div className="bg-slate-950/80 border border-slate-800/60 rounded-xl p-4 flex items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-800 text-slate-400 flex items-center justify-center rounded-lg">
              <Mail className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">SIGNED IN AS</p>
              <p className="text-sm font-semibold text-slate-200 truncate">{user.email}</p>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase py-1 px-2.5 bg-amber-950/50 border border-amber-500/30 text-amber-500 rounded">
            NOT APPROVED
          </span>
        </div>

        {/* Action instruction list */}
        <div className="text-xs text-left text-slate-400 bg-slate-950/40 border border-slate-800/20 rounded-xl p-4 space-y-2.5 leading-relaxed">
          <p className="font-bold text-slate-300 text-[11px] uppercase tracking-wide flex items-center gap-1.5 mb-1 text-red-400">
            <AlertTriangle className="w-3.5 h-3.5" /> Core Security Instruction
          </p>
          <p>
            1. Your school email address must be pre-enrolled directly by the Administrator prior to logging in.
          </p>
          <p>
            2. The Administrator (arjun@rajarshigurukul.edu.np) is responsible for setting your full name, email address, and assigning the grades/subjects you have grading authority for.
          </p>
          <p>
            3. Once enrolled, your portal starts automatically upon clicking <span className="text-blue-400 font-semibold cursor-pointer" onClick={handleCheckStatus}>Check Authorization Status</span>.
          </p>
        </div>

        {/* Interactive Action Controls */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleCheckStatus}
            disabled={isChecking}
            className="flex-1 bg-white hover:bg-slate-100 disabled:bg-slate-300 disabled:text-slate-600 text-slate-950 px-6 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 shadow-[0_4px_12px_rgba(255,255,255,0.05)] active:scale-[0.98]"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? "animate-spin" : ""}`} />
            <span>{isChecking ? "Verifying Status..." : "Verify Access Status"}</span>
          </button>

          <button
            onClick={signOut}
            className="bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 hover:text-white px-6 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 active:scale-[0.98]"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            <span>Log Out</span>
          </button>
        </div>

      </div>
    </div>
  );
}
