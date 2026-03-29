// ============================================================
//  FAIRWAY FRIEND — Firebase Configuration
//
//  STEP 1: Replace every value below with your own project's
//  config from Firebase Console → Project Settings → Your Apps
// ============================================================

import { initializeApp }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage }     from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
 apiKey: "AIzaSyDQJamff7suRGMnSEwOponbglk0Ep3jEsU",
  authDomain: "fairwayfriend-c4deb.firebaseapp.com",
  projectId: "fairwayfriend-c4deb",
  storageBucket: "fairwayfriend-c4deb.firebasestorage.app",
  messagingSenderId: "832294960338",
  appId: "1:832294960338:web:e6eba3c85103db4ab5c10b"
};

const app = initializeApp(firebaseConfig);

export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);
