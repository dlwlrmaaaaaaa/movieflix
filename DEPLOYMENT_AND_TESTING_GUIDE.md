# TogetherFlix — Deployment, Testing & Multi-Device Run Guide 🎬💕

This guide provides end-to-end instructions for running, testing, and deploying **TogetherFlix** across two separate physical Android devices or emulators.

---

## 📋 System Requirements

- **Node.js**: v20 or v24
- **Docker Desktop** (or local PostgreSQL server)
- **Android Device / Emulator**: Android 10+ (API level 29+)
- **Expo Go** app installed from Google Play Store (or Expo Development Build)
- **Local Movie Files**: Downloaded `.mp4`, `.mkv`, or `.webm` files placed in your Android `Downloads` or `Movies` folder.

---

## 🛠️ Step 1: Backend Setup

### 1.1 Start PostgreSQL
Inside the `backend/` directory:
```bash
cd backend

# Option A: Start PostgreSQL via Docker Compose
docker compose up -d postgres

# Option B: If you already have a local PostgreSQL instance running,
# configure DATABASE_URL in backend/.env accordingly:
# DATABASE_URL="postgresql://togetherflix:romantic_secret@localhost:5432/togetherflix?schema=public"
```

### 1.2 Push Database Schema
```bash
npx prisma db push
```

### 1.3 Run Backend Test Suite
Verify that the synchronization engine, room code generator, and token auth pass:
```bash
npx tsx tests/runTests.ts
```
Expected output:
```
🧪 Running TogetherFlix Backend Test Suite...
  ✔ PASS: Room code format (TF-XXXX)
  ✔ PASS: No ambiguous characters across 50 generated codes
  ✔ PASS: Clean movie title normalization
  ✔ PASS: Identical duration identified as PERFECT_MATCH
  ✔ PASS: Minor duration difference identified as COMPATIBLE_WARNING
  ✔ PASS: Large duration difference identified as MISMATCH_ALERT
  ✔ PASS: JWT Token authentication
🎉 Test Results: 11 Passed, 0 Failed
```

### 1.4 Start Backend Server
```bash
npm run dev
```
The server will boot on `http://localhost:4000`:
- **REST API**: `http://localhost:4000/api`
- **Socket.IO Gateway**: `ws://localhost:4000`
- **Health Check**: `http://localhost:4000/health`

---

## 📱 Step 2: Mobile App Configuration

### 2.1 Find Your Host IP
To allow physical Android phones on your Wi-Fi network to reach your backend server:
- Open a terminal and run `ipconfig` (Windows).
- Locate your IPv4 address under your active Wi-Fi adapter (e.g. `192.168.1.50`).

### 2.2 Configure Mobile `.env`
Edit `mobile/.env`:
```env
# Replace with your computer's local Wi-Fi IP address
EXPO_PUBLIC_API_URL=http://192.168.1.50:4000
EXPO_PUBLIC_SOCKET_URL=http://192.168.1.50:4000
```
*(Note: If running on an Android Emulator on the same computer, you can use `http://10.0.2.2:4000`)*.

### 2.3 Start Expo Server
```bash
cd mobile
npm start
```
- Press `a` to open on an attached Android device / emulator via ADB, or:
- Scan the QR code displayed in terminal using the **Expo Go** Android application.

---

## 🌐 Step 3: Testing on Two Separate Devices (Different Networks)

When two partners are in a real Long-Distance Relationship (e.g., Device 1 is at Home on Wi-Fi and Device 2 is on Cellular 4G/5G data):

### 3.1 Expose Backend via Secure Tunnel (e.g., ngrok or Cloudflare Tunnel)
If Device 2 is not on the same Wi-Fi network, expose your local backend server:
```bash
# In a new terminal:
npx ngrok http 4000
```
Ngrok provides a public HTTPS endpoint, e.g. `https://togetherflix-dev.ngrok-free.app`.

### 3.2 Update Mobile Configuration
Update `mobile/.env` to point to the secure tunnel:
```env
EXPO_PUBLIC_API_URL=https://togetherflix-dev.ngrok-free.app
EXPO_PUBLIC_SOCKET_URL=https://togetherflix-dev.ngrok-free.app
```
Restart Expo (`npx expo start -c` to clear cache). Both phones will now connect seamlessly from anywhere in the world!

---

## 🎬 Step 4: Step-by-Step Movie Night Walkthrough

### 1. Account Creation & Partner Link
1. **User A**: Register with name (e.g., "Justin"), email, and password.
2. **User B**: Register on the second phone (e.g., "Partner").
3. Go to **Profile**:
   - User A taps **"Generate Invite Code"**. A code (e.g. `TF-LOVE99`) is generated.
   - User B enters `TF-LOVE99` under **"Have a Code From Your Partner?"** and taps **"Connect With Partner"**.
   - Both screens now display: **"Paired with [Partner Name] 💕"**.

### 2. Create Private Movie Room
1. User A taps **"Create Movie Room"**.
2. A unique 6-character room code (e.g., `TF-7821`) is generated.
3. User B taps **"Join With Code"** on the home screen, enters `TF-7821`, and taps **Join Room**.
4. Both devices connect via WebSockets to room `room:TF-7821`.
5. Both screens display the partner's online presence.

### 3. Select Local Movie Files
1. User A taps **"Select Movie from Storage"** $\rightarrow$ picks `Inception.mp4` from phone storage.
2. User B taps **"Select Movie from Storage"** $\rightarrow$ picks their copy of `Inception.mp4`.
3. The server runs the compatibility engine:
   - If durations match within 1s: Displays **"Perfect Match 💕 - Both copies have identical duration."**
   - If durations differ by 2-5s: Displays **"Minor Duration Difference ⚠️ - Intro logo offset detected."**

### 4. Synchronized 3-2-1 Countdown & Playback
1. Both users tap **"I'm Ready! Let's Watch 💕"**.
2. When the second person hits ready, the server schedules execution at $T_{start} = Now() + 3500\text{ms}$.
3. Both screens display the synchronized 3-2-1 countdown overlay.
4. At 0, both native video players begin playing the exact same scene simultaneously!

### 5. Playback Controls & Drift Correction
- **Pause**: When either partner hits Pause, both devices pause at the exact same timestamp.
- **Seek**: Seeking 10s backward or forward instantly shifts both players.
- **Heartbeat & Drift Correction**:
  - The host sends an authoritative heartbeat tick every 2 seconds.
  - The guest compares local timestamp with host timestamp.
  - If drift is micro ($0.35\text{s} - 1.5\text{s}$), the guest's player dynamically scales rate to $1.05\times$ or $0.95\times$ for 2 seconds to close the gap seamlessly.
  - If drift $> 1.5\text{s}$, the guest player snaps to the exact host position.
- **Resync Button**: Either user can tap the **↻ Resync** icon to force immediate alignment.

### 6. Voice / Video Call & Audio Ducking
- Tap **"Start Voice / Video Call"** to connect WebRTC audio and video.
- Tap the **Volume Icon** in player controls:
  - **Movie Sound**: Adjust from 0% to 100%.
  - **Partner Voice**: Adjust from 0% to 100%.
  - Keeps dialogue audible without muting the movie.

### 7. Floating Reactions & Whisper Chat
- Tap **React**: Pick ❤️, 😂, 😭, 😮, 🍿, 🔥 to send floating animated emojis across both devices.
- Tap **Whisper**: Opens the bottom chat sheet to text during the movie without stopping playback.

---

## 🔧 Troubleshooting Guide

| Issue | Cause | Solution |
|---|---|---|
| `Network request failed` | Phone cannot reach backend server | Ensure phone and computer are on the same Wi-Fi, or use `ngrok`. Verify `EXPO_PUBLIC_API_URL` has the correct IP and port 4000. |
| `Permission denied picking video` | Android Scoped Storage restriction | In Android Settings $\rightarrow$ Apps $\rightarrow$ TogetherFlix/Expo Go $\rightarrow$ Permissions $\rightarrow$ enable **Photos and videos / Media**. |
| `Movie durations differ by 30s` | Different video releases (e.g. Extended cut vs Theatrical) | Ensure both partners download compatible releases from the same source. |
| `WebRTC call has no audio` | Android microphone permission | Ensure microphone permission is granted in Android system prompt. |
