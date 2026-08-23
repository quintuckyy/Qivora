import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist');

if (!existsSync(dist)) mkdirSync(dist, { recursive: true });

const files = [
  ['manifest.json', 'manifest.json'],
  ['src/popup/popup.html', 'popup.html'],
  ['src/popup/popup.css', 'popup.css'],
];

for (const [from, to] of files) {
  copyFileSync(join(root, from), join(dist, to));
  console.log(`copied ${from} -> dist/${to}`);
}
