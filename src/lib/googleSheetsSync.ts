import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "./firebaseClient";

// Helper keys for Sheet naming
export const STUDENTS_SHEET = "Students";
export const SUBJECTS_SHEET = "Subjects";
export const TASKS_SHEET = "Tasks";
export const SCORES_SHEET = "Scores";
export const CONFIG_SHEET = "School Config";

/**
 * Creates a new Google Spreadsheet via the safe Express server proxy.
 */
export async function createSpreadsheet(accessToken: string, title: string): Promise<{ id: string; url: string }> {
  try {
    const response = await fetch("/api/sheets/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accessToken, title }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let parsedErr = errText;
      try {
        const json = JSON.parse(errText);
        parsedErr = json.error || errText;
      } catch (_) {}
      throw new Error(parsedErr);
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating Google Spreadsheet via Server Proxy:", error);
    throw error;
  }
}

/**
 * Synchronizes all Firestore data into the connected Google Sheet using the secure, optimized Server-side proxy.
 */
export async function syncAllFirestoreToSheets(accessToken: string, spreadsheetId: string): Promise<void> {
  if (!spreadsheetId || !accessToken) {
    throw new Error("Missing Spreadsheet ID or Access Token for synchronization.");
  }

  // 1. Fetch all Firestore data in parallel on the client side
  const [studentsSnap, subjectsSnap, tasksSnap, scoresSnap, configSnap] = await Promise.all([
    getDocs(collection(db, "students")),
    getDocs(collection(db, "subjects")),
    getDocs(collection(db, "tasks")),
    getDocs(collection(db, "scores")),
    getDocs(collection(db, "settings")),
  ]);

  // Translate 1a. Students
  const students = studentsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  const studentRows = [
    ["Student ID", "Name", "Grade Level", "Section", "ECA Sports", "Created At"],
    ...students.map((s) => [
      s.id,
      s.name || "",
      s.gradeLevel || "",
      s.section || "",
      (s.ecaSports || []).join(", "),
      s.createdAt || "",
    ])
  ];

  // Translate 1b. Subjects
  const subjects = subjectsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  const subjectRows = [
    ["Subject ID", "Name", "Type", "ECA Criteria", "Assignments"],
    ...subjects.map((s) => [
      s.id,
      s.name || "",
      s.type || "",
      (s.ecaCriteria || []).join(", "),
      JSON.stringify(s.assignments || []),
    ])
  ];

  // Translate 1c. Tasks (Merge academic tasks + virtual ECA criteria rows)
  const tasks = tasksSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  const taskRows = [
    ["Task ID", "Name", "Max Marks", "Task Type", "Term", "Date", "Subject ID", "Created At", "Updated At"],
    ...tasks.map((t) => [
      t.id,
      t.name || "",
      String(t.maxMarks || ""),
      t.taskType || "",
      t.term || "",
      t.date || "",
      t.subjectId || "",
      t.createdAt || "",
      t.updatedAt || "",
    ])
  ];

  // Append virtual ECA rubric criteria so they are discoverable as eval "Tasks"
  subjects.filter(sub => sub.type === "eca").forEach(sub => {
    (sub.ecaCriteria || []).forEach((crit: string) => {
      taskRows.push([
        crit,                       // Task ID (matching score taskId)
        crit,                       // Name
        "Grade",                    // Max Marks (ECA is Letter Graded)
        "ECA",                      // Task Type
        "All",                      // Term
        "N/A",                      // Date
        sub.id,                     // Subject ID
        "N/A",                      // Created At
        "N/A",                      // Updated At
      ]);
    });
  });

  // Translate 1d. Scores
  const scores = scoresSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  const scoreRows = [
    ["Score ID", "Student ID", "Task ID", "Subject ID", "Score", "Updated At"],
    ...scores.map((sc) => [
      sc.id,
      sc.studentId || "",
      sc.taskId || "",
      sc.subjectId || "",
      String(sc.score ?? ""),
      sc.updatedAt || "",
    ])
  ];

  // Translate 1e. School Config (Grade mapping)
  const configDoc = configSnap.docs.find((d) => d.id === "schoolConfig");
  const gradeMappings = configDoc ? (configDoc.data()?.gradeMappings || []) : [];
  const configRows = [
    ["Grade", "Sections"],
    ...gradeMappings.map((g: any) => [
      g.grade || "",
      (g.sections || []).join(", "),
    ])
  ];

  // Translate 1f. Consolidated Reports Summary Sheet (Calculates academic % and logs ECA criteria)
  const reportRows = [
    ["Student ID", "Student Name", "Grade Level", "Section", "Academic Performance [Subject: % (Grade)]", "ECA Performance [Sport Criteria Grades]"],
    ...students.map((st) => {
      // Compile Academic Summaries
      const academicSummaries: string[] = [];
      subjects.filter(s => s.type === "academic").forEach(subj => {
        const subjTasks = tasks.filter(t => t.subjectId === subj.id);
        if (subjTasks.length === 0) return;

        let obtained = 0;
        let maxTotal = 0;
        let hasScores = false;

        subjTasks.forEach(t => {
          const scoreRec = scores.find(x => x.studentId === st.id && x.taskId === t.id && x.subjectId === subj.id);
          if (scoreRec && typeof scoreRec.score === "number") {
            obtained += scoreRec.score;
            maxTotal += Number(t.maxMarks || 0);
            hasScores = true;
          }
        });

        if (hasScores && maxTotal > 0) {
          const percent = (obtained / maxTotal) * 100;
          let letterGrade = "-";
          if (percent >= 90) letterGrade = "A+";
          else if (percent >= 80) letterGrade = "A";
          else if (percent >= 70) letterGrade = "B+";
          else if (percent >= 60) letterGrade = "B";
          else if (percent >= 50) letterGrade = "C+";
          else if (percent >= 40) letterGrade = "C";
          else letterGrade = "NG";

          academicSummaries.push(`${subj.name}: ${percent.toFixed(1)}% (${letterGrade})`);
        }
      });

      // Compile ECA Summaries
      const ecaSummaries: string[] = [];
      subjects.filter(sub => sub.type === "eca").forEach(sub => {
        if (st.ecaSports && st.ecaSports.includes(sub.id)) {
          const criteriaGrades = (sub.ecaCriteria || []).map((crit: string) => {
            const scoreRec = scores.find(x => x.studentId === st.id && x.taskId === crit && x.subjectId === sub.id);
            return `${crit}: ${scoreRec?.score || "-"}`;
          });
          ecaSummaries.push(`${sub.name}: [${criteriaGrades.join(", ")}]`);
        }
      });

      return [
        st.id,
        st.name || "",
        st.gradeLevel || "",
        st.section || "",
        academicSummaries.join(" • ") || "No academic records",
        ecaSummaries.join(" • ") || "No ECA records",
      ];
    })
  ];

  // 1g. Establish the base worksheets payload
  const worksheetsPayload: Record<string, any[][]> = {
    "Students": studentRows,
    "Subjects": subjectRows,
    "Tasks": taskRows,
    "Scores": scoreRows,
    "School Config": configRows,
    "Reports": reportRows,
  };

  // 1h. Dynamically create custom Marks Entry ledger tabs for each unique Grade Level
  const allGrades = Array.from(new Set([
    ...gradeMappings.map((gm: any) => gm.grade),
    ...students.map(st => st.gradeLevel).filter(Boolean)
  ])).sort();

  allGrades.forEach(grade => {
    const gradeStudents = students.filter(st => st.gradeLevel === grade);
    
    const gradeMarksRows = [
      ["Student Name", "Section", "Subject Name", "Task/Criteria Evaluated", "Evaluation Type", "Score / Grade Code", "Last Updated"],
      ...gradeStudents.flatMap(st => {
        const studentScores = scores.filter(sc => sc.studentId === st.id);
        
        if (studentScores.length === 0) {
          return [[
            st.name || "",
            st.section || "",
            "N/A",
            "No academic or ECA entries yet",
            "-",
            "-",
            "-"
          ]];
        }

        return studentScores.map(sc => {
          const sObj = subjects.find(s => s.id === sc.subjectId);
          const subjectName = sObj ? sObj.name : (sc.subjectId || "");
          const taskObj = tasks.find(t => t.id === sc.taskId && t.subjectId === sc.subjectId);
          const taskLabel = taskObj ? taskObj.name : (sc.taskId || "");
          const maxMarksLabel = sObj?.type === "eca" ? "Letter Grade (ECA)" : (taskObj ? `Out of ${taskObj.maxMarks}` : "-");
          return [
            st.name || "",
            st.section || "",
            subjectName,
            taskLabel,
            maxMarksLabel,
            String(sc.score ?? ""),
            sc.updatedAt ? new Date(sc.updatedAt).toLocaleString() : "N/A"
          ];
        });
      })
    ];

    // Ensure tab names obey Google Sheets max-limit size (31 characters)
    const sheetTabName = `${grade} Marks`.slice(0, 31);
    worksheetsPayload[sheetTabName] = gradeMarksRows;
  });

  // 2. Transmit to secure, high-speed server proxy to do the clearing and writing with Node
  const response = await fetch("/api/sheets/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      accessToken,
      spreadsheetId,
      worksheets: worksheetsPayload,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    let parsedErr = errText;
    try {
      const json = JSON.parse(errText);
      parsedErr = json.error || errText;
    } catch (_) {}
    throw new Error(parsedErr);
  }
}

/**
 * Saves connected Spreadsheet ID & info to Firebase School Config so all users share it.
 */
export async function saveSheetConnection(spreadsheetId: string, spreadsheetUrl: string): Promise<void> {
  await setDoc(
    doc(db, "settings", "schoolConfig"),
    {
      googleSpreadsheetId: spreadsheetId,
      googleSpreadsheetUrl: spreadsheetUrl,
      googleSyncLastTime: new Date().toISOString(),
    },
    { merge: true }
  );
}

// Background debounce queues to prevent duplicate and overlapping sync worker requests
let syncTimeout: any = null;
let isSyncInProgress = false;
let hasPendingSyncRequest = false;
let lastAccessToken: string | null = null;
let lastSpreadsheetId: string | null = null;

async function executeQueuedSync() {
  if (isSyncInProgress) {
    hasPendingSyncRequest = true;
    return;
  }

  if (!lastAccessToken || !lastSpreadsheetId) return;

  isSyncInProgress = true;
  hasPendingSyncRequest = false;

  try {
    console.log("Starting batched background Google Sheets auto-sync via server proxy...");
    await syncAllFirestoreToSheets(lastAccessToken, lastSpreadsheetId);
    console.log("Background Google Sheets auto-sync completed successfully.");
    
    // Log last sync update to Firestore to keep timestamps cohesive
    await setDoc(doc(db, "settings", "schoolConfig"), {
      googleSyncLastTime: new Date().toISOString()
    }, { merge: true });
    
  } catch (err) {
    console.error("Background Google Sheets auto-sync encountered an error:", err);
  } finally {
    isSyncInProgress = false;
    if (hasPendingSyncRequest) {
      // If a request came during sync execution, trigger again
      executeQueuedSync();
    }
  }
}

/**
 * Triggers background collection synchronization when data changes if active session has OAuth token
 */
export function triggerLiveSyncInBg(accessToken: string | null, spreadsheetId: string | null) {
  if (!accessToken || !spreadsheetId) {
    console.log("Auto-sync skipped: Missing active accessToken or Google Spreadsheet ID connection.");
    return;
  }

  lastAccessToken = accessToken;
  lastSpreadsheetId = spreadsheetId;

  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  // Debounce for 3 seconds to aggregate quick succession events like adding multiple records, typing score grades or adding subjects
  syncTimeout = setTimeout(() => {
    executeQueuedSync();
  }, 3000);
}

/**
 * Reads all data from the connected Spreadsheet worksheets and populates them into Firestore
 */
export async function importSheetsConfirmAndSync(accessToken: string, spreadsheetId: string): Promise<{
  studentsCount: number;
  subjectsCount: number;
  tasksCount: number;
  scoresCount: number;
  gradeMappingsCount: number;
}> {
  if (!spreadsheetId || !accessToken) {
    throw new Error("Missing Spreadsheet ID or Access token for import.");
  }

  const response = await fetch("/api/sheets/read", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ accessToken, spreadsheetId }),
  });

  if (!response.ok) {
    const errText = await response.text();
    let parsedErr = errText;
    try {
      const json = JSON.parse(errText);
      parsedErr = json.error || errText;
    } catch (_) {}
    throw new Error(parsedErr);
  }

  const data = await response.json();
  const { students, subjects, tasks, scores, gradeMappings } = data;

  // Let's do imports sequentially or securely in parallel batches

  // 1. Write School config
  if (gradeMappings && gradeMappings.length > 0) {
    await setDoc(doc(db, "settings", "schoolConfig"), { gradeMappings }, { merge: true });
  }

  // 2. Write Students
  if (students && students.length > 0) {
    const studentPromises = students.map(async (st: any) => {
      const docId = st.id || doc(collection(db, "students")).id;
      await setDoc(doc(db, "students", docId), {
        name: st.name,
        gradeLevel: st.gradeLevel,
        section: st.section,
        ecaSports: st.ecaSports || [],
        createdAt: st.createdAt
      });
    });
    await Promise.all(studentPromises);
  }

  // 3. Write Subjects
  if (subjects && subjects.length > 0) {
    const subjectPromises = subjects.map(async (sub: any) => {
      await setDoc(doc(db, "subjects", sub.id), {
        name: sub.name,
        type: sub.type,
        ecaCriteria: sub.ecaCriteria || [],
        assignments: sub.assignments || []
      });
    });
    await Promise.all(subjectPromises);
  }

  // 4. Write Tasks
  if (tasks && tasks.length > 0) {
    const taskPromises = tasks.map(async (tk: any) => {
      await setDoc(doc(db, "tasks", tk.id), {
        name: tk.name,
        maxMarks: tk.maxMarks,
        taskType: tk.taskType,
        term: tk.term,
        date: tk.date,
        subjectId: tk.subjectId,
        createdAt: tk.createdAt,
        updatedAt: tk.updatedAt
      });
    });
    await Promise.all(taskPromises);
  }

  // 5. Write Scores
  if (scores && scores.length > 0) {
    const scorePromises = scores.map(async (sc: any) => {
      await setDoc(doc(db, "scores", sc.id), {
        studentId: sc.studentId,
        taskId: sc.taskId,
        subjectId: sc.subjectId,
        score: sc.score,
        updatedAt: sc.updatedAt
      });
    });
    await Promise.all(scorePromises);
  }

  // Save the connection after a successful import
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  await saveSheetConnection(spreadsheetId, spreadsheetUrl);

  return {
    studentsCount: (students || []).length,
    subjectsCount: (subjects || []).length,
    tasksCount: (tasks || []).length,
    scoresCount: (scores || []).length,
    gradeMappingsCount: (gradeMappings || []).length,
  };
}
