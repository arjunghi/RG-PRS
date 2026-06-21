import fs from "fs";
import path from "path";

const DB_FILE = path.join(process.cwd(), "data-store.json");

interface DBState {
  students: any[];
  tasks: any[];
  subjects: any[];
  scores: any[];
  users: any[];
  settings: Record<string, any>;
  staff_chat: any[];
}

const DEFAULT_STATE: DBState = {
  students: [
    {
      id: "student_std_01",
      name: "Aarav Sharma",
      gradeLevel: "Grade 10",
      section: "Section A",
      ecaSports: ["Football"],
      createdAt: new Date().toISOString()
    },
    {
      id: "student_std_02",
      name: "Prisha Adhikari",
      gradeLevel: "Grade 10",
      section: "Section A",
      ecaSports: ["Table Tennis"],
      createdAt: new Date().toISOString()
    },
    {
      id: "student_std_03",
      name: "Siddharth Thapa",
      gradeLevel: "Grade 10",
      section: "Section B",
      ecaSports: ["Chess"],
      createdAt: new Date().toISOString()
    }
  ],
  tasks: [
    {
      id: "task_01",
      title: "Class Presentation 1",
      subjectId: "subj_eng",
      gradeLevel: "Grade 10",
      section: "Section A",
      term: "First Term",
      type: "cdc",
      weight: 10,
      maxMarks: 20,
      createdAt: new Date().toISOString()
    },
    {
      id: "task_02",
      title: "ECA Football Drilling",
      subjectId: "subj_eca",
      gradeLevel: "Grade 10",
      section: "Section A",
      term: "First Term",
      type: "eca",
      weight: 20,
      maxMarks: 50,
      createdAt: new Date().toISOString()
    }
  ],
  subjects: [
    { id: "subj_eng", name: "English Language", type: "academic", code: "ENG101" },
    { id: "subj_math", name: "Mathematics", type: "academic", code: "MAT101" },
    { id: "subj_sci", name: "Science", type: "academic", code: "SCI101" },
    { id: "subj_eca", name: "ECA Performance", type: "eca", code: "ECA101" }
  ],
  scores: [
    { id: "score_01", studentId: "student_std_01", taskId: "task_01", scoreObtained: 16, isEca: false, remarks: "Excellent communication skills." },
    { id: "score_02", studentId: "student_std_02", taskId: "task_01", scoreObtained: 18, isEca: false, remarks: "Outstanding thesis development." },
    { id: "score_03", studentId: "student_std_01", taskId: "task_02", scoreObtained: 45, isEca: true, ecaParameter: "participation", remarks: "Great active leader." }
  ],
  users: [
    {
      id: "arjun_rajarshigurukul_edu_np",
      email: "arjun@rajarshigurukul.edu.np",
      name: "Arjun (Admin)",
      role: "admin",
      status: "approved",
      password: "adminpassword",
      createdAt: new Date().toISOString()
    },
    {
      id: "arjunrajarshigurukul_gmail_com",
      email: "arjunrajarshigurukul@gmail.com",
      name: "Arjun Gmail (Admin)",
      role: "admin",
      status: "approved",
      password: "adminpassword",
      createdAt: new Date().toISOString()
    },
    {
      id: "arjun_rajarshigurukul_com",
      email: "arjun@rajarshigurukul.com",
      name: "Arjun Com (Admin)",
      role: "admin",
      status: "approved",
      password: "adminpassword",
      createdAt: new Date().toISOString()
    }
  ],
  settings: {
    schoolConfig: {
      grades: ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"],
      sections: ["Section A", "Section B", "Section C"],
      terms: ["First Term", "Mid Term", "Final Term"],
      ecaSports: ["Football", "Basketball", "Table Tennis", "Chess", "Dance", "Music"],
      gradeMappings: [
        { grade: "Grade 1", sections: ["Section A", "Section B", "Section C"] },
        { grade: "Grade 2", sections: ["Section A", "Section B", "Section C"] },
        { grade: "Grade 3", sections: ["Section A", "Section B", "Section C"] },
        { grade: "Grade 4", sections: ["Section A", "Section B", "Section C"] },
        { grade: "Grade 5", sections: ["Section A", "Section B", "Section C"] },
        { grade: "Grade 6", sections: ["Section A", "Section B", "Section C"] },
        { grade: "Grade 7", sections: ["Section A", "Section B", "Section C"] },
        { grade: "Grade 8", sections: ["Section A", "Section B", "Section C"] },
        { grade: "Grade 9", sections: ["Section A", "Section B", "Section C"] },
        { grade: "Grade 10", sections: ["Section A", "Section B", "Section C"] },
        { grade: "Grade 11", sections: ["Section A", "Section B"] },
        { grade: "Grade 12", sections: ["Section A", "Section B"] }
      ]
    }
  },
  staff_chat: [
    {
      id: "chat_init",
      text: "Welcome to Rajarshi Gurukul Secure Staff Chat!",
      senderName: "System",
      senderEmail: "system@rajarshigurukul.edu.np",
      senderPhoto: "https://ui-avatars.com/api/?name=System",
      createdAt: new Date().toISOString()
    }
  ]
};

let inMemoryState: DBState = { ...DEFAULT_STATE };

export function isDocMatch(item: any, docId: string): boolean {
  if (!item) return false;
  const dId = String(item.id || "").toLowerCase().trim();
  const dEmail = String(item.email || "").toLowerCase().trim();
  const dUid = String(item.uid || "").toLowerCase().trim();
  const target = String(docId || "").toLowerCase().trim();
  
  if (dId === target || dEmail === target || dUid === target) return true;
  
  const normId = dId.replace(/[^a-z0-9]/g, "_");
  const normEmail = dEmail.replace(/[^a-z0-9]/g, "_");
  const normUid = dUid.replace(/[^a-z0-9]/g, "_");
  const normTarget = target.replace(/[^a-z0-9]/g, "_");
  
  if (normId === normTarget || normEmail === normTarget || normUid === normTarget) return true;
  return false;
}

// Save to disk
function saveToDisk() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(inMemoryState, null, 2), "utf-8");
  } catch (err) {
    console.error("Database failed to save to disk:", err);
  }
}

// Load from disk on module load
export function loadFromDisk() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(content);
      
      // Ensure all collections exist
      inMemoryState = {
        students: parsed.students || DEFAULT_STATE.students,
        tasks: parsed.tasks || DEFAULT_STATE.tasks,
        subjects: parsed.subjects || DEFAULT_STATE.subjects,
        scores: parsed.scores || DEFAULT_STATE.scores,
        users: parsed.users || DEFAULT_STATE.users,
        settings: parsed.settings || DEFAULT_STATE.settings,
        staff_chat: parsed.staff_chat || DEFAULT_STATE.staff_chat
      };
    } else {
      inMemoryState = { ...DEFAULT_STATE };
      saveToDisk();
    }
  } catch (err) {
    console.error("Database failed to load from disk, using default pre-seed:", err);
    inMemoryState = { ...DEFAULT_STATE };
  }
}

// Perform initial load
loadFromDisk();

function generateId(): string {
  return "doc_" + Math.random().toString(36).substring(2, 15) + "_" + Date.now().toString(36);
}

export const dbService = {
  getAll(collectionName: keyof DBState) {
    if (collectionName === "settings") {
      return inMemoryState.settings;
    }
    return inMemoryState[collectionName] || [];
  },

  getDoc(collectionName: keyof DBState, docId: string) {
    if (collectionName === "settings") {
      return inMemoryState.settings[docId] || null;
    }
    const list = inMemoryState[collectionName];
    if (Array.isArray(list)) {
      return list.find((item) => isDocMatch(item, docId)) || null;
    }
    return null;
  },

  addDoc(collectionName: keyof DBState, data: any) {
    if (collectionName === "settings") {
      throw new Error("Cannot add doc to settings collection direct. Use setDoc.");
    }
    const list = inMemoryState[collectionName];
    if (Array.isArray(list)) {
      const newDoc = {
        id: generateId(),
        ...data,
        createdAt: data.createdAt || new Date().toISOString()
      };
      list.push(newDoc);
      saveToDisk();
      return newDoc;
    }
    throw new Error(`Collection ${collectionName} is not a valid list.`);
  },

  setDoc(collectionName: keyof DBState, docId: string, data: any, merge = true) {
    if (collectionName === "settings") {
      const current = inMemoryState.settings[docId] || {};
      inMemoryState.settings[docId] = merge ? { ...current, ...data } : data;
      saveToDisk();
      return inMemoryState.settings[docId];
    }

    const list = inMemoryState[collectionName];
    if (Array.isArray(list)) {
      const idx = list.findIndex((item) => isDocMatch(item, docId));
      const targetId = docId;
      
      const updatedDoc = merge && idx !== -1
        ? { ...list[idx], ...data, id: targetId }
        : { ...data, id: targetId };

      if (idx !== -1) {
        list[idx] = updatedDoc;
      } else {
        list.push(updatedDoc);
      }
      saveToDisk();
      return updatedDoc;
    }
    throw new Error(`Collection ${collectionName} is not a valid list.`);
  },

  updateDoc(collectionName: keyof DBState, docId: string, data: any) {
    if (collectionName === "settings") {
      const current = inMemoryState.settings[docId] || {};
      inMemoryState.settings[docId] = { ...current, ...data };
      saveToDisk();
      return inMemoryState.settings[docId];
    }

    const list = inMemoryState[collectionName];
    if (Array.isArray(list)) {
      const idx = list.findIndex((item) => isDocMatch(item, docId));
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...data, updatedAt: new Date().toISOString() };
        saveToDisk();
        return list[idx];
      }
      throw new Error(`Document with ID ${docId} not found in collection ${collectionName}`);
    }
    throw new Error(`Collection ${collectionName} is not a valid list.`);
  },

  deleteDoc(collectionName: keyof DBState, docId: string) {
    if (collectionName === "settings") {
      delete inMemoryState.settings[docId];
      saveToDisk();
      return true;
    }

    const list = inMemoryState[collectionName];
    if (Array.isArray(list)) {
      const lengthBefore = list.length;
      inMemoryState[collectionName] = list.filter((item) => !isDocMatch(item, docId));
      if (lengthBefore !== inMemoryState[collectionName].length) {
        saveToDisk();
        return true;
      }
      return false;
    }
    return false;
  },

  getBulkSync() {
    return {
      students: inMemoryState.students,
      tasks: inMemoryState.tasks,
      subjects: inMemoryState.subjects,
      scores: inMemoryState.scores,
      users: inMemoryState.users,
      settings: inMemoryState.settings,
      staff_chat: inMemoryState.staff_chat
    };
  },

  batchWrite(operations: { type: "set" | "update" | "delete"; collection: keyof DBState; id: string; data?: any }[]) {
    for (const op of operations) {
      if (op.type === "set") {
        this.setDoc(op.collection, op.id, op.data, true);
      } else if (op.type === "update") {
        this.updateDoc(op.collection, op.id, op.data);
      } else if (op.type === "delete") {
        this.deleteDoc(op.collection, op.id);
      }
    }
    return { success: true };
  }
};
