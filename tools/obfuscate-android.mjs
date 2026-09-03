import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import JavaScriptObfuscator from 'javascript-obfuscator';

const assets = join('dist', 'assets');
const files = readdirSync(assets).filter((name) => name.endsWith('.js'));
if (files.length === 0) {
  console.warn('No JS in dist/assets to obfuscate');
  process.exit(0);
}

for (const name of files) {
  const path = join(assets, name);
  const source = readFileSync(path, 'utf8');
  const result = JavaScriptObfuscator.obfuscate(source, {
    compact: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.4,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    reservedNames: ['^Phaser', '^Capacitor'],
    target: 'browser',
  });
  writeFileSync(path, result.getObfuscatedCode());
  console.log(`obfuscated ${name}`);
}
