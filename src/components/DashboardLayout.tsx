import React, { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, BookOpenCheck, FileBarChart, Settings, LogOut, Menu, X, MessageSquare } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { cn } from "../lib/utils";
import { doc, onSnapshot, collection, updateDoc, serverTimestamp, query, where } from "firebase/firestore";
import { db } from "../lib/firebaseClient";

export default function DashboardLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const [sheetConfig, setSheetConfig] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hasAssignments, setHasAssignments] = useState<boolean>(false);
  const [checkingAssignments, setCheckingAssignments] = useState<boolean>(true);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);

  // Update presence
  useEffect(() => {
    if (!user) return;
    
    // Set user as online
    const userRef = doc(db, "users", user.uid);
    const updatePresence = async () => {
       try {
         await updateDoc(userRef, { lastActive: serverTimestamp() });
       } catch(e) {
         console.warn("Could not update presence", e);
       }
    };
    
    updatePresence();
    const interval = setInterval(updatePresence, 60000); // Heartbeat every 1m
    
    return () => clearInterval(interval);
  }, [user]);

  // Read online users
  useEffect(() => {
    if (!user || user.appRole === 'student' || user.appRole === 'guest') return;
    // We consider a user online if they were active in the last 2 minutes
    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);
    const q = query(
      collection(db, "users"),
      where("lastActive", ">=", twoMinsAgo)
    );
    const unsub = onSnapshot(q, (snap) => {
      const usersOnline = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Filter out self if desired, but good to see everyone
      setOnlineUsers(usersOnline);
    }, (err) => {
      console.warn("Could not read online users", err);
    });
    return unsub;
  }, [user]);

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

  const hasPermission = 
    user?.appRole === "admin" || 
    (user?.status === "approved" && ["teacher", "eca_teacher", "incharge", "staff"].includes(user?.appRole || "")) ||
    hasAssignments;

  useEffect(() => {
    if (!checkingAssignments && !hasPermission && location.pathname !== "/") {
      // Safely redirect unpermitted users accessing sub-modules back to Overview
      window.location.replace("/");
    }
  }, [checkingAssignments, hasPermission, location.pathname]);

  const navItems = hasPermission ? [
    { name: "Overview", path: "/", icon: LayoutDashboard },
    { name: "Students", path: "/students", icon: Users },
    { name: "Task Ledger", path: "/ledger", icon: BookOpenCheck },
    { name: "CDC Reports", path: "/reports", icon: FileBarChart },
    { name: "ECA Reports", path: "/eca-reports", icon: FileBarChart },
    ...(user?.appRole === "admin" ? [{ name: "Settings", path: "/settings", icon: Settings }] : []),
  ] : [
    { name: "Overview", path: "/", icon: LayoutDashboard },
  ];

  return (
    <div className="flex h-screen bg-[#F0F2F5] text-slate-800 font-sans overflow-hidden p-2 sm:p-4">
      
      {/* Mobile Sidebar & Header */}
      {isMobileMenuOpen && (
         <div className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}
      <aside className={cn(
        "fixed inset-y-0 left-0 bg-white z-50 w-64 shadow-2xl transition-transform duration-300 flex flex-col md:hidden", 
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-5 flex items-center justify-between border-b border-slate-100">
           <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">RG</div>
              <span className="font-bold text-slate-900">Workspace</span>
           </div>
           <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-slate-600">
             <X className="w-5 h-5" />
           </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
           {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.name} to={item.path} onClick={() => setIsMobileMenuOpen(false)}
                      className={cn("flex items-center px-4 py-3 rounded-2xl text-sm font-medium transition-colors", 
                      isActive ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900")}>
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              );
           })}
        </nav>
        <div className="p-4 border-t border-slate-100">
            <button onClick={signOut} className="w-full flex items-center justify-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-2xl font-medium transition-colors">
              <LogOut className="w-4 h-4" /> <span>Sign Out</span>
            </button>
        </div>
      </aside>

      {/* Modern Desktop Floating Icon Nav (Left) */}
      <aside className="hidden md:flex flex-col items-center justify-between py-4 pr-4 pl-2 h-full">
         <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg mb-8 shrink-0 relative overflow-hidden">
             {/* Logo / Brand */}
             <div className="text-white font-black text-xl tracking-tighter">RG</div>
         </div>

         <nav className="flex-1 flex flex-col items-center justify-center space-y-3">
           {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.name} to={item.path} title={item.name}
                      className={cn("w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300", 
                      isActive ? "bg-white text-blue-600 shadow-md shadow-black/5 scale-110" : "text-slate-400 hover:bg-white/60 hover:text-slate-700")}>
                  <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                </Link>
              );
           })}
         </nav>

         <div className="mt-8 shrink-0 flex flex-col space-y-3">
             <Link to="/chat" title="Staff Chat" 
                className={cn("w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300 shadow-xl", 
                 location.pathname === '/chat' ? "bg-white text-indigo-600 scale-110 shadow-indigo-100" : "bg-white text-slate-700 hover:scale-105")}>
                <MessageSquare className="w-5 h-5" strokeWidth={2} />
             </Link>
         </div>
      </aside>

      {/* Main UI Area */}
      <main className="flex-1 bg-white rounded-[32px] shadow-sm shadow-slate-200/50 flex flex-col overflow-hidden relative">
        
        {/* Modern Top Header / Pill Nav */}
        <header className="h-[88px] shrink-0 border-b border-slate-100 flex items-center justify-between px-6 md:px-10">
           {/* Mobile Menu Button */}
           <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden mr-4 p-2 -ml-2 text-slate-500 rounded-xl hover:bg-slate-50">
             <Menu className="w-6 h-6" />
           </button>

           {/* Pill Navigation (Desktop) */}
           <div className="hidden md:flex items-center space-x-1.5 bg-slate-50 p-1.5 rounded-full border border-slate-100">
             {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link key={item.name} to={item.path}
                        className={cn("px-5 py-2.5 rounded-full text-sm font-semibold transition-all select-none", 
                          isActive ? "bg-slate-900 text-white shadow-md shadow-black/10" : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50")}>
                    {item.name}
                  </Link>
                );
             })}
           </div>

           {/* Right Section: Avatars + Profile */}
           <div className="flex h-full items-center ml-auto pl-4 space-x-6">
              
              {/* Online Users Cluster */}
              {hasPermission && onlineUsers.length > 0 && (
                <div className="hidden sm:flex items-center space-x-3 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
                   <div className="flex -space-x-2.5">
                     {onlineUsers.slice(0, 4).map((ou, idx) => (
                       <img key={ou.id} src={ou.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(ou.name || ou.email)}&background=random`} alt={ou.name || ou.email} 
                            className="w-8 h-8 rounded-full border-2 border-white relative z-10" title={`${ou.name || ou.email} is online`} />
                     ))}
                     {onlineUsers.length > 4 && (
                       <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center relative z-0">
                         +{onlineUsers.length - 4}
                       </div>
                     )}
                   </div>
                   <div className="flex flex-col">
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Online</span>
                     <span className="text-xs font-bold text-slate-700 leading-none">{onlineUsers.length} Staff</span>
                   </div>
                </div>
              )}

              {/* User Profile */}
              <div className="flex items-center space-x-3 border-l border-slate-100 pl-6 h-10">
                 <div className="flex flex-col items-end hidden sm:flex">
                   <span className="text-sm font-bold text-slate-900">{user?.displayName || 'User'}</span>
                   <span className="text-xs font-medium text-slate-400 capitalize">{user?.appRole === 'admin' ? 'Administrator' : user?.appRole}</span>
                 </div>
                 <div className="relative group cursor-pointer">
                    <img 
                      src={user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || user?.email || 'User')}&background=0D8ABC&color=fff`} 
                      alt="Profile" 
                      className="w-10 h-10 rounded-full border border-slate-200 transition-transform group-hover:scale-105" 
                    />
                    {/* Tiny green online dot */}
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                    
                    {/* Dropdown / Sign out on hover (Desktop) */}
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                       <div className="px-3 py-2 border-b border-slate-50 mb-2 sm:hidden">
                         <div className="font-bold text-slate-900 text-sm truncate">{user?.displayName || 'User'}</div>
                         <div className="text-xs text-slate-400 truncate">{user?.email}</div>
                       </div>
                       <button onClick={signOut} className="w-full flex items-center px-3 py-2 text-sm text-red-600 font-semibold hover:bg-red-50 rounded-xl transition-colors">
                          <LogOut className="w-4 h-4 mr-2"/>
                          Sign out
                       </button>
                    </div>
                 </div>
              </div>

           </div>
        </header>

        {/* Dynamic Canvas Content */}
        <div className="flex-1 overflow-auto bg-white p-4 md:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto w-full pb-10">
            <Outlet context={{ hasPermission, checkingAssignments }} />
          </div>
        </div>

      </main>
    </div>
  );
}

