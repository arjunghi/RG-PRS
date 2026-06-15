import React from "react";
import { LogIn } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { Navigate } from "react-router-dom";

export default function AuthPage() {
  const { user, signIn, loading } = useAuth();
  
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-blue-100 text-blue-600 flex items-center justify-center rounded-2xl mb-4">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 14c4 4 8 0 8-6a8 8 0 1 0-16 0c0 6 4 10 8 6z"/><path d="M11 12h2"/></svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">RG PRS Gateway</h1>
        <p className="text-slate-500 font-medium text-sm">
          Welcome to the Rajarshi Gurukul Progress Report System. Please securely log in with your institutional Google account to access your workspace.
        </p>
        
        <button
          onClick={signIn}
          className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center space-x-2 transition-all shadow-md focus:ring-4 focus:ring-blue-200 outline-none"
        >
          <LogIn className="w-5 h-5" />
          <span>Sign In with School Account</span>
        </button>
      </div>
    </div>
  );
}
