import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = process.argv[2];
if (!['backend', 'web'].includes(target)) throw new Error('Usage: node deploy/build.mjs backend|web');

const env = { ...process.env, NPM_CONFIG_PRODUCTION: 'false', NPM_CONFIG_INCLUDE: 'dev' };
if (target === 'web') {
  const api = httpsOrigin(env.EXPO_PUBLIC_API_URL, 'EXPO_PUBLIC_API_URL');
  env.EXPO_PUBLIC_API_URL = api;
  env.EXPO_PUBLIC_SOCKET_URL = httpsOrigin(env.EXPO_PUBLIC_SOCKET_URL || api, 'EXPO_PUBLIC_SOCKET_URL');
  env.EXPO_PUBLIC_WEB_URL = httpsOrigin(env.EXPO_PUBLIC_WEB_URL || env.RENDER_EXTERNAL_URL, 'EXPO_PUBLIC_WEB_URL / RENDER_EXTERNAL_URL');
  // Never pick up a developer's mobile/.env during a production export.
  env.EXPO_NO_DOTENV = '1';
}

function httpsOrigin(value, key) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${key} must be a public HTTPS origin.`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || /^(localhost|127\.|10\.|192\.168\.|\[::1\])/.test(url.hostname)) {
    throw new Error(`${key} must be a public HTTPS origin without a path.`);
  }
  return url.origin;
}

function npm(directory, args) {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    cwd: resolve(root, directory), env, stdio: 'inherit', shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

npm('shared', ['ci', '--include=dev']);
npm('shared', ['run', 'build']);
if (target === 'backend') {
  npm('backend', ['ci', '--include=dev']);
  npm('backend', ['run', 'prisma:generate']);
  npm('backend', ['run', 'build']);
} else {
  npm('mobile', ['ci', '--include=dev']);
  npm('mobile', ['run', 'export:web']);
}
