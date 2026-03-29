// ============================================================
//  FAIRWAY FRIEND — Premium Onboarding Flow (8 steps)
// ============================================================
// Handles the multi-step registration UI injected into screen-onboard

import { db, storage } from "./firebase-config.js?v=26";
import {
  doc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { showToast, esc } from "./ui.js?v=26";

// ── State ────────────────────────────────────────────────────
let _step = 0;
let _photoFile = null;
let _data = {
  gender: null, firstName: '', lastName: '', dob: '',
  reasons: [], handicap: '', zip: '', homeCourse: '',
  vibes: [], bio: '', photoURL: null, howHeard: null
};

const TOTAL_STEPS = 8;

// ── Build the full onboard HTML into screen-onboard ──────────
export function buildOnboardScreen() {
  const screen = document.getElementById('screen-onboard');
  if (!screen || screen.dataset.built) return;
  screen.dataset.built = '1';

  screen.innerHTML = `
<style>
  #screen-onboard {
    min-height: 100vh; background: #1a3a2a; overflow-y: auto;
    -webkit-overflow-scrolling: touch; position: relative; font-family: 'DM Sans', sans-serif;
  }
  #screen-onboard::before {
    content:''; position:fixed; inset:0; pointer-events:none; z-index:0;
    background: radial-gradient(ellipse at 20% 50%,rgba(61,122,82,.15) 0%,transparent 60%),
      radial-gradient(ellipse at 80% 20%,rgba(201,168,76,.08) 0%,transparent 50%);
  }
  .ob-wrap { position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;padding:28px 20px 120px; }
  .ob-logo { text-align:center;margin-bottom:18px; }
  .ob-logo-icon { width:56px;height:56px;background:#2d5a3d;border-radius:16px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:10px;box-shadow:0 8px 32px rgba(0,0,0,.3); }
  .ob-wordmark { font-family:'Playfair Display',serif;font-size:22px;font-weight:700; }
  .ob-wordmark .gn { color:#3d7a52; } .ob-wordmark .cr { color:#f5f0e8; }
  .ob-progress { display:flex;gap:5px;width:100%;max-width:440px;margin-bottom:16px;transition:opacity .3s; }
  .ob-bar { flex:1;height:3px;background:rgba(255,255,255,.1);border-radius:2px;transition:background .4s; }
  .ob-bar.done { background:#3d7a52; } .ob-bar.cur { background:#c9a84c; }
  .ob-card { width:100%;max-width:440px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:22px;padding:26px 22px;backdrop-filter:blur(20px);box-shadow:0 24px 64px rgba(0,0,0,.3); }
  .ob-step { display:none; } .ob-step.active { display:block;animation:obSlide .3s ease both; }
  @keyframes obSlide { from{opacity:0;transform:translateX(14px)} to{opacity:1;transform:translateX(0)} }
  .ob-lbl { font-size:11px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:#c9a84c;margin-bottom:7px; }
  .ob-title { font-family:'Playfair Display',serif;font-size:22px;font-weight:600;color:#fff;margin-bottom:5px;line-height:1.25; }
  .ob-sub { font-size:13px;color:rgba(255,255,255,.55);margin-bottom:20px;line-height:1.5; }
  .ob-field { margin-bottom:13px; }
  .ob-field label { display:block;font-size:11px;font-weight:500;letter-spacing:.5px;color:rgba(255,255,255,.5);margin-bottom:6px;text-transform:uppercase; }
  .ob-field input, .ob-field textarea {
    width:100%;box-sizing:border-box;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
    border-radius:11px;padding:12px 14px;font-family:'DM Sans',sans-serif;font-size:15px;color:#fff;
    outline:none;transition:all .2s;-webkit-appearance:none;
  }
  .ob-field input::placeholder, .ob-field textarea::placeholder { color:rgba(255,255,255,.25); }
  .ob-field input:focus, .ob-field textarea:focus { border-color:#c9a84c;background:rgba(255,255,255,.09);box-shadow:0 0 0 3px rgba(201,168,76,.1); }
  .ob-field textarea { resize:none;height:80px; }
  .ob-field .ob-note { font-size:11px;color:rgba(255,255,255,.4);margin-top:5px; }
  .ob-toggle-row { display:flex;gap:9px;margin-bottom:9px; }
  .ob-tog { flex:1;padding:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:11px;color:rgba(255,255,255,.8);font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s; }
  .ob-tog.sel { background:rgba(201,168,76,.15);border-color:#c9a84c;color:#e8c97a; }
  .ob-reason { display:flex;flex-direction:column;gap:9px; }
  .ob-reason-btn { padding:14px 15px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:13px;color:rgba(255,255,255,.8);font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;transition:all .2s;text-align:left;display:flex;align-items:center;gap:13px; }
  .ob-reason-btn .ri { font-size:20px;width:26px;text-align:center; }
  .ob-reason-btn strong { display:block;font-weight:500;color:#fff;margin-bottom:2px;font-size:13px; }
  .ob-reason-btn small { color:rgba(255,255,255,.45);font-size:12px; }
  .ob-reason-btn.sel { background:rgba(61,122,82,.2);border-color:#3d7a52; }
  .ob-hdcp-row { display:flex;gap:9px;align-items:flex-end;margin-bottom:13px; }
  .ob-hdcp-row .ob-field { flex:1;margin-bottom:0; }
  .ob-ghin { padding:12px 13px;background:rgba(61,122,82,.2);border:1px solid #3d7a52;border-radius:11px;color:#3d7a52;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;height:46px; }
  .ob-chips { display:flex;flex-wrap:wrap;gap:7px; }
  .ob-chip { padding:8px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:100px;color:rgba(255,255,255,.8);font-family:'DM Sans',sans-serif;font-size:12px;cursor:pointer;transition:all .2s; }
  .ob-chip.sel { background:rgba(201,168,76,.15);border-color:#c9a84c;color:#e8c97a; }
  .ob-avatar-wrap { display:flex;justify-content:center;margin-bottom:16px; }
  .ob-avatar { width:84px;height:84px;border-radius:50%;background:rgba(255,255,255,.06);border:2px dashed rgba(255,255,255,.2);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;color:rgba(255,255,255,.4);font-size:11px;gap:5px;transition:all .2s;background-size:cover;background-position:center; }
  .ob-heard { display:flex;flex-direction:column;gap:7px; }
  .ob-heard-btn { padding:12px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:rgba(255,255,255,.8);font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;text-align:left;transition:all .2s; }
  .ob-heard-btn.sel { background:rgba(201,168,76,.12);border-color:#c9a84c;color:#e8c97a; }
  .ob-success { text-align:center; }
  .ob-success-icon { width:76px;height:76px;background:rgba(61,122,82,.2);border:2px solid #3d7a52;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;font-size:34px;animation:obPop .5s cubic-bezier(.175,.885,.32,1.275) both; }
  @keyframes obPop { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }
  .ob-sticky { position:fixed;bottom:0;left:0;right:0;z-index:99;padding:14px 20px 36px;background:linear-gradient(to top,#1a3a2a 60%,transparent);display:flex;flex-direction:column;align-items:center;gap:2px; }
  .ob-btn-main { width:100%;max-width:440px;padding:15px;background:#c9a84c;border:none;border-radius:13px;color:#1a3a2a;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 4px 20px rgba(201,168,76,.3);transition:all .2s; }
  .ob-btn-main:active { transform:scale(.98); }
  .ob-btn-main.green { background:#3d7a52;box-shadow:0 4px 20px rgba(61,122,82,.3); }
  .ob-btn-back { background:none;border:none;color:rgba(255,255,255,.4);font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;padding:7px 0 0;transition:color .2s; }
  .ob-btn-back:hover { color:#fff; }
  .ob-btn-back.hidden { visibility:hidden; }
</style>

<div class="ob-wrap">
  <div class="ob-logo">
    <div class="ob-logo-icon">
      <svg viewBox="0 0 36 36" fill="none" width="32" height="32">
        <circle cx="12" cy="28" r="5" fill="white"/>
        <line x1="12" y1="23" x2="12" y2="6" stroke="white" stroke-width="2"/>
        <polygon points="12,6 26,10 12,14" fill="#c9a84c"/>
      </svg>
    </div>
    <div class="ob-wordmark"><span class="gn">Fairway </span><span class="cr">Friend</span></div>
  </div>

  <div class="ob-progress" id="ob-progress" style="opacity:0">
    ${Array.from({length:TOTAL_STEPS},(_,i)=>`<div class="ob-bar" id="ob-bar-${i}"></div>`).join('')}
  </div>

  <div class="ob-card">

    <!-- STEP 1: Gender -->
    <div class="ob-step active" id="ob-1">
      <div class="ob-lbl">Step 1 of 8</div>
      <div class="ob-title">How do you identify?</div>
      <div class="ob-sub">Help us find you the best matches on the course.</div>
      <div class="ob-toggle-row">
        <button class="ob-tog" onclick="window._obToggle(this,'gender','man')">♂ Man</button>
        <button class="ob-tog" onclick="window._obToggle(this,'gender','woman')">♀ Woman</button>
      </div>
      <div class="ob-toggle-row">
        <button class="ob-tog" style="flex:none;width:100%" onclick="window._obToggle(this,'gender','nonbinary')">⚧ Non-binary / Prefer not to say</button>
      </div>
    </div>

    <!-- STEP 2: Name + DOB -->
    <div class="ob-step" id="ob-2">
      <div class="ob-lbl">Step 2 of 8</div>
      <div class="ob-title">Tell us about yourself</div>
      <div class="ob-sub">Your name and birthday keep our community safe.</div>
      <div class="ob-field"><label>First Name</label><input id="ob-first" type="text" maxlength="30" placeholder="e.g. Jordan" oninput="window._obField('firstName',this.value)"></div>
      <div class="ob-field"><label>Last Name</label><input id="ob-last" type="text" maxlength="30" placeholder="e.g. Smith" oninput="window._obField('lastName',this.value)"></div>
      <div class="ob-field">
        <label>Date of Birth</label>
        <input id="ob-dob" type="date" oninput="window._obField('dob',this.value)">
        <div class="ob-note">🔒 Must be 18 or older to join</div>
      </div>
    </div>

    <!-- STEP 3: Reasons -->
    <div class="ob-step" id="ob-3">
      <div class="ob-lbl">Step 3 of 8</div>
      <div class="ob-title">What brings you here?</div>
      <div class="ob-sub">Select all that apply.</div>
      <div class="ob-reason">
        <button class="ob-reason-btn" onclick="window._obReason(this,'buddy')">
          <span class="ri">🤝</span>
          <span><strong>Find a Golf Buddy</strong><small>Meet golfers who match your skill &amp; style</small></span>
        </button>
        <button class="ob-reason-btn" onclick="window._obReason(this,'teetimes')">
          <span class="ri">⚡</span>
          <span><strong>Last-Minute Tee Times</strong><small>Score discounts on same-day open slots</small></span>
        </button>
        <button class="ob-reason-btn" onclick="window._obReason(this,'explore')">
          <span class="ri">👀</span>
          <span><strong>Just Checking It Out</strong><small>Exploring what Fairway Friend is all about</small></span>
        </button>
      </div>
    </div>

    <!-- STEP 4: Game details -->
    <div class="ob-step" id="ob-4">
      <div class="ob-lbl">Step 4 of 8</div>
      <div class="ob-title">Your game</div>
      <div class="ob-sub">We use this to match you with golfers at your level.</div>
      <div class="ob-hdcp-row">
        <div class="ob-field"><label>Handicap</label><input id="ob-hdcp" type="text" maxlength="5" placeholder="e.g. 14.2" oninput="window._obField('handicap',this.value)"></div>
        <button class="ob-ghin">🔗 Link GHIN</button>
      </div>
      <div class="ob-field"><label>Zip Code</label><input id="ob-zip" type="text" maxlength="5" inputmode="numeric" placeholder="e.g. 33602" oninput="window._obZip(this.value)"></div>
      <div class="ob-field"><label>Home Course</label><input id="ob-course" type="text" maxlength="60" placeholder="e.g. TPC Tampa Bay" oninput="window._obField('homeCourse',this.value)"></div>
      <div id="ob-loc-note" style="font-size:12px;color:rgba(255,255,255,.4);margin-top:-6px"></div>
    </div>

    <!-- STEP 5: Vibes -->
    <div class="ob-step" id="ob-5">
      <div class="ob-lbl">Step 5 of 8</div>
      <div class="ob-title">What kind of golfer are you?</div>
      <div class="ob-sub">Pick everything that fits your vibe.</div>
      <div class="ob-chips">
        ${[['🎯','Competitive'],['😎','Casual'],['🍺','Social Drinker'],['🌿','420 Friendly'],['🎵','Music on Cart'],
           ['⚡','Fast Pace'],['🚶','Walker'],['🛺','Cart Only'],['🌅','Early Bird'],['🌇','Twilight'],
           ['📸','Social Poster'],['🤫','Low Key'],['🏆','Score Keeper'],['🌊','Course Explorer']
          ].map(([e,l])=>`<button class="ob-chip" onclick="window._obChip(this,'${l}')">${e} ${l}</button>`).join('')}
      </div>
    </div>

    <!-- STEP 6: Photo + Bio -->
    <div class="ob-step" id="ob-6">
      <div class="ob-lbl">Step 6 of 8</div>
      <div class="ob-title">Your profile</div>
      <div class="ob-sub">Add a photo so your golf buddies can find you.</div>
      <div class="ob-avatar-wrap">
        <div class="ob-avatar" id="ob-avatar" onclick="document.getElementById('ob-photo-input').click()">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          <span>Add Photo</span>
        </div>
        <input type="file" id="ob-photo-input" accept="image/*" style="display:none" onchange="window._obPhoto(event)">
      </div>
      <div class="ob-field"><label>Bio</label><textarea id="ob-bio" maxlength="200" placeholder="e.g. Casual 18 handicap, love a cold beer on the back 9..." oninput="window._obField('bio',this.value)"></textarea></div>
    </div>

    <!-- STEP 7: How heard -->
    <div class="ob-step" id="ob-7">
      <div class="ob-lbl">Step 7 of 8</div>
      <div class="ob-title">One last thing</div>
      <div class="ob-sub">How did you hear about Fairway Friend?</div>
      <div class="ob-heard">
        ${[['🤝','Friend or playing partner'],['📱','Social media'],['⛳','At the golf course'],['🔍','Google / App Store'],['📺','Ad or promotion']
          ].map(([e,l])=>`<button class="ob-heard-btn" onclick="window._obHeard(this,'${l}')">${e} ${l}</button>`).join('')}
      </div>
    </div>

    <!-- STEP 8: Success -->
    <div class="ob-step ob-success" id="ob-8">
      <div class="ob-success-icon">⛳</div>
      <div class="ob-title" style="margin-bottom:10px">You're on the tee!</div>
      <div class="ob-sub">Your Fairway Friend profile is ready. Time to find your perfect playing partner.</div>
    </div>

  </div>
</div>

<!-- Sticky footer -->
<div class="ob-sticky" id="ob-sticky">
  <button class="ob-btn-main" id="ob-main-btn" onclick="window._obContinue()">Continue</button>
  <button class="ob-btn-back hidden" id="ob-back-btn" onclick="window._obBack()">← Back</button>
</div>
`;

  // Wire up JS handlers
  _step = 1;
  _refreshUI();
}

// ── Step navigation ────────────────────────────────────────
function _refreshUI() {
  // Show/hide steps
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const el = document.getElementById('ob-'+i);
    if (el) el.classList.toggle('active', i === _step);
  }
  // Progress bars
  const prog = document.getElementById('ob-progress');
  if (prog) {
    prog.style.opacity = (_step === 1 || _step === TOTAL_STEPS) ? '0' : '1';
    for (let i = 0; i < TOTAL_STEPS; i++) {
      const bar = document.getElementById('ob-bar-'+i);
      if (!bar) continue;
      bar.className = 'ob-bar' + (i < _step-1 ? ' done' : i === _step-1 ? ' cur' : '');
    }
  }
  // Buttons
  const mainBtn = document.getElementById('ob-main-btn');
  const backBtn = document.getElementById('ob-back-btn');
  if (mainBtn) {
    const labels = {1:'Continue',2:'Continue',3:'Continue',4:'Continue',5:'Continue',6:'Continue',7:'Finish Up →',8:"Let's Golf 🏌️"};
    mainBtn.textContent = labels[_step] || 'Continue';
    mainBtn.className = 'ob-btn-main' + (_step === TOTAL_STEPS ? ' green' : '');
  }
  if (backBtn) {
    backBtn.className = _step > 1 && _step < TOTAL_STEPS ? 'ob-btn-back' : 'ob-btn-back hidden';
  }
}

// ── Global handlers called from inline onclick ─────────────
window._obToggle = (btn, field, val) => {
  // Single-select within same field
  const all = document.querySelectorAll(`.ob-tog[onclick*="'${field}'"]`);
  all.forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  _data[field] = val;
};

window._obField = (field, val) => { _data[field] = val; };

window._obReason = (btn, val) => {
  btn.classList.toggle('sel');
  const idx = _data.reasons.indexOf(val);
  if (idx >= 0) _data.reasons.splice(idx, 1);
  else _data.reasons.push(val);
};

window._obChip = (btn, val) => {
  btn.classList.toggle('sel');
  const idx = _data.vibes.indexOf(val);
  if (idx >= 0) _data.vibes.splice(idx, 1);
  else _data.vibes.push(val);
};

window._obHeard = (btn, val) => {
  document.querySelectorAll('.ob-heard-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  _data.howHeard = val;
};

window._obPhoto = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  _photoFile = file;
  const reader = new FileReader();
  reader.onload = ev => {
    const av = document.getElementById('ob-avatar');
    if (av) {
      av.style.backgroundImage = `url(${ev.target.result})`;
      av.style.border = '2px solid #c9a84c';
      av.innerHTML = '';
    }
  };
  reader.readAsDataURL(file);
};

window._obZip = async (zip) => {
  _data.zip = zip;
  if (zip.length === 5 && /^\d{5}$/.test(zip)) {
    const note = document.getElementById('ob-loc-note');
    if (note) note.textContent = 'Looking up location…';
    try {
      const r = await fetch(`https://api.zippopotam.us/us/${zip}`);
      if (r.ok) {
        const d = await r.json();
        const city = d.places?.[0]?.['place name'] || '';
        const state = d.places?.[0]?.['state abbreviation'] || '';
        _data.city = city; _data.state = state;
        if (note) note.textContent = `📍 ${city}, ${state}`;
      }
    } catch(_) {}
  }
};

window._obContinue = () => {
  if (_step === TOTAL_STEPS) { _finishOnboard(); return; }
  // Validation
  if (_step === 2) {
    if (!document.getElementById('ob-first')?.value.trim()) { showToast('Please enter your first name'); return; }
    const dob = document.getElementById('ob-dob')?.value;
    if (dob) {
      const age = (Date.now() - new Date(dob)) / (365.25*24*3600*1000);
      if (age < 18) { showToast('You must be 18 or older to join'); return; }
    }
  }
  _step++;
  _refreshUI();
  document.getElementById('screen-onboard')?.scrollTo({ top:0, behavior:'smooth' });
};

window._obBack = () => {
  if (_step > 1) { _step--; _refreshUI(); }
};

// ── Save to Firestore ──────────────────────────────────────
async function _finishOnboard() {
  const user = window._currentUser;
  if (!user) return;
  const btn = document.getElementById('ob-main-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    // Upload photo if provided
    let photoURL = null;
    if (_photoFile) {
      try {
        const storageRef = ref(storage, `avatars/${user.uid}`);
        await uploadBytes(storageRef, _photoFile);
        photoURL = await getDownloadURL(storageRef);
      } catch(_) {}
    }

    const city = _data.city && _data.state
      ? `${_data.city}, ${_data.state}`
      : _data.zip ? _data.zip : '';

    const displayName = [_data.firstName, _data.lastName].filter(Boolean).join(' ') || 'Golfer';

    // Update Firestore user doc
    await setDoc(doc(db, 'users', user.uid), {
      displayName,
      firstName:      _data.firstName,
      lastName:       _data.lastName,
      dob:            _data.dob,
      gender:         _data.gender,
      handicap:       parseFloat(_data.handicap) || 18,
      city,
      zip:            _data.zip,
      homeCourse:     _data.homeCourse,
      vibes:          _data.vibes,
      bio:            _data.bio,
      photoURL:       photoURL || null,
      reasons:        _data.reasons,
      howHeard:       _data.howHeard,
      onboardComplete: true,
      updatedAt:      serverTimestamp(),
    }, { merge: true });

    // Update Firebase Auth display name
    try {
      const { updateProfile } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
      await updateProfile(user, { displayName, photoURL: photoURL||null });
    } catch(_) {}

    // Show step 8 success then redirect
    _step = 8; _refreshUI();
    setTimeout(() => {
      window._weatherCity = city;
      if (typeof window.goScreen === 'function') {
        goScreen('feed');
        document.getElementById('bottom-nav').style.display = 'flex';
        if (typeof window._initFeed === 'function') window._initFeed();
        showToast('Welcome to Fairway Friend! 🏌️');
      } else {
        window.location.reload();
      }
    }, 2000);

  } catch(e) {
    console.error('Onboard save error:', e);
    showToast('Could not save profile. Please try again.');
    if (btn) { btn.disabled = false; btn.textContent = "Let's Golf 🏌️"; }
  }
}
