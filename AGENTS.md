# 🤖 Just Us (Mobile App) — AI Agent Memory & Context

This file preserves the complete context, decisions, and instructions so that Antigravity can seamlessly continue this conversation on macOS.

---

## 📌 Project Overview & Purpose

A real-time couple tracking and relationship mobile application built for iOS with React Native and Expo.
- **Core Requirement**: The app **must continuously fetch and sync live GPS coordinates in the background even when the app is completely closed or the screen is locked**, similar to Life360, Apple Find My, and Zenly.
- **Firebase Realtime DB**: `https://mygf-tracker-default-rtdb.firebaseio.com`
- **Synchronized With**: Web application at `D:\MYGF` (both web and mobile share the same database and credentials).

---

## 👥 Accounts & Credentials

- **Ra (Boyfriend)**: Username `ra`, Password `123`, Slot `p1`, Emoji `👦`
- **Leak (Girlfriend)**: Username `leak`, Password `123`, Slot `p2`, Emoji `👧`
- **Relationship Date**: `2026-07-10`
- **Birthdays**: Ra: `2002-11-13`, Leak: `2004-07-10`

---

## 📍 24/7 Background Location Architecture

1. **Native iOS Task (`CLLocationManager`)**:
   - Defined in [App.js](file:///D:/MYGF%20-%20MBLAPP/App.js) at global scope: `TaskManager.defineTask('JUST_US_BACKGROUND_LOCATION_TASK', ...)`.
   - iOS automatically wakes this task when stationary intervals elapse or when movement is detected.
2. **Direct HTTPS REST Sync**:
   - Updates are sent via `fetch(`${FIREBASE_DB}/locations/${slot}.json`, { method: 'PATCH', ... })`.
   - Direct REST API calls complete within 200ms, completely avoiding WebSocket disconnects when iOS backgrounds the app.
3. **Anti-Sleep Flags (Critical)**:
   - `showsBackgroundLocationIndicator: true`: Keeps iOS status pill active, protecting the app from being killed.
   - `pausesLocationUpdatesAutomatically: false`: Prevents iOS from putting GPS to sleep when stationary.
   - `accuracy: Location.Accuracy.High`.
4. **iOS Native Entitlements**:
   - Configured in [app.json](file:///D:/MYGF%20-%20MBLAPP/app.json):
     - `bundleIdentifier`: `com.putheara.justus`
     - `UIBackgroundModes`: `["location", "fetch"]`
     - `NSLocationAlwaysAndWhenInUseUsageDescription`
     - `NSLocationAlwaysUsageDescription`
     - `NSLocationWhenInUseUsageDescription`
     - `isIosBackgroundLocationEnabled: true` in `expo-location` plugin.

---

## 🗺️ Key Features Implemented

1. **Native Maps (`react-native-maps`)**:
   - Standard & Satellite mode toggle.
   - Live avatar pins with pulsating radar rings.
   - Recenter floating button (🎯) to re-center on both markers smoothly.
   - "Get Direction" card linking straight into Google Maps (`https://www.google.com/maps/dir/?api=1&destination=...`).
2. **Live Chat & Photos**:
   - Real-time messages with photo sharing (`expo-image-picker`).
   - Unread badge counter.
3. **Days Together Counter**:
   - Live days counter since July 10, 2026.

---

## 🍎 How to Run on macOS / Install on iPhone

1. **Clone repository on Mac**:
   ```bash
   git clone -b ios-mobile https://github.com/Putheara-hun/sccmm.git mygf-app
   cd mygf-app
   npm install --legacy-peer-deps
   ```
2. **Generate Xcode Project**:
   ```bash
   npx expo prebuild --platform ios
   ```
3. **Open & Run with Xcode**:
   ```bash
   open ios/JustUs.xcworkspace
   ```
   - Connect iPhone via USB.
   - Select your personal Apple ID team in **Signing & Capabilities**.
   - Select your iPhone at the top and click **Run (▶️)**.
4. **iPhone Permission**:
   - Open app -> Allow Location -> Choose **"Change to Always Allow"** and enable **Precise Location**.
