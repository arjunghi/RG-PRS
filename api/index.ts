import express from "express";
import { GoogleGenAI } from "@google/genai";
import { JWT } from "google-auth-library";

const app = express();

app.use(express.json());

async function getServiceAccountToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !key) return null;

  try {
    const client = new JWT({
      email,
      key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const tokens = await client.authorize();
    return tokens.access_token;
  } catch (err) {
    console.error("Service Account Auth Error:", err);
    return null;
  }
}

// Add Healthcheck endpoint to verify server is active
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/ai/remark", async (req, res) => {
  try {
    const { studentName, subject, marksSummary } = req.body;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const prompt = `
      Act as an encouraging, professional school teacher. 
      Write a brief, 2-sentence progress report remark for the student named ${studentName} in the subject of ${subject}. 
      Here is their recent performance data: ${marksSummary}. 
      Highlight a strength if they have one, and gently point out one area for improvement. Keep it concise and supportive.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.1-flash",
      contents: prompt,
    });
    
    res.json({ text: response.text });
  } catch (error: any) {
    console.error("AI Remark Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/analysis", async (req, res) => {
  try {
    const { subject, classData } = req.body;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const prompt = `
      Act as an expert academic coordinator advising a teacher. 
      Analyze the following class scores for the subject '${subject}'. 
      Data: ${classData}.
      
      Please provide:
      1. A brief 1-sentence summary of overall class performance.
      2. Any apparent struggling areas or trends based on the numbers.
      3. One actionable recommendation for the teacher to improve understanding of this topic.
      Format your response cleanly using short bullet points. Do not use markdown syntax like asterisks.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.1-flash",
      contents: prompt,
    });
    
    res.json({ text: response.text });
  } catch (error: any) {
    console.error("AI Analysis Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Server-side proxies for Google Sheets API to bypass CORS preflight blocking in the frontend sandbox iframe
app.post("/api/sheets/create", async (req, res) => {
  try {
    let { accessToken, title } = req.body;
    if (!accessToken) {
       accessToken = await getServiceAccountToken();
    }
    if (!accessToken) {
      return res.status(400).json({ error: "Missing Google authorization access token and Service Account not configured." });
    }

    const response = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: { title },
        sheets: [
          { properties: { title: "Students" } },
          { properties: { title: "Subjects" } },
          { properties: { title: "Tasks" } },
          { properties: { title: "Scores" } },
          { properties: { title: "School Config" } },
          { properties: { title: "Reports" } },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Google Sheets API Error: ${errText}` });
    }

    const data = await response.json() as any;
    res.json({
      id: data.spreadsheetId,
      url: data.spreadsheetUrl,
    });
  } catch (error: any) {
    console.error("Server Sheet Create Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/sheets/sync", async (req, res) => {
  try {
    let { accessToken, spreadsheetId, data, worksheets } = req.body;
    if (!accessToken) {
       accessToken = await getServiceAccountToken();
    }
    if (!accessToken || !spreadsheetId) {
      return res.status(400).json({ error: "Missing required parameters (accessToken or spreadsheetId) and Service Account not configured." });
    }

    if (spreadsheetId && spreadsheetId.includes("/d/")) {
      const parts = spreadsheetId.split("/d/");
      if (parts[1]) spreadsheetId = parts[1].split("/")[0];
    }

    // Build worksheets mapping dynamically (supports both list formats gracefully)
    let sheetsMap: Record<string, any[][]> = {};
    if (worksheets) {
      sheetsMap = worksheets;
    } else if (data) {
      sheetsMap = {
        "Students": data.students,
        "Subjects": data.subjects,
        "Tasks": data.tasks,
        "Scores": data.scores,
        "School Config": data.config
      };
    } else {
      return res.status(400).json({ error: "No worksheets data provided for synchronization." });
    }

    const requiredSheets = Object.keys(sheetsMap);
    if (requiredSheets.length === 0) {
      return res.status(400).json({ error: "No worksheets found to synchronize." });
    }

    // 1. Ensure all worksheets exist in the Google Spreadsheet
    const metaResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });

    if (!metaResponse.ok) {
      const errText = await metaResponse.text();
      return res.status(metaResponse.status).json({ error: `Failed to fetch spreadsheet metadata: ${errText}` });
    }

    const metaData = await metaResponse.json() as any;
    const existingTitles = new Set((metaData.sheets || []).map((s: any) => s.properties?.title).filter(Boolean));

    const missingSheets = requiredSheets.filter(t => !existingTitles.has(t));

    if (missingSheets.length > 0) {
      console.log("[Server Sheet Sync] Creating missing worksheets:", missingSheets);
      const requests = missingSheets.map(title => ({
        addSheet: {
          properties: { title },
        },
      }));

      const batchUpdateResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requests }),
      });

      if (!batchUpdateResponse.ok) {
        const errText = await batchUpdateResponse.text();
        return res.status(batchUpdateResponse.status).json({ error: `Failed to create missing sheets: ${errText}` });
      }
    }

    // 2. Batch clear values for all worksheets
    const clearResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ranges: requiredSheets.map(title => `${title}!A1:Z99999`),
      }),
    });

    if (!clearResponse.ok) {
      const errText = await clearResponse.text();
      return res.status(clearResponse.status).json({ error: `Failed to batch clear worksheets: ${errText}` });
    }

    // 3. Batch write values
    const updateResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        valueInputOption: "USER_ENTERED",
        data: requiredSheets.map(title => ({
          range: `${title}!A1`,
          values: sheetsMap[title]
        })),
      }),
    });

    if (!updateResponse.ok) {
      const errText = await updateResponse.text();
      return res.status(updateResponse.status).json({ error: `Failed to batch update worksheets: ${errText}` });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Server Sheet Sync Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/sheets/read", async (req, res) => {
  try {
    let { spreadsheetId, accessToken } = req.body;
    if (!accessToken) {
       accessToken = await getServiceAccountToken();
    }
    if (!accessToken || !spreadsheetId) {
      return res.status(400).json({ error: "Missing required parameters (accessToken or spreadsheetId) and Service Account not configured." });
    }
    
    // Safety check: if frontend sent full URL accidentally
    if (spreadsheetId && spreadsheetId.includes("/d/")) {
      const parts = spreadsheetId.split("/d/");
      if (parts[1]) spreadsheetId = parts[1].split("/")[0];
    }

    // First fetch metadata to get all sheet names
    const metaResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });
    if (!metaResponse.ok) {
      const errText = await metaResponse.text();
      return res.status(metaResponse.status).json({ error: `Google Sheets API Error (Meta): ${errText}` });
    }
    const metaData = await metaResponse.json() as any;
    const sheetTitles: string[] = (metaData.sheets || []).map((s: any) => s.properties?.title).filter(Boolean);

    if (sheetTitles.length === 0) {
      return res.json({ students: [], subjects: [], tasks: [], scores: [], gradeMappings: [] });
    }

    const ranges = sheetTitles.map(t => `${t}!A1:Z5000`);
    const queryParams = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join("&");
    
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${queryParams}`, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Google Sheets API Error (Values): ${errText}` });
    }

    const data = await response.json() as any;
    const valueRanges = data.valueRanges || [];

    const getSheetName = (possibleNames: string[]): string | null => {
      const lowerNames = possibleNames.map(n => n.toLowerCase());
      const match = sheetTitles.find(t => lowerNames.some(ln => t.toLowerCase().includes(ln)));
      return match || null;
    };

    const getValuesForSheet = (name: string | null): any[][] => {
      if (!name) return [];
      const found = valueRanges.find((vr: any) => vr.range && vr.range.includes(name));
      return found ? (found.values || []) : [];
    };

    const findColIdx = (headers: string[], possibleObj: string[]): number => {
      const idx = headers.findIndex(h => possibleObj.some(p => h && typeof h === 'string' && h.toLowerCase().includes(p.toLowerCase())));
      return idx !== -1 ? idx : -1;
    };

    // 1. Parse Students
    const studentSheetName = getSheetName(["Students", "Student", "Pupils", "Children"]);
    const studentRows = getValuesForSheet(studentSheetName);
    const students: any[] = [];
    if (studentRows.length > 1) {
      const headers = studentRows[0].map((h: any) => String(h || ""));
      const nameIdx = findColIdx(headers, ["name", "student"]);
      const gradeIdx = findColIdx(headers, ["grade", "class", "level"]);
      const secIdx = findColIdx(headers, ["section", "sec"]);
      const idIdx = findColIdx(headers, ["id", "roll", "sn", "s.n"]);
      
      const nI = nameIdx >= 0 ? nameIdx : 1;
      const gI = gradeIdx >= 0 ? gradeIdx : 2;
      const sI = secIdx >= 0 ? secIdx : 3;
      const iI = idIdx >= 0 ? idIdx : 0;

      for (let i = 1; i < studentRows.length; i++) {
        const row = studentRows[i];
        if (!row || row.length === 0 || !row[nI]) continue;
        
        students.push({
          id: row[iI] ? String(row[iI]) : `student-${Date.now()}-${i}`,
          name: row[nI] || "",
          gradeLevel: row[gI] || "",
          section: row[sI] || "",
          ecaSports: [],
          createdAt: new Date().toISOString()
        });
      }
    }

    // 2. Parse Subjects
    const subjectSheetName = getSheetName(["Subjects", "Subject", "Courses", "Course"]);
    const subjectRows = getValuesForSheet(subjectSheetName);
    const subjects: any[] = [];
    if (subjectRows.length > 1) {
      const headers = subjectRows[0].map((h: any) => String(h || ""));
      const nameIdx = findColIdx(headers, ["name", "subject", "course"]);
      const typeIdx = findColIdx(headers, ["type", "category"]);
      const ecaIdx = findColIdx(headers, ["eca", "criteria"]);
      const idIdx = findColIdx(headers, ["id", "code"]);
      
      const nI = nameIdx >= 0 ? nameIdx : 1;
      const tI = typeIdx >= 0 ? typeIdx : 2;
      const eI = ecaIdx >= 0 ? ecaIdx : 3;
      const iI = idIdx >= 0 ? idIdx : 0;

      for (let i = 1; i < subjectRows.length; i++) {
        const row = subjectRows[i];
        if (!row || row.length === 0 || !row[nI]) continue;
        
        const typeStr = (row[tI] || "academic").toLowerCase();
        const typeVal = typeStr.includes("eca") ? "eca" : "academic";

        const ecaCriteriaStr = row[eI] || "";
        const ecaCriteria = ecaCriteriaStr ? ecaCriteriaStr.split(/[,|]/).map((c: string) => c.trim()).filter(Boolean) : [];

        subjects.push({
          id: row[iI] ? String(row[iI]) : ("subject-" + row[nI]).toLowerCase().replace(/\s+/g, '-'),
          name: row[nI],
          type: typeVal,
          ecaCriteria: ecaCriteria,
          assignments: []
        });
      }
    }

    // 3. Parse School Config (Grades)
    const configSheetName = getSheetName(["School Config", "Config", "Settings", "Grades", "Classes"]);
    const configRows = getValuesForSheet(configSheetName);
    const gradeMappings: any[] = [];
    if (configRows.length > 1) {
      const headers = configRows[0].map((h: any) => String(h || ""));
      const gradeIdx = findColIdx(headers, ["grade", "class"]);
      const secIdx = findColIdx(headers, ["section"]);
      
      const gI = gradeIdx >= 0 ? gradeIdx : 0;
      const sI = secIdx >= 0 ? secIdx : 1;

      for (let i = 1; i < configRows.length; i++) {
        const row = configRows[i];
        if (!row || !row[gI]) continue;
        const sectionsStr = row[sI] || "";
        const sections = sectionsStr ? sectionsStr.split(/[,|]/).map((s: string) => s.trim()).filter(Boolean) : [];
        gradeMappings.push({
          grade: String(row[gI]).trim(),
          sections: sections
        });
      }
    }

    // Attempt to parse standard Tabs if they exist
    const taskSheetName = getSheetName(["Tasks", "Assignments"]);
    const taskRows = getValuesForSheet(taskSheetName);
    const tasks: any[] = [];
    if (taskRows.length > 1) {
      for (let i = 1; i < taskRows.length; i++) {
        const row = taskRows[i];
        if (!row || !row[1] || row[3] === "ECA") continue;
        tasks.push({
          id: row[0] || `task-${Date.now()}-${i}`,
          name: row[1],
          maxMarks: Number(row[2]) || 10,
          taskType: row[3] || "HW",
          term: row[4] || "All",
          date: row[5] || "",
          subjectId: row[6] || "",
          createdAt: row[7] || new Date().toISOString(),
          updatedAt: row[8] || new Date().toISOString()
        });
      }
    }

    // Attempt to extract Scores if standard Scores tab exists
    const scoreSheetName = getSheetName(["Scores", "Marks"]);
    const scoreRows = getValuesForSheet(scoreSheetName);
    const scores: any[] = [];
    if (scoreRows.length > 1) {
      for (let i = 1; i < scoreRows.length; i++) {
        const row = scoreRows[i];
        if (!row || row.length < 5) continue;
        scores.push({
          id: row[0] || `score-${Date.now()}-${i}`,
          studentId: row[1],
          taskId: row[2],
          subjectId: row[3],
          score: row[4] !== "" && !isNaN(Number(row[4])) ? Number(row[4]) : row[4],
          updatedAt: row[5] || new Date().toISOString()
        });
      }
    }

    // Try parsing Matrix tabs if any (e.g. "Grade 1 Matrix")
    const matrixSheets = sheetTitles.filter(t => t.toLowerCase().includes("matrix"));
    matrixSheets.forEach(mTitle => {
      const gRows = getValuesForSheet(mTitle);
      if (gRows.length > 1) {
        const headers = gRows[0];
        // headers: ["Student Name", "Section", "SubjectName: TaskName (10)", "SubjectName: Criteria (Grade)"]
        for (let i = 1; i < gRows.length; i++) {
            const row = gRows[i];
            const stuName = row[0];
            const stuId = students.find(s => s.name === stuName)?.id;
            if (!stuId) continue;

            for (let c = 2; c < headers.length; c++) {
               const cellVal = row[c];
               if (cellVal === "" || cellVal === undefined) continue;
               const headerLabel = headers[c];
               if (!headerLabel) continue;

               // naive parsing of "SubjectName: TaskName (10)" -> finding subject and task
               const colonIdx = headerLabel.indexOf(":");
               if (colonIdx === -1) continue;
               const subjName = headerLabel.substring(0, colonIdx).trim();
               const sub = subjects.find(s => s.name === subjName);
               if (!sub) continue;

               const restLabel = headerLabel.substring(colonIdx + 1).split("(")[0].trim();
               // check if it's task or eca
               let tId = restLabel;
               if (sub.type === "eca") {
                  if (!sub.ecaCriteria.includes(restLabel)) continue; // avoid missing ones
               } else {
                  const tk = tasks.find(t => t.subjectId === sub.id && t.name === restLabel);
                  if (tk) tId = tk.id;
               }

               scores.push({
                  id: `score-${Date.now()}-${stuId}-${tId}-${c}`,
                  studentId: stuId,
                  taskId: tId,
                  subjectId: sub.id,
                  score: cellVal !== "" && !isNaN(Number(cellVal)) ? Number(cellVal) : cellVal,
                  updatedAt: new Date().toISOString()
               });
            }
        }
      }
    });

    res.json({
      students,
      subjects,
      tasks,
      scores,
      gradeMappings
    });
  } catch (error: any) {
    console.error("Server Sheet Read Error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default app;
