const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen } = require('electron');
const path = require('path');

let win;
let tray;
let trayAnimState = { frame: 0, timer: null, usagePct: 0 };
let thresholds = { warn: 50, alert: 80 };
let trayMode = 'number'; // 'animation' | 'number' | 'bar'

// 아이콘 + 얇은 세로 바 합성 PNG
function createIconWithVerticalBar(pct) {
  const { PNG } = require('pngjs');
  const icon = loadIconPng();
  const iconW = icon.width, iconH = icon.height;
  const barW = 4;     // 얇게
  const gap = 3;
  const totalW = iconW + gap + barW;
  const totalH = iconH;
  const canvas = new PNG({ width: totalW, height: totalH });

  // 아이콘 픽셀 복사
  for (let y = 0; y < iconH; y++) {
    for (let x = 0; x < iconW; x++) {
      const s = (y * iconW + x) * 4;
      const d = (y * totalW + x) * 4;
      canvas.data[d]   = icon.data[s];
      canvas.data[d+1] = icon.data[s+1];
      canvas.data[d+2] = icon.data[s+2];
      canvas.data[d+3] = icon.data[s+3];
    }
  }

  // 색상 threshold
  let color;
  if (pct >= thresholds.alert) color = [239, 68, 68];
  else if (pct >= thresholds.warn) color = [245, 158, 11];
  else color = [139, 124, 248];

  // 세로바: 아래에서 위로 pct만큼 차오름
  const barStartX = iconW + gap;
  const barTop = 2;
  const barBot = totalH - 2;
  const barH = barBot - barTop;
  const filled = Math.round(barH * Math.min(Math.max(pct/100, 0), 1));
  const fillStart = barBot - filled;

  for (let y = barTop; y < barBot; y++) {
    for (let x = barStartX; x < barStartX + barW; x++) {
      const idx = (y * totalW + x) * 4;
      if (y >= fillStart) {
        canvas.data[idx]   = color[0];
        canvas.data[idx+1] = color[1];
        canvas.data[idx+2] = color[2];
        canvas.data[idx+3] = 255;
      } else {
        canvas.data[idx]   = 180;
        canvas.data[idx+1] = 180;
        canvas.data[idx+2] = 180;
        canvas.data[idx+3] = 80;
      }
    }
  }
  return PNG.sync.write(canvas);
}

// 아이콘 + 원형 차트 합성 PNG (pngjs)
let _iconPngCache = null;
function loadIconPng() {
  if (_iconPngCache) return _iconPngCache;
  const { PNG } = require('pngjs');
  const fs = require('fs');
  _iconPngCache = PNG.sync.read(fs.readFileSync(path.join(__dirname, 'tray-icon.png')));
  return _iconPngCache;
}

function createIconWithPie(pct) {
  const { PNG } = require('pngjs');
  const icon = loadIconPng();
  const iconW = icon.width, iconH = icon.height;
  const pieSize = iconH;
  const gap = 3;
  const totalW = iconW + gap + pieSize;
  const totalH = iconH;
  const canvas = new PNG({ width: totalW, height: totalH });

  // 왼쪽: 아이콘 픽셀 복사
  for (let y = 0; y < iconH; y++) {
    for (let x = 0; x < iconW; x++) {
      const s = (y * iconW + x) * 4;
      const d = (y * totalW + x) * 4;
      canvas.data[d]   = icon.data[s];
      canvas.data[d+1] = icon.data[s+1];
      canvas.data[d+2] = icon.data[s+2];
      canvas.data[d+3] = icon.data[s+3];
    }
  }

  // 오른쪽: 도넛 차트
  const pieStartX = iconW + gap;
  const cx = pieStartX + pieSize / 2;
  const cy = totalH / 2;
  const rOuter = pieSize / 2 - 1;
  const rInner = Math.max(rOuter - 4, 2);

  let color;
  if (pct >= thresholds.alert) color = [239, 68, 68];
  else if (pct >= thresholds.warn) color = [245, 158, 11];
  else color = [139, 124, 248];

  const fillRatio = Math.min(Math.max(pct / 100, 0), 1);

  for (let y = 0; y < totalH; y++) {
    for (let x = pieStartX; x < totalW; x++) {
      const dx = x - cx + 0.5, dy = y - cy + 0.5;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const idx = (y * totalW + x) * 4;
      if (dist > rOuter || dist < rInner) continue;
      let angle = Math.atan2(dx, -dy);
      if (angle < 0) angle += 2 * Math.PI;
      const ratio = angle / (2 * Math.PI);
      if (ratio < fillRatio) {
        canvas.data[idx]   = color[0];
        canvas.data[idx+1] = color[1];
        canvas.data[idx+2] = color[2];
        canvas.data[idx+3] = 255;
      } else {
        canvas.data[idx]   = 180;
        canvas.data[idx+1] = 180;
        canvas.data[idx+2] = 180;
        canvas.data[idx+3] = 100;
      }
    }
  }
  return PNG.sync.write(canvas);
}

// Tray 애니메이션 프레임
const TRAY_FRAMES = [
  'tray-icon.png',
  'tray-icon-sm.png',
  'tray-icon-wide.png',
  'tray-icon-big.png',
  'tray-icon-wide.png',
  'tray-icon-sm.png',
];

function getAnimSpeed(pct) {
  // 경고 미만 → 완전 정지
  if (pct < thresholds.warn) return 0;
  // 경고(yellow) → 빠르게 (이전 red 속도)
  if (pct < thresholds.alert) return 90;
  // 위험(red) → 미친듯 (2배 빠르게)
  return 45;
}

function createTray() {
  const iconPath = path.join(__dirname, 'tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 22, height: 22 });
  tray = new Tray(icon);
  tray.setToolTip('Claude Monitor');
  updateTrayMenu();

  tray.on('click', () => {
    if (!win) return;
    if (win.isVisible()) win.hide();
    else { win.show(); win.focus(); }
  });
}

function updateTrayMenu(data) {
  const menu = Menu.buildFromTemplate([
    { label: data ? `현재 세션: ${data.session.pct.toFixed(0)}%` : '사용량 로딩 중...', enabled: false },
    { label: data ? `주간 (모든 모델): ${data.weekly_all.pct.toFixed(0)}%` : '', enabled: false, visible: !!data },
    { label: data ? `주간 (Sonnet): ${data.weekly_sonnet.pct.toFixed(0)}%` : '', enabled: false, visible: !!data },
    { type: 'separator' },
    { label: '창 열기/숨기기', click: () => {
      if (win.isVisible()) win.hide(); else { win.show(); win.focus(); }
    }},
    { label: '지금 갱신', click: () => { if (win) win.webContents.send('trigger-refresh'); } },
    { type: 'separator' },
    { label: '종료', role: 'quit' },
  ]);
  tray.setContextMenu(menu);
}

function stopTrayAnim() {
  if (trayAnimState.timer) { clearInterval(trayAnimState.timer); trayAnimState.timer = null; }
}

function setStaticIcon() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'tray-icon.png')).resize({ width: 22, height: 22 });
  tray.setImage(icon);
}

// bar 모드용 빈 아이콘 (텍스트만 보이게)
function setEmptyIcon() {
  const empty = nativeImage.createEmpty();
  tray.setImage(empty);
}

// 떨림 오프셋 (좌/우/상/하 shake)
const SHAKE_OFFSETS = [[0,0], [2,0], [0,0], [-2,0], [0,1], [0,0], [0,-1], [0,0]];
let _shakeFramesCache = null;

function getShakeFrames() {
  if (_shakeFramesCache) return _shakeFramesCache;
  const { PNG } = require('pngjs');
  const icon = loadIconPng();
  const iconW = icon.width, iconH = icon.height;
  const pad = 3;
  const W = iconW + pad * 2;
  const H = iconH + pad * 2;
  _shakeFramesCache = SHAKE_OFFSETS.map(([dx, dy]) => {
    const canvas = new PNG({ width: W, height: H });
    for (let y = 0; y < iconH; y++) {
      for (let x = 0; x < iconW; x++) {
        const cx = x + pad + dx;
        const cy = y + pad + dy;
        if (cx < 0 || cx >= W || cy < 0 || cy >= H) continue;
        const s = (y * iconW + x) * 4;
        const d = (cy * W + cx) * 4;
        canvas.data[d]   = icon.data[s];
        canvas.data[d+1] = icon.data[s+1];
        canvas.data[d+2] = icon.data[s+2];
        canvas.data[d+3] = icon.data[s+3];
      }
    }
    return PNG.sync.write(canvas);
  });
  return _shakeFramesCache;
}

function startShakeAnim(pct) {
  stopTrayAnim();
  const speed = getAnimSpeed(pct);
  if (speed === 0) { setStaticIcon(); return; }
  const frames = getShakeFrames();
  trayAnimState.frame = 0;
  trayAnimState.timer = setInterval(() => {
    trayAnimState.frame = (trayAnimState.frame + 1) % frames.length;
    const img = nativeImage.createFromBuffer(frames[trayAnimState.frame]);
    tray.setImage(img);
  }, speed);
}

function setTrayUsage(pct) {
  trayAnimState.usagePct = pct;
  const pctStr = pct.toFixed(0);
  const warnMark = pct >= thresholds.alert ? ' ⚠' : '';

  if (trayMode === 'animation') {
    // 떨리는 아이콘 + 텍스트 없음
    startShakeAnim(pct);
    tray.setTitle('');
  } else if (trayMode === 'bar') {
    // 아이콘 + 얇은 세로 바 (숫자 없음)
    stopTrayAnim();
    const buf = createIconWithVerticalBar(pct);
    const img = nativeImage.createFromBuffer(buf);
    tray.setImage(img);
    tray.setTitle(warnMark);
  } else if (trayMode === 'pie') {
    // 아이콘 + 원형 차트 (숫자 없음)
    stopTrayAnim();
    const buf = createIconWithPie(pct);
    const img = nativeImage.createFromBuffer(buf);
    tray.setImage(img);
    tray.setTitle(warnMark);
  } else {
    // number 모드 (기본): 숫자 % + 고정 아이콘
    stopTrayAnim();
    setStaticIcon();
    tray.setTitle(` ${pctStr}%${warnMark}`);
  }
}

function createWindow() {
  const { x, y } = screen.getPrimaryDisplay().workArea;

  win = new BrowserWindow({
    width: 310,
    height: 310,
    x: x + 30,
    y: y + 40,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    resizable: true,
    hasShadow: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'ui.html'));

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
    app.focus({ steal: true });
  });

  // 창 닫아도 앱은 유지 (Tray로 계속 동작)
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

// Node.js fetch_usage.js로 사용량 데이터 가져오기
ipcMain.handle('fetch-usage', async () => {
  try {
    const { fetchUsage } = require('./fetch_usage.js');
    const result = await fetchUsage({ allowLoginPrompt: false });
    if (result.ok) {
      if (tray) {
        setTrayUsage(result.data.session.pct);
        updateTrayMenu(result.data);
      }
      return result;
    }
    return result; // { ok: false, needLogin: true } 도 그대로 전달
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Electron BrowserWindow로 Claude.ai 로그인 (Cloudflare 통과)
// 캡처한 세션을 실제 API로 검증한 뒤에만 저장 — stale 쿠키로 인한 false-positive 방지
ipcMain.handle('login', async () => {
  const { session, net } = require('electron');
  const ses = session.fromPartition('persist:claude-login');
  // partition에 남은 stale 쿠키가 즉시 매칭되어 창이 바로 닫히는 문제 방지
  await ses.clearStorageData({ storages: ['cookies'] });

  return new Promise((resolve) => {
    const loginWin = new BrowserWindow({
      width: 500,
      height: 700,
      title: 'Claude 로그인',
      webPreferences: {
        session: ses,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    loginWin.loadURL('https://claude.ai/login');

    let handled = false;
    let pageReady = false;
    let validateFailCount = 0;
    const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

    // 초기 로드 완료 후 1초 후부터 캡처 활성화 — loadURL 직후 첫 navigation에서 오발동 방지
    loginWin.webContents.once('did-finish-load', () => {
      setTimeout(() => { pageReady = true; }, 1000);
    });

    // 캡처한 세션을 organizations API로 실제 검증
    function validateSession(orgId) {
      return new Promise((resolveValidate) => {
        const req = net.request({
          method: 'GET',
          url: 'https://claude.ai/api/organizations',
          session: ses,
        });
        req.setHeader('Accept', 'application/json');
        req.on('response', (res) => {
          resolveValidate(res.statusCode >= 200 && res.statusCode < 300);
          res.on('data', () => {});
        });
        req.on('error', () => resolveValidate(false));
        req.end();
      });
    }

    async function tryCapture() {
      if (handled || !pageReady) return;
      const cookies = await ses.cookies.get({ domain: '.claude.ai' });
      const sessionKey = cookies.find(c => c.name === 'sessionKey' && c.value.startsWith('sk-ant-sid'));
      const orgCookie = cookies.find(c => c.name === 'lastActiveOrg');
      if (!sessionKey || !orgCookie) return;

      // 검증 단계: 실제로 인증된 세션인지 확인
      const valid = await validateSession(orgCookie.value);
      if (!valid) {
        validateFailCount++;
        if (validateFailCount >= 5) {
          handled = true;
          loginWin.close();
          resolve({ ok: false, error: '쿠키 검증 실패. 다시 로그인해 주세요.' });
        }
        return;
      }

      handled = true;
      // Playwright storage state 형식으로 변환
      const playwrightCookies = cookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path || '/',
        expires: c.expirationDate || -1,
        httpOnly: c.httpOnly || false,
        secure: c.secure || false,
        sameSite: c.sameSite === 'no_restriction' ? 'None' : c.sameSite === 'lax' ? 'Lax' : 'Strict',
      }));
      const state = { cookies: playwrightCookies, origins: [] };
      const fs = require('fs');
      const os = require('os');
      const appDir = path.join(os.homedir(), 'Library/Application Support/claude-monitor');
      if (!fs.existsSync(appDir)) fs.mkdirSync(appDir, { recursive: true });
      fs.writeFileSync(path.join(appDir, 'storage.json'), JSON.stringify(state, null, 2));
      fs.writeFileSync(path.join(appDir, 'meta.json'), JSON.stringify({ orgId: orgCookie.value }));
      loginWin.close();

      // 저장된 세션으로 즉시 데이터 fetch
      const { fetchUsage } = require('./fetch_usage.js');
      const result = await fetchUsage({ allowLoginPrompt: false });
      if (result.ok && tray) {
        setTrayUsage(result.data.session.pct);
        updateTrayMenu(result.data);
      }
      resolve(result);
    }

    loginWin.webContents.on('did-navigate', tryCapture);
    loginWin.webContents.on('did-navigate-in-page', tryCapture);
    const interval = setInterval(tryCapture, 2000);

    // 5분 타임아웃 — 무한 대기 방지
    const timeout = setTimeout(() => {
      if (!handled) {
        handled = true;
        loginWin.close();
        resolve({ ok: false, error: '로그인 대기 시간 초과 (5분)' });
      }
    }, LOGIN_TIMEOUT_MS);

    loginWin.on('closed', () => {
      clearInterval(interval);
      clearTimeout(timeout);
      if (!handled) resolve({ ok: false, error: '로그인 취소됨' });
    });
  });
});

ipcMain.on('set-always-on-top', (_, val) => {
  if (win) win.setAlwaysOnTop(val, 'floating');
});

ipcMain.on('show-notification', (_, { title, body }) => {
  const { Notification } = require('electron');
  if (Notification.isSupported()) {
    new Notification({ title, body, silent: false }).show();
  }
});

ipcMain.on('close-app', () => {
  app.isQuitting = true;
  app.quit();
});

ipcMain.on('set-thresholds', (_, { warn, alert }) => {
  let w = Number(warn) || 50;
  let a = Number(alert) || 80;
  w = Math.max(1, Math.min(98, w));
  a = Math.max(w + 1, Math.min(100, a)); // n < m 강제
  thresholds = { warn: w, alert: a };
  if (tray) setTrayUsage(trayAnimState.usagePct);
});

ipcMain.on('set-tray-mode', (_, mode) => {
  if (['animation', 'number', 'bar', 'pie'].includes(mode)) {
    trayMode = mode;
    if (tray) setTrayUsage(trayAnimState.usagePct);
  }
});

ipcMain.on('resize-window', (_, height) => {
  if (!win || typeof height !== 'number') return;
  const [w] = win.getSize();
  const h = Math.max(200, Math.min(700, Math.round(height)));
  win.setSize(w, h, true);
});

// 조직 목록 조회
ipcMain.handle('get-orgs', async () => {
  try {
    const { listOrgs } = require('./fetch_usage.js');
    return await listOrgs();
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// 특정 조직 선택 (meta.json 업데이트 + 즉시 fetch)
ipcMain.handle('set-org', async (_, orgId) => {
  try {
    const fs = require('fs');
    const os = require('os');
    const p = require('path');
    const metaPath = p.join(os.homedir(), 'Library/Application Support/claude-monitor/meta.json');
    let meta = {};
    try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch {}
    meta.orgId = orgId;
    meta.manual = !!orgId; // "자동"이면 빈 값
    fs.writeFileSync(metaPath, JSON.stringify(meta));
    const { fetchUsage } = require('./fetch_usage.js');
    const result = await fetchUsage({ allowLoginPrompt: false });
    if (result.ok && tray) {
      setTrayUsage(result.data.session.pct);
      updateTrayMenu(result.data);
    }
    return result;
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();
});
app.on('before-quit', () => { app.isQuitting = true; });
app.on('window-all-closed', (e) => {
  // macOS: Tray가 있으므로 앱 유지
  e.preventDefault && e.preventDefault();
});
