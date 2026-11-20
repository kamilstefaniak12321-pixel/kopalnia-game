// ------------------------------------------------------------
// GŁÓWNY PLIK GRY: łączy świat, gracza, kopanie, sklep i ekran.
// ------------------------------------------------------------
import * as THREE from '../lib/three/three.module.js';
import { CHUNK, TILE, ATLAS_TILES, REACH, SAVE_KEY, VERSION, EYE_HEIGHT } from './config.js';
import { AIR, BLOCKS } from './blocks.js';
import { MINES } from './mines.js';
import { generateMine } from './mine.js';
import { meshChunk } from './mesher.js';
import { TILE_NAMES, TILE_INDEX, makeTile, makeCrack } from './textures.js';
import { Player, raycast } from './player.js';
import * as eko from './economy.js';

const $ = id => document.getElementById(id);

// ---------- Zapis gry (postęp; sama kopalnia odtwarza się z ziarna) ----------
let stan = eko.nowyStan();
stan.ziarno = Math.floor(Math.random() * 1e9);
try {
    const z = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (z && typeof z.kasa === 'number') stan = { ...stan, ...z };
} catch { /* brak zapisu albo zapis uszkodzony - zaczynamy od nowa */ }
function zapisz() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(stan)); } catch { /* np. tryb prywatny */ } }

// ---------- Ekran ----------
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.autoClear = false;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color();
scene.fog = new THREE.Fog(0x000000, 1, 50);
const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 200);
camera.rotation.order = 'YXZ';

const ambient = new THREE.AmbientLight(0xffffff, 1);
const sun = new THREE.DirectionalLight(0xfff2d8, 1);
sun.position.set(0.5, 1, 0.3);
const lampa = new THREE.PointLight(0xffecd2, 1, 10, 1.6);
scene.add(ambient, sun, lampa);

// ---------- Tekstury: atlas 512x512 z kafelków 64x64 ----------
function tileCanvas(buf) {
    const c = document.createElement('canvas'); c.width = c.height = TILE;
    c.getContext('2d').putImageData(new ImageData(buf, TILE, TILE), 0, 0);
    return c;
}
const atlasCanvas = document.createElement('canvas');
atlasCanvas.width = atlasCanvas.height = TILE * ATLAS_TILES;
const ikony = {};
TILE_NAMES.forEach((n, i) => {
    const c = tileCanvas(makeTile(n));
    atlasCanvas.getContext('2d').drawImage(c, (i % ATLAS_TILES) * TILE, Math.floor(i / ATLAS_TILES) * TILE);
    ikony[n] = c.toDataURL();
});
function pixelTexture(canvas) {
    const t = new THREE.CanvasTexture(canvas);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
const material = new THREE.MeshLambertMaterial({ map: pixelTexture(atlasCanvas), vertexColors: true, alphaTest: 0.5 });
const ikonaBloku = id => ikony[BLOCKS[id].tekstury[1]];

// ---------- Świat i jego kawałki ----------
let kopalnia, world, player;
const chunks = new Map();

function rebuildChunk(cx, cy, cz) {
    const key = cx + ',' + cy + ',' + cz;
    const old = chunks.get(key);
    if (old) { scene.remove(old); old.geometry.dispose(); chunks.delete(key); }
    if (cx < 0 || cy < 0 || cz < 0 || cx * CHUNK >= world.w || cy * CHUNK >= world.h || cz * CHUNK >= world.d) return;
    const g = meshChunk(world, cx, cy, cz, TILE_INDEX);
    if (!g.idx.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(g.col, 3));
    geo.setIndex(g.idx);
    const mesh = new THREE.Mesh(geo, material);
    scene.add(mesh); chunks.set(key, mesh);
}

// Po zmianie bloku odśwież jego kawałek i sąsiadów (cienie narożników).
function blockChanged(x, y, z) {
    const todo = new Set();
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++)
        todo.add(Math.floor((x + dx) / CHUNK) + ',' + Math.floor((y + dy) / CHUNK) + ',' + Math.floor((z + dz) / CHUNK));
    for (const k of todo) rebuildChunk(...k.split(',').map(Number));
}

function naPowierzchnie() {
    Object.assign(player.pos, kopalnia.spawn);
    player.vel.x = player.vel.y = player.vel.z = 0;
    player.yaw = -Math.PI / 2; player.pitch = 0;   // twarzą do szybu
}

function wczytajKopalnie() {
    for (const m of chunks.values()) { scene.remove(m); m.geometry.dispose(); }
    chunks.clear();
    kopalnia = generateMine(MINES[stan.kopalnia], stan.ziarno);
    world = kopalnia.world;
    for (let cy = 0; cy < world.h / CHUNK; cy++) for (let cz = 0; cz < world.d / CHUNK; cz++) for (let cx = 0; cx < world.w / CHUNK; cx++)
        rebuildChunk(cx, cy, cz);
    player = new Player(world);
    naPowierzchnie();
}

// ---------- Ramka i pęknięcia na wskazanym bloku ----------
const ramka = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
    new THREE.LineBasicMaterial({ color: 0x000000, fog: false }));
const crackTex = [1, 2, 3, 4, 5].map(e => pixelTexture(tileCanvas(makeCrack(e))));
const pekniecia = new THREE.Mesh(new THREE.BoxGeometry(1.006, 1.006, 1.006),
    new THREE.MeshBasicMaterial({ map: crackTex[0], transparent: true, depthWrite: false, fog: false }));
ramka.visible = pekniecia.visible = false;
scene.add(ramka, pekniecia);

// ---------- Kilof w dłoni (rysowany osobno, żeby nie wchodził w ściany) ----------
const handScene = new THREE.Scene();
const handCamera = new THREE.PerspectiveCamera(55, 1, 0.01, 10);
const handSun = new THREE.DirectionalLight(0xffffff, 1.6);
handSun.position.set(-1, 2, 1);
handScene.add(new THREE.AmbientLight(0xffffff, 2.2), handSun);
const kilofGrupa = new THREE.Group();
const trzonek = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.6, 0.045), new THREE.MeshLambertMaterial({ color: 0x7a5230 }));
const glowica = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.06), new THREE.MeshLambertMaterial());
glowica.position.y = 0.28;
const ostrza = [-1, 1].map(s => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.05), glowica.material);
    m.position.set(s * 0.25, 0.25, 0); m.rotation.z = -s * 0.55; return m;
});
kilofGrupa.scale.setScalar(0.62);
kilofGrupa.add(trzonek, glowica, ...ostrza);
handScene.add(kilofGrupa);

// ---------- Dźwięk: krótkie stuknięcia robione kodem ----------
let audio;
function stuk(wysokosc = 1, glosnosc = 0.25) {
    try {
        audio ||= new AudioContext();
        const n = Math.floor(audio.sampleRate * 0.07), buf = audio.createBuffer(1, n, audio.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
        const src = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain();
        src.buffer = buf; f.type = 'bandpass'; f.frequency.value = 900 * wysokosc; g.gain.value = glosnosc;
        src.connect(f).connect(g).connect(audio.destination); src.start();
    } catch { /* brak dźwięku nie psuje gry */ }
}

// ---------- HUD i komunikaty ----------
let komunikatDo = 0;
function komunikat(tekst) {
    $('komunikat').textContent = tekst; $('komunikat').style.opacity = 1;
    komunikatDo = performance.now() + 1800;
}
function odswiezHud() {
    $('kasa').textContent = stan.kasa + ' monet';
    $('plecak').textContent = `Plecak: ${eko.ileWPlecaku(stan)}/${eko.pojemnosc(stan)}`;
    $('kilof').textContent = eko.KILOFY[stan.kilof].nazwa;
    $('urobek').innerHTML = Object.entries(stan.przedmioty)
        .map(([id, n]) => `<div><img src="${ikonaBloku(id)}">${n}</div>`).join('');
}

// ---------- Sklep ----------
let sklepOtwarty = false;
function rysujSklep() {
    const wart = eko.wartoscUrobku(stan);
    const ulepszenie = (rodzaj, tytul, opis) => {
        const lista = { kilof: eko.KILOFY, plecak: eko.PLECAKI, lampa: eko.LAMPY }[rodzaj];
        const teraz = lista[stan[rodzaj]], n = eko.nastepne(stan, rodzaj);
        return `<div class="wiersz"><div>${tytul}: <b>${teraz.nazwa}</b><small>${n ? 'Następny: ' + n.nazwa + ' — ' + opis(n) : 'Najlepszy możliwy'}</small></div>
            ${n ? `<button data-kup="${rodzaj}" ${stan.kasa < n.cena ? 'disabled' : ''}>Kup za ${n.cena}</button>` : ''}</div>`;
    };
    const kopalnie = MINES.map((m, i) => {
        const mam = stan.kopalnie.includes(i);
        const przycisk = i === stan.kopalnia ? '<button disabled>Jesteś tutaj</button>'
            : mam ? `<button data-idz="${i}">Jedź</button>`
                : `<button data-kopalnia="${i}" ${stan.kasa < m.cena ? 'disabled' : ''}>Kup za ${m.cena}</button>`;
        return `<div class="wiersz"><div><b>${m.nazwa}</b> (${m.depth} m)<small>${m.opis}</small></div>${przycisk}</div>`;
    }).join('');
    $('sklep').innerHTML = `<h1>Skup i sklep</h1><div class="stan-kasy">${stan.kasa} monet</div>
        <h2>Urobek</h2>
        <div class="lista-urobku">${Object.entries(stan.przedmioty).map(([id, n]) =>
            `<div><img src="${ikonaBloku(id)}">${BLOCKS[id].nazwa}<br>${n} × ${BLOCKS[id].wartosc}</div>`).join('') || 'Plecak jest pusty.'}</div>
        <div class="wiersz"><div></div><button data-sprzedaj ${wart ? '' : 'disabled'}>Sprzedaj wszystko (+${wart})</button></div>
        <h2>Wyposażenie</h2>
        ${ulepszenie('kilof', 'Kilof', n => 'kopie ' + n.szybkosc + '× szybciej, rusza twardsze skały')}
        ${ulepszenie('plecak', 'Plecak', n => 'mieści ' + n.pojemnosc + ' sztuk')}
        ${ulepszenie('lampa', 'Lampa', n => 'świeci na ' + n.zasieg + ' bloków')}
        <h2>Kopalnie</h2>${kopalnie}
        <div class="wiersz"><div>Nowa wyprawa<small>Ta sama kopalnia, ale z nowym układem chodników.</small></div><button data-nowa>Wylosuj</button></div>
        <p><button data-zamknij>Wróć do gry (E)</button></p>`;
}
function otworzSklep() { sklepOtwarty = true; $('sklep').hidden = false; rysujSklep(); document.exitPointerLock?.(); }
function zamknijSklep() { sklepOtwarty = false; $('sklep').hidden = true; zlapMysz(); }
function zmienKopalnie(i, noweZiarno) {
    stan.kopalnia = i;
    if (noweZiarno) stan.ziarno = Math.floor(Math.random() * 1e9);
    wczytajKopalnie(); zapisz(); odswiezHud();
}
$('sklep').addEventListener('click', e => {
    const d = e.target.dataset;
    if (!e.target.matches('button')) return;
    if ('sprzedaj' in d) { const z = eko.sprzedajWszystko(stan); stuk(2.2); komunikat('Sprzedano za ' + z + ' monet'); }
    else if (d.kup) { if (eko.kupUlepszenie(stan, d.kup)) stuk(1.6); }
    else if (d.kopalnia) { if (eko.kupKopalnie(stan, +d.kopalnia)) zmienKopalnie(+d.kopalnia, true); }
    else if (d.idz) zmienKopalnie(+d.idz, true);
    else if ('nowa' in d) zmienKopalnie(stan.kopalnia, true);
    else if ('zamknij' in d) return zamknijSklep();
    zapisz(); odswiezHud(); rysujSklep();
});

// ---------- Sterowanie ----------
const klawisze = new Set();
let myszWcisnieta = false, gra = false, bezMyszy = false;
function zlapMysz() { gra = true; $('start').hidden = true; if (!bezMyszy) renderer.domElement.requestPointerLock?.(); }
$('graj').addEventListener('click', zlapMysz);
renderer.domElement.addEventListener('click', () => { if (gra && !sklepOtwarty) zlapMysz(); });
document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement || sklepOtwarty || bezMyszy || komendaOtwarta()) return;
    gra = false; myszWcisnieta = false; klawisze.clear();
    $('start').hidden = false; $('graj').textContent = 'Wróć do gry';
});
document.addEventListener('mousemove', e => {
    if (!document.pointerLockElement) return;
    player.yaw -= e.movementX * 0.0023;
    player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch - e.movementY * 0.0023));
});
document.addEventListener('mousedown', e => { if (e.button === 0 && document.pointerLockElement) myszWcisnieta = true; });
document.addEventListener('mouseup', e => { if (e.button === 0) myszWcisnieta = false; });

const komendaOtwarta = () => $('komenda').style.display === 'block';
function przySklepie() {
    return player.pos.y > kopalnia.groundY + 0.5
        && Math.hypot(player.pos.x - kopalnia.shop.x, player.pos.z - kopalnia.shop.z) < 5;
}
document.addEventListener('keydown', e => {
    if (komendaOtwarta()) {
        if (e.code === 'Enter') { wykonajKomende($('komenda').value); $('komenda').value = ''; }
        if (e.code === 'Enter' || e.code === 'Escape') { $('komenda').style.display = 'none'; zlapMysz(); }
        return;
    }
    if (e.code === 'KeyE' && sklepOtwarty) return zamknijSklep();
    if (!gra || sklepOtwarty) return;
    if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
    klawisze.add(e.code);
    if (e.code === 'KeyE') { if (przySklepie()) otworzSklep(); else komunikat('Skup jest w budce na powierzchni'); }
    if (e.code === 'KeyT') {
        e.preventDefault(); klawisze.clear(); document.exitPointerLock?.();
        $('komenda').style.display = 'block'; $('komenda').focus();
    }
});
document.addEventListener('keyup', e => klawisze.delete(e.code));
window.addEventListener('blur', () => { klawisze.clear(); myszWcisnieta = false; });

// ---------- Komendy testowe (klawisz T) ----------
function wykonajKomende(tekst) {
    const [nazwa, arg] = tekst.trim().toLowerCase().split(/\s+/);
    const n = parseInt(arg, 10);
    const ustaw = (pole, lista) => { if (n >= 0 && n < lista.length) { stan[pole] = n; return true; } };
    if (nazwa === 'kasa' && n >= 0) stan.kasa = n;
    else if (nazwa === 'kilof' && ustaw('kilof', eko.KILOFY));
    else if (nazwa === 'plecak' && ustaw('plecak', eko.PLECAKI));
    else if (nazwa === 'lampa' && ustaw('lampa', eko.LAMPY));
    else if (nazwa === 'gora') naPowierzchnie();
    else if (nazwa === 'dol') { player.pos.x = kopalnia.shaft.x + 1.5; player.pos.z = kopalnia.shaft.z + 1.5; player.pos.y = kopalnia.shaft.bottomY; }
    else if (nazwa === 'kopalnia' && MINES[n]) { if (!stan.kopalnie.includes(n)) stan.kopalnie.push(n); zmienKopalnie(n, true); }
    else if (nazwa === 'reset') { stan = { ...eko.nowyStan(), ziarno: stan.ziarno }; wczytajKopalnie(); }
    else return komunikat('Komendy: kasa N, kilof 0-5, plecak 0-3, lampa 0-3, kopalnia 0-2, gora, dol, reset');
    komunikat('OK: ' + tekst); zapisz(); odswiezHud();
}

// ---------- Kopanie ----------
let cel = null, postep = 0, zamach = 0, linaCzas = 0;
function kopanie(dt) {
    const hit = raycast(world, player.eye(), player.dir(), REACH);
    if (!hit || !cel || hit.x !== cel.x || hit.y !== cel.y || hit.z !== cel.z) postep = 0;
    cel = hit;
    ramka.visible = !!hit;
    if (hit) ramka.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);

    let kopie = false;
    if (hit && myszWcisnieta) {
        const b = BLOCKS[hit.id];
        if (b.staly) komunikat('Tego nie da się wykopać');
        else if (!eko.mozeKopac(stan, hit.id)) komunikat(`${b.nazwa} jest za twardy — potrzebny ${eko.KILOFY[b.poziom].nazwa.toLowerCase()}`);
        else if (b.wartosc && eko.czyPelny(stan)) komunikat('Plecak pełny — sprzedaj urobek na powierzchni');
        else {
            kopie = true;
            postep += dt / eko.czasKopania(stan, hit.id);
            if (postep >= 1) {
                world.set(hit.x, hit.y, hit.z, AIR);
                blockChanged(hit.x, hit.y, hit.z);
                if (eko.dodajUrobek(stan, hit.id)) { komunikat('+1 ' + b.nazwa); zapisz(); }
                stuk(0.6, 0.4); odswiezHud();
                postep = 0; cel = null;
            }
        }
    }
    if (!kopie) postep = 0;
    pekniecia.visible = postep > 0 && !!cel;
    if (pekniecia.visible) {
        pekniecia.position.copy(ramka.position);
        pekniecia.material.map = crackTex[Math.min(4, Math.floor(postep * 5))];
    }
    $('postep').style.display = postep > 0 ? 'block' : 'none';
    $('postep').firstElementChild.style.width = Math.round(postep * 100) + '%';

    // Zamach kilofem - stuknięcie w najniższym punkcie.
    const przed = Math.sin(zamach);
    zamach = kopie ? zamach + dt * 11 : 0;
    if (kopie && przed > 0 && Math.sin(zamach) <= 0) stuk(1 + Math.random() * 0.3);
    kilofGrupa.position.set(0.34, -0.3, -0.6);
    kilofGrupa.rotation.set(-0.5 - Math.max(0, Math.sin(zamach)) * 0.9, 0.3, -0.35);
}

// ---------- Pętla gry ----------
const NIEBO = new THREE.Color(0x8ec5ee), CIEMNOSC = new THREE.Color(0x020203);
function klatka(dt) {
    if (gra && !sklepOtwarty && !komendaOtwarta()) {
        player.update(dt, {
            forward: klawisze.has('KeyW'), back: klawisze.has('KeyS'),
            left: klawisze.has('KeyA'), right: klawisze.has('KeyD'),
            jump: klawisze.has('Space'), down: klawisze.has('ShiftLeft') || klawisze.has('ShiftRight'),
            sprint: klawisze.has('ControlLeft')
        });
        kopanie(dt);

        // Lina ratunkowa: przytrzymaj R.
        linaCzas = klawisze.has('KeyR') ? linaCzas + dt : 0;
        if (linaCzas > 1.5) { naPowierzchnie(); linaCzas = 0; klawisze.delete('KeyR'); komunikat('Lina wyciągnęła cię na powierzchnię'); }
    }

    const oko = player.eye();
    camera.position.set(oko.x, oko.y, oko.z);
    camera.rotation.set(player.pitch, player.yaw, 0);
    lampa.position.copy(camera.position);

    // Im głębiej pod ziemią, tym ciemniej - zostaje tylko lampa.
    const pod = Math.max(0, Math.min(1, (kopalnia.groundY + 1 + EYE_HEIGHT - oko.y) / 5));
    const zasieg = eko.LAMPY[stan.lampa].zasieg;
    scene.background.copy(NIEBO).lerp(CIEMNOSC, pod);
    scene.fog.color.copy(scene.background);
    scene.fog.near = 2 + (1 - pod) * 30; scene.fog.far = 80 + (zasieg * 1.4 - 80) * pod;
    ambient.intensity = 2.2 - 2.1 * pod;
    sun.intensity = 1.6 * (1 - pod);
    lampa.distance = zasieg * 1.3;
    lampa.intensity = (4 + zasieg * 1.6) * (0.25 + 0.75 * pod);
    glowica.material.color.setHex(eko.KILOFY[stan.kilof].kolor);

    const glebokosc = Math.max(0, Math.floor(kopalnia.groundY + 1 - player.pos.y));
    $('glebokosc').textContent = glebokosc > 0 ? `Głębokość: ${glebokosc} m` : MINES[stan.kopalnia].nazwa + ' — powierzchnia';
    $('podpowiedz').textContent = !gra || sklepOtwarty ? '' : linaCzas > 0.2 ? 'Wciągam linę…'
        : przySklepie() ? 'E — skup i sklep' : player.onLadder ? 'Spacja — w górę, Shift — w dół' : '';
    if (performance.now() > komunikatDo) $('komunikat').style.opacity = 0;

    renderer.clear();
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(handScene, handCamera);
}

function rozmiar() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = handCamera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix(); handCamera.updateProjectionMatrix();
}
window.addEventListener('resize', rozmiar);

document.querySelector('.wersja').textContent = 'wersja ' + VERSION;
if (!stan.kopalnie.includes(stan.kopalnia)) stan.kopalnia = 0;
wczytajKopalnie(); odswiezHud(); rozmiar();
setInterval(zapisz, 10000);

let ostatnio = performance.now();
renderer.setAnimationLoop(teraz => {
    const dt = Math.min(0.05, (teraz - ostatnio) / 1000);
    ostatnio = teraz;
    klatka(dt);
});

// Dla testów automatycznych: sterowanie bez łapania myszy.
window.__gra = {
    get stan() { return stan; }, get player() { return player; }, get kopalnia() { return kopalnia; },
    start() { bezMyszy = true; zlapMysz(); }, komenda: wykonajKomende, otworzSklep,
    mysz(v) { myszWcisnieta = v; }, klawisz(k, v) { v ? klawisze.add(k) : klawisze.delete(k); }
};
