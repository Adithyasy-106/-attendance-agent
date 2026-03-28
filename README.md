# 🎓 Attendance Risk Alert Agent (V5 - Enterprise Edition)

> **"The ultimate attendance management suite for CMRIT students."**

A high-fidelity, rule-based experience that helps students predict, manage, and recover their attendance profile. The UI stays in **Next.js**; academic and ERP logic live in a small **Express** API with an in-memory session per run.

---

## 🏗️ System Architecture

The project uses a **decoupled** layout: the client collects setup data and calls the API; the server owns sessions, attendance fetch, timetable/COE merge, and chat replies.

### 1. Logic core (backend — `server/`)

- **Express**: `POST /api/erp-sync` pulls attendance once (demo or live ERP). `POST /api/setup` stores the session (optional client `attendance` to avoid a second fetch, timetable grid, merged COE). `POST /api/chat` runs intent classification and formatted replies. `GET /api/health` for load balancers.
- **Decision engine (`utils/decisionEngine.js`)**:
  - **Fuzzy intent matching** (e.g. typos like “bnk”, “atdn”, “tmrw”).
  - **20+ intents**: attendance, bunk/skip, weekday schedules, **COE today / month / weekly highlights**, **holidays**, **IAT countdown** (from synced COE when available), recovery, risk, and more.
- **Attendance logic (`utils/attendanceCalculator.js`)**: 75% threshold framing, skip budgets, recovery ceilings — advisory only; always confirms rules with official notices.
- **COE pipeline**:
  - Client sends **`coeEvents`** (PDF-derived rows) plus **`recoveryMetadata`** and **`coeOcrSummary`**.
  - Server builds a **registry timeline** from semester (`utils/coeRegistry.js`) and **merges** with client rows (`utils/coeMerge.js`) so IAT windows, milestones, and holiday anchors stay available even when the PDF text layer is thin.
- **Sessions**: Stored **in memory** on the Node process. Restarting the API clears all chats until setup runs again.

### 2. Command center (frontend — `client/`)

- **Next.js (App Router)**, **React**, **Tailwind**, **Framer Motion**, **Lucide**.
- **Setup flow**: profile → **ERP sync** (calls `/api/erp-sync`; see `ERP_SCRAPER_MODE` below) → **COE PDF upload** → timetable image → **Tesseract OCR** into the grid → review → finish. Finish posts the full payload (including **`coeEvents`** and **`attendance`** from the ERP step) to `/api/setup`.
- **COE PDF parsing (`lib/coePdfExtract.ts`)**: **pdf.js** text extraction; lines are classified (IAT, holiday, milestone, etc.) and merged with **`lib/coeRegistryData.ts`**. The **pdf.js worker** is served from **`client/public/pdf.worker.min.mjs`** (keep this file aligned with your installed `pdfjs-dist` version).
- **Chat**: quick actions for summaries, schedules, COE, holidays, IAT countdown, recovery, etc.

---

## 🚀 Key features

### Smart bunk / skip framing

Per-subject or day-level guidance using synced ERP ratios and the active timetable grid (75% rule-of-thumb; not a substitute for department policy).

### Reporting

ASCII-style tables for attendance breakdowns, schedules with mapped ERP %, and COE listings.

### Data ingestion

- **ERP-oriented setup**: credentials are sent to **`/api/erp-sync`** and **`/api/setup`** only for that run; the server does not persist passwords. **`ERP_SCRAPER_MODE=demo`** returns a fixed subject matrix (for local testing). **`ERP_SCRAPER_MODE=live`** runs Puppeteer against **`ERP_LOGIN_URL`** / **`ERP_ATTENDANCE_URL`** with configurable selectors (see `server/.env.example`).
- **COE PDF**: extracts dated-looking lines where possible; **registry + merge** fill IAT and key dates; optional **anchor holidays** for known semester windows (always verify against the official COE PDF).
- **Timetable**: image upload → **Tesseract.js** OCR → editable **Mon–Sat × 7** grid (no baked-in demo subjects; confirm cells against your screenshot).

---

## 🛠️ UI building blocks

| Component | Role |
| :--- | :--- |
| `ChatInterface` | Chat, quick actions, API-backed replies |
| `SetupFlow` | Multi-step profile, COE, timetable, finish → `/api/setup` |
| `ScraperFeed` | Live preview of `/api/erp-sync` rows (demo vs live badge) |
| `TimetableGrid` | Editable grid before submit |
| `ImageProcessor` | Timetable image handling |

---

## 💻 Running locally

1. **API**: open a terminal at the **project root** (`attedence-agent/`), go into `server`, then start Node:

   ```bash
   cd server
   node index.js
   ```

   If your prompt is **already** `...\attedence-agent\server>`, run **`node index.js` only** — do not `cd server` again (that looks for `server\server`).

   Default: `http://localhost:5000`.

2. **Client** (from `client/`):

   ```bash
   npm install
   npm run dev
   ```

   Open `http://localhost:3000`. Use **http**, not `file://`, so the PDF worker loads correctly.

3. **API URL**: If the client is not on the same host/port as the API, set in `client/.env.local`:

   ```bash
   NEXT_PUBLIC_API_URL=http://127.0.0.1:5000
   ```

4. **ERP mode** (server — copy `server/.env.example` to `server/.env`): default **`ERP_SCRAPER_MODE=demo`** for safe local runs. For real portal scraping set **`ERP_SCRAPER_MODE=live`** and configure URLs/selectors; run the API where Chrome/Chromium is available (see Docker).

5. Complete **setup through the COE step and Finish** so the session receives merged COE rows. The browser keeps a **per-tab session id** in `sessionStorage` (not the shared `demo-session` string). If the API restarts, run setup again.

---

## Production / Docker

- **Compose**: from the repo root, `docker compose up --build` starts the API on port **5000** and the Next app on **3000**. Set **`NEXT_PUBLIC_API_URL`** at build time to the public URL browsers use to reach the API (see `docker-compose.yml` `args`).
- **Health**: `GET /api/health` returns `{ ok, erpMode }`.
- **Sessions** stay **in-memory** on the Node process; scale-out or restarts require sticky sessions or a shared store (see roadmap).
- **CORS**: set **`CORS_ORIGIN`** on the API (comma-separated origins) when the web app is on another host.

---

## Tech stack

- **Frontend**: Next.js 16, React 19, Tailwind 4, Framer Motion, Lucide, Tesseract.js (timetable path), **pdfjs-dist** 5.x (COE PDF text layer).
- **Backend**: Node.js, Express, CORS, fuzzy / rule-based decision engine; optional tooling in `server` dependencies for future scraping/OCR experiments.

---

## Roadmap (indicative)

1. **Persistence**: SQLite or Redis instead of volatile in-memory sessions (required for multi-instance deploys).
2. **Hardened ERP integration**: reliable headless or API-backed sync where the portal allows it.
3. **Notifications**: web push or similar for repeated risk patterns (policy-compliant).
4. **Analytics**: light trends from historical snapshots once data is stored.
5. **COE depth**: richer handling for **scanned** PDFs (true OCR) and institute-specific calendar templates.

---

> [!TIP]
> Use the **Quick Action** row in chat for one-tap prompts (“Weekly highlights”, “This month COE”, “Next holiday”, “Days until IAT”).

---

© 2026 Logic Agent V5.0 | In-memory session per API process
