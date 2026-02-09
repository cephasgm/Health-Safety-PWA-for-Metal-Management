# MMS Safety System - Production Deployment Checklist

## 📋 BEFORE YOU START
- [ ] You have GitHub account
- [ ] You have Google/Gmail account
- [ ] Project is at: https://cephasgm.github.io/Health-Safety-PWA-for-Metal-Management/

## 🚀 PHASE 1: FIREBASE SETUP (15 minutes)

### Step 1: Create Firebase Project
1. Go to https://console.firebase.google.com/
2. Click "Create a project"
3. Project name: `mms-safety-system`
4. Disable Google Analytics (optional)
5. Click "Create project"

### Step 2: Enable Services
1. In Firebase Console, click "Build" → "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" → Click "Next"
4. Location: `eur3 (europe-west)` → Click "Enable"
5. Go back, click "Build" → "Authentication"
6. Click "Get started"
7. Click "Email/Password" → Enable → Save

### Step 3: Get Configuration
1. Click ⚙️ (Settings) → "Project settings"
2. Scroll to "Your apps" → Click "</>" (Web app)
3. App nickname: `MMS Safety PWA`
4. Check "Also set up Firebase Hosting" (optional)
5. Click "Register app"
6. COPY the config object (looks like const firebaseConfig = {...})

## 📁 PHASE 2: FILE CREATION (10 minutes)

### Step 4: Create Backend Files
1. In your project, create `firebase-config.js`
   - Paste the config from Step 3
2. Create `auth-system.js`
   - Copy from provided code
3. Create `database-service.js`
   - Copy from provided code
4. Create `firebase-security-rules.txt`
   - Keep for reference

### Step 5: Update index.html
Add this BEFORE your main script:
```html
<!-- Firebase Backend -->
<script type="module" src="./firebase-config.js"></script>
<script type="module" src="./auth-system.js"></script>
<script type="module" src="./database-service.js"></script>

<!-- Login Screen HTML -->
<!-- Copy from provided code -->
