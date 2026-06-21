import express from "express";
import { GoogleGenAI } from "@google/genai";
import { dbService } from "./db.js";

const app = express();

app.use(express.json());

// Add Healthcheck endpoint to verify server is active
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Server-side DB Syncer Endpoint (Returns all collections for instant fast local caches)
app.get("/api/db/sync", (req, res) => {
  try {
    const fullState = dbService.getBulkSync();
    res.json(fullState);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET list of documents
app.get("/api/db/:collection", (req, res) => {
  try {
    const collectionName = req.params.collection as any;
    const data = dbService.getAll(collectionName);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET individual document
app.get("/api/db/:collection/:id", (req, res) => {
  try {
    const { collection, id } = req.params;
    const doc = dbService.getDoc(collection as any, id);
    res.json(doc);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST to add new document
app.post("/api/db/:collection", (req, res) => {
  try {
    const { collection } = req.params;
    const newDoc = dbService.addDoc(collection as any, req.body);
    res.json(newDoc);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST to set specific document (setDoc)
app.post("/api/db/:collection/:id/set", (req, res) => {
  try {
    const { collection, id } = req.params;
    const merge = req.query.merge !== "false";
    const doc = dbService.setDoc(collection as any, id, req.body, merge);
    res.json(doc);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH to update specific document (updateDoc)
app.patch("/api/db/:collection/:id", (req, res) => {
  try {
    const { collection, id } = req.params;
    const doc = dbService.updateDoc(collection as any, id, req.body);
    res.json(doc);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE specific document
app.delete("/api/db/:collection/:id", (req, res) => {
  try {
    const { collection, id } = req.params;
    const success = dbService.deleteDoc(collection as any, id);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST batch write transactions
app.post("/api/db/batch", (req, res) => {
  try {
    const { operations } = req.body;
    const result = dbService.batchWrite(operations);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
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

export default app;
