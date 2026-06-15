import React, { useState, useEffect } from "react";
import { db } from "../lib/firebaseClient";
import { collection, onSnapshot, query, where, doc } from "firebase/firestore";
import { handleFirestoreError, OperationType } from "../lib/firebaseUtils";
import { useAuth } from "../lib/AuthContext";

export default function ReportsPage() {
  const { user } = useAuth();
  const [reportText, setReportText] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);

  const [subjects, setSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);

  const [activeSubject, setActiveSubject] = useState("");
  const [activeGradeLevel, setActiveGradeLevel] = useState("All");
  const [activeSection, setActiveSection] = useState("All");
  const [config, setConfig] = useState<any>({ grades: [], sections: [] });

  const isAdmin = user?.appRole === "admin";
  const permittedSubjects = isAdmin 
    ? subjects 
    : subjects.filter(s => (s.assignments || []).some((a: any) => a.teacherEmail === user?.email));

  useEffect(() => {
    const unsubSubj = onSnapshot(collection(db, "subjects"), (snap) => {
      setSubjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => handleFirestoreError(err, OperationType.LIST, "subjects"));

    const unsubStudents = onSnapshot(collection(db, "students"), (snap) => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a:any, b:any) => a.name.localeCompare(b.name)));
    }, err => handleFirestoreError(err, OperationType.LIST, "students"));

    const unsubConfig = onSnapshot(doc(db, "settings", "schoolConfig"), snap => {
      if(snap.exists()) setConfig(snap.data());
    }, err => handleFirestoreError(err, OperationType.LIST, "settings"));

    return () => { unsubSubj(); unsubStudents(); unsubConfig(); };
  }, []);

  useEffect(() => {
    if(!activeSubject) return;
    const qTasks = query(collection(db, "tasks"), where("subjectId", "==", activeSubject));
    const unsubTasks = onSnapshot(qTasks, (snap) => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qScores = query(collection(db, "scores"), where("subjectId", "==", activeSubject));
    const unsubScores = onSnapshot(qScores, (snap) => setTasks(t => {
       setScores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
       return t;
    }));

    return () => { unsubTasks(); unsubScores(); };
  }, [activeSubject]);

  const handleGenerateAI = async () => {
    setLoadingAI(true);
    try {
      const subjectObj = subjects.find(s => s.id === activeSubject);
      const subjectName = subjectObj ? subjectObj.name : "All Subjects";
      
      const computedData = students.map(st => {
         if (subjectObj?.type === "eca") {
             const grades = subjectObj.ecaCriteria?.map((c:string) => {
                 const s = scores.find(x => x.taskId === c && x.studentId === st.id);
                 return `${c}: ${s?.score || '-'}`;
             }).join(", ");
             return `${st.name}: [${grades}]`;
         } else {
             let ob = 0; let tot = 0;
             tasks.forEach(t => {
                const sc = scores.find(s => s.taskId === t.id && s.studentId === st.id);
                if(sc && typeof sc.score === 'number') {
                   ob += sc.score;
                   tot += t.maxMarks;
                }
             });
             return `${st.name}: ${tot > 0 ? ((ob/tot)*100).toFixed(1) : 0}%`;
         }
      }).slice(0, 10).join("\n"); // Sample for AI

      const res = await fetch("/api/ai/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subjectName,
          classData: computedData || "No data available."
        })
      });
      const data = await res.json();
      setReportText(data.text);
    } catch(err) {
      console.error(err);
      setReportText("Failed to generate report.");
    }
    setLoadingAI(false);
  }

  const activeSubjectData = subjects.find(s => s.id === activeSubject);
  const isEca = activeSubjectData?.type === "eca";

  const getGPA = (perc: number) => {
     if(perc >= 90) return "A+";
     if(perc >= 80) return "A";
     if(perc >= 70) return "B+";
     if(perc >= 60) return "B";
     if(perc >= 50) return "C+";
     if(perc >= 40) return "C";
     if(perc > 0) return "NG";
     return "-";
  }

  const filteredStudents = students.filter(s => {
    if (isEca && (!s.ecaSports || !s.ecaSports.includes(activeSubject))) return false;
    return (activeSection === "All" || s.section === activeSection) &&
           (activeGradeLevel === "All" || s.gradeLevel === activeGradeLevel);
  });
  let allowedGrades = Array.from(new Set([
     ...((config.gradeMappings || []).map((g: any) => g.grade)),
     ...students.map(s => s.gradeLevel).filter(Boolean)
  ]));

  let baseSections = activeGradeLevel === "All"
    ? (config.gradeMappings || []).flatMap((g: any) => g.sections)
    : ((config.gradeMappings || []).find((g: any) => g.grade === activeGradeLevel)?.sections || []);
    
  let allowedSections = Array.from(new Set([
     ...baseSections,
     ...students.filter(s => activeGradeLevel === "All" || s.gradeLevel === activeGradeLevel).map(s => s.section).filter(Boolean)
  ]));

  const uniqueGrades = ["All", ...allowedGrades];
  const uniqueSections = ["All", ...allowedSections];

  return (
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div>
             <h2 className="text-xl font-bold text-slate-900 tracking-tight">CDC Reports & Predictive Insights</h2>
           </div>
           
           <div className="flex gap-2 flex-wrap">
             <select value={activeGradeLevel} onChange={e => {setActiveGradeLevel(e.target.value); setActiveSection("All");}} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                 {uniqueGrades.map(g => <option key={g} value={g as string}>{g === "All" ? "All Grades" : g}</option>)}
             </select>
             <select value={activeSubject} onChange={e => setActiveSubject(e.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                 <option value="">-- Select Subject --</option>
                 {permittedSubjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.type})</option>)}
             </select>
             <select value={activeSection} onChange={e => setActiveSection(e.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                 {uniqueSections.map(s => <option key={s} value={s as string}>{s === "All" ? "All Sections" : s}</option>)}
             </select>
             <button onClick={handleGenerateAI} disabled={!activeSubject} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 transition-colors text-white px-4 py-2 text-sm font-semibold rounded-lg flex items-center space-x-2 shadow-sm">
               <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0l-7.59 7.59z"></path></svg>
               <span>Generate AI Insights</span>
             </button>
           </div>
       </div>
       
       {loadingAI && <div className="p-4 bg-slate-50 border border-slate-200 text-center rounded-xl animate-pulse text-blue-600 font-medium text-sm">Analyzing class patterns...</div>}
       {reportText && (
         <div className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 text-blue-900 rounded-xl whitespace-pre-wrap font-medium text-[13px] shadow-sm leading-relaxed">
           {reportText}
         </div>
       )}

       {!activeSubject ? (
         <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col justify-center items-center p-12 text-center min-h-[50vh]">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
               <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
            <h3 className="text-slate-800 font-bold mb-2">CDC Format Gradebook</h3>
            <p className="text-sm font-medium text-slate-400 max-w-sm">
              Please select a subject to build and view the computed gradebook.
            </p>
         </div>
       ) : (
         <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead className="bg-[#F8FAFC] border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                 <tr>
                    <th className="px-4 py-3 border-r border-slate-200 min-w-[150px]">Student ID</th>
                    <th className="px-4 py-3 border-r border-slate-200">Name</th>
                    <th className="px-4 py-3 border-r border-slate-200 text-center">Section</th>
                    {isEca ? (
                       <th colSpan={3} className="px-4 py-3 border-r border-slate-200 text-left">ECA Criteria Grades</th>
                    ) : (
                       <>
                         <th className="px-4 py-3 border-r border-slate-200 text-right">Obtained / Total</th>
                         <th className="px-4 py-3 border-r border-slate-200 text-right">Percentage</th>
                         <th className="px-4 py-3 text-center">Final Grade</th>
                       </>
                    )}
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                 {filteredStudents.map(st => {
                    if (isEca) {
                        const grades = activeSubjectData?.ecaCriteria?.map((c:string) => {
                           const s = scores.find(x => x.taskId === c && x.studentId === st.id);
                           return `${c}: ${s?.score || '-'}`;
                        }).join(" • ") || "No criteria defined.";
                        return (
                          <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                             <td className="px-4 py-2 border-r border-slate-200 font-mono text-[10px] text-slate-400">{st.id.slice(0,8)}</td>
                             <td className="px-4 py-2 border-r border-slate-200 font-medium text-slate-900">{st.name}</td>
                             <td className="px-4 py-2 border-r border-slate-200 text-center text-slate-500">{st.section}</td>
                             <td colSpan={3} className="px-4 py-2 text-slate-600 text-xs font-medium space-x-2">{grades}</td>
                          </tr>
                        );
                    } else {
                        let obtained = 0;
                        let maxToT = 0;
                        tasks.forEach(t => {
                           const s = scores.find(x => x.taskId === t.id && x.studentId === st.id);
                           if(s && typeof s.score === 'number') {
                             obtained += s.score;
                             maxToT += t.maxMarks;
                           }
                        });
                        const perc = maxToT > 0 ? (obtained / maxToT) * 100 : 0;
                        return (
                          <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                             <td className="px-4 py-2 border-r border-slate-200 font-mono text-[10px] text-slate-400">{st.id.slice(0,8)}</td>
                             <td className="px-4 py-2 border-r border-slate-200 font-medium text-slate-900">{st.name}</td>
                             <td className="px-4 py-2 border-r border-slate-200 text-center text-slate-500">{st.section}</td>
                             <td className="px-4 py-2 border-r border-slate-200 text-right font-medium">{obtained.toFixed(1)} <span className="text-slate-400 font-normal text-xs">/ {maxToT}</span></td>
                             <td className="px-4 py-2 border-r border-slate-200 text-right font-bold text-slate-800">{maxToT > 0 ? `${perc.toFixed(2)}%` : '-'}</td>
                             <td className="px-4 py-2 text-center text-blue-600 font-black">{getGPA(perc)}</td>
                          </tr>
                        );
                    }
                 })}
                 {filteredStudents.length === 0 && (
                   <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No students available for this view.</td></tr>
                 )}
              </tbody>
            </table>
         </div>
       )}
    </div>
  );
}
