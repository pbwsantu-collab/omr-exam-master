import type { OMRTemplateConfig, OptionLetter } from '../types';

/** A4 at ~150 DPI for processing: 1240 x 1754 (matches print CSS 210mm x 297mm) */
export const TEMPLATE: OMRTemplateConfig = {
  pageWidth: 1240,
  pageHeight: 1754,
  markers: [
    // ~8mm inset, ~12mm size (CSS .omr-marker)
    { x: 47, y: 47, size: 71 },
    { x: 1122, y: 47, size: 71 },
    { x: 47, y: 1636, size: 71 },
    { x: 1122, y: 1636, size: 71 },
  ],
  bubbleRadius: 16,
  questionsStartY: 520,
  questionHeight: 36,
  optionsStartX: 160,
  optionSpacing: 72,
  rollStartY: 260,
  rollDigitSpacing: 70,
  cols: 2,
  questionsPerCol: 20,
};

export function getBubbleCenter(
  questionIndex: number,
  optionIndex: number,
  _totalQuestions: number,
  _optionsPerQ: number
): { x: number; y: number } {
  const col = Math.floor(questionIndex / TEMPLATE.questionsPerCol);
  const row = questionIndex % TEMPLATE.questionsPerCol;
  const colOffset = col * 560;
  const x = TEMPLATE.optionsStartX + colOffset + optionIndex * TEMPLATE.optionSpacing;
  const y = TEMPLATE.questionsStartY + row * TEMPLATE.questionHeight;
  return { x, y };
}

export function getRollBubbleCenter(digitPos: number, digitValue: number): { x: number; y: number } {
  const x = 200 + digitPos * TEMPLATE.rollDigitSpacing;
  // Vertical spacing ~ bubble diameter + gap (~48px at 150dpi for 7-8mm)
  const y = TEMPLATE.rollStartY + digitValue * 48;
  return { x, y };
}

export const OPTION_LETTERS: OptionLetter[] = ['A', 'B', 'C', 'D', 'E'];
