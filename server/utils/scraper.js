const puppeteer = require('puppeteer');

/**
 * Demo ERP payload â€” only used when ERP_SCRAPER_MODE=demo.
 * Set ERP_SCRAPER_MODE=live in production with a reachable portal and Chrome.
 */
const DEMO_ATTENDANCE = {
  'Advanced Java': { attended: 24, total: 27 },
  'Cloud Computing (Open Stack /Google)': { attended: 26, total: 30 },
  'Cloud computing Lab': { attended: 7, total: 8 },
  'Devops Lab': { attended: 8, total: 8 },
  'Machine Learning': { attended: 26, total: 28 },
  'Machine learning Lab': { attended: 8, total: 8 },
  'Placement Training': { attended: 18, total: 22 },
  'Renewable Energy Power plants': { attended: 26, total: 30 },
  'Technical Training': { attended: 13, total: 13 },
  'TYL-Aptitude': { attended: 8, total: 8 },
  'TYL-Logical': { attended: 5, total: 6 },
  'TYL-SoftSkill': { attended: 6, total: 6 },
};

function getScraperMode() {
  return String(process.env.ERP_SCRAPER_MODE || 'demo').toLowerCase();
}

/**
 * Best-effort extraction of "attended / total" pairs from visible page text.
 * Tune ERP_ATTENDANCE_URL / selectors via env for your deployment.
 */
async function extractAttendanceFromPage(page) {
  return page.evaluate(() => {
    const text = document.body ? document.body.innerText : '';
    const lines = text.split(/\r?\n/);
    const out = {};
    const ratio = /^\s*(.+?)\s+(\d+)\s*\/\s*(\d+)\s*$/;
    const ratioParen = /^\s*(.+?)\s*\(\s*(\d+)\s*\/\s*(\d+)\s*\)\s*$/;
    for (const line of lines) {
      let m = line.match(ratio) || line.match(ratioParen);
      if (!m) continue;
      const name = m[1].trim();
      if (name.length < 3 || name.length > 120) continue;
      if (/^\d+$/.test(name)) continue;
      out[name] = { attended: Number(m[2]), total: Number(m[3]) };
    }
    return out;
  });
}

async function scrapeAttendanceLive(userId, password) {
  const loginUrl = process.env.ERP_LOGIN_URL || 'https://erp.cmrit.ac.in/';
  const attendanceUrl = process.env.ERP_ATTENDANCE_URL || '';
  const userSelectors = (process.env.ERP_USER_SELECTOR || 'input#username,input[name=username],input[name=userName],input[type=text]')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const passSelectors = (process.env.ERP_PASS_SELECTOR || 'input#password,input[name=password],input[type=password]')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const submitSelectors = (process.env.ERP_SUBMIT_SELECTOR || 'button[type=submit],input[type=submit],button#login,button.login')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const stealthArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-infobars',
    '--window-position=0,0',
    '--ignore-certificate-errors',
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  ];

  let browser;
  try {
    const execPath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
    browser = await puppeteer.launch({
      headless: process.env.ERP_PUPPETEER_HEADLESS !== 'false',
      executablePath: execPath,
      args: stealthArgs,
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 90000 });

    let userEl = null;
    for (const sel of userSelectors) {
      try {
        userEl = await page.waitForSelector(sel, { timeout: 8000 });
        if (userEl) break;
      } catch { /* next */ }
    }
    if (!userEl) throw new Error('Could not find username field. Portal might be down.');

    let passEl = await page.waitForSelector(passSelectors.join(','), { timeout: 5000 });
    
    await userEl.click({ clickCount: 3 });
    await page.keyboard.type(userId, { delay: 20 });
    await passEl.click({ clickCount: 3 });
    await page.keyboard.type(password, { delay: 20 });

    const submitBtn = await page.waitForSelector(submitSelectors.join(','), { timeout: 5000 });
    await submitBtn.click();

    // Navigation for Juno (Academic -> Course -> Attendance)
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    
    // 1. If user provided a specific URL to travel to first (like the Course File list)
    if (attendanceUrl) {
      await page.goto(attendanceUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    }

    // 2. Intelligently scan the page for the "Attendance" link/button
    // We include 'input' because those dark buttons at the bottom are likely <input type="button" value="Attendance">
    await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('a, button, div, span, li, tr, td, input'));
      for (const el of elements) {
        // Inputs use .value, links use .innerText
        const text = (el.innerText || el.value || '').trim().toLowerCase();
        
        // If it looks like the exact Attendance button
        if (text === 'attendance' || text === 'view attendance' || (text.includes('attendance') && text.length < 25)) {
          el.click();
          break;
        }
      }
    });

    // 3. Wait for the attendance screen to fully load after the click
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
    
    // Wait an extra moment for dynamic JavaScript tables to paint
    await new Promise((r) => setTimeout(r, 2000));

    let extracted = await extractAttendanceFromPage(page);
    if (!extracted || Object.keys(extracted).length === 0) {
      const alt = await page.evaluate(() => {
        const out = {};
        document.querySelectorAll('table tr').forEach((tr) => {
          const cells = [...tr.querySelectorAll('td')].map((c) => c.innerText.trim());
          if (cells.length < 2) return;
          const joined = cells.join(' ');
          const m = joined.match(/(.+?)\s+(\d+)\s*\/\s*(\d+)/);
          if (m) out[m[1].trim()] = { attended: Number(m[2]), total: Number(m[3]) };
        });
        return out;
      });
      extracted = alt;
    }

    if (!extracted || Object.keys(extracted).length === 0) {
      throw new Error(
        'Live ERP: login may have succeeded but no attendance rows were parsed. Set ERP_ATTENDANCE_URL to your attendance page and verify ERP_* selectors, or use ERP_SCRAPER_MODE=demo for testing.'
      );
    }

    console.log(`[Scraper] LIVE: extracted ${Object.keys(extracted).length} subject(s) for ${userId}`);
    return extracted;
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Scraper for CMRIT Juno Campus ERP (or compatible).
 * Mode: ERP_SCRAPER_MODE=demo | live (default demo for safe local dev).
 */
async function scrapeAttendance(userId, password) {
  if (!userId || !password) {
    throw new Error('ERP user id and password are required');
  }

  const mode = getScraperMode();
  if (mode === 'demo') {
    console.log(`[Scraper] DEMO mode â€” returning sample matrix for: ${userId}`);
    return { ...DEMO_ATTENDANCE };
  }

  if (mode === 'live') {
    return scrapeAttendanceLive(userId, password);
  }

  throw new Error(`Unknown ERP_SCRAPER_MODE="${mode}". Use "demo" or "live".`);
}

module.exports = { scrapeAttendance, getScraperMode, DEMO_ATTENDANCE };

