import { useState, useEffect } from 'react';
import type { Exam, AnswerState, OptionLetter, AppSettings } from './types';
import { processOMRImage } from './lib/omrProcessor';

const OPTIONS_4: OptionLetter[] = ['A', 'B', 'C', 'D'];
const OPTIONS_5: OptionLetter[] = ['A', 'B', 'C', 'D', 'E'];

export function ScanScreen({ processing, scanError, onCapture, onBack }: {
  processing: boolean; scanError: string | null;
  onCapture: (dataUrl: string) => void; onBack: () => void;
}) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  useEffect(() => {
    let s: MediaStream | null = null;
    (async () => {
      try {
        s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        setStream(s);
      } catch { /* use file upload */ }
    })();
    return () => { s?.getTracks().forEach((t) => t.stop()); };
  }, []);

  const capture = () => {
    const video = document.getElementById('omr-video') as HTMLVideoElement;
    if (!video) return;
    const c = document.createElement('canvas');
    c.width = video.videoWidth; c.height = video.videoHeight;
    c.getContext('2d')!.drawImage(video, 0, 0);
    stream?.getTracks().forEach((t) => t.stop());
    onCapture(c.toDataURL('image/jpeg', 0.92));
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onCapture(reader.result as string);
    reader.readAsDataURL(f);
  };

  return (
    <div className="camera-overlay">
      {stream ? (
        <>
          <video id="omr-video" autoPlay playsInline muted ref={(el) => { if (el && stream) el.srcObject = stream; }} />
          <div className="camera-guide" />
          <div style={{ position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center', color: '#fff', fontWeight: 600 }}>
            Place the complete OMR sheet inside the frame
          </div>
          <div className="camera-controls">
            <button className="btn-outline" style={{ color: '#fff', borderColor: '#fff' }} onClick={() => { stream.getTracks().forEach(t => t.stop()); onBack(); }}>Cancel</button>
            <button className="btn-success btn-lg" onClick={capture} disabled={processing}>{processing ? 'Processing…' : 'CAPTURE'}</button>
          </div>
        </>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', padding: 24 }}>
          <p style={{ marginBottom: 16 }}>{scanError || 'Starting camera…'}</p>
          <label className="btn-primary btn-lg" style={{ display: 'inline-block' }}>
            Upload Photo Instead
            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onFile} />
          </label>
          <button className="btn-outline" style={{ marginTop: 12, color: '#fff', borderColor: '#fff' }} onClick={onBack}>Back</button>
        </div>
      )}
      {processing && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.2rem' }}>
          Processing OMR…
        </div>
      )}
    </div>
  );
}

export function ReviewScreen({ exam, pending, reviewIndices, onConfirm }: {
  exam: Exam; pending: { answers: AnswerState[]; confidences: number[] };
  reviewIndices: number[];
  onConfirm: (answers: AnswerState[], name: string, roll: string) => void;
}) {
  const [answers, setAnswers] = useState<AnswerState[]>([...pending.answers]);
  const opts = exam.optionsPerQuestion === 5 ? OPTIONS_5 : OPTIONS_4;
  return (
    <div className="page">
      <div className="header"><h1>⚠ REVIEW REQUIRED</h1></div>
      <p style={{ marginBottom: 12, color: 'var(--warning)' }}>Some answers need confirmation. Tap to correct.</p>
      {reviewIndices.map((i) => (
        <div key={i} className="card">
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            Q{i + 1} — Detected: {pending.answers[i]} ({Math.round((pending.confidences[i] || 0) * 100)}%)
          </div>
          <div className="option-btns">
            {opts.map((o) => (
              <button key={o} className={answers[i] === o ? 'selected' : ''}
                onClick={() => { const next = [...answers]; next[i] = o; setAnswers(next); }}>{o}</button>
            ))}
            <button className={answers[i] === 'BLANK' ? 'selected' : ''}
              onClick={() => { const next = [...answers]; next[i] = 'BLANK'; setAnswers(next); }}>—</button>
          </div>
        </div>
      ))}
      <button className="btn-success btn-lg" style={{ marginTop: 12 }} onClick={() => {
        const name = prompt('Student name:', '') || 'Student';
        const roll = prompt('Roll number:', '') || '—';
        onConfirm(answers, name, roll);
      }}>CONFIRM RESULT</button>
    </div>
  );
}

export function SettingsScreen({ settings, onSave, onBack }: {
  settings: AppSettings; onSave: (s: AppSettings) => void; onBack: () => void;
}) {
  const [s, setS] = useState(settings);
  return (
    <div className="page">
      <div className="header"><button className="back-btn" onClick={onBack}>←</button><h1>Settings</h1></div>
      <div className="form-group">
        <label>High confidence threshold (auto-accept)</label>
        <input type="number" step={0.05} min={0.5} max={1} value={s.highConfidenceThreshold}
          onChange={(e) => setS({ ...s, highConfidenceThreshold: +e.target.value })} />
      </div>
      <div className="form-group">
        <label>Low confidence threshold (review)</label>
        <input type="number" step={0.05} min={0.2} max={0.7} value={s.lowConfidenceThreshold}
          onChange={(e) => setS({ ...s, lowConfidenceThreshold: +e.target.value })} />
      </div>
      <div className="form-group">
        <label>Bubble fill threshold</label>
        <input type="number" step={0.05} min={0.15} max={0.6} value={s.fillThreshold}
          onChange={(e) => setS({ ...s, fillThreshold: +e.target.value })} />
      </div>
      <button className="btn-primary btn-block" onClick={() => onSave(s)}>Save Settings</button>
    </div>
  );
}

export function CalibrationScreen({ exam, onBack }: { exam: Exam | null; onBack: () => void }) {
  const [log, setLog] = useState('Upload a test OMR photo to see fill values.');
  return (
    <div className="page">
      <div className="header"><button className="back-btn" onClick={onBack}>←</button><h1>OMR Calibration</h1></div>
      <p style={{ marginBottom: 12, fontSize: '0.9rem' }}>Test detection with real photos. Shows fill ratio per bubble.</p>
      <label className="btn-primary btn-lg" style={{ display: 'block', textAlign: 'center' }}>
        Upload Test Image
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f || !exam) { setLog('Select an exam first from dashboard.'); return; }
          setLog('Processing…');
          const reader = new FileReader();
          reader.onload = async () => {
            const res = await processOMRImage(reader.result as string, exam.totalQuestions, exam.optionsPerQuestion, 0.25);
            if (!res.success) { setLog(res.error || 'Failed'); return; }
            let text = `Roll: ${res.rollNumber || 'N/A'} (${Math.round((res.rollConfidence || 0) * 100)}%)\n\n`;
            res.answers.forEach((a, i) => {
              const fills = res.fillValues[i]?.map((v) => v.toFixed(2)).join(', ') || '';
              text += `Q${i + 1}: ${a} conf=${Math.round(res.confidences[i] * 100)}% fills=[${fills}]\n`;
            });
            setLog(text);
          };
          reader.readAsDataURL(f);
        }} />
      </label>
      <pre style={{ marginTop: 16, fontSize: '0.75rem', whiteSpace: 'pre-wrap', background: '#111', color: '#0f0', padding: 12, borderRadius: 8, maxHeight: 400, overflow: 'auto' }}>
        {log}
      </pre>
    </div>
  );
}
