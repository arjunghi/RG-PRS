import React, { useState } from "react";
import { LogIn, Sparkles, Database, FileSpreadsheet, Award, Lock } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { Navigate } from "react-router-dom";

export default function AuthPage() {
  const { user, signIn, loading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-sm font-medium tracking-widest text-slate-400 animate-pulse uppercase">Initializing Gateway...</p>
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signIn();
    } catch(err) {
      console.error("Sign-in failed", err);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100 relative overflow-hidden select-none">
      
      {/* Visual background atmospheric elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px]" />

      {/* Grid structure: Left Brand column (hidden on mobile), Right Auth Column */}
      <div className="w-full grid lg:grid-cols-12 min-h-screen relative z-10">
        
        {/* Left Column - Presentation Panel */}
        <div className="hidden lg:flex lg:col-span-7 flex-col justify-between p-12 border-r border-slate-900/60 bg-slate-950/40 backdrop-blur-sm relative">
          
          {/* Header */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center rounded-xl shadow-lg shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black tracking-widest text-white uppercase">Rajarshi Gurukul</p>
              <p className="text-[10px] font-bold text-slate-400 tracking-wider">SECURE GRADEBOOK SYSTEM</p>
            </div>
          </div>

          {/* Main Visual Feature Section */}
          <div className="max-w-md space-y-8 my-auto">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-blue-400 bg-blue-950/50 border border-blue-900/50 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span>Active Portal Version 2.4</span>
              </span>
              <h1 className="text-4xl font-extrabold tracking-tight text-white leading-[1.15]">
                Evaluate, Track, and Sync Automatically.
              </h1>
              <p className="text-slate-400 text-sm leading-relaxed">
                Streamlining continuous assessment recordings, ECA performance metrics, and automatic spreadsheet back-ups for advanced scholastic tracking.
              </p>
            </div>

            {/* Structured Info Bullets */}
            <div className="space-y-4">
              <div className="flex items-start space-x-3.5">
                <div className="mt-0.5 w-8 h-8 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center text-blue-400 shrink-0">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Cloud Data Source & Ledger</h4>
                  <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">Secure Firestore engines compile academic records dynamically without friction.</p>
                </div>
              </div>

              <div className="flex items-start space-x-3.5">
                <div className="mt-0.5 w-8 h-8 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center text-indigo-400 shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Live Bi-directional Sync</h4>
                  <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">Automatic background mirroring creates complete backups on school worksheets instantly.</p>
                </div>
              </div>

              <div className="flex items-start space-x-3.5">
                <div className="mt-0.5 w-8 h-8 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center text-amber-400 shrink-0">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">CDC & ECA Integration</h4>
                  <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">Instant evaluation maps directly into national educational parameters and criteria.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer branding details */}
          <div className="text-slate-500 text-[11px] font-medium">
             © 2026 Rajarshi Gurukul. Authorized scholastic team application.
          </div>
        </div>

        {/* Right Column - Beautiful Login Panel */}
        <div className="col-span-12 lg:col-span-5 flex items-center justify-center p-6 sm:p-12 relative bg-slate-950">
          <div className="w-full max-w-sm space-y-8 bg-slate-900/50 border border-slate-850/60 backdrop-blur-md rounded-2xl p-8 sm:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            
            {/* Circular glowing school icon header */}
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-slate-900 to-slate-850 border border-slate-800 text-white flex items-center justify-center rounded-2xl shadow-xl shadow-black/80 ring-2 ring-blue-500/10">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
              </div>
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-white">RG PRS Login</h2>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mt-1.5 text-blue-500">Progress Report System</p>
              </div>
            </div>

            {/* Informational warning */}
            <p className="text-center text-slate-400 text-xs sm:text-xs leading-relaxed max-w-xs mx-auto">
              Please sign in using your pre-enrolled institutional email account. Access is restricted to pre-approved credentials.
            </p>

            {/* Login control */}
            <div className="space-y-4">
              <button
                onClick={handleSignIn}
                disabled={isSigningIn}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 text-white font-bold text-sm px-6 py-3.5 rounded-xl flex items-center justify-center space-x-2.5 transition-all shadow-[0_4px_20px_rgba(37,99,235,0.25)] hover:shadow-[0_4px_25px_rgba(37,99,235,0.35)] outline-none cursor-pointer hover:translate-y-[-1px] active:translate-y-[0] duration-200"
              >
                {isSigningIn ? (
                  <span className="tracking-widest uppercase text-xs animate-pulse font-bold">Connecting...</span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 shrink-0" />
                    <span>Sign In with school account</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 pt-2 selection:bg-transparent">
                <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Authorized school authentication</span>
              </div>
            </div>

            {/* Helper links */}
            <div className="border-t border-slate-900/80 pt-6 text-center space-y-1 text-[11px] font-medium text-slate-500">
               <p>Unenrolled or need subject credentials?</p>
               <p className="text-blue-500 hover:underline cursor-pointer">
                 Contact arjun@rajarshigurukul.edu.np
               </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
