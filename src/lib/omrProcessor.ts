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

async function loadImage(src: string | Blob): Promise<HTMLImageElement | ImageBitmap> {
  let blob: Blob;
  if (typeof src === 'string') blob = await (await fetch(src)).blob();
  else blob = src;
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch { /* fallthrough */ }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(blob);
  });
}

function drawToCanvas(source: HTMLImageElement | ImageBitmap, maxDim = 1800): HTMLCanvasElement {
  const w = ('naturalWidth' in source ? source.naturalWidth : 0) || source.width;
  const h = ('naturalHeight' in source ? source.naturalHeight : 0) || source.height;
  const scale = Math.max(w, h) > maxDim ? maxDim / Math.max(w, h) : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height);
  try { if ('close' in source) (source as ImageBitmap).close(); } catch {}
  return canvas;
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
  for (let i = 0; i < d.length; i += 4) { const v = d[i]; if (v < min) min = v; if (v > max) max = v; }
  const range = max - min || 1;
  for (let i = 0; i < d.length; i += 4) {
    const v = ((d[i] - min) / range) * 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  return data;
}

function findMarker(data: ImageData, w: number, h: number, cx: number, cy: number, searchR: number) {
  let bestX = cx, bestY = cy, bestScore = -1;
  for (let y = Math.max(0, cy - searchR); y < Math.min(h, cy + searchR); y += 3) {
    for (let x = Math.max(0, cx - searchR); x < Math.min(w, cx + searchR); x += 3) {
      let dark = 0, cnt = 0;
      for (let dy = -12; dy <= 12; dy += 2) {
        for (let dx = -12; dx <= 12; dx += 2) {
          const px = x + dx, py = y + dy;
          if (px < 0 || py < 0 || px >= w || py >= h) continue;
          cnt++;
          if (data.data[(py * w + px) * 4] < 90) dark++;
        }
      }
      if (cnt > 10 && dark / cnt > bestScore) { bestScore = dark / cnt; bestX = x; bestY = y; }
    }
  }
  if (bestScore < 0.35) return null;
  let sx = 0, sy = 0, n = 0;
  for (let y = Math.max(0, bestY - 18); y < Math.min(h, bestY + 18); y++) {
    for (let x = Math.max(0, bestX - 18); x < Math.min(w, bestX + 18); x++) {
      if (data.data[(y * w + x) * 4] < 100) { sx += x; sy += y; n++; }
    }
  }
  if (n > 5) { bestX = sx / n; bestY = sy / n; }
  return { x: bestX, y: bestY };
}

function detectMarkers(data: ImageData, w: number, h: number) {
  const R = Math.min(w, h) * 0.22;
  const regions = [
    { cx: R * 0.7, cy: R * 0.7 }, { cx: w - R * 0.7, cy: R * 0.7 },
    { cx: R * 0.7, cy: h - R * 0.7 }, { cx: w - R * 0.7, cy: h - R * 0.7 },
  ];
  const markers = [];
  for (const reg of regions) {
    const m = findMarker(data, w, h, reg.cx, reg.cy, R);
    if (!m) return null;
    markers.push(m);
  }
  const [tl, tr, bl] = markers;
  if (tr.x - tl.x < w * 0.3 || bl.y - tl.y < h * 0.3) return null;
  return markers;
}

function warpPerspective(srcCanvas: HTMLCanvasElement, srcPts: { x: number; y: number }[], destW: number, destH: number) {
  const dest = document.createElement('canvas');
  dest.width = destW; dest.height = destH;
  const dctx = dest.getContext('2d')!;
  const srcData = srcCanvas.getContext('2d')!.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
  const dstPts = TEMPLATE.markers.map(m => ({ x: m.x + m.size / 2, y: m.y + m.size / 2 }));
  const imgData = dctx.createImageData(destW, destH);
  const out = imgData.data;
  const sw = srcCanvas.width, sh = srcCanvas.height;
  for (let y = 0; y < destH; y++) {
    for (let x = 0; x < destW; x++) {
      const tl = dstPts[0], tr = dstPts[1], bl = dstPts[2], br = dstPts[3];
      const v = (y - tl.y) / (((bl.y - tl.y) + (br.y - tr.y)) / 2 || 1);
      const u = (x - (tl.x + v * (bl.x - tl.x))) / (((tr.x - tl.x) + (br.x - bl.x)) / 2 || 1);
      const uu = Math.max(0, Math.min(1, u)), vv = Math.max(0, Math.min(1, v));
      const s0 = srcPts[0], s1 = srcPts[1], s2 = srcPts[2], s3 = srcPts[3];
      const sx = (1 - uu) * (1 - vv) * s0.x + uu * (1 - vv) * s1.x + (1 - uu) * vv * s2.x + uu * vv * s3.x;
      const sy = (1 - uu) * (1 - vv) * s0.y + uu * (1 - vv) * s1.y + (1 - uu) * vv * s2.y + uu * vv * s3.y;
      const ix = Math.round(sx), iy = Math.round(sy);
      if (ix >= 0 && iy >= 0 && ix < sw && iy < sh) {
        const si = (iy * sw + ix) * 4, di = (y * destW + x) * 4;
        out[di] = srcData.data[si]; out[di + 1] = srcData.data[si + 1]; out[di + 2] = srcData.data[si + 2]; out[di + 3] = 255;
      }
    }
  }
  dctx.putImageData(imgData, 0, 0);
  return dest;
}

function measureBubbleFill(data: ImageData, cx: number, cy: number, radius: number): number {
  const w = data.width, h = data.height, r2 = radius * radius;
  let dark = 0, total = 0;
  const ix = Math.round(cx), iy = Math.round(cy);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const x = ix + dx, y = iy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      total++;
      if (data.data[(y * w + x) * 4] < 110) dark++;
    }
  }
  return total > 0 ? dark / total : 0;
}

function detectAnswers(data: ImageData, totalQuestions: number, optionsPerQ: number, fillThreshold: number) {
  const answers: AnswerState[] = [], confidences: number[] = [], fillValues: number[][] = [];
  const radius = Math.max(TEMPLATE.bubbleRadius, 12);
  for (let q = 0; q < totalQuestions; q++) {
    const fills: number[] = [];
    for (let o = 0; o < optionsPerQ; o++) {
      const { x, y } = getBubbleCenter(q, o, totalQuestions, optionsPerQ);
      fills.push(measureBubbleFill(data, x, y, radius));
    }
    fillValues.push(fills);
    const maxFill = Math.max(...fills);
    const filledCount = fills.filter(f => f >= fillThreshold).length;
    if (filledCount === 0) { answers.push('BLANK'); confidences.push(Math.max(0, 1 - maxFill)); }
    else if (filledCount > 1) { answers.push('MULTIPLE'); confidences.push(maxFill); }
    else { answers.push(OPTION_LETTERS[fills.indexOf(maxFill)]); confidences.push(maxFill); }
  }
  return { answers, confidences, fillValues };
}

function detectRoll(data: ImageData, digits = 2) {
  let roll = '', confSum = 0;
  for (let pos = 0; pos < digits; pos++) {
    let bestD = 0, bestF = 0;
    for (let d = 0; d <= 9; d++) {
      const { x, y } = getRollBubbleCenter(pos, d);
      const f = measureBubbleFill(data, x, y, 11);
      if (f > bestF) { bestF = f; bestD = d; }
    }
    if (bestF < 0.28) return { roll: '', confidence: 0 };
    roll += String(bestD); confSum += bestF;
  }
  return { roll, confidence: confSum / digits };
}

export async function processOMRImage(
  imageSource: string | Blob,
  totalQuestions: number,
  optionsPerQ: number,
  fillThreshold = 0.32
): Promise<ProcessResult> {
  try {
    const img = await loadImage(imageSource);
    const canvas = drawToCanvas(img, 1800);
    const ctx = canvas.getContext('2d')!;
    let gray = toGrayscale(ctx, canvas.width, canvas.height);
    gray = normalizeBrightness(gray);
    ctx.putImageData(gray, 0, 0);
    let sum = 0;
    for (let i = 0; i < gray.data.length; i += 40) sum += gray.data[i];
    if (sum / (gray.data.length / 40) < 25) {
      return { success: false, error: 'IMAGE TOO DARK. Use better lighting and try again.', answers: [], confidences: [], fillValues: [] };
    }
    const markers = detectMarkers(gray, canvas.width, canvas.height);
    if (!markers) {
      return {
        success: false,
        error: 'OMR ALIGNMENT NOT DETECTED.\n\nTips:\n- Show all 4 black corner squares\n- Keep sheet flat\n- Good lighting, no strong shadows\n- Phone parallel to paper',
        answers: [], confidences: [], fillValues: [],
      };
    }
    const aligned = warpPerspective(canvas, markers, TEMPLATE.pageWidth, TEMPLATE.pageHeight);
    const actx = aligned.getContext('2d')!;
    let aData = toGrayscale(actx, TEMPLATE.pageWidth, TEMPLATE.pageHeight);
    aData = normalizeBrightness(aData);
    actx.putImageData(aData, 0, 0);
    const { answers, confidences, fillValues } = detectAnswers(aData, totalQuestions, optionsPerQ, fillThreshold);
    const { roll, confidence: rollConf } = detectRoll(aData, 2);
    return { success: true, rollNumber: roll || undefined, rollConfidence: rollConf, answers, confidences, fillValues, alignedCanvas: aligned };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Processing failed', answers: [], confidences: [], fillValues: [] };
  }
}

export async function processForCalibration(imageSource: string | Blob, totalQuestions: number, optionsPerQ: number) {
  return processOMRImage(imageSource, totalQuestions, optionsPerQ, 0.25);
}
