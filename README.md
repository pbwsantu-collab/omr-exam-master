# OMR Exam Master XI–XII

Production-oriented mobile-first PWA for teachers to:

1. Create fixed-answer OMR exams (Class XI / XII)
2. Lock an answer key
3. Print standardized A4 OMR sheets with alignment markers
4. Scan completed sheets with an Android phone camera
5. Automatically evaluate answers **locally in the browser**
6. Show marks, grade and pass/fail within seconds
7. Process the next student immediately (Fast Scan mode)

## Important principles

- **No backend required** for scanning / marking
- **No external AI API** for OMR detection
- Deterministic, template-based bubble detection
- Works offline after first load (PWA + localStorage)
- Teacher can always review uncertain / multiple answers

## Tech stack

- Vite + React 19 + TypeScript
- localStorage for exams, results, settings
- Canvas-based image processing (grayscale, normalization, marker detection, perspective warp, fill measurement)
- Print CSS for A4 OMR and results
- Service Worker + Web App Manifest for installability

## Quick start

```bash
npm install
npm run dev
```

Open the URL on an Android phone (or Chrome with camera).

For GitHub Pages:

```bash
npm run build
# Deploy the `dist` folder. `base` is already set to `./`
```

Live repo: https://github.com/pbwsantu-collab/omr-exam-master

## Workflow

1. **Create Exam** — school, class, subject, questions, marks, negative marking
2. **Answer Key** — select correct option per question → **LOCK ANSWER KEY**
3. **Print OMR** — A4 sheet with 4 corner markers, roll bubbles, question bubbles
4. **SCAN OMR** — camera or photo upload
5. Processing runs automatically
6. Clean sheet → instant result screen
7. Uncertain answers → review screen → confirm
8. **NEXT SCAN** for the next student
9. Class results, CSV export, question analysis, backup/restore

## Calibration

Use **OMR Calibration / Test** from the dashboard to upload real photos and inspect fill ratios per bubble. Adjust thresholds in Settings if needed.

## License

For educational use by schools and teachers.
