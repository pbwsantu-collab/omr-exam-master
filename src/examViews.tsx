import type { Exam, OptionLetter, AppSettings } from './types';
import {
  upsertExam, getResultsForExam, exportBackup, importBackup, generateSheetId, saveSettings
} from './lib/storage';
import { SettingsScreen, CalibrationScreen } from './screens';

const OPTIONS_4: OptionLetter[] = ['A', 'B', 'C', 'D'];
const OPTIONS_5: OptionLetter[] = ['A', 'B', 'C', 'D', 'E'];

interface Props {
  view: string;
  setView: (v: any) => void;
  form: any;
  setForm: (f: any) => void;
  currentExam: Exam | null;
  setCurrentExam: (e: Exam | null) => void;
  saveExam: (lock?: boolean) => void;
  refreshExams: () => void;
  settings: AppSettings;
  setSettingsState: (s: AppSettings) => void;
}

export function ExamViews({
  view, setView, form, setForm, currentExam, setCurrentExam,
  saveExam, refreshExams, settings, setSettingsState
}: Props) {
  if (view === 'create-exam') {
    return (
      <div className="page">
        <div className="header">
          <button className="back-btn" onClick={() => setView('dashboard')}>←</button>
          <h1>Create Exam</h1>
        </div>
        {([
          ['School Name', 'schoolName'], ['Exam Name', 'examName'], ['Academic Year', 'academicYear'],
          ['Subject', 'subject'], ['Semester / Term', 'semester'], ['Chapter / Unit', 'chapter'],
        ] as const).map(([label, key]) => (
          <div className="form-group" key={key}>
            <label>{label}</label>
            <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
          </div>
        ))}
        <div className="grid-2">
          <div className="form-group">
            <label>Class</label>
            <select value={form.classLevel} onChange={(e) => setForm({ ...form, classLevel: e.target.value })}>
              <option value="XI">XI</option><option value="XII">XII</option>
            </select>
          </div>
          <div className="form-group">
            <label>Exam Date</label>
            <input type="date" value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })} />
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label>Total Questions</label>
            <input type="number" min={1} max={100} value={form.totalQuestions}
              onChange={(e) => setForm({ ...form, totalQuestions: +e.target.value })} />
          </div>
          <div className="form-group">
            <label>Options</label>
            <select value={form.optionsPerQuestion}
              onChange={(e) => setForm({ ...form, optionsPerQuestion: +e.target.value })}>
              <option value={4}>A B C D</option><option value={5}>A B C D E</option>
            </select>
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label>Marks per Question</label>
            <input type="number" step={0.25} value={form.marksPerQuestion}
              onChange={(e) => setForm({ ...form, marksPerQuestion: +e.target.value })} />
          </div>
          <div className="form-group">
            <label>Negative Marks</label>
            <input type="number" step={0.25} value={form.negativeMarks}
              onChange={(e) => setForm({ ...form, negativeMarks: +e.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label>Passing Marks</label>
          <input type="number" value={form.passingMarks}
            onChange={(e) => setForm({ ...form, passingMarks: +e.target.value })} />
        </div>
        <button className="btn-primary btn-lg" onClick={() => saveExam(false)} style={{ marginTop: 12 }}>
          Save & Set Answer Key
        </button>
      </div>
    );
  }

  if (view === 'answer-key' && currentExam) {
    const opts = currentExam.optionsPerQuestion === 5 ? OPTIONS_5 : OPTIONS_4;
    const setKey = (q: number, letter: OptionLetter) => {
      if (currentExam.answerKeyLocked) {
        if (!confirm('Answer key is LOCKED. Unlocking may affect existing results. Continue?')) return;
      }
      const key = [...currentExam.answerKey];
      key[q] = letter;
      const updated = { ...currentExam, answerKey: key, answerKeyLocked: false, updatedAt: new Date().toISOString() };
      upsertExam(updated); setCurrentExam(updated); refreshExams();
    };
    const lock = () => {
      if (currentExam.answerKey.some((a) => !a)) {
        if (!confirm('Some questions have no answer selected. Lock anyway?')) return;
      }
      const updated = { ...currentExam, answerKeyLocked: true, updatedAt: new Date().toISOString() };
      upsertExam(updated); setCurrentExam(updated); refreshExams();
      alert('ANSWER KEY LOCKED \u2713'); setView('dashboard');
    };
    return (
      <div className="page">
        <div className="header">
          <button className="back-btn" onClick={() => setView('dashboard')}>←</button>
          <h1>Answer Key</h1>
        </div>
        {currentExam.answerKeyLocked && (
          <div className="card" style={{ background: '#d1fae5', textAlign: 'center', fontWeight: 700 }}>
            ANSWER KEY LOCKED \u2713
          </div>
        )}
        <div className="card">
          {Array.from({ length: currentExam.totalQuestions }, (_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 36, fontWeight: 600 }}>Q{i + 1}</span>
              <div className="option-btns">
                {opts.map((o) => (
                  <button key={o}
                    className={currentExam.answerKey[i] === o ? (currentExam.answerKeyLocked ? 'locked' : 'selected') : ''}
                    onClick={() => setKey(i, o)}>{o}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button className="btn-outline btn-block" onClick={() => { upsertExam(currentExam); alert('Draft saved'); }}>SAVE DRAFT</button>
          <button className="btn-success btn-block" onClick={lock} disabled={currentExam.answerKeyLocked}>LOCK ANSWER KEY</button>
        </div>
      </div>
    );
  }

  if (view === 'omr-print' && currentExam) {
    const opts = currentExam.optionsPerQuestion === 5 ? OPTIONS_5 : OPTIONS_4;
    const sheetId = generateSheetId(currentExam.id, (getResultsForExam(currentExam.id).length || 0) + 1);
    const qPerCol = Math.ceil(currentExam.totalQuestions / 2);
    return (
      <div className="page">
        <div className="header no-print">
          <button className="back-btn" onClick={() => setView('dashboard')}>←</button>
          <h1>OMR Sheet</h1>
        </div>
        <div className="no-print" style={{ marginBottom: 12 }}>
          <button className="btn-primary btn-block" onClick={() => window.print()}>🖨\ufe0f Print A4 OMR</button>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 8 }}>Sheet ID: {sheetId}</p>
        </div>
        <div className="print-area omr-sheet">
          <div className="omr-marker tl" /><div className="omr-marker tr" />
          <div className="omr-marker bl" /><div className="omr-marker br" />
          <div style={{ textAlign: 'center', marginBottom: 8, borderBottom: '1px solid #000', paddingBottom: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{currentExam.schoolName}</div>
            <div style={{ fontSize: 12 }}>{currentExam.examName || currentExam.subject} \u00b7 Class {currentExam.classLevel} \u00b7 {currentExam.subject}</div>
            <div style={{ fontSize: 10 }}>Semester: {currentExam.semester} \u00b7 Date: {currentExam.examDate} \u00b7 Sheet: {sheetId}</div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 11 }}>
            <div>Name: ________________________</div>
            <div>Roll: ________</div>
            <div>Section: ____</div>
          </div>
          <div style={{ marginBottom: 8, fontSize: 10 }}>
            <strong>ROLL NUMBER</strong>
            <div style={{ display: 'flex', gap: 20, marginTop: 4 }}>
              {[0, 1].map((pos) => (
                <div key={pos}>
                  {Array.from({ length: 10 }, (_, d) => (
                    <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                      <span style={{ width: 12 }}>{d}</span><span className="bubble" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            {[0, 1].map((col) => (
              <div key={col} style={{ flex: 1 }}>
                {Array.from({ length: qPerCol }, (_, r) => {
                  const q = col * qPerCol + r;
                  if (q >= currentExam.totalQuestions) return null;
                  return (
                    <div key={q} style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ width: 28, fontWeight: 600 }}>{String(q + 1).padStart(2, '0')}</span>
                      {opts.map((o) => <span key={o} className="bubble">{o}</span>)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 9, textAlign: 'center' }}>
            Exam ID: {currentExam.id.slice(0, 12)} \u00b7 Template v{currentExam.templateVersion}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'class-results' && currentExam) {
    const results = getResultsForExam(currentExam.id).sort((a, b) => b.marksObtained - a.marksObtained);
    const exportCSV = () => {
      const header = 'Rank,Roll,Student,Correct,Wrong,Blank,Marks,Percentage,Grade,Result\n';
      const rows = results.map((r, i) =>
        `${i + 1},${r.rollNumber},"${r.studentName}",${r.correctCount},${r.wrongCount},${r.blankCount},${r.marksObtained},${r.percentage},${r.grade},${r.result}`
      ).join('\n');
      const blob = new Blob([header + rows], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${currentExam.subject}_results.csv`;
      a.click();
    };
    return (
      <div className="page">
        <div className="header">
          <button className="back-btn" onClick={() => setView('dashboard')}>←</button>
          <h1>Class Results</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button className="btn-outline" onClick={exportCSV}>CSV Export</button>
          <button className="btn-outline" onClick={() => window.print()}>Print</button>
        </div>
        <div className="table-wrap card">
          <table>
            <thead><tr><th>#</th><th>Roll</th><th>Student</th><th>C</th><th>W</th><th>B</th><th>Marks</th><th>%</th><th>Gr</th></tr></thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={r.id}>
                  <td>{i + 1}</td><td>{r.rollNumber}</td><td>{r.studentName}</td>
                  <td>{r.correctCount}</td><td>{r.wrongCount}</td><td>{r.blankCount}</td>
                  <td>{r.marksObtained}</td><td>{r.percentage}</td><td>{r.grade}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {results.length === 0 && <p style={{ padding: 12, color: 'var(--muted)' }}>No scans yet.</p>}
        </div>
      </div>
    );
  }

  if (view === 'analytics' && currentExam) {
    const results = getResultsForExam(currentExam.id);
    if (results.length === 0) {
      return (
        <div className="page">
          <div className="header"><button className="back-btn" onClick={() => setView('dashboard')}>←</button><h1>Question Analysis</h1></div>
          <p>No results yet.</p>
        </div>
      );
    }
    const n = results.length;
    const stats = Array.from({ length: currentExam.totalQuestions }, (_, q) => {
      let correct = 0, wrong = 0, blank = 0;
      results.forEach((r) => {
        const a = r.finalAnswers[q];
        const key = currentExam.answerKey[q];
        if (a === 'BLANK' || a === 'UNCERTAIN') blank++;
        else if (a === 'MULTIPLE') wrong++;
        else if (a === key) correct++;
        else wrong++;
      });
      return { q, correct: Math.round((correct / n) * 100), wrong: Math.round((wrong / n) * 100), blank: Math.round((blank / n) * 100) };
    });
    const hardest = [...stats].sort((a, b) => a.correct - b.correct).slice(0, 5);
    return (
      <div className="page">
        <div className="header"><button className="back-btn" onClick={() => setView('dashboard')}>←</button><h1>Question Analysis</h1></div>
        <p style={{ marginBottom: 12, color: 'var(--muted)' }}>{n} students scanned</p>
        <h3 style={{ marginBottom: 8 }}>Most Difficult</h3>
        {hardest.map((s) => (
          <div key={s.q} className="card">
            <strong>Q{s.q + 1}</strong> \u2014 Correct: {s.correct}% \u00b7 Wrong: {s.wrong}% \u00b7 Blank: {s.blank}%
          </div>
        ))}
        <h3 style={{ margin: '16px 0 8px' }}>All Questions</h3>
        {stats.map((s) => (
          <div key={s.q} style={{ fontSize: '0.85rem', marginBottom: 4 }}>
            Q{s.q + 1}: C {s.correct}% / W {s.wrong}% / B {s.blank}%
          </div>
        ))}
      </div>
    );
  }

  if (view === 'settings') {
    return <SettingsScreen settings={settings} onSave={(s) => { saveSettings(s); setSettingsState(s); alert('Saved'); }} onBack={() => setView('dashboard')} />;
  }

  if (view === 'backup') {
    return (
      <div className="page">
        <div className="header"><button className="back-btn" onClick={() => setView('dashboard')}>←</button><h1>Backup / Restore</h1></div>
        <button className="btn-primary btn-lg" onClick={() => {
          const json = exportBackup();
          const blob = new Blob([json], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `omr-backup-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
        }}>BACKUP DATA (JSON)</button>
        <label className="btn-outline btn-lg" style={{ display: 'block', textAlign: 'center', marginTop: 12 }}>
          RESTORE DATA
          <input type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = () => {
              const res = importBackup(reader.result as string);
              alert(res.message);
              if (res.ok) { refreshExams(); setView('dashboard'); }
            };
            reader.readAsText(f);
          }} />
        </label>
        <p style={{ marginTop: 16, fontSize: '0.85rem', color: 'var(--muted)' }}>
          Data is stored locally on this device. Backup before clearing browser data.
        </p>
      </div>
    );
  }

  if (view === 'calibration') {
    return <CalibrationScreen exam={currentExam} onBack={() => setView('dashboard')} />;
  }

  return null;
}
