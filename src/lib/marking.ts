import type { Exam, StudentResult, AnswerState, GradeRange } from '../types';
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
  let negativeApplied = 0;
  const maxMarks = exam.totalQuestions * exam.marksPerQuestion;

  for (let i = 0; i < exam.totalQuestions; i++) {
    const ans = finalAnswers[i];
    const correctOpt = key[i];
    if (ans === 'BLANK' || ans === '') {
      blank++;
    } else if (ans === 'MULTIPLE') {
      multiple++;
      if (exam.negativeMarking > 0) negativeApplied += exam.negativeMarking;
    } else if (ans === correctOpt) {
      correct++;
    } else {
      wrong++;
      if (exam.negativeMarking > 0) negativeApplied += exam.negativeMarking;
    }
  }

  const marksObtained = Math.max(0, correct * exam.marksPerQuestion - negativeApplied);
  const percentage = maxMarks > 0 ? (marksObtained / maxMarks) * 100 : 0;
  const grade = gradeFromPercentage(percentage, exam.gradeRanges?.length ? exam.gradeRanges : DEFAULT_GRADE_RANGES);
  const result = marksObtained >= exam.passingMarks ? 'PASS' : 'FAIL';

  return {
    correctCount: correct,
    wrongCount: wrong,
    blankCount: blank,
    multipleCount: multiple,
    negativeApplied,
    marksObtained,
    maxMarks,
    percentage: Math.round(percentage * 100) / 100,
    grade,
    result,
  };
}

function gradeFromPercentage(pct: number, ranges: GradeRange[]): string {
  for (const r of ranges) {
    if (pct >= r.minPercent) return r.grade;
  }
  return 'F';
}

export function needsReview(
  answers: AnswerState[],
  confidences: number[],
  lowThreshold: number
): number[] {
  const indices: number[] = [];
  for (let i = 0; i < answers.length; i++) {
    if (answers[i] === 'MULTIPLE' || (confidences[i] !== undefined && confidences[i] < lowThreshold && answers[i] !== 'BLANK')) {
      indices.push(i);
    }
  }
  return indices;
}

export function buildResult(
  exam: Exam,
  partial: {
    sheetId: string;
    studentName: string;
    rollNumber: string;
    detectedAnswers: AnswerState[];
    confidences: number[];
    finalAnswers: AnswerState[];
    corrections?: Record<number, AnswerState>;
    scanImageDataUrl?: string;
  }
): StudentResult {
  const marks = calculateMarks(exam, partial.finalAnswers);
  return {
    id: `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    examId: exam.id,
    sheetId: partial.sheetId,
    studentName: partial.studentName,
    rollNumber: partial.rollNumber,
    detectedAnswers: partial.detectedAnswers,
    confidences: partial.confidences,
    finalAnswers: partial.finalAnswers,
    corrections: partial.corrections || {},
    ...marks,
    scannedAt: new Date().toISOString(),
    scanImageDataUrl: partial.scanImageDataUrl,
  };
}
