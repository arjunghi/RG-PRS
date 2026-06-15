import React, { useState, useEffect } from "react";
import { db } from "../lib/firebaseClient";
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { handleFirestoreError, OperationType } from "../lib/firebaseUtils";
import { useAuth } from "../lib/AuthContext";
import { triggerLiveSyncInBg } from "../lib/googleSheetsSync";

export default function StudentManagement() {
  const { user, accessToken } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [newSection, setNewSection] = useState("");
  const [newGrade, setNewGrade] = useState("");
  const [sport1, setSport1] = useState("");
  const [sport2, setSport2] = useState("");
  const [ecaSubjects, setEcaSubjects] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({ grades: [], sections: [] });

  // Bulk clipboard insert options
  const [addMode, setAddMode] = useState<"single" | "multiline">("single");
  const [multilineNames, setMultilineNames] = useState("");
  const [multiGrade, setMultiGrade] = useState("");
  const [multiSection, setMultiSection] = useState("");
  const [isSubmittingMulti, setIsSubmittingMulti] = useState(false);

  const isAdmin = user?.appRole === "admin";
  const isTeacher = ["admin", "teacher"].includes(user?.appRole || "");

  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, "students"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      // Sort alphabetically
      data.sort((a,b) => a.name.localeCompare(b.name));
      setStudents(data);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, "students"));

    const unsubSubj = onSnapshot(collection(db, "subjects"), (snap) => {
      setEcaSubjects(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter(s => s.type === "eca"));
    }, (error) => handleFirestoreError(error, OperationType.LIST, "subjects"));

    const unsubConfig = onSnapshot(doc(db, "settings", "schoolConfig"), snap => {
      if(snap.exists()) setConfig(snap.data());
    }, err => handleFirestoreError(err, OperationType.LIST, "settings"));

    return () => {
       unsubStudents();
       unsubSubj();
       unsubConfig();
    };
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!isAdmin) return alert("Must be an admin to add students directly.");
    try {
      await addDoc(collection(db, "students"), {
        name: newName,
        section: newSection,
        gradeLevel: newGrade,
        ecaSports: [sport1, sport2].filter(Boolean),
        createdAt: new Date().toISOString()
      });
      setNewName("");
      setNewSection("");
      setNewGrade("");
      setSport1("");
      setSport2("");
      triggerLiveSyncInBg(accessToken, config.googleSpreadsheetId);
    } catch(err) {
      handleFirestoreError(err, OperationType.CREATE, "students");
    }
  };

  const handleMultilineAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!isAdmin) return alert("Must be an admin to add students.");
    if(!multiGrade || !multiSection) return alert("Please select Grade Level and Section.");
    if(!multilineNames.trim()) return alert("Please paste or type names in the box.");

    setIsSubmittingMulti(true);
    try {
      const names = multilineNames
        .split("\n")
        .map(n => n.trim())
        .filter(n => n.length > 0);

      if (names.length === 0) {
        alert("No valid student names found in pasted list.");
        setIsSubmittingMulti(false);
        return;
      }

      const promises = names.map(async (name) => {
        return addDoc(collection(db, "students"), {
          name,
          gradeLevel: multiGrade,
          section: multiSection,
          ecaSports: [],
          createdAt: new Date().toISOString()
        });
      });

      await Promise.all(promises);
      alert(`Success! Imported ${names.length} students into ${multiGrade} - ${multiSection}.`);
      setMultilineNames("");
      setMultiGrade("");
      setMultiSection("");
      triggerLiveSyncInBg(accessToken, config.googleSpreadsheetId);
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.CREATE, "students");
    } finally {
      setIsSubmittingMulti(false);
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return alert("Must be an admin to upload students.");
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const rows = text.split("\n").map(r => r.trim()).filter(Boolean);
      
      const headers = rows[0].split(",").map(h => h.trim().toLowerCase());
      const nameIdx = headers.indexOf("name");
      const gradeIdx = headers.indexOf("grade");
      const secIdx = headers.indexOf("section");
      
      if (nameIdx === -1 || gradeIdx === -1 || secIdx === -1) {
        return alert("CSV must contain columns: 'name', 'grade', 'section'");
      }

      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(",").map(c => c.trim());
        if (cols.length < headers.length) continue;
        
        try {
          await addDoc(collection(db, "students"), {
             name: cols[nameIdx],
             gradeLevel: cols[gradeIdx],
             section: cols[secIdx],
             ecaSports: [],
             createdAt: new Date().toISOString()
          });
        } catch(err) {
          console.error("Failed to add student:", cols[nameIdx], err);
        }
      }
      alert("Bulk upload completed");
      triggerLiveSyncInBg(accessToken, config.googleSpreadsheetId);
      if (e.target) e.target.value = ""; // Reset input
    };
    reader.readAsText(file);
  };

  const handleDelete = async (id: string) => {
    if(!isAdmin) return alert("Requires Admin permission.");
    try {
      await deleteDoc(doc(db, "students", id));
      triggerLiveSyncInBg(accessToken, config.googleSpreadsheetId);
    } catch(err) {
       handleFirestoreError(err, OperationType.DELETE, "students");
    }
  }

  const updateSports = async (studentId: string, sports: string[]) => {
    if(!isTeacher) return alert("Requires Teacher or Admin permission.");
    try {
      await updateDoc(doc(db, "students", studentId), { ecaSports: sports });
      triggerLiveSyncInBg(accessToken, config.googleSpreadsheetId);
    } catch(err) {
      handleFirestoreError(err, OperationType.UPDATE, "students");
    }
  }

  const downloadSampleCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8,Name,Grade,Section\nJohn Doe,Grade 1,A\nJane Smith,Grade 2,B";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "student_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <h2 className="text-xl font-bold text-slate-900">Student Directory & ECA</h2>
          {config.googleSpreadsheetId && (
            <a 
              href={config.googleSpreadsheetUrl} 
              target="_blank" 
              referrerPolicy="no-referrer"
              rel="noreferrer" 
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-bold border border-emerald-100 flex items-center space-x-1 transition cursor-pointer"
              title="Click to view live spreadsheet"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Sheets Sync Active</span>
            </a>
          )}
        </div>
        {isAdmin && (
          <div className="flex items-center space-x-3">
             <button onClick={downloadSampleCSV} className="text-slate-600 hover:text-blue-600 text-sm font-semibold transition-colors underline underline-offset-2">Download Sample CSV</button>
             <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors text-slate-700 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm">
               Bulk CSV Upload
               <input type="file" accept=".csv" className="hidden" onChange={handleBulkUpload} />
             </label>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {/* Form Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
            <button
              onClick={() => setAddMode("single")}
              className={`px-5 py-3 border-r border-slate-200 transition-colors uppercase tracking-wider font-bold cursor-pointer ${
                addMode === "single"
                  ? "bg-white text-blue-600 border-b-2 border-b-blue-600"
                  : "hover:bg-slate-100 text-slate-600"
              }`}
            >
              Single Student Form
            </button>
            <button
              onClick={() => setAddMode("multiline")}
              className={`px-5 py-3 transition-colors uppercase tracking-wider font-bold cursor-pointer ${
                addMode === "multiline"
                  ? "bg-white text-blue-600 border-b-2 border-b-blue-600"
                  : "hover:bg-slate-100 text-slate-600"
              }`}
            >
              Copy-Paste Section Roster List
            </button>
          </div>

          <div className="p-6">
            {addMode === "single" ? (
              <form onSubmit={handleAdd} className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Student Name</label>
                  <input required value={newName} onChange={e => setNewName(e.target.value)} className="w-full sm:w-64 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"/>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Grade Level</label>
                  <select required value={newGrade} onChange={e => {setNewGrade(e.target.value); setNewSection("");}} className="w-full sm:w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                     <option value="" disabled>Select</option>
                     {(config.gradeMappings || []).length > 0 ? 
                       (config.gradeMappings || []).map((g: any) => <option key={g.grade} value={g.grade}>{g.grade}</option>) :
                       <>
                         <option value="Grade 1">Grade 1</option>
                         <option value="Grade 2">Grade 2</option>
                         <option value="Grade 3">Grade 3</option>
                       </>
                     }
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Section</label>
                  <select required value={newSection} onChange={e => setNewSection(e.target.value)} className="w-full sm:w-28 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                     <option value="" disabled>Select</option>
                     {newGrade && (config.gradeMappings || []).find((g: any) => g.grade === newGrade)?.sections.map((s: string) => <option key={s} value={s}>{s}</option>)}
                     {(!config.gradeMappings || config.gradeMappings.length === 0) && (
                       <>
                         <option value="A">A</option>
                         <option value="B">B</option>
                         <option value="C">C</option>
                       </>
                     )}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">ECA Activity 1</label>
                  <select value={sport1} onChange={e => setSport1(e.target.value)} className="w-full sm:w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                     <option value="">None</option>
                     {ecaSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">ECA Activity 2</label>
                  <select value={sport2} onChange={e => setSport2(e.target.value)} className="w-full sm:w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                     <option value="">None</option>
                     {ecaSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 transition-colors text-white font-semibold text-sm px-5 py-2 rounded-lg cursor-pointer">Add Student</button>
              </form>
            ) : (
              <form onSubmit={handleMultilineAdd} className="space-y-4">
                <div className="flex flex-wrap gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Target Grade Level</label>
                    <select required value={multiGrade} onChange={e => {setMultiGrade(e.target.value); setMultiSection("");}} className="w-48 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                       <option value="" disabled>Select Grade</option>
                       {(config.gradeMappings || []).length > 0 ? 
                         (config.gradeMappings || []).map((g: any) => <option key={g.grade} value={g.grade}>{g.grade}</option>) :
                         <>
                           <option value="Grade 1">Grade 1</option>
                           <option value="Grade 2">Grade 2</option>
                           <option value="Grade 3">Grade 3</option>
                         </>
                       }
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Target Section</label>
                    <select required value={multiSection} onChange={e => setMultiSection(e.target.value)} className="w-40 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                       <option value="" disabled>Select Section</option>
                       {multiGrade && (config.gradeMappings || []).find((g: any) => g.grade === multiGrade)?.sections.map((s: string) => <option key={s} value={s}>{s}</option>)}
                       {(!config.gradeMappings || config.gradeMappings.length === 0) && (
                         <>
                           <option value="A">A</option>
                           <option value="B">B</option>
                           <option value="C">C</option>
                         </>
                       )}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                    Student Names (Paste list here, One Name Per Line)
                  </label>
                  <textarea
                    required
                    rows={6}
                    value={multilineNames}
                    onChange={e => setMultilineNames(e.target.value)}
                    placeholder="Example:&#10;Aaron Smith&#10;Bella Thorne&#10;Chris Evans&#10;Daniel Craig"
                    className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono bg-white"
                  />
                  <p className="text-xs text-slate-400 mt-1">Empty lines are automatically ignored. Extra whitespaces are trimmed.</p>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmittingMulti}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 transition-colors text-white font-bold text-xs uppercase tracking-wide px-6 py-2.5 rounded-lg flex items-center space-x-2 cursor-pointer"
                  >
                    <span>{isSubmittingMulti ? "Importing Roster..." : "Add All Paste Roster to Section"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
         <table className="w-full text-left text-[13px] whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
               <tr>
                 <th className="px-4 py-3">Name</th>
                 <th className="px-4 py-3">Grade</th>
                 <th className="px-4 py-3">Section</th>
                 <th className="px-4 py-3">ECA Tracking</th>
                 <th className="px-4 py-3 text-right">Settings</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
               {students.map(s => {
                 const s1 = (s.ecaSports && s.ecaSports[0]) || "";
                 const s2 = (s.ecaSports && s.ecaSports[1]) || "";
                 return (
                 <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{s.name}</td>
                    <td className="px-4 py-2.5">{s.gradeLevel}</td>
                    <td className="px-4 py-2.5">{s.section}</td>
                    <td className="px-4 py-2.5">
                       <div className="flex gap-2 items-center">
                         <select
                           defaultValue={s1}
                           onChange={(e) => updateSports(s.id, [e.target.value, s2].filter(Boolean))}
                           className="border border-slate-200 bg-white rounded px-2 py-1 w-28 text-xs outline-none focus:border-blue-400"
                         >
                           <option value="">None</option>
                           {ecaSubjects.map(s => <option key={`1-${s.id}`} value={s.id}>{s.name}</option>)}
                         </select>
                         <select
                           defaultValue={s2}
                           onChange={(e) => updateSports(s.id, [s1, e.target.value].filter(Boolean))}
                           className="border border-slate-200 bg-white rounded px-2 py-1 w-28 text-xs outline-none focus:border-blue-400"
                         >
                           <option value="">None</option>
                           {ecaSubjects.map(s => <option key={`2-${s.id}`} value={s.id}>{s.name}</option>)}
                         </select>
                       </div>
                    </td>
                    <td className="px-4 py-2.5 text-right space-x-3">
                       {isAdmin && (
                         <button onClick={() => handleDelete(s.id)} className="text-red-500 font-semibold text-xs hover:text-red-700 transition">Remove</button>
                       )}
                    </td>
                 </tr>
               )})}
               {!loading && students.length === 0 && (
                 <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No students found. Add a student to start building your roster.</td></tr>
               )}
            </tbody>
         </table>
      </div>
    </div>
  );
}
