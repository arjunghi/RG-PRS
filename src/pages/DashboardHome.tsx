import React, { useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { db } from "../lib/firebaseClient";
import { collection, query, getDocs, onSnapshot } from "firebase/firestore";

export default function DashboardHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ subjects: 0, tasks: 0, students: 0 });

  useEffect(() => {
    // Quick load basic stats
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
  }, []);

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome back, {user?.displayName?.split(" ")[0] || "Educator"}</h2>
        <p className="text-sm font-medium text-slate-500 mt-1">Here's your high-level overview of the academic progress data.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { label: "Active Subjects", val: stats.subjects, sub: "Running term", subColor: "text-blue-500" },
          { label: "Total Students Mapped", val: stats.students, sub: "+12% vs last term", subColor: "text-green-500" },
          { label: "Total Assessment Tasks", val: stats.tasks, sub: "Pending grading", subColor: "text-amber-500" },
        ].map((m, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-1 shadow-sm">
             <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">{m.label}</span>
             <div className="flex items-baseline gap-2">
               <span className="text-2xl font-bold text-slate-900">{m.val}</span>
               <span className={`text-[11px] font-medium ${m.subColor}`}>{m.sub}</span>
             </div>
          </div>
        ))}
      </div>
      
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col justify-center items-center p-8 text-center min-h-[40vh]">
         <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
           <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
         </div>
         <h3 className="text-slate-800 font-bold mb-2">More dashboard analytics to load...</h3>
         <p className="text-sm font-medium text-slate-400 max-w-sm">
           Navigate to individual tabs on the left to track student ledgers, allocate marks, and leverage AI generated remark pipelines.
         </p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4 shadow-sm flex flex-col gap-3 h-full">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-blue-500 text-white p-1 rounded">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V7h2v2z"/></svg>
            </div>
            <span className="font-bold text-blue-900 text-sm">AI Academic Insights</span>
          </div>
          <div className="flex flex-col gap-3">
            <div className="bg-white p-3 rounded-lg border border-blue-200">
              <div className="text-[11px] text-blue-500 font-bold mb-1 tracking-wide uppercase">Trend Analysis</div>
              <div className="text-[13px] leading-relaxed text-blue-900">More data is required to provide trend analysis. Begin adding scores in the Task Ledger.</div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-blue-200">
              <div className="text-[11px] text-blue-500 font-bold mb-1 tracking-wide uppercase">Auto-Grading Alert</div>
              <div className="text-[13px] leading-relaxed text-blue-900">Task scoring system is initialized. Complete your subject setup to receive alerts.</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
