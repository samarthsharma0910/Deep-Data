# Sepsis Monitor (dashboard)

Frontend for the sepsis early-warning project: unit census, alert queue, patient investigation and model
performance. It only **displays** risk scores and evaluation output; it never trains, scores or estimates anything.

React 18 · TypeScript · Vite · hand-drawn SVG charts (d3-scale / d3-shape / d3-array) · plain CSS tokens.

## Run

```
cd dashboard
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build in dist/
```

## Data

The app reads one file, `public/data/dataset.json` (shape documented on the Model Performance page).

| Source | Command | Result |
| --- | --- | --- |
| Simulated demo cohort (18 patients, seed 7) | `python scripts/simulate.py` | badge **DEMO · SIMULATED DATA** |
| Real held-out records + model scores | `python scripts/export_from_project.py --scores ../submissions/submission.csv --model-version v1.0` | badge **RETROSPECTIVE REPLAY** |

`export_from_project.py` replays the last 48 recorded hours of 18 held-out patients (spread across risk), maps
`Resp → rr`, `O2Sat → spo2`, etc., and leaves unmeasured values `null`. The dataset has no GCS, diagnosis or bed
numbers, so those stay empty; the dashboard shows "n/a" / "—" for them. Pass `--evaluation results.json`
(ModelEvaluation shape) to light up AUROC/AUPRC, ROC, PR, calibration and lead-time charts.

To read from a service instead, set `apiBase` in `src/data/source.ts` and serve the same JSON at `GET {apiBase}/dataset`.

## Layout

```
src/types.ts            data contract            src/config/clinical.ts  thresholds, criteria, copy
src/lib/                derive (scores, SOFA, qSOFA, episodes), alerts (priority), store, router, time
src/charts/             one file per chart + shared frame, axes, tooltip, synced hover
src/components/         header, nav, cells, action dialog, toast, patient panels
src/pages/              Census, AlertQueue, PatientView, ModelPerformance, Settings
```

## Notes

- Threshold (default 60) is a demo setting, not clinically validated; the Model Performance slider drives every page.
- Review actions and bundle records live in browser memory for the session only.
- SOFA is partial (cardiovascular, renal, coagulation, CNS); respiratory and liver need data not present here.
