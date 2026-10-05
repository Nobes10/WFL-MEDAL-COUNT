import { cpSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const electronDir = join(root, 'electron');
const out = join(root, 'dist-electron');

mkdirSync(out, { recursive: true });

for (const file of readdirSync(electronDir)) {
  if (!file.endsWith('.js')) continue;
  cpSync(join(electronDir, file), join(out, file));
}

const clubLogos = join(electronDir, 'club-logos');
if (existsSync(clubLogos)) {
  cpSync(clubLogos, join(out, 'club-logos'), { recursive: true });
}

for (const file of readdirSync(out).filter((name) => name.endsWith('.js'))) {
  const content = readFileSync(join(out, file), 'utf8');
  if (content.includes('../src/')) {
    throw new Error(`${file} imports from ../src/, which is not bundled into dist-electron.`);
  }
  for (const match of content.matchAll(/from '\.\/([^']+)'/g)) {
    const dep = match[1];
    if (!dep.endsWith('.js')) continue;
    if (!existsSync(join(out, dep))) {
      throw new Error(`${file} depends on missing dist-electron file: ${dep}`);
    }
  }
}

console.log('Electron files copied to dist-electron/');
