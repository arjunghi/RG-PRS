// Google Sheets Backup and Synchronization functions (Disabled)

export const STUDENTS_SHEET = "Students";
export const SUBJECTS_SHEET = "Subjects";
export const TASKS_SHEET = "Tasks";
export const SCORES_SHEET = "Scores";
export const CONFIG_SHEET = "School Config";

export async function createSpreadsheet(accessToken: string, title: string): Promise<{ id: string; url: string }> {
  console.log("createSpreadsheet called - (Google Sheets integration is disabled)");
  return { id: "disabled", url: "" };
}

export async function syncAllFirestoreToSheets(accessToken: string, spreadsheetId: string = ""): Promise<void> {
  // No-op
}

export async function saveSheetConnection(spreadsheetId: string, spreadsheetUrl: string): Promise<void> {
  // No-op
}

export function triggerLiveSyncInBg(accessToken: string | null, spreadsheetId: string | null = null) {
  // No-op
}

export async function importSheetsConfirmAndSync(accessToken: string, spreadsheetId: string = ""): Promise<{
  studentsCount: number;
  subjectsCount: number;
  tasksCount: number;
  scoresCount: number;
  gradeMappingsCount: number;
}> {
  console.log("importSheetsConfirmAndSync called - (Google Sheets integration is disabled)");
  return {
    studentsCount: 0,
    subjectsCount: 0,
    tasksCount: 0,
    scoresCount: 0,
    gradeMappingsCount: 0,
  };
}
