import React, { useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { db } from "../lib/firebaseClient";
import { collection, onSnapshot } from "firebase/firestore";
import { ShieldCheck, BarChart2, AlertTriangle, AlertCircle, TrendingUp } from "lucide-react";
import { useOutletContext } from "react-router-dom";

export default function DashboardHome() {
  const { user } = useAuth();
  const outletCtx = useOutletContext<{ hasPermission: boolean }>();
  const hasPermission = outletCtx ? outletCtx.hasPermission : true;

  const [stats, setStats] = useState({ subjects: 0, tasks: 0, students: 0 });
  const [quadrants, setQuadrants] = useState({ excellence: 0, satisfactory: 0, progress: 0, critical: 0 });

  useEffect(() => {
    if (!hasPermission) return;
    const unsubStudents = onSnapshot(collection(db, "students"), snap => {
       setStats(s => ({ ...s, students: snap.size }));
    });
    const unsubTasks = onSnapshot(collection(db, "tasks"), snap => {
       setStats(s => ({ ...s, tasks: snap.size }));
    });
    const unsubSubjects = onSnapshot(collection(db, "subjects"), snap => {
       setStats(s => ({ ...s, subjects: snap.size }));
    });

    return () => {
      unsubStudents();
      unsubTasks();
      unsubSubjects();
    }
  }, [hasPermission]);

  useEffect(() => {
    if (!hasPermission) return;
    // Calculate academic performance distributions
    const unsubTasks = onSnapshot(collection(db, "tasks"), tkSnap => {
      const tasks = tkSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      
      const unsubScores = onSnapshot(collection(db, "scores"), scSnap => {
        const scores = scSnap.docs.map(d => d.data());
        
        const unsubStudents = onSnapshot(collection(db, "students"), stSnap => {
          const students = stSnap.docs.map(d => ({ id: d.id }));
          
          let exc = 0, sat = 0, prog = 0, crit = 0;

          students.forEach(st => {
            // Calculate overall percentage for this student
            let totalObtained = 0;
            let totalMax = 0;
            let hasScores = false;

            const stScores = scores.filter(sc => sc.studentId === st.id);
            stScores.forEach(sc => {
               const tk = tasks.find(t => t.id === sc.taskId);
               if (tk && typeof sc.score === "number" && tk.maxMarks) {
                 totalObtained += sc.score;
                 totalMax += Number(tk.maxMarks);
                 hasScores = true;
               }
            });

            if (hasScores && totalMax > 0) {
               const pct = (totalObtained / totalMax) * 100;
               if (pct >= 80) exc++;
               else if (pct >= 60) sat++;
               else if (pct >= 40) prog++;
               else crit++;
            }
          });

          setQuadrants({ excellence: exc, satisfactory: sat, progress: prog, critical: crit });
        });
        
        return () => unsubStudents();
      });
      return () => unsubScores();
    });
    
    return () => unsubTasks();
  }, [hasPermission]);

  if (!hasPermission) {
    return (
      <div className="min-h-[70vh] bg-slate-50/50 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 font-sans">
        {/* Background ambient accents */}
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-indigo-50/40 to-transparent pointer-events-none" />
        
        <div className="w-full max-w-2xl bg-white border border-slate-200/80 rounded-2xl shadow-xl overflow-hidden relative z-10 transition-all duration-300">
          <div className="px-6 py-8 sm:p-10 border-b border-slate-100 flex flex-col sm:flex-row items-center sm:items-start sm:justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left animate-fade-in">
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
                <p className="text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1 rounded-md inline-block mt-1">
                  Signed in as: <span className="text-slate-900 font-mono text-[11px]">{user?.email}</span>
                </p>
              </div>
            </div>
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
                <p className="leading-relaxed text-amber-800 font-medium font-semibold">
                  Your registration is complete! However, you do not have permission to view class lists or ledgers yet. To unlock active tabs and access modules, please ask any system Administrator to assign your email address (**{user?.email}**) to a specific subject, class, or ECA activity in the System Settings.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome back, {user?.displayName?.split(" ")[0] || "User"}</h2>
        <p className="text-sm font-medium text-slate-500 mt-1">Here's your high-level overview of the academic progress data.</p>
      </header>

      {/* Top Standard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { label: "Active Subjects", val: stats.subjects, sub: "Running term", subColor: "text-blue-500" },
          { label: "Total Students Mapped", val: stats.students, sub: "+12% vs last term", subColor: "text-green-500" },
          { label: "Total Assessment Tasks", val: stats.tasks, sub: "Pending grading", subColor: "text-amber-500" },
        ].map((m, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-1 shadow-sm">
             <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">{m.label}</span>
             <div className="flex items-baseline gap-2 mt-1">
               <span className="text-2xl font-bold text-slate-900">{m.val}</span>
               <span className={`text-[11px] font-semibold ${m.subColor}`}>{m.sub}</span>
             </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-2">
          {/* Main Dashboard Panel - Quadrants Component can go inside here or outside */}
          <div className="col-span-1 lg:col-span-2 space-y-5">
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm p-6 flex flex-col justify-center items-center text-center min-h-[35vh]">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                  <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h3 className="text-slate-800 font-bold mb-2">More dashboard analytics to load...</h3>
                <p className="text-sm font-medium text-slate-400 max-w-sm">
                  Navigate to individual tabs on the left to track student ledgers, allocate marks, and leverage AI generated remark pipelines.
                </p>
              </div>
          </div>

          {/* AI Academic Insights */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5 shadow-sm flex flex-col gap-3 h-full">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-sm font-bold">
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V7h2v2z"/></svg>
              </div>
              <span className="font-bold text-blue-950 text-sm">AI Academic Insights</span>
            </div>
            <div className="flex flex-col gap-4">
              <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                <div className="text-[10px] text-blue-600 font-bold tracking-wide uppercase mb-2 line-clamp-1">Trend Analysis</div>
                <div className="text-xs leading-relaxed text-slate-700 font-medium">More data is required to provide trend analysis. Begin adding scores in the Task Ledger.</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                <div className="text-[10px] text-blue-600 font-bold tracking-wide uppercase mb-2 line-clamp-1">Auto-Grading Alert</div>
                <div className="text-xs leading-relaxed text-slate-700 font-medium">Task scoring system is initialized. Complete your subject setup to receive alerts.</div>
              </div>
            </div>
          </div>
      </div>

      {/* Performance Quadrant Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Excellence Zone */}
        <div className="bg-white rounded-xl border border-emerald-100 p-5 shadow-sm flex items-center space-x-4">
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
             <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">Excellence Zone (≥80%)</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{quadrants.excellence}</div>
          </div>
        </div>
        
        {/* Satisfactory Zone */}
        <div className="bg-white rounded-xl border border-blue-100 p-5 shadow-sm flex items-center space-x-4">
          <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
             <BarChart2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">Satisfactory Zone (60-79%)</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{quadrants.satisfactory}</div>
          </div>
        </div>
        
        {/* Progress Needed */}
        <div className="bg-white rounded-xl border border-amber-100 p-5 shadow-sm flex items-center space-x-4">
          <div className="bg-amber-50 text-amber-600 p-3 rounded-xl">
             <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">Progress Needed (40-59%)</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{quadrants.progress}</div>
          </div>
        </div>

        {/* Critical Alert Zone */}
        <div className="bg-white rounded-xl border border-rose-100 p-5 shadow-sm flex items-center space-x-4">
          <div className="bg-rose-50 text-rose-600 p-3 rounded-xl">
             <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">Critical Alert Zone (&lt;40%)</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{quadrants.critical}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm p-6">
         <div className="flex items-center space-x-2 mb-6">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-lg">Performance Risk Quadrant Categorization Map</h3>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="border border-emerald-100 bg-emerald-50/30 rounded-lg p-4">
               <div className="text-xs font-bold text-emerald-700 tracking-wide uppercase mb-3 text-center">Green Zone</div>
               <p className="text-xs text-slate-500 text-center leading-relaxed">Students exceeding academic benchmarks.</p>
            </div>
            <div className="border border-blue-100 bg-blue-50/30 rounded-lg p-4">
               <div className="text-xs font-bold text-blue-700 tracking-wide uppercase mb-3 text-center">Blue Zone</div>
               <p className="text-xs text-slate-500 text-center leading-relaxed">Students meeting satisfactory benchmarks.</p>
            </div>
            <div className="border border-amber-100 bg-amber-50/30 rounded-lg p-4">
               <div className="text-xs font-bold text-amber-700 tracking-wide uppercase mb-3 text-center">Yellow Zone</div>
               <p className="text-xs text-slate-500 text-center leading-relaxed">Intervention strategies recommended.</p>
            </div>
            <div className="border border-rose-100 bg-rose-50/30 rounded-lg p-4">
               <div className="text-xs font-bold text-rose-700 tracking-wide uppercase mb-3 text-center">Red Zone</div>
               <p className="text-xs text-slate-500 text-center leading-relaxed">Immediate remedial support required.</p>
            </div>
         </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-2">
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 rounded-xl p-5 shadow-sm col-span-1 lg:col-span-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="font-bold text-indigo-900 text-sm block mb-1">Total System Data Load</span>
              <p className="text-xs text-indigo-700/80 font-medium">Mapped Subjects: {stats.subjects} &nbsp;&bull;&nbsp; Active Graded Tasks: {stats.tasks} &nbsp;&bull;&nbsp; Registered Profiles: {stats.students}</p>
            </div>
            <div className="bg-white/60 px-4 py-2 rounded-lg border border-indigo-100/50 shadow-sm text-xs font-bold text-indigo-800">
               Live Connected Data
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
