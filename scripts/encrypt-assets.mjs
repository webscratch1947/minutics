// Encrypts the bundled JS/CSS that gets copied into the Android WebView assets.
// Only the native C++ library in the APK holds the matching key, so someone
// unzipping the APK sees ciphertext instead of readable frontend source.
//
// Usage: node scripts/encrypt-assets.mjs <android-assets-dir>
// The target dir is the Android app's app/src/main/assets (already copied
// from web app/dist/app by the normal packaging step).

import { readFileSync, writeFileSync, existsSync, unlinkSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2];
if (!root || !existsSync(root)) throw new Error('usage: node encrypt-assets.mjs <android-assets-dir>');

// MUST match KEY in app/src/main/cpp/guard.cpp and the JNI decrypt routine.
const KEY = [
  0x4D, 0x69, 0x6E, 0x75, 0x74, 0x69, 0x63, 0x73,
  0x47, 0x75, 0x61, 0x72, 0x64, 0x2D, 0x32, 0x30,
  0x32, 0x36, 0x6C, 0x6F, 0x63, 0x61, 0x6C, 0x41,
  0x73, 0x73, 0x65, 0x74, 0x47, 0x75, 0x61, 0x72,
];
const MAGIC = Buffer.from('MTCS', 'ascii');

function encrypt(data) {
  let s = 0 >>> 0;
  for (const b of KEY) s = (Math.imul(s, 31) + b) >>> 0;
  const out = Buffer.allocUnsafe(data.length + 4);
  MAGIC.copy(out, 0);
  for (let i = 0; i < data.length; i++) {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    out[i + 4] = data[i] ^ (s & 0xff);
  }
  return out;
}

const assetsDir = join(root, 'assets');
const files = readdirSync(assetsDir).filter(
  (f) => (f.endsWith('.js') || f.endsWith('.css')) && !f.endsWith('.enc'),
);
for (const f of files) {
  const p = join(assetsDir, f);
  const encPath = p + '.enc';
  writeFileSync(encPath, encrypt(readFileSync(p)));
  unlinkSync(p); // plain source must NOT ship in the APK
  console.log(`[encrypt] ${f} -> ${f}.enc (${readFileSync(encPath).length} bytes)`);
}
if (!files.length) console.log('[encrypt] no JS/CSS found to encrypt (already encrypted?)');
