import type { OMRTemplateConfig, OptionLetter } from '../types';

/** A4 at 150 DPI approx for processing: 1240 x 1754 */
export const TEMPLATE: OMRTemplateConfig = {
  pageWidth: 1240,
  pageHeight: 1754,
  markers: [
    { x: 60, y: 60, size: 40 },
    { x: 1180, y: 60, size: 40 },
    { x: 60, y: 1694, size: 40 },
    { x: 1180, y: 1694, size: 40 },
  ],
  bubbleRadius: 14,
  questionsStartY: 420,
  questionHeight: 32,
  optionsStartX: 180,
  optionSpacing: 70,
  rollStartY: 280,
  rollDigitSpacing: 55,
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
  const y = TEMPLATE.rollStartY + digitValue * 28;
  return { x, y };
}

export const OPTION_LETTERS: OptionLetter[] = ['A', 'B', 'C', 'D', 'E'];
