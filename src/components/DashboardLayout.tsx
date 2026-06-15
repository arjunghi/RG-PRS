import React, { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, BookOpenCheck, FileBarChart, Settings, LogOut, FileSpreadsheet, ExternalLink, RefreshCw } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { cn } from "../lib/utils";
import { doc, getDoc, getDocs, setDoc, onSnapshot, collection } from "firebase/firestore";
import { db } from "../lib/firebaseClient";
import { importSheetsConfirmAndSync } from "../lib/googleSheetsSync";

export default function DashboardLayout() {
  const { user, signOut, accessToken, reconnectGoogle } = useAuth();
  const location = useLocation();

  const [sheetConfig, setSheetConfig] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState("");

  // 1. Check & Auto-link the master Google Spreadsheet at startup/mount
  useEffect(() => {
    if (!user) return;
    
    const autoLinkSheetOnFirstBoot = async () => {
      try {
        const docRef = doc(db, "settings", "schoolConfig");
        const snap = await getDoc(docRef);
        
        const defaultId = "1vPZTmPBYi_RlCT4O6EnXz2nRPMqV4StZNCnxB1ZhHJM";
        const defaultUrl = `https://docs.google.com/spreadsheets/d/${defaultId}/edit?usp=sharing`;
        
        let currentId = snap.exists() ? snap.data().googleSpreadsheetId : null;
        
        if (!currentId) {
          console.log("No connected spreadsheet found. Auto-linking default master sheet:", defaultId);
          await setDoc(docRef, {
            googleSpreadsheetId: defaultId,
            googleSpreadsheetUrl: defaultUrl,
            googleSyncLastTime: new Date().toISOString()
          }, { merge: true });
        }
      } catch (err: any) {
        if (err.message?.includes('offline')) {
          console.warn("Client is offline, skipping master sheet linking.");
        } else {
          console.warn("Failed to auto-link default master sheet:", err);
        }
      }
    };
    
    autoLinkSheetOnFirstBoot();
  }, [user]);

  // 2. Real-time subscription to the school config settings
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "settings", "schoolConfig"), (snap) => {
      if (snap.exists()) {
        setSheetConfig(snap.data());
      }
    });
    return unsub;
  }, [user]);

  // 3. Auto-sync (import data) if an active Google token is detected and Firestore databases are empty
  useEffect(() => {
    if (!user || !accessToken) return;
    
    const triggerAutoBootstrap = async () => {
      try {
        const docRef = doc(db, "settings", "schoolConfig");
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;
        
        const sheetId = snap.data().googleSpreadsheetId;
        if (!sheetId) return;
        
        // Auto-sync on reload if the user has an active token
        // Wait, to prevent infinite loops during dev, let's keep track of if we've synced this session.
        if (!sessionStorage.getItem("has_auto_synced")) {
           console.log("Auto-syncing connected spreadsheet on reload...");
           setSyncStatus("syncing");
           setSyncMessage("Auto-syncing roster and criteria...");
           
           try {
             const result = await importSheetsConfirmAndSync(accessToken, sheetId);
             sessionStorage.setItem("has_auto_synced", "true");
             setSyncStatus("success");
             setSyncMessage(`Synced ${result.studentsCount} students!`);
           } catch(e) {
             console.error(e);
             setSyncStatus("error");
             setSyncMessage("Auto-sync failed");
           }
           setTimeout(() => {
             setSyncStatus("idle");
           }, 6000);
        }
      } catch (err: any) {
        console.error("Startup auto-pull from google sheets failed:", err);
        setSyncStatus("error");
        setSyncMessage("Sheets Sync paused: check permissions");
      }
    };
    
    triggerAutoBootstrap();
  }, [user, accessToken]);

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
      <aside className="w-64 flex-shrink-0 border-r border-slate-800 bg-slate-900 text-slate-300 flex flex-col hidden md:flex">
        <div className="px-6 py-6 flex items-center space-x-3 border-b border-slate-800">
          <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRRX05EAIqWz_IDcrGm0_YPLAwCv5vO7zBa39wgxOf_nA&s=10" alt="Logo" className="w-8 h-8 rounded-md bg-white p-0.5 object-contain" />
          <div>
            <h1 className="font-bold text-white text-lg leading-tight">RG PRS Workspace</h1>
            <p className="text-xs text-slate-400 font-medium capitalize">{user?.appRole} Access</p>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-8 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.name}
                to={item.path}
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

        {/* Google Sheets Sync Integration Status */}
        {sheetConfig?.googleSpreadsheetId && (
          <div className="mx-4 p-3.5 bg-slate-800/60 border border-slate-800 rounded-xl mb-4 text-[11px] space-y-2">
            <div className="flex items-center justify-between text-slate-300">
              <span className="font-bold flex items-center space-x-1">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Google Sheets Sync</span>
              </span>
              <a
                href={sheetConfig.googleSpreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                referrerPolicy="no-referrer"
                className="text-slate-400 hover:text-white transition"
                title="Open active Spreadsheet"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            
            <p className="text-[10px] text-slate-400 leading-normal font-medium max-w-full truncate">
              ID: {sheetConfig.googleSpreadsheetId}
            </p>

            {accessToken ? (
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Google Sheets Connected</span>
                </span>
                
                <button
                  onClick={async () => {
                    if (syncStatus === "syncing") return;
                    setSyncStatus("syncing");
                    setSyncMessage("Manual Syncing DB...");
                    try {
                      const res = await importSheetsConfirmAndSync(accessToken, sheetConfig.googleSpreadsheetId);
                      setSyncStatus("success");
                      setSyncMessage(`Synced ${res.studentsCount} Students!`);
                      setTimeout(() => setSyncStatus("idle"), 4000);
                    } catch (err) {
                      setSyncStatus("error");
                      setSyncMessage("Sync Failed");
                      setTimeout(() => setSyncStatus("idle"), 4000);
                    }
                  }}
                  className="bg-slate-700 hover:bg-slate-600 hover:text-white text-slate-300 font-semibold px-2 py-0.5 rounded cursor-pointer transition text-[9px]"
                  title="Force import updates from sheets (Warning: may overwrite manual changes)"
                >
                  Pull from sheet
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="text-slate-400 text-[10px] leading-relaxed">
                  Connect to pull/push spreadsheet updates.
                </div>
                <button
                  onClick={async () => {
                    setSyncStatus("syncing");
                    setSyncMessage("Connecting Google...");
                    const token = await reconnectGoogle();
                    if (token) {
                      setSyncStatus("success");
                      setSyncMessage("Google Connected!");
                      setTimeout(() => setSyncStatus("idle"), 4000);
                    } else {
                      setSyncStatus("error");
                      setSyncMessage("Auth Failed");
                      setTimeout(() => setSyncStatus("idle"), 4000);
                    }
                  }}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-[9px] uppercase py-1 rounded block text-center cursor-pointer transition"
                >
                  Connect Spreadsheet
                </button>
              </div>
            )}

            {syncStatus !== "idle" && (
              <div className={cn(
                "p-1.5 rounded text-[10px] font-bold text-center mt-1",
                syncStatus === "syncing" && "bg-blue-900/40 text-blue-300 animate-pulse",
                syncStatus === "success" && "bg-emerald-900/30 text-emerald-300",
                syncStatus === "error" && "bg-rose-900/30 text-rose-300"
              )}>
                {syncMessage}
              </div>
            )}
          </div>
        )}

        <div className="p-5 border-t border-slate-800">
          <div className="text-xs text-slate-400 opacity-80 uppercase mb-1">{user?.appRole} LOGGED IN</div>
          <div className="text-sm text-white truncate mb-4">{user?.email}</div>
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
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Mobile Header Topbar (Visible only on small screens) */}
        <header className="md:hidden flex items-center justify-between bg-white border-b border-slate-200 p-4 shrink-0">
          <div className="flex items-center space-x-2">
            <LayoutDashboard className="w-5 h-5 text-indigo-600" />
            <span className="font-bold text-slate-900 tracking-tight">RG PRS</span>
          </div>
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
