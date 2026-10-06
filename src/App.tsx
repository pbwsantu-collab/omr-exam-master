import { useState, useEffect, useCallback } from 'react';
import type { Exam, StudentResult, AnswerState, AppSettings } from './types';
import { DEFAULT_GRADE_RANGES, DEFAULT_SETTINGS } from './types';
import {
  getExams, upsertExam, upsertResult,
  findResultBySheetId, getSettings, getCurrentExamId, setCurrentExamId,
  generateId, generateSheetId
} from './lib/storage';
import { buildResult, needsReview } from './lib/marking';
import { processOMRImage } from './lib/omrProcessor';
import './index.css';
import { ScanScreen, ReviewScreen } from './screens';
import { ExamViews } from './examViews';

type View =
  | 'dashboard' | 'create-exam' | 'answer-key' | 'omr-print' | 'scan'
  | 'result' | 'review' | 'class-results' | 'analytics' | 'settings' | 'backup' | 'calibration';

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [exams, setExams] = useState<Exam[]>([]);
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);
  const [lastResult, setLastResult] = useState<StudentResult | null>(null);
  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [scanError, setScanError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [reviewIndices, setReviewIndices] = useState<number[]>([]);
  const [pendingProcess, setPendingProcess] = useState<{
    answers: AnswerState[]; confidences: number[]; sheetId: string;
    rollNumber: string; imageDataUrl?: string;
  } | null>(null);

  const [form, setForm] = useState({
    schoolName: 'Bagmara B.B.M. Vidyaniketan',
    examName: '', academicYear: '2025-26', classLevel: 'XII' as 'XI' | 'XII',
    subject: 'English', semester: 'IV', chapter: '',
    examDate: new Date().toISOString().slice(0, 10),
    totalQuestions: 40, optionsPerQuestion: 4 as 4 | 5,
    marksPerQuestion: 1, negativeMarks: 0.25, passingMarks: 16,
  });

  useEffect(() => {
    setExams(getExams());
    setSettingsState(getSettings());
    const cid = getCurrentExamId();
    if (cid) {
      const e = getExams().find((x) => x.id === cid);
      if (e) setCurrentExam(e);
    }
  }, []);

  const refreshExams = () => setExams(getExams());
  const selectExam = (e: Exam) => { setCurrentExam(e); setCurrentExamId(e.id); };

  const saveExam = (lockKey = false) => {
    const id = currentExam?.id || generateId();
    const answerKey = currentExam?.answerKey || Array(form.totalQuestions).fill(null);
    while (answerKey.length < form.totalQuestions) answerKey.push(null);
    const exam: Exam = {
      id, ...form,
      answerKey: answerKey.slice(0, form.totalQuestions),
      answerKeyLocked: lockKey ? true : (currentExam?.answerKeyLocked || false),
      gradeRanges: currentExam?.gradeRanges || DEFAULT_GRADE_RANGES,
      templateVersion: '1.0',
      createdAt: currentExam?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    upsertExam(exam);
    selectExam(exam);
    refreshExams();
    if (lockKey) { alert('Answer key LOCKED \u2713'); setView('dashboard'); }
    else setView('answer-key');
  };

  const handleCapture = useCallback(async (dataUrl: string) => {
    if (!currentExam) return;
    setProcessing(true);
    setScanError(null);
    try {
      const result = await processOMRImage(
        dataUrl, currentExam.totalQuestions, currentExam.optionsPerQuestion, settings.fillThreshold
      );
      if (!result.success) {
        setScanError(result.error || 'Processing failed');
        setProcessing(false);
        return;
      }
      const sheetId = result.sheetId || generateSheetId(currentExam.id, Date.now() % 10000);
      const existing = findResultBySheetId(sheetId);
      if (existing) {
        const action = confirm(
          `DUPLICATE SHEET DETECTED\n\nSheet: ${sheetId}\nStudent: ${existing.studentName}\nMarks: ${existing.marksObtained}\n\nOK = View existing \u00b7 Cancel = Rescan/Replace`
        );
        if (action) { setLastResult(existing); setView('result'); setProcessing(false); return; }
      }
      const review = needsReview(result.answers, result.confidences, settings.lowConfidenceThreshold);
      const pending = {
        answers: result.answers, confidences: result.confidences,
        sheetId, rollNumber: result.rollNumber || '', imageDataUrl: dataUrl,
      };
      setPendingProcess(pending);
      if (review.length === 0) {
        const name = prompt('Student name (optional):', '') || 'Student';
        let roll = result.rollNumber || '';
        if (!roll) roll = prompt('Roll number (could not be read):', '') || '\u2014';
        const studentResult = buildResult(currentExam, {
          sheetId, studentName: name, rollNumber: roll,
          detectedAnswers: result.answers, confidences: result.confidences,
          finalAnswers: result.answers, scanImageDataUrl: dataUrl,
        });
        upsertResult(studentResult);
        setLastResult(studentResult);
        setView('result');
      } else {
        setReviewIndices(review);
        setView('review');
      }
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Unknown error');
    }
    setProcessing(false);
  }, [currentExam, settings]);

  if (view === 'scan') {
    return <ScanScreen
      processing={processing} scanError={scanError}
      onCapture={handleCapture} onBack={() => setView('dashboard')}
    />;
  }

  if (view === 'review' && currentExam && pendingProcess) {
    return <ReviewScreen
      exam={currentExam} pending={pendingProcess} reviewIndices={reviewIndices}
      onConfirm={(answers, name, roll) => {
        const studentResult = buildResult(currentExam, {
          sheetId: pendingProcess.sheetId, studentName: name, rollNumber: roll,
          detectedAnswers: pendingProcess.answers, confidences: pendingProcess.confidences,
          finalAnswers: answers,
          corrections: Object.fromEntries(reviewIndices.map((i) => [i, answers[i]])),
          scanImageDataUrl: pendingProcess.imageDataUrl,
        });
        upsertResult(studentResult);
        setLastResult(studentResult);
        setPendingProcess(null);
        setView('result');
      }}
    />;
  }

  if (view === 'result' && lastResult && currentExam) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: 'center', background: '#ecfdf5' }}>
          <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 8 }}>SCAN SUCCESSFUL \u2713</div>
          <div>Student: <strong>{lastResult.studentName}</strong></div>
          <div>Roll: {lastResult.rollNumber} \u00b7 Class {currentExam.classLevel}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{currentExam.subject}</div>
        </div>
        <div className="result-big">
          <div className="marks">{lastResult.marksObtained} / {lastResult.maxMarks}</div>
          <div>Percentage: {lastResult.percentage}%</div>
          <div style={{ marginTop: 8 }}>
            Correct: {lastResult.correctCount} \u00b7 Wrong: {lastResult.wrongCount} \u00b7 Blank: {lastResult.blankCount}
          </div>
          {lastResult.negativeApplied > 0 && <div>Negative: \u2212{lastResult.negativeApplied}</div>}
          <div style={{ marginTop: 12, fontSize: '1.25rem' }}>Grade: {lastResult.grade}</div>
          <div className={lastResult.result === 'PASS' ? 'status-pass' : 'status-fail'}>
            RESULT: {lastResult.result}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn-primary btn-lg" onClick={() => setView('scan')}>NEXT SCAN</button>
          <button className="btn-outline btn-block" onClick={() => window.print()}>PRINT RESULT</button>
          <button className="btn-outline btn-block" onClick={() => setView('class-results')}>VIEW CLASS RESULTS</button>
          <button className="btn-outline btn-block" onClick={() => setView('dashboard')}>Dashboard</button>
        </div>
      </div>
    );
  }

  if (view === 'dashboard') {
    return (
      <div className="page">
        <div className="header"><h1>OMR Exam Master XI\u2013XII</h1></div>
        <p style={{ color: 'var(--muted)', marginBottom: 16, fontSize: '0.9rem' }}>
          Create exam \u2192 Lock key \u2192 Print OMR \u2192 Scan \u2192 Instant result
        </p>
        {currentExam && (
          <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
            <strong>{currentExam.examName || currentExam.subject}</strong>
            <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              {currentExam.schoolName} \u00b7 Class {currentExam.classLevel} \u00b7 {currentExam.subject}
              {currentExam.answerKeyLocked && ' \u00b7 KEY LOCKED \u2713'}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn-primary btn-lg" onClick={() => setView('scan')} disabled={!currentExam?.answerKeyLocked}>
            \ud83d\udcf7 SCAN OMR
          </button>
          {!currentExam?.answerKeyLocked && (
            <p style={{ fontSize: '0.8rem', color: 'var(--warning)', textAlign: 'center' }}>
              Select an exam and lock the answer key first
            </p>
          )}
          <button className="btn-outline btn-block" onClick={() => setView('create-exam')}>\u2795 Create Exam</button>
          <button className="btn-outline btn-block" onClick={() => setView('answer-key')} disabled={!currentExam}>\u270f\ufe0f Answer Key</button>
          <button className="btn-outline btn-block" onClick={() => setView('omr-print')} disabled={!currentExam}>\ud83d\udda8\ufe0f Print OMR Sheet</button>
          <button className="btn-outline btn-block" onClick={() => setView('class-results')} disabled={!currentExam}>\ud83d\udcca Class Results</button>
          <button className="btn-outline btn-block" onClick={() => setView('analytics')} disabled={!currentExam}>\ud83d\udcc8 Question Analysis</button>
          <button className="btn-outline btn-block" onClick={() => setView('settings')}>\u2699\ufe0f Settings</button>
          <button className="btn-outline btn-block" onClick={() => setView('backup')}>\ud83d\udcbe Backup / Restore</button>
          <button className="btn-outline btn-block" onClick={() => setView('calibration')} style={{ fontSize: '0.8rem' }}>\ud83d\udd27 OMR Calibration / Test</button>
        </div>
        <div style={{ marginTop: 24 }}>
          <h3 style={{ marginBottom: 8 }}>Exams</h3>
          {exams.length === 0 && <p style={{ color: 'var(--muted)' }}>No exams yet. Create one.</p>}
          {exams.map((e) => (
            <div key={e.id} className="card" style={{ cursor: 'pointer', border: currentExam?.id === e.id ? '2px solid var(--primary)' : undefined }}
              onClick={() => selectExam(e)}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{e.examName || e.subject}</strong>
                {e.answerKeyLocked && <span style={{ color: 'var(--success)', fontSize: '0.8rem' }}>LOCKED \u2713</span>}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                Class {e.classLevel} \u00b7 {e.subject} \u00b7 {e.totalQuestions}Q \u00b7 {e.examDate}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <ExamViews
      view={view}
      setView={setView}
      form={form}
      setForm={setForm}
      currentExam={currentExam}
      setCurrentExam={setCurrentExam}
      saveExam={saveExam}
      refreshExams={refreshExams}
      settings={settings}
      setSettingsState={setSettingsState}
    />
  );
}
