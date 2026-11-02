const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const root = path.resolve(__dirname, '..');
const npmCli = process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
if (!fs.existsSync(npmCli)) throw new Error('Run this build with npm run build.');
function npm(directory, args) {
  const result = spawnSync(process.execPath, [npmCli, ...args], { cwd: path.join(root, directory), stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
npm('shared', ['run', 'build']);
npm('backend', ['run', 'build']);
npm('mobile', ['run', 'export:web']);
console.log('AnnahFlix build passed: shared types, backend, and Expo web export.');
