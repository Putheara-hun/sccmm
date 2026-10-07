// Firebase Auto-Setup Script
// Run: node setup-firebase.js

const https = require("https");
const fs    = require("fs");
const path  = require("path");

// ─── YOUR FIREBASE CONFIG WILL BE INSERTED HERE ───
// After running `firebase login` and `firebase projects:list`
// paste your config below:

const CONFIG = {
  apiKey:            "PASTE_YOUR_API_KEY",
  authDomain:        "PASTE_YOUR_AUTH_DOMAIN",
  databaseURL:       "PASTE_YOUR_DATABASE_URL",
  projectId:         "PASTE_YOUR_PROJECT_ID",
  storageBucket:     "PASTE_YOUR_STORAGE_BUCKET",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId:             "PASTE_YOUR_APP_ID"
};

// ── Inject config into index.html ─────────────────
const htmlPath = path.join(__dirname, "index.html");
let html = fs.readFileSync(htmlPath, "utf8");

const oldConfig = /const firebaseConfig = \{[\s\S]*?\};/m;
const newConfig = `const firebaseConfig = ${JSON.stringify(CONFIG, null, 2)};`;

if (!oldConfig.test(html)) {
  console.error("❌ Could not find firebaseConfig in index.html");
  process.exit(1);
}

html = html.replace(oldConfig, newConfig);
fs.writeFileSync(htmlPath, html, "utf8");
console.log("✅ Firebase config injected into index.html!");
console.log("👉 Now run: git add index.html && git commit -m 'add firebase' && git push");
