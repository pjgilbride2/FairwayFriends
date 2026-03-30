// ============================================================
//  FAIRWAY FRIEND — Authentication
// ============================================================

import { auth, db } from "./firebase-config.js?v=37";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { loadUserProfile } from "./profile.js?v=37";
import { initNotifications, teardownNotifications } from "./notifications.js?v=37";
import { initFeed, initNearbyPlayers, teardownListeners } from "./feed.js?v=37";
import { goScreen, hideSplash } from "./ui.js?v=37";

let _listenersActive = false;

// ── Build the auth screen HTML (dark green artifact design) ──
export function buildAuthScreen() {
  const screen = document.getElementById("screen-auth");
  if (!screen || screen.dataset.built) return;
  screen.dataset.built = "1";

  screen.style.cssText = "min-height:100vh;background:#1a3a2a;overflow-y:auto;position:relative;";

  screen.innerHTML = `
<style>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500&display=swap');
#screen-auth * { box-sizing:border-box; margin:0; padding:0; }
#screen-auth {
  font-family:'DM Sans',sans-serif;
  background:#1a3a2a;
  min-height:100vh;
  overflow-y:auto;
  -webkit-overflow-scrolling:touch;
}
#screen-auth::before {
  content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
  background:
    radial-gradient(ellipse at 20% 50%,rgba(61,122,82,.15) 0%,transparent 60%),
    radial-gradient(ellipse at 80% 20%,rgba(201,168,76,.08) 0%,transparent 50%),
    radial-gradient(ellipse at 60% 80%,rgba(45,90,61,.2) 0%,transparent 50%);
}
#screen-auth::after {
  content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
  background-image:
    linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px);
  background-size:40px 40px;
}
.au-wrap { position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;padding:0 20px 40px;min-height:100vh; }

/* ── LANDING ── */
#auth-landing {
  width:100%;max-width:480px;
  display:flex;flex-direction:column;
  min-height:100vh;
}
.au-hero {
  flex:1;display:flex;align-items:center;justify-content:center;
  padding:48px 20px 28px;
  background:radial-gradient(ellipse at 50% 40%,rgba(61,122,82,.3) 0%,transparent 70%);
  min-height:300px;
}
.au-hero-inner { text-align:center; }
.au-logo-icon {
  width:84px;height:84px;background:#2d5a3d;border-radius:22px;
  display:inline-flex;align-items:center;justify-content:center;
  margin-bottom:18px;
  box-shadow:0 12px 40px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.15);
}
.au-wordmark {
  font-family:'Playfair Display',serif;font-size:38px;font-weight:700;
  margin-bottom:12px;letter-spacing:-.5px;
}
.au-wordmark .gn{color:#3d7a52;}.au-wordmark .cr{color:#f5f0e8;}
.au-tagline{font-size:15px;color:rgba(255,255,255,.55);line-height:1.5;max-width:260px;margin:0 auto;}
.au-actions {
  padding:24px 0 32px;
  display:flex;flex-direction:column;gap:12px;
}
.au-btn {
  width:100%;padding:16px;border-radius:14px;
  font-family:'DM Sans',sans-serif;font-size:15px;font-weight:600;
  cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;
  transition:all .2s;border:none;
}
.au-btn-apple{background:#fff;color:#000;}
.au-btn-google{background:#fff;color:#333;}
.au-btn-email{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.25)!important;}
.au-btn-email:hover{background:rgba(255,255,255,.07);}
.au-terms{
  text-align:center;font-size:12px;color:rgba(255,255,255,.4);
  line-height:1.6;padding:4px 0 0;
}
.au-terms a{color:rgba(255,255,255,.65);text-decoration:underline;}
.au-signin-link {
  text-align:center;padding:16px 0 0;
  font-size:14px;color:rgba(255,255,255,.5);
}
.au-signin-link button {
  background:none;border:none;color:#c9a84c;
  font-family:'DM Sans',sans-serif;font-size:14px;font-weight:500;
  cursor:pointer;text-decoration:underline;
}

/* ── SIGN IN ── */
#auth-signin {
  display:none;width:100%;max-width:480px;padding-top:48px;
}
.au-back {
  display:inline-flex;align-items:center;gap:6px;
  background:none;border:none;color:rgba(255,255,255,.5);
  font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;
  margin-bottom:24px;padding:0;
}
.au-back:hover{color:#fff;}
.au-card {
  background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);
  border-radius:24px;padding:28px 24px;
  backdrop-filter:blur(20px);
  box-shadow:0 24px 64px rgba(0,0,0,.3);
  animation:au-slide .3s ease both;
}
@keyframes au-slide{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.au-card-title {
  font-family:'Playfair Display',serif;font-size:24px;font-weight:600;
  color:#fff;margin-bottom:6px;
}
.au-card-sub { font-size:14px;color:rgba(255,255,255,.5);margin-bottom:22px;line-height:1.5; }
.au-field { margin-bottom:14px; }
.au-field label {
  display:block;font-size:11px;font-weight:500;letter-spacing:.5px;
  color:rgba(255,255,255,.5);margin-bottom:7px;text-transform:uppercase;
}
.au-field input {
  width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
  border-radius:12px;padding:13px 15px;
  font-family:'DM Sans',sans-serif;font-size:15px;color:#fff;
  outline:none;transition:all .2s;-webkit-appearance:none;
}
.au-field input::placeholder{color:rgba(255,255,255,.25);}
.au-field input:focus{border-color:#c9a84c;background:rgba(255,255,255,.09);box-shadow:0 0 0 3px rgba(201,168,76,.1);}
.au-field-row { display:flex;justify-content:space-between;align-items:center;margin-bottom:7px; }
.au-field-row label { margin-bottom:0; }
.au-forgot {
  background:none;border:none;color:#c9a84c;
  font-family:'DM Sans',sans-serif;font-size:12px;
  cursor:pointer;padding:0;
}
.au-forgot:hover{text-decoration:underline;}
.au-err {
  font-size:13px;padding:10px 12px;border-radius:8px;
  background:rgba(229,62,62,.12);border:1px solid rgba(229,62,62,.3);
  color:#fc8181;margin-bottom:12px;display:none;
}
.au-err.success{background:rgba(61,122,82,.15);border-color:rgba(61,122,82,.4);color:#6ee7a0;}
.au-submit {
  width:100%;padding:15px;border:none;border-radius:13px;
  background:#c9a84c;color:#1a3a2a;
  font-family:'DM Sans',sans-serif;font-size:15px;font-weight:600;
  cursor:pointer;transition:all .2s;
  box-shadow:0 4px 20px rgba(201,168,76,.3);margin-top:4px;
}
.au-submit:active{transform:scale(.98);}
.au-submit:disabled{opacity:.6;cursor:not-allowed;transform:none;}
.au-divider {
  display:flex;align-items:center;gap:12px;margin:18px 0;
}
.au-divider::before,.au-divider::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.08);}
.au-divider span{font-size:11px;color:rgba(255,255,255,.35);letter-spacing:1px;text-transform:uppercase;}
.au-switch {
  text-align:center;font-size:14px;color:rgba(255,255,255,.45);margin-top:16px;
}
.au-switch button {
  background:none;border:none;color:#c9a84c;
  font-family:'DM Sans',sans-serif;font-size:14px;font-weight:500;
  cursor:pointer;
}
.au-switch button:hover{text-decoration:underline;}
.au-note{font-size:11px;color:rgba(255,255,255,.35);margin-top:5px;}
</style>

<div class="au-wrap">

  <!-- ── LANDING ── -->
  <div id="auth-landing">
    <div class="au-hero">
      <div class="au-hero-inner">
        <div class="au-logo-icon">
          <svg viewBox="0 0 36 36" fill="none" width="44" height="44">
            <circle cx="12" cy="28" r="5" fill="white"/>
            <line x1="12" y1="23" x2="12" y2="6" stroke="white" stroke-width="2"/>
            <polygon points="12,6 26,10 12,14" fill="#c9a84c"/>
          </svg>
        </div>
        <div class="au-wordmark"><span class="gn">Fairway </span><span class="cr">Friend</span></div>
        <div class="au-tagline">Golf buddies, tee times &amp; scorecards — all in one place</div>
      </div>
    </div>
    <div class="au-actions">
      <button class="au-btn au-btn-apple" id="au-apple-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
        Continue with Apple
      </button>
      <button class="au-btn au-btn-google" id="au-google-btn">
        <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Continue with Google
      </button>
      <button class="au-btn au-btn-email" id="au-email-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        Create account with Email
      </button>
      <p class="au-terms">By continuing you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a></p>
      <div class="au-signin-link">
        Already have an account?
        <button onclick="safeUI('showAuthSignIn')">Sign in</button>
      </div>
    </div>
  </div>

  <!-- ── SIGN IN ── -->
  <div id="auth-signin">
    <button class="au-back" onclick="safeUI('showAuthLanding')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15,18 9,12 15,6"/></svg>
      Back
    </button>
    <div class="au-card">
      <div class="au-card-title">Welcome back</div>
      <div class="au-card-sub">Sign in to your Fairway Friend account</div>
      <div id="login-error" class="au-err"></div>
      <div class="au-field">
        <label>Email</label>
        <input id="login-email" type="email" maxlength="100" placeholder="you@example.com" autocomplete="email"
          onkeydown="if(event.key==='Enter')safeUI('handleLogin')">
      </div>
      <div class="au-field">
        <div class="au-field-row">
          <label>Password</label>
          <button class="au-forgot" onclick="safeUI('handleForgotPassword')">Forgot password?</button>
        </div>
        <input id="login-password" type="password" maxlength="128" placeholder="••••••••" autocomplete="current-password"
          onkeydown="if(event.key==='Enter')safeUI('handleLogin')">
      </div>
      <button class="au-submit" id="login-btn" onclick="safeUI('handleLogin')">Sign in</button>
      <div class="au-switch">
        No account? <button onclick="safeUI('goScreen','onboard')">Create one</button>
      </div>
    </div>
  </div>
</div>`;

  // Wire Apple/Google buttons (currently just route to email signup)
  const _goOnboard = () => { safeUI('goScreen','onboard'); };
  document.getElementById("au-apple-btn").onclick  = _goOnboard;
  document.getElementById("au-google-btn").onclick = _goOnboard;
  document.getElementById("au-email-btn").onclick  = _goOnboard;
}

// ── Init auth state listener ──────────────────────────────────
export function initAuth() {
  const splashFallback = setTimeout(() => {
    hideSplash();
    buildAuthScreen();
    goScreen("auth");
  }, 6000);

  onAuthStateChanged(auth, async (user) => {
    clearTimeout(splashFallback);

    if (user) {
      window._currentUser = user;

      try {
        await new Promise((r) => setTimeout(r, 600));
        await loadUserProfile(user.uid);

        const snap = await getDoc(doc(db, "users", user.uid));
        const needsOnboard = !snap.exists() || !snap.data().onboardComplete;

        hideSplash();

        if (needsOnboard) {
          goScreen("onboard");
        } else {
          goScreen("feed");
          document.getElementById("bottom-nav").style.display = "flex";
          if (!_listenersActive) {
            _listenersActive = true;
            initFeed();
            initNearbyPlayers();
            initNotifications(user.uid);
          }
          if (window.UI?.refreshWeather) window.UI.refreshWeather();
        }
      } catch (err) {
        console.error("Fairway Friend — auth flow error:", err);
        hideSplash();
        buildAuthScreen();
        goScreen("auth");
        const errEl = document.getElementById("login-error");
        if (errEl) {
          errEl.textContent = "Error: " + (err.message || err.code || "Something went wrong.");
          errEl.style.display = "block";
        }
      }
    } else {
      window._currentUser = null;
      hideSplash();
      document.getElementById("bottom-nav").style.display = "none";
      teardownListeners();
      teardownNotifications();
      _listenersActive = false;
      buildAuthScreen();
      goScreen("auth");
    }
  });
}

export function setListenersActive(val) { _listenersActive = val; }

// ── Sign Up ──────────────────────────────────────────────────
export async function doSignup(first, last, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const name = [first, last].filter(Boolean).join(" ").trim() || "Golfer";
  await updateProfile(cred.user, { displayName: name });
  await setDoc(doc(db, "users", cred.user.uid), {
    uid:             cred.user.uid,
    displayName:     name,
    email:           email,
    handicap:        18,
    city:            "",
    homeCourse:      "",
    vibes:           [],
    friends:         [],
    roundCount:      0,
    newToArea:       true,
    onboardComplete: false,
    joinedAt:        serverTimestamp(),
  });
  return cred.user;
}

// ── Sign In ──────────────────────────────────────────────────
export async function doLogin(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// ── Sign Out ─────────────────────────────────────────────────
export async function doSignOut() { await signOut(auth); }

// ── Friendly error messages ───────────────────────────────────
export function friendlyError(code) {
  const map = {
    "auth/user-not-found":         "No account found with that email.",
    "auth/wrong-password":         "Incorrect password.",
    "auth/invalid-credential":     "Email or password is incorrect.",
    "auth/email-already-in-use":   "An account with this email already exists.",
    "auth/invalid-email":          "Please enter a valid email address.",
    "auth/weak-password":          "Password must be at least 6 characters.",
    "auth/too-many-requests":      "Too many attempts. Please try again later.",
    "auth/network-request-failed": "Network error. Check your connection.",
  };
  return map[code] || "Something went wrong. Please try again.";
}
