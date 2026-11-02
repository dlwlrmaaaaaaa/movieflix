# AnnahFlix: free public deployment

## Mobile-only API deployment

For Android without a website, deploy only the API. A separate
`render.mobile.yaml` Blueprint provisions the API without a static site.
Existing API services can keep their current build/start commands.

After pushing this version of the code, clear both `CORS_ORIGIN` and
`PUBLIC_WEB_URL` in Render's API Environment settings (delete the keys or set
empty values), then save and redeploy. Do not enter `*`, `http://localhost`,
`none`, or `null`. Provided values still require an HTTPS origin.

Production accepts absent website settings. Empty `CORS_ORIGIN` disables
browser CORS headers for HTTP and Socket.IO while native authenticated
requests continue working. Empty `PUBLIC_WEB_URL` keeps invitation landing
pages linked to the native app; users can also join with a room code.

Keep `NODE_ENV=production`, both Neon database URLs, JWT, TMDB, and LiveKit
settings configured. The Android build needs `EXPO_PUBLIC_API_URL` and
`EXPO_PUBLIC_SOCKET_URL` pointing to the Render API; it does not need
`EXPO_PUBLIC_WEB_URL`. Verify `/health/ready` after deployment.

Mobile-only integration verification: `npm run test:neon -- --mobile-only`.
This uses temporary test accounts against the configured Neon database and
cleans up its test records and API subprocesses.

The remaining sections cover the optional API-plus-website deployment.

Use one Render Free Node web service for Express/Socket.IO, one Render static
site for the Expo web export, and one Neon Free PostgreSQL database. Keep the
existing LiveKit Cloud project for voice and optional screen sharing. This
keeps the current application architecture and streaming provider settings.

This is a small public/hobby deployment with free-tier limits, not an uptime
guarantee. Render explicitly recommends against Free instances for production
applications. There is no deployed URL until your accounts, cloud database,
and repository deployment have been connected.

## Cost and service limits

| Component | Selected plan | Practical limit |
| --- | --- | --- |
| API and Socket.IO | Render Free | Sleeps after 15 idle minutes; waking can take about a minute. 750 free instance hours per workspace/month, shared with other free services. |
| Website | Render static site | Free; bandwidth and build pipeline limits apply. |
| PostgreSQL | Neon Free | Storage, compute and transfer quotas apply; check the current dashboard. Do not select a paid plan. |
| Voice / screen sharing | Existing LiveKit Cloud Build project | Participant minutes and media transfer have quotas. Two connected people consume two participant minutes per minute together. |
| Optional video uploads | Existing Cloudflare R2 bucket | Standard storage has a free allowance; usage beyond storage/operation allowances can cost money. Skip uploads if you need to avoid this exposure. |

Do not upgrade plans or enable paid extras. In Render, use a zero spend limit
where available and review bandwidth billing separately: a payment method can
allow bandwidth overage charges. Without a payment method, exhausted free
allowances can suspend services or builds instead. R2's per-user upload quota
is not an account-wide billing cap.

References checked November 2, 2026: [Render Free](https://render.com/docs/free),
[Neon plans](https://neon.com/pricing), [LiveKit pricing](https://livekit.com/pricing),
[R2 pricing](https://developers.cloudflare.com/r2/pricing/).

## 1. Create the production database

1. Create a Neon account and a project on its **Free** plan. Choose a region
   near Render Singapore if available.
2. Use a **new, empty database** for the first deployment. Copy both PostgreSQL
   URLs from Neon Connect, preserving the SSL and channel-binding parameters.
3. Use the pooled URL as `DATABASE_URL` for application traffic and the direct
   URL as `DATABASE_URL_UNPOOLED` for migrations. Prisma defaults to five
   connections, a 20-second pool timeout, and a 15-second connection timeout
   for Neon unless the URL already specifies these values.
4. Store both URLs only in Render's backend Environment settings. Never put
   them in an `EXPO_PUBLIC_*` variable, Git, or a chat message. Locally,
   `neon deploy` pulls both into the ignored root `.env.local`, which the API
   and Prisma wrapper now load automatically. Runtime-injected values win.

The requested Neon project `purple-scene-84453683`, branch `production`, is
now configured for this checkout. See [NEON_SETUP.md](NEON_SETUP.md) for
the setup commands, validation results, and the distinction between database
deployment and application hosting.

This creates a new database; existing accounts, rooms and watchlists on your
PC are not copied automatically. Export/import with PostgreSQL tools if you
want to retain those records. Back up before migrating existing data. Render's
own Free PostgreSQL expires after 30 days, so the Blueprint does not create it.

## 2. Publish the current source to your Git repository

Render builds committed source from GitHub/GitLab/Bitbucket. The working tree
currently includes application changes that must be committed and pushed
before a remote deployment can include them. Use the repository and branch
you own; this checkout has more than one remote.

Review the changed files and commit the intended application source,
`render.yaml`, `deploy/`, and `backend/prisma/migrations/`. Keep the repository
root as Render's build root: both applications depend on `shared/`.

Never commit `.env`, `.env.production`, credentials, `node_modules`, local
`backend/uploads`, or APKs. Root `.gitignore` now excludes these runtime files.
The example environment files contain placeholders only.

## 3. Create both Render services

1. Connect Render to your source repository. Choose **New > Blueprint** and
   select the branch containing `render.yaml`.
2. The Blueprint defines `annahflix-api` on **Free**, in Singapore, and
   `annahflix-web` as a free static site. Confirm the displayed cost before
   creating resources. No Render database or paid disk is requested.
3. Enter the prompted backend values using [deploy/backend.env.example](deploy/backend.env.example).
   Copy the actual TMDB read token and the three LiveKit values from your
   existing backend environment into Render. JWT_SECRET is generated securely
   by the Blueprint; retain it across redeploys.
4. Use your chosen website HTTPS URL for both `CORS_ORIGIN` and `PUBLIC_WEB_URL`.
   Enter your API HTTPS URL as the static site's `EXPO_PUBLIC_API_URL`.
5. After creation, check the **actual assigned URLs** in Render. Names can
   receive a suffix if unavailable. Correct the API's two website URLs and
   the website's API URL if necessary, then redeploy the affected services.
   An API URL uses only the origin, without `/api` or a trailing path.

Do not change `JWT_SECRET` on each deploy: that signs out existing users.
`sync: false` prompts only during initial Blueprint creation. Later changes
must be made in each service's Environment settings.

If you prefer to create services individually, leave Root Directory empty:

| Setting | API web service | Static site |
| --- | --- | --- |
| Runtime | Node | Static |
| Plan | Free | Static (free) |
| Build command | `node deploy/build.mjs backend` | `node deploy/build.mjs web` |
| Start command | `node deploy/start.mjs` | Not applicable |
| Publish directory | Not applicable | `mobile/dist` |
| Health path | `/health` | Not applicable |
| Node version | `22.22.0` | `22.22.0` |

For the static site, add a **Rewrite** from `/*` to `/index.html`, allowing
refresh and direct navigation to movie and party routes. Add the environment
values from the examples. For the API, set `NPM_CONFIG_PRODUCTION=false` so
TypeScript and the migration CLI remain installed. The scripts also explicitly
include build dependencies.

The build scripts install and compile `shared/` first. The API startup runs
`prisma migrate deploy` before listening, stopping on a migration failure.
It never runs `db push`, accepts data loss, or resets the database. The web
build uses only explicit public URLs and ignores local Expo `.env` files.
The production API rejects an absent/weak JWT secret, missing database/TMDB
configuration, wildcard/insecure web origins, and HTTP stream overrides.

## 4. Verify the deployment

1. Visit `https://YOUR-API.onrender.com/health`: expect `healthy`. Allow for
   the free instance's cold start.
2. Visit `/health/ready`: expect `ready`. This checks PostgreSQL connectivity;
   a database failure returns HTTP 503 without exposing the database URL.
3. Open the website, register/sign in, browse TMDB, search, open a movie,
   switch enabled providers, and refresh a deep movie URL.
4. On two separate accounts/devices, create/join a party and confirm host
   sees the guest. Start the movie and check both players open. Test chat,
   voice permission, direct-source synchronization and reconnect separately.
5. Sign the same account in on another device: the previous session must
   sign out. Use separate accounts when testing a two-person party.
6. Test an invitation URL opened directly in a new browser tab and refreshed.
7. Restart the API and confirm accounts/watchlists remain in Neon. In-memory
   socket state can reconnect/rebuild; a deploy can interrupt active parties.

The generic iframe providers still open independently; hosting does not add a
provider playback API or make their timelines synchronize. Provider permissions,
allowed hosts and activation were not changed. Only publish authorized content.
The video provider can also restrict embedding or availability by deployed
origin or region. HTTPS does not bypass those restrictions.

## 5. Connect Android to the public API

Use the final URLs in `mobile/.env` for local development:

```dotenv
EXPO_PUBLIC_API_URL=https://YOUR-API.onrender.com
EXPO_PUBLIC_SOCKET_URL=https://YOUR-API.onrender.com
EXPO_PUBLIC_WEB_URL=https://YOUR-WEB.onrender.com
```

For a standalone APK, set these same **public** values in the Expo/EAS
**preview** environment for this project, then run from `mobile/`:

```powershell
eas build --platform android --profile preview
```

The preview profile produces an installable release APK and does not require
Metro. The development profile is a development client and needs a development
server. `mobile/eas.json` explicitly selects EAS's preview/production
environments for their corresponding profiles. Rebuild after public environment
URL changes, because Expo embeds them at build time. Keep all database, JWT,
TMDB and LiveKit API secrets on Render. Installing APKs directly avoids needing
a paid Play Store developer account; EAS free build quotas/queues still apply.

## Persistent media and existing databases

Local `backend/uploads` is preserved on your PC but is **not copied** to the
deployment. Render Free loses local files on restart, deploy and spin-down.
Do not rely on its local uploads for durable videos. Existing HTTPS direct
sources remain available according to their source hosts. For durable upload
storage, add the existing R2 credentials to the API and add the new website
origin to the bucket's CORS rules; see [backend/R2_SETUP.md](backend/R2_SETUP.md).
R2 is optional, separately metered, and is not provisioned by this Blueprint.

If deploying a database that already has tables, the new initial migration
requires a baseline. **Do not reset or push over it.** Back it up, verify it
matches `backend/prisma/schema.prisma` (including all prior additive updates),
then mark the baseline applied:

```powershell
# In backend/, targeting only the verified matching database:
npx prisma migrate resolve --applied 20261102000000_initial_schema
npx prisma migrate deploy
```

Never mark an unmatched schema as applied: resolve only records migration
history; it does not create missing columns. A clean database needs no manual
baseline. See [Prisma baselining](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining).

## Local validation performed

- Backend test suite and backend/mobile TypeScript checks passed.
- Initial migration applied to a new isolated PostgreSQL 16 database; applying
  again found no pending migrations. Prisma schema comparison found no drift.
- Clean dependency installs and production builds are checked separately from
  the developer's running app. Both backend build and web export passed.
- The production startup script, migration replay, readiness, exact-origin CORS,
  proxied registration, and room creation passed against that isolated database.
- The exported web bundle contains the explicit test HTTPS API URL; checked
  existing backend credentials were absent. Four provider/configuration file
  hashes match their pre-redesign values.
- A clean install reported **0 backend dependency vulnerabilities** and
  **64 mobile dependency vulnerabilities** (3 low, 41 moderate, 19 high,
  1 critical) on November 2, 2026. The critical finding is in the transitive
  `tar` dependency of the existing Expo toolchain. This audit includes build
  tooling installed as Expo dependencies and does not establish browser runtime
  exploitability. Dependency remediation/Expo upgrade needs compatibility
  testing; the application has not been certified secure for public production.
- Live Render/Neon credentials, deployed-origin playback and a release Android
  APK must be verified after the cloud resources and final URLs exist.

## Files added or changed for deployment

- `render.yaml`: API and static website Blueprint.
- `deploy/build.mjs`, `deploy/start.mjs`: shared-package build order, explicit
  public web configuration, and migration-before-start behavior.
- `deploy/backend.env.example`, `deploy/web.env.example`: cloud configuration templates.
- `backend/prisma/migrations/migration_lock.toml`,
  `backend/prisma/migrations/20261102000000_initial_schema/migration.sql`:
  complete schema for a fresh production database.
- `backend/src/config/production.ts`, `backend/src/config/env.ts`:
  production validation and configurable proxy trust.
- `backend/src/index.ts`: proxy configuration and database readiness endpoint.
- `backend/tests/productionEnvironment.test.ts`, `backend/package.json`:
  configuration regression checks and migration script.
- `backend/.env.example`: local defaults for new deployment settings.
- `mobile/package.json`, `mobile/app.json`: explicit single-page web export.
- `mobile/eas.json`: explicit preview/production EAS environment selection.
- `.gitignore`: exclude secrets, runtime uploads and Android build artifacts.
- `README.md`, `PRODUCTION_DEPLOYMENT.md`: deployment entry point and guide.
