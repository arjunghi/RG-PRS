import React, { useState, useEffect } from "react";
import { useAuth } from "../lib/AuthContext";
import { Navigate } from "react-router-dom";
import { LogOut, Send, Clock, AlertCircle } from "lucide-react";
import { db } from "../lib/firebaseClient";
import { doc, getDoc, collection, getDocs, setDoc } from "firebase/firestore";

export default function RegistrationPage() {
  const { user, signOut, loading } = useAuth();
  const [role, setRole] = useState("teacher");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [config, setConfig] = useState<any>({ grades: [], subjects: [] });

  useEffect(() => {
    // Load config for grades/subjects dropdowns if role is teacher
    if (role === "teacher") {
      const loadData = async () => {
        try {
          const docRef = doc(db, "settings", "schoolConfig");
          const snap = await getDoc(docRef);
          let gradesList: string[] = [];
          if (snap.exists()) {
            gradesList = snap.data().gradeMappings?.map((g: any) => g.grade) || [];
          }
          
          const subjSnap = await getDocs(collection(db, "subjects"));
          const subjectsList = subjSnap.docs.map(d => d.data().name).filter(Boolean);
          
          setConfig({ grades: gradesList, subjects: Array.from(new Set(subjectsList)) });
        } catch (err) {
          console.error("Failed to load school config", err);
        }
      };
      
      loadData();
    }
  }, [role]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.status === "approved") return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    // Optional email check
    // if (!user.email?.endsWith("@rajarshigurukul.edu.np")) {
    //  setSubmitError("You must use a @rajarshigurukul.edu.np email address.");
    //  return;
    // }

    setIsSubmitting(true);
    try {
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        role,
        requestedGrade: role === "teacher" ? grade : null,
        requestedSubject: role === "teacher" ? subject : null,
        status: "pending",
        requestedAt: new Date().toISOString()
      }, { merge: true });
      // Optionally update email-keyed doc if needed
      if (user.email) {
        const emailRef = doc(db, "users", user.email);
        const emailSnap = await getDoc(emailRef);
        if (emailSnap.exists()) {
           await setDoc(emailRef, {
              role,
              requestedGrade: role === "teacher" ? grade : null,
              requestedSubject: role === "teacher" ? subject : null,
              status: "pending",
              requestedAt: new Date().toISOString()
           }, { merge: true });
        }
      }
      
      // Update local storage status
      localStorage.setItem(`app_user_role_${user.uid}_status`, "pending");
      localStorage.setItem(`app_user_role_${user.uid}`, role);

      // Force page reload to sync context
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      setSubmitError(err.message || "Failed to submit request.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden p-8 space-y-6">
        
        {user.status === "pending" ? (
          <div className="text-center space-y-4">
             <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-500 flex items-center justify-center rounded-full mb-2">
                <Clock className="w-8 h-8 animate-pulse" />
             </div>
             <h2 className="text-xl font-bold text-slate-900">Request Pending</h2>
             <p className="text-sm font-medium text-slate-600">
               Your access request is currently pending administrator approval. We will notify you once arjun@rajarshigurukul.edu.np reviews your request.
             </p>
             <button
                onClick={signOut}
                className="mt-6 inline-flex items-center space-x-2 text-sm text-slate-500 hover:text-slate-800 font-semibold"
             >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
             </button>
          </div>
        ) : (
          <>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Complete Profile</h1>
              <p className="text-slate-500 font-medium text-sm mt-2">
                Select your role to request access to the system.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Select Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                >
                  <option value="teacher">Teacher</option>
                  <option value="incharge">Incharge</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {role === "teacher" && (
                <div className="space-y-4 border-t border-slate-100 pt-4 mt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Teaching Profile</p>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Primary Grade Taught</label>
                    <select
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      // required
                    >
                      <option value="" disabled>Select a grade</option>
                      {config.grades.length > 0 ? (
                        config.grades.map((g: string) => <option key={g} value={g}>{g}</option>)
                      ) : (
                        <>
                          <option value="Grade 1">Grade 1</option>
                          <option value="Grade 2">Grade 2</option>
                          <option value="Grade 3">Grade 3</option>
                          <option value="Grade 4">Grade 4</option>
                          <option value="Grade 5">Grade 5</option>
                          <option value="Grade 6">Grade 6</option>
                          <option value="Grade 7">Grade 7</option>
                          <option value="Grade 8">Grade 8</option>
                          <option value="Grade 9">Grade 9</option>
                          <option value="Grade 10">Grade 10</option>
                        </>
                      )}
                      <option value="Multiple">Multiple Grades</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Primary Subject</label>
                    <input
                      type="text"
                      list="subjectsList"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Science"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      // required
                    />
                    <datalist id="subjectsList">
                       {config.subjects.length > 0 ? (
                         config.subjects.map((s: string) => <option key={s} value={s} />)
                       ) : (
                         <>
                           <option value="Math" />
                           <option value="Science" />
                           <option value="English" />
                           <option value="Nepali" />
                           <option value="Social Studies" />
                           <option value="Computer" />
                           <option value="ECA" />
                         </>
                       )}
                    </datalist>
                  </div>
                </div>
              )}

              {submitError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-lg flex items-start gap-2">
                   <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                   <span>{submitError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-6 bg-slate-900 hover:bg-black disabled:bg-slate-500 text-white px-6 py-3 rounded-xl text-sm font-semibold flex items-center justify-center space-x-2 transition-all shadow-md focus:ring-4 focus:ring-slate-200 outline-none"
              >
                {isSubmitting ? (
                  <span>Submitting...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Request Access</span>
                  </>
                )}
              </button>
              
              <div className="text-center">
                 <button
                    type="button"
                    onClick={signOut}
                    className="inline-flex items-center space-x-2 text-xs text-slate-400 hover:text-slate-600 font-semibold"
                 >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Cancel & Sign Out</span>
                 </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
