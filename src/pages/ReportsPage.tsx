import React, { useState, useEffect } from "react";
import { db } from "../lib/firebaseClient";
import { collection, onSnapshot, query, where, doc, setDoc } from "firebase/firestore";
import { handleFirestoreError, OperationType } from "../lib/firebaseUtils";
import { useAuth } from "../lib/AuthContext";
import { Settings as SettingsIcon, Save } from "lucide-react";

export default function ReportsPage() {
  const { user } = useAuth();
  const [reportText, setReportText] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);

  const [subjects, setSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);

  const [activeSubject, setActiveSubject] = useState(() => localStorage.getItem("rp_subj") || "");
  const [activeGradeLevel, setActiveGradeLevel] = useState(() => localStorage.getItem("rp_grade") || "All");
  const [activeSection, setActiveSection] = useState(() => localStorage.getItem("rp_sec") || "All");
  const [config, setConfig] = useState<any>({ grades: [], sections: [] });

  useEffect(() => {
    localStorage.setItem("rp_subj", activeSubject);
    localStorage.setItem("rp_grade", activeGradeLevel);
    localStorage.setItem("rp_sec", activeSection);
  }, [activeSubject, activeGradeLevel, activeSection]);

  // Marks Allocation state
  const [marksConfig, setMarksConfig] = useState({
    attWeight: 0,
    discipline: 0,
    practical: 0,
    project: 0,
    hwWeight: 0,
    cwWeight: 0,
    unitTest: 0,
    parentalEv: 0,
    pracBox: 0,
    writtenExam: 0,
  });
  const [isSavingMarks, setIsSavingMarks] = useState(false);

  const isAdmin = user?.appRole === "admin";
  const permittedSubjects = isAdmin 
    ? subjects 
    : subjects.filter(s => (s.assignments || []).some((a: any) => String(a.teacherEmail || "").toLowerCase().trim() === String(user?.email || "").toLowerCase().trim()));

  const partTotal = (Number(marksConfig.attWeight) || 0) + (Number(marksConfig.discipline) || 0);
  const pracTotal = (Number(marksConfig.practical) || 0) + (Number(marksConfig.project) || 0) + (Number(marksConfig.hwWeight) || 0) + (Number(marksConfig.cwWeight) || 0);
  const examTotal = (Number(marksConfig.unitTest) || 0) + (Number(marksConfig.parentalEv) || 0);
  const overallMax = (Number(marksConfig.pracBox) || 0) + (Number(marksConfig.writtenExam) || 0);

  useEffect(() => {
    const unsubSubj = onSnapshot(collection(db, "subjects"), (snap) => {
      setSubjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => handleFirestoreError(err, OperationType.LIST, "subjects"));

    const unsubStudents = onSnapshot(collection(db, "students"), (snap) => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a:any, b:any) => a.name.localeCompare(b.name)));
    }, err => handleFirestoreError(err, OperationType.LIST, "students"));

    const unsubConfig = onSnapshot(doc(db, "settings", "schoolConfig"), snap => {
      if(snap.exists()) {
        const data = snap.data();
        setConfig(data);
      }
    }, err => handleFirestoreError(err, OperationType.LIST, "settings"));

    return () => { unsubSubj(); unsubStudents(); unsubConfig(); };
  }, []);

  useEffect(() => {
    if (!config) return;
    const key = activeSubject ? `subjectMarks_${activeSubject}` : 'cdcMarksAllocation';
    const selectedAlloc = config[key] || config['cdcMarksAllocation'] || {
      attWeight: 0,
      discipline: 0,
      practical: 0,
      project: 0,
      hwWeight: 0,
      cwWeight: 0,
      unitTest: 0,
      parentalEv: 0,
      pracBox: 0,
      writtenExam: 0,
    };
    setMarksConfig(selectedAlloc);
  }, [activeSubject, config]);

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

  const handleSaveMarks = async () => {
    if(!isAdmin) return alert("Admin only action");
    setIsSavingMarks(true);
    try {
      const targetWeightConfig = {
        attWeight: Number(marksConfig.attWeight),
        discipline: Number(marksConfig.discipline),
        practical: Number(marksConfig.practical),
        project: Number(marksConfig.project),
        hwWeight: Number(marksConfig.hwWeight),
        cwWeight: Number(marksConfig.cwWeight),
        unitTest: Number(marksConfig.unitTest),
        parentalEv: Number(marksConfig.parentalEv),
        pracBox: Number(marksConfig.pracBox),
        writtenExam: Number(marksConfig.writtenExam),
      };

      const payload: any = {};
      
      if (activeSubject) {
        payload[`subjectMarks_${activeSubject}`] = targetWeightConfig;
        await setDoc(doc(db, "settings", "schoolConfig"), payload, { merge: true });
        alert(`CDC Marks Allocation saved specifically for "${activeSubjectData?.name || activeSubject}" (${activeSubjectData?.gradeLevel || 'General'})`);
      } else {
        payload.cdcMarksAllocation = targetWeightConfig;
        await setDoc(doc(db, "settings", "schoolConfig"), payload, { merge: true });
        alert("Overall Default CDC Marks Allocation saved successfully");
      }
    } catch(err) {
      console.error(err);
      alert("Failed to save marks");
    } finally {
      setIsSavingMarks(false);
    }
  };

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

  const handleDownloadCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    if (isEca) {
      csvContent += "SN,Name,Section,ECA Criteria Grades\n";
      filteredStudents.forEach((st, index) => {
        const grades = activeSubjectData?.ecaCriteria?.map((c:string) => {
           const s = scores.find(x => x.taskId === c && x.studentId === st.id);
           return s ? s.score : "N/A";
        }).join(" | ") || "No criteria defined";
        csvContent += `${index + 1},"${st.name}","${st.section}","${grades}"\n`;
      });
    } else {
      csvContent += "SN,Students Name,Sec,Attendance,Discipline,Part. Total,Practical,project,HW,CW,Prac. Total,UT,Parental Ev,Exam Total,Practical Final,Written,Overall Total\n";
      filteredStudents.forEach((st, index) => {
        let obtained = 0;
        let maxToT = 0;
        tasks.forEach(t => {
           const s = scores.find(x => x.taskId === t.id && x.studentId === st.id);
           if(s && !isNaN(Number(s.score))) {
             obtained += Number(s.score);
             maxToT += t.maxMarks;
           }
        });
        // We'll output 0 for placeholders right now as per the UI
        csvContent += `${index + 1},"${st.name}","${st.section}",0,0,0,0,0,0,0,0,0,0,0,${obtained.toFixed(1)},0,${obtained.toFixed(1)}\n`;
      });
    }
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `CDC_Report_${activeSubjectData?.name || 'Class'}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

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
             <button onClick={handleGenerateAI} disabled={!activeSubject} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 transition-colors text-white px-4 py-2 text-sm font-semibold rounded-lg flex items-center space-x-2 shadow-sm cursor-pointer">
               <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0l-7.59 7.59z"></path></svg>
               <span>Generate AI Insights</span>
             </button>
             <button onClick={handleDownloadCSV} disabled={!activeSubject || filteredStudents.length === 0} className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 transition-colors text-white px-4 py-2 text-sm font-semibold rounded-lg flex items-center space-x-2 shadow-sm cursor-pointer border border-emerald-700">
               <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
               <span>Download CSV</span>
             </button>
           </div>
       </div>

       {isAdmin && (
         <div className="bg-[#FFFDF7] border-l-4 border-amber-500 rounded-lg shadow-sm p-5 space-y-4">
           <div className="flex items-center text-amber-600 font-bold space-x-2">
             <SettingsIcon className="w-5 h-5" />
             <h3 className="uppercase text-sm tracking-wide">Gradesheet Marks Allocation</h3>
           </div>
           <p className="text-xs text-slate-600 leading-relaxed">
              {activeSubjectData ? (
                <span>
                  Currently configuring weights specifically for: <strong className="text-amber-800 font-black font-sans text-xs bg-amber-100/70 border border-amber-200 px-1.5 py-0.5 rounded">{String(activeSubjectData.name).toUpperCase()} ({String(activeSubjectData.gradeLevel || "General").toUpperCase()})</strong>.
                </span>
              ) : (
                <span>
                  No subject selected. Currently editing the <strong className="text-amber-800 font-bold">Overall Fallback Default config</strong>. Please select a specific subject in the top right to customize weights gradesheet-wise.
                </span>
              )}
            </p>
           
           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 pb-2 pt-2 items-end">
              <div>
                <label className="block text-[10px] text-center font-semibold text-slate-400 mb-1">ATT Weight</label>
                <input type="number" min="0" value={marksConfig.attWeight || ''} onChange={e => setMarksConfig(m => ({ ...m, attWeight: e.target.valueAsNumber || 0 }))} className="w-full text-center border border-slate-200 rounded px-2 py-1.5 text-sm outline-none focus:border-amber-400 focus:bg-amber-50" />
              </div>
              <div>
                <label className="block text-[10px] text-center font-semibold text-slate-400 mb-1">Discipline</label>
                <input type="number" min="0" value={marksConfig.discipline || ''} onChange={e => setMarksConfig(m => ({ ...m, discipline: e.target.valueAsNumber || 0 }))} className="w-full text-center border border-slate-200 rounded px-2 py-1.5 text-sm outline-none focus:border-amber-400 focus:bg-amber-50" />
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded px-2 py-1.5 pt-0.5 text-center flex flex-col justify-center min-h-[34px]">
                <span className="text-[10px] text-slate-400 font-bold block mb-1">Part. Total</span>
                <span className="text-sm font-bold text-slate-600">{partTotal}</span>
              </div>
              
              <div>
                <label className="block text-[10px] text-center font-semibold text-slate-400 mb-1">Practical</label>
                <input type="number" min="0" value={marksConfig.practical || ''} onChange={e => setMarksConfig(m => ({ ...m, practical: e.target.valueAsNumber || 0 }))} className="w-full text-center border border-slate-200 rounded px-2 py-1.5 text-sm outline-none focus:border-amber-400 focus:bg-amber-50" />
              </div>
              <div>
                <label className="block text-[10px] text-center font-semibold text-slate-400 mb-1">Project</label>
                <input type="number" min="0" value={marksConfig.project || ''} onChange={e => setMarksConfig(m => ({ ...m, project: e.target.valueAsNumber || 0 }))} className="w-full text-center border border-slate-200 rounded px-2 py-1.5 text-sm outline-none focus:border-amber-400 focus:bg-amber-50" />
              </div>
              <div>
                <label className="block text-[10px] text-center font-semibold text-slate-400 mb-1">HW Weight</label>
                <input type="number" min="0" value={marksConfig.hwWeight || ''} onChange={e => setMarksConfig(m => ({ ...m, hwWeight: e.target.valueAsNumber || 0 }))} className="w-full text-center border border-slate-200 rounded px-2 py-1.5 text-sm outline-none focus:border-amber-400 focus:bg-amber-50" />
              </div>
              <div>
                <label className="block text-[10px] text-center font-semibold text-slate-400 mb-1">CW Weight</label>
                <input type="number" min="0" value={marksConfig.cwWeight || ''} onChange={e => setMarksConfig(m => ({ ...m, cwWeight: e.target.valueAsNumber || 0 }))} className="w-full text-center border border-slate-200 rounded px-2 py-1.5 text-sm outline-none focus:border-amber-400 focus:bg-amber-50" />
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded px-2 py-1.5 pt-0.5 text-center flex flex-col justify-center min-h-[34px]">
                <span className="text-[10px] text-slate-400 font-bold block mb-1">Prac. Total</span>
                <span className="text-sm font-bold text-slate-600">{pracTotal}</span>
              </div>
              <div>
                <label className="block text-[10px] text-center font-semibold text-slate-400 mb-1">Unit Test</label>
                <input type="number" min="0" value={marksConfig.unitTest || ''} onChange={e => setMarksConfig(m => ({ ...m, unitTest: e.target.valueAsNumber || 0 }))} className="w-full text-center border border-slate-200 rounded px-2 py-1.5 text-sm outline-none focus:border-amber-400 focus:bg-amber-50" />
              </div>
              <div>
                <label className="block text-[10px] text-center font-semibold text-slate-400 mb-1">Parental Ev</label>
                <input type="number" min="0" value={marksConfig.parentalEv || ''} onChange={e => setMarksConfig(m => ({ ...m, parentalEv: e.target.valueAsNumber || 0 }))} className="w-full text-center border border-slate-200 rounded px-2 py-1.5 text-sm outline-none focus:border-amber-400 focus:bg-amber-50" />
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded px-2 py-1.5 pt-0.5 text-center flex flex-col justify-center min-h-[34px]">
                <span className="text-[10px] text-slate-400 font-bold block mb-1">Exam Total</span>
                <span className="text-sm font-bold text-slate-600">{examTotal}</span>
              </div>
              
              <div>
                <label className="block text-[10px] text-center font-semibold text-slate-400 mb-1">Prac. Box</label>
                <input type="number" min="0" value={marksConfig.pracBox || ''} onChange={e => setMarksConfig(m => ({ ...m, pracBox: e.target.valueAsNumber || 0 }))} className="w-full text-center border border-slate-200 rounded px-2 py-1.5 text-sm outline-none focus:border-amber-400 focus:bg-amber-50" />
              </div>
              <div>
                <label className="block text-[10px] text-center font-semibold text-slate-400 mb-1">Written Exam</label>
                <input type="number" min="0" value={marksConfig.writtenExam || ''} onChange={e => setMarksConfig(m => ({ ...m, writtenExam: e.target.valueAsNumber || 0 }))} className="w-full text-center border border-slate-200 rounded px-2 py-1.5 text-sm outline-none focus:border-amber-400 focus:bg-amber-50" />
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded px-2 py-1.5 pt-0.5 text-center flex flex-col justify-center min-h-[34px]">
                <span className="text-[10px] text-slate-400 font-bold block mb-1">Overall Max</span>
                <span className="text-sm font-bold text-slate-600">{overallMax}</span>
              </div>
           </div>

           <div className="pt-2">
             <button
                onClick={handleSaveMarks}
                disabled={isSavingMarks}
                className="bg-amber-500 hover:bg-amber-600 transition-colors text-white px-4 py-2 font-bold text-sm rounded-lg flex items-center space-x-2 disabled:bg-amber-300 cursor-pointer"
             >
                <Save className="w-4 h-4" />
                <span>Save Marks settings</span>
             </button>
           </div>
         </div>
       )}
       
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
         <div className="bg-white rounded-xl shadow-sm overflow-x-auto whitespace-nowrap">
            <table className="min-w-full text-left border-collapse text-[11px] font-sans">
              {isEca ? (
                <thead className="bg-[#1e293b] border-b border-[#0f172a] text-blue-100 font-semibold uppercase tracking-wider text-[11px]">
                   <tr>
                      <th className="px-4 py-3 border-r border-[#334155] min-w-[50px] text-center border-t">SN</th>
                      <th className="px-4 py-3 border-r border-[#334155] border-t">Name</th>
                      <th className="px-4 py-3 border-r border-[#334155] text-center border-t">Section</th>
                      <th colSpan={3} className="px-4 py-3 border-r border-[#334155] text-left border-t">ECA Criteria Grades</th>
                   </tr>
                </thead>
              ) : (
                <thead className="bg-[#1e293b] border-b border-[#0f172a] text-blue-100 font-semibold text-xs text-center border border-[#1e293b]">
                  {/* CDC Header Block */}
                  <tr>
                    <th rowSpan={2} className="px-2 py-2 border border-slate-700 bg-slate-800 text-slate-300">SN</th>
                    <th rowSpan={2} className="px-4 py-2 border border-slate-700 bg-slate-800 text-left text-slate-200">Students Name</th>
                    <th rowSpan={2} className="px-2 py-2 border border-slate-700 bg-slate-800 text-slate-300">Sec</th>
                    
                    {/* Participation group */}
                    <th colSpan={3} className="px-2 py-2 border border-[#064e3b] bg-[#022c22] text-[#34d399]">Participation</th>
                    
                    {/* Practical group */}
                    <th colSpan={5} className="px-2 py-2 border border-[#0f766e] bg-[#042f2e] text-[#38bdf8]">Practical</th>
                    
                    {/* Exam group */}
                    <th colSpan={3} className="px-2 py-2 border border-[#1e1b4b] bg-[#1e1b4b] text-[#a5b4fc]">Exam</th>
                    
                    <th rowSpan={2} className="px-4 py-2 border border-slate-700 bg-[#0c4a6e] text-[#bae6fd]">Practical</th>
                    <th rowSpan={2} className="px-4 py-2 border border-slate-700 bg-[#7c2d12] text-[#fdba74]">Written</th>
                    <th rowSpan={2} className="px-4 py-2 border border-slate-700 bg-[#2e1065] text-[#d8b4fe]">Overall Total</th>
                  </tr>
                  <tr>
                    <th className="px-2 py-2 border border-slate-600 bg-slate-700 font-normal">Attendance</th>
                    <th className="px-2 py-2 border border-slate-600 bg-slate-700 font-normal">Discipline</th>
                    <th className="px-2 py-2 border border-slate-600 bg-[#064e3b] font-bold text-white">Total</th>
                    
                    <th className="px-2 py-2 border border-slate-600 bg-slate-700 font-normal">Practical</th>
                    <th className="px-2 py-2 border border-slate-600 bg-slate-700 font-normal">project</th>
                    <th className="px-2 py-2 border border-slate-600 bg-slate-700 font-normal">HW</th>
                    <th className="px-2 py-2 border border-slate-600 bg-slate-700 font-normal">CW</th>
                    <th className="px-2 py-2 border border-slate-600 bg-[#0f766e] font-bold text-white">Total</th>
                    
                    <th className="px-2 py-2 border border-slate-600 bg-slate-700 font-normal">UT</th>
                    <th className="px-2 py-2 border border-slate-600 bg-slate-700 font-normal">Parental Ev</th>
                    <th className="px-2 py-2 border border-slate-600 bg-[#312e81] font-bold text-white">Total</th>
                  </tr>
                </thead>
              )}

              <tbody className="divide-y divide-slate-100 font-normal text-slate-700 bg-white">
                 {filteredStudents.map((st, index) => {
                    if (isEca) {
                        const grades = activeSubjectData?.ecaCriteria?.map((c:string) => {
                           const s = scores.find(x => x.taskId === c && x.studentId === st.id);
                           return `${c}: ${s?.score || '-'}`;
                        }).join(" • ") || "No criteria defined.";
                        return (
                          <tr key={st.id} className="hover:bg-slate-50 transition-colors border-b border-slate-200">
                             <td className="px-4 py-2 border-r border-slate-200 font-mono text-[10px] text-slate-400 text-center">{index + 1}</td>
                             <td className="px-4 py-2 border-r border-slate-200 font-medium text-slate-900">{st.name}</td>
                             <td className="px-4 py-2 border-r border-slate-200 text-center text-slate-500">{st.section}</td>
                             <td colSpan={3} className="px-4 py-2 text-slate-600 text-xs font-medium space-x-2">{grades}</td>
                          </tr>
                        );
                    } else {
                        // Normally this would calculate precise scores per category
                        // Pending the real category definitions per task, we place 0s
                        let obtained = 0;
                        let maxToT = 0;
                        tasks.forEach(t => {
                           const s = scores.find(x => x.taskId === t.id && x.studentId === st.id);
                           if(s && typeof s.score === 'number') {
                             obtained += s.score;
                             maxToT += t.maxMarks;
                           }
                        });
                        
                        return (
                          <tr key={st.id} className="hover:bg-slate-50 transition-colors border-b border-slate-200 text-center">
                             <td className="px-2 py-2 border border-slate-200 bg-slate-50 font-mono text-[10px] text-slate-400">{index + 1}</td>
                             <td className="px-4 py-2 border border-slate-200 font-semibold text-slate-800 text-left">{st.name}</td>
                             <td className="px-2 py-2 border border-slate-200 font-medium text-slate-600">{st.section}</td>
                             
                             {/* Participation Row */}
                             <td className="px-2 py-2 border border-slate-200 text-slate-500">0</td>
                             <td className="px-2 py-2 border border-slate-200 text-slate-500">0</td>
                             <td className="px-2 py-2 border border-slate-200 font-bold text-[#064e3b] bg-emerald-50/50">0</td>
                             
                             {/* Practical */}
                             <td className="px-2 py-2 border border-slate-200 text-slate-500">0</td>
                             <td className="px-2 py-2 border border-slate-200 text-slate-500">0</td>
                             <td className="px-2 py-2 border border-slate-200 text-slate-500">0</td>
                             <td className="px-2 py-2 border border-slate-200 text-slate-500">0</td>
                             <td className="px-2 py-2 border border-slate-200 font-bold text-[#0f766e] bg-teal-50/50">0</td>
                             
                             {/* Exam */}
                             <td className="px-2 py-2 border border-slate-200 text-slate-500">0</td>
                             <td className="px-2 py-2 border border-slate-200 text-slate-500">0</td>
                             <td className="px-2 py-2 border border-slate-200 font-bold text-[#312e81] bg-indigo-50/50">0</td>

                             {/* Final Output - Fallback to our existing total / obtained just for testing purposes so it's not all zeros */}
                             <td className="px-4 py-2 border border-slate-200 font-bold text-[#0369a1] bg-sky-50">{obtained.toFixed(1)}</td>
                             <td className="px-4 py-2 border border-slate-200 font-bold text-[#9a3412] bg-orange-50">-</td>
                             <td className="px-4 py-2 border border-slate-200 font-black text-[#5b21b6] bg-purple-50 text-sm">{obtained.toFixed(1)}</td>
                          </tr>
                        );
                    }
                 })}
                 {filteredStudents.length === 0 && (
                   <tr><td colSpan={16} className="px-4 py-8 text-center text-slate-500 font-medium">No students available for this view.</td></tr>
                 )}
              </tbody>
            </table>
         </div>
       )}
    </div>
  );
}

