# TogetherFlix 🎬💕

> **A Private, Synchronized Movie Night App for Long-Distance Relationship (LDR) Couples**

For AnnahFlix's free public deployment setup, use
[`PRODUCTION_DEPLOYMENT.md`](./PRODUCTION_DEPLOYMENT.md) and the root
[`render.yaml`](./render.yaml) Blueprint.

Screen-share watch-party setup and browser limitations are documented in
[`SCREEN_SHARE_WATCH_PARTY.md`](./SCREEN_SHARE_WATCH_PARTY.md).

TogetherFlix lets you and your partner watch your locally downloaded movies in perfect sync while talking over an integrated voice or video call. No file uploading to servers, zero streaming buffering, and total privacy.

---

## 🌟 Key Highlights

- **Local File Playback**: Directly plays high-resolution `.mp4`, `.mkv`, and `.webm` files from phone storage.
- **NTP-Synchronized Playback**: Sub-second drift correction and scheduled play/pause synchronization over Socket.IO.
- **Integrated Voice & Video Calling**: WebRTC-powered call with customizable audio ducking (balance movie audio vs. partner's voice).
- **Movie Compatibility Heuristics**: Automatically inspects title, duration, and metadata to warn if partners have different cuts or releases.
- **Couple-Centric Features**: "Ready?" check, 3-2-1 countdown launch, floating heart/reaction emojis, in-room whisper chat, and movie night diary.
- **Dark Romantic Aesthetics**: Intimate, near-black cinematic design with warm rose and cosmic violet accents.

---

## 📂 Project Structure

```
APP MOVIE/
├── backend/                  # Node.js + Express + TypeScript + Socket.IO + Prisma
│   ├── prisma/               # PostgreSQL schema & migrations
│   ├── src/
│   │   ├── config/           # Environment variables & constants
│   │   ├── controllers/      # REST API route controllers
│   │   ├── middlewares/      # JWT auth, rate limiter, error handlers
│   │   ├── routes/           # Express routes
│   │   ├── services/         # LiveKit tokens, Room, Auth services
│   │   ├── sockets/          # Socket.IO handlers & Sync engine
│   │   └── index.ts          # Server entry point
│   ├── docker-compose.yml    # Local Postgres & backend orchestration
│   └── package.json
├── mobile/                   # React Native Expo (Android/iOS) + TypeScript
│   ├── app/                  # Expo Router navigation (screens)
│   ├── src/
│   │   ├── components/       # UI library, video player, call overlays, chat
│   │   ├── context/          # Auth, Socket, Room, PlaybackSync, Call contexts
│   │   ├── hooks/            # Video picker, sync engine, LiveKit call
│   │   ├── theme/            # Cinematic dark palette, typography, spacing
│   │   └── utils/            # Movie matcher, NTP clock calibration
│   └── package.json
└── shared/                   # Shared TypeScript interfaces & Socket protocols
    └── src/
        ├── events.ts         # Real-time WebSocket event signatures
        └── models.ts         # User, Room, MovieMeta data contracts
```

---

## 🚀 Quick Start Guide

For the TMDB catalog, verified Internet Archive playback, and native screen-sharing setup, see [MOVIE_DISCOVERY_AND_SCREEN_SHARING.md](./MOVIE_DISCOVERY_AND_SCREEN_SHARING.md).

### 1. Prerequisites
- **Node.js**: v20 or v24
- **Docker Desktop** (optional, for local PostgreSQL)
- **Expo Go** or Android Development Build (`npx expo run:android`)

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Start PostgreSQL via Docker Compose
docker compose up -d postgres
# Run Prisma migrations
npx prisma db push
# Start dev server
npm run dev
```

### 3. Mobile Setup
```bash
cd mobile
npm install
cp .env.example .env
# Start Expo development server
npm start
```
