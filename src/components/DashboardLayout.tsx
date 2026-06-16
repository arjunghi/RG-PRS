import React, { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, BookOpenCheck, FileBarChart, Settings, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { cn } from "../lib/utils";
import { doc, onSnapshot, collection } from "firebase/firestore";
import { db } from "../lib/firebaseClient";

export default function DashboardLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const [sheetConfig, setSheetConfig] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hasAssignments, setHasAssignments] = useState<boolean>(false);
  const [checkingAssignments, setCheckingAssignments] = useState<boolean>(true);

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

  // Real-time check if user is admin or has a subject assignment
  useEffect(() => {
    if (!user) {
      setCheckingAssignments(false);
      return;
    }
    if (user.appRole === "admin") {
      setHasAssignments(true);
      setCheckingAssignments(false);
      return;
    }
    
    // Listen to subjects to see if any assignments belong to this teacher/staff
    const unsub = onSnapshot(collection(db, "subjects"), (snap) => {
      const subs = snap.docs.map(d => d.data());
      const hasAny = subs.some((s: any) => 
        (s.assignments || []).some((a: any) => 
          String(a.teacherEmail).toLowerCase().trim() === String(user.email).toLowerCase().trim()
        )
      );
      setHasAssignments(hasAny);
      setCheckingAssignments(false);
    }, (err) => {
      console.error("Error reading subjects for permission check:", err);
      setCheckingAssignments(false);
    });
    return unsub;
  }, [user]);

  const hasPermission = user?.appRole === "admin" || hasAssignments;

  if (checkingAssignments) {
    return (
      <div className="flex bg-slate-50 min-h-screen items-center justify-center p-6 text-center">
        <div className="space-y-4">
          <div className="w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 font-medium text-xs tracking-wider uppercase">Validating Workspace Permissions...</p>
        </div>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 font-sans">
        {/* Background ambient accents */}
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-indigo-50/40 to-transparent pointer-events-none" />
        
        <div className="w-full max-w-2xl bg-white border border-slate-200/80 rounded-2xl shadow-xl overflow-hidden relative z-10 transition-all duration-300">
          <div className="px-6 py-8 sm:p-10 border-b border-slate-100 flex flex-col sm:flex-row items-center sm:items-start sm:justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
              <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 shrink-0 text-white font-black text-xl tracking-tight uppercase">
                PRS
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full inline-block">
                  Workspace Guest Mode
                </span>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Welcome to Rajarshi Gurukul PRS
                </h1>
                <p className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-md inline-block mt-1">
                  Signed in as: <span className="text-slate-900 font-mono text-[11px]">{user?.email}</span>
                </p>
              </div>
            </div>
            <button 
              onClick={signOut}
              className="flex items-center space-x-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3.5 py-2 rounded-lg transition-all shadow-sm shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>

          <div className="p-6 sm:p-10 space-y-8 bg-white">
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                System Overview & Key Modules
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  {
                    title: "Centralized Ledger",
                    desc: "Interactive gradebook for academic scores, test tracking, and instant average calculations.",
                    tag: "Ledger"
                  },
                  {
                    title: "ECA Evaluation Matrices",
                    desc: "Track sports, coordination, and extra-curricular goals across standardized scaling rubric criteria.",
                    tag: "ECA"
                  },
                  {
                    title: "Automated CDC Weights",
                    desc: "Computes custom attendance percentages, home study weights, and exam mappings automatically.",
                    tag: "CDC"
                  },
                  {
                    title: "Real-time AI Insights",
                    desc: "Instantly generates detailed behavioral commentaries and performance remarks with Gemini optimization.",
                    tag: "AI Insights"
                  }
                ].map((item, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="font-bold text-slate-800 text-sm">{item.title}</span>
                      <span className="text-[9px] font-extrabold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-wider">{item.tag}</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-xl bg-amber-50/70 border border-amber-200/60 text-amber-900 text-xs shadow-sm flex items-start gap-3.5">
              <div className="p-1 rounded-lg bg-amber-100 text-amber-700 mt-0.5 shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <div className="space-y-1">
                <p className="font-extrabold text-amber-950 uppercase tracking-wider text-[10px]">Awaiting Administrative Assignment</p>
                <p className="leading-relaxed text-amber-800 font-medium">
                  Your registration is complete! However, you do not have permission to view class lists or ledgers yet. To unlock active tabs and access modules, please ask any system Administrator to assign your email address (**{user?.email}**) to a specific subject, class, or ECA activity in the System Settings.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
