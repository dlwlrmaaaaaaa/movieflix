import { SyncEngine } from '../src/sockets/utils/syncEngine';
import { generateRoomCode } from '../src/utils/roomCode';
import { generateToken, verifyToken } from '../src/utils/token';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✔ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✖ FAIL: ${testName}`);
    failed++;
  }
}

console.log('🧪 Running TogetherFlix Backend Test Suite...\n');

// 1. Room Code Generation
console.log('[1. Room Code Suite]');
const code1 = generateRoomCode();
assert(/^TF-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/.test(code1), `Room code format (${code1})`);

let noAmbiguous = true;
for (let i = 0; i < 50; i++) {
  if (/[0O1I]/.test(generateRoomCode())) {
    noAmbiguous = false;
    break;
  }
}
assert(noAmbiguous, 'No ambiguous characters (0, O, 1, I) across 50 generated codes');

// 2. Title Normalization
console.log('\n[2. Movie Title Normalization]');
const clean1 = SyncEngine.cleanMovieTitle('Inception.2010.1080p.BluRay.x264-[YTS.MX].mp4');
assert(clean1 === 'inception 2010', `Clean YTS tag: "${clean1}" === "inception 2010"`);

const clean2 = SyncEngine.cleanMovieTitle('La.La.Land.2016.720p.WEBRip.x265-RARBG.mkv');
assert(clean2 === 'la la land 2016', `Clean RARBG tag: "${clean2}" === "la la land 2016"`);

// 3. Compatibility Heuristics
console.log('\n[3. Compatibility Heuristics]');
const hostExact = {
  userId: 'u1',
  displayName: 'Partner 1',
  fileName: 'Interstellar.2014.1080p.mp4',
  durationSeconds: 10140.2,
  isReady: false,
  pickedAt: new Date().toISOString(),
};
const guestExact = {
  userId: 'u2',
  displayName: 'Partner 2',
  fileName: 'Interstellar (2014) [YTS].mp4',
  durationSeconds: 10140.8,
  isReady: false,
  pickedAt: new Date().toISOString(),
};

const resExact = SyncEngine.evaluateCompatibility(hostExact, guestExact);
assert(resExact.grade === 'PERFECT_MATCH', 'Identical duration identified as PERFECT_MATCH');
assert(resExact.durationDiffSeconds <= 1.0, 'Duration delta <= 1.0s');

const guestWarning = { ...guestExact, durationSeconds: 10144.5 };
const resWarning = SyncEngine.evaluateCompatibility(hostExact, guestWarning);
assert(resWarning.grade === 'COMPATIBLE_WARNING', '4.3s duration difference identified as COMPATIBLE_WARNING');

const guestMismatch = { ...guestExact, durationSeconds: 10800.0 };
const resMismatch = SyncEngine.evaluateCompatibility(hostExact, guestMismatch);
assert(resMismatch.grade === 'MISMATCH_ALERT', '>6s duration difference identified as MISMATCH_ALERT');

// 4. JWT Authentication
console.log('\n[4. JWT Token Authentication]');
const testToken = generateToken({ userId: 'user-xyz-99', email: 'love@togetherflix.com' });
assert(typeof testToken === 'string' && testToken.length > 20, 'Token generated');

const decoded = verifyToken(testToken);
assert(decoded.userId === 'user-xyz-99', `Decoded userId matches: "${decoded.userId}"`);
assert(decoded.email === 'love@togetherflix.com', `Decoded email matches: "${decoded.email}"`);

console.log(`\n========================================`);
console.log(`🎉 Test Results: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) process.exit(1);
