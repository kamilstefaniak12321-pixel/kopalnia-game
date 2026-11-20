// ------------------------------------------------------------
// APLIKACJA NA KOMPUTER (Electron) - proces główny
//
// Otwiera okno z grą. Pliki gry (index.html, src/, lib/) są podawane
// pod własnym adresem gra://kopalnia/ - dla gry to zwykła strona,
// więc działa tak samo jak w przeglądarce (moduły, zapis postępu).
// Zapis leży w folderze aplikacji (%APPDATA%\Kopalnia) i zostaje
// po aktualizacjach.
//
// Aktualizacje: przy starcie aplikacja sprawdza wydania na GitHubie
// (package.json -> build.publish), pobiera nową wersję w tle
// i instaluje ją przy zamknięciu gry. Opis: docs/aplikacje.md.
//
// Klawisze: F11 - pełny ekran, F12 - narzędzia programisty.
// ------------------------------------------------------------

const { app, BrowserWindow, Menu, net, protocol, ipcMain } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const GAME_ROOT = path.join(__dirname, '..');
const SCHEME = 'gra';
const START_URL = `${SCHEME}://kopalnia/index.html`;

// Własny adres musi być zgłoszony przed startem aplikacji:
// "standard" i "secure" - jak https (moduły, localStorage).
protocol.registerSchemesAsPrivileged([
    { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

let okno = null;
let stanAktualizacji = '';

function ustawStan(tekst) {
    stanAktualizacji = tekst;
    if (okno && !okno.isDestroyed()) okno.webContents.send('aktualizacja', tekst);
}

function otworzOkno() {
    okno = new BrowserWindow({
        width: 1280, height: 720, minWidth: 800, minHeight: 500,
        backgroundColor: '#000000', title: 'Kopalnia',
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false }
    });
    Menu.setApplicationMenu(null);
    okno.webContents.on('before-input-event', (event, input) => {
        if (input.type !== 'keyDown') return;
        if (input.key === 'F11') { okno.setFullScreen(!okno.isFullScreen()); event.preventDefault(); }
        if (input.key === 'F12') { okno.webContents.toggleDevTools(); event.preventDefault(); }
    });
    okno.loadURL(START_URL);
}

// Tylko jedna kopia gry naraz (wspólny zapis).
if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (okno) { if (okno.isMinimized()) okno.restore(); okno.focus(); }
    });

    app.whenReady().then(() => {
        // Pliki gry: tylko z folderu gry (żadnego wychodzenia przez "..").
        protocol.handle(SCHEME, (request) => {
            const url = new URL(request.url);
            const file = path.normalize(path.join(GAME_ROOT, decodeURIComponent(url.pathname)));
            if (file !== GAME_ROOT && !file.startsWith(GAME_ROOT + path.sep)) return new Response(null, { status: 403 });
            return net.fetch(pathToFileURL(file).href);
        });

        ipcMain.handle('wersja', () => app.getVersion());
        ipcMain.handle('stan-aktualizacji', () => stanAktualizacji);

        otworzOkno();

        // Aktualizacje tylko w zainstalowanej grze (nie przy "npm start").
        if (app.isPackaged) {
            const { autoUpdater } = require('electron-updater');
            autoUpdater.autoDownload = true;
            autoUpdater.autoInstallOnAppQuit = true;
            autoUpdater.on('update-available', (info) => ustawStan(`Pobieram wersję ${info.version}…`));
            autoUpdater.on('download-progress', (p) => ustawStan(`Pobieram aktualizację: ${Math.round(p.percent)}%`));
            autoUpdater.on('update-downloaded', (info) => ustawStan(`Wersja ${info.version} zainstaluje się po zamknięciu gry`));
            autoUpdater.on('error', () => ustawStan(''));
            autoUpdater.checkForUpdates().catch(() => { /* brak internetu - gramy dalej */ });
        }
    });

    app.on('window-all-closed', () => app.quit());
}
