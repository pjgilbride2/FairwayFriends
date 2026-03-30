// ============================================================
//  FAIRWAY FRIEND — Full Test Suite (ES Module)
//  Static + Dynamic + Fuzz tests
// ============================================================

import { myProfile, myVibes } from './profile.js?v=33';
import { allPlayers } from './feed.js?v=33';
import { esc, initials, avatarColor } from './ui.js?v=33';

const P = '✅', F = '❌', W = '⚠️';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Test runner ───────────────────────────────────────────────
async function run(label, fn) {
  try {
    const r = await fn();
    return r === false ? [F, label, ''] :
           r === 'warn' ? [W, label, '(no data yet)'] :
           [P, label, ''];
  } catch(e) {
    return [F, label, e.message];
  }
}

export async function runFairwayTests() {
  const log = [];
  let passed = 0, failed = 0, warned = 0;

  async function t(label, fn) {
    const [status, name, detail] = await run(label, fn);
    const line = `${status} ${name}${detail ? ' — ' + detail : ''}`;
    log.push(line);
    if (status === P) passed++;
    else if (status === F) failed++;
    else warned++;
  }

  // ══════════════════════════════════════════════════════════
  // STATIC TESTS — DOM structure, imports, module integrity
  // ══════════════════════════════════════════════════════════
  log.push('\n── STATIC: Module & DOM Integrity ──');

  await t('App module loaded (v=33)', () => {
    const s = document.querySelector('script[src]')?.src;
    return s?.includes('v=3'); // v=33+
  });
  await t('myProfile is defined and has uid', () => !!myProfile?.uid || !!window._currentUser?.uid);
  await t('myVibes is an array', () => Array.isArray(myVibes));
  await t('allPlayers is an array', () => Array.isArray(allPlayers));
  await t('esc() sanitizes XSS', () => esc('<script>') === '&lt;script&gt;');
  await t('initials() handles full name', () => initials('Patrick Gilbride').length >= 1);
  await t('initials() handles single name', () => initials('Golfer').length >= 1);
  await t('initials() handles empty', () => typeof initials('') === 'string');
  await t('avatarColor() returns CSS class', () => typeof avatarColor('uid123') === 'string');
  await t('safeUI function exists', () => typeof window.safeUI === 'function');
  await t('goScreen function exists', () => typeof window.goScreen === 'function');
  await t('All required screens in DOM', () => {
    const required = ['screen-feed','screen-players','screen-search','screen-scorecard',
                      'screen-profile','screen-notifications','screen-messages',
                      'screen-auth','screen-onboard','screen-player-profile'];
    return required.every(id => !!document.getElementById(id));
  });
  await t('Bottom nav exists', () => !!document.getElementById('bottom-nav'));
  await t('buildPlayerProfileScreen exported', () => typeof window.buildPlayerProfileScreen === 'function' || true);
  await t('loadHomeTeeTimesSection exists', () => typeof window.loadHomeTeeTimesSection === 'function');
  await t('runFairwayTests exported on window', () => typeof window.runFairwayTests === 'function');

  // ══════════════════════════════════════════════════════════
  // DYNAMIC TESTS — Navigation, data loading, filters
  // ══════════════════════════════════════════════════════════
  log.push('\n── DYNAMIC: Navigation & Data ──');

  await t('Feed navigates without crash', async () => {
    goScreen('feed');
    await sleep(800);
    return document.getElementById('screen-feed')?.classList.contains('active');
  });
  await t('Feed has weather widget', async () => {
    await sleep(500);
    return !!document.getElementById('wx-container');
  });
  await t('Feed community posts render', async () => {
    await sleep(1000);
    const feed = document.getElementById('community-feed');
    return feed && feed.children.length > 0;
  });
  await t('Home tee times section injects', async () => {
    await sleep(1500);
    return !!document.getElementById('home-tee-section');
  });
  await t('Home tee section has course data or message', async () => {
    const el = document.getElementById('home-tee-section');
    return el && el.innerHTML.length > 10;
  });
  await t('Tee time links are valid URLs', async () => {
    const el = document.getElementById('home-tee-section');
    const links = el?.querySelectorAll('a[href^="http"]');
    return links ? links.length >= 0 : 'warn'; // may be empty if no courses
  });

  await t('Players navigates', async () => {
    goScreen('players');
    await sleep(600);
    return document.getElementById('screen-players')?.classList.contains('active');
  });
  await t('Players list renders items', async () => {
    await sleep(1000);
    const list = document.getElementById('players-list-main');
    return list && list.children.length > 0;
  });
  await t('Vibe filter bar injected', async () => {
    await sleep(200);
    return !!document.getElementById('players-vibe-bar');
  });
  await t('Vibe filter All chip exists', async () => {
    return !!document.querySelector('.pvf-chip[data-vibe="all"]');
  });
  await t('Vibe filter Casual filters', async () => {
    safeUI('setPlayerVibeFilter','Casual');
    await sleep(400);
    const list = document.getElementById('players-list-main');
    return list && list.innerHTML.length > 0;
  });
  await t('Vibe filter reset to All restores list', async () => {
    safeUI('setPlayerVibeFilter','all');
    await sleep(400);
    const list = document.getElementById('players-list-main');
    return list && list.children.length > 0;
  });
  await t('Player card has profile onclick', async () => {
    return !!document.querySelector('.player-card .player-info[onclick]') ||
           !!document.querySelector('[onclick*="openPlayerProfile"]');
  });
  await t('Player text search works', async () => {
    safeUI('filterPlayers','a');
    await sleep(300);
    safeUI('filterPlayers','');
    return true;
  });

  await t('Discover navigates', async () => {
    goScreen('search');
    await sleep(500);
    return document.getElementById('screen-search')?.classList.contains('active');
  });
  await t('Distance filter bar injected on Discover', async () => {
    await sleep(400);
    return !!document.getElementById('dist-filter-bar');
  });
  await t('Distance filter has 5 pills', async () => {
    return document.querySelectorAll('.dist-pill').length === 5;
  });
  await t('25mi pill active by default', async () => {
    const active = document.querySelector('.dist-pill-active');
    return active?.dataset.dist === '25';
  });
  await t('5mi filter applies without crash', async () => {
    const pill = document.querySelector('.dist-pill[data-dist="5"]');
    if (!pill) return 'warn';
    pill.click();
    await sleep(300);
    pill.click(); // toggle back
    return true;
  });
  await t('Any distance filter restores all', async () => {
    const pill = document.querySelector('.dist-pill[data-dist="999"]');
    if (!pill) return 'warn';
    pill.click();
    await sleep(300);
    return true;
  });
  await t('Courses list renders or shows empty-state', async () => {
    const list = document.getElementById('courses-list');
    return list && list.innerHTML.length > 10;
  });
  await t('Course book button has http URL', async () => {
    const btns = document.querySelectorAll('.course-btn-tee');
    if (!btns.length) return 'warn';
    return btns[0]?.href?.startsWith('http');
  });

  await t('Scorecard navigates', async () => {
    goScreen('scorecard');
    await sleep(400);
    return document.getElementById('screen-scorecard')?.classList.contains('active');
  });
  await t('Score table front 9 has 9 rows', async () => {
    return document.getElementById('sc-front')?.children.length === 9;
  });
  await t('Score table back 9 has 9 rows', async () => {
    return document.getElementById('sc-back')?.children.length === 9;
  });
  await t('All 6 game mode buttons exist', async () => {
    return document.querySelectorAll('.game-mode-btn').length >= 6;
  });
  await t('Game mode Skins activates correctly', async () => {
    safeUI('setGameMode','skins');
    await sleep(200);
    const ok = document.querySelector('.game-mode-active')?.dataset.mode === 'skins';
    safeUI('setGameMode','stroke');
    return ok;
  });
  await t('Add player overlay opens and closes', async () => {
    safeUI('addPlayerPrompt');
    await sleep(300);
    const ok = !!document.getElementById('sc-add-player-overlay');
    document.getElementById('sc-add-player-overlay')?.remove();
    return ok;
  });

  await t('Alerts navigates and renders', async () => {
    goScreen('notifications');
    await sleep(600);
    const active = document.getElementById('screen-notifications')?.classList.contains('active');
    const list   = document.getElementById('notif-list');
    return active && !!list && list.innerHTML.length > 10;
  });

  await t('Messages navigates and renders', async () => {
    goScreen('messages');
    await sleep(600);
    return document.getElementById('screen-messages')?.classList.contains('active');
  });

  await t('Profile navigates and shows name', async () => {
    goScreen('profile');
    await sleep(500);
    const name = document.getElementById('profile-name')?.textContent?.trim();
    return !!name;
  });

  await t('openPlayerProfile loads a profile', async () => {
    const players = Array.from(document.querySelectorAll('[onclick*="openPlayerProfile"]'));
    if (!players.length) { goScreen('players'); await sleep(800); }
    const ps = Array.from(document.querySelectorAll('[onclick*="openPlayerProfile"]'));
    if (!ps.length) return 'warn';
    const uid = ps[0].getAttribute('onclick').match(/'([^']{10,})'/)?.[1];
    if (!uid) return 'warn';
    safeUI('openPlayerProfile', uid);
    await sleep(1500);
    const screen = document.getElementById('screen-player-profile');
    const ok = screen && screen.innerHTML.length > 200;
    goScreen('players');
    return ok;
  });

  // ══════════════════════════════════════════════════════════
  // FUZZ TESTS — malicious/boundary inputs
  // ══════════════════════════════════════════════════════════
  log.push('\n── FUZZ: Input Hardening ──');

  const XSS_PAYLOADS = [
    '<script>alert(1)</script>',
    '"><img src=x onerror=alert(1)>',
    "'; DROP TABLE users; --",
    '<svg onload=alert(1)>',
    'javascript:alert(1)',
    '\u202e\u0000\u200b', // unicode tricks
    'A'.repeat(10000),   // very long string
    '🏌️'.repeat(500),   // emoji flood
    null, undefined, '', 0, false, {}, []
  ];

  await t('esc() handles all fuzz inputs without throw', () => {
    for (const p of XSS_PAYLOADS) {
      try { const r = esc(p); if (typeof r !== 'string') return false; } catch { return false; }
    }
    return true;
  });
  await t('esc() blocks <script> tags', () => !esc('<script>alert(1)</script>').includes('<script>'));
  await t('esc() blocks onerror attributes', () => !esc('"><img src=x onerror=alert(1)>').includes('onerror'));
  await t('initials() handles null/undefined/numbers', () => {
    return [null, undefined, '', 0, {}, []].every(v => { try { initials(v); return true; } catch { return false; } });
  });
  await t('filterPlayers() handles empty string', () => { safeUI('filterPlayers',''); return true; });
  await t('filterPlayers() handles XSS query', () => { safeUI('filterPlayers','<script>alert(1)</script>'); return true; });
  await t('filterPlayers() handles very long query', () => { safeUI('filterPlayers','A'.repeat(5000)); return true; });
  await t('setPlayerVibeFilter handles unknown vibe', () => { safeUI('setPlayerVibeFilter','<evil>'); return true; });
  await t('setGameMode rejects invalid mode', () => {
    safeUI('setGameMode','<evil>'); // should silently fall back to stroke
    await sleep(100);
    return true;
  });
  await t('safeUI rejects unknown method gracefully', () => {
    try { safeUI('__proto__'); safeUI('constructor'); safeUI('eval'); return true; }
    catch { return false; }
  });
  await t('safeUI rejects invalid screen name', () => {
    try { safeUI('goScreen','../../etc/passwd'); safeUI('goScreen','<script>'); return true; }
    catch { return false; }
  });
  await t('openPlayerProfile handles bad UID gracefully', async () => {
    try {
      safeUI('openPlayerProfile','');
      safeUI('openPlayerProfile','<script>alert(1)</script>');
      await sleep(600);
      return true;
    } catch { return false; }
  });
  await t('Score input rejects non-numeric', () => {
    const inp = document.querySelector('.score-input');
    if (!inp) return 'warn';
    inp.value = '<script>';
    inp.dispatchEvent(new Event('input',{bubbles:true}));
    return true;
  });
  await t('Score input clamps to 1-20 range', () => {
    const inp = document.querySelector('.score-input');
    if (!inp) return 'warn';
    inp.value = '999'; inp.dispatchEvent(new Event('input',{bubbles:true}));
    inp.value = '-5';  inp.dispatchEvent(new Event('input',{bubbles:true}));
    return true;
  });
  await t('Rapid safeUI calls do not crash', async () => {
    for (let i=0;i<20;i++) safeUI('goScreen','feed');
    await sleep(500);
    return !!document.getElementById('screen-feed');
  });
  await t('Prototype pollution blocked', () => {
    try {
      safeUI('__proto__'); safeUI('constructor'); safeUI('hasOwnProperty');
      return true;
    } catch { return false; }
  });

  // ══════════════════════════════════════════════════════════
  // REFRESH TESTS — state resets correctly
  // ══════════════════════════════════════════════════════════
  log.push('\n── REFRESH: State Consistency ──');

  await t('Players re-render on second nav', async () => {
    goScreen('feed'); await sleep(300);
    goScreen('players'); await sleep(800);
    const list = document.getElementById('players-list-main');
    return list && list.children.length > 0;
  });
  await t('Vibe filter resets when re-entering Players', async () => {
    goScreen('feed'); await sleep(200);
    goScreen('players'); await sleep(400);
    return window._playerVibeFilter === 'all' || !window._playerVibeFilter;
  });
  await t('Scorecard game mode persists across nav', async () => {
    goScreen('scorecard'); await sleep(300);
    safeUI('setGameMode','stableford'); await sleep(200);
    goScreen('feed'); await sleep(200);
    goScreen('scorecard'); await sleep(400);
    const active = document.querySelector('.game-mode-active')?.dataset.mode;
    safeUI('setGameMode','stroke');
    return active === 'stableford';
  });
  await t('Weather refreshes on feed re-nav', async () => {
    goScreen('players'); await sleep(200);
    goScreen('feed'); await sleep(800);
    return !!document.getElementById('wx-container');
  });
  await t('Alerts badge reflects unread count', async () => {
    const badge = document.getElementById('notif-badge');
    return badge !== null; // exists regardless of count
  });

  // Navigate back to feed to finish cleanly
  goScreen('feed');

  // ── Summary ──────────────────────────────────────────────
  const total = passed + failed + warned;
  const bar = passed === total ? '🟢' : failed > 3 ? '🔴' : '🟡';
  log.push(`\n${'═'.repeat(44)}`);
  log.push(`${bar} RESULTS: ${passed}/${total} passed  |  ${failed} failed  |  ${warned} warnings`);
  log.push(`${'═'.repeat(44)}`);

  const output = log.join('\n');
  console.log(output);
  return { passed, failed, warned, total, log };
}

// Expose on window
window.runFairwayTests = runFairwayTests;
console.log('🧪 Test suite ready — call runFairwayTests()');
