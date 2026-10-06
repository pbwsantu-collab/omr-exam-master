import type { Exam, StudentResult, AppSettings } from '../types';
import { DEFAULT_SETTINGS } from '../types';

const KEYS = {
  exams: 'omr_exams',
  results: 'omr_results',
  settings: 'omr_settings',
  currentExamId: 'omr_current_exam',
};

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getExams(): Exam[] {
  return safeParse(localStorage.getItem(KEYS.exams), []);
}

export function saveExams(exams: Exam[]): void {
  localStorage.setItem(KEYS.exams, JSON.stringify(exams));
}

export function getExam(id: string): Exam | undefined {
  return getExams().find((e) => e.id === id);
}

export function upsertExam(exam: Exam): void {
  const exams = getExams();
  const idx = exams.findIndex((e) => e.id === exam.id);
  if (idx >= 0) exams[idx] = exam;
  else exams.push(exam);
  saveExams(exams);
}

export function deleteExam(id: string): void {
  saveExams(getExams().filter((e) => e.id !== id));
  const results = getResults().filter((r) => r.examId !== id);
  saveResults(results);
}

export function getResults(): StudentResult[] {
  return safeParse(localStorage.getItem(KEYS.results), []);
}

export function saveResults(results: StudentResult[]): void {
  localStorage.setItem(KEYS.results, JSON.stringify(results));
}

export function getResultsForExam(examId: string): StudentResult[] {
  return getResults().filter((r) => r.examId === examId);
}

export function upsertResult(result: StudentResult): void {
  const results = getResults();
  const idx = results.findIndex((r) => r.id === result.id || (r.sheetId === result.sheetId && r.examId === result.examId));
  if (idx >= 0) results[idx] = result;
  else results.push(result);
  saveResults(results);
}

export function findResultBySheetId(sheetId: string): StudentResult | undefined {
  return getResults().find((r) => r.sheetId === sheetId);
}

export function getSettings(): AppSettings {
  return safeParse(localStorage.getItem(KEYS.settings), DEFAULT_SETTINGS);
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(KEYS.settings, JSON.stringify(s));
}

export function getCurrentExamId(): string | null {
  return localStorage.getItem(KEYS.currentExamId);
}

export function setCurrentExamId(id: string | null): void {
  if (id) localStorage.setItem(KEYS.currentExamId, id);
  else localStorage.removeItem(KEYS.currentExamId);
}

export function exportBackup(): string {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      exams: getExams(),
      results: getResults(),
      settings: getSettings(),
    },
    null,
    2
  );
}

export function importBackup(json: string): { ok: boolean; message: string } {
  try {
    const data = JSON.parse(json);
    if (!data.exams || !Array.isArray(data.exams)) {
      return { ok: false, message: 'Invalid backup: missing exams' };
    }
    if (data.exams) saveExams(data.exams);
    if (data.results) saveResults(data.results);
    if (data.settings) saveSettings(data.settings);
    return { ok: true, message: 'Backup restored successfully' };
  } catch (e) {
    return { ok: false, message: 'Failed to parse backup JSON' };
  }
}

export function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function generateSheetId(examId: string, seq: number): string {
  return `SH-${examId.slice(0, 6)}-${String(seq).padStart(4, '0')}`;
}
