import React, { useState } from "react";
import { LogIn, Sparkles, Database, RefreshCw, Award, Lock, Mail, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { Navigate } from "react-router-dom";

export default function AuthPage() {
  const { user, signIn, signInWithGoogle, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showEnableHelper, setShowEnableHelper] = useState(false);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-sm font-medium tracking-widest text-slate-400 animate-pulse uppercase">Initializing Gateway...</p>
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
       setErrorMsg("Please fill in both email and password.");
       return;
    }
    setErrorMsg("");
    setShowEnableHelper(false);
    setIsSigningIn(true);
    try {
      await signIn(email, password);
    } catch(err: any) {
      console.error("Sign-in failed", err);
      
      const errMsgString = err.message || "";
      if (err.code === "auth/operation-not-allowed" || errMsgString.includes("operation-not-allowed")) {
        setErrorMsg("Email/Password provider is not yet enabled in your Firebase project.");
        setShowEnableHelper(true);
      } else if (err.code === "auth/wrong-password") {
         setErrorMsg("Incorrect password. Please try again.");
      } else if (err.code === "auth/invalid-email") {
         setErrorMsg("Please enter a valid school email address.");
      } else if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
         setErrorMsg("Pre-enrollment required. Ensure your administrator has registered your email first, or ensure your typed credentials are correct.");
      } else {
         setErrorMsg(err.message || "An authentication error occurred. Please try again.");
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg("");
    setShowEnableHelper(false);
    setIsGoogleSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Google Sign-In failed", err);
      setErrorMsg(err.message || "Failed to authenticate with your Google Account.");
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100 relative overflow-hidden select-none">
      
      {/* Visual background atmospheric elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px]" />
      
      <div className="w-full grid lg:grid-cols-12 min-h-screen relative z-10">
        
        {/* Left Column - Presentation Panel */}
        <div className="hidden lg:flex lg:col-span-7 flex-col justify-between p-12 border-r border-slate-900/60 bg-slate-950/40 backdrop-blur-sm relative">
          
          {/* Header */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center rounded-xl shadow-lg shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black tracking-widest text-white uppercase font-sans">Rajarshi Gurukul</p>
              <p className="text-[10px] font-bold text-slate-400 tracking-wider font-mono">SECURE GRADEBOOK SYSTEM</p>
            </div>
          </div>

          {/* Main Visual Feature Section */}
          <div className="max-w-md space-y-8 my-auto">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-blue-400 bg-blue-950/50 border border-blue-900/50 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span>Active Portal Version 2.6</span>
              </span>
              <h1 className="text-4xl font-extrabold tracking-tight text-white leading-[1.15] font-sans">
                Evaluate, Track, and Sync Real-time.
              </h1>
              <p className="text-slate-400 text-sm leading-relaxed">
                Streamlining continuous assessment recordings, ECA performance metrics, and high-performance secure live sync for advanced scholastic tracking.
              </p>
            </div>

            {/* Structured Info Bullets */}
            <div className="space-y-4">
              <div className="flex items-start space-x-3.5">
                <div className="mt-0.5 w-8 h-8 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center text-blue-400 shrink-0">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-sans">Cloud Data Source & Ledger</h4>
                  <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">Secure Firestore engines compile academic records dynamically without friction.</p>
                </div>
              </div>

              <div className="flex items-start space-x-3.5">
                <div className="mt-0.5 w-8 h-8 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center text-indigo-400 shrink-0">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-sans">Dynamic Real-time Synced Ledger</h4>
                  <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">Assessment changes and grades are instantly synced and recorded to the cloud for real-time visibility.</p>
                </div>
              </div>

              <div className="flex items-start space-x-3.5">
                <div className="mt-0.5 w-8 h-8 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center text-amber-400 shrink-0">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-sans">CDC & ECA Integration</h4>
                  <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">Instant evaluation maps directly into national educational parameters and criteria.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer branding details */}
          <div className="text-slate-500 text-[11px] font-medium font-mono">
             © 2026 Rajarshi Gurukul. Authorized scholastic team application.
          </div>
        </div>

        {/* Right Column - Beautiful Login Panel */}
        <div className="col-span-12 lg:col-span-5 flex items-center justify-center p-6 sm:p-12 relative bg-slate-950">
          <div className="w-full max-w-sm space-y-6 bg-slate-900/50 border border-slate-850/60 backdrop-blur-md rounded-2xl p-8 sm:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            
            {/* Circular glowing school icon header */}
            <div className="text-center space-y-3">
              <div className="mx-auto w-14 h-14 bg-gradient-to-tr from-slate-900 to-slate-850 border border-slate-800 text-white flex items-center justify-center rounded-2xl shadow-xl shadow-black/80 ring-2 ring-blue-500/10">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
              </div>
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-white font-sans">RG PRS Login</h2>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mt-1 text-blue-500 font-mono">Progress Report System</p>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3.5 bg-red-950/50 border border-red-900/50 rounded-xl text-xs text-red-400 leading-relaxed font-semibold space-y-1.5">
                <p>{errorMsg}</p>
                {showEnableHelper && (
                  <div className="border-t border-red-900/40 pt-1.5 text-[10px] text-red-300 space-y-1">
                    <p className="font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      How to enable in Firebase:
                    </p>
                    <ol className="list-decimal pl-4.5 space-y-0.5 font-sans">
                      <li>Go to your Firebase Console.</li>
                      <li>In the left sidebar, click <strong>Authentication</strong>.</li>
                      <li>Go to the <strong>Sign-in method</strong> tab.</li>
                      <li>Under "Sign-in providers", click <strong>Email/Password</strong>.</li>
                      <li>Toggle <strong>Enable</strong> and click <strong>Save</strong>.</li>
                    </ol>
                  </div>
                )}
              </div>
            )}

            {/* Credential login form */}
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-sans">School Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@rajarshigurukul.edu.np"
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-sans"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-sans">Security Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full pl-10 pr-10 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 focus:outline-none cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSigningIn || isGoogleSigningIn}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 text-white font-bold text-sm px-6 py-3.5 rounded-xl flex items-center justify-center space-x-2.5 transition-all shadow-[0_4px_20px_rgba(37,99,235,0.25)] hover:shadow-[0_4px_25px_rgba(37,99,235,0.35)] outline-none cursor-pointer hover:translate-y-[-1px] active:translate-y-[0] duration-200 font-sans"
              >
                {isSigningIn ? (
                  <span className="tracking-widest uppercase text-xs animate-pulse font-bold">Verifying Credentials...</span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 shrink-0" />
                    <span>Access Portal with Password</span>
                  </>
                )}
              </button>
            </form>

            <div className="relative flex items-center justify-center my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800"></div>
              </div>
              <span className="relative px-3 text-xs text-slate-500 bg-slate-900 font-bold uppercase tracking-widest font-sans">OR</span>
            </div>

            {/* working Google Login as full safe alternate bypass option! */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSigningIn || isGoogleSigningIn}
              className="w-full bg-slate-950 hover:bg-slate-900 text-slate-100 font-bold text-sm px-6 py-3.5 rounded-xl flex items-center justify-center space-x-2.5 transition-all border border-slate-800 cursor-pointer hover:border-slate-700 outline-none hover:translate-y-[-1px] active:translate-y-[0] duration-200 font-sans shadow-md"
            >
              {isGoogleSigningIn ? (
                <span className="tracking-widest uppercase text-xs animate-pulse font-bold text-slate-400">Opening Authorization...</span>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53y" />
                  </svg>
                  <span>Access Instantly with Google</span>
                </>
              )}
            </button>

            {/* Helper links */}
            <div className="border-t border-slate-900/80 pt-5 text-center space-y-2.5 text-[11px] font-medium text-slate-500 font-mono">
               <div>
                 <p className="font-sans">Students & Parents (No login required)</p>
                 <a href="/student-portal" className="text-blue-500 hover:text-blue-400 font-bold underline transition-colors cursor-pointer text-xs font-sans">
                   Open Student Portal
                 </a>
               </div>
               <div className="pt-1">
                 <p className="font-sans">Unenrolled or need subject credentials?</p>
                 <p className="text-blue-500 font-bold font-sans">
                   Contact Admin (arjun@rajarshigurukul.edu.np)
                 </p>
               </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
