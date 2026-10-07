# 💕 Just Us — Real-Time iOS Couple Tracker

An iOS mobile application built with React Native and Expo that tracks and syncs live GPS location **24/7 in real-time, even when the app is completely closed or your screen is locked** (like Life360, Apple Find My, and Zenly).

---

## 🚀 Key Features

1. **24/7 Background Location Streaming (Closed App / Locked Screen)**:
   - Uses iOS native `CLLocationManager` background modes (`UIBackgroundModes: ['location', 'fetch']`).
   - Defined via native `TaskManager.defineTask('JUST_US_BACKGROUND_LOCATION_TASK')`.
   - Updates stream directly via high-speed Firebase REST API PATCH (`https://mygf-tracker-default-rtdb.firebaseio.com/locations/{slot}.json`).
   - `showsBackgroundLocationIndicator: true` keeps the iOS blue status pill active, preventing iOS from killing background location tasks.
   - `pausesLocationUpdatesAutomatically: false` ensures iOS never puts GPS to sleep when stationary.

2. **Full Live Map Experience**:
   - Native Apple Maps / Google Maps via `react-native-maps`.
   - Satellite & Standard view toggle.
   - Custom avatar pins with pulsing radar rings when active.
   - 🎯 Floating Recenter Button (centers view smoothly on both partners).
   - "Get Directions" popup card that opens directly in Google Maps (`https://www.google.com/maps/dir/?api=...`).

3. **Live Chat & Photos**:
   - Real-time chat messages synced via Firebase Realtime Database.
   - Photo picker support (`expo-image-picker`) to send sweet photos.
   - Unread badge indicator.

4. **Days Together & Birthday Counter**:
   - Automatically counts days together since July 10, 2026.
   - Displays partner's birthday countdowns.

---

## 🔐 Accounts & Login

- **Ra 👦**: Username `ra`, Password `123` (Slot `p1`)
- **Leak 👧**: Username `leak`, Password `123` (Slot `p2`)

*(Both accounts sync simultaneously with the web app at `D:\MYGF`)*

---

## 📲 How to Install & Run on iPhone

Because this app utilizes native iOS background location entitlements (`UIBackgroundModes: ['location', 'fetch']`), you have two simple ways to install it:

### Option 1: Expo Cloud Build (EAS Build — No Mac Required! Recommended)
Expo can build the iOS app in the cloud for you completely free:

1. Open PowerShell or Command Prompt in `D:\MYGF - MBLAPP`.
2. Install EAS CLI and login:
   ```bash
   npx eas-cli login
   ```
   *(If you don't have an Expo account, create a free one at [expo.dev](https://expo.dev))*

3. Configure your build (already pre-configured in `eas.json`):
   ```bash
   npx eas-cli build -p ios --profile preview
   ```
4. EAS will build your `.ipa` or Ad-Hoc installable app in the cloud. When finished, it provides a QR code / download link to install directly onto your iPhone!

---

### Option 2: Run with Mac / Xcode (If you have a Mac)
1. Run prebuild:
   ```bash
   npx expo prebuild --platform ios
   ```
2. Open the generated `ios/JustUs.xcworkspace` in Xcode.
3. Select your connected iPhone as the build target.
4. Go to **Signing & Capabilities**, select your Apple ID team, and click **Run** (Cmd + R).

---

### Option 3: Quick Dev Client (Interactive Development)
```bash
npx expo start
```
Scan the QR code using your iPhone camera or Expo Go app.

---

## ⚙️ Critical iPhone Permission Setup
When opening the app on your iPhone for the first time:
1. Tap **"Allow While Using App"** when prompted for location.
2. When prompted for background location, tap **"Change to Always Allow"**.
   - Or open iPhone **Settings** > **Just Us** > **Location** > Select **"Always"**, and ensure **"Precise Location"** is turned **ON**.
3. Now, whenever you lock your phone or close the app, your location will update continuously in real-time for your partner!
