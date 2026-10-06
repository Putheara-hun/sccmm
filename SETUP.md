# 💕 MY GF Tracker — Setup Guide

## What this app does
- **Real-time location sharing** — Both of you share your GPS location on a live map
- **Instant chat** — Chat icon (💬) in the corner — type and send instantly, no phone call needed
- **Live typing indicator** — Shows when she's typing
- **Online/last seen status**

---

## Step 1 — Get a FREE Firebase (takes 5 minutes)

1. Go to **https://console.firebase.google.com**
2. Sign in with your Google account
3. Click **"Create a project"** → name it `mygf-tracker` → click through
4. In the left menu: **Build → Realtime Database → Create database**
   - Choose **"Start in test mode"** → Enable
5. In the left menu: **Project Settings (gear icon)** → scroll down to **"Your apps"**
   - Click **`</>`** (Web app) → Register app → you'll see a `firebaseConfig` block like:
   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "mygf-tracker.firebaseapp.com",
     databaseURL: "https://mygf-tracker-default-rtdb.firebaseio.com",
     ...
   };
   ```
6. Copy those values

---

## Step 2 — Paste your Firebase config

Open `D:\MYGF\index.html` in Notepad or VS Code.

Find this block near line 200:
```js
const firebaseConfig = {
  apiKey:            "AIzaSyDEMO_REPLACE_ME",
  ...
};
```

Replace ALL the values with the ones from Firebase.

---

## Step 3 — Share the file with her

### Option A — Easiest: Share via Google Drive / OneDrive
- Upload `index.html` to Google Drive
- Share the link with her — she opens it in Chrome on her phone

### Option B — Host free on Netlify (recommended for mobile)
1. Go to **https://app.netlify.com/drop**
2. Drag the `index.html` file onto the page
3. You get a free URL like `https://abc123.netlify.app`
4. Send her that link

---

## How to use

1. You open the link → click **"👦 It's Me"**
2. She opens the link → clicks **"👧 It's Her"**
3. Allow location permission when browser asks
4. You both see each other as pins on the map 📍
5. Tap the **💬 button** (bottom right) to chat instantly

---

## Tips

- Location updates every **30 seconds** automatically
- Click **"📍 Share My Location"** button anytime to force update
- Chat works **instantly** — no refresh needed
- Works on **phone browser** (Chrome recommended)
- Make sure location permission is **"Always allow"** for best results

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Location not showing | Allow location in browser settings |
| Chat not working | Check Firebase databaseURL is correct |
| Works offline | App runs in DEMO mode (localStorage only — same browser only) |

