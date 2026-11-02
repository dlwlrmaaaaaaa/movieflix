const { spawn } = require('node:child_process');
const path = require('node:path');
const { loadBackendEnvironment } = require('../environment.cjs');

loadBackendEnvironment();
const args = process.argv.slice(2);
if (args[0] !== 'generate' && process.env.DATABASE_URL?.includes('-pooler.') && !process.env.DATABASE_URL_UNPOOLED) {
  throw new Error('DATABASE_URL_UNPOOLED is required for Prisma migrations. Run neon env pull.');
}
if (args[0] !== 'generate' && process.env.DATABASE_URL_UNPOOLED && new URL(process.env.DATABASE_URL_UNPOOLED).hostname.includes('-pooler.')) {
  throw new Error('DATABASE_URL_UNPOOLED must use the direct Postgres endpoint, without -pooler.');
}
const child = spawn(process.execPath, [require.resolve('prisma/build/index.js'), ...args], {
  cwd: path.resolve(__dirname, '..'), stdio: 'inherit', env: process.env,
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.once('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.once('exit', (code) => process.exit(code ?? 1));
