type Environment = Record<string, string | undefined>;

export function validateProductionEnvironment(env: Environment): void {
  if (env.NODE_ENV !== 'production') return;
  const invalid: string[] = [];
  const secret = env.JWT_SECRET?.trim() || '';
  if (secret.length < 32 || /dev_only|replace|change-me/i.test(secret)) invalid.push('JWT_SECRET (random, at least 32 characters)');
  try {
    const database = new URL(env.DATABASE_URL || '');
    if (!['postgresql:', 'postgres:'].includes(database.protocol) || !database.hostname) throw new Error();
  } catch { invalid.push('DATABASE_URL (PostgreSQL URL)'); }
  for (const key of ['CORS_ORIGIN', 'PUBLIC_WEB_URL']) {
    // Native clients do not need a browser origin or a website redirect.
    // When web support is configured, keep validating its HTTPS origin.
    const value = env[key]?.trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error();
    } catch { invalid.push(`${key} (HTTPS origin)`); }
  }
  if (!env.TMDB_ACCESS_TOKEN?.trim() && !env.TMDB_API_KEY?.trim()) invalid.push('TMDB_ACCESS_TOKEN or TMDB_API_KEY');
  if (env.ALLOW_HTTP_STREAMS === 'true') invalid.push('ALLOW_HTTP_STREAMS (must be false)');
  const hops = Number(env.TRUST_PROXY_HOPS || '0');
  if (!Number.isInteger(hops) || hops < 0 || hops > 3) invalid.push('TRUST_PROXY_HOPS (integer from 0 to 3)');
  // Report variable names only: URLs and credentials must never appear in errors.
  if (invalid.length) throw new Error(`Invalid production configuration: ${invalid.join(', ')}`);
}
