// Most między aplikacją a grą: obiekt window.desktop.
// W przeglądarce go nie ma i gra działa po staremu.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
    wersja: () => ipcRenderer.invoke('wersja'),
    stanAktualizacji: () => ipcRenderer.invoke('stan-aktualizacji'),
    naAktualizacje: (fn) => ipcRenderer.on('aktualizacja', (event, tekst) => fn(tekst))
});
