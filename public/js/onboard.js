// ============================================================
//  FAIRWAY FRIEND — Premium Onboarding (matches design artifact)
// ============================================================

import { db, storage } from "./firebase-config.js?v=27";
import {
  doc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { showToast, esc } from "./ui.js?v=27";

let _step = 1;
let _photoFile = null;
let _data = {
  gender: null, firstName: '', lastName: '', dob: '',
  reasons: [], handicap: '', zip: '', homeCourse: '',
  city: '', state: '', vibes: [], bio: '', howHeard: null
};

const TOTAL = 8;

export function buildOnboardScreen() {
  const screen = document.getElementById('screen-onboard');
  if (!screen || screen.dataset.built) return;
  screen.dataset.built = '1';
  _step = 1;
  _data = { gender:null, firstName:'', lastName:'', dob:'', reasons:[], handicap:'', zip:'', homeCourse:'', city:'', state:'', vibes:[], bio:'', howHeard:null };
  _photoFile = null;

  screen.innerHTML = `
<style>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500&display=swap');
#screen-onboard {
  font-family:'DM Sans',sans-serif;
  background:#1a3a2a;
  min-height:100vh;
  overflow-y:auto;
  -webkit-overflow-scrolling:touch;
  position:relative;
}
#screen-onboard::before {
  content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
  background:radial-gradient(ellipse at 20% 50%,rgba(61,122,82,.15) 0%,transparent 60%),
    radial-gradient(ellipse at 80% 20%,rgba(201,168,76,.08) 0%,transparent 50%),
    radial-gradient(ellipse at 60% 80%,rgba(45,90,61,.2) 0%,transparent 50%);
}
#screen-onboard::after {
  content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
  background-image:linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px);
  background-size:40px 40px;
}
.ob-page { position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;padding:32px 20px 130px; }
.ob-logo { text-align:center;margin-bottom:22px;animation:ob-fade-down .6s ease both; }
@keyframes ob-fade-down { from{opacity:0;transform:translateY(-16px)} to{opacity:1;transform:translateY(0)} }
.ob-logo-icon {
  width:64px;height:64px;background:#2d5a3d;border-radius:18px;
  display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;
  box-shadow:0 8px 32px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.1);
}
.ob-wordmark { font-family:'Playfair Display',serif;font-size:26px;font-weight:700; }
.ob-wordmark .gn { color:#3d7a52; } .ob-wordmark .cr { color:#f5f0e8; }
.ob-track {
  display:flex;gap:6px;width:100%;max-width:480px;
  margin-bottom:18px;transition:opacity .3s;
}
.ob-bar { flex:1;height:3px;background:rgba(255,255,255,.1);border-radius:2px;transition:background .4s; }
.ob-bar.done { background:#3d7a52; } .ob-bar.cur { background:#c9a84c; }
.ob-card {
  width:100%;max-width:480px;
  background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);
  border-radius:24px;padding:28px 24px;
  backdrop-filter:blur(20px);
  box-shadow:0 24px 64px rgba(0,0,0,.3);
}
.ob-step { display:none; }
.ob-step.active { display:block;animation:ob-slide .35s ease both; }
@keyframes ob-slide { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
.ob-lbl { font-size:11px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:#c9a84c;margin-bottom:8px; }
.ob-h1 { font-family:'Playfair Display',serif;font-size:24px;font-weight:600;color:#fff;margin-bottom:6px;line-height:1.25; }
.ob-sub { font-size:14px;color:rgba(255,255,255,.55);margin-bottom:22px;line-height:1.5; }

/* Fields */
.ob-f { margin-bottom:14px; }
.ob-f label { display:block;font-size:11px;font-weight:500;letter-spacing:.5px;color:rgba(255,255,255,.5);margin-bottom:7px;text-transform:uppercase; }
.ob-f input, .ob-f textarea {
  width:100%;box-sizing:border-box;
  background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
  border-radius:12px;padding:13px 15px;
  font-family:'DM Sans',sans-serif;font-size:15px;color:#fff;
  outline:none;transition:all .2s;-webkit-appearance:none;
}
.ob-f input::placeholder,.ob-f textarea::placeholder { color:rgba(255,255,255,.25); }
.ob-f input:focus,.ob-f textarea:focus {
  border-color:#c9a84c;background:rgba(255,255,255,.09);
  box-shadow:0 0 0 3px rgba(201,168,76,.1);
}
.ob-f textarea { resize:none;height:85px; }
.ob-note { font-size:11px;color:rgba(255,255,255,.4);margin-top:5px; }

/* Toggle buttons */
.ob-trow { display:flex;gap:10px;margin-bottom:10px; }
.ob-tog {
  flex:1;padding:13px;
  background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
  border-radius:12px;color:rgba(255,255,255,.8);
  font-family:'DM Sans',sans-serif;font-size:14px;font-weight:500;
  cursor:pointer;transition:all .2s;
}
.ob-tog.sel { background:rgba(201,168,76,.15);border-color:#c9a84c;color:#e8c97a; }
.ob-tog-full { width:100%;flex:none; }

/* Reason cards */
.ob-reasons { display:flex;flex-direction:column;gap:10px; }
.ob-rbtn {
  padding:15px 16px;
  background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
  border-radius:14px;color:rgba(255,255,255,.8);
  font-family:'DM Sans',sans-serif;font-size:14px;
  cursor:pointer;transition:all .2s;text-align:left;
  display:flex;align-items:center;gap:14px;
}
.ob-rbtn .ri { font-size:20px;width:28px;text-align:center; }
.ob-rbtn strong { display:block;font-weight:500;color:#fff;margin-bottom:2px;font-size:14px; }
.ob-rbtn small { color:rgba(255,255,255,.45);font-size:12px; }
.ob-rbtn.sel { background:rgba(61,122,82,.2);border-color:#3d7a52; }

/* Handicap row */
.ob-hrow { display:flex;gap:10px;align-items:flex-end;margin-bottom:14px; }
.ob-hrow .ob-f { flex:1;margin-bottom:0; }
.ob-ghin {
  padding:13px 14px;background:rgba(61,122,82,.2);border:1px solid #3d7a52;
  border-radius:12px;color:#3d7a52;font-family:'DM Sans',sans-serif;
  font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;height:47px;
}

/* Chips */
.ob-chips { display:flex;flex-wrap:wrap;gap:8px; }
.ob-chip {
  padding:9px 15px;
  background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
  border-radius:100px;color:rgba(255,255,255,.8);
  font-family:'DM Sans',sans-serif;font-size:13px;
  cursor:pointer;transition:all .2s;
}
.ob-chip.sel { background:rgba(201,168,76,.15);border-color:#c9a84c;color:#e8c97a; }

/* Photo */
.ob-photo-wrap { display:flex;justify-content:center;margin-bottom:18px; }
.ob-avatar {
  width:88px;height:88px;border-radius:50%;
  background:rgba(255,255,255,.06);border:2px dashed rgba(255,255,255,.2);
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  cursor:pointer;color:rgba(255,255,255,.4);font-size:11px;gap:5px;
  transition:all .2s;background-size:cover;background-position:center;
}

/* Heard */
.ob-heard { display:flex;flex-direction:column;gap:8px; }
.ob-hbtn {
  padding:12px 15px;
  background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
  border-radius:10px;color:rgba(255,255,255,.8);
  font-family:'DM Sans',sans-serif;font-size:13px;
  cursor:pointer;text-align:left;transition:all .2s;
}
.ob-hbtn.sel { background:rgba(201,168,76,.12);border-color:#c9a84c;color:#e8c97a; }

/* Success */
.ob-success { text-align:center; }
.ob-success-icon {
  width:80px;height:80px;
  background:rgba(61,122,82,.2);border:2px solid #3d7a52;
  border-radius:50%;display:flex;align-items:center;justify-content:center;
  margin:0 auto 20px;font-size:36px;
  animation:ob-pop .5s cubic-bezier(.175,.885,.32,1.275) both;
}
@keyframes ob-pop { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }

/* Sticky footer */
.ob-nav {
  position:fixed;bottom:0;left:0;right:0;z-index:99;
  padding:16px 24px 40px;
  background:linear-gradient(to top,#1a3a2a 60%,transparent);
  display:flex;flex-direction:column;align-items:center;gap:2px;
}
.ob-btn-main {
  width:100%;max-width:480px;padding:16px;
  background:#c9a84c;border:none;border-radius:14px;
  color:#1a3a2a;font-family:'DM Sans',sans-serif;
  font-size:15px;font-weight:600;cursor:pointer;
  box-shadow:0 4px 20px rgba(201,168,76,.3);
  transition:all .2s;
}
.ob-btn-main:active { transform:scale(.98); }
.ob-btn-main.success { background:#3d7a52;box-shadow:0 4px 20px rgba(61,122,82,.3); }
.ob-btn-back {
  background:none;border:none;color:rgba(255,255,255,.45);
  font-family:'DM Sans',sans-serif;font-size:13px;
  cursor:pointer;padding:8px 0 0;transition:color .2s;
}
.ob-btn-back:hover { color:#fff; }
.ob-btn-back.hidden { visibility:hidden; }
</style>

<div class="ob-page">
  <!-- Logo -->
  <div class="ob-logo">
    <div class="ob-logo-icon">
      <svg viewBox="0 0 36 36" fill="none" width="36" height="36">
        <circle cx="12" cy="28" r="5" fill="white"/>
        <line x1="12" y1="23" x2="12" y2="6" stroke="white" stroke-width="2"/>
        <polygon points="12,6 26,10 12,14" fill="#c9a84c"/>
      </svg>
    </div>
    <div class="ob-wordmark"><span class="gn">Fairway </span><span class="cr">Friend</span></div>
  </div>

  <!-- Progress -->
  <div class="ob-track" id="ob-track" style="opacity:0">
    ${Array.from({length:TOTAL},(_,i)=>`<div class="ob-bar" id="ob-b${i}"></div>`).join('')}
  </div>

  <!-- Card -->
  <div class="ob-card">

    <!-- Step 1: Gender -->
    <div class="ob-step active" id="ob-s1">
      <div class="ob-lbl">Step 1 of 8</div>
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

    <!-- Step 2: Name + DOB -->
    <div class="ob-step" id="ob-s2">
      <div class="ob-lbl">Step 2 of 8</div>
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

    <!-- Step 3: Reasons -->
    <div class="ob-step" id="ob-s3">
      <div class="ob-lbl">Step 3 of 8</div>
      <div class="ob-h1">What brings you to Fairway Friend?</div>
      <div class="ob-sub">Select all that apply.</div>
      <div class="ob-reasons">
        <button class="ob-rbtn" id="ob-r-buddy">
          <span class="ri">🤝</span>
          <span><strong>Find a Golf Buddy</strong><small>Meet golfers who match your skill &amp; style</small></span>
        </button>
        <button class="ob-rbtn" id="ob-r-tee">
          <span class="ri">⚡</span>
          <span><strong>Last-Minute Tee Time Deals</strong><small>Score discounts on same-day open slots</small></span>
        </button>
        <button class="ob-rbtn" id="ob-r-explore">
          <span class="ri">👀</span>
          <span><strong>Just Checking It Out</strong><small>Exploring what Fairway Friend is all about</small></span>
        </button>
      </div>
    </div>

    <!-- Step 4: Your Game -->
    <div class="ob-step" id="ob-s4">
      <div class="ob-lbl">Step 4 of 8</div>
      <div class="ob-h1">Your game</div>
      <div class="ob-sub">We use this to match you with golfers at your level.</div>
      <div class="ob-hrow">
        <div class="ob-f"><label>Handicap</label><input id="ob-hdcp" type="text" maxlength="5" placeholder="e.g. 14.2"></div>
        <button class="ob-ghin">🔗 Link GHIN</button>
      </div>
      <div class="ob-f"><label>Zip Code</label><input id="ob-zip" type="text" maxlength="5" inputmode="numeric" placeholder="e.g. 33602"></div>
      <div id="ob-zip-note" class="ob-note" style="margin-top:-8px;margin-bottom:12px"></div>
      <div class="ob-f"><label>Home Course</label><input id="ob-course" type="text" maxlength="60" placeholder="e.g. Bayshore Golf Course"></div>
    </div>

    <!-- Step 5: Vibes -->
    <div class="ob-step" id="ob-s5">
      <div class="ob-lbl">Step 5 of 8</div>
      <div class="ob-h1">What kind of golfer are you?</div>
      <div class="ob-sub">Pick everything that fits your vibe.</div>
      <div class="ob-chips" id="ob-chips"></div>
    </div>

    <!-- Step 6: Photo + Bio -->
    <div class="ob-step" id="ob-s6">
      <div class="ob-lbl">Step 6 of 8</div>
      <div class="ob-h1">Your profile</div>
      <div class="ob-sub">Add a photo and bio so golfers can get to know you.</div>
      <div class="ob-photo-wrap">
        <div class="ob-avatar" id="ob-avatar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          <span>Upload Photo</span>
        </div>
        <input type="file" id="ob-photo" accept="image/*" style="display:none">
      </div>
      <div class="ob-f"><label>Bio</label><textarea id="ob-bio" maxlength="200" placeholder="e.g. Casual golfer, 18 handicap, love a cold beer on the back 9..."></textarea></div>
    </div>

    <!-- Step 7: How heard -->
    <div class="ob-step" id="ob-s7">
      <div class="ob-lbl">Step 7 of 8</div>
      <div class="ob-h1">One last thing</div>
      <div class="ob-sub">How did you hear about Fairway Friend?</div>
      <div class="ob-heard" id="ob-heard"></div>
    </div>

    <!-- Step 8: Success -->
    <div class="ob-step ob-success" id="ob-s8">
      <div class="ob-success-icon">⛳</div>
      <div class="ob-h1" style="margin-bottom:10px">You're on the tee!</div>
      <div class="ob-sub">Your Fairway Friend profile is ready. Time to find your perfect playing partner.</div>
    </div>

  </div>
</div>

<!-- Sticky nav -->
<div class="ob-nav">
  <button class="ob-btn-main" id="ob-main">Continue</button>
  <button class="ob-btn-back hidden" id="ob-back">← Back</button>
</div>`;

  _buildDynamic();
  _wire();
  _refresh();
}

// ── Build dynamic content ───────────────────────────────────
function _buildDynamic() {
  // Chips
  const chips = [
    ['🎯','Competitive'],['😎','Casual'],['🍺','Social Drinker'],['🌿','420 Friendly'],
    ['🎵','Music on Cart'],['⚡','Fast Pace'],['🚶','Walker'],['🛺','Cart Only'],
    ['🌅','Early Bird'],['🌇','Twilight'],['📸','Social Poster'],['🤫','Low Key'],
    ['🏆','Score Keeper'],['🌊','Course Explorer']
  ];
  const chipEl = document.getElementById('ob-chips');
  if (chipEl) {
    chips.forEach(([e,l]) => {
      const btn = document.createElement('button');
      btn.className = 'ob-chip';
      btn.textContent = e + ' ' + l;
      btn.dataset.vibe = l;
      btn.onclick = () => {
        btn.classList.toggle('sel');
        const idx = _data.vibes.indexOf(l);
        if (idx >= 0) _data.vibes.splice(idx,1);
        else _data.vibes.push(l);
      };
      chipEl.appendChild(btn);
    });
  }

  // How heard
  const heard = [
    ['🤝','Friend or playing partner'],['📱','Social media'],
    ['⛳','At the golf course'],['🔍','Google / App Store'],['📺','Ad or promotion']
  ];
  const heardEl = document.getElementById('ob-heard');
  if (heardEl) {
    heard.forEach(([e,l]) => {
      const btn = document.createElement('button');
      btn.className = 'ob-hbtn';
      btn.textContent = e + ' ' + l;
      btn.onclick = () => {
        heardEl.querySelectorAll('.ob-hbtn').forEach(b=>b.classList.remove('sel'));
        btn.classList.add('sel');
        _data.howHeard = l;
      };
      heardEl.appendChild(btn);
    });
  }
}

// ── Wire all events ─────────────────────────────────────────
function _wire() {
  // Gender toggles
  const genders = { 'ob-g-man':'man', 'ob-g-woman':'woman', 'ob-g-nb':'nonbinary' };
  Object.entries(genders).forEach(([id,val]) => {
    const btn = document.getElementById(id);
    if (btn) btn.onclick = () => {
      document.querySelectorAll('#ob-s1 .ob-tog').forEach(b=>b.classList.remove('sel'));
      btn.classList.add('sel');
      _data.gender = val;
    };
  });

  // Name fields
  ['first','last','dob'].forEach(f => {
    const el = document.getElementById('ob-'+f);
    if (el) el.oninput = () => { _data[f==='first'?'firstName':f==='last'?'lastName':'dob'] = el.value; };
  });

  // Reason toggles
  const reasons = { 'ob-r-buddy':'buddy', 'ob-r-tee':'teetimes', 'ob-r-explore':'explore' };
  Object.entries(reasons).forEach(([id,val]) => {
    const btn = document.getElementById(id);
    if (btn) btn.onclick = () => {
      btn.classList.toggle('sel');
      const idx = _data.reasons.indexOf(val);
      if (idx>=0) _data.reasons.splice(idx,1); else _data.reasons.push(val);
    };
  });

  // Game fields
  const hdcp = document.getElementById('ob-hdcp');
  const zip  = document.getElementById('ob-zip');
  const course = document.getElementById('ob-course');
  if (hdcp) hdcp.oninput = () => { _data.handicap = hdcp.value; };
  if (course) course.oninput = () => { _data.homeCourse = course.value; };
  if (zip) zip.oninput = async () => {
    _data.zip = zip.value;
    const note = document.getElementById('ob-zip-note');
    if (zip.value.length === 5 && /^\d{5}$/.test(zip.value)) {
      if (note) note.textContent = 'Looking up location…';
      try {
        const r = await fetch('https://api.zippopotam.us/us/'+zip.value);
        if (r.ok) {
          const d = await r.json();
          _data.city  = d.places?.[0]?.['place name'] || '';
          _data.state = d.places?.[0]?.['state abbreviation'] || '';
          if (note) note.textContent = _data.city ? '📍 '+_data.city+', '+_data.state : '';
        }
      } catch(_) {}
    } else if (note) note.textContent = '';
  };

  // Bio
  const bio = document.getElementById('ob-bio');
  if (bio) bio.oninput = () => { _data.bio = bio.value; };

  // Photo
  const avatar = document.getElementById('ob-avatar');
  const photoInput = document.getElementById('ob-photo');
  if (avatar && photoInput) {
    avatar.onclick = () => photoInput.click();
    photoInput.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      _photoFile = file;
      const reader = new FileReader();
      reader.onload = ev => {
        avatar.style.backgroundImage = 'url('+ev.target.result+')';
        avatar.style.border = '2px solid #c9a84c';
        avatar.innerHTML = '';
      };
      reader.readAsDataURL(file);
    };
  }

  // Nav buttons
  const mainBtn = document.getElementById('ob-main');
  const backBtn = document.getElementById('ob-back');
  if (mainBtn) mainBtn.onclick = _continue;
  if (backBtn) backBtn.onclick = _back;
}

// ── UI refresh ──────────────────────────────────────────────
function _refresh() {
  // Show active step
  for (let i=1; i<=TOTAL; i++) {
    const el = document.getElementById('ob-s'+i);
    if (el) el.classList.toggle('active', i===_step);
  }
  // Progress bars
  const track = document.getElementById('ob-track');
  if (track) track.style.opacity = (_step===1||_step===TOTAL) ? '0' : '1';
  for (let i=0; i<TOTAL; i++) {
    const bar = document.getElementById('ob-b'+i);
    if (bar) bar.className = 'ob-bar' + (i<_step-1?' done':i===_step-1?' cur':'');
  }
  // Button labels
  const labels = {1:'Continue',2:'Continue',3:'Continue',4:'Continue',5:'Continue',6:'Continue',7:'Finish Up →',8:"Let's Golf 🏌️"};
  const mainBtn = document.getElementById('ob-main');
  const backBtn = document.getElementById('ob-back');
  if (mainBtn) {
    mainBtn.textContent = labels[_step]||'Continue';
    mainBtn.className = 'ob-btn-main' + (_step===TOTAL?' success':'');
  }
  if (backBtn) backBtn.className = (_step>1&&_step<TOTAL) ? 'ob-btn-back' : 'ob-btn-back hidden';
}

// ── Navigation ──────────────────────────────────────────────
function _continue() {
  if (_step === TOTAL) { _finish(); return; }
  // Validate step 2
  if (_step === 2) {
    const first = document.getElementById('ob-first')?.value.trim();
    if (!first) { showToast('Please enter your first name'); return; }
    const dob = document.getElementById('ob-dob')?.value;
    if (dob) {
      const age = (Date.now()-new Date(dob))/(365.25*24*3600*1000);
      if (age < 18) { showToast('You must be 18 or older to join'); return; }
    }
  }
  _step++;
  _refresh();
  document.getElementById('screen-onboard')?.scrollTo({top:0,behavior:'smooth'});
}

function _back() {
  if (_step > 1) { _step--; _refresh(); }
}

// ── Save to Firestore ───────────────────────────────────────
async function _finish() {
  const user = window._currentUser;
  if (!user) return;
  const btn = document.getElementById('ob-main');
  if (btn) { btn.disabled=true; btn.textContent='Saving…'; }

  try {
    let photoURL = null;
    if (_photoFile) {
      try {
        const storageRef = ref(storage, 'avatars/'+user.uid);
        await uploadBytes(storageRef, _photoFile);
        photoURL = await getDownloadURL(storageRef);
      } catch(_) {}
    }

    const city = _data.city && _data.state
      ? _data.city+', '+_data.state
      : _data.zip || '';

    const displayName = [_data.firstName, _data.lastName].filter(Boolean).join(' ') || 'Golfer';

    await setDoc(doc(db,'users',user.uid), {
      displayName, firstName:_data.firstName, lastName:_data.lastName,
      dob:_data.dob, gender:_data.gender,
      handicap: parseFloat(_data.handicap)||18,
      city, zip:_data.zip, homeCourse:_data.homeCourse,
      vibes:_data.vibes, bio:_data.bio,
      photoURL: photoURL||null,
      reasons:_data.reasons, howHeard:_data.howHeard,
      onboardComplete:true, updatedAt:serverTimestamp(),
    }, { merge:true });

    try {
      const { updateProfile } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
      await updateProfile(user, { displayName, photoURL:photoURL||null });
    } catch(_) {}

    // Show success then go to feed
    _step = TOTAL; _refresh();
    setTimeout(() => {
      window._weatherCity = city;
      if (typeof goScreen === 'function') {
        goScreen('feed');
        document.getElementById('bottom-nav').style.display = 'flex';
        if (typeof initFeed === 'function') { initFeed(); initNearbyPlayers(); }
      } else window.location.reload();
      showToast('Welcome to Fairway Friend! 🏌️');
    }, 2200);

  } catch(e) {
    console.error('Onboard error:', e);
    showToast('Could not save. Please try again.');
    if (btn) { btn.disabled=false; btn.textContent="Let's Golf 🏌️"; }
  }
}
