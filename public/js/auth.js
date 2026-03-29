// ============================================================
//  FAIRWAY FRIEND — Authentication
// ============================================================

import { auth, db } from "./firebase-config.js?v=6";
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
import { loadUserProfile } from "./profile.js?v=6";
import { initFeed, initNearbyPlayers, teardownListeners } from "./feed.js?v=6";
import { goScreen, hideSplash } from "./ui.js?v=6";

let _listenersActive = false;

export function initAuth() {
  // Splash fallback — surfaces auth errors after 6s instead of blank screen
  const splashFallback = setTimeout(() => {
    hideSplash();
    goScreen("auth");
  }, 6000);

  onAuthStateChanged(auth, async (user) => {
    clearTimeout(splashFallback);

    if (user) {
      window._currentUser = user;

      try {
        // Brief pause so setDoc in doSignup() finishes writing before we read it back
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
          }
          // Load weather for returning users
          if (window.UI && window.UI.refreshWeather) window.UI.refreshWeather();
        }
      } catch (err) {
        // Show the real error instead of a blank screen
        console.error("Fairway Friend — auth flow error:", err);
        hideSplash();
        goScreen("auth");
        const errEl = document.getElementById("login-error");
        if (errEl) {
          errEl.textContent = "Error: " + (err.message || err.code || "Something went wrong. Check console.");
          errEl.style.display = "block";
        }
      }
    } else {
      window._currentUser = null;
      hideSplash();
      document.getElementById("bottom-nav").style.display = "none";
      teardownListeners();
      _listenersActive = false;
      goScreen("auth");
    }
  });
}

export function setListenersActive(val) {
  _listenersActive = val;
}

// ── Sign Up ──
export async function doSignup(first, last, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: `${first} ${last}`.trim() });

  await setDoc(doc(db, "users", cred.user.uid), {
    uid:             cred.user.uid,
    displayName:     `${first} ${last}`.trim(),
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

// ── Sign In ──
export async function doLogin(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// ── Sign Out ──
export async function doSignOut() {
  await signOut(auth);
}

// ── Friendly error messages ──
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
