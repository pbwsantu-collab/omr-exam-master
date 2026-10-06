import { TEMPLATE, getBubbleCenter, getRollBubbleCenter, OPTION_LETTERS } from './omrTemplate';
import type { AnswerState } from '../types';

export interface ProcessResult {
  success: boolean;
  error?: string;
  sheetId?: string;
  rollNumber?: string;
  rollConfidence?: number;
  answers: AnswerState[];
  confidences: number[];
  fillValues: number[][];
  alignedCanvas?: HTMLCanvasElement;
}

function loadImage(src: string | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    if (typeof src === 'string') img.src = src;
    else img.src = URL.createObjectURL(src);
  });
}

function toGrayscale(ctx: CanvasRenderingContext2D, w: number, h: number): ImageData {
  const data = ctx.getImageData(0, 0, w, h);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  return data;
}

function normalizeBrightness(data: ImageData): ImageData {
  const d = data.data;
  let min = 255, max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  for (let i = 0; i < d.length; i += 4) {
    const v = ((d[i] - min) / range) * 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  return data;
}

function detectMarkers(data: ImageData, w: number, h: number): { x: number; y: number }[] | null {
  const markers: { x: number; y: number }[] = [];
  const searchR = Math.min(w, h) * 0.12;
  const regions = [
    { cx: searchR, cy: searchR },
    { cx: w - searchR, cy: searchR },
    { cx: searchR, cy: h - searchR },
    { cx: w - searchR, cy: h - searchR },
  ];
  for (const reg of regions) {
    let bestX = reg.cx, bestY = reg.cy, bestScore = -1;
    const step = 4;
    for (let y = Math.max(0, reg.cy - searchR); y < Math.min(h, reg.cy + searchR); y += step) {
      for (let x = Math.max(0, reg.cx - searchR); x < Math.min(w, reg.cx + searchR); x += step) {
        let dark = 0, total = 0;
        for (let dy = -10; dy <= 10; dy += 2) {
          for (let dx = -10; dx <= 10; dx += 2) {
            const px = x + dx, py = y + dy;
            if (px < 0 || py < 0 || px >= w || py >= h) continue;
            total++;
            if (data.data[(py * w + px) * 4] < 80) dark++;
          }
        }
        const score = total > 0 ? dark / total : 0;
        if (score > bestScore && score > 0.55) {
          bestScore = score;
          bestX = x;
          bestY = y;
        }
      }
    }
    if (bestScore < 0.55) return null;
    markers.push({ x: bestX, y: bestY });
  }
  return markers;
}

function warpPerspective(
  srcCanvas: HTMLCanvasElement,
  srcPts: { x: number; y: number }[],
  destW: number,
  destH: number
): HTMLCanvasElement {
  const dest = document.createElement('canvas');
  dest.width = destW;
  dest.height = destH;
  const dctx = dest.getContext('2d')!;
  const sctx = srcCanvas.getContext('2d')!;
  const srcData = sctx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
  const dstPts = [
    { x: TEMPLATE.markers[0].x + TEMPLATE.markers[0].size / 2, y: TEMPLATE.markers[0].y + TEMPLATE.markers[0].size / 2 },
    { x: TEMPLATE.markers[1].x + TEMPLATE.markers[1].size / 2, y: TEMPLATE.markers[1].y + TEMPLATE.markers[1].size / 2 },
    { x: TEMPLATE.markers[2].x + TEMPLATE.markers[2].size / 2, y: TEMPLATE.markers[2].y + TEMPLATE.markers[2].size / 2 },
    { x: TEMPLATE.markers[3].x + TEMPLATE.markers[3].size / 2, y: TEMPLATE.markers[3].y + TEMPLATE.markers[3].size / 2 },
  ];
  const imgData = dctx.createImageData(destW, destH);
  const out = imgData.data;
  const sw = srcCanvas.width, sh = srcCanvas.height;

  function invBilinear(px: number, py: number): { u: number; v: number } {
    const tl = dstPts[0], tr = dstPts[1], bl = dstPts[2], br = dstPts[3];
    const widthTop = tr.x - tl.x || 1;
    const widthBot = br.x - bl.x || 1;
    const heightL = bl.y - tl.y || 1;
    const heightR = br.y - tr.y || 1;
    const v = (py - tl.y) / ((heightL + heightR) / 2);
    const u = (px - (tl.x + v * (bl.x - tl.x))) / ((widthTop + widthBot) / 2);
    return { u: Math.max(0, Math.min(1, u)), v: Math.max(0, Math.min(1, v)) };
  }

  for (let y = 0; y < destH; y++) {
    for (let x = 0; x < destW; x++) {
      const uv = invBilinear(x, y);
      const s0 = srcPts[0], s1 = srcPts[1], s2 = srcPts[2], s3 = srcPts[3];
      const sx =
        (1 - uv.u) * (1 - uv.v) * s0.x +
        uv.u * (1 - uv.v) * s1.x +
        (1 - uv.u) * uv.v * s2.x +
        uv.u * uv.v * s3.x;
      const sy =
        (1 - uv.u) * (1 - uv.v) * s0.y +
        uv.u * (1 - uv.v) * s1.y +
        (1 - uv.u) * uv.v * s2.y +
        uv.u * uv.v * s3.y;
      const ix = Math.round(sx), iy = Math.round(sy);
      if (ix >= 0 && iy >= 0 && ix < sw && iy < sh) {
        const si = (iy * sw + ix) * 4;
        const di = (y * destW + x) * 4;
        out[di] = srcData.data[si];
        out[di + 1] = srcData.data[si + 1];
        out[di + 2] = srcData.data[si + 2];
        out[di + 3] = 255;
      }
    }
  }
  dctx.putImageData(imgData, 0, 0);
  return dest;
}

function measureBubbleFill(data: ImageData, cx: number, cy: number, radius: number): number {
  const w = data.width, h = data.height;
  let dark = 0, total = 0;
  const r2 = radius * radius;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const x = Math.round(cx + dx), y = Math.round(cy + dy);
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      total++;
      if (data.data[(y * w + x) * 4] < 140) dark++;
    }
  }
  return total > 0 ? dark / total : 0;
}

function detectAnswers(
  data: ImageData,
  totalQuestions: number,
  optionsPerQ: number,
  fillThreshold: number
): { answers: AnswerState[]; confidences: number[]; fillValues: number[][] } {
  const answers: AnswerState[] = [];
  const confidences: number[] = [];
  const fillValues: number[][] = [];
  for (let q = 0; q < totalQuestions; q++) {
    const fills: number[] = [];
    for (let o = 0; o < optionsPerQ; o++) {
      const { x, y } = getBubbleCenter(q, o, totalQuestions, optionsPerQ);
      fills.push(measureBubbleFill(data, x, y, TEMPLATE.bubbleRadius));
    }
    fillValues.push(fills);
    const maxFill = Math.max(...fills);
    const filledCount = fills.filter((f) => f >= fillThreshold).length;
    if (filledCount === 0) {
      answers.push('BLANK');
      confidences.push(1 - maxFill);
    } else if (filledCount > 1) {
      answers.push('MULTIPLE');
      confidences.push(maxFill);
    } else {
      const idx = fills.indexOf(maxFill);
      answers.push(OPTION_LETTERS[idx]);
      confidences.push(maxFill);
    }
  }
  return { answers, confidences, fillValues };
}

function detectRoll(data: ImageData, digits = 2): { roll: string; confidence: number } {
  let roll = '';
  let confSum = 0;
  for (let pos = 0; pos < digits; pos++) {
    let bestD = 0, bestF = 0;
    for (let d = 0; d <= 9; d++) {
      const { x, y } = getRollBubbleCenter(pos, d);
      const f = measureBubbleFill(data, x, y, 11);
      if (f > bestF) {
        bestF = f;
        bestD = d;
      }
    }
    if (bestF < 0.3) return { roll: '', confidence: 0 };
    roll += String(bestD);
    confSum += bestF;
  }
  return { roll, confidence: confSum / digits };
}

export async function processOMRImage(
  imageSource: string | Blob,
  totalQuestions: number,
  optionsPerQ: number,
  fillThreshold = 0.35
): Promise<ProcessResult> {
  try {
    const img = await loadImage(imageSource);
    const canvas = document.createElement('canvas');
    const maxDim = 1600;
    let scale = 1;
    if (Math.max(img.width, img.height) > maxDim) {
      scale = maxDim / Math.max(img.width, img.height);
    }
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    let gray = toGrayscale(ctx, canvas.width, canvas.height);
    gray = normalizeBrightness(gray);
    ctx.putImageData(gray, 0, 0);

    const markers = detectMarkers(gray, canvas.width, canvas.height);
    if (!markers) {
      return {
        success: false,
        error: 'OMR ALIGNMENT NOT DETECTED. Ensure all four corner markers are visible and the sheet is flat.',
        answers: [], confidences: [], fillValues: [],
      };
    }

    let sum = 0;
    for (let i = 0; i < gray.data.length; i += 40) sum += gray.data[i];
    const avg = sum / (gray.data.length / 40);
    if (avg < 40) {
      return {
        success: false,
        error: 'IMAGE TOO DARK. Improve lighting and try again.',
        answers: [], confidences: [], fillValues: [],
      };
    }

    const aligned = warpPerspective(canvas, markers, TEMPLATE.pageWidth, TEMPLATE.pageHeight);
    const actx = aligned.getContext('2d')!;
    let aData = toGrayscale(actx, TEMPLATE.pageWidth, TEMPLATE.pageHeight);
    aData = normalizeBrightness(aData);
    actx.putImageData(aData, 0, 0);

    const { answers, confidences, fillValues } = detectAnswers(
      aData, totalQuestions, optionsPerQ, fillThreshold
    );
    const { roll, confidence: rollConf } = detectRoll(aData, 2);

    return {
      success: true,
      rollNumber: roll || undefined,
      rollConfidence: rollConf,
      answers,
      confidences,
      fillValues,
      alignedCanvas: aligned,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Processing failed',
      answers: [], confidences: [], fillValues: [],
    };
  }
}

export async function processForCalibration(
  imageSource: string | Blob,
  totalQuestions: number,
  optionsPerQ: number
): Promise<ProcessResult> {
  return processOMRImage(imageSource, totalQuestions, optionsPerQ, 0.25);
}
