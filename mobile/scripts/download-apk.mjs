import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const artifact = process.argv[2];
if (!artifact || !artifact.startsWith('https://')) {
  console.error('Usage: node scripts/download-apk.mjs <HTTPS APK artifact URL from EAS>');
  process.exitCode = 1;
} else {
  const response = await fetch(artifact);
  if (!response.ok) throw new Error(`APK download failed (${response.status}).`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('The downloaded file is not an APK archive.');
  const directory = new URL('../artifacts/', import.meta.url);
  await mkdir(directory, { recursive: true });
  const output = new URL('AnnahFlix.apk', directory);
  await writeFile(output, bytes);
  console.log(`Saved ${fileURLToPath(output)}`);
}
