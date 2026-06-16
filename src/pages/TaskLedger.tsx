import React, { useState, useEffect } from "react";
import { db } from "../lib/firebaseClient";
import { collection, onSnapshot, addDoc, doc, setDoc, query, where, updateDoc, deleteDoc } from "firebase/firestore";
import { handleFirestoreError, OperationType } from "../lib/firebaseUtils";
import { useAuth } from "../lib/AuthContext";
import { triggerLiveSyncInBg } from "../lib/googleSheetsSync";

export default function TaskLedger() {
  const { user, accessToken } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<string, any>>({});
  
  const [activeGradeLevel, setActiveGradeLevel] = useState(() => localStorage.getItem("tl_grade") || "All");
  const [activeSubject, setActiveSubject] = useState(() => localStorage.getItem("tl_subj") || "");
  const [activeSection, setActiveSection] = useState(() => localStorage.getItem("tl_sec") || "All");

  useEffect(() => {
    localStorage.setItem("tl_grade", activeGradeLevel);
    localStorage.setItem("tl_subj", activeSubject);
    localStorage.setItem("tl_sec", activeSection);
  }, [activeGradeLevel, activeSubject, activeSection]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTask, setNewTask] = useState({ name: "", maxMarks: 10, taskType: "HW", term: "Spring", date: new Date().toISOString().split("T")[0] });
  const [config, setConfig] = useState<any>({ grades: [], sections: [] });

  const [pendingScores, setPendingScores] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const isTeacher = ["admin", "teacher", "eca_teacher"].includes(user?.appRole || "");
  const isAdmin = user?.appRole === "admin";

  const permittedSubjects = isAdmin 
    ? subjects 
    : subjects.filter(s => (s.assignments || []).some((a: any) => String(a.teacherEmail || "").toLowerCase().trim() === String(user?.email || "").toLowerCase().trim()));

  // Determine allowed grades and sections based on the selected subject's assignments
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
  
  if (!isAdmin && activeSubject) {
     const sub = subjects.find(s => s.id === activeSubject);
     if (sub) {
        const assigns = (sub.assignments || []).filter((a: any) => String(a.teacherEmail || "").toLowerCase().trim() === String(user?.email || "").toLowerCase().trim());
        const hasAllGrades = assigns.some((a: any) => a.gradeLevel === "All");
        const hasAllSections = assigns.some((a: any) => a.section === "All");
        if (!hasAllGrades) {
           allowedGrades = allowedGrades.filter(g => assigns.some((a: any) => a.gradeLevel === g));
        }
        if (!hasAllSections) {
           allowedSections = allowedSections.filter(sec => assigns.some((a: any) => a.section === sec));
        }
     }
  }
  
  const uniqueGrades = ["All", ...Array.from(new Set(allowedGrades))];
  const uniqueSections = ["All", ...Array.from(new Set(allowedSections))];

  useEffect(() => {
    const unsubSubj = onSnapshot(collection(db, "subjects"), (snap) => {
      setSubjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => handleFirestoreError(err, OperationType.LIST, "subjects"));

    const unsubStudents = onSnapshot(collection(db, "students"), (snap) => {
      const studs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.name.localeCompare(b.name));
      setStudents(studs);
    }, err => handleFirestoreError(err, OperationType.LIST, "students"));

    const unsubConfig = onSnapshot(doc(db, "settings", "schoolConfig"), snap => {
      if(snap.exists()) setConfig(snap.data());
    }, err => handleFirestoreError(err, OperationType.LIST, "settings"));

    return () => { unsubSubj(); unsubStudents(); unsubConfig(); };
  }, []);

  useEffect(() => {
    if(!activeSubject) return;
    const qTasks = query(collection(db, "tasks"), where("subjectId", "==", activeSubject));
    const unsubTasks = onSnapshot(qTasks, (snap) => {
      const t = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a:any, b:any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setTasks(t);
    }, err => handleFirestoreError(err, OperationType.LIST, "tasks"));

    const qScores = query(collection(db, "scores"), where("subjectId", "==", activeSubject));
    const unsubScores = onSnapshot(qScores, (snap) => {
      const sMap: Record<string, any> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        const key = `${data.studentId}_${data.taskId}`;
        sMap[key] = { id: d.id, ...data };
      });
      setScores(sMap);
    }, err => handleFirestoreError(err, OperationType.LIST, "scores"));

    return () => { unsubTasks(); unsubScores(); };
  }, [activeSubject]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!isTeacher) return alert("Must be teacher or admin.");
    if(!activeSubject) return alert("Select a subject first.");
    
    try {
      await addDoc(collection(db, "tasks"), {
        ...newTask,
        subjectId: activeSubject,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setShowTaskForm(false);
      setNewTask({ name: "", maxMarks: 10, taskType: "HW", term: "Spring", date: new Date().toISOString().split("T")[0] });
      triggerLiveSyncInBg(accessToken, config.googleSpreadsheetId);
    } catch(err) {
      handleFirestoreError(err, OperationType.CREATE, "tasks");
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if(!isTeacher) return;
    if(!confirm("Are you sure you want to delete this task? All associated scores will be lost.")) return;
    try {
      await deleteDoc(doc(db, "tasks", taskId));
    } catch(err) {
      handleFirestoreError(err, OperationType.DELETE, "tasks");
    }
  }

  const handlePendingScoreChange = (studentId: string, taskId: string, val: string) => {
    const key = `${studentId}_${taskId}`;
    setPendingScores(prev => ({ ...prev, [key]: val }));
  }

  const handleSavePendingScores = async () => {
    if(!isTeacher) return;
    setIsSaving(true);
    const isEca = subjects.find(s => s.id === activeSubject)?.type === "eca";

    try {
      const promises = Object.entries(pendingScores).map(async ([key, val]: [string, string]) => {
        const [studentId, taskId] = key.split("_");
        const existing = scores[key];

        if (val.trim() === "") {
          if (existing) {
             return deleteDoc(doc(db, "scores", existing.id));
          }
          return;
        }

        const scoreVal = isEca ? val.toUpperCase() : (val.toUpperCase() === "NA" ? "NA" : Number(val));

        if (existing) {
          if (String(existing.score) !== String(scoreVal)) {
             return updateDoc(doc(db, "scores", existing.id), { score: scoreVal, updatedAt: new Date().toISOString() });
          }
        } else {
          return addDoc(collection(db, "scores"), {
            studentId,
            taskId,
            subjectId: activeSubject,
            score: scoreVal,
            updatedAt: new Date().toISOString()
          });
        }
      });
      
      await Promise.all(promises);
      setPendingScores({});
      triggerLiveSyncInBg(accessToken, config.googleSpreadsheetId);
      alert("Scores saved successfully.");
    } catch(err) {
      handleFirestoreError(err, OperationType.WRITE, "scores");
    } finally {
      setIsSaving(false);
    }
  }

  const activeSubjectData = subjects.find(s => s.id === activeSubject);
  const activeTasks = activeSubjectData?.type === "eca" ? (activeSubjectData.ecaCriteria || []).map((c: string) => ({ id: c, name: c, maxMarks: "Grade", taskType: "ECA" })) : tasks;

  const filteredStudents = students.filter(s => {
    if (activeSubjectData?.type === "eca" && (!s.ecaSports || !s.ecaSports.includes(activeSubject))) return false;
    return (activeSection === "All" || s.section === activeSection) &&
           (activeGradeLevel === "All" || s.gradeLevel === activeGradeLevel);
  });
  const studentSections = Array.from(new Set(students.map(s => s.section).filter(Boolean)));
  const studentGrades = Array.from(new Set(students.map(s => s.gradeLevel).filter(Boolean)));

  return (
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <h2 className="text-xl font-bold text-slate-900 tracking-tight">Task Ledger</h2>
         <div className="flex gap-2 flex-wrap">
            <select value={activeGradeLevel} onChange={e => {setActiveGradeLevel(e.target.value); setActiveSection("All");}} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
               {uniqueGrades.map(g => <option key={g} value={g as string}>{g === "All" ? "All Grades" : g}</option>)}
            </select>
            <select value={activeSubject} onChange={e => setActiveSubject(e.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
               <option value="">-- Select Subject --</option>
               {permittedSubjects.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.type})</option>)}
            </select>
            <select value={activeSection} onChange={e => setActiveSection(e.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
               {uniqueSections.map(s => <option key={s} value={s as string}>{s === "All" ? "All Sections" : s}</option>)}
            </select>
            {activeSubjectData?.type !== "eca" && (
              <button onClick={() => setShowTaskForm(!showTaskForm)} className="bg-blue-600 hover:bg-blue-700 transition-colors text-white px-4 py-2 text-sm font-semibold rounded-lg shadow-sm">
                 + Quick Entry
               </button>
            )}
            {isTeacher && Object.keys(pendingScores).length > 0 && (
              <button onClick={handleSavePendingScores} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 transition-colors text-white px-4 py-2 text-sm font-semibold rounded-lg shadow-sm border border-emerald-700">
                 {isSaving ? "Saving..." : "Save Changes"}
              </button>
            )}
         </div>
       </div>

       {showTaskForm && activeSubjectData?.type !== "eca" && (
         <form onSubmit={handleCreateTask} className="bg-white p-5 border border-slate-200 rounded-xl shadow-sm flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Task Name</label>
              <input required list="task-suggestions" value={newTask.name} onChange={e => setNewTask({...newTask, name: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"/>
              <datalist id="task-suggestions">
                {subjects.find(s => s.id === activeSubject)?.type === "eca" && 
                 subjects.find(s => s.id === activeSubject)?.ecaCriteria?.map((c: string) => <option key={c} value={c} />)
                }
              </datalist>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Type</label>
              <select value={newTask.taskType} onChange={e => setNewTask({...newTask, taskType: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                <option value="HW">Homework</option>
                <option value="CW">Classwork</option>
                <option value="PRACTICAL">Practical</option>
                <option value="PROJECT WORK">Project Work</option>
                <option value="UT">Unit Test</option>
                <option value="ATT">Attendance</option>
                <option value="DISCIPLINE">Discipline</option>
                <option value="PARENTAL EVALUATION">Parental Eval</option>
                <option value="EVALUATION">Evaluation (ECA)</option>
                <option value="WRITTEN EXAM">Written Exam</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Term</label>
              <select value={newTask.term} onChange={e => setNewTask({...newTask, term: e.target.value})} className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                <option value="Spring">Spring</option>
                <option value="Fall">Fall</option>
                <option value="Final">Final</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Max Marks</label>
              <input type="number" required value={newTask.maxMarks} onChange={e => setNewTask({...newTask, maxMarks: Number(e.target.value)})} className="w-16 border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Task Date</label>
              <input type="date" required value={newTask.date} onChange={e => setNewTask({...newTask, date: e.target.value})} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <button type="submit" className="bg-slate-900 text-white font-semibold text-sm px-4 py-1.5 rounded-lg hover:bg-black">Create Task</button>
         </form>
       )}
       
       {!activeSubject || activeGradeLevel === "All" ? (
         <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col justify-center items-center p-12 text-center min-h-[50vh]">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
               <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <h3 className="text-slate-800 font-bold mb-2">Data Grid Ledger</h3>
            <p className="text-sm font-medium text-slate-400 max-w-sm">
              Please select a specific grade and subject to view the editable matrix to track individual tasks and scores per subject.
            </p>
         </div>
       ) : (
         <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-[13px] whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0 z-10 font-semibold">
                 <tr>
                    <th className="px-4 py-3 border-r border-slate-200 sticky left-0 bg-slate-50 z-20 min-w-[200px] shadow-[1px_0_0_#e2e8f0]">Student Name</th>
                    <th className="px-3 py-3 border-r border-slate-200 sticky left-[200px] bg-slate-50 z-20 text-center shadow-[1px_0_0_#e2e8f0]">Sec</th>
                    {activeTasks.map((t: any) => (
                      <th key={t.id} className="px-3 py-2 border-r border-slate-200 text-center min-w-[100px] bg-slate-50 group hover:bg-slate-100 transition-colors">
                         <div className="flex flex-col relative items-center justify-center">
                           <span className="font-bold text-slate-800 text-[11px] truncate w-24 mx-auto" title={t.name}>{t.name}</span>
                           <span className="text-[10px] text-blue-600 font-bold uppercase">{t.taskType} ({t.maxMarks})</span>
                           {activeSubjectData?.type !== "eca" && isTeacher && (
                             <button onClick={() => handleDeleteTask(t.id)} className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all p-1" title="Delete Task">
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                 <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                               </svg>
                             </button>
                           )}
                         </div>
                      </th>
                    ))}
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                 {filteredStudents.map(st => (
                   <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2 border-r border-slate-200 sticky left-0 bg-white z-10 font-medium shadow-[1px_0_0_#e2e8f0] group-hover:bg-slate-50">{st.name}</td>
                      <td className="px-3 py-2 border-r border-slate-200 sticky left-[200px] bg-white z-10 text-center text-slate-400 shadow-[1px_0_0_#e2e8f0] group-hover:bg-slate-50">{st.section}</td>
                      {activeTasks.map((t: any) => {
                        const key = `${st.id}_${t.id}`;
                        const scoreData = scores[key];
                        const displayedScore = pendingScores[key] !== undefined ? pendingScores[key] : (scoreData?.score ?? "");
                        return (
                          <td key={t.id} className={`px-3 py-1.5 border-r border-slate-100 ${pendingScores[key] !== undefined ? "bg-amber-50" : ""}`}>
                             {activeSubjectData?.type === "eca" ? (
                               <select 
                                 value={displayedScore}
                                 onChange={(e) => handlePendingScoreChange(st.id, t.id, e.target.value)}
                                 className="w-full bg-transparent text-center outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 rounded py-1 px-2 border border-transparent hover:border-slate-300 transition-colors appearance-none cursor-pointer font-bold text-slate-700"
                                 disabled={!isTeacher}
                               >
                                 <option value="" disabled>-</option>
                                 <option value="A+">A+</option>
                                 <option value="A">A</option>
                                 <option value="B+">B+</option>
                                 <option value="B">B</option>
                                 <option value="C+">C+</option>
                                 <option value="C">C</option>
                               </select>
                             ) : (
                               <input 
                                 type="text"
                                 value={displayedScore}
                                 onChange={(e) => handlePendingScoreChange(st.id, t.id, e.target.value)}
                                 className="w-full bg-transparent text-center outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 rounded py-1 px-2 border border-transparent hover:border-slate-300 transition-colors"
                                 placeholder="-"
                                 disabled={!isTeacher}
                               />
                             )}
                          </td>
                        )
                      })}
                   </tr>
                 ))}
                 {filteredStudents.length === 0 && (
                   <tr><td colSpan={activeTasks.length + 2} className="px-4 py-8 text-center text-slate-500">No students available in this view.</td></tr>
                 )}
              </tbody>
            </table>
         </div>
       )}
    </div>
  );
}
