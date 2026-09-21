// Firebase Configuration - MMS Safety Production System
// DO NOT SHARE THIS FILE PUBLICLY

const firebaseConfig = {
  apiKey: "AIzaSyCjd_ui8-WmQRk3UAW2-OOzjGaoZEacNBc",
  authDomain: "mms-safety-system.firebaseapp.com",
  projectId: "mms-safety-system",
  storageBucket: "mms-safety-system.firebasestorage.app",
  messagingSenderId: "524268976170",
  appId: "1:524268976170:web:4fb0076f86c5b833c12b53",
  measurementId: "G-57TCVMJY4R"
};

// Firebase Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import {
    getFirestore,
    enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ─── Enable Firestore offline persistence ───
// Caches queries locally and queues writes when offline.
// Auto-syncs when network returns.
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        // Multiple tabs open — persistence only works in one tab
        console.warn('[firebase] Offline persistence disabled: another tab already owns it');
    } else if (err.code === 'unimplemented') {
        // Browser doesn't support IndexedDB (private mode, old browser)
        console.warn('[firebase] Offline persistence not supported by this browser');
    } else {
        console.warn('[firebase] Offline persistence error:', err.code, err.message);
    }
});

// Analytics (may fail silently if blocked by ad-blocker)
let analytics = null;
try {
    analytics = getAnalytics(app);
} catch (err) {
    // Ad blockers or missing config can throw — non-fatal
}

// Export for use
export { app, auth, db, storage, analytics, firebaseConfig };

console.log('✅ Firebase configured with offline persistence');