import React, { useState, useEffect } from "react";
import { db } from "../lib/firebaseClient";
import { collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc } from "firebase/firestore";
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
  const [newEca, setNewEca] = useState("");
  const [ecaCriteria, setEcaCriteria] = useState<string[]>(["", "", "", "", ""]);
  
  const [newTeacherEmail, setNewTeacherEmail] = useState("");
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

  const changeRole = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
    } catch(err) {
      handleFirestoreError(err, OperationType.UPDATE, "users");
    }
  }

  const addInvitedTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!newTeacherEmail) return;
    try {
      const email = newTeacherEmail.toLowerCase().trim();
      await setDoc(doc(db, "users", email), {
        email: email,
        name: email, // Placeholder until they sign in
        role: "teacher",
        createdAt: new Date().toISOString()
      });
      setNewTeacherEmail("");
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
       assignments.push({
           teacherEmail: assignTeacher,
           gradeLevel: assignGrade,
           section: assignSection
       });
       await updateDoc(doc(db, "subjects", assignSubject), { assignments });
       
       setAssignTeacher("");
       setAssignSubject("");
       setAssignGrade("");
       setAssignSection("");
       triggerLiveSyncInBg(accessToken, config.googleSpreadsheetId);
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
      const sId = (type + "-" + name).toLowerCase().replace(/\s+/g, '-');
      
      const payload: any = {
         name: name,
         type: type,
         gradeLevel: "General",
         teacherEmails: [],
         assignments: []
      };
      
      if(type === "eca") {
         payload.ecaCriteria = ecaCriteria.filter(c => c.trim() !== "");
      }

      await setDoc(doc(db, "subjects", sId), payload);
      
      if(type === "academic") setNewSubj("");
      else {
         setNewEca("");
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
      
      if (accessToken) {
        setSyncStatus({ type: "info", message: "Spreadsheet linked! Reading existing worksheets and auto-importing data..." });
        const result = await importSheetsConfirmAndSync(accessToken, sId);
        setSyncStatus({ 
          type: "success", 
          message: `Spreadsheet linked & auto-imported successfully! Read ${result.studentsCount} students, ${result.subjectsCount} subjects, ${result.tasksCount} tasks, and ${result.scoresCount} scores into your app database.` 
        });
      } else {
        await saveSheetConnection(sId, spreadsheetUrl);
        setSyncStatus({ type: "success", message: "Spreadsheet linked successfully! Connect your Google Account above to import and synchronize databases." });
      }
    } catch (err: any) {
      console.error(err);
      setSyncStatus({ type: "error", message: `Failed to link and import spreadsheet: ${err.message || err}` });
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
      {/* Google Sheets Synchronization Panel */}
      <div className="bg-gradient-to-b from-blue-50 to-white rounded-2xl border border-blue-100 p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-600 text-white p-2 rounded-xl shadow-md shadow-emerald-100">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 leading-tight">Google Sheets Master Storage</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Automated real-time write-through database synchronization</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {!accessToken ? (
              <button
                onClick={handleConnectGoogle}
                className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs px-4 py-2 rounded-lg transition shadow-sm flex items-center space-x-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin-slow" />
                <span>Authorize Google Session</span>
              </button>
            ) : (
              <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Authorized Active Token</span>
              </span>
            )}
            
            {config.googleSpreadsheetId && (
              <>
                <button
                  onClick={handlePullFromSheet}
                  disabled={isSyncing}
                  className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-semibold text-xs px-4 py-2 rounded-lg transition shadow-sm flex items-center space-x-2 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                  <span>{isSyncing ? "Importing..." : "Import Sheet Data"}</span>
                </button>
                <button
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold text-xs px-4 py-2 rounded-lg transition shadow-sm flex items-center space-x-2 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                  <span>{isSyncing ? "Syncing..." : "Force Full Sync"}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Sync Status Feedback Banner */}
        {syncStatus.type && (
          <div className={`p-4 rounded-xl text-xs font-semibold flex items-start space-x-2.5 shadow-sm border ${
            syncStatus.type === "success" 
              ? "bg-emerald-50 border-emerald-150 text-emerald-800" 
              : syncStatus.type === "error" 
              ? "bg-rose-50 border-rose-150 text-rose-800" 
              : "bg-blue-50 border-blue-150 text-blue-800"
          }`}>
            {syncStatus.type === "success" ? (
              <Check className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
            ) : syncStatus.type === "error" ? (
              <AlertTriangle className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <RefreshCw className="w-4.5 h-4.5 text-blue-600 shrink-0 animate-spin mt-0.5" />
            )}
            <div>{syncStatus.message}</div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6 items-stretch">
          {/* Linked Spreadsheet Details Or Creation Control */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 flex flex-col justify-between">
            {config.googleSpreadsheetId ? (
              <div className="space-y-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Connected Spreadsheet</div>
                
                <div className="flex items-start space-x-3.5 py-1">
                  <div className="bg-emerald-100 text-emerald-800 p-2.5 rounded-lg">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate">Rajarshi Gurukul Student &amp; Grading Records</h3>
                    <p className="text-xs text-slate-500 font-mono select-all truncate mt-0.5">Spreadsheet ID: {config.googleSpreadsheetId}</p>
                  </div>
                </div>

                {config.googleSyncLastTime && (
                  <div className="text-[11px] text-slate-500 font-medium">
                    Last synchronized: <span className="text-slate-800 font-semibold">{new Date(config.googleSyncLastTime).toLocaleString()}</span>
                  </div>
                )}

                <div className="flex items-center space-x-2 pt-2">
                  <a
                    href={config.googleSpreadsheetUrl}
                    target="_blank"
                    referrerPolicy="no-referrer"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-black border border-slate-200 text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm"
                  >
                    <span>Open Sheet in Drive</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={handleDisconnectSheet}
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs font-semibold px-3 py-2 rounded-lg transition cursor-pointer"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Initialize Google Sheet</div>
                <h3 className="font-semibold text-slate-900">No Master Spreadsheet Connected</h3>
                <p className="text-xs text-slate-500 leading-normal">
                  Create a five-tab dedicated Spreadsheet directly in your drive. Once initialized, all records inside the app will push and sync automatically.
                </p>
                <div className="pt-2">
                  <button
                    onClick={handleCreateNewSheet}
                    disabled={isSyncing}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold text-xs px-4 py-2 rounded-lg transition shadow-sm inline-flex items-center space-x-1.5 cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Create New Spreadsheet</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Link Existing Spreadsheet */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 flex flex-col justify-between">
            <div className="space-y-3.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Link Existing Spreadsheet</div>
              <h3 className="font-semibold text-slate-900">Connect to an Existing Sheets ID</h3>
              <p className="text-[11px] text-slate-500 leading-normal">
                Connecting a single Master Sheet for all users requires a backend Service Account configuration. The app will bypass user-specific authentication and write directly using these credentials.
              </p>
              
              <div className="flex gap-2 pt-1.5">
                <input
                  type="text"
                  value={sheetInputId}
                  onChange={(e) => setSheetInputId(e.target.value)}
                  placeholder="Paste URL or Spreadsheet ID here..."
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 flex-1 shrink-0"
                />
                <button
                  onClick={handleLinkExistingSheet}
                  disabled={isSyncing || !sheetInputId.trim()}
                  className="bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white font-semibold text-xs px-4 py-1.5 rounded-lg transition shrink-0 cursor-pointer"
                >
                  Link Sheet
                </button>
              </div>
            </div>
            
            <div className="text-[10px] text-slate-400 font-medium leading-relaxed mt-4">
              Note: Make sure your connected Service Account email is added as an 'Editor' on the pasted Google Spreadsheet.
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between mb-4 gap-4">
          <h2 className="text-xl font-bold text-slate-900">Platform Users & Roles</h2>
          <form onSubmit={addInvitedTeacher} className="flex space-x-2">
            <input type="email" value={newTeacherEmail} onChange={e => setNewTeacherEmail(e.target.value)} placeholder="Teacher Email Address..." className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64" required />
            <button type="submit" className="bg-slate-900 hover:bg-black transition text-white font-semibold text-sm px-4 py-1.5 rounded-lg">Pre-register Teacher</button>
          </form>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
           <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                 <tr>
                   <th className="px-4 py-3">Email</th>
                   <th className="px-4 py-3">Name</th>
                   <th className="px-4 py-3">Role Configuration</th>
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
                          onChange={(e) => changeRole(u.id, e.target.value)}
                          className="border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        >
                            <option value="student">Student</option>
                            <option value="staff">Staff</option>
                            <option value="teacher">Teacher</option>
                            <option value="eca_teacher">ECA Teacher</option>
                            <option value="admin">Admin</option>
                        </select>
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
          <form onSubmit={e => addSubject(e, "academic")} className="mb-4 flex space-x-2">
            <input value={newSubj} onChange={e => setNewSubj(e.target.value)} placeholder="Academic Subject Name..." className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full" required />
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 transition text-white font-semibold text-sm px-4 py-2 rounded-lg">Add</button>
          </form>
          <div className="flex flex-wrap gap-2">
            {subjects.filter(s => s.type === "academic").map(s => (
              <span key={s.id} className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-sm font-bold text-slate-700 shadow-sm flex items-center gap-2">
                <span>{s.name}</span>
                <button type="button" onClick={() => handleDeleteSubject(s.id)} className="text-slate-400 hover:text-red-500 cursor-pointer" title="Delete subject">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
              </span>
            ))}
          </div>
        </div>
        
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">ECA Subject Management</h2>
          <form onSubmit={e => addSubject(e, "eca")} className="mb-4 space-y-3 bg-slate-50 p-4 border border-slate-200 rounded-xl">
            <input value={newEca} onChange={e => setNewEca(e.target.value)} placeholder="ECA Activity Name..." className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full" required />
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase text-slate-500">Grading Criteria (5-7 item max)</label>
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
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full"
                />
              ))}
              {ecaCriteria.length < 7 && (
                <button type="button" onClick={() => setEcaCriteria([...ecaCriteria, ""])} className="text-blue-600 text-xs font-bold hover:underline">+ Add Criterion</button>
              )}
            </div>
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 transition w-full text-white font-semibold text-sm px-4 py-2 rounded-lg">Add ECA Activity</button>
          </form>
          <div className="flex flex-wrap gap-2">
            {subjects.filter(s => s.type === "eca").map(s => (
              <span key={s.id} className="bg-white border border-slate-200 pl-3 pr-2 py-1.5 rounded-lg text-sm font-bold text-slate-700 shadow-sm flex items-start gap-3">
                <div className="flex flex-col">
                  <span>{s.name}</span>
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
               {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.type})</option>)}
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

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
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
