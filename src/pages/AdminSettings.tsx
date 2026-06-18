import React, { useState, useEffect } from "react";
import { db } from "../lib/firebaseClient";
import { collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc, query, where, getDocs, writeBatch } from "firebase/firestore";
import { handleFirestoreError, OperationType } from "../lib/firebaseUtils";
import { useAuth } from "../lib/AuthContext";
import { createSpreadsheet, syncAllFirestoreToSheets, saveSheetConnection, triggerLiveSyncInBg, importSheetsConfirmAndSync } from "../lib/googleSheetsSync";
import { FileSpreadsheet, RefreshCw, Link2, PlusCircle, Check, AlertTriangle, ExternalLink } from "lucide-react";

export default function AdminSettings() {
  const { accessToken, reconnectGoogle } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({ grades: [], sections: [] });
  
  const [newSubj, setNewSubj] = useState("");
  const [newSubjGrade, setNewSubjGrade] = useState("General");
  const [newEca, setNewEca] = useState("");
  const [newEcaGrade, setNewEcaGrade] = useState("General");
  const [ecaCriteria, setEcaCriteria] = useState<string[]>(["", "", "", "", ""]);
  
  const [newTeacherName, setNewTeacherName] = useState("");
  const [newTeacherEmail, setNewTeacherEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("teacher");
  const [newGrade, setNewGrade] = useState("");
  const [newSectionMap, setNewSectionMap] = useState<Record<number, string>>({});

  const [assignTeacher, setAssignTeacher] = useState("");
  const [assignSubject, setAssignSubject] = useState("");
  const [assignGrade, setAssignGrade] = useState("");
  const [assignSection, setAssignSection] = useState("");

  const [isSyncing, setIsSyncing] = useState(false);
  const [sheetInputId, setSheetInputId] = useState("");
  const [syncStatus, setSyncStatus] = useState<{ type: "success" | "error" | "info" | null, message: string }>({ type: null, message: "" });

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, "users"), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => handleFirestoreError(err, OperationType.LIST, "users"));

    const unsub2 = onSnapshot(collection(db, "subjects"), snap => {
      setSubjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => handleFirestoreError(err, OperationType.LIST, "subjects"));

    const unsub3 = onSnapshot(doc(db, "settings", "schoolConfig"), snap => {
      if (snap.exists()) {
         setConfig(snap.data());
      }
    }, err => handleFirestoreError(err, OperationType.LIST, "settings"));

    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  const changeRole = async (userId: string, email: string, newRole: string) => {
    try {
      const q = query(collection(db, "users"), where("email", "==", email));
      const snaps = await getDocs(q);
      const updates: any = { role: newRole };
      if (newRole !== "guest") {
         updates.status = "approved";
      }
      if (!snaps.empty) {
         const batch = writeBatch(db);
         snaps.docs.forEach((d) => {
            batch.update(d.ref, updates);
         });
         await batch.commit();
      } else {
         await updateDoc(doc(db, "users", userId), updates);
      }
    } catch(err) {
      handleFirestoreError(err, OperationType.UPDATE, "users");
    }
  }

  const addInvitedTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!newTeacherEmail || !newTeacherName.trim()) return;
    try {
      const email = newTeacherEmail.toLowerCase().trim();
      
      // Check if user already logged in and created a doc
      const q = query(collection(db, "users"), where("email", "==", email));
      const snaps = await getDocs(q);
      
      const newRoleData = {
        name: newTeacherName.trim(),
        role: newUserRole,
        status: "approved",
      };

      if (!snaps.empty) {
         // Update existing user doc
         const batch = writeBatch(db);
         snaps.docs.forEach((d) => {
            batch.update(d.ref, { ...newRoleData, updatedAt: new Date().toISOString() });
         });
         await batch.commit();
      } else {
         // Create Pre-enrolled Profile
         await setDoc(doc(db, "users", email), {
           ...newRoleData,
           email: email,
           createdAt: new Date().toISOString()
         });
      }
      
      setNewTeacherName("");
      setNewTeacherEmail("");
      setNewUserRole("teacher");
    } catch(err) {
      handleFirestoreError(err, OperationType.CREATE, "users");
    }
  }

  const handleAddGrade = async () => {
    if(!newGrade.trim()) return;
    try {
      const gList = [...(config.gradeMappings || [])];
      gList.push({ grade: newGrade.trim(), sections: [] });
      await setDoc(doc(db, "settings", "schoolConfig"), { gradeMappings: gList }, { merge: true });
      setNewGrade("");
      triggerLiveSyncInBg(accessToken, config.googleSpreadsheetId);
    } catch(err) { handleFirestoreError(err, OperationType.UPDATE, "settings"); }
  }

  const handleRemoveGrade = async (index: number) => {
    try {
      const gList = [...(config.gradeMappings || [])];
      gList.splice(index, 1);
      await setDoc(doc(db, "settings", "schoolConfig"), { gradeMappings: gList }, { merge: true });
      triggerLiveSyncInBg(accessToken, config.googleSpreadsheetId);
    } catch(err) { handleFirestoreError(err, OperationType.UPDATE, "settings"); }
  }

  const handleAddSection = async (gradeIndex: number) => {
    const val = newSectionMap[gradeIndex];
    if(!val || !val.trim()) return;
    try {
      const gList = [...(config.gradeMappings || [])];
      if (!gList[gradeIndex].sections) gList[gradeIndex].sections = [];
      gList[gradeIndex].sections.push(val.trim());
      await setDoc(doc(db, "settings", "schoolConfig"), { gradeMappings: gList }, { merge: true });
      setNewSectionMap(prev => ({...prev, [gradeIndex]: ""}));
      triggerLiveSyncInBg(accessToken, config.googleSpreadsheetId);
    } catch(err) { handleFirestoreError(err, OperationType.UPDATE, "settings"); }
  }

  const handleRemoveSection = async (gradeIndex: number, secIndex: number) => {
    try {
      const gList = [...(config.gradeMappings || [])];
      gList[gradeIndex].sections.splice(secIndex, 1);
      await setDoc(doc(db, "settings", "schoolConfig"), { gradeMappings: gList }, { merge: true });
      triggerLiveSyncInBg(accessToken, config.googleSpreadsheetId);
    } catch(err) { handleFirestoreError(err, OperationType.UPDATE, "settings"); }
  }

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTeacher || !assignSubject || !assignGrade || !assignSection) return;
    try {
       const subject = subjects.find(s => s.id === assignSubject);
       if (!subject) return;
       const assignments = subject.assignments || [];
       
       // Prevent duplicates
       const isDuplicate = assignments.some((a: any) => 
           a.teacherEmail === assignTeacher && a.gradeLevel === assignGrade && a.section === assignSection
       );
       
       if (!isDuplicate) {
         assignments.push({
             teacherEmail: assignTeacher,
             gradeLevel: assignGrade,
             section: assignSection
         });
         await updateDoc(doc(db, "subjects", assignSubject), { assignments });
         triggerLiveSyncInBg(accessToken, config.googleSpreadsheetId);
         
         // Clear only the subject to allow rapid re-assignment of the same teacher/grade
         setAssignSubject("");
       }
    } catch(err) {
       handleFirestoreError(err, OperationType.UPDATE, "subjects");
    }
  };

  const removeAssignment = async (subjectId: string, idx: number) => {
    try {
       const subject = subjects.find(s => s.id === subjectId);
       if (!subject) return;
       const assignments = subject.assignments || [];
       assignments.splice(idx, 1);
       await updateDoc(doc(db, "subjects", subjectId), { assignments });
       triggerLiveSyncInBg(accessToken, config.googleSpreadsheetId);
    } catch(err) {
       handleFirestoreError(err, OperationType.UPDATE, "subjects");
    }
  }

  const handleDeleteSubject = async (subjectId: string) => {
    if(!confirm("Are you sure you want to delete this subject?")) return;
    try {
      await deleteDoc(doc(db, "subjects", subjectId));
      triggerLiveSyncInBg(accessToken, config.googleSpreadsheetId);
    } catch(err) {
      handleFirestoreError(err, OperationType.DELETE, "subjects");
    }
  }

  const addSubject = async (e: React.FormEvent, type: "academic" | "eca") => {
    e.preventDefault();
    try {
      const name = type === "academic" ? newSubj : newEca;
      const selectedGrade = type === "academic" ? newSubjGrade : newEcaGrade;
      const sId = (type + "-" + selectedGrade + "-" + name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')   // replace all non-alphanumeric with hyphen
        .replace(/(^-|-$)/g, '');      // strip trailing/leading hyphens
      
      const payload: any = {
         name: name,
         type: type,
         gradeLevel: selectedGrade || "General",
         teacherEmails: [],
         assignments: [],
         createdAt: new Date().toISOString()
      };
      
      if(type === "eca") {
         payload.ecaCriteria = ecaCriteria.filter(c => c.trim() !== "");
      }

      await setDoc(doc(db, "subjects", sId), payload);
      
      if(type === "academic") {
         setNewSubj("");
         setNewSubjGrade("General");
      }
      else {
         setNewEca("");
         setNewEcaGrade("General");
         setEcaCriteria(["", "", "", "", ""]);
      }
      
      // Auto-sync addition of subjects
      triggerLiveSyncInBg(accessToken, config.googleSpreadsheetId);
    } catch(err) {
      handleFirestoreError(err, OperationType.CREATE, "subjects");
    }
  }

  const handleConnectGoogle = async () => {
    setSyncStatus({ type: "info", message: "Connecting to your Google Account..." });
    const token = await reconnectGoogle();
    if (token) {
      setSyncStatus({ type: "success", message: "Successfully connected Google account with Drive/Sheets permissions!" });
    } else {
      setSyncStatus({ type: "error", message: "Failed to connect Google account with sheets permission." });
    }
  }

  const handleCreateNewSheet = async () => {
    if (!accessToken) {
      setSyncStatus({ type: "error", message: "Please connect your Google Account first." });
      return;
    }
    setIsSyncing(true);
    setSyncStatus({ type: "info", message: "Initializing new Google Spreadsheet on your Drive..." });
    try {
      const spreadsheet = await createSpreadsheet(accessToken, "RG PRS Student & Grading Records");
      await saveSheetConnection(spreadsheet.id, spreadsheet.url);
      setSyncStatus({ type: "info", message: "Spreadsheet initialized! Synced Google worksheets..." });
      await syncAllFirestoreToSheets(accessToken, spreadsheet.id);
      setSyncStatus({ type: "success", message: "Active Google Spreadsheet created and fully synced!" });
    } catch (err: any) {
      console.error(err);
      setSyncStatus({ type: "error", message: `Failed to create spreadsheet: ${err.message || err}` });
    } finally {
      setIsSyncing(false);
    }
  }

  const handleLinkExistingSheet = async () => {
    if (!sheetInputId.trim()) return;
    setIsSyncing(true);
    setSyncStatus({ type: "info", message: "Connecting Google Spreadsheet ID..." });
    try {
      let sId = sheetInputId.trim();
      if (sId.includes("/d/")) {
        const parts = sId.split("/d/");
        if (parts[1]) {
          sId = parts[1].split("/")[0];
        }
      }
      const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${sId}/edit`;
      setSheetInputId("");
      
      // Always save the connection immediately in Firebase Config
      await saveSheetConnection(sId, spreadsheetUrl);

      if (accessToken) {
        setSyncStatus({ type: "info", message: "Spreadsheet linked! Seeding/Backing up your Firebase database to the spreadsheet..." });
        await syncAllFirestoreToSheets(accessToken, sId);
        setSyncStatus({ 
          type: "success", 
          message: "Spreadsheet linked successfully! Your current Firebase database was successfully backed up to the Google Sheet." 
        });
      } else {
        setSyncStatus({ 
          type: "success", 
          message: "Spreadsheet linked successfully! Connect your Google Account above or refresh to initiate automated backups." 
        });
      }
    } catch (err: any) {
      console.error(err);
      setSyncStatus({ type: "error", message: `Failed to link spreadsheet: ${err.message || err}` });
    } finally {
      setIsSyncing(false);
    }
  }

  const handlePullFromSheet = async () => {
    if (!config.googleSpreadsheetId) {
      setSyncStatus({ type: "error", message: "No connected spreadsheet found." });
      return;
    }
    const token = accessToken || (await reconnectGoogle());
    if (!token) {
      setSyncStatus({ type: "error", message: "Missing Google authorization. Please connect your Google Account first." });
      return;
    }
    const confirmed = window.confirm("This will read all worksheets from your Google Spreadsheet and import them, which may merge or overwrite current records. Proceed?");
    if (!confirmed) return;

    setIsSyncing(true);
    setSyncStatus({ type: "info", message: "Importing records from active Google Sheet..." });
    try {
      const result = await importSheetsConfirmAndSync(token, config.googleSpreadsheetId);
      setSyncStatus({ 
        type: "success", 
        message: `Import completed! Successfully read ${result.studentsCount} students, ${result.subjectsCount} subjects, ${result.tasksCount} tasks, and ${result.scoresCount} scores directly into the database.` 
      });
    } catch (err: any) {
      console.error(err);
      setSyncStatus({ type: "error", message: `Failed to import spreadsheet: ${err.message || err}` });
    } finally {
      setIsSyncing(false);
    }
  }

  const handleManualSync = async () => {
    if (!accessToken) {
      const token = await reconnectGoogle();
      if (!token) {
        setSyncStatus({ type: "error", message: "Missing Google authorization. Please click the 'Authorize Google Session' button to log in first." });
        return;
      }
    }
    if (!config.googleSpreadsheetId) {
      setSyncStatus({ type: "error", message: "No spreadsheet is linked. Please link or create a Google Sheet first." });
      return;
    }
    setIsSyncing(true);
    setSyncStatus({ type: "info", message: "Running complete on-demand spreadsheet synchronization..." });
    try {
      const activeToken = accessToken || (await reconnectGoogle());
      if (activeToken) {
        await syncAllFirestoreToSheets(activeToken, config.googleSpreadsheetId);
        await setDoc(doc(db, "settings", "schoolConfig"), {
          googleSyncLastTime: new Date().toISOString()
        }, { merge: true });
        setSyncStatus({ type: "success", message: "All records synchronized with Google Sheets successfully!" });
      } else {
        setSyncStatus({ type: "error", message: "Failed to obtain authorized Google Session." });
      }
    } catch (err: any) {
      console.error(err);
      setSyncStatus({ type: "error", message: `Synchronization failed: ${err.message || err}` });
    } finally {
      setIsSyncing(false);
    }
  }

  const handleDisconnectSheet = async () => {
    if (!window.confirm("Disconnect spreadsheet? This will stop automated updates, but your spreadsheet file on Google Drive will remain intact.")) return;
    try {
      await setDoc(doc(db, "settings", "schoolConfig"), {
        googleSpreadsheetId: null,
        googleSpreadsheetUrl: null,
        googleSyncLastTime: null
      }, { merge: true });
      setSyncStatus({ type: "success", message: "Google Sheet connection deleted." });
    } catch (err: any) {
      setSyncStatus({ type: "error", message: `Disconnect failed: ${err.message || err}` });
    }
  }

  return (
    <div className="space-y-8">
      {/* Google Sheets Backup Settings */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Google Sheets Auto-Backup
        </h2>
        <p className="text-xs text-slate-500 mt-1">Data entered in the software is automatically backed up to your Google Sheet without needing to sync manually. The app stores its primary data completely in Firebase.</p>
        
        <div className="mt-4 flex flex-col md:flex-row gap-4 items-center">
           {!accessToken ? (
             <button
                onClick={async () => {
                  await reconnectGoogle();
                }}
                className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs px-4 py-2 rounded-lg transition shadow-sm flex items-center space-x-2 cursor-pointer"
              >
                <span>Authorize Google Session</span>
             </button>
           ) : (
             <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Authorized</span>
             </span>
           )}
           
           <div className="flex-1 w-full flex gap-2">
             <input
                type="text"
                value={sheetInputId}
                onChange={(e) => setSheetInputId(e.target.value)}
                placeholder="Paste Spreadsheet URL or ID here..."
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 flex-1"
             />
             <button
                onClick={handleLinkExistingSheet}
                disabled={isSyncing || !sheetInputId.trim()}
                className="bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white font-semibold text-xs px-4 py-1.5 rounded-lg transition"
             >
                Set as Backup
             </button>
             {config.googleSpreadsheetId && (
               <button
                  onClick={handleDisconnectSheet}
                  className="bg-rose-100 text-rose-700 hover:bg-rose-200 font-semibold text-xs px-3 py-1.5 rounded-lg transition"
               >
                  Unlink
               </button>
             )}
           </div>
        </div>
        
        {config.googleSpreadsheetId && (
          <div className="mt-3 text-[11px] font-medium text-slate-500 flex items-center gap-2">
            <span>Currently backing up to:</span>
            <a href={config.googleSpreadsheetUrl} target="_blank" rel="noreferrer" className="text-blue-500 underline">
               {config.googleSpreadsheetId}
            </a>
          </div>
        )}
      </div>

      <div>
        <div className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            Pre-enroll & Pre-approve New User
          </h2>
          <p className="text-xs text-slate-500">
            Keep full name, email and role for secure institutional access. Pre-enrolled users login seamlessly with Google, completely bypassing manual request screen. Grade and subject access is assigned below.
          </p>
          <form onSubmit={addInvitedTeacher} className="flex flex-wrap gap-2 pt-1">
            <input 
              type="text" 
              value={newTeacherName} 
              onChange={e => setNewTeacherName(e.target.value)} 
              placeholder="User Full Name..." 
              className="border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-56" 
              required 
            />
            <input 
              type="email" 
              value={newTeacherEmail} 
              onChange={e => setNewTeacherEmail(e.target.value)} 
              placeholder="User Email address..." 
              className="border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-64" 
              required 
            />
            <select 
              value={newUserRole} 
              onChange={e => setNewUserRole(e.target.value)} 
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white w-full sm:w-40"
            >
               <option value="guest">Guest</option>
               <option value="student">Student</option>
               <option value="staff">Staff</option>
               <option value="teacher">Teacher</option>
               <option value="incharge">Incharge</option>
               <option value="eca_teacher">ECA Teacher</option>
               <option value="admin">Admin</option>
            </select>
            <button 
              type="submit" 
              className="bg-slate-900 hover:bg-black transition text-white font-semibold text-sm px-5 py-2 rounded-lg cursor-pointer"
            >
              Add/Pre-enroll User
            </button>
          </form>
        </div>

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-slate-900">Enrolled Users Registry</h2>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
           <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                 <tr>
                   <th className="px-4 py-3">Email</th>
                   <th className="px-4 py-3">Full Name</th>
                   <th className="px-4 py-3">Role</th>
                   <th className="px-4 py-3">Assigned Grade</th>
                   <th className="px-4 py-3">Grade &amp; Subject Access</th>
                   <th className="px-4 py-3">Status</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                 {users.map(u => (
                   <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 font-medium">{u.email}</td>
                      <td className="px-4 py-2.5">{u.name}</td>
                      <td className="px-4 py-2.5">
                        <select 
                          value={u.role} 
                          onChange={(e) => changeRole(u.id, u.email, e.target.value)}
                          className="border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        >
                            <option value="guest">Guest / Pending</option>
                            <option value="student">Student</option>
                            <option value="staff">Staff</option>
                            <option value="teacher">Teacher</option>
                            <option value="incharge">Incharge</option>
                            <option value="eca_teacher">ECA Teacher</option>
                            <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <select 
                          value={u.requestedGrade || ""} 
                          onChange={async (e) => {
                            const newGrade = e.target.value;
                            const q = query(collection(db, "users"), where("email", "==", u.email));
                            const snaps = await getDocs(q);
                            if (!snaps.empty) {
                              const batch = writeBatch(db);
                              snaps.docs.forEach((d) => {
                                batch.update(d.ref, { requestedGrade: newGrade });
                              });
                              await batch.commit();
                            }
                          }}
                          className="border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        >
                          <option value="">None / All</option>
                          {(config.gradeMappings || []).map((g: any) => (
                            <option key={g.grade} value={g.grade}>{g.grade}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1 max-w-sm">
                          {(() => {
                             const matched = subjects.flatMap((s: any) => 
                                (s.assignments || [])
                                  .filter((a: any) => String(a.teacherEmail || "").toLowerCase() === String(u.email || "").toLowerCase())
                                  .map((a: any) => `${s.name} (${a.gradeLevel} - ${a.section})`)
                             );
                             return matched.length > 0 ? (
                                matched.map((ast: string, i: number) => (
                                   <span key={i} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100">
                                      {ast}
                                   </span>
                                ))
                             ) : (
                                <span className="text-slate-400 italic text-xs">No classes assigned</span>
                             );
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                           u.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                           u.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                           'bg-slate-100 text-slate-600'
                        }`}>
                           {u.status || 'UNREGISTERED'}
                        </span>
                        {u.status !== 'approved' && (
                          <div className="flex space-x-1 ml-2">
                             <button
                               onClick={async () => {
                                 const q = query(collection(db, "users"), where("email", "==", u.email));
                                 const snaps = await getDocs(q);
                                 const batch = writeBatch(db);
                                 snaps.docs.forEach((d) => {
                                   batch.update(d.ref, { status: "approved" });
                                 });
                                 await batch.commit();

                                 // Auto-assign if requested
                                 if (u.role === "teacher" && u.requestedGrade && u.requestedSubject) {
                                    const subjStr = String(u.requestedSubject).toLowerCase().replace(/\s+/g, '-');
                                    const matchingSubject = subjects.find((s: any) => s.id.includes(subjStr) || s.name.toLowerCase() === String(u.requestedSubject).toLowerCase());
                                    if (matchingSubject) {
                                       const newAssignment = {
                                           teacherEmail: u.email,
                                           gradeLevel: u.requestedGrade,
                                           section: "All" // Default to All sections
                                       };
                                       const existing = matchingSubject.assignments || [];
                                       const isDup = existing.some((a: any) => a.teacherEmail === newAssignment.teacherEmail && a.gradeLevel === newAssignment.gradeLevel && a.section === newAssignment.section);
                                       if (!isDup) {
                                          await updateDoc(doc(db, "subjects", matchingSubject.id), { assignments: [...existing, newAssignment] });
                                          triggerLiveSyncInBg(accessToken, config.googleSpreadsheetId);
                                       }
                                    }
                                 }
                               }}
                               className="bg-emerald-600 text-white px-2 py-1 rounded text-xs font-semibold hover:bg-emerald-700"
                             >
                               Approve
                             </button>
                             <button
                               onClick={async () => {
                                 const q = query(collection(db, "users"), where("email", "==", u.email));
                                 const snaps = await getDocs(q);
                                 const batch = writeBatch(db);
                                 snaps.docs.forEach((d) => {
                                   batch.update(d.ref, { status: "rejected" });
                                 });
                                 await batch.commit();
                               }}
                               className="bg-rose-600 text-white px-2 py-1 rounded text-xs font-semibold hover:bg-rose-700"
                             >
                               Reject
                             </button>
                          </div>
                        )}
                        <button
                          onClick={async () => {
                             if(window.confirm(`Are you sure you want to remove user ${u.email}?`)) {
                                const q = query(collection(db, "users"), where("email", "==", u.email));
                                const snaps = await getDocs(q);
                                const batch = writeBatch(db);
                                snaps.docs.forEach((d) => {
                                  batch.delete(d.ref);
                                });
                                await batch.commit();
                             }
                          }}
                          className="ml-2 text-slate-400 hover:text-red-600 p-1 rounded transition-colors"
                          title="Delete User"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                            <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                          </svg>
                        </button>
                      </td>
                   </tr>
                 ))}
              </tbody>
           </table>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Grade &amp; Section Management</h2>
        
        <div className="mb-6 flex space-x-2 w-full md:w-1/2">
          <input value={newGrade} onChange={e => setNewGrade(e.target.value)} placeholder="e.g. Grade 1" className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full" />
          <button onClick={handleAddGrade} className="bg-blue-600 hover:bg-blue-700 transition text-white font-semibold text-sm px-4 py-2 rounded-lg">Add Grade</button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(config.gradeMappings || []).map((gm: {grade: string, sections: string[]}, gIdx: number) => (
            <div key={gIdx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative">
               <button onClick={() => handleRemoveGrade(gIdx)} className="absolute top-3 right-3 text-red-500 hover:text-red-700 font-bold">&times;</button>
               <h3 className="font-bold text-slate-800 text-lg mb-3">{gm.grade}</h3>
               
               <div className="mb-3 flex space-x-2">
                 <input value={newSectionMap[gIdx] || ""} onChange={e => setNewSectionMap(prev => ({...prev, [gIdx]: e.target.value}))} placeholder="Section e.g. A" className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full" />
                 <button onClick={() => handleAddSection(gIdx)} className="bg-slate-200 hover:bg-slate-300 transition text-slate-800 font-semibold text-sm px-3 py-1.5 rounded-lg">Add</button>
               </div>

               <div className="flex flex-wrap gap-2">
                 {(gm.sections || []).map((s: string, sIdx: number) => (
                   <span key={sIdx} className="bg-slate-100 border border-slate-200 px-2 py-1 rounded bg-blue-50 text-xs font-bold text-blue-700 flex items-center gap-2">
                      {s}
                      <button onClick={() => handleRemoveSection(gIdx, sIdx)} className="text-red-500 hover:text-red-700">&times;</button>
                   </span>
                 ))}
               </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Academic Subject Management</h2>
          <form onSubmit={e => addSubject(e, "academic")} className="mb-4 space-y-3 bg-slate-50 p-4 border border-slate-200 rounded-xl shadow-sm">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Subject Name</label>
              <input value={newSubj} onChange={e => setNewSubj(e.target.value)} placeholder="Academic Subject Name..." className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full bg-white font-medium" required />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Grade Level</label>
              <select value={newSubjGrade} onChange={e => setNewSubjGrade(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium">
                <option value="General">General (All Grades)</option>
                {(config.gradeMappings || []).map((g: any) => (
                  <option key={g.grade} value={g.grade}>{g.grade}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 transition w-full text-white font-semibold text-sm px-4 py-2 rounded-lg cursor-pointer">Add Academic Subject</button>
          </form>
          <div className="flex flex-wrap gap-2">
            {subjects.filter(s => s.type === "academic").map(s => (
              <span key={s.id} className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-sm font-bold text-slate-700 shadow-sm flex items-center gap-2">
                <span>{s.name} <span className="text-[10px] font-semibold text-blue-600 uppercase">({s.gradeLevel || "General"})</span></span>
                <button type="button" onClick={() => handleDeleteSubject(s.id)} className="text-slate-400 hover:text-red-500 cursor-pointer" title="Delete subject">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
              </span>
            ))}
          </div>
        </div>
        
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">ECA Subject Management</h2>
          <form onSubmit={e => addSubject(e, "eca")} className="mb-4 space-y-3 bg-slate-50 p-4 border border-slate-200 rounded-xl shadow-sm">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">ECA Activity Name</label>
              <input value={newEca} onChange={e => setNewEca(e.target.value)} placeholder="ECA Activity Name..." className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full bg-white font-medium" required />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Grade Level</label>
              <select value={newEcaGrade} onChange={e => setNewEcaGrade(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium">
                <option value="General">General (All Grades)</option>
                {(config.gradeMappings || []).map((g: any) => (
                  <option key={g.grade} value={g.grade}>{g.grade}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase text-slate-500 block">Grading Criteria (5-7 item max)</label>
              <div className="space-y-1">
                 {ecaCriteria.map((crit, idx) => (
                   <input 
                     key={idx} 
                     value={crit} 
                     onChange={e => {
                       const newCrit = [...ecaCriteria];
                       newCrit[idx] = e.target.value;
                       setEcaCriteria(newCrit);
                     }} 
                     placeholder={`Criterion ${idx + 1}...`} 
                     className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm examine-box focus:ring-2 focus:ring-blue-500 outline-none w-full bg-white"
                   />
                 ))}
              </div>
              {ecaCriteria.length < 7 && (
                <button type="button" onClick={() => setEcaCriteria([...ecaCriteria, ""])} className="text-blue-600 text-xs font-bold hover:underline cursor-pointer block mt-1">+ Add Criterion</button>
              )}
            </div>
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 transition w-full text-white font-semibold text-sm px-4 py-2 rounded-lg cursor-pointer">Add ECA Activity</button>
          </form>
          <div className="flex flex-wrap gap-2">
            {subjects.filter(s => s.type === "eca").map(s => (
              <span key={s.id} className="bg-white border border-slate-200 pl-3 pr-2 py-1.5 rounded-lg text-sm font-bold text-slate-700 shadow-sm flex items-start gap-3">
                <div className="flex flex-col">
                  <span>{s.name} <span className="text-[10px] font-semibold text-blue-600 uppercase">({s.gradeLevel || "General"})</span></span>
                  <span className="text-[10px] text-slate-400 font-normal">{s.ecaCriteria?.length || 0} criteria</span>
                </div>
                <button type="button" onClick={() => handleDeleteSubject(s.id)} className="text-slate-400 hover:text-red-500 cursor-pointer mt-0.5" title="Delete activity">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Class &amp; Subject Teacher Assignments</h2>
        <form onSubmit={handleAddAssignment} className="mb-4 flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Teacher</label>
            <select required value={assignTeacher} onChange={e => setAssignTeacher(e.target.value)} className="w-48 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="" disabled>Select Teacher</option>
              {users.filter(u => ['teacher', 'eca_teacher'].includes(u.role)).map(u => <option key={u.email} value={u.email}>{u.email}</option>)}
            </select>
          </div>
          <div>
             <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Subject</label>
             <select required value={assignSubject} onChange={e => setAssignSubject(e.target.value)} className="w-48 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
               <option value="" disabled>Select Subject</option>
               {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.gradeLevel || "General"}) ({s.type})</option>)}
             </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Grade</label>
            <select required value={assignGrade} onChange={e => {setAssignGrade(e.target.value); setAssignSection("");}} className="w-32 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="" disabled>Select Grade</option>
              <option value="All">All Grades</option>
              {(config.gradeMappings || []).map((g: any) => <option key={g.grade} value={g.grade}>{g.grade}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Section</label>
            <select required value={assignSection} onChange={e => setAssignSection(e.target.value)} className="w-32 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="" disabled>Select Section</option>
              <option value="All">All Sections</option>
              {assignGrade && assignGrade !== "All" && (config.gradeMappings || []).find((g: any) => g.grade === assignGrade)?.sections.map((s: string) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 transition text-white font-semibold text-sm px-4 py-2 rounded-lg">Assign Teacher</button>
        </form>

        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
           <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 text-xs uppercase tracking-wider">
                 <tr>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Assignments</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                 {subjects.map(s => (
                   <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${s.type === 'eca' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{s.type}</span>
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <div className="flex flex-col gap-1 py-1">
                          {(!s.assignments || s.assignments.length === 0) ? (
                            <span className="text-slate-400 italic text-xs">No teachers assigned</span>
                          ) : (
                            s.assignments.map((a: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-1 rounded flex items-center gap-3">
                                  <span className="font-semibold text-slate-900">{a.teacherEmail}</span>
                                  <span className="text-slate-500 text-xs">| {a.gradeLevel} - {a.section}</span>
                                  <button onClick={() => removeAssignment(s.id, idx)} className="text-red-500 hover:text-red-700 ml-1 font-bold">&times;</button>
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </td>
                   </tr>
                 ))}
                 {subjects.length === 0 && (
                   <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500">No subjects currently available. Add a subject first.</td></tr>
                 )}
              </tbody>
           </table>
        </div>
      </div>

    </div>
  );
}
