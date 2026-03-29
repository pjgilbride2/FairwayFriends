# Fairway Friend ⛳ — Firebase App Hosting

## Project Structure

```
fairway-friend/
├── package.json          ← Node dependencies (Express)
├── server.js             ← Express server (required by App Hosting)
├── apphosting.yaml       ← App Hosting runtime config
├── firebase.json         ← Firebase project config
├── firestore.rules       ← Firestore security rules
├── firestore.indexes.json
├── .gitignore
└── public/
    ├── index.html
    ├── manifest.json
    ├── css/app.css
    ├── icons/
    └── js/
        ├── firebase-config.js  ← ⚠️  PASTE YOUR CONFIG HERE
        ├── app.js
        ├── auth.js
        ├── profile.js
        ├── feed.js
        ├── scorecard.js
        └── ui.js
```

---

## Setup — 5 steps

### Step 1 — Paste your Firebase config

Open `public/js/firebase-config.js` and replace all placeholder values with
the real config from Firebase Console → Project Settings → Your Apps.

### Step 2 — Update .firebaserc

Replace `YOUR-FIREBASE-PROJECT-ID` with your actual project ID.

### Step 3 — Enable Firebase services

In the Firebase Console:
- **Authentication** → Get started → Email/Password → Enable
- **Firestore** → Create database → Start in test mode → us-east1

### Step 4 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/fairway-friend.git
git push -u origin main
```

### Step 5 — Connect to Firebase App Hosting

1. Firebase Console → **App Hosting** → **Get started**
2. Connect your GitHub repository
3. Set the root directory to `/` (the repo root)
4. Set the branch to `main`
5. Click **Deploy**

App Hosting will:
- Detect `package.json` ✅
- Run `npm install` ✅
- Run `npm start` (which starts `server.js`) ✅
- Serve your app at `https://YOUR-PROJECT.web.app` ✅

---

## Local Development

```bash
npm install
npm start
# Open http://localhost:8080
```

---

## Deploy Updates

Every push to `main` on GitHub triggers an automatic redeploy.

To manually trigger:
```bash
firebase apphosting:backends:deploy
```

---

## Why This Structure Works with App Hosting

App Hosting needs a Node.js server. The `server.js` Express app:
1. Serves everything in `public/` as static files
2. Returns `index.html` for any route not matched (SPA behaviour)
3. Listens on `process.env.PORT` which App Hosting sets automatically

All Firebase Auth and Firestore calls still happen in the browser
via the JS modules in `public/js/` — the server only serves the files.
