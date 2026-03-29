// ============================================================
//  FAIRWAY FRIEND — Main App Entry Point
// ============================================================

import { initAuth, setListenersActive, doLogin, doSignup, doSignOut, friendlyError } from "./auth.js";
import { saveVibes, saveOnboardingData, saveProfileData, updateProfileUI, uploadProfilePhoto, myProfile } from "./profile.js";
import { initFeed, initNearbyPlayers, submitPost, openTeeSheet, filterPlayers, toggleFollow, deletePost } from "./feed.js";
import { buildScoreTable, onScoreChange, saveRound, loadRoundHistory, resetScores } from "./scorecard.js";
import { goScreen, showToast, toggleChip } from "./ui.js";
import { loadWeather, loadWeatherForCity, loadRoundDayForecast, startLocationWatch, stopLocationWatch } from "./weather.js";
import { listenToConversations, renderConversationsList, getOrCreateConversation,
         listenToMessages, renderMessages, sendMessage, stopListeningMessages,
         teardownMessaging } from "./messages.js";
import { loadUserActivity, renderActivity, deleteActivityItem, toggleHideItem } from "./activity.js";

// ── Expose all UI actions to inline HTML onclick handlers ──
window.UI = {

  // ── Navigation ──
  goScreen(name) {
    goScreen(name);
    if (name === "scorecard") {
      buildScoreTable();
      document.getElementById("game-panel").innerHTML = "";
      document.querySelectorAll(".game-pill").forEach((p, i) => p.classList.toggle("active", i === 0));
      loadRoundHistory();
      // Set default date to today and load forecast
      const dateInput = document.getElementById("sc-round-date");
      const timeInput = document.getElementById("sc-round-time");
      if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split("T")[0];
      }
      if (timeInput && !timeInput.value) {
        timeInput.value = "08:00";
      }
      UI.loadScorecardWeather();
    }
    if (name === "profile")      { updateProfileUI(); UI.loadProfileActivity(); }
    if (name === "feed")         { UI.refreshWeather(); startLocationWatch(); }
    if (name === "edit-profile") UI.goToEditProfile();
    if (name === "messages")     UI.loadConversations();
    if (name === "my-activity")  UI.loadFullActivity();
    if (name === "conversation") {} // handled by openConversation
    // Show/hide bottom nav based on screen type
    const noBottomNav = ["auth","onboard","vibes","edit-profile","conversation","my-activity"];
    const bottomNav   = document.getElementById("bottom-nav");
    if (bottomNav) {
      bottomNav.style.display = noBottomNav.includes(name) ? "none" : "flex";
    }
  },

  // ── Weather ──
  refreshWeather() {
    // Use city from profile — geocodes to lat/lon automatically
    const city = window._weatherCity || myProfile.city || "";
    loadWeather(city);
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
    if (elCourse) elCourse.value = p.homeCourse || "";
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
    const handicap  = parseInt(document.getElementById("edit-hdcp")?.value) || 18;
    const errEl     = document.getElementById("edit-profile-error");

    // City is required; state is strongly recommended but not blocked
    if (!cityRaw) {
      if (errEl) { errEl.textContent = "City is required."; errEl.style.display = "block"; }
      return;
    }
    if (errEl) errEl.style.display = "none";

    // Build city string — include state if provided
    const city = stateRaw ? `${cityRaw}, ${stateRaw}` : cityRaw;
    const btn  = document.getElementById("save-profile-btn");
    if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }

    try {
      // Make sure user is still signed in
      if (!window._currentUser) {
        throw new Error("Not signed in. Please sign in again.");
      }
      await saveProfileData({ bio, city, homeCourse, handicap });
      showToast("Profile saved! ✅");
      window._weatherCity = city;
      // Refresh weather with new location
      if (window._userLat && window._userLon) {
        // Clear cached GPS so it geocodes the new city
        window._userLat = null;
        window._userLon = null;
      }
      UI.refreshWeather();
      goScreen("profile");
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
    listenToConversations((convs) => {
      renderConversationsList(convs, "conversations-list");
    });
    // update avatar
    const av = document.getElementById("msg-avatar");
    if (av) {
      const { initials, avatarColor } = await import("./ui.js");
      av.textContent = initials(myProfile.displayName);
      av.className   = "avatar-sm " + avatarColor(myProfile.uid || "");
    }
  },

  async openConversation(convId, otherUid, otherName) {
    document.getElementById("conv-header-name").textContent = otherName;
    goScreen("conversation");
    listenToMessages(convId, (msgs) => {
      renderMessages(msgs, "messages-thread");
    });
    // store current conv id for send
    window._activeConvId = convId;
  },

  async startConversation(otherUid, otherName) {
    const cid = await getOrCreateConversation(otherUid, otherName);
    if (!cid) return;
    UI.openConversation(cid, otherUid, otherName);
  },

  async sendMsg() {
    const input = document.getElementById("msg-input");
    const text  = input?.value?.trim();
    const cid   = window._activeConvId;
    if (!text || !cid) return;
    input.value = "";
    input.style.height = "auto";
    try {
      await sendMessage(cid, text);
    } catch (e) {
      showToast("Could not send message");
    }
  },

  // ── Auth tab switch ──
  switchAuthTab(tab) {
    document.querySelectorAll(".auth-tab").forEach((t, i) =>
      t.classList.toggle("active", (i === 0 && tab === "login") || (i === 1 && tab === "signup"))
    );
    document.getElementById("form-login").classList.toggle("hidden",  tab !== "login");
    document.getElementById("form-signup").classList.toggle("hidden", tab !== "signup");
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
    const first = document.getElementById("signup-first").value.trim();
    const last  = document.getElementById("signup-last").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const pass  = document.getElementById("signup-password").value;
    const btn   = document.getElementById("signup-btn");
    if (!first || !email || !pass) { showFormError("signup", "Please fill in all required fields."); return; }
    if (pass.length < 6) { showFormError("signup", "Password must be at least 6 characters."); return; }
    btn.disabled = true; btn.textContent = "Creating account…";
    try {
      await doSignup(first, last, email, pass);
      // auth state change fires → onboard screen shown by auth.js
    } catch (e) {
      btn.disabled = false; btn.textContent = "Create account";
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
      if (!city || !state) {
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

  // ── Players ──
  filterPlayers(q) {
    filterPlayers(q);
  },

  // ── Scorecard ──
  async handleSaveRound() {
    // FIX: read course name from the input field, not a missing element
    const courseInput = document.getElementById("sc-course-input");
    const courseName  = courseInput ? courseInput.value.trim() || "Unknown course" : "Unknown course";
    await saveRound(courseName);
  },

  // FIX: reset scores so a new round starts clean
  newRound() {
    resetScores();
    buildScoreTable();
    showToast("Scorecard cleared ✅");
  },

  setGame(el, game) {
    document.querySelectorAll(".game-pill").forEach((p) => p.classList.remove("active"));
    el.classList.add("active");
    const panel = document.getElementById("game-panel");
    if (panel) panel.innerHTML = GAME_PANELS[game] || "";
  },

  toggleChip(el) {
    toggleChip(el);
  },
};

// ── Expose callbacks used inside dynamically-rendered HTML ──
window._openTeeSheet  = (id)       => openTeeSheet(id);
window._toggleFollow  = (btn, uid) => toggleFollow(btn, uid);
window._onScoreChange = (inp)      => onScoreChange(inp);
window.deletePost     = (id)       => deletePost(id);

// ── Game panel HTML templates ──
const GAME_PANELS = {
  stroke: ``,
  bingo: `<div class="game-card">
    <div class="game-card-title"><span>🎯</span>Bingo Bango Bongo</div>
    <div class="game-info">Three points per hole —
      <strong style="color:var(--text)">Bingo</strong>: first on the green ·
      <strong style="color:var(--text)">Bango</strong>: closest to pin once all are on ·
      <strong style="color:var(--text)">Bongo</strong>: first to hole out.
    </div></div>`,
  scramble: `<div class="game-card">
    <div class="game-card-title"><span>🤝</span>Scramble</div>
    <div class="game-info">All players tee off — best shot selected, everyone plays from there. Repeat until holed.</div>
    </div>`,
  match: `<div class="game-card">
    <div class="game-card-title"><span>⚔️</span>Match play</div>
    <div class="game-info">Win the hole, win a point. Leading by more holes than remain wins the match. Ties halved.</div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:0.5px solid var(--border)">
      <span style="font-size:13px;font-weight:500;color:var(--text)">You</span>
      <span style="font-size:18px;font-weight:500;color:var(--green-dark)">All Square</span>
      <span style="font-size:13px;font-weight:500;color:var(--muted)">Opponent</span>
    </div></div>`,
  bestball: `<div class="game-card">
    <div class="game-card-title"><span>🎱</span>Best ball — 2v2</div>
    <div class="game-info">Each player plays their own ball. Lowest score on your team counts per hole.</div>
    </div>`,
  nassau: `<div class="game-card">
    <div class="game-card-title"><span>💰</span>Nassau</div>
    <div class="game-info">Three bets: front 9, back 9, and overall 18. Classic $5 each = $15 total at stake.</div>
    <div class="nassau-grid">
      <div class="nassau-cell"><div class="nassau-cell-label">Front 9</div><div class="nassau-cell-val">—</div></div>
      <div class="nassau-cell"><div class="nassau-cell-label">Back 9</div><div class="nassau-cell-val">—</div></div>
      <div class="nassau-cell"><div class="nassau-cell-label">Overall</div><div class="nassau-cell-val">—</div></div>
    </div></div>`,
};

function showFormError(form, msg) {
  const el = document.getElementById(form + "-error");
  if (el) { el.textContent = msg; el.style.display = "block"; }
}

// ── Boot ──
initAuth();
// cache-bust Sat Mar 28 21:22:07 EDT 2026
