import type { Exam, StudentResult, AnswerState, OptionLetter, GradeRange } from '../types';
import { DEFAULT_GRADE_RANGES } from '../types';

export function calculateMarks(
  exam: Exam,
  finalAnswers: AnswerState[]
): {
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  multipleCount: number;
  negativeApplied: number;
  marksObtained: number;
  maxMarks: number;
  percentage: number;
  grade: string;
  result: 'PASS' | 'FAIL';
} {
  const key = exam.answerKey;
  let correct = 0;
  let wrong = 0;
  let blank = 0;
  let multiple = 0;
  let marks = 0;
  const maxMarks = exam.totalQuestions * exam.marksPerQuestion;

  for (let i = 0; i < exam.totalQuestions; i++) {
    const ans = finalAnswers[i] ?? 'BLANK';
    const correctAns = key[i];

    if (ans === 'BLANK' || ans === 'UNCERTAIN') {
      blank++;
    } else if (ans === 'MULTIPLE') {
      multiple++;
    } else if (correctAns && ans === correctAns) {
      correct++;
      marks += exam.marksPerQuestion;
    } else {
      wrong++;
      marks -= exam.negativeMarks;
    }
  }

  const marksObtained = Math.round(marks * 100) / 100;
  const percentage = maxMarks > 0 ? Math.round((marksObtained / maxMarks) * 10000) / 100 : 0;
  const grade = getGrade(percentage, exam.gradeRanges || DEFAULT_GRADE_RANGES);
  const result: 'PASS' | 'FAIL' = marksObtained >= exam.passingMarks ? 'PASS' : 'FAIL';

  return {
    correctCount: correct,
    wrongCount: wrong,
    blankCount: blank,
    multipleCount: multiple,
    negativeApplied: Math.round(wrong * exam.negativeMarks * 100) / 100,
    marksObtained,
    maxMarks,
    percentage,
    grade,
    result,
  };
}

export function getGrade(percentage: number, ranges: GradeRange[]): string {
  const sorted = [...ranges].sort((a, b) => b.min - a.min);
  for (const r of sorted) {
    if (percentage >= r.min && percentage <= r.max) return r.grade;
  }
  return 'F';
}

export function buildResult(
  exam: Exam,
  partial: {
    sheetId: string;
    studentName: string;
    rollNumber: string;
    section?: string;
    registrationId?: string;
    detectedAnswers: AnswerState[];
    confidences: number[];
    finalAnswers: AnswerState[];
    corrections?: Record<number, AnswerState>;
    scanImageDataUrl?: string;
  }
): StudentResult {
  const calc = calculateMarks(exam, partial.finalAnswers);
  return {
    id: `RES_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    examId: exam.id,
    sheetId: partial.sheetId,
    studentName: partial.studentName || 'Unknown',
    rollNumber: partial.rollNumber || '—',
    section: partial.section || '',
    registrationId: partial.registrationId || '',
    detectedAnswers: partial.detectedAnswers,
    confidences: partial.confidences,
    finalAnswers: partial.finalAnswers,
    corrections: partial.corrections || {},
    ...calc,
    scanImageDataUrl: partial.scanImageDataUrl,
    timestamp: new Date().toISOString(),
  };
}

export function needsReview(
  answers: AnswerState[],
  confidences: number[],
  lowThreshold: number
): number[] {
  const indices: number[] = [];
  for (let i = 0; i < answers.length; i++) {
    if (answers[i] === 'MULTIPLE' || answers[i] === 'UNCERTAIN' || confidences[i] < lowThreshold) {
      indices.push(i);
    }
  }
  return indices;
}
