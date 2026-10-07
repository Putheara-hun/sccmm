import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Linking,
  Platform,
  Dimensions,
  AppState,
  Modal,
  SafeAreaView,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker, Callout } from 'react-native-maps';

const { width, height } = Dimensions.get('window');

// ═══════════════════════════════════════
//  FIREBASE CONFIG & ACCOUNTS
// ═══════════════════════════════════════
const FIREBASE_DB = 'https://mygf-tracker-default-rtdb.firebaseio.com';

const ACCOUNTS = {
  ra:   { password: '123', slot: 'p1', name: 'Ra',   emoji: '👦' },
  leak: { password: '123', slot: 'p2', name: 'Leak', emoji: '👧' },
};
const OTHER = { p1: 'p2', p2: 'p1' };
const DATES = {
  together:   '2026-07-10',
  p1birthday: '2002-11-13',
  p2birthday: '2004-07-10',
};

// ═══════════════════════════════════════
//  📍 iOS BACKGROUND LOCATION TASK
//  Runs natively even when the app is CLOSED or screen is LOCKED!
// ═══════════════════════════════════════
const BACKGROUND_LOCATION_TASK = 'JUST_US_BACKGROUND_LOCATION_TASK';

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }
  if (data && data.locations && data.locations.length > 0) {
    const loc = data.locations[data.locations.length - 1];
    const { latitude, longitude, accuracy } = loc.coords;

    try {
      const slot = await AsyncStorage.getItem('us_current_slot');
      if (slot) {
        // Direct HTTPS REST API PATCH to Firebase
        await fetch(`${FIREBASE_DB}/locations/${slot}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: latitude,
            lng: longitude,
            acc: Math.round(accuracy || 0),
            method: 'gps-background',
            ts: Date.now()
          })
        });
      }
    } catch (e) {
      console.error('Failed to post background location to Firebase:', e);
    }
  }
});

// ═══════════════════════════════════════
//  MAIN APP COMPONENT
// ═══════════════════════════════════════
export default function App() {
  const [sessionUser, setSessionUser] = useState(null);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // Live data
  const [locData, setLocData] = useState({ p1: null, p2: null });
  const [photoData, setPhotoData] = useState({ p1: null, p2: null });
  const [chatMessages, setChatMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const mapRef = useRef(null);
  const chatScrollRef = useRef(null);

  // Restore session
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('us_session_user');
        if (saved && ACCOUNTS[saved]) {
          setSessionUser(saved);
        }
      } catch (e) {}
    })();
  }, []);

  // When logged in, initialize background tracking and Firebase listeners
  useEffect(() => {
    if (!sessionUser) return;
    const acc = ACCOUNTS[sessionUser];
    AsyncStorage.setItem('us_current_slot', acc.slot).catch(() => {});

    // Start background & foreground GPS tracking
    setupLocationTracking(acc.slot);

    // Poll Firebase Realtime DB every 2.5s for partner updates and chat
    const interval = setInterval(() => {
      syncFirebaseData();
    }, 2500);
    syncFirebaseData();

    // Mark online in Firebase
    fetch(`${FIREBASE_DB}/online/${acc.slot}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ online: true, ts: Date.now() })
    }).catch(() => {});

    return () => {
      clearInterval(interval);
      // Mark offline on unmount
      fetch(`${FIREBASE_DB}/online/${acc.slot}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ online: false, ts: Date.now() })
      }).catch(() => {});
    };
  }, [sessionUser]);

  // Request iOS "Always" location permissions and start continuous tracking
  async function setupLocationTracking(slot) {
    try {
      // 1. Foreground permission
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        Alert.alert(
          'Location Permission Needed',
          'Please allow Location access in iPhone Settings so your partner can see where you are!'
        );
        return;
      }

      // 2. Background ("Always Allow") permission
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        Alert.alert(
          'Background Tracking',
          'For your location to update even when the app is closed, select "Change to Always Allow" in iPhone Settings > Just Us > Location.'
        );
      }

      // 3. Immediate foreground position
      const initial = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      if (initial && initial.coords) {
        await updateLocationToFirebase(slot, initial.coords.latitude, initial.coords.longitude, initial.coords.accuracy);
      }

      // 4. Register native background location task
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
      if (!isRegistered) {
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
          showsBackgroundLocationIndicator: true, // Blue status pill on iOS so iOS never kills it!
          pausesLocationUpdatesAutomatically: false, // Critical for iOS: never sleep when stationary
          deferredUpdatesInterval: 3000,
          deferredUpdatesDistance: 5,
          foregroundService: {
            notificationTitle: 'Just Us Live Tracking 💕',
            notificationBody: 'Sharing live location with partner',
            notificationColor: '#e94560'
          }
        });
      }
    } catch (e) {
      console.error('Error starting location updates:', e);
    }
  }

  // Update position to Firebase with reverse-geocoded address
  async function updateLocationToFirebase(slot, lat, lng, acc) {
    let address = `Live GPS (±${Math.round(acc || 0)}m)`;
    try {
      const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (geo && geo.length > 0) {
        const g = geo[0];
        const parts = [g.street || g.name, g.district || g.subregion, g.city || g.region].filter(Boolean);
        if (parts.length > 0) address = parts.join(', ');
      }
    } catch (e) {}

    await fetch(`${FIREBASE_DB}/locations/${slot}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat,
        lng,
        acc: Math.round(acc || 0),
        address,
        method: 'gps',
        ts: Date.now()
      })
    }).catch(() => {});
  }

  // Sync data from Firebase
  async function syncFirebaseData() {
    try {
      // Locations
      const locRes = await fetch(`${FIREBASE_DB}/locations.json`);
      const locJson = await locRes.json();
      if (locJson) {
        setLocData({ p1: locJson.p1 || null, p2: locJson.p2 || null });
      }

      // Photos
      const photoRes = await fetch(`${FIREBASE_DB}/photos.json`);
      const photoJson = await photoRes.json();
      if (photoJson) {
        setPhotoData({ p1: photoJson.p1 || null, p2: photoJson.p2 || null });
      }

      // Chat
      const chatRes = await fetch(`${FIREBASE_DB}/chat.json`);
      const chatJson = await chatRes.json();
      if (chatJson) {
        const list = Object.keys(chatJson).map(key => ({ id: key, ...chatJson[key] }));
        list.sort((a, b) => (a.ts || 0) - (b.ts || 0));
        setChatMessages(list);

        // Count unread
        if (sessionUser) {
          const mySlot = ACCOUNTS[sessionUser].slot;
          const otherSlot = OTHER[mySlot];
          const unreadMsgs = list.filter(m => m.who === otherSlot && !m.seen);
          setUnreadCount(unreadMsgs.length);
        }
      }
    } catch (e) {}
  }

  // Handle Login
  async function handleLogin() {
    const u = loginUser.trim().toLowerCase();
    const p = loginPass;
    if (!u || !p) {
      setLoginError('Please enter username and password.');
      return;
    }
    const acc = ACCOUNTS[u];
    if (!acc || acc.password !== p) {
      setLoginError('Invalid username or password.');
      return;
    }
    setLoginError('');
    await AsyncStorage.setItem('us_session_user', u);
    setSessionUser(u);
  }

  // Handle Logout
  async function handleLogout() {
    try {
      await AsyncStorage.removeItem('us_session_user');
      await AsyncStorage.removeItem('us_current_slot');
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      }
    } catch (e) {}
    setSessionUser(null);
  }

  // Change Profile Photo
  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const b64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      const mySlot = ACCOUNTS[sessionUser].slot;
      setPhotoData(prev => ({ ...prev, [mySlot]: b64 }));
      await fetch(`${FIREBASE_DB}/photos/${mySlot}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(b64)
      }).catch(() => {});
    }
  }

  // Send message
  async function sendMessage() {
    const text = inputText.trim();
    if (!text || !sessionUser) return;
    setInputText('');
    const mySlot = ACCOUNTS[sessionUser].slot;
    const msg = {
      who: mySlot,
      type: 'text',
      text,
      ts: Date.now()
    };
    await fetch(`${FIREBASE_DB}/chat.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg)
    }).catch(() => {});
    syncFirebaseData();
  }

  // Recenter map
  function recenterMap() {
    if (!mapRef.current) return;
    const mySlot = sessionUser ? ACCOUNTS[sessionUser].slot : 'p1';
    const otherSlot = OTHER[mySlot];
    const a = locData[mySlot];
    const b = locData[otherSlot];
    const coords = [];
    if (a && a.lat != null) coords.push({ latitude: a.lat, longitude: a.lng });
    if (b && b.lat != null) coords.push({ latitude: b.lat, longitude: b.lng });

    if (coords.length === 2) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true
      });
    } else if (coords.length === 1) {
      mapRef.current.animateToRegion({
        latitude: coords[0].latitude,
        longitude: coords[0].longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015
      }, 600);
    }
  }

  // Distance Calculation
  function getDistanceText() {
    if (!sessionUser) return 'Locating… 📡';
    const mySlot = ACCOUNTS[sessionUser].slot;
    const otherSlot = OTHER[mySlot];
    const a = locData[mySlot];
    const b = locData[otherSlot];
    if (!a || a.lat == null) return 'Locating your position… 📡';
    if (!b || b.lat == null) return `Waiting for partner's location… 💕`;

    const R = 6371;
    const dLat = (b.lat - a.lat) * (Math.PI / 180);
    const dLon = (b.lng - a.lng) * (Math.PI / 180);
    const val =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(a.lat * (Math.PI / 180)) * Math.cos(b.lat * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
    const km = R * 2 * Math.atan2(Math.sqrt(val), Math.sqrt(1 - val));

    if (km < 0.05) return 'Right next to you! 🥰 (0 m)';
    if (km < 1) return `${Math.round(km * 1000)} meters away 💕`;
    if (km < 50) return `${km.toFixed(1)} km away`;
    return `${Math.round(km)} km away`;
  }

  // Days together
  function getDaysTogether() {
    const start = new Date(DATES.together + 'T00:00:00');
    const now = new Date();
    const diff = Math.max(0, Math.round((now - start) / 86400000));
    return diff;
  }

  // ═══════════════════════════════════════
  //  RENDER: LOGIN SCREEN
  // ═══════════════════════════════════════
  if (!sessionUser) {
    return (
      <SafeAreaView style={styles.loginContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loginCard}>
          <Text style={styles.logoEmoji}>💕</Text>
          <Text style={styles.loginTitle}>Just Us</Text>
          <Text style={styles.loginSub}>Enter your credentials to continue.</Text>

          <TextInput
            style={styles.input}
            placeholder="Username (ra / leak)"
            placeholderTextColor="#777"
            autoCapitalize="none"
            value={loginUser}
            onChangeText={setLoginUser}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#777"
            secureTextEntry
            value={loginPass}
            onChangeText={setLoginPass}
          />

          {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}

          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
            <Text style={styles.loginBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Current user info
  const mySlot = ACCOUNTS[sessionUser].slot;
  const otherSlot = OTHER[mySlot];
  const myAcc = ACCOUNTS[sessionUser];
  const otherAcc = Object.values(ACCOUNTS).find(a => a.slot === otherSlot);

  const myLoc = locData[mySlot];
  const partnerLoc = locData[otherSlot];

  // ═══════════════════════════════════════
  //  RENDER: MAIN SCREEN
  // ═══════════════════════════════════════
  return (
    <SafeAreaView style={styles.mainContainer}>
      <StatusBar barStyle="light-content" />

      {/* Top Bar */}
      <View style={styles.topRow}>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live Background GPS</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Avatars */}
        <View style={styles.avatarsRow}>
          {/* Me */}
          <View style={styles.avatarWrap}>
            <TouchableOpacity style={styles.avatarCircle} onPress={pickPhoto}>
              {photoData[mySlot] ? (
                <Image source={{ uri: photoData[mySlot] }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarEmoji}>{myAcc.emoji}</Text>
              )}
              <View style={styles.camBadge}>
                <Text style={styles.camIcon}>📷</Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarName}>{myAcc.name} (you)</Text>
            <Text style={styles.avatarLoc} numberOfLines={2}>
              {myLoc && myLoc.address ? myLoc.address : 'Locating… 📡'}
            </Text>
            <Text style={styles.avatarTime}>
              {myLoc && myLoc.ts && Date.now() - myLoc.ts < 45000 ? '🟢 Live now' : 'Updated recently'}
            </Text>
          </View>

          <Text style={styles.heartConnector}>💗</Text>

          {/* Partner */}
          <View style={styles.avatarWrap}>
            <View style={styles.avatarCircle}>
              {photoData[otherSlot] ? (
                <Image source={{ uri: photoData[otherSlot] }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarEmoji}>{otherAcc.emoji}</Text>
              )}
            </View>
            <Text style={styles.avatarName}>{otherAcc.name}</Text>
            <Text style={styles.avatarLoc} numberOfLines={2}>
              {partnerLoc && partnerLoc.address ? partnerLoc.address : 'Offline'}
            </Text>
            <Text style={styles.avatarTime}>
              {partnerLoc && partnerLoc.ts && Date.now() - partnerLoc.ts < 45000 ? '🟢 Live now' : 'Offline'}
            </Text>
          </View>
        </View>

        {/* Love Stats Card */}
        <View style={styles.loveCard}>
          <Text style={styles.daysNumber}>{getDaysTogether()}</Text>
          <Text style={styles.daysSub}>days together 💕</Text>
          <View style={styles.bdayRow}>
            <Text style={styles.bdayPill}>🎂 Ra (Nov 13)</Text>
            <Text style={styles.bdayPill}>🎂 Leak (Jul 10)</Text>
          </View>
        </View>

        {/* Distance Pill */}
        <View style={styles.distPill}>
          <Text style={styles.distPillText}>📍 {getDistanceText()}</Text>
        </View>

        {/* Map Container */}
        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            style={styles.map}
            mapType="satellite"
            initialRegion={{
              latitude: myLoc && myLoc.lat ? myLoc.lat : 11.556,
              longitude: myLoc && myLoc.lng ? myLoc.lng : 104.928,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05
            }}
          >
            {/* My Pin */}
            {myLoc && myLoc.lat != null && (
              <Marker
                coordinate={{ latitude: myLoc.lat, longitude: myLoc.lng }}
                title={`${myAcc.name} (You)`}
                description={myLoc.address || 'Your location'}
              >
                <View style={styles.pinContainer}>
                  <View style={[styles.pinRadar, styles.pinRadarMe]} />
                  <View style={[styles.pinCircle, styles.pinCircleMe]}>
                    <Text style={styles.pinEmoji}>{myAcc.emoji}</Text>
                  </View>
                  <View style={styles.pinLabel}>
                    <Text style={styles.pinLabelText}>{myAcc.name} (you)</Text>
                  </View>
                </View>
              </Marker>
            )}

            {/* Partner Pin */}
            {partnerLoc && partnerLoc.lat != null && (
              <Marker
                coordinate={{ latitude: partnerLoc.lat, longitude: partnerLoc.lng }}
                title={otherAcc.name}
                description={partnerLoc.address || 'Partner location'}
              >
                <View style={styles.pinContainer}>
                  <View style={[styles.pinRadar, styles.pinRadarGf]} />
                  <View style={[styles.pinCircle, styles.pinCircleGf]}>
                    <Text style={styles.pinEmoji}>{otherAcc.emoji}</Text>
                  </View>
                  <View style={styles.pinLabel}>
                    <Text style={styles.pinLabelText}>{otherAcc.name}</Text>
                  </View>
                </View>
                <Callout
                  onPress={() => {
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${partnerLoc.lat},${partnerLoc.lng}`;
                    Linking.openURL(url);
                  }}
                >
                  <View style={styles.calloutCard}>
                    <Text style={styles.calloutName}>{otherAcc.emoji} {otherAcc.name}</Text>
                    <Text style={styles.calloutAddress}>{partnerLoc.address || 'Tap for directions'}</Text>
                    <Text style={styles.calloutBtn}>🧭 Get Directions (Google Maps)</Text>
                  </View>
                </Callout>
              </Marker>
            )}
          </MapView>

          {/* Recenter Button */}
          <TouchableOpacity style={styles.recenterBtn} onPress={recenterMap}>
            <Text style={styles.recenterIcon}>🎯</Text>
          </TouchableOpacity>
        </View>

        {/* Open Chat Button */}
        <TouchableOpacity style={styles.bigChatBtn} onPress={() => setChatOpen(true)}>
          <Text style={styles.bigChatBtnText}>💬   Open Chat</Text>
          {unreadCount > 0 && (
            <View style={styles.badgePill}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* ── CHAT MODAL ── */}
      <Modal visible={chatOpen} animationType="slide">
        <SafeAreaView style={styles.chatModalContainer}>
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={() => setChatOpen(false)} style={styles.backBtn}>
              <Text style={styles.backBtnText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.chatHeaderTitle}>💬 {otherAcc.name}</Text>
            <View style={{ width: 30 }} />
          </View>

          <ScrollView
            ref={chatScrollRef}
            style={styles.chatMessagesList}
            onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
          >
            {chatMessages.map(msg => {
              const isMe = msg.who === mySlot;
              return (
                <View
                  key={msg.id || Math.random().toString()}
                  style={[styles.msgBubble, isMe ? styles.msgMe : styles.msgOther]}
                >
                  <Text style={styles.msgSender}>{isMe ? `You (${myAcc.emoji})` : `${otherAcc.name} (${otherAcc.emoji})`}</Text>
                  <Text style={styles.msgBody}>{msg.text || ''}</Text>
                  <Text style={styles.msgTime}>
                    {new Date(msg.ts || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.chatInputBar}>
            <TextInput
              style={styles.chatInput}
              placeholder="Type something sweet… 💕"
              placeholderTextColor="#666"
              value={inputText}
              onChangeText={setInputText}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
              <Text style={styles.sendIcon}>➤</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════
const styles = StyleSheet.create({
  loginContainer: {
    flex: 1,
    backgroundColor: '#0d0d1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginCard: {
    width: width * 0.88,
    backgroundColor: '#16162a',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  logoEmoji: {
    fontSize: 54,
    marginBottom: 8,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  loginSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  errorText: {
    color: '#ff4757',
    fontSize: 13,
    marginBottom: 12,
  },
  loginBtn: {
    width: '100%',
    backgroundColor: '#e94560',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#e94560',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Main screen
  mainContainer: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00ff88',
  },
  liveText: {
    fontSize: 12,
    color: '#00ff88',
    fontWeight: '600',
  },
  logoutText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    alignItems: 'center',
  },

  // Avatars
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 10,
    marginBottom: 16,
  },
  avatarWrap: {
    alignItems: 'center',
    flex: 1,
  },
  avatarCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#e94560',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
    overflow: 'hidden',
    position: 'relative',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarEmoji: {
    fontSize: 34,
  },
  camBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 3,
  },
  camIcon: {
    fontSize: 10,
  },
  avatarName: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
    marginTop: 6,
  },
  avatarLoc: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: 4,
  },
  avatarTime: {
    fontSize: 10,
    color: '#00ff88',
    marginTop: 2,
    fontWeight: '600',
  },
  heartConnector: {
    fontSize: 24,
    marginHorizontal: 8,
    marginBottom: 40,
  },

  // Love Stats
  loveCard: {
    width: '100%',
    backgroundColor: 'rgba(233,69,96,0.12)',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(233,69,96,0.25)',
    marginBottom: 12,
  },
  daysNumber: {
    fontSize: 38,
    fontWeight: '800',
    color: '#ff6b81',
  },
  daysSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  bdayRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  bdayPill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },

  // Distance Pill
  distPill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  distPillText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  // Map
  mapWrap: {
    width: '100%',
    height: 290,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    position: 'relative',
    marginBottom: 16,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  recenterBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(13,13,26,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  recenterIcon: {
    fontSize: 18,
  },

  // Pin
  pinContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pinRadar: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    opacity: 0.4,
  },
  pinRadarMe: {
    backgroundColor: '#e94560',
  },
  pinRadarGf: {
    backgroundColor: '#e74c9b',
  },
  pinCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  pinCircleMe: {
    backgroundColor: '#e94560',
  },
  pinCircleGf: {
    backgroundColor: '#e74c9b',
  },
  pinEmoji: {
    fontSize: 18,
  },
  pinLabel: {
    backgroundColor: 'rgba(13,13,26,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  pinLabelText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },

  calloutCard: {
    padding: 10,
    minWidth: 180,
    alignItems: 'center',
  },
  calloutName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  calloutAddress: {
    fontSize: 11,
    color: '#555',
    textAlign: 'center',
    marginBottom: 8,
  },
  calloutBtn: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Big Chat Button
  bigChatBtn: {
    width: '100%',
    backgroundColor: '#e94560',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    position: 'relative',
    shadowColor: '#e94560',
    shadowOpacity: 0.45,
    shadowRadius: 15,
    elevation: 4,
  },
  bigChatBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  badgePill: {
    position: 'absolute',
    top: -6,
    right: 12,
    backgroundColor: '#ff2d55',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#0d0d1a',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },

  // Chat Modal
  chatModalContainer: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: {
    padding: 4,
  },
  backBtnText: {
    fontSize: 24,
    color: '#fff',
  },
  chatHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  chatMessagesList: {
    flex: 1,
    padding: 16,
  },
  msgBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
    marginBottom: 10,
  },
  msgMe: {
    backgroundColor: '#e94560',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  msgOther: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  msgSender: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
    marginBottom: 4,
  },
  msgBody: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  msgTime: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.5)',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  chatInputBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    gap: 8,
  },
  chatInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  sendBtn: {
    backgroundColor: '#e94560',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: {
    color: '#fff',
    fontSize: 16,
  },
});
