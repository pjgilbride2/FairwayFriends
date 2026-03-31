// 
//  FAIRWAY FRIEND — Main App Entry Point
// ============================================================

import { initAuth, setListenersActive, doLogin, doSignup, doSignOut, buildAuthScreen, friendlyError } from "./auth.js?v=70";
import { saveVibes, saveOnboardingData, saveProfileData, updateProfileUI, uploadProfilePhoto, myProfile, myVibes, deleteAccount, downgradeSubscription } from "./profile.js?v=70";
import { initFeed, initNearbyPlayers, submitPost, openTeeSheet, filterPlayers, toggleFollow, deletePost, toggleLike, submitReply, loadReplies, allPlayers } from "./feed.js?v=70";
import { buildScoreTable, onScoreChange, saveRound, loadRoundHistory, resetScores, buildGamePanel, setGameMode, updateTotals, MODES, addPlayerPrompt, addPlayerByName, addPlayerByUid, removePlayer, searchPlayersForCard } from "./scorecard.js?v=70";
import { startGpsRound, stopGpsRound, logShot, nextHole, prevHole, gpsIsActive, fetchCourseHoles } from "./gps.js?v=70";
import { openCourseLayout, closeCourseLayout, selectLayoutHole } from "./course-layout.js?v=70";
import { goScreen, showToast, toggleChip, initials, avatarColor, esc } from "./ui.js?v=70";
import { loadWeather, loadWeatherForCity, loadRoundDayForecast, startLocationWatch, stopLocationWatch } from "./weather.js?v=70";
import { getOrCreateConversation, createGroupConversation, sendMessage, listenToMessages, stopListeningMessages, listenToConversations, teardownMessaging, renderConversationsList, renderMessages, loadFollowing, renderFollowingForSearch, blockUser } from "./messages.js?v=70";
import { loadUserActivity, renderActivity, deleteActivityItem, toggleHideItem } from "./activity.js?v=70";
import { initNotifications, teardownNotifications, markAllNotifsRead, openNotif, loadNotificationsScreen, markConversationRead, createNotification } from "./notifications.js?v=70";
import { buildOnboardScreen } from "./onboard.js?v=70";


// ── Haversine distance in miles ──
function _haversine(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── Expose all UI actions to inline HTML onclick handlers ──
window.UI = {

  // ── Navigation ──
  goScreen(name) {
    // Sanitize — only allow known screen names
    const VALID_SCREENS = ["feed","players","search","scorecard","profile","edit-profile",
      "vibes","messages","conversation","my-activity","auth","onboard","notifications","player-profile","course-layout"];
    if(name && !VALID_SCREENS.includes(name)) { console.warn("Invalid screen:", name); return; }
    goScreen(name);
    if (name === "scorecard") {
      buildGamePanel();
      buildScoreTable();
      loadRoundHistory();
      // ── GPS Panel ────────────────────────────────────────
      if (!document.getElementById('gps-panel')) {
        const scScreen = document.getElementById('screen-scorecard');
        const insertBefore = document.getElementById('sc-course-input')?.closest('.sc-hero, div');
        const gpsPanel = document.createElement('div');
        gpsPanel.id = 'gps-panel';
        gpsPanel.style.cssText = 'margin:0 16px 14px;border-radius:16px;border:1.5px solid var(--border);background:var(--surface);overflow:hidden';
        gpsPanel.innerHTML = `
          <!-- Collapsed header — always visible -->
          <div id="gps-header" onclick="document.getElementById('gps-body').style.display=document.getElementById('gps-body').style.display==='none'?'block':'none'"
            style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;cursor:pointer">
            <div style="display:flex;align-items:center;gap:8px">
              <span id="gps-status-dot" style="width:10px;height:10px;border-radius:50%;background:var(--border);display:inline-block"></span>
              <span style="font-size:13px;font-weight:600;color:var(--text)">📡 GPS Tracker</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <span id="gps-hole" style="font-size:12px;color:var(--muted)">Hole 1</span>
              <span id="gps-dist" style="font-size:14px;font-weight:700;color:var(--green)">—</span>
            </div>
          </div>
          <!-- Expanded body -->
          <div id="gps-body" style="display:none;border-top:0.5px solid var(--border)">
            <!-- Live stats row -->
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0">
              <div style="text-align:center;padding:14px 8px;border-right:0.5px solid var(--border)">
                <div id="gps-dist-big" style="font-size:28px;font-weight:700;color:var(--green)">—</div>
                <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-top:2px">To Pin</div>
              </div>
              <div style="text-align:center;padding:14px 8px;border-right:0.5px solid var(--border)">
                <div id="gps-hole-big" style="font-size:28px;font-weight:700;color:var(--text)">1</div>
                <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-top:2px">Hole</div>
              </div>
              <div style="text-align:center;padding:14px 8px">
                <div id="gps-acc" style="font-size:20px;font-weight:600;color:var(--muted)">—</div>
                <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-top:2px">Accuracy</div>
              </div>
            </div>
            <!-- Action buttons -->
            <div style="display:flex;gap:8px;padding:10px 12px;border-top:0.5px solid var(--border)">
              <button id="gps-start-btn" onclick="safeUI('startGpsTracking')"
                style="flex:1;padding:10px;border-radius:12px;border:none;background:var(--green);color:#fff;
                  font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">
                ▶ Start
              </button>
              <button onclick="safeUI('logGpsShot')"
                style="flex:1;padding:10px;border-radius:12px;border:1.5px solid var(--border);background:var(--bg);
                  color:var(--text);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">
                🏌️ Shot
              </button>
              <button onclick="safeUI('prevGpsHole')"
                style="padding:10px 14px;border-radius:12px;border:1.5px solid var(--border);background:var(--bg);
                  color:var(--text);font-size:13px;cursor:pointer;font-family:inherit">◀</button>
              <button onclick="safeUI('nextGpsHole')"
                style="padding:10px 14px;border-radius:12px;border:1.5px solid var(--border);background:var(--bg);
                  color:var(--text);font-size:13px;cursor:pointer;font-family:inherit">▶</button>
              <button onclick="safeUI('openCourseLayoutScreen')"
                style="padding:10px 12px;border-radius:12px;border:1.5px solid var(--green);background:var(--green-light);
                  color:var(--green-dark);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap">🗺️ Map</button>
            </div>
            <!-- Shot history strip -->
            <div id="gps-shots-strip"
              style="display:flex;gap:6px;overflow-x:auto;padding:8px 12px;border-top:0.5px solid var(--border);min-height:36px;scrollbar-width:none">
              <span style="font-size:12px;color:var(--muted);align-self:center">No shots logged yet</span>
            </div>
          </div>`;
        // Insert before the game-panel div
        const gamePanel = document.getElementById('game-panel');
        if (gamePanel) gamePanel.parentNode.insertBefore(gpsPanel, gamePanel);
        else if (scScreen) scScreen.insertBefore(gpsPanel, scScreen.firstChild);
      }
      // Wire course input autocomplete (same as edit-profile)
      const scCourseInp = document.getElementById('sc-course-input');
      if (scCourseInp && !scCourseInp.dataset.acWired) {
        scCourseInp.dataset.acWired = '1';
        scCourseInp.setAttribute('autocomplete','off');
        scCourseInp.style.background = '#ffffff';
        scCourseInp.style.color = '#1a1a1a';
        scCourseInp.style.border = '1.5px solid #d1d5db';
        scCourseInp.style.borderRadius = '10px';
        scCourseInp.style.padding = '10px 12px';
        scCourseInp.style.fontFamily = 'inherit';
        scCourseInp.style.fontSize = '14px';
        scCourseInp.style.width = '100%';
        scCourseInp.style.boxSizing = 'border-box';
        scCourseInp.onfocus = () => { scCourseInp.style.border = '1.5px solid #16a34a'; scCourseInp.style.outline = 'none'; };
        scCourseInp.onblur = () => { scCourseInp.style.border = '1.5px solid #d1d5db'; };
        const scAcId = 'sc-course-ac';
        let scAc = document.getElementById(scAcId);
        if (!scAc) {
          scAc = document.createElement('div');
          scAc.id = scAcId;
          scAc.style.cssText = [
            'position:absolute','z-index:300','background:#ffffff',
            'border:1.5px solid var(--green)','border-radius:12px',
            'box-shadow:0 8px 24px rgba(0,0,0,.18)','max-height:220px',
            'overflow-y:auto','width:100%','left:0','top:calc(100% + 4px)','display:none'
          ].join(';');
          const wrap = scCourseInp.parentNode;
          if (wrap) { wrap.style.position='relative'; wrap.appendChild(scAc); }
        }
        const showScAc = () => {
          const q = scCourseInp.value.toLowerCase().trim();
          const courses = window._nearbyCourses || [];
          // Also include myProfile.homeCourse and known static courses as fallback
          const extras = [
            window.myProfile?.homeCourse,
            'Heritage Harbor Golf & Country Club',
            'TPC Tampa Bay','Northdale Golf & Tennis Club',
            'Babe Zaharias Golf Course','Rogers Park Golf Course',
            'Rocky Point Golf Course','Plantation Palms Golf Club',
            'Avila Golf & Country Club','Cheval Golf & Country Club'
          ].filter(Boolean).map(name=>({name}));
          const allCourses = courses.length ? courses : extras;
          const matches = q.length < 1
            ? allCourses.slice(0,8)
            : allCourses.filter(c=>(c.name||'').toLowerCase().includes(q)).slice(0,8);
          if (!matches.length) { scAc.style.display='none'; return; }
          scAc.innerHTML = matches.map(c => {
            const safeName = esc(c.name||'');
            const dist = c.dist ? ` <span style="font-size:11px;color:var(--muted)">${c.dist.toFixed(1)} mi</span>` : '';
            return `<div style="padding:11px 14px;cursor:pointer;font-size:14px;font-weight:500;color:#1a1a1a;
                background:#ffffff;border-bottom:0.5px solid #e5e7eb"
              onmouseover="this.style.background='#f0fdf4';this.style.color='#166534'"
              onmouseout="this.style.background='#ffffff';this.style.color='#1a1a1a'"
              onmousedown="document.getElementById('sc-course-input').value='${safeName}';document.getElementById('${scAcId}').style.display='none';event.preventDefault()">
              ⛳ ${safeName}${dist}
            </div>`;
          }).join('');
          scAc.style.display = 'block';
        };
        scCourseInp.addEventListener('input', showScAc);
        scCourseInp.addEventListener('focus', showScAc);
        scCourseInp.addEventListener('blur', () => setTimeout(()=>{ if(scAc) scAc.style.display='none'; }, 200));
        // Pre-fill with user's home course if field is empty
        if (!scCourseInp.value && window.myProfile?.homeCourse) {
          scCourseInp.value = window.myProfile.homeCourse;
        }
      }
      const dateInput = document.getElementById("sc-round-date");
      const timeInput = document.getElementById("sc-round-time");
      if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split("T")[0];
      if (timeInput && !timeInput.value) timeInput.value = "08:00";
      UI.loadScorecardWeather();
    }
    if (name === "players") {
      // Inject vibe + location filter dropdowns if not present
      const pList = document.getElementById('players-list-main');
      if (pList && !document.getElementById('players-vibe-bar')) {
        const ALL_VIBES = ['Competitive','Casual','Social Drinker','420 Friendly','Music on Cart',
          'Fast Pace','Walker','Cart Only','Early Bird','Twilight','Social Poster','Low Key',
          'Drinker','Score Keeper','Course Explorer'];
        // Build unique city list from allPlayers for location filter
        const cities = [...new Set((allPlayers||[]).map(p=>(p.city||'').split(',')[0].trim()).filter(Boolean))].sort();
        const pbar = document.createElement('div');
        pbar.id = 'players-vibe-bar';
        pbar.style.cssText = 'display:flex;gap:10px;padding:10px 16px 10px;border-bottom:0.5px solid var(--border);';
        pbar.innerHTML = `
          <select id="player-vibe-select"
            onchange="window._playerVibeFilter=this.value;safeUI('applyPlayerFilters')"
            style="flex:1;padding:9px 12px;border-radius:10px;border:1.5px solid var(--border);
              background:var(--surface);color:var(--text);font-size:14px;font-family:inherit;
              cursor:pointer;outline:none;appearance:none;
              background-image:url('data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\'><path d=\'M1 1l5 5 5-5\' fill=\'none\' stroke=\'%23888\' stroke-width=\'1.5\'/></svg>');
              background-repeat:no-repeat;background-position:right 10px center;padding-right:28px">
            <option value="all">🏌️ All Vibes</option>
            ${ALL_VIBES.map(v=>`<option value="${v}">${v}</option>`).join('')}
          </select>
          <select id="player-loc-select"
            onchange="window._playerMilesFilter=this.value;safeUI('applyPlayerFilters')"
            style="flex:1;padding:9px 12px;border-radius:10px;border:1.5px solid var(--border);
              background:var(--surface);color:var(--text);font-size:14px;font-family:inherit;
              cursor:pointer;outline:none;appearance:none;
              background-image:url('data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\'><path d=\'M1 1l5 5 5-5\' fill=\'none\' stroke=\'%23888\' stroke-width=\'1.5\'/></svg>');
              background-repeat:no-repeat;background-position:right 10px center;padding-right:28px">
            <option value="all">📍 Any distance</option>
            <option value="5">Within 5 miles</option>
            <option value="10">Within 10 miles</option>
            <option value="25">Within 25 miles</option>
            <option value="50">Within 50 miles</option>
          </select>
        `;
        pList.parentNode.insertBefore(pbar, pList);
      }
      window._playerVibeFilter  = 'all';
      window._playerMilesFilter = 'all';
    }
    if (name === "profile") {
      updateProfileUI(); UI.loadProfileActivity();
      // Inject account-management section (with brief delay to let screen render)
      setTimeout(() => {
      if (!document.getElementById('profile-account-section')) {
        const profileScreen = document.getElementById('screen-profile');
        if (profileScreen) {
          const sec = document.createElement('div');
          sec.id = 'profile-account-section';
          sec.style.cssText = 'padding:20px 16px 40px;border-top:0.5px solid var(--border);margin-top:8px';
          sec.innerHTML = `
            <div style="font-size:11px;font-weight:600;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:14px">Account</div>
            <div style="display:flex;flex-direction:column;gap:10px">
              <button onclick="safeUI('showSubscriptionManager')"
                style="width:100%;padding:13px 16px;border-radius:14px;border:1.5px solid var(--border);
                  background:var(--surface);color:var(--text);font-size:14px;font-weight:500;
                  cursor:pointer;font-family:inherit;text-align:left;display:flex;align-items:center;justify-content:space-between">
                <span>⭐ Subscription Plan</span>
                <span id="profile-plan-badge" style="font-size:12px;color:var(--green);font-weight:600">Free</span>
              </button>
              <button onclick="safeUI('confirmDeleteAccount')"
                style="width:100%;padding:13px 16px;border-radius:14px;border:1.5px solid #ef4444;
                  background:transparent;color:#ef4444;font-size:14px;font-weight:500;
                  cursor:pointer;font-family:inherit;text-align:left">
                🗑️ Delete Account
              </button>
            </div>`;
          profileScreen.appendChild(sec);
        }
      }
      }, 100); // end setTimeout
      // Update plan badge (also deferred)
      setTimeout(() => {
      const badge = document.getElementById('profile-plan-badge');
      if (badge) badge.textContent = myProfile.plan === 'pro' ? '⭐ Pro' : myProfile.plan === 'team' ? '👥 Team' : 'Free';
      }, 150); // end plan badge setTimeout
    }
    if (name === "notifications") { updateProfileUI(); loadNotificationsScreen(); }
    if (name === "onboard")       { buildOnboardScreen(); }
    if (name === "auth")          { buildAuthScreen(); }
    if (name === "feed") {
      updateProfileUI(); UI.refreshWeather(); startLocationWatch();
      // Tee times moved to Discover tab only
    }
    if (name === "search") {
      // Always resync location when entering Discover
      const _profileCity = myProfile.city || '';
      const _geoKey = _profileCity ? 'geo_'+_profileCity.toLowerCase().replace(/[^a-z0-9]/g,'_') : '';
      const _geoCached = _geoKey ? (() => { try { const c=sessionStorage.getItem(_geoKey); if(c){const p=JSON.parse(c); if(p.ts&&Date.now()-p.ts<86400000) return p;} } catch(_){} return null; })() : null;
      // If profile city changed OR we have no coords but do have a geo cache for this city
      const _cityChanged = _profileCity && _profileCity !== window._lastDiscoverCity;
      const _hasNoCoords = !window._wxLat && _geoCached;
      const _hasNoCourses = !window._nearbyCourses?.length && !window._coursesLoading;
      if (_cityChanged || _hasNoCoords || _hasNoCourses) {
        if (_cityChanged) {
          window._lastDiscoverCity = _profileCity;
          window._wxLat = null; window._wxLon = null;
          try { Object.keys(sessionStorage).filter(k=>k.startsWith('gc2_')||k.startsWith('gc_')).forEach(k=>sessionStorage.removeItem(k)); } catch(_) {}
          window._nearbyCourses = null; window._coursesLoading = false;
        }
        // Restore coords from geo cache if available
        if (_geoCached && !window._wxLat) { window._wxLat = _geoCached.lat; window._wxLon = _geoCached.lon; }
        // Clear the courses array so stale courses don't show during reload
        window._nearbyCourses = [];
        // Always trigger a fresh course load when city changed or coords restored
        setTimeout(() => { window._coursesLoading = false; UI.loadNearbyCourses(); }, 80);
      }
      updateProfileUI();
      const currentCity = window._weatherCity || '';
      if (window._lastCourseCity && window._lastCourseCity !== currentCity) {
        try { Object.keys(sessionStorage).filter(k=>k.startsWith('gc_')).forEach(k=>sessionStorage.removeItem(k)); } catch(_){}
        window._nearbyCourses = null;
        window._coursesLoading = false;
      }
      window._lastCourseCity = currentCity;
      // Inject tee times section into Discover tee times tab
      const teesEl = document.getElementById('all-tee-times');
      if (teesEl && !document.getElementById('disc-nearby-teetimes')) {
        const teeNearby = document.createElement('div');
        teeNearby.id = 'disc-nearby-teetimes';
        teeNearby.style.cssText = 'padding:12px 0 0';
        // Time filter header
        const hdr = document.createElement('div');
        hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0 0 10px;flex-wrap:wrap;gap:8px';
        hdr.innerHTML = `<div style="font-size:13px;font-weight:700;color:var(--text)">⛳ Available Tee Times</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${[['all','Any time'],['7','7AM'],['8','8AM'],['9','9AM'],['10','10AM'],['11','11AM'],['12','Noon'],['13','1PM+']].map(([v,l],i)=>
              `<button class="disc-time-pill${i===0?' disc-time-active':''}" data-hour="${v}"
                onclick="document.querySelectorAll('.disc-time-pill').forEach(b=>b.classList.remove('disc-time-active'));this.classList.add('disc-time-active');window._teeSectionFilter='${v}';loadDiscoverTeeTimes&&loadDiscoverTeeTimes()"
                style="padding:4px 10px;border-radius:14px;font-size:11px;font-weight:500;cursor:pointer;
                  border:1px solid ${i===0?'var(--green)':'var(--border)'};
                  background:${i===0?'var(--green-light)':'var(--surface)'};
                  color:${i===0?'var(--green-dark)':'var(--text)'};font-family:inherit;transition:all .15s">
                ${l}
              </button>`
            ).join('')}
          </div>`;
        teeNearby.appendChild(hdr);
        const nearbyList = document.createElement('div');
        nearbyList.id = 'disc-tee-nearby-list';
        nearbyList.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px 0">Loading nearby tee times…</div>';
        teeNearby.appendChild(nearbyList);
        teesEl.parentNode.insertBefore(teeNearby, teesEl);
        // Style active disc pill
        const style = document.createElement('style');
        style.textContent = '.disc-time-pill.disc-time-active{background:var(--green-light)!important;color:var(--green-dark)!important;border-color:var(--green)!important}';
        document.head.appendChild(style);
      }
      setTimeout(loadDiscoverTeeTimes, 800);
      // Inject distance filter dropdown if not already there
      const coursesList = document.getElementById('courses-list');
      if (coursesList && !document.getElementById('dist-filter-bar')) {
        const bar = document.createElement('div');
        bar.id = 'dist-filter-bar';
        bar.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 16px 8px;';
        bar.innerHTML = `
          <label for="dist-filter" style="font-size:12px;font-weight:600;color:var(--muted);white-space:nowrap;text-transform:uppercase;letter-spacing:.5px">📍 Within</label>
          <select id="dist-filter"
            onchange="(function(){
                const newMi=Math.min(100,parseFloat(document.getElementById('dist-filter')?.value||100));
                const lastMi=window._lastFetchedMiles||0;
                if(newMi>lastMi){
                  window._nearbyCourses=null;window._coursesLoading=false;
                  // Clear geo cache so new radius fetches fresh data
                  try{Object.keys(sessionStorage).filter(k=>k.startsWith('gc_')).forEach(k=>sessionStorage.removeItem(k));}catch(_){}
                  safeUI('loadNearbyCourses');
                }else{
                  safeUI('filterCourses',document.getElementById('course-search-input')?.value||'');
                }
              })()" 
            style="flex:1;padding:9px 12px;border-radius:10px;border:1.5px solid var(--border);
              background:var(--surface);color:var(--text);font-size:14px;font-weight:500;
              font-family:inherit;cursor:pointer;outline:none;appearance:none;
              background-image:url('data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\'><path d=\'M1 1l5 5 5-5\' fill=\'none\' stroke=\'%23888\' stroke-width=\'1.5\'/></svg>');
              background-repeat:no-repeat;background-position:right 12px center;padding-right:32px">
            <option value="5">5 miles</option>
            <option value="10">10 miles</option>
            <option value="25" selected>25 miles</option>
            <option value="50">50 miles</option>
            <option value="75">75 miles</option>
            <option value="100">100 miles (max)</option>
          </select>
        `;
        coursesList.parentNode.insertBefore(bar, coursesList);
      }
      UI.loadNearbyCourses();
    }
    if (name === "edit-profile") UI.goToEditProfile();
    if (name === "messages") {
      updateProfileUI(); UI.loadConversations();
      // Inject group messaging header if not already there
      const convList = document.getElementById('conversations-list');
      if (convList && !document.getElementById('msg-action-bar')) {
        const bar = document.createElement('div');
        bar.id = 'msg-action-bar';
        bar.style.cssText = 'display:flex;gap:10px;padding:12px 16px;border-bottom:0.5px solid var(--border);background:var(--bg)';
        bar.innerHTML = `
          <button onclick="safeUI('showNewGroupPanel')"
            style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;
              padding:11px 16px;border-radius:12px;border:1.5px solid var(--green);
              background:var(--green-light);color:var(--green-dark);
              font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">
            👥 New Group Chat
          </button>
          <button onclick="safeUI('showNewDMSearch')"
            style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;
              padding:11px 16px;border-radius:12px;border:1.5px solid var(--border);
              background:var(--surface);color:var(--text);
              font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">
            💬 New Message
          </button>`;
        convList.parentNode.insertBefore(bar, convList);
      }
    }
    if (name === "my-activity")  UI.loadFullActivity();
    if (name === "conversation") {} // handled by openConversation
    // Show/hide bottom nav based on screen type
    const noBottomNav = ["auth","onboard","vibes","edit-profile","conversation","my-activity","player-profile","course-layout"];
    const bottomNav   = document.getElementById("bottom-nav");
    if (bottomNav) {
      bottomNav.style.display = noBottomNav.includes(name) ? "none" : "flex";
    }
  },

  // ── Weather ──
  refreshWeather() {
    const city = window._weatherCity || myProfile.city || "";
    loadWeather(city);
  },

  markAllNotifsRead() {
    markAllNotifsRead(window._currentUser?.uid);
  },

  openNotif(id, type, refId) {
    openNotif(id, type, refId);
  },

  addPlayerPrompt()             { addPlayerPrompt(); },
  addPlayerByName()             { addPlayerByName(); },
  addPlayerByUid(uid,name,photo){ addPlayerByUid(uid,name,photo||""); },
  removePlayer(idx)             { removePlayer(parseInt(idx)); },
  searchPlayersForCard(q)       { searchPlayersForCard(q); },

  setGameMode(mode) { const _validModes=['stroke','match','stableford','scramble','skins','bestball']; if(_validModes.includes(mode)) setGameMode(mode); },
  buildGamePanel() { buildGamePanel(); },

  loadScorecardWeather() {
    const de=document.getElementById("sc-round-date"),te=document.getElementById("sc-round-time"),ce=document.getElementById("sc-weather");
    if(!ce)return;
    const dv=de?.value||"",tv=te?.value||"08:00";
    if(!dv){ce.innerHTML="";return;}
    const d=new Date(dv+"T12:00:00"),ds=d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
    const [hh,mm]=(tv).split(":").map(Number),ap=hh>=12?"PM":"AM",h=hh%12||12;
    const ts=h+":"+String(mm||0).padStart(2,"0")+" "+ap;
    ce.id="sheet-weather";
    loadRoundDayForecast(ds,ts,window._weatherCity||"").finally(()=>{const e=document.getElementById("sheet-weather");if(e)e.id="sc-weather";});
  },

  // ── Edit profile screen — pre-fill fields ──
  goToEditProfile() {
    const p = myProfile;
    const cityParts = (p.city || "").split(",").map(s => s.trim());
    const elBio    = document.getElementById("edit-bio");
    const elCity   = document.getElementById("edit-city");
    const elState  = document.getElementById("edit-state");
    const elCourse = document.getElementById("edit-home-course");
    const elHdcp   = document.getElementById("edit-hdcp");
    const elCount  = document.getElementById("bio-count");
    if (elBio)    elBio.value    = p.bio        || "";
    if (elCity)   elCity.value   = cityParts[0] || "";
    if (elState)  elState.value  = cityParts[1] || "";
    if (elCourse) {
      elCourse.value = p.homeCourse || "";
      // Wire course autocomplete from nearby courses discovered by user
      elCourse.setAttribute('autocomplete','off');
      const acId = 'course-ac-list';
      let acList = document.getElementById(acId);
      if (!acList) {
        acList = document.createElement('div');
        acList.id = acId;
        acList.style.cssText = [
          'position:absolute','z-index:200','background:var(--bg)',
          'border:1px solid var(--border)','border-radius:10px',
          'box-shadow:0 6px 20px rgba(0,0,0,.15)','max-height:180px',
          'overflow-y:auto','width:100%','left:0','top:calc(100% + 4px)','display:none'
        ].join(';');
        const wrap = elCourse.parentNode;
        if (wrap) { wrap.style.position = 'relative'; wrap.appendChild(acList); }
      }
      const showSuggestions = () => {
        const q = elCourse.value.toLowerCase().trim();
        const courses = window._nearbyCourses || [];
        const matches = q.length < 1
          ? courses.slice(0,8)
          : courses.filter(c => c.name.toLowerCase().includes(q)).slice(0,8);
        if (!matches.length) { acList.style.display = 'none'; return; }
        acList.innerHTML = matches.map(c => {
          const safeName = c.name.replace(/'/g,"&#39;").replace(/"/g,"&quot;");
          const dist = c.dist ? c.dist.toFixed(1)+' mi' : '';
          return `<div style="padding:10px 14px;cursor:pointer;font-size:14px;color:var(--text);
              border-bottom:0.5px solid var(--border);transition:background .1s"
            onmouseover="this.style.background='var(--surface)'"
            onmouseout="this.style.background='transparent'"
            onmousedown="document.getElementById('edit-home-course').value='${safeName}';document.getElementById('${acId}').style.display='none';event.preventDefault()">
            ${esc(c.name)}${dist?` <span style="font-size:11px;color:var(--muted);">${dist}</span>`:''}
          </div>`;
        }).join('');
        acList.style.display = 'block';
      };
      elCourse.oninput = showSuggestions;
      elCourse.onfocus = showSuggestions;
      elCourse.onblur  = () => setTimeout(() => { if(acList) acList.style.display='none'; }, 200);
    }
    if (elHdcp)   elHdcp.value   = p.handicap   != null ? p.handicap : 18;
    if (elCount)  elCount.textContent = (160 - (p.bio || "").length) + " left";
    const errEl = document.getElementById("edit-profile-error");
    if (errEl) errEl.style.display = "none";
    const locStatus = document.getElementById("edit-location-status");
    if (locStatus) locStatus.style.display = "none";
  },

  adjustEditHdcp(delta) {
    const inp = document.getElementById("edit-hdcp");
    if (inp) inp.value = Math.max(0, Math.min(54, (parseInt(inp.value) || 18) + delta));
  },

  async useMyLocation() {
    const statusEl = document.getElementById("edit-location-status");
    const cityEl   = document.getElementById("edit-city");
    const stateEl  = document.getElementById("edit-state");
    if (statusEl) { statusEl.style.display = "block"; statusEl.textContent = "Detecting location…"; }
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
      );
      const { latitude, longitude } = pos.coords;
      window._userLat = latitude;
      window._userLon = longitude;
      // Reverse geocode via Nominatim (OpenStreetMap, free, no key)
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await res.json();
      const addr  = data.address || {};
      const city  = addr.city || addr.town || addr.village || addr.county || "";
      const raw   = addr.state_code || addr.state || "";
      const state = raw.length <= 3 ? raw.toUpperCase() : raw;
      if (cityEl)   cityEl.value   = city;
      if (stateEl)  stateEl.value  = state;
      if (statusEl) statusEl.textContent = `📍 Found: ${city}, ${state}`;
    } catch (err) {
      if (statusEl) statusEl.textContent = "Could not detect location. Please enter manually.";
    }
  },

  async saveProfileEdits() {
    const bio       = (document.getElementById("edit-bio")?.value         || "").trim();
    const cityRaw   = (document.getElementById("edit-city")?.value        || "").trim();
    const stateRaw  = (document.getElementById("edit-state")?.value       || "").trim().toUpperCase();
    const homeCourse= (document.getElementById("edit-home-course")?.value || "").trim();
    // Build combined city string BEFORE using it
    const city = stateRaw ? `${cityRaw}, ${stateRaw}` : cityRaw;
    // Geocode city to get lat/lon for distance filtering
    let profLat = null, profLon = null;
    if (city) {
      const gk = 'geo_' + city.split(',')[0].trim().toLowerCase().replace(/ /g,'_');
      try {
        const cached = sessionStorage.getItem(gk);
        if (cached) { const g=JSON.parse(cached); profLat=g.lat; profLon=g.lon; }
      } catch(_) {}
      if (!profLat) {
        try {
          const gd = await (await fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(city.split(',')[0].trim())+'&count=1&language=en&format=json')).json();
          if (gd.results?.length) {
            profLat = gd.results[0].latitude;
            profLon = gd.results[0].longitude;
            sessionStorage.setItem(gk, JSON.stringify({lat:profLat,lon:profLon,ts:Date.now()}));
          }
        } catch(_) {}
      }
    }
    const handicapRaw = parseInt(document.getElementById("edit-hdcp")?.value);
    const handicap = isNaN(handicapRaw) ? 18 : Math.max(0, Math.min(54, handicapRaw));
    const errEl     = document.getElementById("edit-profile-error");

    // City is required; state is strongly recommended but not blocked
    if (!cityRaw) {
      if (errEl) { errEl.textContent = "City is required."; errEl.style.display = "block"; }
      return;
    }
    if (errEl) errEl.style.display = "none";

    // Build city string — include state if provided
        const btn  = document.getElementById("save-profile-btn");
    if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }

    try {
      // Make sure user is still signed in
      if (!window._currentUser) {
        throw new Error("Not signed in. Please sign in again.");
      }
      await saveProfileData({ bio, city, homeCourse, handicap, lat: profLat, lon: profLon });
      showToast("Profile saved! ✅");
      window._weatherCity = city;
      // Sync new location to wx globals so Discover uses it immediately
      if (profLat) { window._wxLat = profLat; window._wxLon = profLon; }
      // Clear Discover cache so it reloads with new location
      try { Object.keys(sessionStorage).filter(k=>k.startsWith('gc2_')||k.startsWith('gc_')).forEach(k=>sessionStorage.removeItem(k)); } catch(_) {}
      window._nearbyCourses = null; window._coursesLoading = false; window._lastDiscoverCity = city;
      // Clear ALL cached location data so new city takes effect immediately
      window._userLat = null;
      window._userLon = null;
      window._wxLat   = null;
      window._wxLon   = null;
      window._coursesLoading = false;
      // Clear cached courses so new city's courses load fresh
      try { Object.keys(sessionStorage).filter(k=>k.startsWith('gc_')).forEach(k=>sessionStorage.removeItem(k)); } catch(_) {}
      // Refresh weather and courses with new city
      UI.refreshWeather();
      goScreen("profile");
      // Load courses for new city after a short delay
      setTimeout(() => { window._nearbyCourses = null; }, 100);
    } catch (err) {
      console.error("saveProfileEdits error:", err);
      // Show the actual Firebase error so it is actionable
      const msg = err?.message || err?.code || "Could not save. Check your connection.";
      if (errEl) { errEl.textContent = msg; errEl.style.display = "block"; }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Save changes"; }
    }
  },

  // ── Profile photo ──
  triggerPhotoUpload() {
    document.getElementById("photo-file-input")?.click();
  },

  async handlePhotoUpload(input) {
    const file = input?.files?.[0];
    if (!file) return;
    const statusEl      = document.getElementById("photo-upload-status");
    const placeholder   = document.getElementById("edit-photo-placeholder");
    const preview       = document.getElementById("edit-photo-preview");
    if (statusEl)    statusEl.textContent = "Uploading…";
    try {
      const url = await uploadProfilePhoto(file);
      if (statusEl)    statusEl.textContent  = "Photo updated! ✅";
      // Show preview immediately in edit screen
      if (url && preview) {
        preview.src           = url;
        preview.style.display = "block";
        if (placeholder) placeholder.style.display = "none";
      }
      showToast("Profile photo updated ✅");
      setTimeout(() => { if (statusEl) statusEl.textContent = ""; }, 3000);
    } catch (err) {
      if (statusEl) statusEl.textContent = err.message || "Upload failed";
      showToast("Upload failed — " + (err.message || "try again"));
    } finally {
      input.value = "";
    }
  },

  // ── Activity ──
  async loadProfileActivity() {
    const user = window._currentUser;
    if (!user) return;
    const el = document.getElementById("profile-activity-preview");
    if (!el) return;
    try {
      const items = await loadUserActivity(user.uid);
      const visible = items.filter(i => !i.hidden).slice(0, 3);
      renderActivity(visible, "profile-activity-preview", true);
    } catch (e) {
      if (el) el.innerHTML = "";
    }
  },

  async loadFullActivity() {
    const user = window._currentUser;
    if (!user) return;
    try {
      const items = await loadUserActivity(user.uid);
      renderActivity(items, "my-activity-list", true);
    } catch (e) {
      showToast("Could not load activity");
    }
  },

  async deleteActivity(id, type) {
    if (!confirm("Delete this item permanently?")) return;
    try {
      await deleteActivityItem({ id, type });
      UI.loadFullActivity();
      UI.loadProfileActivity();
    } catch (e) { showToast("Could not delete"); }
  },

  async toggleHideActivity(id, type, hidden) {
    try {
      await toggleHideItem({ id, type }, hidden);
      UI.loadFullActivity();
      UI.loadProfileActivity();
    } catch (e) { showToast("Could not update"); }
  },

  // ── Messaging ──
  async loadConversations() {
    // ── Inject New Group button (no extra HTML needed) ──────────────
    if (!document.getElementById("new-group-btn")) {
      const convList = document.getElementById("conversations-list");
      if (convList) {
        const btnWrap = document.createElement("div");
        btnWrap.style.cssText = "padding:0 0 10px;display:flex;justify-content:flex-end";
        const _btn = document.createElement("button");
        _btn.id = "new-group-btn";
        _btn.textContent = "👥 New Group";
        _btn.onclick = function(){ safeUI("showNewGroupPanel"); };
        Object.assign(_btn.style, {display:"flex",alignItems:"center",gap:"5px",background:"var(--green-light)",color:"var(--green-dark)",border:"none",borderRadius:"16px",padding:"6px 14px",fontSize:"13px",fontWeight:"600",cursor:"pointer",fontFamily:"inherit"});
        convList.parentNode.insertBefore(btnWrap, convList);
      }
    }
    // ── Inject group creation panel ──────────────────────────────────
    if (!document.getElementById("new-group-panel")) {
      const convList = document.getElementById("conversations-list");
      if (convList) {
        const panel = document.createElement("div");
        panel.id = "new-group-panel";
        panel.style.cssText = "display:none;background:var(--bg);border-radius:16px;padding:18px 16px;margin:0 0 16px;border:1.5px solid var(--green);box-shadow:0 4px 20px rgba(0,0,0,.08)";
        panel.innerHTML =
          '<div style="font-size:14px;font-weight:600;margin-bottom:10px">New Group Chat</div>' +
          '<input id="group-name-input" maxlength="40" placeholder="Group name (e.g. Saturday Crew)" ' +
          'style="width:100%;box-sizing:border-box;padding:8px 12px;border-radius:10px;border:1.5px solid var(--border);' +
          'background:var(--bg);color:var(--text);font-size:14px;font-family:inherit;margin-bottom:10px">' +
          '<div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.4px">Add Members</div>' +
          '<div id="group-member-chips" style="display:flex;flex-wrap:wrap;gap:6px;min-height:10px;margin-bottom:8px"></div>' +
          '<input id="group-member-search" placeholder="Search followers by name…" oninput="safeUI(\'searchGroupMembers\',this.value)" style="width:100%;box-sizing:border-box;padding:8px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg);color:var(--text);font-size:14px;font-family:inherit;margin-bottom:8px">' +
          '<div id="group-member-search-results" style="max-height:200px;overflow-y:auto;margin-bottom:12px"></div>' +
          '<button id="create-group-btn" disabled onclick="safeUI(\'createGroup\')" ' +
          'style="width:100%;padding:10px;background:var(--green);color:#fff;border:none;border-radius:20px;' +
          'font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Create Group</button>';
        convList.parentNode.insertBefore(panel, convList);
      }
    }
    listenToConversations((convs) => {
      renderConversationsList(convs, "conversations-list");
    });
    // Update avatar
    const av = document.getElementById("msg-avatar");
    if (av) {
      const { initials, avatarColor } = await import("./ui.js?v=70");
      av.textContent = initials(myProfile.displayName);
      av.className   = "avatar-sm " + avatarColor(myProfile.uid || "");
    }
    // Pre-load following list for search
    try {
      window._msgFollowing = await loadFollowing();
    } catch(e) { window._msgFollowing = []; }
    // Clear search
    const searchEl = document.getElementById("msg-search");
    if (searchEl) searchEl.value = "";
    const followingList = document.getElementById("msg-following-list");
    if (followingList) followingList.style.display = "none";
  },

  // ── Search messages / following ──
  searchMessages(query) {
    const followingList  = document.getElementById("msg-following-list");
    const followingPeople = document.getElementById("msg-following-people");
    if (!query || !query.trim()) {
      if (followingList) followingList.style.display = "none";
      return;
    }
    if (followingList) followingList.style.display = "block";
    const people = window._msgFollowing || [];
    renderFollowingForSearch(people, query, "msg-following-people");
  },

  async openConversation(convId, otherUid, otherName, isGroup) {
    const hdr = document.getElementById("conv-header-name");
    if (hdr) hdr.textContent = otherName;
    // Inject block button for DM conversations
    const convHeader = hdr?.parentElement;
    const existingBlock = document.getElementById('conv-block-btn');
    if (existingBlock) existingBlock.remove();
    if (convHeader && !isGroup && otherUid) {
      const isBlocked = (window.myProfile?.blockedUsers||[]).includes(otherUid);
      const blockBtn = document.createElement('button');
      blockBtn.id = 'conv-block-btn';
      blockBtn.title = isBlocked ? 'Unblock user' : 'Block user';
      blockBtn.style.cssText = 'background:none;border:none;cursor:pointer;padding:6px 8px;color:var(--muted);font-size:13px;display:flex;align-items:center;gap:4px;border-radius:8px;font-family:inherit';
      blockBtn.innerHTML = isBlocked ? '🚫 Unblock' : '⋯';
      blockBtn.onclick = () => {
        // Show action sheet
        const sheet = document.createElement('div');
        sheet.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:500;display:flex;align-items:flex-end;justify-content:center';
        const curBlocked = (window.myProfile?.blockedUsers||[]).includes(otherUid);
        sheet.innerHTML = `<div style="background:var(--bg);border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:16px 16px 36px">
          <div style="font-size:15px;font-weight:600;text-align:center;margin-bottom:16px;color:var(--text)">${otherName}</div>
          <button onclick="this.closest('div[style]').remove();safeUI('openPlayerProfile','${otherUid}')"
            style="width:100%;padding:14px;border-radius:12px;background:var(--surface);border:1px solid var(--border);
              color:var(--text);font-size:14px;font-weight:500;cursor:pointer;font-family:inherit;margin-bottom:8px;text-align:left">
            👤 View Profile
          </button>
          <button onclick="this.closest('div[style]').remove();safeUI('blockUserFromConversation','${otherUid}','${otherName}')"
            style="width:100%;padding:14px;border-radius:12px;background:var(--surface);border:1px solid ${curBlocked?'var(--green)':'#ef4444'};
              color:${curBlocked?'var(--green)':'#ef4444'};font-size:14px;font-weight:500;cursor:pointer;font-family:inherit;margin-bottom:8px;text-align:left">
            🚫 ${curBlocked?'Unblock':'Block'} ${otherName}
          </button>
          <button onclick="this.closest('div[style]').remove()"
            style="width:100%;padding:14px;border-radius:12px;background:var(--surface);border:1px solid var(--border);
              color:var(--muted);font-size:14px;cursor:pointer;font-family:inherit;text-align:center">
            Cancel
          </button>
        </div>`;
        document.body.appendChild(sheet);
        sheet.addEventListener('click', e => { if(e.target===sheet) sheet.remove(); });
      };
      convHeader.appendChild(blockBtn);
    }
    // Show member count badge for groups
    const sub = document.getElementById("conv-header-sub");
    if (sub) {
      if (isGroup) {
        const snap = await (async()=>{ try{ const {getDoc,doc,getFirestore}=await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"); const {getApp}=await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"); const d=await getDoc(doc(getFirestore(getApp()),"conversations",convId)); return d.data(); }catch{return null;} })();
        if (snap) {
          const me = window._currentUser?.uid;
          const names = Object.entries(snap.participantNames||{})
            .filter(([uid]) => uid !== me)
            .map(([,name]) => name)
            .filter(Boolean);
          const shown = names.slice(0,4);
          const extra = names.length - shown.length;
          sub.textContent = '👤 ' + shown.join(', ') + (extra > 0 ? ' +'+extra+' more' : '');
        } else { sub.textContent = 'Group'; }
        sub.style.display = "";
      } else { sub.style.display = "none"; }
    }
    goScreen("conversation");
    // Ensure bottom nav is always hidden in conversation (belt+suspenders)
    const _bn = document.getElementById('bottom-nav');
    if (_bn) _bn.style.display = 'none';
    listenToMessages(convId, (msgs) => {
      renderMessages(msgs, "messages-thread", !!isGroup);
    });
    window._activeConvId   = convId;
    window._activeConvIsGroup = !!isGroup;
    window._activeConvMeta = { otherUid, otherName, isGroup: !!isGroup };
    markConversationRead(convId, window._currentUser?.uid);
  },

  // ── View another player's profile ──────────────────────
  async openPlayerProfile(uid) {
    if (!uid || uid === window._currentUser?.uid) return; // don't open own profile
    try {
      // Record origin so back button returns to right screen
      window._ppOriginScreen = document.querySelector('.screen.active')?.id?.replace('screen-','') || 'players';
      const { getDoc, doc, getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      const { getApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
      const db = getFirestore(getApp());
      const snap = await getDoc(doc(db, "users", uid));
      if (!snap.exists()) { showToast("Profile not found"); return; }
      const p = { uid, ...snap.data() };
      window._viewingPlayer = p;
      buildPlayerProfileScreen(p);
      goScreen("player-profile");
    } catch(e) {
      console.error("openPlayerProfile error:", e);
      showToast("Could not load profile");
    }
  },

  // ── Account management ──────────────────────────────────
  showSubscriptionManager() {
    // Build a modal with plan options
    const existing = document.getElementById('sub-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'sub-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000;display:flex;align-items:flex-end;justify-content:center';
    const curPlan = window.myProfile?.plan || 'free';
    modal.innerHTML = `
      <div style="background:var(--bg);border-radius:24px 24px 0 0;width:100%;max-width:480px;padding:24px 20px 40px">
        <div style="width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 20px"></div>
        <div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:4px">Subscription</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:20px">Current plan: <strong>${curPlan==='pro'?'⭐ Pro':curPlan==='team'?'👥 Team':'Free'}</strong></div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div style="padding:16px;border-radius:14px;border:2px solid ${curPlan==='pro'?'var(--green)':'var(--border)'};background:var(--surface)">
            <div style="font-size:15px;font-weight:700">⭐ Pro — $4.99/mo</div>
            <div style="font-size:13px;color:var(--muted);margin-top:4px">Unlimited messages · Advanced stats · Priority matching</div>
            ${curPlan!=='pro'?`<button onclick="safeUI('upgradeToPro')"
              style="margin-top:12px;width:100%;padding:11px;border-radius:10px;background:var(--green);color:#fff;
                border:none;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">
              Upgrade to Pro
            </button>`:'<div style="margin-top:10px;font-size:13px;color:var(--green);font-weight:600">✓ Current plan</div>'}
          </div>
          <div style="padding:16px;border-radius:14px;border:1.5px solid ${curPlan==='free'?'var(--green)':'var(--border)'};background:var(--surface)">
            <div style="font-size:15px;font-weight:700">Free</div>
            <div style="font-size:13px;color:var(--muted);margin-top:4px">Core features · 10 messages/day · Standard matching</div>
            ${curPlan!=='free'?`<button onclick="safeUI('confirmDowngrade')"
              style="margin-top:12px;width:100%;padding:11px;border-radius:10px;background:transparent;color:#ef4444;
                border:1.5px solid #ef4444;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">
              Downgrade to Free
            </button>`:'<div style="margin-top:10px;font-size:13px;color:var(--green);font-weight:600">✓ Current plan</div>'}
          </div>
        </div>
        <button onclick="document.getElementById('sub-modal')?.remove()"
          style="margin-top:20px;width:100%;padding:13px;border-radius:14px;background:var(--surface);
            color:var(--text);border:1.5px solid var(--border);font-size:14px;font-weight:500;cursor:pointer;font-family:inherit">
          Close
        </button>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
  },

  confirmDowngrade() {
    document.getElementById('sub-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'confirm-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
      <div style="background:var(--bg);border-radius:20px;width:100%;max-width:360px;padding:24px">
        <div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:8px">Downgrade to Free?</div>
        <div style="font-size:14px;color:var(--muted);margin-bottom:20px">You'll lose Pro features at the end of your billing period.</div>
        <div style="display:flex;gap:10px">
          <button onclick="document.getElementById('confirm-modal')?.remove()"
            style="flex:1;padding:12px;border-radius:12px;background:var(--surface);border:1.5px solid var(--border);
              color:var(--text);font-size:14px;font-weight:500;cursor:pointer;font-family:inherit">Cancel</button>
          <button onclick="document.getElementById('confirm-modal')?.remove();safeUI('doDowngrade')"
            style="flex:1;padding:12px;border-radius:12px;background:#ef4444;border:none;
              color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Downgrade</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  },

  async doDowngrade() {
    await downgradeSubscription();
    const badge = document.getElementById('profile-plan-badge');
    if (badge) badge.textContent = 'Free';
  },

  upgradeToPro() {
    document.getElementById('sub-modal')?.remove();
    showToast('Upgrade coming soon — stay tuned! ⭐');
  },

  confirmDeleteAccount() {
    const modal = document.createElement('div');
    modal.id = 'delete-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
      <div style="background:var(--bg);border-radius:20px;width:100%;max-width:360px;padding:24px">
        <div style="font-size:18px;font-weight:700;color:#ef4444;margin-bottom:8px">Delete Account?</div>
        <div style="font-size:14px;color:var(--muted);margin-bottom:6px">This will permanently delete:</div>
        <ul style="font-size:14px;color:var(--text);margin:0 0 16px 16px;padding:0;line-height:1.8">
          <li>Your profile and all data</li>
          <li>Your messages and conversations</li>
          <li>Your round history</li>
        </ul>
        <div style="font-size:13px;color:#ef4444;font-weight:500;margin-bottom:20px">⚠️ This cannot be undone.</div>
        <div style="display:flex;gap:10px">
          <button onclick="document.getElementById('delete-modal')?.remove()"
            style="flex:1;padding:12px;border-radius:12px;background:var(--surface);border:1.5px solid var(--border);
              color:var(--text);font-size:14px;font-weight:500;cursor:pointer;font-family:inherit">Cancel</button>
          <button onclick="document.getElementById('delete-modal')?.remove();safeUI('doDeleteAccount')"
            style="flex:1;padding:12px;border-radius:12px;background:#ef4444;border:none;
              color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Delete Forever</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  },

  async doDeleteAccount() {
    await deleteAccount();
  },

  // ── Block user (from conversation screen) ──────────────────
  async blockUserFromConversation(targetUid, targetName) {
    const nowBlocked = await blockUser(targetUid, targetName);
    if (nowBlocked) {
      // Go back to messages list
      safeUI('goScreen','messages');
    }
  },

  async startConversation(otherUid, otherName) {
    const cid = await getOrCreateConversation(otherUid, otherName);
    if (!cid) return;
    UI.openConversation(cid, otherUid, otherName, false);
  },

  // ── Group messaging ──────────────────────────────────────
  async showNewDMSearch() {
    // Build a DM picker modal
    const existing = document.getElementById('dm-picker-modal');
    if (existing) { existing.remove(); return; }
    const following = await loadFollowing().catch(()=>[]);
    const modal = document.createElement('div');
    modal.id = 'dm-picker-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:600;display:flex;align-items:flex-end;justify-content:center';
    modal.innerHTML = `
      <div style="background:var(--bg);border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:20px 16px 40px;max-height:70vh;overflow-y:auto">
        <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:12px">New Message</div>
        <input id="dm-search-inp" placeholder="Search followers…" oninput="UI._filterDMSearch(this.value)"
          style="width:100%;box-sizing:border-box;padding:9px 12px;border-radius:10px;border:1.5px solid var(--border);
            background:var(--surface);color:var(--text);font-size:14px;font-family:inherit;margin-bottom:12px">
        <div id="dm-search-results">
          ${following.length ? following.map(f=>`
            <div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;
              background:var(--surface);margin-bottom:8px;cursor:pointer"
              onclick="document.getElementById('dm-picker-modal').remove();UI.startConversation('${f.uid}','${esc(f.displayName||'Golfer')}')">
              <div style="font-size:14px;font-weight:500;color:var(--text)">${esc(f.displayName||'Golfer')}</div>
            </div>`).join('')
            : '<div style="font-size:13px;color:var(--muted);padding:8px">No followers yet — connect with players first</div>'}
        </div>
        <button onclick="document.getElementById('dm-picker-modal').remove()"
          style="margin-top:12px;width:100%;padding:12px;border-radius:12px;background:var(--surface);
            border:1px solid var(--border);color:var(--muted);font-size:14px;cursor:pointer;font-family:inherit">
          Cancel
        </button>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
    window._dmFollowing = following;
    setTimeout(()=>document.getElementById('dm-search-inp')?.focus(), 100);
  },

  _filterDMSearch(q) {
    const following = window._dmFollowing || [];
    const lower = q.toLowerCase().trim();
    const filtered = lower ? following.filter(f=>(f.displayName||'').toLowerCase().includes(lower)) : following;
    const el = document.getElementById('dm-search-results');
    if (!el) return;
    el.innerHTML = filtered.length ? filtered.map(f=>`
      <div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;
        background:var(--surface);margin-bottom:8px;cursor:pointer"
        onclick="document.getElementById('dm-picker-modal').remove();UI.startConversation('${f.uid}','${esc(f.displayName||'Golfer')}')">
        <div style="font-size:14px;font-weight:500;color:var(--text)">${esc(f.displayName||'Golfer')}</div>
      </div>`).join('')
      : '<div style="font-size:13px;color:var(--muted);padding:8px">No matches</div>';
  },

  async showNewGroupPanel() {
    window._groupMembers = []; // reset selection
    const panel = document.getElementById("new-group-panel");
    const msgSearch = document.getElementById("msg-search-area");
    if (panel) panel.style.display = panel.style.display==="none"?"block":"none";
    if (msgSearch) msgSearch.style.display = panel?.style.display==="none"?"":"none";
    if (panel && panel.style.display==="block") {
      // Pre-load followers so member search works immediately
      const chips = document.getElementById('group-member-chips');
      const results = document.getElementById('group-member-search-results');
      const searchInp = document.getElementById('group-member-search');
      if (chips) chips.innerHTML = '';
      if (searchInp) searchInp.value = '';
      if (results) {
        results.innerHTML = '<div style="padding:8px;font-size:13px;color:var(--muted)">Loading followers…</div>';
        const following = await loadFollowing().catch(()=>[]);
        window._groupFollowing = following;
        this._renderGroupSearchResults(following, results);
      }
    }
    if (panel && panel.style.display !== "none") {
      // Load following for group selection
      loadFollowing().then(people => {
        window._followingCache = people;
        renderFollowingForSearch(people, "", "group-member-search-results", true);
      });
    }
  },

  toggleGroupMember(uid, name) {
    window._groupMembers = window._groupMembers || [];
    if (window._groupMembers.length >= 9 && !window._groupMembers.find(m=>m.uid===uid)) {
      showToast('Max 9 members per group'); return;
    }
    const idx = window._groupMembers.findIndex(m => m.uid === uid);
    if (idx >= 0) { window._groupMembers.splice(idx, 1); }
    else { window._groupMembers.push({ uid, name }); }
    // Re-render results with updated Add/✓ state using our new renderer
    const results = document.getElementById('group-member-search-results');
    if (results) this._renderGroupSearchResults(window._groupFollowing||window._followingCache||[], results);
    // Update chips
    const chips = document.getElementById("group-member-chips");
    if (chips) {
      chips.innerHTML = (window._groupMembers||[]).map(m =>
        `<span style="background:var(--green-light);color:var(--green-dark);padding:3px 10px;border-radius:12px;font-size:12px;font-weight:500;display:inline-flex;align-items:center;gap:4px">
          ${esc(m.name)} <span onclick="safeUI('toggleGroupMember','${m.uid}','${esc(m.name)}')" style="cursor:pointer;font-size:14px;line-height:1">×</span>
        </span>`
      ).join("");
    }
    const btn = document.getElementById("create-group-btn");
    if (btn) btn.disabled = (window._groupMembers||[]).length < 1;
  },

  searchGroupMembers(q) {
    const results = document.getElementById('group-member-search-results');
    if (!results) return;
    const following = window._groupFollowing || [];
    const lower = (q||'').toLowerCase().trim();
    const filtered = lower
      ? following.filter(f => (f.displayName||'').toLowerCase().includes(lower))
      : following;
    this._renderGroupSearchResults(filtered, results);
  },

  _renderGroupSearchResults(list, container) {
    if (!container) return;
    const members = window._groupMembers || [];
    if (!list.length) {
      container.innerHTML = '<div style="padding:8px;font-size:13px;color:var(--muted)">No followers found — Connect with players first</div>';
      return;
    }
    container.innerHTML = list.map(f => {
      const isAdded = members.some(m => m.uid === f.uid);
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;
          border-radius:10px;background:var(--surface);margin-bottom:6px;cursor:pointer"
          onclick="safeUI('toggleGroupMember','${f.uid}','${esc(f.displayName||'Golfer')}')">
          <span style="font-size:14px;color:var(--text)">${esc(f.displayName||'Golfer')}</span>
          <span style="font-size:12px;padding:3px 10px;border-radius:20px;font-weight:600;
            background:${isAdded?'var(--green)':'var(--surface)'};
            color:${isAdded?'#fff':'var(--muted)'};border:1px solid ${isAdded?'var(--green)':'var(--border)'}"
            >${isAdded?'✓ Added':'Add'}</span>
        </div>`;
    }).join('');
  },

  async createGroup() {
    const members = window._groupMembers || [];
    if (!members.length) { showToast("Add at least 1 person to your group"); return; }
    const nameInput = document.getElementById("group-name-input");
    const groupName = nameInput?.value?.trim() || "Group Chat";
    const memberUids  = members.map(m => m.uid);
    const memberNames = Object.fromEntries(members.map(m => [m.uid, m.name]));
    const btn = document.getElementById("create-group-btn");
    if (btn) { btn.disabled = true; btn.textContent = "Creating…"; }
    try {
      const cid = await createGroupConversation(memberUids, memberNames, groupName);
      window._groupMembers = [];
      window._groupFollowing = null;
      const panel = document.getElementById('new-group-panel');
      if (panel) panel.style.display = 'none';
      // Reset chips + search
      const chips = document.getElementById('group-member-chips');
      const inp = document.getElementById('group-name-input');
      if (chips) chips.innerHTML = '';
      if (inp) inp.value = '';
      showToast('Group "' + groupName + '" created! 🎉');
      await new Promise(r=>setTimeout(r,600));
      UI.openConversation(cid, '', groupName, true);
    } catch(e) {
      console.error('createGroup error:', e);
      showToast('Could not create group: ' + (e.message||'unknown error'));
      if (btn) { btn.disabled = false; btn.textContent = 'Create Group'; }
    }
  },

  async sendMsg() {
    const input = document.getElementById('msg-input');
    const text  = input?.value?.trim();
    const cid   = window._activeConvId;
    if (!text) return;
    if (!cid) { showToast('No active conversation'); return; }
    const prevVal = input.value;
    input.value = '';
    input.style.height = 'auto';
    try {
      const otherUid = await sendMessage(cid, text);
      // Fire notification to all recipients (DM: 1, Group: many)
      const meta = window._activeConvMeta || {};
      const recipients = Array.isArray(otherUid) ? otherUid : (otherUid ? [otherUid] : (meta.otherUid ? [meta.otherUid] : []));
      recipients.filter(r => r && r !== window._currentUser?.uid).forEach(r => {
        createNotification({
          toUid:     r,
          fromUid:   window._currentUser.uid,
          fromName:  myProfile?.displayName || "Someone",
          fromPhoto: myProfile?.photoURL    || null,
          type:      "message",
          refId:     cid,
          preview:   (window._activeConvIsGroup ? (myProfile?.displayName||"Someone")+": " : "") + text.slice(0, 80),
        });
      });
    } catch (e) {
      showToast("Could not send message");
    }
  },

  // ── Auth tab switch ──
  // ── Auth screen navigation ──
  showAuthLanding() {
    const _s = id => { const el=document.getElementById(id); if(el) el.style.display = id==='auth-landing'?'flex':'none'; };
    _s('auth-landing'); _s('auth-signin'); _s('auth-email-signup');
  },
  showAuthSignIn() {
    const el = id => document.getElementById(id);
    if(el('auth-landing'))    el('auth-landing').style.display    = 'none';
    if(el('auth-signin'))     el('auth-signin').style.display     = 'block';
    if(el('auth-email-signup')) el('auth-email-signup').style.display = 'none';
    setTimeout(() => el('login-email')?.focus(), 100);
  },
  showAuthEmailSignup() {
    // Route to the full onboard flow instead of inline form
    goScreen('onboard');
  },

  // ── Forgot password ──
  async handleForgotPassword() {
    const email = document.getElementById("login-email")?.value.trim();
    if (!email) { showFormError("login", "Enter your email address first."); return; }
    try {
      const { sendPasswordResetEmail, getAuth } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
      await sendPasswordResetEmail(getAuth(), email);
      const errEl = document.getElementById("login-error");
      if (errEl) {
        errEl.textContent = "✅ Reset email sent! Check your inbox.";
        errEl.style.color = "var(--green)";
        errEl.style.display = "block";
      }
    } catch(e) {
      showFormError("login", friendlyError(e.code));
    }
  },

  // Legacy tab switcher kept for compatibility
  switchAuthTab(tab) {
    // Map to new system
    if (tab === "login")  { UI.showAuthSignIn(); }
    if (tab === "signup") { UI.showAuthEmailSignup(); }
  },

  // ── Login ──
  async handleLogin() {
    const email = document.getElementById("login-email").value.trim();
    const pass  = document.getElementById("login-password").value;
    const btn   = document.getElementById("login-btn");
    document.getElementById("login-error").style.display = "none";
    if (!email || !pass) { showFormError("login", "Please fill in all fields."); return; }
    btn.disabled = true; btn.textContent = "Signing in…";
    try {
      await doLogin(email, pass);
    } catch (e) {
      btn.disabled = false; btn.textContent = "Sign in";
      showFormError("login", friendlyError(e.code));
    }
  },

  // ── Sign Up ──
  async handleSignup() {
    const email = document.getElementById("signup-email").value.trim();
    const pass  = document.getElementById("signup-password").value;
    const btn   = document.getElementById("signup-btn");
    const errEl = document.getElementById("signup-error");
    if (errEl) errEl.style.display = "none";
    if (!email || !pass) { showFormError("signup", "Please fill in all fields."); return; }
    if (pass.length < 6) { showFormError("signup", "Password must be at least 6 characters."); return; }
    btn.disabled = true; btn.textContent = "Creating account…";
    try {
      await doSignup("", "", email, pass);
      // auth state change fires → onboard screen shown by auth.js
    } catch (e) {
      btn.disabled = false; btn.textContent = "Get Started →";
      showFormError("signup", friendlyError(e.code));
    }
  },

  // ── Sign Out ──
  async handleSignOut() {
    teardownMessaging();
    stopListeningMessages();
    stopLocationWatch();
    await doSignOut();
  },

  // ── Onboarding ──
  nextOnboard(step) {
    // Validate location fields before leaving step 2
    if (step === 3) {
      const city  = document.getElementById("onboard-city")?.value.trim()  || "";
      const state = document.getElementById("onboard-state")?.value.trim() || "";
      const err   = document.getElementById("onboard-location-error");
      if (!city) {
        if (err) { err.style.display = "block"; }
        UI.validateLocation(); // ensure button stays disabled
        return;
      }
      if (err) err.style.display = "none";
    }
    document.querySelectorAll(".onboard-step").forEach((s) => s.classList.add("hidden"));
    const el = document.getElementById("onboard-" + step);
    if (el) el.classList.remove("hidden");
  },


  adjustHdcp(delta) {
    const inp = document.getElementById("hdcp-val");
    inp.value = Math.max(0, Math.min(54, (parseInt(inp.value) || 18) + delta));
  },

  async finishOnboard() {
    const selectedVibes = [...document.querySelectorAll("#onboard-vibes .vibe-toggle.selected")]
      .map((el) => el.dataset.vibe);
    const handicap   = parseInt(document.getElementById("hdcp-val")?.value)         || 18;
    const cityRaw    = document.getElementById("onboard-city")?.value.trim()        || "";
    const stateRaw   = document.getElementById("onboard-state")?.value.trim().toUpperCase() || "";
    const city       = cityRaw && stateRaw ? `${cityRaw}, ${stateRaw}` : cityRaw || stateRaw;
    const homeCourse = document.getElementById("onboard-course")?.value.trim()      || "";

    await saveOnboardingData({ handicap, city, homeCourse, vibes: selectedVibes });

    // Make city available to weather module
    window._weatherCity = city || "";

    showToast("Welcome to Fairway Friend! 🏌️");
    goScreen("feed");
    document.getElementById("bottom-nav").style.display = "flex";

    // FIX: mark listeners active BEFORE starting them so auth.js guard doesn't double-start
    setListenersActive(true);
    initFeed();
    initNearbyPlayers();
    // Load weather for new users after onboarding
    setTimeout(() => UI.refreshWeather(), 500);
  },

  // ── Vibes ──
  toggleVibe(el) {
    el.classList.toggle("selected");
  },

  async handleSaveVibes() {
    const selected = [...document.querySelectorAll("#screen-vibes [data-vibe].selected")]
      .map((el) => el.dataset.vibe);
    await saveVibes(selected);
    // FIX: single feedback path — show msg div then navigate
    const msg = document.getElementById("vibes-saved-msg");
    if (msg) {
      msg.style.display = "block";
      setTimeout(() => { msg.style.display = "none"; goScreen("profile"); }, 1200);
    }
    showToast("Vibes saved! ✅");
  },

  // ── Feed ──
  async handlePost() {
    const ta        = document.getElementById("post-text");
    const imageFile = window._pendingPostImage || null;
    const btn       = document.querySelector(".post-btn");
    if (btn) { btn.disabled = true; btn.textContent = "Posting…"; }
    try {
      await submitPost(ta.value, imageFile);
      ta.value = "";
      UI.clearPostImage();
    } catch(e) {
      showToast("Could not post — try again");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Post"; }
    }
  },

  // ── Post photo picker handler ──
  handlePostPhoto(input) {
    const file = input?.files?.[0];
    if (!file) return;
    window._pendingPostImage = file;
    // Show preview
    const preview   = document.getElementById("post-image-preview");
    const thumb     = document.getElementById("post-image-thumb");
    const objectUrl = URL.createObjectURL(file);
    if (thumb)   { thumb.src = objectUrl; }
    if (preview) { preview.style.display = "block"; }
    input.value = ""; // reset so same file can be re-selected
  },

  clearPostImage() {
    window._pendingPostImage = null;
    const preview = document.getElementById("post-image-preview");
    const thumb   = document.getElementById("post-image-thumb");
    if (preview) preview.style.display = "none";
    if (thumb)   { URL.revokeObjectURL(thumb.src); thumb.src = ""; }
  },

  // ── Post reactions ──
  async toggleLike(postId) {
    try { await toggleLike(postId); }
    catch(e) { showToast("Could not update"); }
  },

  toggleReply(postId) {
    const box = document.getElementById("reply-box-" + postId);
    if (!box) return;
    const isOpen = box.style.display !== "none";
    box.style.display = isOpen ? "none" : "block";
    if (!isOpen) {
      loadReplies(postId);
      setTimeout(()=>document.getElementById("reply-input-"+postId)?.focus(), 100);
    }
  },

  async submitReply(postId) {
    const input = document.getElementById("reply-input-" + postId);
    const text = input?.value?.trim();
    if (!text) return;
    input.value = "";
    try {
      await submitReply(postId, text);
      loadReplies(postId);
      showToast("Reply posted ✅");
    } catch(e) { showToast("Could not post reply"); }
  },

  // ── Discover tabs ──
  discoverTab(tab) {
    const courses  = document.getElementById('disc-courses');
    const teetimes = document.getElementById('disc-teetimes');
    const tabC     = document.getElementById('disc-tab-courses');
    const tabT     = document.getElementById('disc-tab-teetimes');
    if (tab === 'courses') {
      if (courses)  courses.style.display  = 'block';
      if (teetimes) teetimes.style.display = 'none';
      if (tabC) tabC.classList.add('disc-tab-active');
      if (tabT) tabT.classList.remove('disc-tab-active');
    } else {
      if (courses)  courses.style.display  = 'none';
      if (teetimes) teetimes.style.display = 'block';
      if (tabC) tabC.classList.remove('disc-tab-active');
      if (tabT) tabT.classList.add('disc-tab-active');
    }
  },

  async loadNearbyCourses() {
    if (window._coursesLoading) return;
    window._coursesLoading = true;
    // Clear cache if radius changed since last fetch
    const _curMi = parseFloat(document.getElementById('dist-filter')?.value || '100');
    if (window._lastFetchedMiles && _curMi !== window._lastFetchedMiles) {
      try { Object.keys(sessionStorage).filter(k=>k.startsWith('gc_')).forEach(k=>sessionStorage.removeItem(k)); } catch(_) {}
    }
    const container = document.getElementById('courses-list');
    const label     = document.getElementById('courses-radius-label');
    if (!container) { window._coursesLoading = false; return; }

    try {
      // ── 1. Resolve lat/lon ──────────────────────────────────────────
      let lat = window._wxLat, lon = window._wxLon;
      // Profile city takes priority — _weatherCity can be stale from a previous session
      const city = myProfile.city || window._weatherCity || '';
      if (!lat && city) {
        // Smart geocoding: strip to city name, add country_code=US, then disambiguate by state
        const _STATE_MAP = {
    AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',
    CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',
    HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',
    KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',
    MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',
    NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',
    NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',
    OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
    SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',
    VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
    DC:'District of Columbia',
  };
        const _parts   = city.split(',').map(s=>s.trim());
        const _cityQ   = _parts[0]; // just the city name — open-meteo rejects "City, ST"
        const _stateAb = _parts[1] || '';
        const _stateFull = _STATE_MAP[_stateAb] || _stateAb;
        const cn  = city.trim();
        const gck = 'geo_' + cn.toLowerCase().replace(/[^a-z0-9]/g, '_');
        let geo = null;
        try { const c=sessionStorage.getItem(gck); if(c){const p=JSON.parse(c); if(p.ts&&Date.now()-p.ts<86400000) geo=p;} } catch(_){}
        if (!geo) {
          try {
            // Fetch top 5 results for city name only (state abbr breaks the query)
            const _geoUrl = 'https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(_cityQ)+'&count=5&language=en&format=json' + (_stateAb ? '&country_code=US' : '');
            const gd = await (await fetch(_geoUrl)).json();
            // Disambiguate: prefer result whose admin1 matches the state
            let _best = gd.results?.[0];
            if (_stateFull && gd.results?.length > 1) {
              const _match = gd.results.find(r => r.admin1 === _stateFull || r.admin1?.toLowerCase() === _stateFull.toLowerCase());
              if (_match) _best = _match;
            }
            if (_best) { geo={lat:_best.latitude,lon:_best.longitude,ts:Date.now()}; sessionStorage.setItem(gck,JSON.stringify(geo)); }
          } catch(_) {}
        }
        if (geo) { lat=geo.lat; lon=geo.lon; window._wxLat=lat; window._wxLon=lon; }
      }
      if (!lat) {
        try { const p=await new Promise((r,j)=>navigator.geolocation.getCurrentPosition(r,j,{timeout:5000})); lat=p.coords.latitude; lon=p.coords.longitude; window._wxLat=lat; window._wxLon=lon; } catch(_) {}
      }
      if (!lat) { container.innerHTML='<div class="empty-state">Add your city in Edit Profile to find nearby courses ⛳</div>'; window._coursesLoading=false; return; }

      // ── 2. 24-hour cache (longer = faster repeat loads) ────────────
      const ck = 'gc2_'+Math.round(lat*10)/10+'_'+Math.round(lon*10)/10;
      try {
        const cd=sessionStorage.getItem(ck);
        if(cd){const p=JSON.parse(cd); if(p.ts&&Date.now()-p.ts<86400000&&p.data?.length>0){
          window._nearbyCourses=p.data; UI.filterCourses('');
          if(label)label.textContent=p.data.length+' golf courses found';
          window._coursesLoading=false; return;
        }}
      } catch(_) {}

      // ── 3. Skeleton ────────────────────────────────────────────────
      if(label) label.textContent='Finding courses near you…';
      container.innerHTML=Array(4).fill(0).map(()=>
        '<div class="course-card" style="opacity:.3"><div class="course-card-top"><div style="flex:1">'+
        '<div style="height:16px;background:var(--border);border-radius:4px;width:60%;margin-bottom:8px"></div>'+
        '<div style="height:11px;background:var(--border);border-radius:4px;width:35%"></div>'+
        '</div><div style="font-size:20px">⛳</div></div></div>'
      ).join('');

      // ── 4. Inject KNOWN courses immediately (zero wait) ────────────
      const seen=new Set(), norm=n=>n.toLowerCase().replace(/[^a-z0-9]/g,'');
      let courses=[];
      const KNOWN_COURSES=[
          {name:'Heritage Harbor Golf & Country Club',lat:28.1372,lon:-82.5012},
          {name:'TPC Tampa Bay',lat:28.1673,lon:-82.5123},
          {name:'Northdale Golf & Tennis Club',lat:28.1018,lon:-82.5223},
          {name:'Babe Zaharias Golf Course',lat:28.0267,lon:-82.4334},
          {name:'Rogers Park Golf Course',lat:28.0341,lon:-82.4445},
          {name:'Rocky Point Golf Course',lat:27.9658,lon:-82.5732},
          {name:'Innisbrook Resort Copperhead',lat:28.1278,lon:-82.7342},
          {name:'Saddlebrook Resort Golf',lat:28.2195,lon:-82.3878},
          {name:'Bloomingdale Golfers Club',lat:27.8612,lon:-82.2734},
          {name:'Celebration Golf Club',lat:28.3201,lon:-81.5478},
          {name:'Arnold Palmers Bay Hill Club',lat:28.4534,lon:-81.5089},
          {name:'Orange County National Golf Center',lat:28.6012,lon:-81.5445},
        ];
      KNOWN_COURSES.forEach(k=>{
        const d=_haversine(lat,lon,k.lat,k.lon);
        if(d<30){const key=norm(k.name); if(!seen.has(key)){seen.add(key);courses.push({...k,dist:d});}}
      });
      courses.sort((a,b)=>a.dist-b.dist);
      if(courses.length){
        window._nearbyCourses=courses; UI.filterCourses('');
        if(label)label.textContent='Loading more courses…';
      }

      // ── 5. OSM Overpass — geo-search for courses within radius ──────
      const radius = Math.round((parseFloat(document.getElementById('dist-filter')?.value || '25') || 25) * 1609.34);
      const q='[out:json][timeout:25];('+
        'way["leisure"="golf_course"](around:'+radius+','+lat+','+lon+');'+
        'relation["leisure"="golf_course"](around:'+radius+','+lat+','+lon+');'+
        'way["amenity"="golf_course"]["name"](around:'+radius+','+lat+','+lon+');'+
        ');out center tags;';

      const mirrors=[
        'https://overpass-api.de/api/interpreter',
        'https://overpass.private.coffee/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
      ];
      // Race all mirrors with a hard 8s total timeout — non-blocking
      let txt1=null;
      try {
        const tryMirror = async (mirror) => {
          const ctrl=new AbortController();
          const t=setTimeout(()=>ctrl.abort(),6000);
          try{
            const r=await fetch(mirror+'?data='+encodeURIComponent(q),{signal:ctrl.signal,headers:{'Accept':'application/json'}});
            clearTimeout(t);
            if(!r.ok||r.status===429) return null;
            const txt=await r.text();
            return (txt&&!txt.trim().startsWith('<'))?txt:null;
          }catch(e){clearTimeout(t);return null;}
        };
        // Race: first successful result wins, total cap 8s
        const raceResult = await Promise.race([
          Promise.any(mirrors.map(m=>tryMirror(m).then(t=>t||Promise.reject()))).catch(()=>null),
          new Promise(res=>setTimeout(()=>res(null),8000)),
        ]);
        txt1 = raceResult;
      } catch(e) { txt1=null; }

      // ── 5b. GolfCourseAPI city fallback if Overpass failed ──────────────
      if (!txt1) {
        try {
          const _cityFull = (myProfile.city || window._weatherCity || '');
          const _cityQ    = _cityFull.split(',')[0].trim();
          const _stateQ   = _cityFull.split(',')[1]?.trim() || '';
          if (_cityQ) {
            // Single smart search — city name gives best locality results
            // Use city+state for specificity to avoid 429 on multiple calls
            const _searchQ = _stateQ ? `${_cityQ} ${_stateQ}` : _cityQ;
            const _gcFbResp = await fetch(
              `https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(_searchQ)}`,
              { headers:{'Authorization':'Key Q4EAEMMFI54TY4HEA62GEOH3BI'}, signal:AbortSignal.timeout(6000) }
            ).catch(()=>null);
            const _gcFbData = _gcFbResp?.ok ? await _gcFbResp.json().catch(()=>null) : null;

            const _addCourse = (c) => {
              const cLat=c.location?.latitude, cLon=c.location?.longitude;
              if (!cLat || !cLon) return;
              const _distMi = _haversine(lat, lon, cLat, cLon);
              const _radiusMi = parseFloat(document.getElementById('dist-filter')?.value||100);
              if (_distMi > _radiusMi) return;
              const name = (c.club_name || c.course_name || 'Golf Course').replace(/\s*\(\d+\)\s*$/, '').trim();
              const key  = norm(name);
              if (seen.has(key)) return;
              seen.add(key);
              const tee  = c.tees?.male?.[0] || c.tees?.female?.[0];
              courses.push({
                name,
                holes:   tee?.number_of_holes || 18,
                phone:   c.location?.phone    || null,
                website: c.website            || null,
                addr:    [c.location?.address, c.location?.city, c.location?.state].filter(Boolean).join(', '),
                type:    'Golf Course',
                dist:    _distMi,
                lat: cLat, lon: cLon,
                rating:  tee?.course_rating   || null,
                slope:   tee?.slope_rating    || null,
                par:     tee?.par_total       || null,
              });
            };

            for (const c of _gcFbData?.courses || []) _addCourse(c);

            // If city search returns <5, try broader state search
            if (courses.length < 5 && _stateQ) {
              await new Promise(r=>setTimeout(r,300)); // small delay to avoid 429
              const _gcFb2 = await fetch(
                `https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(_stateQ+' golf')}`,
                { headers:{'Authorization':'Key Q4EAEMMFI54TY4HEA62GEOH3BI'}, signal:AbortSignal.timeout(6000) }
              ).catch(()=>null);
              const _gcFb2Data = _gcFb2?.ok ? await _gcFb2.json().catch(()=>null) : null;
              for (const c of _gcFb2Data?.courses || []) _addCourse(c);
            }

            if (courses.length > 0) {
              console.log(`Discover: GolfCourseAPI fallback found ${courses.length} courses for "${_cityQ}"`);
            }
          }
        } catch(e) { console.warn('Discover: GolfCourseAPI fallback failed:', e.message); }
      }

      // ── 5c. Google Places Nearby Search — additional course discovery ────────
      if (window._googlePlacesKey) {
        try {
          const _gpRadius = Math.min(50000, Math.round((parseFloat(document.getElementById('dist-filter')?.value||25)) * 1609.34));
          const _gpTypes  = ['golf_course', 'country_club'];
          for (const _gpType of _gpTypes) {
            const _gpUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=${_gpRadius}&type=${_gpType}&key=${window._googlePlacesKey}`;
            const _gpResp = await fetch(_gpUrl).catch(()=>null);
            if (!_gpResp?.ok) continue;
            const _gpData = await _gpResp.json().catch(()=>null);
            for (const place of _gpData?.results||[]) {
              const pLat = place.geometry?.location?.lat;
              const pLon = place.geometry?.location?.lng;
              if (!pLat || !pLon) continue;
              const name  = place.name || 'Golf Course';
              const key   = norm(name);
              if (seen.has(key)) continue;
              seen.add(key);
              const distMi = _haversine(lat, lon, pLat, pLon);
              const radiusMi = parseFloat(document.getElementById('dist-filter')?.value||100);
              if (distMi > radiusMi) continue;
              courses.push({
                name,
                dist:    distMi,
                lat:     pLat,
                lon:     pLon,
                addr:    place.vicinity || '',
                type:    _gpType === 'country_club' ? 'Country Club' : 'Golf Course',
                holes:   null,
                phone:   null,
                website: null,
                rating:  place.rating || null,
                slope:   null,
                par:     null,
                googlePlaceId: place.place_id,
              });
            }
          }
          if (courses.length > 0) console.log(`Discover: Google Places added courses, total=${courses.length}`);
        } catch(e) { console.warn('Discover: Google Places failed:', e.message); }
      }

      // ── Step 7: txt1 Overpass processing ────────────────────────────
      if (txt1) {
        const parsed = (JSON.parse(txt1).elements || []);
        const norm2 = s => (s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
        const haversine2 = (a,b,c,d) => { const R=3958.8,dr=Math.PI/180,dLat=(c-a)*dr,dLon=(d-b)*dr,x=Math.sin(dLat/2)**2+Math.cos(a*dr)*Math.cos(c*dr)*Math.sin(dLon/2)**2; return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x)); };
        for (const el of parsed) {
          const name = el.tags?.name || el.tags?.['name:en'];
          if (!name) continue;
          const cLat = el.center?.lat || el.lat;
          const cLon = el.center?.lon || el.lon;
          if (!cLat || !cLon) continue;
          const key = norm2(name);
          if (seen.has(key)) continue;
          seen.add(key);
          const dist = haversine2(lat, lon, cLat, cLon);
          courses.push({
            name, dist, lat: cLat, lon: cLon,
            type: el.tags?.leisure || el.tags?.amenity || 'Golf Course',
            holes: null, phone: el.tags?.phone || null,
            website: el.tags?.website || null,
            addr: [el.tags?.['addr:street'], el.tags?.['addr:city'], el.tags?.['addr:state']].filter(Boolean).join(', '),
          });
        }
        // ── Step 6: GolfCourseAPI enrichment (only when Overpass worked) ──
        const _enrichKey = 'Q4EAEMMFI54TY4HEA62GEOH3BI';
        await Promise.allSettled(courses.slice(0,12).map(async (c) => {
          try {
            const r = await fetch(
              `https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(c.name.replace(/\s*\(\d+\)\s*$/, ''))}`,
              { headers: {'Authorization': `Key ${_enrichKey}`}, signal: AbortSignal.timeout(4000) }
            );
            if (!r.ok) return;
            const d = await r.json();
            const match = d.courses?.find(x => norm2(x.club_name||'').includes(norm2(c.name.split(' ').slice(0,2).join(' '))));
            if (match) {
              const tee = match.tees?.male?.[0] || match.tees?.female?.[0];
              if (tee?.par_total)     c.par    = tee.par_total;
              if (tee?.slope_rating)  c.slope  = tee.slope_rating;
              if (tee?.course_rating) c.rating = tee.course_rating;
              if (!c.phone   && match.location?.phone)   c.phone   = match.location.phone;
              if (!c.website && match.website)            c.website = match.website;
            }
          } catch(_) {}
        }));
      } // end if(txt1)

      // ── Step 8: Filter, sort, dedupe, persist ──────────────────────
      const radiusMi2 = parseFloat(document.getElementById('dist-filter')?.value || 100);
      courses = courses.filter(c => c.dist <= radiusMi2);
      courses.sort((a,b) => (a.dist||999)-(b.dist||999));

      window._nearbyCourses = courses;
      window._lastFetchedMiles = radiusMi2;
      window._lastDiscoverCity = myProfile?.city || window._weatherCity || '';
      UI.filterCourses('');
      if (label) label.textContent = courses.length
        ? `${courses.length} courses within ${radiusMi2} mi`
        : 'No courses found — try a larger radius';

      // Cache to sessionStorage
      try {
        const cKey = 'gc_' + (window._wxLat||0).toFixed(2) + '_' + (window._wxLon||0).toFixed(2);
        sessionStorage.setItem(cKey, JSON.stringify({data:courses, ts:Date.now()}));
      } catch(_) {}

    } catch(e) {
      console.error('courses error:', e.message);
      if (label) label.textContent = 'Error loading courses';
    } finally {
      window._coursesLoading = false;
    }
  },

  filterCourses(query) {
    const courses  = window._nearbyCourses || [];
    const q        = (query||'').toLowerCase();
    const maxDist  = parseFloat(document.getElementById('dist-filter')?.value||100);
    const label    = document.getElementById('courses-radius-label');
    const container = document.getElementById('courses-list');

    let filtered = courses.filter(c => {
      if (maxDist < 100 && (c.dist||999) > maxDist) return false;
      if (!q) return true;
      return (c.name||'').toLowerCase().includes(q) || (c.addr||'').toLowerCase().includes(q);
    });

    const total    = courses.filter(c => maxDist >= 100 || (c.dist||999) <= maxDist).length;
    const distText = maxDist >= 100 ? '100 mi' : maxDist + ' mi';

    if (label) {
      label.textContent = filtered.length === total
        ? `${total} courses within ${distText}`
        : `${filtered.length} of ${total} courses within ${distText}`;
    }

    if (!container) return;
    if (!filtered.length) {
      container.innerHTML = `<div class="empty-state" style="padding:32px 20px;text-align:center">
        <div style="font-size:40px;margin-bottom:12px">⛳</div>
        <div style="font-weight:600;margin-bottom:8px;color:var(--text)">No courses found</div>
        <div style="color:var(--muted);font-size:14px">Try expanding the radius or changing your city in Profile</div>
      </div>`;
      return;
    }

    const norm2 = s => (s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    const isPrivate = c => {
      const n = norm2(c.name);
      return n.includes('country') || n.includes('private') || c.type==='Country Club';
    };

    container.innerHTML = filtered.map(c => {
      const distStr  = c.dist != null ? `${c.dist.toFixed(1)} mi away` : '';
      const holesStr = c.holes ? ` · ${c.holes} holes` : '';
      const parStr   = c.par   ? ` · Par ${c.par}` : '';
      const slopeStr = c.slope ? ` · Slope ${c.slope}` : '';
      const mapsUrl  = `https://maps.google.com/?q=${encodeURIComponent(c.name + ' golf course')}`;

      // Booking URL
      const bookBase = c.website || `https://www.golfnow.com/search#misc=radius&centerLat=${c.lat}&centerLon=${c.lon}&facilityName=${encodeURIComponent(c.name)}`;
      const bookUrl  = isPrivate(c) && !c.website ? mapsUrl : bookBase;
      const bookLabel = isPrivate(c) && !c.website ? '🌐 Website' : '🗓 Find tee times';
      const teeOffUrl = `https://www.teeoff.com/courses?search=${encodeURIComponent(c.name)}`;

      const infoStr    = [parStr, slopeStr].filter(Boolean).join('');
      const ratingStr  = c.rating ? ` · ⭐ ${c.rating}` : '';

      return `<div class="course-card">
        <div class="course-card-top">
          <div style="flex:1">
            <div class="course-name">${c.name}</div>
            <div class="course-meta">${distStr}${holesStr}${infoStr}${ratingStr}${c.addr ? ' · ' + c.addr : ''}</div>
          </div>
          <span style="font-size:22px">${isPrivate(c) ? '🏌️' : '⛳'}</span>
        </div>
        <div class="course-actions">
          <button class="course-btn course-btn-gps"
            data-cname="${c.name}" data-clat="${c.lat||''}" data-clon="${c.lon||''}"
            onclick="safeUI('launchGpsForCourse',this.dataset.cname,this.dataset.clat,this.dataset.clon)"
            style="background:var(--green);color:#fff;border:none;font-size:12px;font-weight:600;
            cursor:pointer;font-family:inherit;white-space:nowrap">
            ▶ Play GPS
          </button>
          <a href="${bookUrl}" target="_blank" rel="noopener" class="course-btn course-btn-tee">${bookLabel}</a>
          <a href="${mapsUrl}" target="_blank" rel="noopener" class="course-btn course-btn-map">📍 Directions</a>
          ${!isPrivate(c) ? `<a href="${teeOffUrl}" target="_blank" rel="noopener" class="course-btn"><img src="https://www.teeoff.com/favicon.ico" style="width:12px;height:12px;vertical-align:middle;margin-right:3px" onerror="this.style.display='none'">TeeOff</a>` : ''}
          ${c.phone ? `<a href="tel:${c.phone}" class="course-btn">📞 Call</a>` : ''}
          ${c.website ? `<a href="${c.website}" target="_blank" rel="noopener" class="course-btn">🌐 Website</a>` : ''}
        </div>
      </div>`;
    }).join('');
  },

  bookTeeTime(name, website) {
    if (website && website.trim()) {
      window.open(website, '_blank', 'noopener,noreferrer');
    } else {
      const url = `https://www.golfnow.com/search#misc=radius&facilityName=${encodeURIComponent(name)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  },

  postTeeTimeAtCourse(courseName) {
    safeUI('bookTeeTime', courseName, '');
  },

  filterPlayers(q) {
    const vibeFilter = window._activeVibeFilter || '';
    const milesFilter = parseFloat(document.getElementById('miles-filter')?.value || 9999);
    filterPlayers(q, vibeFilter, milesFilter);
  },

  setPlayerVibeFilter(vibe) {
    window._activeVibeFilter = (window._activeVibeFilter === vibe) ? '' : vibe;
    document.querySelectorAll('.vibe-filter-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.vibe === window._activeVibeFilter);
    });
    this.applyPlayerFilters();
  },

  applyPlayerFilters() {
    const q = document.getElementById('player-search')?.value || '';
    const vibe = window._activeVibeFilter || '';
    const miles = parseFloat(document.getElementById('miles-filter')?.value || 9999);
    filterPlayers(q, vibe, miles);
  },

  async handleSaveRound() {
    const courseName = document.getElementById('sc-course-input')?.value?.trim()
      || window._pendingGpsCourse || '';
    await saveRound(courseName);
  },

  // ── Course Layout ──────────────────────────────────────────────
  async launchGpsForCourse(courseName, latStr, lonStr) {
    const lat = parseFloat(latStr) || window._wxLat;
    const lon = parseFloat(lonStr) || window._wxLon;
    if (!lat) { showToast('Set your location in profile to use GPS'); return; }
    const scInp = document.getElementById('sc-course-input');
    if (scInp) scInp.value = courseName;
    window._pendingGpsCourse = courseName;
    window._pendingGpsLat    = lat;
    window._pendingGpsLon    = lon;
    safeUI('goScreen','scorecard');
    await new Promise(r => setTimeout(r, 400));
    const body = document.getElementById('gps-body');
    if (body) body.style.display = 'block';
    window._pendingGpsCourse = courseName;
    safeUI('startGpsTracking');
    showToast(`▶ GPS started for ${courseName}`);
  },

  async openCourseLayoutScreen() {
    const courseName = document.getElementById('sc-course-input')?.value?.trim()
      || window.myProfile?.homeCourse || '';
    const cLat = window._pendingGpsLat || window._wxLat;
    const cLon = window._pendingGpsLon || window._wxLon;
    if (!cLat) { showToast('Set your city in profile to use course layout'); return; }
    await openCourseLayout(courseName, cLat, cLon);
  },

  closeCourseLayout() {
    closeCourseLayout();
    const origin = window._courseLayoutOrigin || 'scorecard';
    safeUI('goScreen', origin);
  },

  selectLayoutHole(h) { selectLayoutHole(parseInt(h)); },

  toggleCourseLayoutGPS() {
    if (gpsIsActive) {
      stopGpsRound();
      document.getElementById('gps-status-dot')?.style && (document.getElementById('gps-status-dot').style.background = 'var(--border)');
      showToast('GPS tracking stopped');
    } else {
      safeUI('startGpsTracking');
    }
  },

  // ── GPS Tracking ───────────────────────────────────────────────
  async startGpsTracking() {
    const courseName = window._pendingGpsCourse
      || document.getElementById('sc-course-input')?.value?.trim() || '';
    if (gpsIsActive) {
      stopGpsRound();
      document.getElementById('gps-status-dot')?.style && (document.getElementById('gps-status-dot').style.background = 'var(--border)');
      document.getElementById('gps-start-btn') && (document.getElementById('gps-start-btn').textContent = '▶ Start');
      showToast('GPS tracking stopped');
      return;
    }
    const cLat = window._pendingGpsLat || window._wxLat;
    const cLon = window._pendingGpsLon || window._wxLon;
    if (!cLat) { showToast('Set your location in profile to use GPS tracking'); return; }

    if (!document.getElementById('gps-pulse-style')) {
      const st = document.createElement('style');
      st.id = 'gps-pulse-style';
      st.textContent = '@keyframes gpsPulse{0%,100%{opacity:1}50%{opacity:.4}}';
      document.head.appendChild(st);
    }
    await startGpsRound(courseName, cLat, cLon, ({ hole, holes, pos, distToPin }) => {
      const dot  = document.getElementById('gps-status-dot');
      const hEl  = document.getElementById('gps-hole');
      const dEl  = document.getElementById('gps-dist');
      const hBig = document.getElementById('gps-hole-big');
      const dBig = document.getElementById('gps-dist-big');
      const curHole = holes?.[hole-1];
      if (dot) { dot.style.background = '#22c55e'; dot.style.animation = 'gpsPulse 1.5s infinite'; }
      if (hEl)  hEl.textContent  = `Hole ${hole}`;
      if (hBig) hBig.textContent = hole;
      if (distToPin != null) {
        const ft = Math.round(distToPin);
        const yd = Math.round(ft / 3);
        if (dEl)  dEl.textContent  = `${yd}yd`;
        if (dBig) dBig.textContent = `${yd}yd`;
      }
    });
  },

  logGpsShot() {
    const shot = logShot();
    if (!shot) return;
    const strip = document.getElementById('gps-shots-strip');
    if (!strip) return;
    const chip = document.createElement('span');
    chip.className = 'gps-shot-chip';
    chip.textContent = `🏌️ H${shot.hole}`;
    chip.title = `Hole ${shot.hole} shot`;
    chip.style.cssText = 'display:inline-block;padding:4px 8px;border-radius:20px;font-size:11px;font-weight:600;background:var(--green);color:#fff;margin:2px';
    strip.appendChild(chip);
    showToast('Shot logged ✅');
  },

  nextGpsHole() { nextHole(); },
  prevGpsHole() { prevHole(); },

  newRound() {
    resetScores();
    buildScoreTable();
    showToast('Scorecard cleared ✅');
  },

  setGame(el, game) {
    document.querySelectorAll('.game-mode-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    setGameMode(game);
    buildGamePanel();
  },

  toggleChip(el) { toggleChip(el); },
};

// ── Expose safeUI ─────────────────────────────────────────────────────────────
window.safeUI = function(action, ...args) {
  if (!action) return;
  if (typeof UI[action] === 'function') {
    try { UI[action](...args); } catch(e) { console.error('[FW]', action, e.message); }
  } else if (action === 'goScreen') {
    try { goScreen(args[0]); } catch(e) { console.error('[FW] goScreen', e.message); }
  } else {
    console.warn('[FW] Unknown safeUI action:', action);
  }
};

// ── Game panel HTML templates ────────────────────────────────────────────────
const GAME_PANELS = {
  stroke: ``,
  bingo: `<div class="game-card"><div class="game-card-title"><span>🎯</span>Bingo Bango Bongo</div>
    <div class="game-info">Three points per hole — <strong>Bingo</strong>: first on the green · <strong>Bango</strong>: closest to pin once all are on · <strong>Bongo</strong>: first to hole out.</div></div>`,
  scramble: `<div class="game-card"><div class="game-card-title"><span>🤝</span>Scramble</div>
    <div class="game-info">All players tee off — best shot selected, everyone plays from there. Repeat until holed.</div></div>`,
  match: `<div class="game-card"><div class="game-card-title"><span>⚔️</span>Match play</div>
    <div class="game-info">Win the hole, win a point. Leading by more holes than remain wins the match. Ties halved.</div></div>`,
  skins: `<div class="game-card"><div class="game-card-title"><span>💀</span>Skins</div>
    <div class="game-info">Each hole is worth a "skin". Win the hole outright to take the skin. Ties carry over — skins accumulate until someone wins a hole outright.</div></div>`,
  bestball: `<div class="game-card"><div class="game-card-title"><span>🎱</span>Best ball — 2v2</div>
    <div class="game-info">Each player plays their own ball. Lowest score on your team counts per hole.</div></div>`,
  nassau: `<div class="game-card"><div class="game-card-title"><span>💰</span>Nassau</div>
    <div class="game-info">Three bets: front 9, back 9, and overall 18. Classic $5 each = $15 total at stake.</div>
    <div class="nassau-grid">
      <div class="nassau-cell"><div class="nassau-cell-label">Front 9</div><div class="nassau-cell-val">—</div></div>
      <div class="nassau-cell"><div class="nassau-cell-label">Back 9</div><div class="nassau-cell-val">—</div></div>
      <div class="nassau-cell"><div class="nassau-cell-label">Overall</div><div class="nassau-cell-val">—</div></div>
    </div></div>`,
};

function showFormError(form, msg) {
  const el = form?.querySelector?.('.form-error') || document.getElementById('form-error');
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
  }
}

// ── Boot ─────────────────────────────────────────────────────────────────────
// Load Google Places API key from localStorage if set
window._googlePlacesKey = localStorage.getItem('fw_google_places_key') || '';
initAuth();

// ── Global error handler ──────────────────────────────────────────────────────
window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason?.message || String(e.reason) || '';
  if (msg.includes('QuotaExceeded') || msg.includes('network') || msg.includes('WebChannel')) return;
  console.error('[FW]', msg);
  if (msg.includes('permission-denied')) showToast('Permission denied — try signing out and back in');
});
