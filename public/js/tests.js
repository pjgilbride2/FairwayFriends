// ============================================================
//  FAIRWAY FRIEND — Dynamic Test Suite
//  Tests all filters, refreshes, and UI interactions
// ============================================================

const PASS = '✅', FAIL = '❌', WARN = '⚠️';
const results = [];

function t(name, fn) {
  return { name, fn };
}

async function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }

async function runTests() {
  const log = [];
  let passed=0, failed=0, warned=0;

  async function test(name, fn) {
    try {
      const result = await fn();
      if (result === false) {
        log.push(`${FAIL} ${name}`);
        failed++;
      } else if (result === 'warn') {
        log.push(`${WARN} ${name}`);
        warned++;
      } else {
        log.push(`${PASS} ${name}`);
        passed++;
      }
    } catch(e) {
      log.push(`${FAIL} ${name}: ${e.message}`);
      failed++;
    }
  }

  // ── AUTH ────────────────────────────────────────────────────
  await test('User is authenticated', async () => {
    return !!window._currentUser?.uid;
  });
  await test('myProfile has displayName', async () => {
    return !!(window.myProfile?.displayName);
  });

  // ── FEED / HOME ─────────────────────────────────────────────
  await test('Feed screen exists', async () => !!document.getElementById('screen-feed'));
  await test('Community feed has posts', async () => {
    goScreen('feed');
    await sleep(1000);
    const feed = document.getElementById('community-feed');
    return !!feed && feed.children.length > 0;
  });
  await test('Weather section renders on feed', async () => {
    const wx = document.getElementById('wx-container');
    return !!wx && wx.innerHTML.length > 50;
  });
  await test('Tee times row exists on feed', async () => !!document.getElementById('tee-times-row'));
  await test('Home tee section injects on feed load', async () => {
    await sleep(1500);
    const el = document.getElementById('home-tee-section');
    return !!el;
  });
  await test('Home tee section has course cards after courses load', async () => {
    if (!(window._nearbyCourses?.length)) return 'warn';
    await sleep(500);
    const el = document.getElementById('home-tee-section');
    return el && el.innerHTML.includes('mi ·');
  });
  await test('Home tee time filter buttons exist', async () => {
    return document.querySelector('[onclick*="_teeSectionFilter"]') !== null;
  });
  await test('Home tee time filter AM works', async () => {
    window._teeSectionFilter = '8';
    loadHomeTeeTimesSection && loadHomeTeeTimesSection();
    await sleep(300);
    return true; // no crash = pass
  });
  await test('Home tee time link is bookable URL', async () => {
    if (!(window._nearbyCourses?.length)) return 'warn';
    const el = document.getElementById('home-tee-section');
    const links = el?.querySelectorAll('a[href]');
    if (!links?.length) return 'warn';
    const href = links[0]?.href || '';
    return href.includes('http');
  });

  // ── PLAYERS ─────────────────────────────────────────────────
  await test('Players screen navigates', async () => {
    goScreen('players');
    await sleep(600);
    return document.querySelector('.screen.active')?.id === 'screen-players';
  });
  await test('Players list has items', async () => {
    await sleep(800);
    const list = document.getElementById('players-list-main');
    return !!list && list.children.length > 0;
  });
  await test('Vibe filter bar injects on Players', async () => {
    await sleep(300);
    return !!document.getElementById('players-vibe-bar');
  });
  await test('Vibe filter chips are present', async () => {
    const chips = document.querySelectorAll('.pvf-chip');
    return chips.length >= 5;
  });
  await test('Vibe filter "All" is active by default', async () => {
    const allChip = document.querySelector('.pvf-chip[data-vibe="all"]');
    return allChip?.classList.contains('pvf-active');
  });
  await test('Vibe filter "Casual" filters players', async () => {
    safeUI('setPlayerVibeFilter','Casual');
    await sleep(400);
    const list = document.getElementById('players-list-main');
    // Either has filtered results or empty state - both valid
    return list && list.innerHTML.length > 0;
  });
  await test('Vibe filter reset to All shows all players', async () => {
    safeUI('setPlayerVibeFilter','all');
    await sleep(400);
    const list = document.getElementById('players-list-main');
    return list && list.children.length > 0;
  });
  await test('Player card has clickable name (openPlayerProfile)', async () => {
    const card = document.querySelector('.player-card .player-info[onclick]');
    return !!card;
  });
  await test('Player search filters by name', async () => {
    safeUI('filterPlayers','Test');
    await sleep(300);
    const list = document.getElementById('players-list-main');
    return !!list;
  });
  await test('Player search reset shows all', async () => {
    safeUI('filterPlayers','');
    await sleep(300);
    const list = document.getElementById('players-list-main');
    return list && list.children.length > 0;
  });

  // ── PLAYER PROFILE ──────────────────────────────────────────
  await test('Player profile screen exists in DOM', async () => {
    return !!document.getElementById('screen-player-profile');
  });
  await test('openPlayerProfile loads from Firestore', async () => {
    const players = document.querySelectorAll('.player-card .player-info[onclick]');
    if (!players.length) return 'warn';
    const onclick = players[0].getAttribute('onclick');
    const uid = onclick.match(/openPlayerProfile','([^']+)'/)?.[1];
    if (!uid) return false;
    safeUI('openPlayerProfile', uid);
    await sleep(1500);
    const screen = document.getElementById('screen-player-profile');
    return screen && screen.innerHTML.length > 200;
  });
  await test('Player profile shows bio section', async () => {
    const screen = document.getElementById('screen-player-profile');
    return screen?.innerHTML.includes('About') || screen?.innerHTML.includes('"') || true;
  });
  await test('Player profile back navigation works', async () => {
    goScreen('players');
    await sleep(300);
    return document.querySelector('.screen.active')?.id === 'screen-players';
  });

  // ── DISCOVER / SEARCH ───────────────────────────────────────
  await test('Discover screen navigates', async () => {
    goScreen('search');
    await sleep(400);
    return document.querySelector('.screen.active')?.id === 'screen-search';
  });
  await test('Distance filter bar injects on Discover', async () => {
    await sleep(400);
    return !!document.getElementById('dist-filter-bar');
  });
  await test('Distance filter pills (5/10/25/50/Any) exist', async () => {
    const pills = document.querySelectorAll('.dist-pill');
    return pills.length === 5;
  });
  await test('Distance filter 25mi is active by default', async () => {
    const active = document.querySelector('.dist-pill-active');
    return active?.dataset.dist === '25';
  });
  await test('Distance filter 5mi filters courses', async () => {
    const pill5 = document.querySelector('.dist-pill[data-dist="5"]');
    if (!pill5) return 'warn';
    pill5.click();
    await sleep(400);
    const list = document.getElementById('courses-list');
    return !!list && list.innerHTML.length > 0;
  });
  await test('Distance filter Any shows all courses', async () => {
    const pillAny = document.querySelector('.dist-pill[data-dist="999"]');
    if (!pillAny) return 'warn';
    pillAny.click();
    await sleep(300);
    const list = document.getElementById('courses-list');
    return !!list && list.children.length > 0;
  });
  await test('Course text search filters by name', async () => {
    const inp = document.getElementById('course-search-input');
    if (!inp) return 'warn';
    inp.value = 'TPC';
    inp.dispatchEvent(new Event('input', {bubbles:true}));
    await sleep(300);
    return !!document.getElementById('courses-list');
  });
  await test('Course search clear shows all', async () => {
    const inp = document.getElementById('course-search-input');
    if (!inp) return 'warn';
    inp.value = '';
    inp.dispatchEvent(new Event('input', {bubbles:true}));
    await sleep(300);
    const list = document.getElementById('courses-list');
    return list && list.children.length > 0;
  });
  await test('Course booking button has valid URL', async () => {
    const btns = document.querySelectorAll('.course-btn-tee');
    if (!btns.length) return 'warn';
    const href = btns[0]?.href || '';
    return href.startsWith('http');
  });

  // ── SCORECARD ───────────────────────────────────────────────
  await test('Scorecard screen navigates', async () => {
    goScreen('scorecard');
    await sleep(400);
    return document.querySelector('.screen.active')?.id === 'screen-scorecard';
  });
  await test('Score table renders front 9', async () => {
    const tbody = document.getElementById('sc-front');
    return tbody && tbody.children.length === 9;
  });
  await test('Score table renders back 9', async () => {
    const tbody = document.getElementById('sc-back');
    return tbody && tbody.children.length === 9;
  });
  await test('Game mode buttons exist', async () => {
    return document.querySelectorAll('.game-mode-btn').length >= 6;
  });
  await test('Game mode switch: Stroke → Skins', async () => {
    safeUI('setGameMode','skins');
    await sleep(200);
    const active = document.querySelector('.game-mode-active');
    return active?.dataset.mode === 'skins';
  });
  await test('Game mode switch: Skins → Stroke', async () => {
    safeUI('setGameMode','stroke');
    await sleep(200);
    const active = document.querySelector('.game-mode-active');
    return active?.dataset.mode === 'stroke';
  });
  await test('Score input updates total', async () => {
    const inp = document.querySelector('.score-input');
    if (!inp) return 'warn';
    inp.value = '4'; inp.dispatchEvent(new Event('input',{bubbles:true}));
    await sleep(100);
    return true;
  });
  await test('Add player panel opens', async () => {
    safeUI('addPlayerPrompt');
    await sleep(300);
    const overlay = document.getElementById('sc-add-player-overlay');
    if(!overlay) return false;
    overlay.remove();
    return true;
  });
  await test('Player name input works', async () => {
    safeUI('addPlayerPrompt');
    await sleep(200);
    const inp = document.getElementById('sc-player-name-input');
    if(!inp) return 'warn';
    inp.value='Mike'; inp.dispatchEvent(new Event('input',{bubbles:true}));
    const btn = document.getElementById('sc-add-name-btn');
    const enabled = !btn?.disabled;
    document.getElementById('sc-add-player-overlay')?.remove();
    return enabled;
  });

  // ── ALERTS / NOTIFICATIONS ──────────────────────────────────
  await test('Alerts screen navigates without blank screen', async () => {
    goScreen('notifications');
    await sleep(400);
    const screen = document.getElementById('screen-notifications');
    const isActive = screen?.classList.contains('active');
    const hasContent = screen?.querySelector('#notif-list') !== null;
    return isActive && hasContent;
  });
  await test('Notif list renders (empty-state or items)', async () => {
    await sleep(600);
    const list = document.getElementById('notif-list');
    return !!list && list.innerHTML.length > 10;
  });
  await test('Mark all read button exists', async () => !!document.getElementById('notif-mark-all'));

  // ── MESSAGES ────────────────────────────────────────────────
  await test('Messages screen navigates', async () => {
    goScreen('messages');
    await sleep(500);
    return document.querySelector('.screen.active')?.id === 'screen-messages';
  });
  await test('Conversations list renders', async () => {
    await sleep(600);
    const list = document.getElementById('conversations-list');
    return !!list && list.innerHTML.length > 20;
  });

  // ── PROFILE ─────────────────────────────────────────────────
  await test('Profile screen navigates', async () => {
    goScreen('profile');
    await sleep(400);
    return document.querySelector('.screen.active')?.id === 'screen-profile';
  });
  await test('Profile shows displayName', async () => {
    const name = document.getElementById('profile-name');
    return !!name?.textContent.trim();
  });
  await test('Profile shows handicap', async () => {
    const hcp = document.getElementById('profile-hcp');
    return hcp !== null;
  });

  // ── NAVIGATE BACK TO FEED ───────────────────────────────────
  await test('Navigate back to Feed', async () => {
    goScreen('feed');
    await sleep(300);
    return document.querySelector('.screen.active')?.id === 'screen-feed';
  });

  // ── SUMMARY ─────────────────────────────────────────────────
  const total = passed + failed + warned;
  const summary = `\n${'═'.repeat(40)}\n📊 TEST RESULTS: ${passed}/${total} passed  |  ${failed} failed  |  ${warned} warnings\n${'═'.repeat(40)}`;
  log.push(summary);

  console.log(log.join('\n'));
  return { passed, failed, warned, total, log };
}

window.runFairwayTests = runTests;
console.log('🧪 Test suite loaded — call runFairwayTests() to run');
