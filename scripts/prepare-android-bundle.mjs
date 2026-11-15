import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const androidPublicDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'public');

const stripTargets = [
  path.join(androidPublicDir, 'downloads'),
  path.join(androidPublicDir, 'shopier-covers'),
  path.join(androidPublicDir, 'server.cjs'),
  path.join(androidPublicDir, 'server.cjs.map'),
];

let removedCount = 0;
for (const target of stripTargets) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
    removedCount++;
    console.log(`[Android Sanitizer] Stripped non-Android binary/server asset: ${path.relative(rootDir, target)}`);
  }
}

const showcaseDir = path.join(androidPublicDir, 'showcase');
const keepShowcaseFiles = new Set(['apple-hero-devices.png']);
if (fs.existsSync(showcaseDir)) {
  for (const entry of fs.readdirSync(showcaseDir, { withFileTypes: true })) {
    if (!keepShowcaseFiles.has(entry.name)) {
      const target = path.join(showcaseDir, entry.name);
      fs.rmSync(target, { recursive: true, force: true });
      removedCount++;
      console.log(`[Android Sanitizer] Stripped web-only showcase asset: ${path.relative(rootDir, target)}`);
    }
  }
}

const rcGradlePath = path.join(
  rootDir,
  'node_modules',
  '@revenuecat',
  'purchases-capacitor',
  'android',
  'build.gradle'
);
if (fs.existsSync(rcGradlePath)) {
  const origGradle = fs.readFileSync(rcGradlePath, 'utf8');
  const patchedGradle = origGradle
    .replace(/com\.android\.tools\.build:gradle:[^'"]+/g, 'com.android.tools.build:gradle:8.9.1')
    .replace(/org\.jetbrains\.kotlin:kotlin-gradle-plugin:[^'"]+/g, 'org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25');
  if (patchedGradle !== origGradle) {
    fs.writeFileSync(rcGradlePath, patchedGradle, 'utf8');
    console.log('[Android Sanitizer] Aligned @revenuecat/purchases-capacitor AGP (8.9.1) & Kotlin (1.9.25).');
  }
}

const requiredFiles = [
  path.join(androidPublicDir, 'index.html'),
];

for (const reqFile of requiredFiles) {
  if (!fs.existsSync(reqFile)) {
    console.error(`[Android Sanitizer] MISSING REQUIRED FILE: ${path.relative(rootDir, reqFile)}`);
    process.exit(1);
  }
}

console.log(`[Android Sanitizer] OK — Android bundle sanitized (${removedCount} foreign items stripped).`);
