#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const folder = path.join(root, 'download');
for (const name of ['index.html', 'styles.css', 'releases.js', 'favicon.svg']) {
  if (!fs.statSync(path.join(folder, name)).isFile()) throw new Error(`Missing ${name}`);
}
const html = fs.readFileSync(path.join(folder, 'index.html'), 'utf8');
const manifest = fs.readFileSync(path.join(folder, 'releases.js'), 'utf8');
for (const id of ['mac-download', 'win-download', 'mac-status', 'win-status']) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Missing ${id}`);
}
if (!manifest.includes('windows: null')) throw new Error('Unverified Windows installer is enabled');
if (/20261101-INTERNAL-TEST|20261101-INTERNAL|r3-ABI/i.test(manifest)) {
  throw new Error('Internal-only EXO candidate must never appear as a public download');
}
const mac = manifest.match(/mac:\s*Object\.freeze\(\{([\s\S]*?)\}\)/)?.[1];
if (!mac || !mac.includes("version: 'v0.3.0 Beta 1 (legacy)'") ||
    !mac.includes('unnotarized: true') || !mac.includes('verified: true')) {
  throw new Error('Only the identified historical beta is approved in this site manifest');
}
const url = mac.match(/url:\s*'([^']+)'/)?.[1];
if (url !== 'https://github.com/mikristian/exo-sample-3d/releases/download/v0.3.0-beta.1/EXO-ClothCraft-Studio-V2-macOS-arm64-v0.3.0-beta.1-UNNOTARIZED.dmg') {
  throw new Error('Unexpected or unverified historical beta URL');
}
if (!html.includes('The updated full Studio V2 installer is still undergoing independent testing')) {
  throw new Error('Missing current-build availability disclosure');
}
console.log('PASS: historical Mac beta is identified; updated EXO and Windows installers remain unpublished.');
