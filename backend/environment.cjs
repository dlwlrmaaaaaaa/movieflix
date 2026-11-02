const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

function loadBackendEnvironment(backendRoot = __dirname, env = process.env) {
  const root = path.dirname(backendRoot);
  // Runtime-injected values win, then the Neon CLI's root env file. Preserve
  // backend/.env for existing JWT, TMDB, LiveKit, R2 and local configuration.
  const files = [path.join(root, '.env.local'), path.join(root, '.env'), path.join(backendRoot, '.env.local'), path.join(backendRoot, '.env')];
  for (const file of files) {
    let content;
    try { content = fs.readFileSync(file); } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    for (const [key, value] of Object.entries(dotenv.parse(content))) {
      if (env[key] === undefined) env[key] = value;
    }
  }
  // A regular local/Postgres URL also supports migrations. Neon pooler URLs
  // require the separate direct URL provided by `neon deploy` / `env pull`.
  if (!env.DATABASE_URL_UNPOOLED && env.DATABASE_URL) {
    try {
      const hostname = new URL(env.DATABASE_URL).hostname;
      if (!hostname.includes('-pooler.')) env.DATABASE_URL_UNPOOLED = env.DATABASE_URL;
    } catch {
      // The production validator reports invalid variables without their values.
    }
  }
  return env;
}

module.exports = { loadBackendEnvironment };
