export type OptionLetter = 'A' | 'B' | 'C' | 'D' | 'E';

export type AnswerState = OptionLetter | 'BLANK' | 'MULTIPLE' | 'UNCERTAIN';

export interface GradeRange {
  min: number;
  max: number;
  grade: string;
}

export interface Exam {
  id: string;
  schoolName: string;
  examName: string;
  academicYear: string;
  classLevel: 'XI' | 'XII';
  subject: string;
  semester: string;
  chapter: string;
  examDate: string;
  totalQuestions: number;
  optionsPerQuestion: 4 | 5;
  marksPerQuestion: number;
  negativeMarks: number;
  passingMarks: number;
  answerKey: (OptionLetter | null)[];
  answerKeyLocked: boolean;
  gradeRanges: GradeRange[];
  templateVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentResult {
  id: string;
  examId: string;
  sheetId: string;
  studentName: string;
  rollNumber: string;
  section: string;
  registrationId: string;
  detectedAnswers: AnswerState[];
  confidences: number[];
  finalAnswers: AnswerState[];
  corrections: Record<number, AnswerState>;
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
  scanImageDataUrl?: string;
  timestamp: string;
  isDuplicate?: boolean;
}

export interface AppSettings {
  highConfidenceThreshold: number;
  lowConfidenceThreshold: number;
  fillThreshold: number;
  gradeRanges: GradeRange[];
}

export interface OMRTemplateConfig {
  pageWidth: number;
  pageHeight: number;
  markers: { x: number; y: number; size: number }[];
  bubbleRadius: number;
  questionsStartY: number;
  questionHeight: number;
  optionsStartX: number;
  optionSpacing: number;
  rollStartY: number;
  rollDigitSpacing: number;
  cols: number;
  questionsPerCol: number;
}

export const DEFAULT_GRADE_RANGES: GradeRange[] = [
  { min: 90, max: 100, grade: 'A+' },
  { min: 80, max: 89, grade: 'A' },
  { min: 70, max: 79, grade: 'B+' },
  { min: 60, max: 69, grade: 'B' },
  { min: 50, max: 59, grade: 'C' },
  { min: 40, max: 49, grade: 'D' },
  { min: 0, max: 39, grade: 'F' },
];

export const DEFAULT_SETTINGS: AppSettings = {
  highConfidenceThreshold: 0.75,
  lowConfidenceThreshold: 0.45,
  fillThreshold: 0.35,
  gradeRanges: DEFAULT_GRADE_RANGES,
};
