import express from "express";
import { GoogleGenAI } from "@google/genai";

const app = express();

app.use(express.json());

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
    const { accessToken, title } = req.body;
    if (!accessToken) {
      return res.status(400).json({ error: "Missing Google authorization access token." });
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
    const { accessToken, spreadsheetId, data, worksheets } = req.body;
    if (!accessToken || !spreadsheetId) {
      return res.status(400).json({ error: "Missing required parameters (accessToken or spreadsheetId)." });
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
    const { accessToken, spreadsheetId } = req.body;
    if (!accessToken || !spreadsheetId) {
      return res.status(400).json({ error: "Missing required parameters (accessToken or spreadsheetId)." });
    }

    const ranges = [
      "Students!A1:Z5000",
      "Subjects!A1:Z1000",
      "Tasks!A1:Z5000",
      "Scores!A1:Z100000",
      "School Config!A1:Z500"
    ];

    const queryParams = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join("&");
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${queryParams}`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Google Sheets API Error: ${errText}` });
    }

    const data = await response.json() as any;
    const valueRanges = data.valueRanges || [];

    const getValuesForSheet = (sheetName: string): any[][] => {
      const found = valueRanges.find((vr: any) => vr.range && vr.range.startsWith(sheetName));
      return found ? (found.values || []) : [];
    };

    // 1. Parse Students
    const studentRows = getValuesForSheet("Students");
    const students: any[] = [];
    if (studentRows.length > 1) {
      for (let i = 1; i < studentRows.length; i++) {
        const row = studentRows[i];
        if (!row || row.length === 0 || !row[1]) continue; // Must have name
        const ecaSportsStr = row[4] || "";
        const ecaSports = ecaSportsStr ? ecaSportsStr.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
        students.push({
          id: row[0] || null,
          name: row[1] || "",
          gradeLevel: row[2] || "",
          section: row[3] || "",
          ecaSports: ecaSports,
          createdAt: row[5] || new Date().toISOString()
        });
      }
    }

    // 2. Parse Subjects
    const subjectRows = getValuesForSheet("Subjects");
    const subjects: any[] = [];
    if (subjectRows.length > 1) {
      for (let i = 1; i < subjectRows.length; i++) {
        const row = subjectRows[i];
        if (!row || row.length === 0 || !row[1]) continue; // Must have name
        const ecaCriteriaStr = row[3] || "";
        const ecaCriteria = ecaCriteriaStr ? ecaCriteriaStr.split(",").map((c: string) => c.trim()).filter(Boolean) : [];
        
        let assignments: any[] = [];
        try {
          if (row[4]) {
            assignments = JSON.parse(row[4]);
          }
        } catch (_) {}

        subjects.push({
          id: row[0] || ("subject-" + row[1]).toLowerCase().replace(/\s+/g, '-'),
          name: row[1],
          type: row[2] || "academic",
          ecaCriteria: ecaCriteria,
          assignments: Array.isArray(assignments) ? assignments : []
        });
      }
    }

    // 3. Parse Tasks
    const taskRows = getValuesForSheet("Tasks");
    const tasks: any[] = [];
    if (taskRows.length > 1) {
      for (let i = 1; i < taskRows.length; i++) {
        const row = taskRows[i];
        if (!row || row.length === 0 || !row[1]) continue; // Must have name
        // Filter out virtual eca rubric rows
        if (row[3] === "ECA") {
          continue;
        }

        const rawMaxMarks = row[2] || "";
        let maxMarks: any = rawMaxMarks;
        if (rawMaxMarks !== "" && !isNaN(Number(rawMaxMarks))) {
          maxMarks = Number(rawMaxMarks);
        }

        tasks.push({
          id: row[0],
          name: row[1],
          maxMarks: maxMarks,
          taskType: row[3] || "Homework",
          term: row[4] || "All",
          date: row[5] || "",
          subjectId: row[6] || "",
          createdAt: row[7] || new Date().toISOString(),
          updatedAt: row[8] || new Date().toISOString()
        });
      }
    }

    // 4. Parse Scores
    const scoreRows = getValuesForSheet("Scores");
    const scores: any[] = [];
    if (scoreRows.length > 1) {
      for (let i = 1; i < scoreRows.length; i++) {
        const row = scoreRows[i];
        if (!row || row.length < 5) continue; // Must have at least studentId, taskId, subjectId, score
        
        const rawScore = row[4];
        let score: any = rawScore;
        if (rawScore !== "" && !isNaN(Number(rawScore))) {
          score = Number(rawScore);
        }

        scores.push({
          id: row[0],
          studentId: row[1],
          taskId: row[2],
          subjectId: row[3],
          score: score,
          updatedAt: row[5] || new Date().toISOString()
        });
      }
    }

    // 5. Parse School Config
    const configRows = getValuesForSheet("School Config");
    const gradeMappings: any[] = [];
    if (configRows.length > 1) {
      for (let i = 1; i < configRows.length; i++) {
        const row = configRows[i];
        if (!row || !row[0]) continue;
        const sectionsStr = row[1] || "";
        const sections = sectionsStr ? sectionsStr.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
        gradeMappings.push({
          grade: row[0].trim(),
          sections: sections
        });
      }
    }

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
