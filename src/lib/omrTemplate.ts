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

/**
 * Template for common Indian school / board OMR sheets (no corner markers).
 * 4 columns × 10 questions, A–D options.
 * Positions are relative fractions of the page so they tolerate modest crop variation.
 * Works best when the photo is cropped reasonably tightly to the paper edges.
 */
export const SCHOOL_TEMPLATE: OMRTemplateConfig = {
  pageWidth: 1240,
  pageHeight: 1754,
  markers: [], // none
  bubbleRadius: 15,
  // Answer grid occupies roughly the lower 55–60 % of a typical school OMR
  questionsStartY: Math.round(1754 * 0.62), // ~1087
  questionHeight: Math.round(1754 * 0.032), // ~56
  optionsStartX: Math.round(1240 * 0.105),  // ~130
  optionSpacing: Math.round(1240 * 0.038),  // ~47
  rollStartY: Math.round(1754 * 0.22),
  rollDigitSpacing: Math.round(1240 * 0.055),
  cols: 4,
  questionsPerCol: 10,
};

export function getBubbleCenter(
  questionIndex: number,
  optionIndex: number,
  _totalQuestions: number,
  _optionsPerQ: number,
  tmpl: OMRTemplateConfig = TEMPLATE
): { x: number; y: number } {
  const col = Math.floor(questionIndex / tmpl.questionsPerCol);
  const row = questionIndex % tmpl.questionsPerCol;
  // Column width ~ page / cols with small gutters
  const colWidth = tmpl.pageWidth / tmpl.cols;
  const colOffset = col * colWidth;
  const x = tmpl.optionsStartX + colOffset + optionIndex * tmpl.optionSpacing;
  const y = tmpl.questionsStartY + row * tmpl.questionHeight;
  return { x, y };
}

export function getRollBubbleCenter(digitPos: number, digitValue: number, tmpl: OMRTemplateConfig = TEMPLATE): { x: number; y: number } {
  const x = 200 + digitPos * tmpl.rollDigitSpacing;
  const y = tmpl.rollStartY + digitValue * 48;
  return { x, y };
}

export const OPTION_LETTERS: OptionLetter[] = ['A', 'B', 'C', 'D', 'E'];
