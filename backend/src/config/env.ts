import { loadBackendEnvironment } from '../../environment.cjs';
import { validateProductionEnvironment } from './production';
loadBackendEnvironment();
validateProductionEnvironment(process.env);

export const ENV = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 4000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://togetherflix:romantic_secret@localhost:5432/togetherflix?schema=public',
  JWT_SECRET: process.env.JWT_SECRET || 'togetherflix_default_romantic_jwt_secret_dev_only',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30d',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  TRUST_PROXY_HOPS: Number(process.env.TRUST_PROXY_HOPS || '0'),
  LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY || 'devkey',
  LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET || 'secret',
  LIVEKIT_URL: process.env.LIVEKIT_URL || 'wss://demo.livekit.cloud',
  CLOUDFLARE_R2_ACCOUNT_ID: process.env.CLOUDFLARE_R2_ACCOUNT_ID || '',
  CLOUDFLARE_R2_ACCESS_KEY_ID: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
  CLOUDFLARE_R2_BUCKET_NAME: process.env.CLOUDFLARE_R2_BUCKET_NAME || '',
  R2_MAX_MOVIE_BYTES: process.env.R2_MAX_MOVIE_BYTES ? Number(process.env.R2_MAX_MOVIE_BYTES) : 20 * 1024 * 1024 * 1024,
  R2_USER_QUOTA_BYTES: process.env.R2_USER_QUOTA_BYTES ? Number(process.env.R2_USER_QUOTA_BYTES) : 100 * 1024 * 1024 * 1024,
  ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL?.toLowerCase().trim() || '',
  TMDB_API_KEY: process.env.TMDB_API_KEY?.trim() || '',
  TMDB_ACCESS_TOKEN: process.env.TMDB_ACCESS_TOKEN?.trim() || '',
  TMDB_CACHE_TTL_SECONDS: process.env.TMDB_CACHE_TTL_SECONDS ? Number(process.env.TMDB_CACHE_TTL_SECONDS) : 900,
  INTERNET_ARCHIVE_CACHE_TTL_SECONDS: process.env.INTERNET_ARCHIVE_CACHE_TTL_SECONDS ? Number(process.env.INTERNET_ARCHIVE_CACHE_TTL_SECONDS) : 3600,
  // Development-only escape hatch. Production streaming sources must be HTTPS.
  ALLOW_HTTP_STREAMS: process.env.ALLOW_HTTP_STREAMS === 'true',
};
