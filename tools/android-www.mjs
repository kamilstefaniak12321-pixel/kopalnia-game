// Kopiuje pliki gry do folderu www/ - stamtąd Capacitor bierze je do
// aplikacji na telefon (npm run android:sync). Folder www/ nie jest w gicie.
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

rmSync('www', { recursive: true, force: true });
mkdirSync('www');
cpSync('index.html', 'www/index.html');
for (const folder of ['src', 'lib']) cpSync(folder, 'www/' + folder, { recursive: true });
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
writeFileSync('www/wersja.json', JSON.stringify({ version }) + '\n');
console.log('Pliki gry skopiowane do www/ (wersja ' + version + ')');
