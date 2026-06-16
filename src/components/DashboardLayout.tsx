import React, { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, BookOpenCheck, FileBarChart, Settings, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { cn } from "../lib/utils";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebaseClient";

export default function DashboardLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const [sheetConfig, setSheetConfig] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Real-time subscription to the school config settings
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "settings", "schoolConfig"), (snap) => {
      if (snap.exists()) {
        setSheetConfig(snap.data());
      }
    });
    return unsub;
  }, [user]);

  // Removed the auto-sync (import data) useEffect from here to prevent
  // the app from overwriting Firebase (source of truth) with Google Sheet on reload.


  const navItems = [
    { name: "Overview", path: "/", icon: LayoutDashboard },
    { name: "Students", path: "/students", icon: Users },
    { name: "Task Ledger", path: "/ledger", icon: BookOpenCheck },
    { name: "CDC Reports", path: "/reports", icon: FileBarChart },
    { name: "ECA Reports", path: "/eca-reports", icon: FileBarChart },
    ...(user?.appRole === "admin" ? [{ name: "Settings", path: "/settings", icon: Settings }] : []),
  ];

  return (
    <div className="flex h-screen bg-slate-100 text-slate-800 font-sans">
      {/* Sidebar */}
      <aside className={cn("w-64 flex-shrink-0 border-r border-slate-800 bg-slate-900 text-slate-300 flex flex-col md:flex absolute md:relative z-40 h-full transition-transform duration-300", isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0")}>
        <div className="px-6 py-6 flex items-center justify-between space-x-3 border-b border-slate-800">
           <div className="flex items-center space-x-3">
              <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRRX05EAIqWz_IDcrGm0_YPLAwCv5vO7zBa39wgxOf_nA&s=10" alt="Logo" className="w-8 h-8 rounded-md bg-white p-0.5 object-contain" />
              <div>
                <h1 className="font-bold text-white text-lg leading-tight">RG PRS Workspace</h1>
                <p className="text-xs text-slate-400 font-medium capitalize">{user?.appRole} Access</p>
              </div>
           </div>
           <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white">
             <X className="w-5 h-5" />
           </button>
        </div>
        
        <nav className="flex-1 px-4 py-8 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center space-x-3 px-4 py-3 rounded-lg text-sm transition-all group",
                  isActive 
                    ? "bg-blue-500 text-white font-semibold" 
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <Icon className={cn("w-[18px] h-[18px]", isActive ? "text-white" : "text-slate-400 group-hover:text-white")} />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-5 border-t border-slate-800">
          <div className="text-xs text-slate-400 opacity-80 uppercase mb-1">{user?.appRole} LOGGED IN</div>
          <div className="text-sm font-semibold text-white truncate">{user?.displayName || user?.email}</div>
          <div className="text-[11px] text-slate-400 truncate mb-4">{user?.displayName ? user?.email : ""}</div>
          <button 
            onClick={signOut}
            className="w-full flex items-center justify-center space-x-2 text-sm font-semibold text-slate-300 bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:text-white px-3 py-2 rounded-lg transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
        {/* Mobile menu backdrop */}
        {isMobileMenuOpen && (
           <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
        )}
        
        {/* Mobile Header Topbar (Visible only on small screens) */}
        <header className="md:hidden flex items-center justify-between bg-white border-b border-slate-200 p-4 shrink-0">
          <div className="flex items-center space-x-2">
            <LayoutDashboard className="w-5 h-5 text-indigo-600" />
            <span className="font-bold text-slate-900 tracking-tight">RG PRS</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-1 text-slate-600 hover:bg-slate-100 rounded-lg">
             <Menu className="w-6 h-6" />
          </button>
        </header>

        {/* Dynamic Outlet */}
        <div className="flex-1 overflow-auto p-4 md:p-8 custom-scrollbar relative">
          <div className="max-w-6xl mx-auto w-full">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
