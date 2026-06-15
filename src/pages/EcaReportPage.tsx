import React, { useState, useEffect } from "react";
import { db } from "../lib/firebaseClient";
import { collection, onSnapshot, doc } from "firebase/firestore";
import { handleFirestoreError, OperationType } from "../lib/firebaseUtils";
import { useAuth } from "../lib/AuthContext";

export default function EcaReportPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({ grades: [], sections: [] });
  
  const [activeGradeLevel, setActiveGradeLevel] = useState("All");
  const [activeSection, setActiveSection] = useState("All");

  const isAdmin = user?.appRole === "admin";
  const permittedSubjects = isAdmin 
    ? subjects 
    : subjects.filter(s => (s.assignments || []).some((a: any) => a.teacherEmail === user?.email));

  useEffect(() => {
    const unsubSubj = onSnapshot(collection(db, "subjects"), (snap) => {
      setSubjects(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter(s => s.type === "eca"));
    }, err => handleFirestoreError(err, OperationType.LIST, "subjects"));

    const unsubStudents = onSnapshot(collection(db, "students"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      data.sort((a,b) => a.name.localeCompare(b.name));
      setStudents(data);
    }, err => handleFirestoreError(err, OperationType.LIST, "students"));

    const unsubScores = onSnapshot(collection(db, "scores"), (snap) => {
      setScores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => handleFirestoreError(err, OperationType.LIST, "scores"));

    const unsubConfig = onSnapshot(doc(db, "settings", "schoolConfig"), snap => {
      if(snap.exists()) setConfig(snap.data());
    }, err => handleFirestoreError(err, OperationType.LIST, "settings"));

    return () => {
       unsubSubj();
       unsubStudents();
       unsubScores();
       unsubConfig();
    };
  }, []);

  const filteredStudents = students.filter(s => {
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

  const renderEcaGrades = (student: any, ecaId: string | undefined) => {
    if (!ecaId) return <span className="text-slate-400 italic">None selected</span>;
    // Check if the current user has permission to see this subject
    const subj = permittedSubjects.find(s => s.id === ecaId);
    if (!subj) return <span className="text-slate-300 italic text-xs">No permissions or Unknown ({ecaId})</span>;
    if (!subj.ecaCriteria || subj.ecaCriteria.length === 0) return <span className="text-slate-500">{subj.name} (No criteria)</span>;
    
    return (
      <div className="flex flex-col space-y-1">
        <span className="font-bold text-[11px] uppercase tracking-wide text-blue-600 mb-1">{subj.name}</span>
        {subj.ecaCriteria.map((crit: string) => {
          const sc = scores.find(x => x.taskId === crit && x.studentId === student.id);
          return (
            <div key={crit} className="flex items-center justify-between text-xs">
               <span className="text-slate-600 truncate max-w-[150px]" title={crit}>{crit}</span>
               <span className="font-semibold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">{sc?.score || '-'}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
       <div className="flex flex-wrap items-center justify-between gap-4">
         <h2 className="text-xl font-bold text-slate-900 tracking-tight">ECA Cumulative Report</h2>
       </div>

       <div className="flex gap-2 flex-wrap">
         <select value={activeGradeLevel} onChange={e => {setActiveGradeLevel(e.target.value); setActiveSection("All");}} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
             {uniqueGrades.map(g => <option key={g} value={g as string}>{g === "All" ? "All Grades" : g}</option>)}
         </select>
         <select value={activeSection} onChange={e => setActiveSection(e.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
             {uniqueSections.map(s => <option key={s} value={s as string}>{s === "All" ? "All Sections" : s}</option>)}
         </select>
       </div>

       <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 text-xs tracking-wider uppercase">
               <tr>
                  <th className="px-4 py-3 border-r border-slate-200">Student Info</th>
                  <th className="px-4 py-3 border-r border-slate-200 w-[300px]">ECA Activity 1</th>
                  <th className="px-4 py-3 border-r border-slate-200 w-[300px]">ECA Activity 2</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
               {filteredStudents.map(st => (
                 <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 border-r border-slate-200 align-top">
                      <div className="font-bold text-slate-900 text-base">{st.name}</div>
                      <div className="text-slate-500 text-xs mt-1">Grade: {st.gradeLevel} | Sec: {st.section}</div>
                    </td>
                    <td className="px-4 py-3 border-r border-slate-200 align-top whitespace-normal">
                      {renderEcaGrades(st, st.ecaSports?.[0])}
                    </td>
                    <td className="px-4 py-3 border-r border-slate-200 align-top whitespace-normal">
                      {renderEcaGrades(st, st.ecaSports?.[1])}
                    </td>
                 </tr>
               ))}
               {filteredStudents.length === 0 && (
                 <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500">No students available for this view.</td></tr>
               )}
            </tbody>
          </table>
       </div>
    </div>
  );
}
