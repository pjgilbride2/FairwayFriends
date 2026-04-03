// ============================================================
//  FAIRWAY FRIEND — Profile
//  Handles: loading, saving, photo upload, UI rendering
// ============================================================

import { db, storage } from "./firebase-config.js?v=95";
import {
  doc, getDoc, setDoc, deleteDoc, updateDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  ref, uploadBytes, getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { VIBE_META, initials, avatarColor, showToast } from "./ui.js?v=95";

export let myProfile = {};
export let myVibes   = [];

// ── Load profile from Firestore ──
export async function loadUserProfile(uid) {
  try {
    // Show cached profile instantly while Firestore loads
    const pk = "profile_"+uid;
    try {
      const cached = sessionStorage.getItem(pk);
      if (cached) {
        const cp = JSON.parse(cached);
        Object.assign(myProfile, cp);
        updateProfileUI();
      }
    } catch(_) {}
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      myProfile = snap.data();
      myVibes   = myProfile.vibes || [];
    } else {
      myProfile = {
        uid,
        displayName: window._currentUser?.displayName || "Golfer",
        vibes:[], handicap:18, roundCount:0, friends:[],
      };
    }
    window._weatherCity = myProfile.city || "";
    if (document.getElementById("profile-name-display")) updateProfileUI();
  } catch (err) {
    console.error("loadUserProfile error:", err);
    myProfile = {
      uid,
      displayName: window._currentUser?.displayName || "Golfer",
      vibes:[], handicap:18, roundCount:0, friends:[],
    };
  }
}

// ── Resize image via canvas before upload ──
async function resizeImg(file, maxPx) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => resolve(blob), "image/jpeg", 0.85);
    };
    img.src = url;
  });
}

// ── Upload profile photo to Firebase Storage ──
export async function uploadProfilePhoto(file) {
  const user = window._currentUser;
  if (!user || !file) return null;
  if (!file.type.startsWith("image/")) throw new Error("Please select an image file.");
  if (file.size > 5 * 1024 * 1024)    throw new Error("Image must be under 5MB.");

  const resized    = await resizeImg(file, 400);
  const storageRef = ref(storage, `avatars/${user.uid}`);
  await uploadBytes(storageRef, resized, { contentType: "image/jpeg" });
  const url = await getDownloadURL(storageRef);

  await setDoc(doc(db, "users", user.uid), { photoURL: url }, { merge: true });
  myProfile.photoURL = url;
  updateProfileUI();
  return url;
}

// ── Save vibes ──
export async function saveVibes(selectedVibes) {
  const user = window._currentUser;
  if (!user) return;
  myVibes = selectedVibes;
  myProfile.vibes = selectedVibes;
  await setDoc(doc(db, "users", user.uid), { vibes: selectedVibes }, { merge: true });
}

// ── Save onboarding data ──
export async function saveOnboardingData({ handicap, city, homeCourse, vibes }) {
  const user = window._currentUser;
  if (!user) return;
  const updates = {
    uid:             user.uid,
    displayName:     user.displayName || myProfile.displayName || "Golfer",
    email:           user.email || "",
    handicap, city, homeCourse, vibes,
    friends:         myProfile.friends    || [],
    roundCount:      myProfile.roundCount || 0,
    newToArea:       true,
    onboardComplete: true,
    updatedAt:       serverTimestamp(),
  };
  await setDoc(doc(db, "users", user.uid), updates, { merge: true });
  Object.assign(myProfile, updates);
  myVibes = vibes;
  window._weatherCity = city || "";
}

// ── Save edited profile fields ──
export async function saveProfileData({ bio, city, homeCourse, handicap, lat, lon }) {
  const user = window._currentUser;
  if (!user) throw new Error("Not signed in.");

  const updates = {
    bio:        bio        || "",
    city:       city       || "",
    ...(lat && lon ? { lat, lon } : {}),
    homeCourse: homeCourse || "",
    handicap:   Number(handicap) || 18,
    updatedAt:  serverTimestamp(),
  };

  await setDoc(doc(db, "users", user.uid), updates, { merge: true });
  Object.assign(myProfile, updates);
  window._weatherCity = city || "";
  updateProfileUI();
}

// ── Load another user's public profile ──
export async function loadPublicProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

// ── Update all profile UI elements across every screen ──
export function updateProfileUI() {
  const name     = myProfile.displayName || "Golfer";
  const ini      = initials(name);
  const aColor   = avatarColor(myProfile.uid || "");
  const photoURL = myProfile.photoURL || null;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  // Small avatars throughout the app
  ["feed-avatar", "composer-avatar", "sc-avatar", "discover-avatar", "msg-avatar"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = `avatar-sm ${aColor}`;
    if (photoURL) {
      el.style.backgroundImage    = `url(${photoURL})`;
      el.style.backgroundSize     = "cover";
      el.style.backgroundPosition = "center";
      el.textContent = "";
    } else {
      el.style.backgroundImage = "";
      el.textContent = ini;
    }
  });

  // Large avatar on profile screen
  const pal = document.getElementById("profile-avatar-lg");
  if (pal) {
    pal.className = `profile-avatar-lg ${aColor}`;
    if (photoURL) {
      pal.style.backgroundImage    = `url(${photoURL})`;
      pal.style.backgroundSize     = "cover";
      pal.style.backgroundPosition = "center";
      pal.textContent = "";
    } else {
      pal.style.backgroundImage = "";
      pal.textContent = ini;
    }
  }

  // Photo preview in edit screen
  const editPreview     = document.getElementById("edit-photo-preview");
  const editPlaceholder = document.getElementById("edit-photo-placeholder");
  if (editPreview) {
    if (photoURL) {
      editPreview.src           = photoURL;
      editPreview.style.display = "block";
      if (editPlaceholder) editPlaceholder.style.display = "none";
    } else {
      editPreview.style.display = "none";
      if (editPlaceholder) editPlaceholder.style.display = "flex";
    }
  }

  set("profile-name-display", name);
  set("profile-handle-display",
    `@${name.toLowerCase().replace(/\s+/g,"")}` +
    (myProfile.city ? ` · ${myProfile.city}` : "")
  );

  // Bio with fallback
  const bioEl = document.getElementById("profile-bio-display");
  if (bioEl) {
    bioEl.textContent = myProfile.bio ||
      (myProfile.newToArea ? "New to the area — looking for golf buddies!" : "Fairway Friend member");
    bioEl.style.fontStyle = myProfile.bio ? "normal" : "italic";
    bioEl.style.color     = myProfile.bio ? "var(--text)" : "var(--muted)";
  }

  set("profile-hdcp",        myProfile.handicap != null ? `HCP ${myProfile.handicap}` : "HCP —");
  set("profile-rounds",      String(myProfile.roundCount || 0));
  set("profile-friends",     String((myProfile.friends || []).length));
  set("profile-city",        myProfile.city       || "—");
  set("profile-home-course", myProfile.homeCourse || "—");
  set("feed-city",           myProfile.city       || "Your area");
  set("hcp-label",           myProfile.handicap != null ? `HCP ${myProfile.handicap}` : "HCP —");

  const elJoined = document.getElementById("profile-joined");
  if (elJoined && myProfile.joinedAt?.toDate) {
    elJoined.textContent = myProfile.joinedAt.toDate()
      .toLocaleDateString("en-US", { month:"long", year:"numeric" });
  }

  const elBadges = document.getElementById("profile-badges");
  if (elBadges) {
    const b = [];
    if (myProfile.newToArea)               b.push(`<span class="badge green">🆕 New to area</span>`);
    if ((myProfile.handicap||99) <= 10)    b.push(`<span class="badge amber">⭐ Single digit</span>`);
    if ((myProfile.roundCount||0) >= 10)   b.push(`<span class="badge green">🏌️ Active golfer</span>`);
    b.push(`<span class="badge">Fairway Friend member</span>`);
    elBadges.innerHTML = b.join("");
  }

  const elVibes = document.getElementById("profile-vibes-display");
  if (elVibes) {
    elVibes.innerHTML = (myProfile.vibes || []).map((v) => {
      const m = VIBE_META[v]; if (!m) return "";
      return `<span class="vibe-toggle ${m.cls} selected" style="font-size:12px;padding:6px 12px;margin-bottom:4px">
        <span class="vt-icon">${m.icon}</span>${m.label}</span>`;
    }).join("");
  }

  document.querySelectorAll("[data-vibe]").forEach((el) => {
    el.classList.toggle("selected", myVibes.includes(el.dataset.vibe));
  });
}

// ── Delete account ────────────────────────────────────────────
export async function deleteAccount() {
  const user = window._currentUser;
  if (!user) return;
  try {
    // Delete Firestore user doc
    await deleteDoc(doc(db, 'users', user.uid));
    // Delete Firebase Auth account
    await user.delete();
    showToast('Account deleted');
    window.location.reload();
  } catch(e) {
    if (e.code === 'auth/requires-recent-login') {
      showToast('Please sign out and sign back in, then try again');
    } else {
      showToast('Could not delete account: ' + (e.message||'unknown error'));
    }
  }
}

// ── Downgrade subscription ────────────────────────────────────
export async function downgradeSubscription() {
  const user = window._currentUser;
  if (!user) return;
  try {
    await updateDoc(doc(db, 'users', user.uid), { plan: 'free', planUpdatedAt: serverTimestamp() });
    if (window.myProfile) window.myProfile.plan = 'free';
    showToast('Downgraded to Free plan');
    // Refresh profile UI to reflect new plan
    const { updateProfileUI } = await import('./profile.js?v=95');
    updateProfileUI();
  } catch(e) {
    showToast('Could not update plan');
  }
}
