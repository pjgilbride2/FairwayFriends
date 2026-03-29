// ============================================================
//  FAIRWAY FRIEND — Main App Entry Point
// ============================================================

import { initAuth, setListenersActive, doLogin, doSignup, doSignOut, friendlyError } from "./auth.js?v=22";
import { saveVibes, saveOnboardingData, saveProfileData, updateProfileUI, uploadProfilePhoto, myProfile } from "./profile.js?v=22";
import { initFeed, initNearbyPlayers, submitPost, openTeeSheet, filterPlayers, toggleFollow, deletePost, toggleLike, submitReply, loadReplies } from "./feed.js?v=22";
import { buildScoreTable, onScoreChange, saveRound, loadRoundHistory, resetScores, buildGamePanel, setGameMode, updateTotals, MODES } from "./scorecard.js?v=22";
import { goScreen, showToast, toggleChip } from "./ui.js?v=22";
import { loadWeather, loadWeatherForCity, loadRoundDayForecast, startLocationWatch, stopLocationWatch } from "./weather.js?v=22";
import { listenToConversations, renderConversationsList, getOrCreateConversation, createGroupConversation,
         listenToMessages, renderMessages, sendMessage, stopListeningMessages,
         teardownMessaging } from "./messages.js?v=22";
import { loadUserActivity, renderActivity, deleteActivityItem, toggleHideItem } from "./activity.js?v=22";
import { initNotifications, teardownNotifications, markAllNotifsRead, openNotif, loadNotificationsScreen, markConversationRead, createNotification } from "./notifications.js?v=22";


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
      "vibes","messages","conversation","my-activity","auth","onboard","notifications"];
    if(name && !VALID_SCREENS.includes(name)) { console.warn("Invalid screen:", name); return; }
    goScreen(name);
    if (name === "scorecard") {
      buildGamePanel();
      buildScoreTable();
      loadRoundHistory();
      const dateInput = document.getElementById("sc-round-date");
      const timeInput = document.getElementById("sc-round-time");
      if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split("T")[0];
      if (timeInput && !timeInput.value) timeInput.value = "08:00";
      UI.loadScorecardWeather();
    }
    if (name === "profile")      { updateProfileUI(); UI.loadProfileActivity(); }
    if (name === "notifications") { updateProfileUI(); loadNotificationsScreen(); }
    if (name === "feed")         { updateProfileUI(); UI.refreshWeather(); startLocationWatch(); }
    if (name === "search") {
      updateProfileUI();
      // If city changed since last load, clear cache and reload
      const currentCity = window._weatherCity || '';
      if (window._lastCourseCity && window._lastCourseCity !== currentCity) {
        try { Object.keys(sessionStorage).filter(k=>k.startsWith('gc_')).forEach(k=>sessionStorage.removeItem(k)); } catch(_){}
        window._nearbyCourses = null;
        window._coursesLoading = false;
      }
      window._lastCourseCity = currentCity;
      UI.loadNearbyCourses();
    }
    if (name === "edit-profile") UI.goToEditProfile();
    if (name === "messages")     { updateProfileUI(); UI.loadConversations(); }
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
    const city = window._weatherCity || myProfile.city || "";
    loadWeather(city);
  },

  markAllNotifsRead() {
    markAllNotifsRead(window._currentUser?.uid);
  },

  openNotif(id, type, refId) {
    openNotif(id, type, refId);
  },

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
    listenToConversations((convs) => {
      renderConversationsList(convs, "conversations-list");
    });
    // Update avatar
    const av = document.getElementById("msg-avatar");
    if (av) {
      const { initials, avatarColor } = await import("./ui.js?v=22");
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
    // Show member count badge for groups
    const sub = document.getElementById("conv-header-sub");
    if (sub) {
      if (isGroup) {
        const snap = await (async()=>{ try{ const {getDoc,doc,getFirestore}=await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"); const {getApp}=await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"); const d=await getDoc(doc(getFirestore(getApp()),"conversations",convId)); return d.data(); }catch{return null;} })();
        sub.textContent = snap ? `${(snap.participants||[]).length} members` : "Group";
        sub.style.display = "";
      } else { sub.style.display = "none"; }
    }
    goScreen("conversation");
    listenToMessages(convId, (msgs) => {
      renderMessages(msgs, "messages-thread", !!isGroup);
    });
    window._activeConvId   = convId;
    window._activeConvIsGroup = !!isGroup;
    window._activeConvMeta = { otherUid, otherName, isGroup: !!isGroup };
    markConversationRead(convId, window._currentUser?.uid);
  },

  async startConversation(otherUid, otherName) {
    const cid = await getOrCreateConversation(otherUid, otherName);
    if (!cid) return;
    UI.openConversation(cid, otherUid, otherName, false);
  },

  // ── Group messaging ──────────────────────────────────────
  showNewGroupPanel() {
    window._groupMembers = []; // reset selection
    const panel = document.getElementById("new-group-panel");
    const msgSearch = document.getElementById("msg-search-area");
    if (panel) panel.style.display = panel.style.display==="none"?"":"none";
    if (msgSearch) msgSearch.style.display = panel?.style.display==="none"?"":"none";
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
    const idx = window._groupMembers.findIndex(m => m.uid === uid);
    if (idx >= 0) { window._groupMembers.splice(idx, 1); }
    else { window._groupMembers.push({ uid, name }); }
    // Re-render list to update checkboxes
    renderFollowingForSearch(window._followingCache||[], "", "group-member-search-results", true);
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
      const panel = document.getElementById("new-group-panel");
      if (panel) panel.style.display = "none";
      UI.openConversation(cid, "", groupName, true);
    } catch(e) {
      showToast("Could not create group");
      if (btn) { btn.disabled = false; btn.textContent = "Create Group"; }
    }
  },

  async sendMsg() {
    const input = document.getElementById("msg-input");
    const text  = input?.value?.trim();
    const cid   = window._activeConvId;
    if (!text || !cid) return;
    input.value = "";
    input.style.height = "auto";
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
    const container = document.getElementById('courses-list');
    const label     = document.getElementById('courses-radius-label');
    if (!container) { window._coursesLoading = false; return; }

    try {
      // ── 1. Resolve lat/lon ──────────────────────────────────────────
      let lat = window._wxLat, lon = window._wxLon;
      const city = window._weatherCity || myProfile.city || '';
      if (!lat && city) {
        const cn  = city.split(',')[0].trim();
        const gck = 'geo_' + cn.toLowerCase().replace(/ /g, '_');
        let geo = null;
        try { const c=sessionStorage.getItem(gck); if(c){const p=JSON.parse(c); if(p.ts&&Date.now()-p.ts<86400000) geo=p;} } catch(_){}
        if (!geo) {
          try {
            const gd = await (await fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(cn)+'&count=1&language=en&format=json')).json();
            if (gd.results?.length) { geo={lat:gd.results[0].latitude,lon:gd.results[0].longitude,ts:Date.now()}; sessionStorage.setItem(gck,JSON.stringify(geo)); }
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
          if(label)label.textContent=p.data.length+' golf courses within 25 miles';
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
        {name:"Heritage Harbor Golf & Country Club",lat:28.1372,lon:-82.5012,phone:"(813) 949-4886",website:"https://www.heritageharborgolf.com",addr:"Lutz, FL",type:"Golf Course",holes:"18"},
        {name:"TPC Tampa Bay",lat:28.1637,lon:-82.5195,phone:"(813) 949-0090",website:"https://www.tpctampabay.com",addr:"Lutz, FL",type:"Golf Course",holes:"18"},
        {name:"Northdale Golf & Tennis Club",lat:28.0823,lon:-82.5281,phone:"(813) 962-0428",website:null,addr:"Tampa, FL",type:"Golf Course",holes:"18"},
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

      // ── 5. Overpass: short timeout mirrors in parallel ─────────────
      const radius=40234;
      const q='[out:json][timeout:15];('+
        'way["leisure"="golf_course"](around:'+radius+','+lat+','+lon+');'+
        'relation["leisure"="golf_course"](around:'+radius+','+lat+','+lon+');'+
        'way["sport"="golf"]["name"](around:'+radius+','+lat+','+lon+');'+
        ');out center tags 80;';

      const mirrors=[
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
      ];

      // Race all mirrors — first success wins, 8s hard timeout per mirror
      let txt1=null;
      const tryMirror=async(url)=>{
        const ctrl=new AbortController();
        const t=setTimeout(()=>ctrl.abort(),8000);
        try{
          const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(q),signal:ctrl.signal});
          clearTimeout(t);
          if(!r.ok)return null;
          const txt=await r.text();
          return txt.trim().startsWith('<')?null:txt;
        }catch{clearTimeout(t);return null;}
      };

      // Race all mirrors simultaneously
      const results=await Promise.allSettled(mirrors.map(m=>tryMirror(m)));
      for(const r of results){
        if(r.status==='fulfilled'&&r.value){txt1=r.value;break;}
      }

      if(txt1){
        const parsed=(JSON.parse(txt1).elements||[])
          .filter(e=>{const n=e.tags?.name;if(!n)return false;const k=norm(n);if(seen.has(k))return false;seen.add(k);return true;})
          .map(e=>{
            const cLat=e.lat||e.center?.lat||lat,cLon=e.lon||e.center?.lon||lon,t=e.tags||{};
            return{name:t.name||t.operator||'Golf Course',holes:t['golf:holes']||t.holes||null,
              phone:t.phone||null,website:t.website||null,
              addr:[t['addr:city'],t['addr:state']].filter(Boolean).join(', '),
              type:t.club==='golf'?'Country Club':'Golf Course',
              dist:_haversine(lat,lon,cLat,cLon),lat:cLat,lon:cLon};
          });
        courses=[...courses,...parsed];
      }

      // ── 6. Nominatim fallback if Overpass got nothing ──────────────
      if(!txt1||courses.length<5){
        try{
          const bbox=0.36;
          const url='https://nominatim.openstreetmap.org/search?q=golf+course&format=json&limit=40&addressdetails=1'+
            '&viewbox='+(lon-bbox)+','+(lat+bbox)+','+(lon+bbox)+','+(lat-bbox)+'&bounded=1';
          const nd=await (await fetch(url,{headers:{'Accept-Language':'en'}})).json();
          nd.forEach(p=>{
            const n=p.display_name?.split(',')[0]||'';if(!n)return;
            const k=norm(n);if(seen.has(k))return;seen.add(k);
            const cLat=parseFloat(p.lat),cLon=parseFloat(p.lon);
            courses.push({name:n,holes:null,phone:null,website:null,addr:'',type:'Golf Course',dist:_haversine(lat,lon,cLat,cLon),lat:cLat,lon:cLon});
          });
        }catch(_){}
      }

      // ── 7. Filter + sort + dedupe ──────────────────────────────────
      const CLOSED=['lutz executive golf center','proputt miniature golf'];
      const STREET_RE=/(\s(way|circle|blvd|boulevard|lane|drive|parkway|court|road|avenue|ave|street|st|place|pl|trail|terrace|loop|run|path|cir|dr|ln|ct|rd))$/i;
      courses=courses.filter(c=>{
        if(CLOSED.includes(norm(c.name)))return false;
        const n=c.name.trim();
        if(/golf|country.?club|links|course|tpc|pga|greens|resort/i.test(n))return true;
        if(STREET_RE.test(n))return false;
        return true;
      });
      courses.sort((a,b)=>a.dist-b.dist);
      courses=courses.slice(0,80);

      // ── 8. Cache 24hr and render ───────────────────────────────────
      try{sessionStorage.setItem(ck,JSON.stringify({ts:Date.now(),data:courses}));}catch(_){}
      window._nearbyCourses=courses; UI.filterCourses('');
      if(label)label.textContent=courses.length+' golf courses within 25 miles';

    }catch(e){
      console.error('courses error:',e.message);
      if((window._nearbyCourses||[]).length===0){
        container.innerHTML='<div class="empty-state" style="padding:24px 20px">'+
          '<div style="font-size:32px;margin-bottom:12px">⛳</div>'+
          '<div style="font-weight:600;margin-bottom:8px">Couldn't load courses</div>'+
          '<div style="font-size:14px;color:var(--muted);margin-bottom:16px">'+(e.message||'Connection error')+'</div>'+
          '<button onclick="window._coursesLoading=false;safeUI('loadNearbyCourses')" '+
          'style="background:var(--green);color:#fff;border:none;border-radius:20px;padding:10px 24px;font-size:14px;font-weight:600;cursor:pointer">Try Again</button></div>';
      }
    }finally{
      window._coursesLoading=false;
    }
  },

  filterCourses(query) {
    const courses = window._nearbyCourses || [];
    const q = (query || '').toLowerCase().trim();
    const filtered = q ? courses.filter(c => c.name.toLowerCase().includes(q)) : courses;
    const container = document.getElementById('courses-list');
    if (!container) return;
    if (!filtered.length) {
      container.innerHTML = '<div class="empty-state">No courses match your search.</div>';
      return;
    }
    container.innerHTML = filtered.map(c => {
      const distStr = c.dist < 1 ? 'Less than 1 mi' : `${c.dist.toFixed(1)} mi away`;
      const holesStr = c.holes ? ` · ${c.holes} holes` : '';
      const mapsUrl  = `https://maps.google.com/?q=${encodeURIComponent(c.name + ' golf ' + (c.addr||''))}&ll=${c.lat},${c.lon}`;
      const slug     = c.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-+$/,'');

      // Smart booking URL priority:
      // 1. Course's own website  2. GolfNow direct page  3. TeeOff search  4. GolfNow city search
      const golfnowSearch = 'https://www.golfnow.com/search?searchTerm=' + encodeURIComponent(c.name);
      const teeoffSearch  = 'https://www.teeoff.com/courses?keyword=' + encodeURIComponent(c.name);

      // Detect if website is already a booking page
      const isBookingSite = c.website && (
        c.website.includes('golfnow') || c.website.includes('teeoff') ||
        c.website.includes('chronogolf') || c.website.includes('foreup') ||
        c.website.includes('ezlinks') || c.website.includes('teesnap') ||
        c.website.includes('book') || c.website.includes('reserve') ||
        c.website.includes('teetimes')
      );

      // Primary booking action
      let bookUrl, bookLabel;
      if (c.website) {
        bookUrl   = c.website;
        bookLabel = '📅 Book tee time';
      } else {
        bookUrl   = golfnowSearch;
        bookLabel = '📅 Find tee times';
      }

      // Private/country clubs don't have public tee times
      const isPrivate = (c.type||'').includes('Country') || (c.name||'').toLowerCase().includes('country club');
      if (isPrivate && !c.website) {
        bookUrl   = mapsUrl;
        bookLabel = '📍 Get directions';
      }

      const icon = isPrivate ? '🏌️' : '⛳';
      const typeBadge = c.type && c.type !== 'Golf Course'
        ? `<span style="font-size:10px;font-weight:600;color:var(--green);background:var(--green-light);padding:2px 7px;border-radius:10px;margin-left:6px;white-space:nowrap">${c.type}</span>` : '';

      return `<div class="course-card">
        <div class="course-card-top">
          <div style="flex:1;min-width:0">
            <div class="course-name" style="display:flex;align-items:center;flex-wrap:wrap;gap:4px">${c.name}${typeBadge}</div>
            <div class="course-meta">${distStr}${holesStr}${c.addr ? ' · ' + c.addr : ''}</div>
          </div>
          <div style="font-size:22px;margin-left:8px">${icon}</div>
        </div>
        <div class="course-actions">
          <a href="${bookUrl}" target="_blank" rel="noopener" class="course-btn course-btn-tee">${bookLabel}</a>
          <a href="${mapsUrl}" target="_blank" rel="noopener" class="course-btn course-btn-map">📍 Directions</a>
          ${!c.website && !isPrivate ? `<a href="${teeoffSearch}" target="_blank" rel="noopener" class="course-btn">🔍 TeeOff</a>` : ''}
          ${c.website && !isBookingSite && !isPrivate ? `<a href="${golfnowSearch}" target="_blank" rel="noopener" class="course-btn">📅 GolfNow</a>` : ''}
          ${c.phone ? `<a href="tel:${c.phone}" class="course-btn">📞 Call</a>` : ''}
          ${c.website ? `<a href="${c.website}" target="_blank" rel="noopener" class="course-btn">🌐 Website</a>` : ''}
        </div>
      </div>`;
    }).join('');
  },

  // ── Book tee time — opens course website or GolfNow search ──
  bookTeeTime(name, website) {
    if (website && website.trim()) {
      // Course has its own website — open it directly
      window.open(website, '_blank', 'noopener,noreferrer');
    } else {
      // No website — search GolfNow for this course (largest tee time marketplace)
      const url = 'https://www.golfnow.com/search?searchTerm=' + encodeURIComponent(name);
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  },

  postTeeTimeAtCourse(courseName) {
    safeUI('bookTeeTime', courseName, '');
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
