import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const iosPublicDir = path.join(rootDir, 'ios', 'App', 'App', 'public');
const iosAppDir = path.join(rootDir, 'ios', 'App', 'App');

const stripTargets = [
  path.join(iosPublicDir, 'downloads'),
  path.join(iosPublicDir, 'server.cjs'),
  path.join(iosPublicDir, 'server.cjs.map'),
];

let removedCount = 0;
for (const target of stripTargets) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
    removedCount++;
    console.log(`[iOS Sanitizer] Stripped non-iOS binary/server asset: ${path.relative(rootDir, target)}`);
  }
}

const requiredFiles = [
  path.join(iosAppDir, 'PrivacyInfo.xcprivacy'),
  path.join(iosAppDir, 'Info.plist'),
  path.join(iosAppDir, 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png'),
  path.join(iosPublicDir, 'index.html'),
];

for (const reqFile of requiredFiles) {
  if (!fs.existsSync(reqFile)) {
    console.error(`[iOS Sanitizer] MISSING REQUIRED FILE: ${path.relative(rootDir, reqFile)}`);
    process.exit(1);
  }
}

console.log(`[iOS Sanitizer] OK — iOS bundle sanitized (${removedCount} foreign items stripped) & App Store assets verified.`);
