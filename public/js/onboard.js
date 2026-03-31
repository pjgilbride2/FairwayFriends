// ============================================================
//  FAIRWAY FRIEND — Full Account Creation + Onboarding
//  Matches artifact 534f2c97 exactly
//  Flow: Landing → Email/Password → 8 profile steps → Feed
// ============================================================

import { db, storage } from "./firebase-config.js?v=50";
import {
  doc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { showToast } from "./ui.js?v=50";

// ── State ────────────────────────────────────────────────────
let _cur = 0;   // 0=landing, 1=email/pw, 2=gender … 9=success
let _photoFile = null;
let _data = {};

function _reset() {
  _cur = 0;
  _photoFile = null;
  _data = {
    email:'', password:'',
    gender:null, firstName:'', lastName:'', dob:'',
    reasons:[], handicap:'', zip:'', homeCourse:'',
    city:'', state:'', vibes:[], bio:'', howHeard:null
  };
}

// Step count: 0=landing 1=account 2=gender 3=name 4=reasons 5=game 6=vibes 7=profile 8=howheard 9=success
const TOTAL_STEPS = 8; // steps 1–8 shown in progress bar
const BTN_LABELS  = {
  0:'', 1:'Continue', 2:'Continue', 3:'Continue', 4:'Continue',
  5:'Continue', 6:'Continue', 7:'Continue', 8:'Finish Up →', 9:"Let's Golf 🏌️"
};

// ── Build screen ─────────────────────────────────────────────
export function buildOnboardScreen() {
  const screen = document.getElementById('screen-onboard');
  if (!screen) return;
  // Don't rebuild if already in progress (e.g. auth state change fires mid-onboard)
  if (screen.dataset.built && _cur > 0) return;
  delete screen.dataset.built;
  screen.dataset.built = '1';
  _reset();

  screen.innerHTML = `
<style>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500&display=swap');
#screen-onboard *{box-sizing:border-box;margin:0;padding:0;}
#screen-onboard{
  font-family:'DM Sans',sans-serif;
  background:#1a3a2a;
  min-height:100vh;overflow-y:auto;
  -webkit-overflow-scrolling:touch;
  position:relative;
}
#screen-onboard::before{
  content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
  background:
    radial-gradient(ellipse at 20% 50%,rgba(61,122,82,.15) 0%,transparent 60%),
    radial-gradient(ellipse at 80% 20%,rgba(201,168,76,.08) 0%,transparent 50%),
    radial-gradient(ellipse at 60% 80%,rgba(45,90,61,.2) 0%,transparent 50%);
}
#screen-onboard::after{
  content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
  background-image:
    linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px);
  background-size:40px 40px;
}
/* ── layout ── */
.ob-page{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;padding:36px 20px 160px;}

/* ── logo ── */
.ob-logo{text-align:center;margin-bottom:24px;}
.ob-logo-icon{width:64px;height:64px;background:#2d5a3d;border-radius:18px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;box-shadow:0 8px 32px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.1);}
.ob-wordmark{font-family:'Playfair Display',serif;font-size:26px;font-weight:700;}
.ob-wordmark .gn{color:#3d7a52;}.ob-wordmark .cr{color:#f5f0e8;}

/* ── progress ── */
.ob-progress{display:flex;gap:6px;width:100%;max-width:480px;margin-bottom:20px;transition:opacity .3s;}
.ob-bar{flex:1;height:3px;background:rgba(255,255,255,.1);border-radius:2px;transition:background .4s;}
.ob-bar.done{background:#3d7a52;}.ob-bar.cur{background:#c9a84c;}

/* ── card ── */
.ob-card{width:100%;max-width:480px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:24px;padding:28px 24px;backdrop-filter:blur(20px);box-shadow:0 24px 64px rgba(0,0,0,.3);}
.ob-card-flush{padding:0;overflow:hidden;}

/* ── steps ── */
.ob-step{display:none;}
.ob-step.active{display:block;animation:ob-in .35s ease both;}
@keyframes ob-in{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}

/* ── step typography ── */
.ob-lbl{font-size:11px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:#c9a84c;margin-bottom:8px;}
.ob-h1{font-family:'Playfair Display',serif;font-size:24px;font-weight:600;color:#fff;margin-bottom:6px;line-height:1.25;}
.ob-sub{font-size:14px;color:rgba(255,255,255,.6);margin-bottom:22px;line-height:1.5;}

/* ── fields ── */
.ob-f{margin-bottom:14px;}
.ob-f label{display:block;font-size:11px;font-weight:500;letter-spacing:.5px;color:rgba(255,255,255,.5);margin-bottom:7px;text-transform:uppercase;}
.ob-f input,.ob-f textarea{
  width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
  border-radius:12px;padding:13px 15px;font-family:'DM Sans',sans-serif;font-size:15px;color:#fff;
  outline:none;transition:all .2s;-webkit-appearance:none;
}
.ob-f input::placeholder,.ob-f textarea::placeholder{color:rgba(255,255,255,.25);}
.ob-f input:focus,.ob-f textarea:focus{border-color:#c9a84c;background:rgba(255,255,255,.09);box-shadow:0 0 0 3px rgba(201,168,76,.1);}
.ob-f textarea{resize:none;height:85px;}
.ob-note{font-size:11px;color:rgba(255,255,255,.4);margin-top:5px;}
.ob-err{font-size:13px;color:#fc8181;background:rgba(229,62,62,.1);border:1px solid rgba(229,62,62,.25);border-radius:8px;padding:9px 12px;margin-bottom:12px;display:none;}

/* ── toggles ── */
.ob-trow{display:flex;gap:10px;margin-bottom:10px;}
.ob-tog{flex:1;padding:13px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:12px;color:rgba(255,255,255,.8);font-family:'DM Sans',sans-serif;font-size:14px;font-weight:500;cursor:pointer;transition:all .2s;}
.ob-tog.sel{background:rgba(201,168,76,.15);border-color:#c9a84c;color:#e8c97a;}
.ob-tog-full{width:100%;flex:none;}

/* ── reason cards ── */
.ob-reasons{display:flex;flex-direction:column;gap:10px;}
.ob-rbtn{padding:15px 16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:14px;color:rgba(255,255,255,.8);font-family:'DM Sans',sans-serif;font-size:14px;cursor:pointer;transition:all .2s;text-align:left;display:flex;align-items:center;gap:14px;}
.ob-rbtn .ri{font-size:20px;width:28px;text-align:center;}
.ob-rbtn strong{display:block;font-weight:500;color:#fff;margin-bottom:2px;font-size:14px;}
.ob-rbtn small{color:rgba(255,255,255,.45);font-size:12px;}
.ob-rbtn.sel{background:rgba(61,122,82,.2);border-color:#3d7a52;}

/* ── handicap row ── */
.ob-hrow{display:flex;gap:10px;align-items:flex-end;margin-bottom:14px;}
.ob-hrow .ob-f{flex:1;margin-bottom:0;}
.ob-ghin{padding:13px 14px;background:rgba(61,122,82,.2);border:1px solid #3d7a52;border-radius:12px;color:#3d7a52;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;height:47px;}

/* ── chips ── */
.ob-chips{display:flex;flex-wrap:wrap;gap:8px;}
.ob-chip{padding:9px 15px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:100px;color:rgba(255,255,255,.8);font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;transition:all .2s;}
.ob-chip.sel{background:rgba(201,168,76,.15);border-color:#c9a84c;color:#e8c97a;}

/* ── photo ── */
.ob-avatar-wrap{display:flex;justify-content:center;margin-bottom:18px;}
.ob-avatar{width:88px;height:88px;border-radius:50%;background:rgba(255,255,255,.06);border:2px dashed rgba(255,255,255,.2);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;color:rgba(255,255,255,.4);font-size:11px;gap:5px;transition:all .2s;background-size:cover;background-position:center;}

/* ── how heard ── */
.ob-heard{display:flex;flex-direction:column;gap:8px;}
.ob-hbtn{padding:12px 15px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:rgba(255,255,255,.8);font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;text-align:left;transition:all .2s;}
.ob-hbtn.sel{background:rgba(201,168,76,.12);border-color:#c9a84c;color:#e8c97a;}

/* ── success ── */
.ob-success{text-align:center;}
.ob-success-icon{width:80px;height:80px;background:rgba(61,122,82,.2);border:2px solid #3d7a52;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:36px;animation:ob-pop .5s cubic-bezier(.175,.885,.32,1.275) both;}
@keyframes ob-pop{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}

/* ── landing (step 0) ── */
#ob-s0{display:none;flex-direction:column;min-height:calc(100vh - 36px);}
#ob-s0.active{display:flex;animation:ob-fade .5s ease both;}
@keyframes ob-fade{from{opacity:0}to{opacity:1}}
.ob-hero{flex:1;display:flex;align-items:center;justify-content:center;padding:40px 20px 20px;background:radial-gradient(ellipse at 50% 40%,rgba(61,122,82,.3) 0%,transparent 70%);border-radius:16px 16px 0 0;min-height:280px;}
.ob-hero-logo-icon{width:80px;height:80px;background:#2d5a3d;border-radius:22px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;box-shadow:0 12px 40px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.15);}
.ob-hero-wordmark{font-family:'Playfair Display',serif;font-size:36px;font-weight:700;margin-bottom:10px;letter-spacing:-.5px;}
.ob-hero-tagline{font-size:14px;color:rgba(255,255,255,.55);line-height:1.5;max-width:260px;margin:0 auto;}
.ob-auth-actions{padding:24px 4px 8px;display:flex;flex-direction:column;gap:12px;}
.ob-auth-btn{width:100%;padding:16px;border-radius:14px;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:all .2s;border:none;}
.ob-auth-apple{background:#fff;color:#000;}.ob-auth-apple:hover{background:#f0f0f0;}
.ob-auth-google{background:#fff;color:#333;}.ob-auth-google:hover{background:#f0f0f0;}
.ob-auth-email{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.2)!important;}.ob-auth-email:hover{background:rgba(255,255,255,.06);}
.ob-terms{text-align:center;font-size:12px;color:rgba(255,255,255,.4);line-height:1.6;padding:4px 0 8px;}
.ob-terms a{color:rgba(255,255,255,.7);text-decoration:underline;}
.ob-signin-link{text-align:center;font-size:14px;color:rgba(255,255,255,.45);padding:8px 0 0;}
.ob-signin-link button{background:none;border:none;color:#c9a84c;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:500;cursor:pointer;}

/* ── sticky nav ── */
.ob-nav{position:fixed;bottom:0;left:0;right:0;z-index:99;padding:16px 24px 40px;background:linear-gradient(to top,#1a3a2a 60%,transparent);display:none;flex-direction:column;align-items:center;gap:2px;}
.ob-btn{width:100%;max-width:480px;padding:16px;background:#c9a84c;border:none;border-radius:14px;color:#1a3a2a;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 4px 20px rgba(201,168,76,.3);transition:all .2s;}
.ob-btn:active{transform:scale(.98);}
.ob-btn.green{background:#3d7a52;box-shadow:0 4px 20px rgba(61,122,82,.3);}
.ob-btn:disabled{opacity:.6;cursor:not-allowed;transform:none;}
.ob-back-btn{background:none;border:none;color:rgba(255,255,255,.45);font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;padding:7px 0 0;transition:color .2s;}
.ob-back-btn.hidden{visibility:hidden;}
</style>

<div class="ob-page">
  <!-- logo (steps 1+) -->
  <div class="ob-logo" id="ob-logo">
    <div class="ob-logo-icon">
      <svg viewBox="0 0 36 36" fill="none" width="36" height="36">
        <circle cx="12" cy="28" r="5" fill="white"/>
        <line x1="12" y1="23" x2="12" y2="6" stroke="white" stroke-width="2"/>
        <polygon points="12,6 26,10 12,14" fill="#c9a84c"/>
      </svg>
    </div>
    <div class="ob-wordmark"><span class="gn">Fairway </span><span class="cr">Friend</span></div>
  </div>

  <!-- progress bar -->
  <div class="ob-progress" id="ob-prog" style="opacity:0">
    ${Array.from({length:TOTAL_STEPS},(_,i)=>`<div class="ob-bar" id="ob-b${i}"></div>`).join('')}
  </div>

  <!-- card -->
  <div class="ob-card" id="ob-card">

    <!-- STEP 0: Landing -->
    <div class="ob-step active" id="ob-s0">
      <div class="ob-hero">
        <div style="text-align:center">
          <div class="ob-hero-logo-icon">
            <svg viewBox="0 0 36 36" fill="none" width="44" height="44">
              <circle cx="12" cy="28" r="5" fill="white"/>
              <line x1="12" y1="23" x2="12" y2="6" stroke="white" stroke-width="2"/>
              <polygon points="12,6 26,10 12,14" fill="#c9a84c"/>
            </svg>
          </div>
          <div class="ob-hero-wordmark"><span style="color:#3d7a52">Fairway </span><span style="color:#f5f0e8">Friend</span></div>
          <div class="ob-hero-tagline">Golf buddies, tee times &amp; scorecards — all in one place</div>
        </div>
      </div>
      <div class="ob-auth-actions">
        <button class="ob-auth-btn ob-auth-apple" id="ob-apple">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
          Continue with Apple
        </button>
        <button class="ob-auth-btn ob-auth-google" id="ob-google">
          <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </button>
        <button class="ob-auth-btn ob-auth-email" id="ob-email">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Continue with Email
        </button>
        <p class="ob-terms">By continuing you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a></p>
        <div class="ob-signin-link">Already have an account? <button id="ob-signin-link">Sign in</button></div>
      </div>
    </div>

    <!-- STEP 1: Email + Password -->
    <div class="ob-step" id="ob-s1">
      <div class="ob-lbl">Step 1 of 8</div>
      <div class="ob-h1">Create your account</div>
      <div class="ob-sub">Enter your email and a password to get started.</div>
      <div id="ob-s1-err" class="ob-err"></div>
      <div class="ob-f"><label>Email</label><input id="ob-email-inp" type="email" maxlength="100" placeholder="you@example.com" autocomplete="email"></div>
      <div class="ob-f"><label>Password</label><input id="ob-pw-inp" type="password" maxlength="128" placeholder="At least 6 characters" autocomplete="new-password">
        <div class="ob-note">🔒 Minimum 6 characters</div>
      </div>
    </div>

    <!-- STEP 2: Gender -->
    <div class="ob-step" id="ob-s2">
      <div class="ob-lbl">Step 2 of 8</div>
      <div class="ob-h1">How do you identify?</div>
      <div class="ob-sub">Help us find you the best matches on the course.</div>
      <div class="ob-trow">
        <button class="ob-tog" id="ob-g-man">♂ Man</button>
        <button class="ob-tog" id="ob-g-woman">♀ Woman</button>
      </div>
      <div class="ob-trow">
        <button class="ob-tog ob-tog-full" id="ob-g-nb">⚧ Non-binary / Prefer not to say</button>
      </div>
    </div>

    <!-- STEP 3: Name + DOB -->
    <div class="ob-step" id="ob-s3">
      <div class="ob-lbl">Step 3 of 8</div>
      <div class="ob-h1">Tell us about yourself</div>
      <div class="ob-sub">Your name and age keep our community safe.</div>
      <div class="ob-f"><label>First Name</label><input id="ob-first" type="text" maxlength="30" placeholder="e.g. Jordan"></div>
      <div class="ob-f"><label>Last Name</label><input id="ob-last" type="text" maxlength="30" placeholder="e.g. Smith"></div>
      <div class="ob-f">
        <label>Date of Birth</label>
        <input id="ob-dob" type="date">
        <div class="ob-note">🔒 Must be 18 years or older to join</div>
      </div>
    </div>

    <!-- STEP 4: Reasons -->
    <div class="ob-step" id="ob-s4">
      <div class="ob-lbl">Step 4 of 8</div>
      <div class="ob-h1">What brings you to Fairway Friend?</div>
      <div class="ob-sub">Select all that apply.</div>
      <div class="ob-reasons">
        <button class="ob-rbtn" id="ob-r-buddy"><span class="ri">🤝</span><span><strong>Find a Golf Buddy</strong><small>Meet golfers who match your skill &amp; style</small></span></button>
        <button class="ob-rbtn" id="ob-r-tee"><span class="ri">⚡</span><span><strong>Last-Minute Tee Time Deals</strong><small>Score discounts on same-day open slots</small></span></button>
        <button class="ob-rbtn" id="ob-r-explore"><span class="ri">👀</span><span><strong>Just Checking It Out</strong><small>Exploring what Fairway Friend is all about</small></span></button>
      </div>
    </div>

    <!-- STEP 5: Game -->
    <div class="ob-step" id="ob-s5">
      <div class="ob-lbl">Step 5 of 8</div>
      <div class="ob-h1">Your game</div>
      <div class="ob-sub">We use this to match you with golfers at your level.</div>
      <div class="ob-hrow">
        <div class="ob-f"><label>Handicap</label><input id="ob-hdcp" type="text" maxlength="5" placeholder="e.g. 14.2"></div>
        <button class="ob-ghin">🔗 Link GHIN</button>
      </div>
      <div class="ob-f"><label>Zip Code</label><input id="ob-zip" type="text" maxlength="5" inputmode="numeric" placeholder="e.g. 33602"></div>
      <div id="ob-zip-note" class="ob-note" style="margin-top:-8px;margin-bottom:10px"></div>
      <div class="ob-f"><label>Home Course</label><input id="ob-course" type="text" maxlength="60" placeholder="e.g. Bayshore Golf Course"></div>
    </div>

    <!-- STEP 6: Vibes -->
    <div class="ob-step" id="ob-s6">
      <div class="ob-lbl">Step 6 of 8</div>
      <div class="ob-h1">What kind of golfer are you?</div>
      <div class="ob-sub">Pick everything that fits your vibe.</div>
      <div class="ob-chips">
        ${[['🎯','Competitive'],['😎','Casual'],['🍺','Drinker'],['🌿','420 Friendly'],
           ['🎵','Music on Cart'],['⚡','Fast Pace'],['🚶','Walker'],['🛺','Cart Only'],
           ['🌅','Early Bird'],['🌇','Twilight'],['📸','Social Poster'],['🤫','Low Key']]
          .map(([e,l])=>`<button class="ob-chip" data-vibe="${l}">${e} ${l}</button>`).join('')}
      </div>
    </div>

    <!-- STEP 7: Photo + Bio -->
    <div class="ob-step" id="ob-s7">
      <div class="ob-lbl">Step 7 of 8</div>
      <div class="ob-h1">Your profile</div>
      <div class="ob-sub">Add a photo and bio so golfers can get to know you.</div>
      <div class="ob-avatar-wrap">
        <div class="ob-avatar" id="ob-avatar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          <span>Upload Photo</span>
        </div>
        <input type="file" id="ob-photo" accept="image/*" style="display:none">
      </div>
      <div class="ob-f"><label>Bio</label><textarea id="ob-bio" maxlength="200" placeholder="e.g. Casual golfer, 18 handicap, love a cold beer on the back 9..."></textarea></div>
    </div>

    <!-- STEP 8: How heard -->
    <div class="ob-step" id="ob-s8">
      <div class="ob-lbl">Step 8 of 8</div>
      <div class="ob-h1">One last thing</div>
      <div class="ob-sub">How did you hear about Fairway Friend?</div>
      <div class="ob-heard">
        ${[['🤝','Friend or playing partner'],['📱','Social media'],
           ['⛳','At the golf course'],['🔍','Google / App Store'],['📺','Ad or promotion']]
          .map(([e,l])=>`<button class="ob-hbtn" data-heard="${l}">${e} ${l}</button>`).join('')}
      </div>
    </div>

    <!-- STEP 9: Success -->
    <div class="ob-step ob-success" id="ob-s9">
      <div class="ob-success-icon">⛳</div>
      <div class="ob-h1" style="margin-bottom:10px">You're on the tee!</div>
      <div class="ob-sub">Your Fairway Friend profile is ready. Time to find your perfect playing partner.</div>
    </div>

  </div><!-- /ob-card -->
</div><!-- /ob-page -->

<!-- sticky nav (hidden on step 0) -->
<div class="ob-nav" id="ob-nav">
  <button class="ob-btn" id="ob-main-btn">Continue</button>
  <button class="ob-back-btn hidden" id="ob-back-btn">← Back</button>
</div>`;

  _wire();
  _refresh();
}

// ── Wire all events ───────────────────────────────────────────
function _wire() {
  // Step 0: auth buttons → step 1
  ['ob-apple','ob-google','ob-email'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.onclick = () => _goTo(1);
  });

  // Step 0: sign in link → go back to auth screen
  const signinLink = document.getElementById('ob-signin-link');
  if (signinLink) signinLink.onclick = () => {
    if (typeof goScreen === 'function') goScreen('auth');
    else if (typeof safeUI === 'function') safeUI('goScreen','auth');
  };

  // Step 1: email/pw field listeners
  document.getElementById('ob-email-inp')?.addEventListener('input', e => { _data.email = e.target.value; });
  document.getElementById('ob-pw-inp')?.addEventListener('input', e => { _data.password = e.target.value; });
  document.getElementById('ob-pw-inp')?.addEventListener('keydown', e => { if(e.key==='Enter') _continue(); });

  // Step 2: gender
  [['ob-g-man','man'],['ob-g-woman','woman'],['ob-g-nb','nonbinary']].forEach(([id,val]) => {
    document.getElementById(id)?.addEventListener('click', () => {
      document.querySelectorAll('#ob-s2 .ob-tog').forEach(b => b.classList.remove('sel'));
      document.getElementById(id)?.classList.add('sel');
      _data.gender = val;
    });
  });

  // Step 3: name + dob
  document.getElementById('ob-first')?.addEventListener('input', e => { _data.firstName = e.target.value; });
  document.getElementById('ob-last')?.addEventListener('input', e => { _data.lastName = e.target.value; });
  document.getElementById('ob-dob')?.addEventListener('input', e => { _data.dob = e.target.value; });

  // Step 4: reasons
  [['ob-r-buddy','buddy'],['ob-r-tee','teetimes'],['ob-r-explore','explore']].forEach(([id,val]) => {
    document.getElementById(id)?.addEventListener('click', function() {
      this.classList.toggle('sel');
      const idx = _data.reasons.indexOf(val);
      if (idx >= 0) _data.reasons.splice(idx,1); else _data.reasons.push(val);
    });
  });

  // Step 5: game
  document.getElementById('ob-hdcp')?.addEventListener('input', e => { _data.handicap = e.target.value; });
  document.getElementById('ob-course')?.addEventListener('input', e => { _data.homeCourse = e.target.value; });
  document.getElementById('ob-zip')?.addEventListener('input', async e => {
    _data.zip = e.target.value;
    const note = document.getElementById('ob-zip-note');
    if (_data.zip.length === 5 && /^\d{5}$/.test(_data.zip)) {
      if (note) note.textContent = 'Looking up…';
      try {
        const r = await fetch('https://api.zippopotam.us/us/' + _data.zip);
        if (r.ok) {
          const d = await r.json();
          _data.city  = d.places?.[0]?.['place name'] || '';
          _data.state = d.places?.[0]?.['state abbreviation'] || '';
          if (note) note.textContent = _data.city ? '📍 ' + _data.city + ', ' + _data.state : '';
          // Geocode to get lat/lon for distance filtering
          try {
            const gk = 'geo_' + _data.city.toLowerCase().replace(/ /g,'_');
            const cached = sessionStorage.getItem(gk);
            if (cached) { const g=JSON.parse(cached); _data.lat=g.lat; _data.lon=g.lon; }
            else {
              const gd = await (await fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(_data.city)+'&count=1&language=en&format=json')).json();
              if (gd.results?.length) {
                _data.lat = gd.results[0].latitude;
                _data.lon = gd.results[0].longitude;
                sessionStorage.setItem(gk, JSON.stringify({lat:_data.lat,lon:_data.lon,ts:Date.now()}));
              }
            }
          } catch(_) {}
        }
      } catch(_) {}
    } else if (note) note.textContent = '';
  });

  // Step 6: vibes
  document.querySelectorAll('#ob-s6 .ob-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('sel');
      const v = btn.dataset.vibe;
      const idx = _data.vibes.indexOf(v);
      if (idx >= 0) _data.vibes.splice(idx,1); else _data.vibes.push(v);
    });
  });

  // Step 7: bio + photo
  document.getElementById('ob-bio')?.addEventListener('input', e => { _data.bio = e.target.value; });
  const avatar = document.getElementById('ob-avatar');
  const photoInput = document.getElementById('ob-photo');
  if (avatar && photoInput) {
    avatar.onclick = () => photoInput.click();
    photoInput.onchange = e => {
      const file = e.target.files?.[0];
      if (!file) return;
      _photoFile = file;
      const reader = new FileReader();
      reader.onload = ev => {
        avatar.style.backgroundImage = 'url(' + ev.target.result + ')';
        avatar.style.border = '2px solid #c9a84c';
        avatar.innerHTML = '';
      };
      reader.readAsDataURL(file);
    };
  }

  // Step 8: how heard
  document.querySelectorAll('#ob-s8 .ob-hbtn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#ob-s8 .ob-hbtn').forEach(b => b.classList.remove('sel'));
      btn.classList.add('sel');
      _data.howHeard = btn.dataset.heard;
    });
  });

  // Nav buttons
  document.getElementById('ob-main-btn')?.addEventListener('click', _continue);
  document.getElementById('ob-back-btn')?.addEventListener('click', () => { if (_cur > 1) _goTo(_cur - 1); });
}

// ── Refresh UI ────────────────────────────────────────────────
function _refresh() {
  const isLanding = _cur === 0;
  const isSuccess = _cur === 9;

  // Logo: hidden on landing (hero shows it) and success
  const logo = document.getElementById('ob-logo');
  if (logo) logo.style.display = (isLanding || isSuccess) ? 'none' : '';

  // Card flush on landing
  const card = document.getElementById('ob-card');
  if (card) {
    card.style.padding = isLanding ? '0' : '';
    card.style.overflow = isLanding ? 'hidden' : '';
  }

  // Progress bar
  const prog = document.getElementById('ob-prog');
  if (prog) prog.style.opacity = (isLanding || isSuccess) ? '0' : '1';
  for (let i = 0; i < TOTAL_STEPS; i++) {
    const bar = document.getElementById('ob-b' + i);
    if (!bar) continue;
    // steps 1-8 map to bars 0-7; step 1 = bar 0
    bar.className = 'ob-bar' + (i < _cur - 1 ? ' done' : i === _cur - 1 ? ' cur' : '');
  }

  // Show/hide steps
  for (let i = 0; i <= 9; i++) {
    const el = document.getElementById('ob-s' + i);
    if (el) el.classList.toggle('active', i === _cur);
  }

  // Sticky nav
  const nav = document.getElementById('ob-nav');
  if (nav) nav.style.display = isLanding ? 'none' : 'flex';

  // Button
  const mainBtn = document.getElementById('ob-main-btn');
  const backBtn = document.getElementById('ob-back-btn');
  if (mainBtn) {
    mainBtn.textContent = BTN_LABELS[_cur] || 'Continue';
    mainBtn.className = 'ob-btn' + (isSuccess ? ' green' : '');
    mainBtn.disabled = false;
  }
  if (backBtn) {
    backBtn.className = (_cur > 1 && !isSuccess) ? 'ob-back-btn' : 'ob-back-btn hidden';
  }
}

function _goTo(n) {
  _cur = n;
  _refresh();
  document.getElementById('screen-onboard')?.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Continue with validation ──────────────────────────────────
async function _continue() {
  // Step 9 = success → go to feed (save already done)
  if (_cur === 9) { _launchApp(); return; }

  // Step 8 → trigger save immediately, show success screen simultaneously
  if (_cur === 8) { _goTo(9); _launchApp(); return; }

  // Step 1: create Firebase account
  if (_cur === 1) {
    const email = _data.email.trim();
    const pass  = _data.password;
    const errEl = document.getElementById('ob-s1-err');
    if (!email || !pass) { _showErr(errEl, 'Please fill in all fields.'); return; }
    if (pass.length < 6) { _showErr(errEl, 'Password must be at least 6 characters.'); return; }
    const btn = document.getElementById('ob-main-btn');
    btn.disabled = true; btn.textContent = 'Creating account…';
    try {
      const { getAuth, createUserWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
      const cred = await createUserWithEmailAndPassword(getAuth(), email, pass);
      window._currentUser = cred.user;
      // Create minimal Firestore doc so auth listener doesn't route to wrong place
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid, email, displayName: 'Golfer',
        onboardComplete: false, joinedAt: serverTimestamp(),
      });
      if (errEl) errEl.style.display = 'none';
      _goTo(2);
    } catch(e) {
      btn.disabled = false; btn.textContent = 'Continue';
      const msgs = {
        'auth/email-already-in-use': 'An account with this email already exists.',
        'auth/invalid-email':        'Please enter a valid email address.',
        'auth/weak-password':        'Password must be at least 6 characters.',
        'auth/network-request-failed':'Network error. Check your connection.',
      };
      _showErr(errEl, msgs[e.code] || 'Could not create account. Please try again.');
    }
    return;
  }

  // Step 3: name required + age check
  if (_cur === 3) {
    if (!(_data.firstName || '').trim()) { showToast('Please enter your first name'); return; }
    if (_data.dob) {
      const age = (Date.now() - new Date(_data.dob)) / (365.25 * 24 * 3600 * 1000);
      if (age < 18) { showToast('You must be 18 or older to join'); return; }
    }
  }

  _goTo(_cur + 1);
}

function _showErr(el, msg) {
  if (!el) { showToast(msg); return; }
  el.textContent = msg;
  el.style.display = 'block';
}

// ── Save profile to Firestore ─────────────────────────────────
async function _launchApp() {
  const user = window._currentUser;
  if (!user) return;
  const btn = document.getElementById('ob-main-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    let photoURL = null;
    if (_photoFile) {
      try {
        const storageRef = ref(storage, 'avatars/' + user.uid);
        await uploadBytes(storageRef, _photoFile);
        photoURL = await getDownloadURL(storageRef);
      } catch(_) {}
    }

    const city = _data.city && _data.state
      ? _data.city + ', ' + _data.state
      : _data.zip || '';

    const displayName = [_data.firstName, _data.lastName].filter(Boolean).join(' ').trim() || 'Golfer';

    // Update auth display name
    try {
      const { getAuth, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
      await updateProfile(getAuth().currentUser, { displayName, photoURL: photoURL || null });
    } catch(_) {}

    // Save full profile
    await setDoc(doc(db, 'users', user.uid), {
      displayName, firstName: _data.firstName, lastName: _data.lastName,
      dob: _data.dob, gender: _data.gender,
      handicap: parseFloat(_data.handicap) || 18,
      city, zip: _data.zip, homeCourse: _data.homeCourse,
      vibes: _data.vibes, bio: _data.bio,
      photoURL: photoURL || null,
      reasons: _data.reasons, howHeard: _data.howHeard,
      friends: [], roundCount: 0, newToArea: true,
      onboardComplete: true,
      ...((_data.lat && _data.lon) ? { lat: _data.lat, lon: _data.lon } : {}),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    window._weatherCity = city;

    // Show success then go to feed
    _goTo(9);
    setTimeout(() => {
      if (typeof goScreen === 'function') {
        goScreen('feed');
        document.getElementById('bottom-nav').style.display = 'flex';
        if (typeof initFeed === 'function') { initFeed(); initNearbyPlayers(); }
        if (window.UI?.refreshWeather) window.UI.refreshWeather();
      } else window.location.reload();
      showToast('Welcome to Fairway Friend! 🏌️');
    }, 2200);

  } catch(e) {
    console.error('Onboard save error:', e);
    showToast('Could not save profile. Please try again.');
    if (btn) { btn.disabled = false; btn.textContent = "Let's Golf 🏌️"; }
  }
}
