import React, { useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { db } from "../lib/firebaseClient";
import { collection, onSnapshot } from "firebase/firestore";
import { ShieldCheck, BarChart2, AlertTriangle, AlertCircle, TrendingUp } from "lucide-react";

export default function DashboardHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ subjects: 0, tasks: 0, students: 0 });
  const [quadrants, setQuadrants] = useState({ excellence: 0, satisfactory: 0, progress: 0, critical: 0 });

  useEffect(() => {
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

  useEffect(() => {
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
  }, []);

  return (
    <div className="space-y-8">
      <header className="mb-2">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome back, {user?.displayName?.split(" ")[0] || "Educator"}</h2>
        <p className="text-sm font-medium text-slate-500 mt-1">Here's your high-level overview of the academic progress data.</p>
      </header>

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
