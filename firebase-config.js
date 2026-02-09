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
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const analytics = getAnalytics(app);

// Export for use
export { app, auth, db, storage, analytics, firebaseConfig };

console.log('✅ Firebase configured for MMS Safety System');
