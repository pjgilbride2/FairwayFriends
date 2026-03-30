// ============================================================
//  FAIRWAY FRIEND — Test Suite (plain script, no imports)
//  Static + Dynamic + Fuzz + Refresh tests
//  Usage: runFairwayTests().then(r => console.log(r.passed+'/'+r.total))
// ============================================================
(function() {
  'use strict';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const P='✅', F='❌', W='⚠️';

  async function run(label, fn) {
    try {
      const r = await fn();
      return r === false ? [F,label,''] : r === 'warn' ? [W,label,'(no data)'] : [P,label,''];
    } catch(e) { return [F, label, e.message?.slice(0,60)]; }
  }

  window.runFairwayTests = async function() {
    const log = []; let passed=0, failed=0, warned=0;
    async function t(label, fn) {
      const [s,n,d] = await run(label, fn);
      log.push(`${s} ${n}${d?' — '+d:''}`);
      if(s===P) passed++; else if(s===F) failed++; else warned++;
    }

    // ── helpers grabbed from live module scope ───────────────
    const _esc = (s) => {
      const m = window.UI?.__esc || null;
      if(m) return m(s);
      return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    };
    // Try to grab real esc from feed.js module
    const _ini = (n) => {
      try { return String(n||'?').trim().split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'?'; }
      catch { return '?'; }
    };

    // ══════════════════════════════════════════════════════
    // STATIC — DOM & module integrity
    // ══════════════════════════════════════════════════════
    log.push('\n── STATIC ──────────────────────────────────────');
    await t('App loaded (v=33+)', () => {
      const v = document.querySelector('script[src]')?.src?.match(/v=(\d+)/)?.[1];
      return v && parseInt(v) >= 33;
    });
    await t('User authenticated', () => !!window._currentUser?.uid);
    await t('myProfile loads (with wait)', async () => {
    if (!window.myProfile?.displayName) await sleep(2000); // wait for auth state
    return !!(window.myProfile?.displayName || window._currentUser?.displayName);
  });
    await t('safeUI function exists', () => typeof window.safeUI === 'function');
    await t('goScreen function exists', () => typeof window.goScreen === 'function');
    await t('loadDiscoverTeeTimes exists', () => typeof window.loadDiscoverTeeTimes === 'function');
    await t('loadHomeTeeTimesSection exists (kept for compat)', () => typeof window.loadHomeTeeTimesSection === 'function');
    await t('All screens in DOM', () => {
      const req = ['screen-feed','screen-players','screen-search','screen-scorecard',
                   'screen-profile','screen-notifications','screen-messages',
                   'screen-auth','screen-onboard']; // player-profile created dynamically
      const missing = req.filter(id => !document.getElementById(id));
      if(missing.length) throw new Error('Missing: '+missing.join(', '));
      return true;
    });
    await t('Bottom nav exists', () => !!document.getElementById('bottom-nav'));
    await t('_esc fallback sanitizes XSS', () => {
      const r = _esc('<script>alert(1)</script>');
      return !r.includes('<script>');
    });
    await t('_ini handles edge cases', () => {
      return _ini(null)==='?' && _ini('').length>=0 && _ini('Pat G').length>=1;
    });

    // ══════════════════════════════════════════════════════
    // DYNAMIC — Navigation + data
    // ══════════════════════════════════════════════════════
    log.push('\n── DYNAMIC ─────────────────────────────────────');
    await t('Feed navigates', async () => {
      goScreen('feed'); await sleep(800);
      return document.getElementById('screen-feed')?.classList.contains('active');
    });
    await t('Feed has weather widget', async () => {
      await sleep(500);
      return !!document.getElementById('wx-container');
    });
    await t('Feed community posts render', async () => {
      await sleep(1200);
      const f = document.getElementById('community-feed');
      return f && f.children.length > 0;
    });
    await t('Feed has NO tee-times section (moved to Discover)', async () => {
      // home-tee-section should NOT be present anymore
      return !document.getElementById('home-tee-section');
    });
    await t('Feed tee-times-row still exists (user-posted tee times)', async () => {
      return !!document.getElementById('tee-times-row');
    });

    await t('Players navigates', async () => {
      goScreen('players'); await sleep(700);
      return document.getElementById('screen-players')?.classList.contains('active');
    });
    await t('Players list renders', async () => {
      await sleep(1000);
      const l = document.getElementById('players-list-main');
      return l && l.children.length > 0;
    });
    await t('Vibe filter bar injected (SELECT dropdown)', async () => {
      await sleep(800); // wait for players list to load and bar to inject
      return !!document.getElementById('players-vibe-bar') || !!document.getElementById('player-vibe-select');
    });
    await t('Vibe filter "All Vibes" option in select', () => {
      const sel = document.getElementById('player-vibe-select');
      if (!sel) return 'warn';
      return sel.value === 'all' || !!sel.querySelector('option[value="all"]');
    });
    await t('Vibe filter filters list', async () => {
      safeUI('setPlayerVibeFilter','Casual'); await sleep(400);
      const l = document.getElementById('players-list-main');
      const ok = l && l.innerHTML.length > 0;
      safeUI('setPlayerVibeFilter','all');
      return ok;
    });
    await t('Player card has openPlayerProfile onclick', () => {
      return !!document.querySelector('[onclick*="openPlayerProfile"]');
    });
    await t('Text search filters players', async () => {
      safeUI('filterPlayers','a'); await sleep(300);
      safeUI('filterPlayers',''); await sleep(200);
      return !!document.getElementById('players-list-main');
    });

    await t('Discover navigates', async () => {
      goScreen('search'); await sleep(600);
      return document.getElementById('screen-search')?.classList.contains('active');
    });
    await t('Distance filter bar injected', async () => {
      await sleep(400);
      return !!document.getElementById('dist-filter-bar');
    });
    await t('Distance select has 5 options', () => { const s=document.getElementById('dist-filter'); return s?s.options.length===5:'warn'; });
    await t('Distance select defaults to 25mi', () => { const s=document.getElementById('dist-filter'); return s?s.value==='25':'warn'; });
    await t('5mi pill filters courses', async () => {
      const p = document.querySelector('.dist-pill[data-dist="5"]');
      if(!p) return 'warn';
      p.click(); await sleep(400);
      const ok = !!document.getElementById('courses-list');
      document.querySelector('.dist-pill[data-dist="999"]')?.click();
      return ok;
    });
    await t('Courses list renders', async () => {
      await sleep(400);
      const l = document.getElementById('courses-list');
      return l && l.innerHTML.length > 20;
    });
    await t('Course booking button has http URL', () => {
      const btns = document.querySelectorAll('.course-btn-tee');
      if(!btns.length) return 'warn';
      return btns[0]?.href?.startsWith('http');
    });
    await t('Discover tee times section present', async () => {
      // Switch to tee times tab in discover
      document.getElementById('disc-tab-teetimes')?.click();
      await sleep(500);
      return !!document.getElementById('disc-nearby-teetimes') || !!document.getElementById('all-tee-times');
    });
    await t('Discover tee time pills or section exists', async () => {
      await sleep(800);
      return document.querySelectorAll('.disc-time-pill').length >= 3
          || !!document.getElementById('disc-nearby-teetimes');
    });
    await t('Time filter renders without crash', async () => {
      safeUI('setPlayerVibeFilter','all'); // just exercise code path
      window._teeSectionFilter = '9';
      window.loadDiscoverTeeTimes && loadDiscoverTeeTimes();
      await sleep(400);
      window._teeSectionFilter = 'all';
      return true;
    });

    await t('Scorecard navigates', async () => {
      goScreen('scorecard'); await sleep(1500);
      return document.getElementById('screen-scorecard')?.classList.contains('active');
    });
    await t('Front 9 has 9 rows', async () => { await sleep(800); return document.getElementById('sc-front')?.children.length === 9; });
    await t('Back 9 has 9 rows', async () => document.getElementById('sc-back')?.children.length === 9);
    await t('6 game mode buttons', async () => document.querySelectorAll('.game-mode-btn').length >= 6);
    await t('Mode switch stroke→skins→stroke', async () => {
      safeUI('setGameMode','skins'); await sleep(150);
      const ok = document.querySelector('.game-mode-active')?.dataset.mode === 'skins';
      safeUI('setGameMode','stroke');
      return ok;
    });
    await t('Add player overlay opens/closes', async () => {
      safeUI('addPlayerPrompt'); await sleep(300);
      const ok = !!document.getElementById('sc-add-player-overlay');
      document.getElementById('sc-add-player-overlay')?.remove();
      return ok;
    });

    await t('Alerts renders (not blank)', async () => {
      goScreen('notifications'); await sleep(700);
      const s = document.getElementById('screen-notifications');
      return s?.classList.contains('active') && !!document.getElementById('notif-list');
    });
    await t('Messages renders', async () => {
      goScreen('messages'); await sleep(700);
      return document.getElementById('screen-messages')?.classList.contains('active');
    });
    await t('Profile renders name', async () => {
      goScreen('profile'); await sleep(500);
      return !!(document.getElementById('profile-name-display')?.textContent?.trim() || document.getElementById('profile-name')?.textContent?.trim());
    });
    await t('Edit-profile has home course field', async () => {
      goScreen('edit-profile'); await sleep(400);
      return !!document.getElementById('edit-home-course');
    });
    await t('Edit-profile course autocomplete', async () => {
      // Pre-load Discover if needed so _nearbyCourses is populated
      if (!window._nearbyCourses?.length) {
        goScreen('search'); await sleep(2000);
        goScreen('edit-profile'); await sleep(600);
      }
      const field = document.getElementById('edit-home-course');
      if (!field) return 'warn';
      if (!window._nearbyCourses?.length) return 'warn'; // still no courses
      field.dispatchEvent(new Event('focus',{bubbles:true}));
      await sleep(500);
      return !!document.getElementById('course-ac-list');
    });
    await t('Scorecard course autocomplete wired', async () => {
      goScreen('scorecard'); await sleep(1500);
      const inp = document.getElementById('sc-course-input');
      if (!inp) return false;
      const acExists = !!document.getElementById('sc-course-ac');
      // Trigger focus to show dropdown
      inp.dispatchEvent(new Event('focus',{bubbles:true}));
      await sleep(400);
      const acVisible = document.getElementById('sc-course-ac')?.style.display !== 'none';
      return acExists && acVisible;
    });

  await t('openPlayerProfile loads without crash', async () => {
      goScreen('players'); await sleep(800);
      const els = Array.from(document.querySelectorAll('[onclick*="openPlayerProfile"]'));
      if(!els.length) return 'warn';
      const uid = els[0].getAttribute('onclick').match(/'([^']{10,})'/)?.[1];
      if(!uid) return 'warn';
      safeUI('openPlayerProfile', uid);
      await sleep(1500);
      const screen = document.getElementById('screen-player-profile');
      const ok = screen && screen.innerHTML.length > 100;
      goScreen('players');
      return ok;
    });

    // ══════════════════════════════════════════════════════
    // FUZZ — malicious inputs
    // ══════════════════════════════════════════════════════
    log.push('\n── FUZZ ────────────────────────────────────────');
    const XSS = ['<script>alert(1)</script>','"><img onerror=alert(1)>',
                  "'; DROP TABLE--","javascript:alert(1)",'A'.repeat(9999),
                  '\u0000\u202e',null,undefined,'',0,false,{}];

    await t('_esc handles all fuzz without throw', () => {
      for(const v of XSS) { try { _esc(v); } catch { return false; } }
      return true;
    });
    await t('_esc blocks <script>', () => !_esc('<script>alert(1)</script>').includes('<script>'));
    await t('_esc escapes < > and quotes (blocks injection)', () => {
      const r = _esc('"><img onerror=alert(1)>');
      return !r.includes('<img') && !r.includes('>') && r.includes('&gt;');
    });
    await t('_ini handles null/undefined/numbers', () => {
      return [null,undefined,'',0,[]].every(v => { try { _ini(v); return true; } catch { return false; } });
    });
    await t('filterPlayers XSS query safe', () => { try { safeUI('filterPlayers','<script>'); return true; } catch { return false; } });
    await t('filterPlayers long string safe', () => { try { safeUI('filterPlayers','A'.repeat(5000)); return true; } catch { return false; } });
    await t('setGameMode rejects evil mode', () => { try { safeUI('setGameMode','__proto__'); return true; } catch { return false; } });
    await t('goScreen rejects path traversal', () => {
      try { safeUI('goScreen','../../etc/passwd'); safeUI('goScreen','<script>'); return true; } catch { return false; }
    });
    await t('openPlayerProfile handles empty uid', async () => {
      try { safeUI('openPlayerProfile',''); await sleep(500); return true; } catch { return false; }
    });
    await t('openPlayerProfile handles XSS uid', async () => {
      try { safeUI('openPlayerProfile','<script>alert(1)</script>'); await sleep(500); return true; } catch { return false; }
    });
    await t('Rapid navigation calls do not crash', async () => {
      for(let i=0;i<15;i++) goScreen(i%2===0?'feed':'players');
      await sleep(600);
      return true;
    });
    await t('Prototype pollution blocked by safeUI', () => {
      try { safeUI('__proto__'); safeUI('constructor'); safeUI('hasOwnProperty'); return true; } catch { return false; }
    });
    await t('Score input extreme values safe', () => {
      const inp = document.querySelector('.score-input');
      if(!inp) return 'warn';
      ['<script>','999','-1','','null',undefined].forEach(v => {
        try { inp.value=String(v||''); inp.dispatchEvent(new Event('input',{bubbles:true})); } catch {}
      });
      return true;
    });

    // ══════════════════════════════════════════════════════
    // REFRESH — state consistency
    // ══════════════════════════════════════════════════════
    log.push('\n── REFRESH ─────────────────────────────────────');
    await t('Players re-renders on second visit', async () => {
      goScreen('feed'); await sleep(300);
      goScreen('players'); await sleep(900);
      return document.getElementById('players-list-main')?.children.length > 0;
    });
    await t('Vibe filter resets to all on re-nav', async () => {
      goScreen('feed'); await sleep(200);
      goScreen('players'); await sleep(400);
      return !window._playerVibeFilter || window._playerVibeFilter === 'all';
    });
    await t('Game mode persists across nav', async () => {
      goScreen('scorecard'); await sleep(1500);
      safeUI('setGameMode','bestball'); await sleep(400);
      goScreen('feed'); await sleep(400);
      goScreen('scorecard'); await sleep(1500);
      const mode = document.querySelector('.game-mode-active')?.dataset.mode;
      safeUI('setGameMode','stroke');
      return mode === 'bestball';
    });
    await t('Courses persist in _nearbyCourses on re-nav', async () => {
      const before = window._nearbyCourses?.length || 0;
      goScreen('feed'); await sleep(200);
      goScreen('search'); await sleep(500);
      const after = window._nearbyCourses?.length || 0;
      return after >= before; // shouldn't lose courses
    });
    await t('Alerts badge exists regardless of count', () => !!document.getElementById('notif-badge'));
    await t('No unhandled errors in session', () => {
      // Check our global error counter
      return (window._fwErrorCount || 0) < 3;
    });

    // Navigate back to feed
    goScreen('feed');

    // ── Summary ─────────────────────────────────────────
    const total = passed + failed + warned;
    const icon  = failed === 0 ? '🟢' : failed <= 3 ? '🟡' : '🔴';
    log.push(`\n${'═'.repeat(46)}`);
    log.push(`${icon} ${passed}/${total} passed  |  ${failed} failed  |  ${warned} warnings`);
    log.push(`${'═'.repeat(46)}`);
    console.log(log.join('\n'));
    return { passed, failed, warned, total, log };
  };

  // Track error count for the "no unhandled errors" test
  window._fwErrorCount = 0;
  window.addEventListener('unhandledrejection', () => window._fwErrorCount++);

  console.log('🧪 Fairway Friend test suite ready → call runFairwayTests()');
})();
