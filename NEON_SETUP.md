# AnnahFlix Neon setup

Completed November 2, 2026 (Asia/Taipei).

- Organization: `org-icy-butterfly-17702397`
- Project: `purple-scene-84453683`
- Branch: `production` (`br-calm-math-aob7xagj`)
- Region: `aws-ap-southeast-1`
- Declared service: PostgreSQL only. Postgres is implicit in `neon.ts`.
- Neon CLI: `8.16.0`, installed globally using `npm i -g neon@latest`.

## What was run

```powershell
npm i -g neon@latest
neon init -y --org-id org-icy-butterfly-17702397 --project-id purple-scene-84453683 --branch production --services postgres
neon deploy
npm run db:migrate
npm run build
npm run test:neon
```

Initialization created the local link without verifying it because CLI
credentials were missing. `neon deploy` opened browser sign-in; authentication
completed successfully and the requested branch was verified. No fallback
project was created. Final deployment output:

```text
Applying to branch production (br-calm-math-aob7xagj)
No changes — branch production already matches the policy.

Utilized services: Postgres
Pulled 3 Neon variables into .env.local
  Postgres        DATABASE_URL, DATABASE_URL_UNPOOLED
  Branch          NEON_BRANCH
```

The complete existing schema migration was tested first on the temporary
branch `annahflix-setup-verify-20261102`, then applied to the empty production
database using Prisma Migrate. Both schema comparisons reported:

```text
No difference detected.
```

Production migration output:

```text
1 migration found in prisma/migrations
Applying migration `20261102000000_initial_schema`
All migrations have been successfully applied.
```

## How the app connects

The Express/Socket.IO backend is a long-running Node application. It retains
Prisma 5's existing TCP driver and a reusable Prisma client rather than adding
an edge/serverless driver or replacing its ORM.

- `DATABASE_URL`: pooled Neon endpoint, used only on the backend. Prisma adds
  defaults of five connections, `pool_timeout=20`, and `connect_timeout=15`
  when these are absent from the URL.
- `DATABASE_URL_UNPOOLED`: direct endpoint, configured as Prisma's `directUrl`
  for migrations and administrative CLI operations.
- `NEON_BRANCH`: pulled branch identifier, used by the verification command.

`backend/environment.cjs` loads root `.env.local`, root `.env`, backend
`.env.local`, then backend `.env`. Existing process environment values take
precedence. This picks up the Neon CLI's variables without replacing existing
JWT, TMDB, LiveKit or R2 settings. Prisma 5 can load its legacy `.env` on import,
so application environment initialization now occurs before importing Prisma.

The Prisma wrapper loads the same environment before invoking the CLI. For
ordinary, non-pooled local PostgreSQL it can reuse `DATABASE_URL` as the direct
URL. Neon pooler URLs require the separate unpooled value. Set both URLs when
injecting a different database/branch into a process.

Use `npm run db:migrate` from the repository root, or `npm run prisma:deploy`
from `backend/`, so this loader runs. A bare `npx prisma` in `backend/` can read
legacy environment settings instead of root `.env.local`.

The generated `.neon` link and `.env.local` are ignored by Git. Do not publish
their credentials or copy database URLs into any `EXPO_PUBLIC_*` variable.
Existing custom login/session handling, LiveKit, R2, Socket.IO and streaming
provider configuration remain in use. No Auth, Functions, Object Storage,
Realtime or AI Gateway services were provisioned on Neon.

References: [Neon connection methods](https://neon.com/docs/connect/choose-connection),
[Prisma integration, including Prisma 6 and earlier](https://neon.com/docs/guides/prisma),
[Neon configuration](https://neon.com/docs/reference/neon-ts).

## Build and end-to-end evidence

`npm run build` compiled the shared package and backend, then exported the
Expo web application. It exited 0:

```text
Web Bundled 1483ms ...\mobile\node_modules\expo-router\entry.js (2184 modules)
App exported to: dist
AnnahFlix build passed: shared types, backend, and Expo web export.
```

`npm run test:neon` starts the actual API in production mode on an available
local port with the real production Neon database and existing TMDB credentials.
It uses a stable temporary JWT secret and HTTPS origin settings for that
isolated API process, exercises real HTTP and Socket.IO flows, then restarts
the API and checks persistence. No database or TMDB mocks are used.

```text
Verifying Neon branch: production
PASS production-mode API startup and real Neon database readiness
PASS registration and authenticated profile persist through Prisma/Postgres
PASS host creates room, guest joins, and host reads persisted membership
PASS Socket.IO chat reaches guest and is readable from Neon through HTTP
PASS live TMDB metadata, watchlist, and continue-watching save/read correctly
PASS new login revokes the previous device session using Neon persistence
PASS accounts, room membership, watchlist, and session survive API restart
PASS temporary verification accounts and their records removed
Neon end-to-end verification passed (8 checks).
```

The same eight checks passed on the temporary branch before production schema
deployment. That branch was then deleted. Verification creates unique test
accounts and cleans up only their rows after stopping its API subprocesses.

The regular backend regression suite also passed: 38 policy checks, VidCore
checks, HTTP/socket watch-party and session checks, and 18 Node test cases.
Backend compilation and mobile TypeScript checks passed. The existing API on
port 4000 returned `200 {"status":"ready"}`. Provider configuration and URL
builder hashes match their pre-redesign values.

## Issues encountered and resolved

- The initial link was offline; browser authentication during deployment
  completed successfully. No sign-in timeout or installation failure occurred.
- The first restart verification invalidated its own token by generating a
  fresh test signing secret on restart. The harness now keeps that secret
  stable, and restart persistence passes.
- The first production verification detected a direct URL selected before
  root env loading. Prisma 5's automatic env import was the cause. The app and
  verification command now load environment settings before importing Prisma;
  pooled application access and direct migration access passed afterward.

## Run and hosting limits

From the root:

```powershell
npm run build
npm start
```

`npm start` applies pending migrations, then starts the backend. Stop another
backend on port 4000 first, or choose a free `PORT`. `npm run dev` starts the
backend watcher. Web development still runs from `mobile/` with `npm run web`;
the exported website is `mobile/dist`.

This deployed and verified the **database**, not public application hosting.
The API and web app still need Render or another suitable host. Copy both
database URLs into the backend host's environment and use the final HTTPS API
URL in mobile/web builds. See [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md).

No existing local database accounts, rooms, watchlists or media were copied
by this setup. The schema was applied to the initially empty Neon database.
No destructive schema reset or `db push` was used. Local files remain local;
R2 remains the existing object-storage integration.

The existing mobile dependency audit findings documented in the production
guide remain unresolved. This work did not upgrade Expo, build an Android APK,
test live microphone/screen capture, or validate a newly hosted iframe origin.

## Files added or changed in this setup

- `neon.ts`, `package.json`, `package-lock.json`: Neon configuration/dependencies
  and root build, start, migration and verification commands.
- `.gitignore`: the CLI added `.neon` to the existing secret/runtime exclusions.
- `.env.local` (ignored): three Neon-managed environment variables.
- `.neon` (ignored): organization, project and production branch link.
- `backend/environment.cjs`, `backend/environment.d.cts`: shared environment loader.
- `backend/scripts/prisma.cjs`: CLI wrapper using the same environment.
- `backend/src/config/env.ts`, `backend/src/prisma.ts`: environment initialization
  and bounded pooled Prisma client.
- `backend/prisma/schema.prisma`: direct migration connection declaration.
- `backend/package.json`, `backend/tests/environment.test.ts`: CLI commands and
  environment precedence/local-Postgres regression checks.
- `scripts/build.cjs`, `scripts/verify-neon.cjs`: root build and opt-in real-service test.
- `deploy/start.mjs`: same environment loader and Prisma wrapper during startup.
- `render.yaml`, `deploy/backend.env.example`, `backend/.env.example`: both
  database URL settings for production/local deployment.
- `README.md`, `PRODUCTION_DEPLOYMENT.md`, `NEON_SETUP.md`: setup and hosting documentation.
