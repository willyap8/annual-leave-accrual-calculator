# Annual Leave Accrual Forecaster

A static, client-side web app that forecasts your annual-leave-hour balance over time
using a continuous, purely time-based accrual model. Plan future leave, see the impact on an
interactive (pan/zoom) chart, get warned about negative balances, and keep all your data in
your browser. No backend, no login, no cloud — it runs entirely in the browser and is hosted
on GitHub Pages.

## Features

- **Accrual setup** — starting balance + reference date, annual entitlement (hours/year), and
  an *"accrual continues while on annual leave"* toggle.
- **Planned leave** — add/edit/delete date-range entries with hours and an optional label.
- **Forecast window** — pick any end date, or use the 3 / 6 / 12 / 24-month presets.
- **Date lookup** — get the projected balance on any single date.
- **Interactive chart** — zoom (scroll / pinch), pan (drag / touch), shaded leave periods,
  a zero threshold line, tooltips, and a "Reset zoom" button.
- **Negative-balance warning** — a non-blocking banner + chart marker if the balance dips
  below zero, naming the first date and the leave entry responsible.
- **Persistence** — everything auto-saves to `localStorage`; plus JSON export/import and a
  "Clear all" reset.
- **Light/dark mode** — respects your OS preference on first load, then remembers your choice.
- **Responsive** — fully usable on desktop and mobile (touch-friendly, pinch-zoom chart).

## Accrual model

The balance at any date `D` (on or after the reference date) is:

```
balance(D) = startingBalance
           + dailyRate × accruingDays(referenceDate → D)
           − plannedLeaveDeductedUpTo(D)
```

- **Daily rate** = `annualEntitlement / 365.25`. The `365.25` divisor absorbs leap years
  smoothly and lives as a single constant, `DAYS_PER_YEAR`, in
  [`src/accrual.ts`](src/accrual.ts) — change it there to adjust the model.
- **Accrual while on leave (checkbox):**
  - *Checked (default):* every calendar day accrues.
  - *Unchecked:* days on planned leave are excluded from the accruing-day count. The exclusion
    uses the **union** of all leave ranges, so overlapping entries never double-exclude a day.
- **Leave deduction (progressive):** each entry's hours are spread evenly across its inclusive
  days — an entry of `H` hours over `N` days deducts `H / N` per day. The full amount is
  deducted by the entry's end date; a mid-leave date shows a partial deduction. Overlapping
  entries simply **stack** (both deductions apply).
- The engine is a set of pure functions and can evaluate the balance at **any** date.

### Worked examples (also pinned as unit tests)

Starting balance 80 h, entitlement 152 h, reference date 2026-01-01
(`dailyRate = 152 / 365.25 ≈ 0.41615` h/day):

| Scenario | Date | Balance |
| --- | --- | --- |
| Pure accrual, no leave | 2026-04-01 (90 days) | **≈ 117.45 h** |
| + leave 1–5 Feb (38 h), accrual continues | 2026-04-01 | **≈ 79.45 h** |
| same, mid-leave (3 of 5 days) | 2026-02-03 | **≈ 70.93 h** |
| same leave, accrual paused (5 days excluded) | 2026-04-01 | **≈ 77.37 h** |

Run `npm test` to verify these and the edge cases.

## Run locally

Requires Node 18+ (Node 20 recommended).

```bash
npm install      # install dependencies
npm run dev      # start the dev server (http://localhost:5173)
npm test         # run the accrual unit tests
npm run build    # type-check + build static assets into dist/
npm run preview  # serve the production build locally
```

## Deploy to GitHub Pages

This project deploys as plain static files. Because GitHub Pages serves a project site from a
repo subpath (`https://<user>.github.io/<repo>/`), the app's asset base path must match the
repo name.

1. **Set the base path.** In [`vite.config.ts`](vite.config.ts), `REPO_BASE` must equal your
   repository name, surrounded by slashes. It currently is:

   ```ts
   const REPO_BASE = '/annual-leave-accural-calculator/';
   ```

   If you fork or rename the repo, change this string to match. For a **user/organization page**
   served from the domain root (`<user>.github.io`), set it to `'/'`.

2. **Enable Pages with GitHub Actions.** In the repo: **Settings → Pages → Build and
   deployment → Source → GitHub Actions**.

3. **Push to `main`.** The included workflow
   [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds the app and publishes
   `dist/` to Pages automatically on every push to `main` (and via manual "Run workflow").

   The site will be available at `https://<user>.github.io/<repo>/`.

> There is no client-side router, so deep links can't 404 — the whole app is a single page and
> the only thing the base path affects is where the JS/CSS assets are loaded from.

## Data & privacy

- All data is stored in your browser's **`localStorage`** — it is **per-browser and
  per-device**, and there is **no cross-device sync**. Clearing your browser data removes it.
- Use **Export JSON** to download a backup or to move your data to another device, and
  **Import JSON** to load it there.
- **Clear all** wipes the saved data and resets to defaults (with a confirmation prompt).

## Project structure

```
src/
├── accrual.ts        # the accrual engine (DAYS_PER_YEAR, balanceAt, sampleSeries, findFirstNegative)
├── accrual.test.ts   # unit tests for the worked examples + edge cases
├── dates.ts          # day-granularity date helpers
├── storage.ts        # localStorage load/save + JSON export/import
├── theme.ts          # light/dark theme hook
├── types.ts          # data model
├── validation.ts     # friendly inline validation
├── App.tsx           # layout + state wiring + autosave
└── components/       # ConfigForm, LeaveList, ForecastControls, DateLookup,
                      # BalanceChart, WarningBanner, DataControls
```

## Tech

Vite + React + TypeScript. Charting via **Chart.js** with `chartjs-plugin-zoom` (mouse-wheel /
pinch zoom + drag / touch pan) and `chartjs-plugin-annotation` (leave shading + the negative
marker). Chosen for a small footprint and first-class touch support.

## Out of scope

No backend / login / cloud sync; no leave types other than annual leave (the data model is
kept extensible); no pay-period or stepped accrual, no accrual based on hours worked; no
excessive-leave / cap warnings.
