'use strict';
/**
 * Claude 사용량 데이터 페처
 * 인증 우선순위:
 *   1) 저장된 Playwright storage state (~/.claude-monitor/storage.json)
 *   2) Claude Desktop Keychain 쿠키
 *   3) 둘 다 실패 시 promptLogin() 플로우로 브라우저 로그인
 */

const { execSync } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');

const APP_DIR = path.join(os.homedir(), 'Library/Application Support/claude-monitor');
const STATE_PATH = path.join(APP_DIR, 'storage.json');
const META_PATH = path.join(APP_DIR, 'meta.json');
const COOKIE_DB = path.join(os.homedir(), 'Library/Application Support/Claude/Cookies');
const NEEDED = new Set(['sessionKey', 'lastActiveOrg', 'cf_clearance', 'anthropic-device-id']);

if (!fs.existsSync(APP_DIR)) fs.mkdirSync(APP_DIR, { recursive: true });

// ===== Claude Desktop 쿠키 읽기 =====
function getKeyFromKeychain() {
  try {
    return execSync('security find-generic-password -w -s "Claude Safe Storage" -a "Claude Key"',
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch { return null; }
}

function deriveKey(password) {
  return crypto.pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1');
}

function decryptCookie(encBuf, key) {
  if (!encBuf || encBuf.length < 3) return null;
  if (encBuf.slice(0, 3).toString() !== 'v10') return null;
  const iv = Buffer.alloc(16, ' ');
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  decipher.setAutoPadding(true);
  const dec = Buffer.concat([decipher.update(encBuf.slice(3)), decipher.final()]);
  const raw = dec.toString('utf8');
  const m = raw.match(/(sk-ant-[^\x00-\x1f]+|[0-9a-f-]{36}|[\w.+_\/=@-]{4,})/);
  return m ? raw.slice(raw.indexOf(m[0])) : null;
}

async function readClaudeDesktopCookies() {
  if (!fs.existsSync(COOKIE_DB)) return null;
  const password = getKeyFromKeychain();
  if (!password) return null;
  const key = deriveKey(password);
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(COOKIE_DB));
  const placeholders = [...NEEDED].map(() => '?').join(',');
  const stmt = db.prepare(
    `SELECT name, host_key, encrypted_value FROM cookies WHERE name IN (${placeholders})`
  );
  stmt.bind([...NEEDED]);
  const cookies = [];
  const meta = {};
  while (stmt.step()) {
    const row = stmt.getAsObject();
    const encBuf = row['encrypted_value'] instanceof Uint8Array
      ? Buffer.from(row['encrypted_value']) : Buffer.from(String(row['encrypted_value']), 'binary');
    const val = decryptCookie(encBuf, key);
    if (val) {
      const clean = val.replace(/[^\x20-\x7E]/g, '').trim();
      const domain = row['host_key'].startsWith('.') ? row['host_key'] : '.' + row['host_key'];
      cookies.push({ name: row['name'], value: clean, domain, path: '/', secure: true, sameSite: 'Lax' });
      meta[row['name']] = clean;
    }
  }
  stmt.free();
  db.close();
  return { cookies, meta };
}

// ===== Chromium 실행 경로 탐색 =====
function findChromiumPath() {
  const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  if (!fs.existsSync(cache)) return null;
  const dirs = fs.readdirSync(cache);
  const full = dirs.find(d => d.startsWith('chromium-') && !d.includes('headless'));
  if (full) {
    const p = path.join(cache, full, 'chrome-mac-arm64',
      'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
    if (fs.existsSync(p)) return p;
  }
  const shell = dirs.find(d => d.startsWith('chromium_headless_shell'));
  if (shell) {
    const p = path.join(cache, shell, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// ===== API 호출 =====
async function callUsageAPI(context, orgId) {
  const page = await context.newPage();
  try {
    const resp = await page.request.get(
      `https://claude.ai/api/organizations/${orgId}/usage`,
      { headers: { Accept: 'application/json' } }
    );
    if (!resp.ok()) return { ok: false, status: resp.status() };
    return { ok: true, data: await resp.json() };
  } finally {
    await page.close();
  }
}

// 모든 조직 중 Claude Pro/Max 사용량이 있는 org 자동 선택
async function findBestOrg(context, preferredOrgId) {
  const page = await context.newPage();
  try {
    const resp = await page.request.get('https://claude.ai/api/organizations',
      { headers: { Accept: 'application/json' } });
    if (!resp.ok()) return preferredOrgId;
    const orgs = await resp.json();
    if (!Array.isArray(orgs) || orgs.length === 0) return preferredOrgId;

    // 선호 org 먼저 체크
    const ordered = preferredOrgId
      ? [orgs.find(o => o.uuid === preferredOrgId), ...orgs.filter(o => o.uuid !== preferredOrgId)].filter(Boolean)
      : orgs;

    for (const o of ordered) {
      const r = await callUsageAPI(context, o.uuid);
      if (r.ok && r.data && r.data.five_hour && r.data.five_hour.resets_at) {
        return { orgId: o.uuid, data: r.data };
      }
    }
    return { orgId: preferredOrgId || orgs[0].uuid, data: null };
  } finally {
    await page.close();
  }
}

function formatUsage(raw) {
  const now = Date.now();
  const timeLeft = (r) => {
    if (!r) return null;
    const t = Math.floor((new Date(r) - now) / 1000);
    if (t <= 0) return '곧 재설정';
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60);
    if (h > 24) return `${Math.floor(h/24)}일 ${h%24}시간 후 재설정`;
    if (h > 0) return `${h}시간 ${m}분 후 재설정`;
    return `${m}분 후 재설정`;
  };
  const safe = (k) => {
    const v = raw[k] || {};
    return { pct: v.utilization || 0, time_left: timeLeft(v.resets_at), resets_at: v.resets_at || null };
  };
  return {
    session: safe('five_hour'),
    weekly_all: safe('seven_day'),
    weekly_sonnet: safe('seven_day_sonnet'),
  };
}

// ===== 저장된 state로 시도 =====
async function fetchWithSavedState() {
  if (!fs.existsSync(STATE_PATH) || !fs.existsSync(META_PATH)) return null;
  const { chromium } = require('playwright-core');
  const executablePath = findChromiumPath();
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    const context = await browser.newContext({ storageState: STATE_PATH });
    const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
    // 저장된 orgId로 시도
    let r = await callUsageAPI(context, meta.orgId);
    if (r.ok && r.data) {
      // manual이면 데이터가 비어도 그대로 반환 (사용자 선택 존중)
      if (meta.manual) return formatUsage(r.data);
      if (r.data.five_hour && r.data.five_hour.resets_at) return formatUsage(r.data);
    }
    // 자동 모드: 데이터 없으면 다른 org 탐색
    if (!meta.manual) {
      const best = await findBestOrg(context, meta.orgId);
      if (best && best.data) {
        fs.writeFileSync(META_PATH, JSON.stringify({ orgId: best.orgId }));
        return formatUsage(best.data);
      }
    }
    return r.ok && r.data ? formatUsage(r.data) : null;
  } finally {
    await browser.close();
  }
}

// ===== Desktop 쿠키로 시도 =====
async function fetchWithDesktopCookies() {
  const cd = await readClaudeDesktopCookies();
  if (!cd) return null;
  const { cookies, meta } = cd;
  if (!meta.lastActiveOrg) return null;

  const { chromium } = require('playwright-core');
  const executablePath = findChromiumPath();
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    await context.addCookies(cookies);
    let r = await callUsageAPI(context, meta.lastActiveOrg);
    let orgId = meta.lastActiveOrg;
    let data = r.ok ? r.data : null;
    if (!data || !data.five_hour || !data.five_hour.resets_at) {
      const best = await findBestOrg(context, orgId);
      if (best && best.data) { orgId = best.orgId; data = best.data; }
    }
    if (data) {
      await context.storageState({ path: STATE_PATH });
      fs.writeFileSync(META_PATH, JSON.stringify({ orgId }));
      return formatUsage(data);
    }
    return null;
  } finally {
    await browser.close();
  }
}

// ===== Playwright 로그인 창 열기 =====
async function promptLogin() {
  const { chromium } = require('playwright-core');
  const executablePath = findChromiumPath();

  // full Chromium 필요 (headless shell로는 visible 모드 불가)
  if (!executablePath || executablePath.includes('headless_shell')) {
    return { ok: false, error: 'Full Chromium 필요. playwright install chromium 실행 필요' };
  }

  const browser = await chromium.launch({ headless: false, executablePath });
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    await page.goto('https://claude.ai/login', { waitUntil: 'domcontentloaded' });

    // 로그인 완료 감지: sessionKey 쿠키가 생길 때까지 최대 5분 대기
    const start = Date.now();
    let orgId = null;
    while (Date.now() - start < 5 * 60 * 1000) {
      await page.waitForTimeout(1500);
      const cookies = await context.cookies();
      const sessionCookie = cookies.find(c => c.name === 'sessionKey' && c.value.startsWith('sk-ant-sid'));
      const orgCookie = cookies.find(c => c.name === 'lastActiveOrg');
      if (sessionCookie && orgCookie) {
        orgId = orgCookie.value;
        break;
      }
    }
    if (!orgId) return { ok: false, error: '로그인 대기 시간 초과' };

    await context.storageState({ path: STATE_PATH });
    fs.writeFileSync(META_PATH, JSON.stringify({ orgId }));
    return { ok: true, orgId };
  } finally {
    await browser.close();
  }
}

// ===== 메인 진입점 =====
async function fetchUsage({ allowLoginPrompt = false } = {}) {
  // 1) 저장된 세션으로 시도
  try {
    const r = await fetchWithSavedState();
    if (r) return { ok: true, data: r };
  } catch (e) { /* fall through */ }

  // 2) Claude Desktop 쿠키로 시도
  try {
    const r = await fetchWithDesktopCookies();
    if (r) return { ok: true, data: r };
  } catch (e) { /* fall through */ }

  // 3) 로그인 필요
  if (!allowLoginPrompt) {
    return { ok: false, needLogin: true, error: '인증 필요' };
  }

  const login = await promptLogin();
  if (!login.ok) return { ok: false, error: login.error };

  // 로그인 성공 후 재시도
  const r = await fetchWithSavedState();
  if (r) return { ok: true, data: r };
  return { ok: false, error: '로그인 후 데이터 조회 실패' };
}

// ===== 조직 목록 조회 =====
async function listOrgs() {
  if (!fs.existsSync(STATE_PATH)) {
    // Desktop 쿠키로 시도
    const cd = await readClaudeDesktopCookies();
    if (!cd) return { ok: false, error: '인증 없음' };
  }
  const { chromium } = require('playwright-core');
  const executablePath = findChromiumPath();
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    let context;
    if (fs.existsSync(STATE_PATH)) {
      context = await browser.newContext({ storageState: STATE_PATH });
    } else {
      const cd = await readClaudeDesktopCookies();
      context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });
      await context.addCookies(cd.cookies);
    }
    const page = await context.newPage();
    const resp = await page.request.get('https://claude.ai/api/organizations',
      { headers: { Accept: 'application/json' } });
    if (!resp.ok()) return { ok: false, error: `status ${resp.status()}` };
    const orgs = await resp.json();
    let currentOrgId = null;
    try { currentOrgId = JSON.parse(fs.readFileSync(META_PATH, 'utf8')).orgId; } catch {}
    return {
      ok: true,
      orgs: (orgs || []).map(o => ({ uuid: o.uuid, name: o.name })),
      current: currentOrgId,
    };
  } finally {
    await browser.close();
  }
}

module.exports = { fetchUsage, promptLogin, listOrgs };
