import React, { useState, useEffect } from "react";
import { collection, query, onSnapshot, where } from "firebase/firestore";
import { db } from "../lib/firebaseClient";
import { BookOpen, Search, User as UserIcon, Star, Target, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function StudentPortal() {
  const [students, setStudents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<string, any>>({});
  
  const [searchCode, setSearchCode] = useState("");
  const [searchName, setSearchName] = useState("");
  const [foundStudent, setFoundStudent] = useState<any>(null);

  // Background fetch all needed data for readonly view
  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, "students"), snap => {
       setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubTasks = onSnapshot(collection(db, "tasks"), snap => {
       setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubScores = onSnapshot(collection(db, "scores"), snap => {
       const scoreMap: any = {};
       snap.docs.forEach(d => {
         const data = d.data();
         scoreMap[`${data.studentId}_${data.taskId}`] = { id: d.id, ...data };
       });
       setScores(scoreMap);
    });
    return () => { unsubStudents(); unsubTasks(); unsubScores(); };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchCode.trim() && !searchName.trim()) return;

    const queryName = searchName.toLowerCase().trim();
    const queryCode = searchCode.toLowerCase().trim();

    const student = students.find(s => {
       const currCode = String(s.studentCode || "").toLowerCase().trim();
       const currName = String(s.name || "").toLowerCase().trim();
       
       if (queryCode && queryName) {
          return currCode === queryCode && currName.includes(queryName);
       } else if (queryCode) {
          return currCode === queryCode;
       } else if (queryName) {
          return currName.includes(queryName);
       }
       return false;
    });

    setFoundStudent(student || "not_found");
  };

  const getStudentStats = (studentId: string) => {
    let totalObtained = 0;
    let totalMax = 0;
    
    tasks.forEach(tk => {
      const isTarget = activeFilter === "All" ? true : tk.subjectId === activeFilter;
      if (!isTarget) return;

      const sc = scores[`${studentId}_${tk.id}`];
      if (sc && Number(sc.score) > 0) {
         totalObtained += Number(sc.score);
         totalMax += Number(tk.maxMarks || 0);
      }
    });

    const percentage = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(1) : "0.0";
    return { percentage, totalObtained, totalMax };
  };

  const [activeFilter, setActiveFilter] = useState("All");

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-800 font-sans p-4 sm:p-8 flex flex-col items-center">
      
      {/* Header */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-8 md:mb-12">
         <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30 text-white font-black text-xl">
               RG
            </div>
            <div>
               <h1 className="font-bold text-slate-900 text-xl md:text-2xl tracking-tight leading-none">Student Portal</h1>
               <p className="text-sm font-medium text-slate-500">Public academic access view</p>
            </div>
         </div>
         <Link to="/login" className="px-5 py-2.5 rounded-full bg-white text-slate-700 font-semibold text-sm border border-slate-200 hover:bg-slate-50 transition-all shadow-sm">
           Staff Login
         </Link>
      </div>

      {/* Main Search Panel */}
      {!foundStudent || foundStudent === "not_found" ? (
         <div className="w-full max-w-xl bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col mt-4">
            <div className="mb-8 text-center">
               <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <UserIcon className="w-8 h-8" />
               </div>
               <h2 className="text-2xl font-bold text-slate-900 mb-2">Check Your Progress</h2>
               <p className="text-slate-500">Enter your Student Code and Name to securely access your real-time academic portfolio.</p>
            </div>
            
            <form onSubmit={handleSearch} className="space-y-4 flex flex-col">
               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">Student Code</label>
                  <input type="text" value={searchCode} onChange={e => setSearchCode(e.target.value)}
                         placeholder="e.g. RG-24-001" className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800" />
               </div>
               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">First Name or Full Name</label>
                  <input type="text" value={searchName} onChange={e => setSearchName(e.target.value)}
                         placeholder="e.g. John Doe" className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800" />
               </div>
               {foundStudent === "not_found" && (
                 <div className="bg-red-50 text-red-600 font-semibold p-4 rounded-xl text-sm text-center border border-red-100 mt-2">
                   No student found matching these details. Please try again.
                 </div>
               )}
               <button type="submit" disabled={!searchCode && !searchName}
                       className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl transition-all shadow-md shadow-indigo-600/20 text-lg flex items-center justify-center">
                   <Search className="w-5 h-5 mr-3" />
                   View Portfolio
               </button>
            </form>
         </div>
      ) : (
         /* Found Student Details */
         <div className="w-full max-w-4xl space-y-6">
            <button onClick={() => setFoundStudent(null)} className="text-sm font-bold text-slate-500 hover:text-slate-800 flex items-center bg-white px-4 py-2 rounded-full shadow-sm w-fit">
              &larr; Back to Search
            </button>
            
            {/* Profile Overview */}
            <div className="bg-white rounded-[32px] p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start md:justify-between shadow-sm border border-slate-100">
               <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center text-3xl font-black shadow-lg">
                    {foundStudent.name?.charAt(0)}
                  </div>
                  <div className="text-center md:text-left">
                     <h2 className="text-3xl font-black text-slate-900 tracking-tight">{foundStudent.name}</h2>
                     <p className="text-lg font-medium text-slate-500 mt-1">{foundStudent.studentCode} • Grade {foundStudent.gradeLevel} • Section {foundStudent.section}</p>
                  </div>
               </div>
               
               <div className="mt-6 md:mt-0 flex gap-4">
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 flex flex-col items-center min-w[120px]">
                     <span className="text-sm font-bold text-slate-400 mb-1">Overall</span>
                     <span className="text-2xl font-black text-slate-900">{getStudentStats(foundStudent.id).percentage}%</span>
                  </div>
               </div>
            </div>

            {/* Task Breakdowns */}
            <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 overflow-hidden">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-xl font-bold text-slate-900">Recent Assignments</h3>
                </div>
                
                <div className="space-y-3">
                   {tasks.filter(tk => {
                      if (tk.gradeLevel && tk.gradeLevel !== foundStudent.gradeLevel) return false;
                      if (tk.section && tk.section !== "All" && tk.section !== foundStudent.section) return false;
                      return true;
                   }).length === 0 ? (
                      <div className="text-center py-12 text-slate-500 font-medium">No recorded assignments yet.</div>
                   ) : (
                      tasks.filter(tk => {
                          if (tk.gradeLevel && tk.gradeLevel !== foundStudent.gradeLevel) return false;
                          if (tk.section && tk.section !== "All" && tk.section !== foundStudent.section) return false;
                          return true;
                      }).slice(0, 15).map(tk => {
                         const sc = scores[`${foundStudent.id}_${tk.id}`];
                         const mark = sc ? Number(sc.score) : null;
                         const isGraded = mark !== null;
                         
                         return (
                            <div key={tk.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                               <div className="flex items-center space-x-4 mb-3 md:mb-0">
                                  <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-slate-400 shrink-0 border border-slate-200">
                                      <BookOpen className="w-5 h-5" />
                                  </div>
                                  <div>
                                     <h4 className="font-bold text-slate-900 text-[15px]">{tk.name}</h4>
                                     <div className="flex items-center text-xs font-semibold text-slate-500 space-x-2 mt-0.5">
                                        <span className="uppercase tracking-wider">{tk.subjectName || tk.subjectId}</span>
                                        <span>•</span>
                                        <span>{tk.taskType}</span>
                                        <span>•</span>
                                        <span>{new Date(tk.date || tk.createdAt).toLocaleDateString()}</span>
                                     </div>
                                  </div>
                               </div>
                               
                               <div className="flex items-center space-x-3 ml-16 md:ml-0">
                                   {isGraded ? (
                                      <div className="px-4 py-2 bg-green-50 text-green-700 font-bold rounded-xl text-sm flex items-center border border-green-100">
                                         <CheckCircle2 className="w-4 h-4 mr-2" />
                                         {mark} / {tk.maxMarks}
                                      </div>
                                   ) : (
                                      <div className="px-4 py-2 bg-slate-100 text-slate-500 font-bold rounded-xl text-sm border border-slate-200">
                                         Pending Grading
                                      </div>
                                   )}
                               </div>
                            </div>
                         )
                      })
                   )}
                </div>
            </div>

         </div>
      )}
    </div>
  )
}
