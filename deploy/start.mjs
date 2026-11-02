import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const backend = fileURLToPath(new URL('../backend/', import.meta.url));
const require = createRequire(new URL('../backend/package.json', import.meta.url));
const { loadBackendEnvironment } = require('./environment.cjs');
loadBackendEnvironment();
let child;
let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => { stopping = true; child?.kill(signal); });
}
async function run(args) {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, args, { cwd: backend, stdio: 'inherit', env: process.env });
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}
// Free Render services do not have a pre-deploy job. Migrations must succeed
// before listening. Never use db push, migrate reset, or --accept-data-loss here.
const migrationExit = await run(['scripts/prisma.cjs', 'migrate', 'deploy']);
if (migrationExit !== 0 || stopping) process.exit(migrationExit || 1);
process.exit(await run(['dist/index.js']));
