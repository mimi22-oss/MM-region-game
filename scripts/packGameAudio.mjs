#!/usr/bin/env node
/**
 * Packs raw MP3/OGG/WAV audio files into `.mta` (`MTGA` v1 game audio container)
 * so browser download managers (IDM, FDM, XDM, etc.) do not intercept game SFX
 * requests with auto-download dialogs.
 *
 * Usage:
 *   node scripts/packGameAudio.mjs                 # converts any .mp3 under public/assets/audio/{wildlife,weapons} -> .mta
 *   node scripts/packGameAudio.mjs in.mp3 out.mta  # converts a single file
 */
import fs from 'node:fs';
import path from 'node:path';

const MAGIC = Buffer.from([0x4d, 0x54, 0x47, 0x41]); // "MTGA"
const VERSION = 0x01;
const XOR_KEY = 0x5a;

export function packBufferToMta(raw) {
  const out = Buffer.allocUnsafe(6 + raw.length);
  MAGIC.copy(out, 0);
  out[4] = VERSION;
  out[5] = XOR_KEY;
  for (let i = 0; i < raw.length; i++) {
    out[6 + i] = raw[i] ^ XOR_KEY;
  }
  return out;
}

function packFile(srcPath, dstPath, removeSource = false) {
  const raw = fs.readFileSync(srcPath);
  const packed = packBufferToMta(raw);
  fs.mkdirSync(path.dirname(dstPath), { recursive: true });
  fs.writeFileSync(dstPath, packed);
  if (removeSource && srcPath !== dstPath) {
    fs.unlinkSync(srcPath);
  }
  console.log(`Packed ${path.relative(process.cwd(), srcPath)} -> ${path.relative(process.cwd(), dstPath)} (${packed.length} bytes)`);
}

function walkMp3Files(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkMp3Files(full, out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mp3')) {
      out.push(full);
    }
  }
  return out;
}

const args = process.argv.slice(2);
if (args.length >= 2) {
  packFile(path.resolve(args[0]), path.resolve(args[1]), false);
} else {
  const roots = [
    path.resolve(process.cwd(), 'public/assets/audio/wildlife'),
    path.resolve(process.cwd(), 'public/assets/audio/weapons'),
    path.resolve(process.cwd(), 'public/assets/audio/warehouse'),
  ];
  const files = roots.flatMap((r) => walkMp3Files(r));
  if (files.length === 0) {
    console.log('No raw .mp3 files found to pack.');
  } else {
    for (const file of files) {
      const dst = file.replace(/\.mp3$/i, '.mta');
      packFile(file, dst, true);
    }
  }
}
