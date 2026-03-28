# 🚀 Deployment Guide: Attendance Risk Alert Agent

Deploying your agent to **Vercel** (Frontend) and **Render** (Backend) is simple and takes about 5-10 minutes. Follow these steps:

---

## 1. Backend Deployment (Render)

Render is perfect for the Node.js backend because it supports the Puppeteer browser used by the scraper.

1.  **Create a Web Service**: On your Render Dashboard, click `New +` > `Web Service`.
2.  **Connect Repo**: Connect the GitHub repository containing the `server/` folder.
3.  **Configure Service**:
    *   **Root Directory**: `server`
    *   **Environment**: `Node`
    *   **Build Command**: `npm install`
    *   **Start Command**: `node index.js`
4.  **Add Environment Variables**:
    *   `ERP_SCRAPER_MODE`: `live` (to enable real scraping)
    *   `PORT`: `5000`
5.  **Persistent Disk (Optional but Recommended)**:
    *   Go to **Tabs** > **Disk**.
    *   Mount a disk at `/var/lib/data` (1GB is enough).
    *   Add an Env Var: `DATABASE_PATH` = `/var/lib/data/attendance_sessions.sqlite`.

---

## 2. Frontend Deployment (Vercel)

Vercel will host the Next.js frontend with high performance.

1.  **Create a New Project**: On Vercel, click `Add New` > `Project`.
2.  **Connect Repo**: Import the same repository.
3.  **Project Settings**:
    *   **Root Directory**: `client`
    *   **Framework Preset**: `Next.js`
4.  **Environment Variables**:
    *   `NEXT_PUBLIC_API_URL`: Paste your **Render Web Service URL** (e.g., `https://attendance-api.onrender.com`).
5.  **Deploy**: Click `Deploy`.

---

## 3. How to Use (Real-Data Flow)

Once live, the agent is ready for production:

1.  **Sync ERP**: Enter your **CMRIT Juno Credentials**. The agent will perform a live handshake and extract your attendance.
2.  **Upload COE**: Upload the official **Semester COE PDF**. The agent will extract holidays and exam dates.
3.  **Upload Timetable**: Upload a screenshot of your **Timetable**. The agent will perform OCR and digitize your schedule into the "Logic Grid".
4.  **Chat**: Ask anything! "Can I bunk OE today?", "When is IAT1?", or "What is my weekly risk?".

---

## 📜 Technical Notes
- **Security**: Credentials are processed in-memory during sync and never stored permanently in the database.
- **Persistence**: Your session is saved using a unique UUID. If you refresh, the agent will remember your data (if Render Disk is active).
- **Correctness**: The "Skip/Bunk" logic only considers subjects verified by your ERP extraction.

---
**Need help?** Check the `README.md` for the full technical architecture.
