// ------------------------------------------------------------
// GŁÓWNY PLIK GRY: łączy świat, gracza, kopanie, sklep i ekran.
// ------------------------------------------------------------
import * as THREE from '../lib/three/three.module.js';
import { CHUNK, TILE, ATLAS_TILES, REACH, SAVE_KEY, VERSION, EYE_HEIGHT, WORLD_X, WORLD_Z } from './config.js';
import { AIR, TORCH, RUBBLE, WATER, PROP, DYNAMITE, MUSHROOM, FOSSIL, GEODE, CHEST, BLOCKS, WALLS, PLACED_LADDERS, isOpen, isThin } from './blocks.js';
import { MINES, charakter } from './mines.js';
import { MINERALY, RODZAJE, PRODUKTY } from './minerals.js';
import { OSIAGNIECIA, RZADKOSCI, sprawdzOsiagniecia, przyznaj } from './achievements.js';
import { createParticles } from './particles.js';
import { createBats } from './bats.js';
import { ZNALEZISKA, GRUPY, znajdz, otworzSkrzynke, rozbijGeode } from './finds.js';
import { generateMine, applyChanges } from './mine.js';
import { computeLight, SOURCES } from './light.js';
import { shaken, pulled, landingY, isHanging } from './cavein.js';
import { findWater, settleWater } from './water.js';
import { blast, BLAST_DANGER, BLAST_SHAKE } from './blast.js';
import { meshChunk } from './mesher.js';
import { TILE_NAMES, TILE_INDEX, makeTile, makeCrack } from './textures.js';
import { Player, raycast } from './player.js';
import * as eko from './economy.js';
import { createNpc, kwestia } from './npc.js';

const $ = id => document.getElementById(id);

// ---------- Zapis gry (postęp; sama kopalnia odtwarza się z ziarna) ----------
let stan = eko.nowyStan();
stan.ziarno = Math.floor(Math.random() * 1e9);
try {
    const z = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (z && typeof z.kasa === 'number') stan = { ...stan, ...z };
} catch { /* brak zapisu albo zapis uszkodzony - zaczynamy od nowa */ }
// Zmiany gracza w kopalni (wykopane i postawione bloki) - osobny zapis,
// ważny tylko dla tej kopalni i tego ziarna.
const SWIAT_KEY = SAVE_KEY + '-swiat';
let zmiany = {}, zmianyDoZapisu = false;
function zapisz() {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(stan));
        if (zmianyDoZapisu) {
            localStorage.setItem(SWIAT_KEY, JSON.stringify({ kopalnia: stan.kopalnia, ziarno: stan.ziarno, zmiany }));
            zmianyDoZapisu = false;
        }
    } catch { /* np. tryb prywatny albo brak miejsca */ }
}

// ---------- Ekran ----------
const renderer = new THREE.WebGLRenderer({ antialias: false });
// Ekran dotykowy (telefon, tablet): własne sterowanie i lżejszy obraz.
const DOTYK = window.matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('dotyk', DOTYK);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, DOTYK ? 1.5 : 2));
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
// decay 1: łagodniejszy spadek, żeby ściana tuż przed twarzą nie była biała
const lampa = new THREE.PointLight(0xffecd2, 1, 10, 1);
scene.add(ambient, sun, lampa);

// ---------- Tekstury: atlas 512x512 z kafelków 64x64 ----------
function tileCanvas(buf) {
    const c = document.createElement('canvas'); c.width = c.height = TILE;
    c.getContext('2d').putImageData(new ImageData(buf, TILE, TILE), 0, 0);
    return c;
}
const atlasCanvas = document.createElement('canvas');
atlasCanvas.width = atlasCanvas.height = TILE * ATLAS_TILES;
const ikony = {}, kolory = {};      // kolory: średni kolor tekstury (do odłamków)
TILE_NAMES.forEach((n, i) => {
    const buf = makeTile(n), suma = [0, 0, 0, 0];
    for (let j = 0; j < buf.length; j += 4) if (buf[j + 3]) { suma[0] += buf[j]; suma[1] += buf[j + 1]; suma[2] += buf[j + 2]; suma[3]++; }
    kolory[n] = suma.slice(0, 3).map(v => v / suma[3] / 255);
    const c = tileCanvas(buf);
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
// Światło pochodni jest zapisane w wierzchołkach ("swiatlo") i dodawane
// do koloru bloku jako ciepła poświata - działa też w zupełnej ciemności.
function poswiataPochodni(shader) {
    shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'attribute float swiatlo;\nvarying float vSwiatlo;\nvoid main() {\n\tvSwiatlo = swiatlo;');
    shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'varying float vSwiatlo;\nvoid main() {')
        // powyżej 1 = rzecz świeci sama (płomień, grzyb): własny kolor, bez ciepłego zabarwienia
        .replace('#include <opaque_fragment>', 'outgoingLight += diffuseColor.rgb * (vSwiatlo > 1.0 ? vec3(vSwiatlo * 0.8) : vSwiatlo * vec3(1.0, 0.74, 0.46) * 0.6);\n#include <opaque_fragment>');
}
material.onBeforeCompile = poswiataPochodni;
const materialWody = new THREE.MeshLambertMaterial({ color: 0x3f8fd0, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false });
materialWody.onBeforeCompile = poswiataPochodni;
const ikonaBloku = id => ikony[BLOCKS[id].tekstury[1]];

// ---------- Świat i jego kawałki ----------
let kopalnia, world, player;
const chunks = new Map(), chunksWody = new Map();

function rebuildChunk(cx, cy, cz) {
    const key = cx + ',' + cy + ',' + cz;
    for (const mapa of [chunks, chunksWody]) {
        const old = mapa.get(key);
        if (old) { scene.remove(old); old.geometry.dispose(); mapa.delete(key); }
    }
    if (cx < 0 || cy < 0 || cz < 0 || cx * CHUNK >= world.w || cy * CHUNK >= world.h || cz * CHUNK >= world.d) return;
    const g = meshChunk(world, cx, cy, cz, TILE_INDEX);
    if (g.woda.idx.length) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(g.woda.pos, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.woda.nor, 3));
        geo.setAttribute('swiatlo', new THREE.Float32BufferAttribute(g.woda.lit, 1));
        geo.setIndex(g.woda.idx);
        const mesh = new THREE.Mesh(geo, materialWody);
        mesh.renderOrder = 1;
        scene.add(mesh); chunksWody.set(key, mesh);
    }
    if (!g.idx.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(g.col, 3));
    geo.setAttribute('swiatlo', new THREE.Float32BufferAttribute(g.lit, 1));
    geo.setIndex(g.idx);
    const mesh = new THREE.Mesh(geo, material);
    scene.add(mesh); chunks.set(key, mesh);
}

// Zmiana bloku przez gracza: zapamiętaj ją, przelicz światło pochodni
// (gdy jakieś są) i odśwież kawałki świata, w których coś się zmieniło.
let pochodnie = 0;
function zmienBlok(x, y, z, id) { zmienBloki([[x, y, z, id]]); }
function zmienBloki(lista) {
    if (!lista.length) return;
    let x1 = 1e9, y1 = 1e9, z1 = 1e9, x2 = -1, y2 = -1, z2 = -1, swiatlo = false;
    for (const [x, y, z, id] of lista) {
        // Światło trzeba przeliczyć tylko wtedy, gdy zmiana dotyka źródła
        // światła albo miejsca, do którego światło dochodzi.
        if (!swiatlo) swiatlo = !!(SOURCES[id] || SOURCES[world.get(x, y, z)] || world.getLight(x, y, z) || world.getLight(x + 1, y, z) || world.getLight(x - 1, y, z)
            || world.getLight(x, y + 1, z) || world.getLight(x, y - 1, z) || world.getLight(x, y, z + 1) || world.getLight(x, y, z - 1));
        world.set(x, y, z, id);
        zmiany[world.index(x, y, z)] = id;
        if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y; if (z < z1) z1 = z; if (z > z2) z2 = z;
    }
    zmianyDoZapisu = true;
    if (swiatlo) {
        const stare = world.light.slice(), nowe = world.light;
        pochodnie = computeLight(world);
        for (let i = 0; i < nowe.length; i++) {
            if (nowe[i] === stare[i]) continue;
            const cx = i % world.w, cz = Math.floor(i / world.w) % world.d, cy = Math.floor(i / (world.w * world.d));
            if (cx < x1) x1 = cx; if (cx > x2) x2 = cx; if (cy < y1) y1 = cy; if (cy > y2) y2 = cy; if (cz < z1) z1 = cz; if (cz > z2) z2 = cz;
        }
    }
    const k = v => Math.floor(v / CHUNK);
    for (let cy = k(y1 - 1); cy <= k(y2 + 1); cy++) for (let cz = k(z1 - 1); cz <= k(z2 + 1); cz++) for (let cx = k(x1 - 1); cx <= k(x2 + 1); cx++)
        rebuildChunk(cx, cy, cz);
}

function naPowierzchnie() {
    Object.assign(player.pos, kopalnia.spawn);
    player.vel.x = player.vel.y = player.vel.z = 0;
    player.yaw = -Math.PI / 2; player.pitch = 0;   // twarzą do szybu
}

function wczytajKopalnie() {
    for (const mapa of [chunks, chunksWody]) { for (const m of mapa.values()) { scene.remove(m); m.geometry.dispose(); } mapa.clear(); }
    spadki.length = 0; przeplyw = null; oddech = 1; lonty.length = 0;
    for (const l of lecace) scene.remove(l.mesh);
    lecace.length = 0;
    kopalnia = generateMine(MINES[stan.kopalnia], stan.ziarno);
    world = kopalnia.world;
    // Wczytaj wcześniejsze zmiany, jeśli to wciąż ta sama kopalnia.
    zmiany = {};
    try {
        const z = JSON.parse(localStorage.getItem(SWIAT_KEY));
        if (z && z.kopalnia === stan.kopalnia && z.ziarno === stan.ziarno) zmiany = z.zmiany || {};
        else zmianyDoZapisu = true;
    } catch { /* brak zapisu świata */ }
    applyChanges(world, zmiany);
    pochodnie = computeLight(world);
    // Dynamit postawiony przed wyjściem z gry odpala się po powrocie.
    for (let i = 0; i < world.data.length; i++) if (world.data[i] === DYNAMITE)
        uzbroj(i % world.w, Math.floor(i / (world.w * world.d)), Math.floor(i / world.w) % world.d, LONT + 4);
    for (let cy = 0; cy < world.h / CHUNK; cy++) for (let cz = 0; cz < world.d / CHUNK; cz++) for (let cx = 0; cx < world.w / CHUNK; cx++)
        rebuildChunk(cx, cy, cz);
    player = new Player(world);
    naPowierzchnie();
    ustawPowierzchnie();
    nietoperze.reset(world, kopalnia.komory);
}

// ---------- Życie na powierzchni: skupnik Bronek i chmury ----------
const npc = createNpc();
scene.add(npc.group);
const chmury = new THREE.Group();
{
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false });
    for (let i = 0; i < 12; i++) {
        // Chmura = kilka spłaszczonych pudełek obok siebie.
        const chmura = new THREE.Group();
        for (let j = 0, n = 2 + Math.floor(Math.random() * 3); j < n; j++) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(8 + Math.random() * 10, 2 + Math.random() * 2, 6 + Math.random() * 8), mat);
            m.position.set(j * 6 - n * 3 + Math.random() * 3, Math.random() * 1.5, Math.random() * 5 - 2.5);
            chmura.add(m);
        }
        chmura.position.set(Math.random() * 400 - 200, 36 + Math.random() * 18, Math.random() * 400 - 200);
        chmura.userData.v = 0.8 + Math.random() * 0.9;
        chmury.add(chmura);
    }
    scene.add(chmury);
}
function ustawPowierzchnie() {
    // Bronek stoi za ladą budki, twarzą do szybu.
    npc.group.position.set(kopalnia.shop.x + 2, kopalnia.groundY + 1, kopalnia.shop.z);
    npc.group.rotation.y = -Math.PI / 2;
    chmury.position.set(WORLD_X / 2, kopalnia.groundY, WORLD_Z / 2);
}
let okazja = 'powitanie';      // co Bronek powie przy następnym otwarciu skupu

const nietoperze = createBats();
scene.add(nietoperze.group);

// ---------- Cząsteczki: odłamki, iskry, krople, dym ----------
const czastki = createParticles();
scene.add(czastki.mesh);
const KOLOR_SUROWCA = Object.fromEntries(MINERALY.map(m => [m.id, m.kolor.map(v => v / 255)]));
function odlamki(x, y, z, id, n) {
    const skala = kolory[BLOCKS[id].tekstury[1]] || [0.5, 0.5, 0.5];
    czastki.emit(x + 0.5, y + 0.5, z + 0.5, { n, kolor: skala, obszar: 0.8, rozrzut: 3, vy: 2.5, zycie: 0.7, rozmiar: 0.1 });
    if (KOLOR_SUROWCA[id]) czastki.emit(x + 0.5, y + 0.5, z + 0.5, { n: Math.ceil(n / 2), kolor: KOLOR_SUROWCA[id], obszar: 0.8, rozrzut: 3, vy: 3, zycie: 0.8, rozmiar: 0.09 });
}
// Dym z komina, krople pod zbiornikami wody (zdradzają, że nad stropem
// jest woda) - wołane co klatkę.
let dymCzas = 0, kapCzas = 0;
function zycieSwiata(dt, pod) {
    if (pod < 1 && (dymCzas += dt) > 0.22) {
        dymCzas = 0;
        const k = kopalnia.komin;
        czastki.emit(k.x, k.y, k.z, { kolor: [0.55, 0.55, 0.57], rozrzut: 0.35, vy: 0.9, grawitacja: -0.5, zycie: 3.2, rozmiar: 0.22, rosnie: true, obszar: 0.3 });
    }
    if ((kapCzas += dt) > 0.1) {
        kapCzas = 0;
        for (let i = 0; i < 8; i++) {
            const x = Math.floor(player.pos.x + (Math.random() - 0.5) * 15), y = Math.floor(player.pos.y + Math.random() * 6 - 2), z = Math.floor(player.pos.z + (Math.random() - 0.5) * 15);
            if (world.get(x, y, z) !== AIR || !world.solid(x, y + 1, z)) continue;
            if (world.get(x, y + 2, z) !== WATER && world.get(x, y + 3, z) !== WATER && world.get(x, y + 4, z) !== WATER) continue;
            czastki.emit(x + 0.5, y + 0.97, z + 0.5, { kolor: [0.35, 0.65, 1], rozrzut: 0, vy: 0, grawitacja: 12, zycie: 0.9, rozmiar: 0.08, obszar: 0.8 });
            if (Math.random() < 0.3) stuk(5, 0.04, 0.02);
        }
    }
}

// ---------- Osiągnięcia ----------
const kolejkaOsiagniec = [];
let osiagniecieDo = 0;
function pokazOsiagniecia(lista) { for (const o of lista) if (o) kolejkaOsiagniec.push(o); }
function zdobadz(id) { const o = przyznaj(stan, id); if (o) { pokazOsiagniecia([o]); zapisz(); } }
function osiagnieciaKlatka() {
    const el = $('osiagniecie'), teraz = performance.now();
    if (teraz < osiagniecieDo) return;
    const o = kolejkaOsiagniec.shift();
    if (!o) { el.classList.remove('widoczne'); return; }
    el.className = 'widoczne ' + o.rzadkosc;
    el.innerHTML = `<small>Osiągnięcie · ${RZADKOSCI[o.rzadkosc]}</small><b>${o.nazwa}</b><span>${o.opis}</span>`;
    osiagniecieDo = teraz + 4200;
    stuk(2.6, 0.2, 0.12); setTimeout(() => stuk(3.4, 0.2, 0.18), 130);
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
function stuk(wysokosc = 1, glosnosc = 0.25, dlugosc = 0.07) {
    try {
        audio ||= new AudioContext();
        const n = Math.floor(audio.sampleRate * dlugosc), buf = audio.createBuffer(1, n, audio.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
        const src = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain();
        src.buffer = buf; f.type = 'bandpass'; f.frequency.value = 900 * wysokosc; g.gain.value = glosnosc;
        src.connect(f).connect(g).connect(audio.destination); src.start();
    } catch { /* brak dźwięku nie psuje gry */ }
}

// ---------- HUD i komunikaty ----------
// Pasek wyboru: kilof i rzeczy do stawiania (zapas = pole w stanie gry).
const PASEK = [
    { nazwa: 'Kilof' },
    { nazwa: 'Drabina', zapas: 'drabiny', ikona: 'drabina', brak: 'Nie masz drabin' },
    { nazwa: 'Pochodnia', zapas: 'pochodnie', ikona: 'pochodnia', blok: TORCH, brak: 'Nie masz pochodni' },
    { nazwa: 'Stempel', zapas: 'stemple', ikona: 'stempel', blok: PROP, brak: 'Nie masz stempli' },
    { nazwa: 'Dynamit', zapas: 'dynamit', ikona: 'dynamit', blok: DYNAMITE, brak: 'Nie masz dynamitu' }
];
let wybrany = 0;
function wybierz(i) { wybrany = (i + PASEK.length) % PASEK.length; myszWcisnieta = false; odswiezHud(); }
let komunikatDo = 0, waznyDo = 0;
function komunikat(tekst, czas = 1800) {
    if (performance.now() < waznyDo && czas <= 1800) return;      // nie zasłaniaj ważnej wiadomości
    $('komunikat').textContent = tekst; $('komunikat').style.opacity = 1;
    komunikatDo = performance.now() + czas;
    if (czas > 1800) waznyDo = komunikatDo;
}
function odswiezHud() {
    pokazOsiagniecia(sprawdzOsiagniecia(stan));
    $('kasa').textContent = stan.kasa + ' monet';
    $('plecak').textContent = `Plecak: ${eko.ileWPlecaku(stan)}/${eko.pojemnosc(stan)}`;
    $('lampa-nazwa').textContent = eko.LAMPY[stan.lampa].nazwa;
    $('kilof').textContent = eko.KILOFY[stan.kilof].nazwa;
    $('pasek').innerHTML = PASEK.map((p, i) => `<div data-slot="${i}" class="${i === wybrany ? 'wybrany' : ''}">${p.zapas
        ? `<img src="${ikony[p.ikona]}"><b>${stan[p.zapas] || 0}</b>` : '⛏'}<i>${i + 1}</i></div>`).join('');
    $('urobek').innerHTML = Object.entries(stan.przedmioty)
        .map(([id, n]) => `<div><img src="${ikonaBloku(id)}">${n}</div>`).join('');
}

// ---------- Sklep ----------
let sklepOtwarty = false;
let atlasOtwarty = false, ksiegaOtwarta = false, gablotkaOtwarta = false, kwestiaTeraz = '', wynikGeody = '';
// Lista surowców z ikonami: [id, liczba] -> kafelki.
const kafelki = lista => lista.map(([id, n]) => `<div><img src="${ikonaBloku(id)}">${BLOCKS[id].nazwa}<br>${n} × ${BLOCKS[id].wartosc}</div>`).join('');
// Składniki przepisu: zielone, gdy są, czerwone, gdy brakuje.
const przepisHtml = surowce => eko.skladniki(stan, surowce).map(([id, trzeba, mam]) =>
    `<span class="${mam >= trzeba ? 'jest' : 'brak'}"><img src="${ikonaBloku(id)}">${BLOCKS[id].nazwa} ${Math.min(mam, trzeba)}/${trzeba}</span>`).join(' ');
function atlasHtml() {
    const gdzie = id => MINES.filter(m => m.rudy.some(r => r[0] === id)).map(m => m.nazwa).join(', ');
    return Object.entries(RODZAJE).map(([rodzaj, tytul]) => `<h3>${tytul}</h3><div class="atlas">${MINERALY.filter(m => m.rodzaj === rodzaj).map(m =>
        stan.odkryte?.[m.id]
            ? `<div><img src="${ikony[m.klucz]}"><b>${m.nazwa}</b><small>${m.wartosc} monet · ${eko.KILOFY[m.poziom].nazwa.toLowerCase()}<br>${gdzie(m.id)}</small></div>`
            : `<div class="nieznany"><span>?</span><b>???</b><small>${gdzie(m.id)}</small></div>`).join('')}</div>`).join('');
}
function rysujSklep() {
    const wart = eko.wartoscUrobku(stan), sklad = Object.entries(stan.sklad || {});
    const ulepszenie = (rodzaj, tytul, opis) => {
        const lista = { kilof: eko.KILOFY, plecak: eko.PLECAKI, lampa: eko.LAMPY }[rodzaj];
        const teraz = lista[stan[rodzaj]], n = eko.nastepne(stan, rodzaj);
        const stac = n && stan.kasa >= n.cena && eko.starczaSurowcow(stan, n.surowce);
        return `<div class="wiersz"><div>${tytul}: <b>${teraz.nazwa}</b><small>${n ? 'Następny: ' + n.nazwa + ' — ' + opis(n) : 'Najlepszy możliwy'}</small>
            ${n?.surowce ? `<div class="przepis">Potrzeba: ${przepisHtml(n.surowce)}</div>` : ''}</div>
            ${n ? `<button data-kup="${rodzaj}" ${stac ? '' : 'disabled'}>${n.surowce ? 'Zrób' : 'Kup'} za ${n.cena}</button>` : ''}</div>`;
    };
    const kopalnie = MINES.map((m, i) => [m, i]).sort((a, b) => a[0].cena - b[0].cena).map(([m, i]) => {
        const mam = stan.kopalnie.includes(i);
        const przycisk = i === stan.kopalnia ? '<button disabled>Jesteś tutaj</button>'
            : mam ? `<button data-idz="${i}">Jedź</button>`
                : `<button data-kopalnia="${i}" ${stan.kasa < m.cena ? 'disabled' : ''}>Kup za ${m.cena}</button>`;
        return `<div class="wiersz"><div><b>${m.nazwa}</b> (${m.depth} m)<small>${m.opis}</small></div>${przycisk}</div>`;
    }).join('');
    eko.uzupelnijZlecenia(stan);
    const zlecenia = stan.zlecenia.map((z, i) => {
        const mam = Math.min(z.ile, eko.ileSurowca(stan, z.id));
        return `<div class="wiersz"><div class="zlecenie"><img src="${ikonaBloku(z.id)}"><div><b>${z.ile} × ${BLOCKS[z.id].nazwa}</b>
            <small>Masz ${mam}/${z.ile} · nagroda <span class="zloto">${z.nagroda} monet</span> (zwykła cena: ${z.ile * BLOCKS[z.id].wartosc})</small></div></div>
            <div class="przyciski"><button data-oddaj="${i}" ${eko.mozeOddac(stan, i) ? '' : 'disabled'}>Oddaj</button>
            <button data-wymien="${i}" ${stan.kasa < eko.KOSZT_WYMIANY ? 'disabled' : ''}>Wymień (${eko.KOSZT_WYMIANY})</button></div></div>`;
    }).join('');
    $('sklep').innerHTML = `<h1>Skup i sklep</h1><div class="stan-kasy">${stan.kasa} monet</div>
        <p class="kwestia"><b>Bronek:</b> „${kwestiaTeraz}”</p>
        <h2>Zlecenia Bronka</h2>
        ${zlecenia || '<p class="maly">Na razie nie ma zleceń.</p>'}
        <p class="maly">Wykonane zlecenia: ${stan.wykonaneZlecenia || 0}. Surowców na zlecenia skup nie sprzedaje.</p>
        <h2>Urobek</h2>
        <div class="lista-urobku">${kafelki(Object.entries(stan.przedmioty)) || 'Plecak jest pusty.'}</div>
        ${sklad.length ? `<p class="maly">W składzie na powierzchni (wózek i surowce odłożone na ulepszenia):</p><div class="lista-urobku">${kafelki(sklad)}</div>` : ''}
        <div class="wiersz"><div><small>Skup nie bierze surowców potrzebnych na następny kilof, lampę i zlecenia — odkłada je do składu.</small></div>
            <button data-sprzedaj ${wart ? '' : 'disabled'}>Sprzedaj wszystko (+${wart})</button></div>
        ${sklad.length ? `<div class="wiersz"><div></div><button data-sklad>Sprzedaj też skład (+${eko.wartoscSkladu(stan)})</button></div>` : ''}
        ${eko.ileSurowca(stan, GEODE) || wynikGeody ? `<h2>Geody</h2>
        <div class="wiersz"><div class="zlecenie"><img src="${ikonaBloku(GEODE)}"><div><b>Masz ${eko.ileSurowca(stan, GEODE)}</b>
            <small>Z wierzchu zwykły kamień. Co jest w środku, okaże się po rozbiciu.</small></div></div>
            <button data-geoda ${eko.ileSurowca(stan, GEODE) ? '' : 'disabled'}>Rozbij geodę</button></div>
        ${wynikGeody ? `<p class="kwestia">${wynikGeody}</p>` : ''}` : ''}
        <h2>Piec hutniczy</h2>
        ${PRODUKTY.map(p => { const ile = eko.ileWytopic(stan, p.klucz), mam = eko.ileSurowca(stan, p.id); return `<div class="wiersz"><div class="zlecenie"><img src="${ikony[p.klucz]}"><div><b>${p.nazwa}</b>${mam ? ` · masz ${mam}` : ''}
            <small>Wart ${p.wartosc} monet za sztukę</small><div class="przepis">Na sztukę: ${przepisHtml(p.z)}</div></div></div>
            <div class="przyciski"><button data-przetop="${p.klucz}" ${ile ? '' : 'disabled'}>Wytop 1</button>
            ${ile > 1 ? `<button data-przetop="${p.klucz}" data-ile="${ile}">Wytop ${ile}</button>` : ''}</div></div>`; }).join('')}
        <p class="maly">Stopy są warte więcej niż surowce, z których powstały, i idą na lepszy sprzęt. Trafiają do składu.</p>
        <h2>Wyposażenie</h2>
        ${ulepszenie('kilof', 'Kilof', n => 'kopie ' + n.szybkosc + '× szybciej, rusza twardsze skały')}
        ${ulepszenie('plecak', 'Plecak', n => 'mieści ' + n.pojemnosc + ' sztuk')}
        ${ulepszenie('lampa', 'Lampa', n => 'świeci na ' + n.zasieg + ' bloków, paliwa na ' + Math.round(n.paliwo / 60) + ' min')}
        <h2>Zapasy</h2>
        ${Object.entries(eko.ZAPASY).map(([k, z]) => `<div class="wiersz"><div>${z.nazwa}: <b>${stan[k]}</b><small>${z.opis}</small>
            ${z.przepis ? `<div class="przepis">Albo z surowców: ${przepisHtml(z.przepis)}</div>` : ''}</div>
            <div class="przyciski">${z.przepis ? `<button data-wytworz="${k}" ${eko.starczaSurowcow(stan, z.przepis) ? '' : 'disabled'}>Zrób +${z.ile}</button>` : ''}
            <button data-zapas="${k}" ${stan.kasa < z.cena ? 'disabled' : ''}>+${z.ile} za ${z.cena}</button></div></div>`).join('')}
        <h2>Atlas surowców</h2>
        <div class="wiersz"><div>Odkryte: <b>${MINERALY.filter(m => stan.odkryte?.[m.id]).length}/${MINERALY.length}</b><small>Każda kopalnia ma własne skały i surowce.</small></div>
            <button data-atlas>${atlasOtwarty ? 'Zwiń' : 'Pokaż'}</button></div>
        ${atlasOtwarty ? atlasHtml() : ''}
        <h2>Gablotka znalezisk</h2>
        <div class="wiersz"><div>Okazy: <b>${ZNALEZISKA.filter(z => stan.gablotka?.[z.id]).length}/${ZNALEZISKA.length}</b><small>Skamieniałości w skale, stare skrzynki w komorach, kryształy w geodach.</small></div>
            <button data-gablotka>${gablotkaOtwarta ? 'Zwiń' : 'Pokaż'}</button></div>
        ${gablotkaOtwarta ? Object.entries(GRUPY).map(([g, tytul]) => `<h3>${tytul}</h3><div class="atlas ksiega">${ZNALEZISKA.filter(z => z.grupa === g).map(z => stan.gablotka?.[z.id]
            ? `<div><b>${z.nazwa}</b><small>${stan.gablotka[z.id] > 1 ? stan.gablotka[z.id] + ' szt. · ' : ''}${z.nagroda} monet</small><span>${z.opis}</span></div>`
            : '<div class="nieznany"><b>???</b><small>jeszcze nie znalezione</small></div>').join('')}</div>`).join('') : ''}
        <h2>Księga osiągnięć</h2>
        <div class="wiersz"><div>Zdobyte: <b>${OSIAGNIECIA.filter(o => stan.osiagniecia?.[o.id]).length}/${OSIAGNIECIA.length}</b></div>
            <button data-ksiega>${ksiegaOtwarta ? 'Zwiń' : 'Pokaż'}</button></div>
        ${ksiegaOtwarta ? `<div class="atlas ksiega">${OSIAGNIECIA.map(o => stan.osiagniecia?.[o.id]
            ? `<div class="${o.rzadkosc}"><b>${o.nazwa}</b><small>${RZADKOSCI[o.rzadkosc]}</small><span>${o.opis}</span></div>`
            : `<div class="nieznany ${o.rzadkosc}"><b>???</b><small>${RZADKOSCI[o.rzadkosc]}</small></div>`).join('')}</div>` : ''}
        <h2>Urządzenia szybu</h2>
        ${Object.entries(eko.URZADZENIA).map(([k, u]) => `<div class="wiersz"><div><b>${u.nazwa}</b><small>${u.opis}</small></div>
            ${stan[k] ? '<button disabled>Kupione</button>' : `<button data-urzadzenie="${k}" ${stan.kasa < u.cena ? 'disabled' : ''}>Kup za ${u.cena}</button>`}</div>`).join('')}
        <h2>Kopalnie</h2>${kopalnie}
        <div class="wiersz"><div>Nowa wyprawa<small>Ta sama kopalnia z nowym układem chodników. Obecna przepada razem z tym, co w niej zostawisz.</small></div><button data-nowa>Wylosuj</button></div>
        <p><button data-zamknij>${DOTYK ? 'Wróć do gry' : 'Wróć do gry (E)'}</button></p>`;
}
// ---------- Szyb: winda i wózek ----------
function przySzybie() {
    return Math.hypot(player.pos.x - kopalnia.shaft.x - 1, player.pos.z - kopalnia.shaft.z - 1) < 3.4;
}
function otworzSzyb() {
    sklepOtwarty = true; myszWcisnieta = false; $('dotyk').classList.remove('widoczne'); document.exitPointerLock?.();
    const tu = player.pos.y;
    const przystanki = [['Powierzchnia', kopalnia.groundY + 1], ...kopalnia.poziomy.map((y, i) => [`Poziom ${i + 1} — ${kopalnia.groundY - y} m`, y])];
    $('sklep').hidden = false;
    $('sklep').innerHTML = `<h1>Szyb</h1>
        ${stan.wozek ? `<h2>Wózek</h2><div class="wiersz"><div>W plecaku: <b>${eko.ileWPlecaku(stan)}</b> szt.<small>Urobek pojedzie na powierzchnię i poczeka na sprzedaż w skupie.</small></div>
            <button data-wozek ${eko.ileWPlecaku(stan) ? '' : 'disabled'}>Wyślij na górę</button></div>` : ''}
        ${stan.winda ? `<h2>Winda</h2>${przystanki.map(([nazwa, y], i) => `<div class="wiersz"><div>${nazwa}</div>
            <button data-poziom="${i}" ${Math.abs(tu - y) < 1.5 ? 'disabled' : ''}>${Math.abs(tu - y) < 1.5 ? 'Jesteś tutaj' : 'Jedź'}</button></div>`).join('')}` : ''}
        <p><button data-zamknij>${DOTYK ? 'Wróć do gry' : 'Wróć do gry (E)'}</button></p>`;
}
function jedzWinda(i) {
    if (i === 0) naPowierzchnie();
    else {
        // Wysiadka na drabinie szybu, na wysokości poziomu.
        const y = kopalnia.poziomy[i - 1];
        Object.assign(player.pos, { x: kopalnia.shaft.x + 0.5, y, z: kopalnia.shaft.z + 0.5 });
        player.vel.x = player.vel.y = player.vel.z = 0;
    }
    const z = $('zaciemnienie');
    z.style.transition = 'none'; z.style.opacity = 1;
    requestAnimationFrame(() => requestAnimationFrame(() => { z.style.transition = 'opacity .8s'; z.style.opacity = 0; }));
    stuk(0.4, 0.3, 0.5);
}

function powiedz(co) { kwestiaTeraz = kwestia(co); }
function otworzSklep() {
    sklepOtwarty = true; myszWcisnieta = false; $('dotyk').classList.remove('widoczne'); $('sklep').hidden = false;
    wynikGeody = '';
    powiedz(okazja === 'powitanie' && !eko.ileWPlecaku(stan) && !Object.keys(stan.sklad || {}).length ? 'pusto' : okazja);
    okazja = 'powitanie';
    rysujSklep(); document.exitPointerLock?.();
}
function zamknijSklep() { sklepOtwarty = false; $('sklep').hidden = true; zlapMysz(); }
function zmienKopalnie(i, noweZiarno) {
    stan.kopalnia = i;
    if (noweZiarno) stan.ziarno = Math.floor(Math.random() * 1e9);
    wczytajKopalnie(); zapisz(); odswiezHud();
}
$('sklep').addEventListener('click', e => {
    const d = e.target.dataset;
    if (!e.target.matches('button')) return;
    if ('sprzedaj' in d) { const z = eko.sprzedajWszystko(stan); if (z > 0) zdobadz('grosz'); stuk(2.2); komunikat('Sprzedano za ' + z + ' monet'); powiedz('sprzedaz'); npc.cheer(); }
    else if (d.oddaj) { const z = eko.oddajZlecenie(stan, +d.oddaj); if (z) { stuk(2.4); komunikat('Zlecenie wykonane: +' + z + ' monet', 3000); powiedz('zlecenie'); npc.cheer(); } }
    else if (d.wymien) { if (eko.wymienZlecenie(stan, +d.wymien)) stuk(1.2); }
    else if ('sklad' in d) { const z = eko.sprzedajSklad(stan); stuk(2.2); komunikat('Sprzedano skład za ' + z + ' monet'); }
    else if ('atlas' in d) atlasOtwarty = !atlasOtwarty;
    else if ('ksiega' in d) ksiegaOtwarta = !ksiegaOtwarta;
    else if ('gablotka' in d) gablotkaOtwarta = !gablotkaOtwarta;
    else if ('geoda' in d) {
        const w = rozbijGeode(stan, GEODE, MINES[stan.kopalnia].rudy);
        if (w) {
            stuk(0.7, 0.4, 0.2); setTimeout(() => stuk(3, 0.2, 0.2), 150);
            const lista = Object.entries(w.zawartosc).map(([id, n]) => `${n} × ${BLOCKS[id].nazwa}`).join(', ') || 'sam pył';
            wynikGeody = `<b>W środku:</b> ${lista} (warte ${w.wartosc} monet)${w.krysztal ? ` oraz <b>${w.krysztal.okaz.nazwa}</b> do gablotki (+${w.krysztal.monety} monet)` : ''}.`;
        }
    }
    else if (d.przetop) { const n = eko.przetop(stan, d.przetop, +d.ile || 1); if (n) { stuk(0.5, 0.3, 0.5); komunikat(`Wytopiono: ${n} × ${BLOCKS[PRODUKTY.find(p => p.klucz === d.przetop).id].nazwa}`); } }
    else if (d.wytworz) { if (eko.wytworzZapas(stan, d.wytworz)) stuk(1.6); }
    else if (d.kup) { if (eko.kupUlepszenie(stan, d.kup)) { stuk(1.6); powiedz('zakup'); } }
    else if (d.zapas) { if (eko.kupZapas(stan, d.zapas)) stuk(1.6); }
    else if (d.urzadzenie) { if (eko.kupUrzadzenie(stan, d.urzadzenie)) stuk(1.6); }
    else if ('wozek' in d) { const n = eko.wyslijUrobek(stan); stuk(1.8); komunikat(`Wózek zabrał ${n} szt. urobku na powierzchnię`, 3000); zapisz(); odswiezHud(); return zamknijSklep(); }
    else if (d.poziom) { jedzWinda(+d.poziom); return zamknijSklep(); }
    else if (d.kopalnia) { if (eko.kupKopalnie(stan, +d.kopalnia)) zmienKopalnie(+d.kopalnia, true); }
    else if (d.idz) zmienKopalnie(+d.idz, true);
    else if ('nowa' in d) zmienKopalnie(stan.kopalnia, true);
    else if ('zamknij' in d) return zamknijSklep();
    const przewiniecie = $('sklep').scrollTop;
    zapisz(); odswiezHud(); rysujSklep();
    $('sklep').scrollTop = przewiniecie;
});

// ---------- Sterowanie ----------
const klawisze = new Set();
let myszWcisnieta = false, gra = false, bezMyszy = DOTYK;
function zlapMysz() { gra = true; $('start').hidden = true; $('dotyk').classList.add('widoczne'); if (!bezMyszy) renderer.domElement.requestPointerLock?.(); }
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
// Lewy przycisk: kilof kopie (trzymaj), drabina i pochodnia - stawiają.
// Prawy przycisk też stawia.
document.addEventListener('mousedown', e => {
    if (!document.pointerLockElement) return;
    if (e.button === 0 && wybrany === 0) myszWcisnieta = true;
    else if (e.button === 0 || e.button === 2) postaw();
});
document.addEventListener('wheel', e => { if (document.pointerLockElement) wybierz(wybrany + Math.sign(e.deltaY)); });
document.addEventListener('mouseup', e => { if (e.button === 0) myszWcisnieta = false; });

// E (albo przycisk na telefonie): skup przy budce, szyb przy szybie.
const maSzyb = () => (stan.winda || stan.wozek) && przySzybie();
function akcjaE() {
    if (przySklepie()) otworzSklep();
    else if (maSzyb()) otworzSzyb();
    else komunikat(przySzybie() ? 'Windę i wózek kupisz w sklepie' : 'Skup jest w budce na powierzchni');
}
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
    if (e.code === 'KeyE') akcjaE();
    if (e.code === 'Escape' && bezMyszy) { gra = false; $('start').hidden = false; $('graj').textContent = 'Wróć do gry'; }
    if (/^Digit[1-5]$/.test(e.code)) wybierz(+e.code.slice(5) - 1);
    if (e.code === 'KeyT') {
        e.preventDefault(); klawisze.clear(); document.exitPointerLock?.();
        $('komenda').style.display = 'block'; $('komenda').focus();
    }
});
document.addEventListener('keyup', e => klawisze.delete(e.code));
window.addEventListener('blur', () => { klawisze.clear(); myszWcisnieta = false; });

// ---------- Sterowanie dotykowe ----------
// Gałka = ruch, przeciąganie po ekranie (albo po przycisku kilofa) =
// rozglądanie, przyciski trzyma się palcem.
const palce = { fx: 0, sx: 0, skok: false, dol: false, lina: false };
if (DOTYK) {
    const galka = $('galka'), kciuk = galka.firstElementChild;
    let galkaId = null, patrzId = null, px = 0, py = 0;
    const ustawGalke = e => {
        const r = galka.getBoundingClientRect(), R = r.width / 2;
        let dx = (e.clientX - r.left - R) / R, dy = (e.clientY - r.top - R) / R;
        const d = Math.hypot(dx, dy);
        if (d > 1) { dx /= d; dy /= d; }
        palce.sx = Math.abs(dx) < 0.15 ? 0 : dx; palce.fx = Math.abs(dy) < 0.15 ? 0 : -dy;
        kciuk.style.transform = `translate(${dx * R * 0.6}px, ${dy * R * 0.6}px)`;
    };
    galka.addEventListener('pointerdown', e => { galkaId = e.pointerId; galka.setPointerCapture(e.pointerId); ustawGalke(e); });
    galka.addEventListener('pointermove', e => { if (e.pointerId === galkaId) ustawGalke(e); });
    const pusc = e => { if (e.pointerId !== galkaId) return; galkaId = null; palce.fx = palce.sx = 0; kciuk.style.transform = ''; };
    galka.addEventListener('pointerup', pusc); galka.addEventListener('pointercancel', pusc);

    const patrz = el => {
        el.addEventListener('pointerdown', e => {
            if (patrzId !== null || !gra || sklepOtwarty) return;
            patrzId = e.pointerId; px = e.clientX; py = e.clientY; el.setPointerCapture(e.pointerId);
        });
        el.addEventListener('pointermove', e => {
            if (e.pointerId !== patrzId) return;
            player.yaw -= (e.clientX - px) * 0.006;
            player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch - (e.clientY - py) * 0.006));
            px = e.clientX; py = e.clientY;
        });
        const koniec = e => { if (e.pointerId === patrzId) patrzId = null; };
        el.addEventListener('pointerup', koniec); el.addEventListener('pointercancel', koniec);
    };
    patrz(renderer.domElement); patrz($('d-kop'));

    // Przycisk trzymany palcem: wł. przy dotknięciu, wył. przy puszczeniu.
    const trzymany = (id, ustaw) => {
        const el = $(id);
        const zmien = (e, v) => { e.preventDefault(); ustaw(v); el.classList.toggle('wcisniety', v); };
        el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); zmien(e, true); });
        el.addEventListener('pointerup', e => zmien(e, false));
        el.addEventListener('pointercancel', e => zmien(e, false));
    };
    trzymany('d-kop', v => { if (wybrany === 0) myszWcisnieta = v; else if (v) postaw(); });
    $('pasek').addEventListener('pointerdown', e => { const slot = e.target.closest('[data-slot]'); if (slot) wybierz(+slot.dataset.slot); });
    trzymany('d-skok', v => { palce.skok = v; });
    trzymany('d-dol', v => { palce.dol = v; });
    trzymany('d-lina', v => { palce.lina = v; });
    $('d-sklep').addEventListener('click', akcjaE);
    document.addEventListener('contextmenu', e => e.preventDefault());
}
// Telefon chowa aplikację albo kartę - zapisz postęp od razu.
window.addEventListener('apppause', zapisz);
document.addEventListener('visibilitychange', () => { if (document.hidden) zapisz(); });

// ---------- Komendy testowe (klawisz T) ----------
function wykonajKomende(tekst) {
    const [nazwa, arg] = tekst.trim().toLowerCase().split(/\s+/);
    const n = parseInt(arg, 10);
    const ustaw = (pole, lista) => { if (n >= 0 && n < lista.length) { stan[pole] = n; return true; } };
    if (nazwa === 'kasa' && n >= 0) stan.kasa = n;
    else if (nazwa === 'kilof' && ustaw('kilof', eko.KILOFY));
    else if (nazwa === 'plecak' && ustaw('plecak', eko.PLECAKI));
    else if (nazwa === 'lampa' && ustaw('lampa', eko.LAMPY));
    else if (nazwa === 'paliwo' && n >= 0) { stan.paliwo = eko.LAMPY[stan.lampa].paliwo * Math.min(100, n) / 100; lampaOstrzezenie = 0; }
    else if (nazwa === 'drabiny' && n >= 0) stan.drabiny = n;
    else if (nazwa === 'pochodnie' && n >= 0) stan.pochodnie = n;
    else if (nazwa === 'stemple' && n >= 0) stan.stemple = n;
    else if (nazwa === 'dynamit' && n >= 0) stan.dynamit = n;
    else if (nazwa === 'surowce') { stan.sklad ||= {}; for (const m of MINERALY) { stan.sklad[m.id] = (stan.sklad[m.id] || 0) + (n > 0 ? n : 20); (stan.odkryte ||= {})[m.id] = true; } }
    else if (nazwa === 'winda') stan.winda = true;
    else if (nazwa === 'wozek') stan.wozek = true;
    else if (nazwa === 'gora') naPowierzchnie();
    else if (nazwa === 'dol') { player.pos.x = kopalnia.shaft.x + 1.5; player.pos.z = kopalnia.shaft.z + 1.5; player.pos.y = kopalnia.shaft.bottomY; }
    else if (nazwa === 'kopalnia' && MINES[n]) { if (!stan.kopalnie.includes(n)) stan.kopalnie.push(n); zmienKopalnie(n, true); }
    else if (nazwa === 'reset') { stan = { ...eko.nowyStan(), ziarno: Math.floor(Math.random() * 1e9) }; wczytajKopalnie(); }
    else return komunikat('Komendy: kasa N, kilof 0-5, plecak 0-3, lampa 0-3, paliwo 0-100, drabiny N, pochodnie N, stemple N, dynamit N, surowce N, winda, wozek, kopalnia 0-4, gora, dol, reset');
    komunikat('OK: ' + tekst); zapisz(); odswiezHud();
}

// ---------- Zagrożenia: zawały, woda, omdlenie ----------
// W tej grze się nie ginie: po wypadku ratownicy wynoszą górnika na
// powierzchnię, ale połowa urobku zostaje w kopalni.
function omdlenie(powod, osiagniecie) {
    if (osiagniecie) zdobadz(osiagniecie);
    const strata = eko.zgubPoloweUrobku(stan);
    okazja = 'wypadek';
    naPowierzchnie(); eko.napelnijLampe(stan);
    oddech = 1; myszWcisnieta = false; linaCzas = 0;
    const z = $('zaciemnienie');
    z.style.transition = 'none'; z.style.opacity = 1;
    requestAnimationFrame(() => requestAnimationFrame(() => { z.style.transition = 'opacity 2.5s'; z.style.opacity = 0; }));
    komunikat(`${powod} Ratownicy wynieśli cię na powierzchnię.${strata ? ` W kopalni zostało ${strata} szt. urobku.` : ''}`, 7000);
    odswiezHud(); zapisz();
}
function graczW(x1, y1, z1, x2, y2, z2) {
    const p = player.pos;
    return p.x + 0.3 > x1 && p.x - 0.3 < x2 && p.y + 1.8 > y1 && p.y < y2 && p.z + 0.3 > z1 && p.z - 0.3 < z2;
}

// Zawały (zasady: src/cavein.js). spadki - bloki, które zaraz się
// zerwą; lecace - bloki w locie.
const spadki = [], lecace = [];
let wstrzas = 0;
const materialRumoszu = new THREE.MeshLambertMaterial({ map: pixelTexture(tileCanvas(makeTile('rumosz'))) });
const pudelko = new THREE.BoxGeometry(1, 1, 1);
function zaplanujSpadek(x, y, z, zaIle) {
    if (!spadki.some(s => s.x === x && s.y === y && s.z === z)) spadki.push({ x, y, z, t: zaIle });
}
function poWstrzasie(x, y, z) {
    const zerwane = shaken(world, x, y, z);
    for (const [a, b, c] of zerwane) zaplanujSpadek(a, b, c, 0.8 + Math.random() * 0.4);
    if (zerwane.length) { komunikat('Strop pęka — uciekaj!', 2500); stuk(0.12, 0.6, 0.9); wstrzas = 1; }
}
function zawaly(dt) {
    for (let i = spadki.length - 1; i >= 0; i--) {
        const s = spadki[i];
        if ((s.t -= dt) > 0) continue;
        spadki.splice(i, 1);
        if (!isHanging(world, s.x, s.y, s.z)) continue;
        const cel = landingY(world, s.x, s.y, s.z);
        // Zanim blok zniknie z miejsca: kto wisiał obok albo nad nim, poleci za nim.
        const pociagniete = pulled(world, s.x, s.y, s.z);
        zmienBlok(s.x, s.y, s.z, AIR);
        for (const [a, b, c] of pociagniete) zaplanujSpadek(a, b, c, 0.15 + Math.random() * 0.3);
        const mesh = new THREE.Mesh(pudelko, materialRumoszu);
        mesh.position.set(s.x + 0.5, s.y + 0.5, s.z + 0.5);
        scene.add(mesh);
        lecace.push({ mesh, x: s.x, z: s.z, y: s.y, vy: 0, cel });
        wstrzas = Math.max(wstrzas, 0.6);
    }
    for (let i = lecace.length - 1; i >= 0; i--) {
        const l = lecace[i];
        l.vy += 26 * dt; l.y -= l.vy * dt;
        const trafiony = graczW(l.x, l.y, l.z, l.x + 1, l.y + 1, l.z + 1);
        if (l.y <= l.cel) {
            scene.remove(l.mesh); lecace.splice(i, 1);
            if (isOpen(world.get(l.x, l.cel, l.z))) zmienBlok(l.x, l.cel, l.z, RUBBLE);
            stuk(0.25, 0.5, 0.25); wstrzas = Math.max(wstrzas, 0.5);
        } else l.mesh.position.y = l.y + 0.5;
        if (trafiony || graczW(l.x, l.cel, l.z, l.x + 1, l.cel + 1, l.z + 1) && l.y <= l.cel) return omdlenie('Przysypał cię zawał.', 'zawal');
    }
    wstrzas = Math.max(0, wstrzas - dt * 1.5);
}

// Woda (zasady: src/water.js). Po przebiciu się do zbiornika woda
// przelewa się po kilka pól naraz, aż ułoży się na nowo.
let przeplyw = null, przeplywCzas = 0, oddech = 1;
function sprawdzWode(x, y, z) {
    if (przeplyw) { przeplyw.ponow = [x, y, z]; return; }
    const start = findWater(world, x, y, z);
    const plan = start < 0 ? null : settleWater(world, start);
    if (!plan || !plan.add.length) return;
    przeplyw = plan; przeplyw.naRaz = Math.max(1, Math.ceil(plan.add.length / 45));
    komunikat('Woda! Przebiłeś się do zbiornika.', 2500); stuk(0.5, 0.35, 1.2); zdobadz('hydraulik');
}
function woda(dt) {
    if (przeplyw && (przeplywCzas += dt) > 0.07) {
        przeplywCzas = 0;
        const lista = [], wxyz = i => [i % world.w, Math.floor(i / (world.w * world.d)), Math.floor(i / world.w) % world.d];
        for (let k = 0; k < przeplyw.naRaz && przeplyw.add.length; k++) {
            const skad = przeplyw.remove.shift(), dokad = przeplyw.add.shift();
            if (world.data[skad] !== WATER || world.data[dokad] !== AIR) continue;
            lista.push([...wxyz(skad), AIR], [...wxyz(dokad), WATER]);
        }
        zmienBloki(lista);
        if (!przeplyw.add.length) {
            const ponow = przeplyw.ponow; przeplyw = null;
            if (ponow) sprawdzWode(...ponow);
        }
    }
    // Oddech: głowa pod wodą - powietrza starcza na kilkanaście sekund.
    const oko = player.eye();
    const podWoda = world.get(Math.floor(oko.x), Math.floor(oko.y), Math.floor(oko.z)) === WATER;
    oddech = Math.max(0, Math.min(1, oddech + (podWoda ? -dt / 14 : dt / 3)));
    if (oddech <= 0) omdlenie('Zabrakło ci powietrza.', 'nurek');
    return podWoda;
}

// ---------- Stawianie drabin i pochodni ----------
function postaw() {
    if (!gra || sklepOtwarty || wybrany === 0) return;
    const rzecz = PASEK[wybrany];
    if (!(stan[rzecz.zapas] > 0)) return komunikat(rzecz.brak + ' — kup w sklepie');
    const hit = raycast(world, player.eye(), player.dir(), REACH);
    if (!hit || (!hit.nx && !hit.ny && !hit.nz)) return;
    let x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
    // Stempel można dostawić na stemplu - szukamy wolnego pola nad nim.
    if (rzecz.blok === PROP) while (world.get(x, y, z) === PROP) y++;
    if (world.get(x, y, z) !== AIR || !world.inside(x, y, z)) return komunikat('To miejsce jest zajęte');
    let id = rzecz.blok;
    if (!id) {
        // Drabina opiera się o wskazaną ścianę; wskazując podłogę albo
        // sufit - o ścianę, w którą patrzysz.
        let sciana = -1;
        if (hit.ny === 0) sciana = WALLS.findIndex(([dx, dz]) => dx === -hit.nx && dz === -hit.nz);
        else {
            const d = player.dir();
            sciana = WALLS.map((w, o) => o).sort((a, b) => (WALLS[b][0] * d.x + WALLS[b][1] * d.z) - (WALLS[a][0] * d.x + WALLS[a][1] * d.z))
                .find(o => world.solid(x + WALLS[o][0], y, z + WALLS[o][1])) ?? -1;
        }
        if (sciana < 0) return komunikat('Drabina musi przylegać do ściany');
        id = PLACED_LADDERS[sciana];
    } else if (!maOparcie(id, x, y, z)) return komunikat(rzecz.nazwa + ': potrzebne twarde podłoże');
    stan[rzecz.zapas]--;
    zmienBlok(x, y, z, id);
    if (id === DYNAMITE) { uzbroj(x, y, z, LONT); komunikat('Lont zapalony — uciekaj!', 2500); }
    zdobadz({ [TORCH]: 'swiatlo', [PROP]: 'stempel' }[id] || (rzecz.blok ? '' : 'drabina'));
    stuk(1.4, 0.3); odswiezHud(); zapisz();
}

// Pochodnia, stempel i dynamit stoją na twardym bloku (stempel także
// na innym stemplu). Gdy oparcie zniknie, rzecz wraca do zapasów.
function maOparcie(id, x, y, z) {
    return world.solid(x, y - 1, z) || (id === PROP && world.get(x, y - 1, z) === PROP);
}
const ZAPAS_BLOKU = { [TORCH]: 'pochodnie', [PROP]: 'stemple', [DYNAMITE]: 'dynamit' };
function sprzatnijOsierocone(cx, cy, cz, r) {
    for (let runda = 0; runda < 12; runda++) {
        const lista = [];
        for (let y = cy - r; y <= cy + r + runda; y++) for (let z = cz - r; z <= cz + r; z++) for (let x = cx - r; x <= cx + r; x++) {
            const id = world.get(x, y, z), o = PLACED_LADDERS.indexOf(id);
            if (isThin(id) && !maOparcie(id, x, y, z)) { lista.push([x, y, z, AIR]); if (ZAPAS_BLOKU[id]) stan[ZAPAS_BLOKU[id]]++; }
            else if (o >= 0 && !world.solid(x + WALLS[o][0], y, z + WALLS[o][1])) { lista.push([x, y, z, AIR]); stan.drabiny++; }
        }
        if (!lista.length) break;
        zmienBloki(lista);
    }
}

// ---------- Dynamit ----------
const LONT = 3.5;           // sekundy od postawienia do wybuchu
const lonty = [];
function uzbroj(x, y, z, t) { if (!lonty.some(l => l.x === x && l.y === y && l.z === z)) lonty.push({ x, y, z, t, tik: 0 }); }
function wybuch(x, y, z) {
    const plan = blast(world, x, y, z, id => eko.mozeKopac(stan, id), id => eko.dodajUrobek(stan, id));
    zmienBloki(plan.usun);
    for (const [a, b, c] of plan.lancuch) uzbroj(a, b, c, 0.2);
    if (plan.lancuch.length) zdobadz('lancuch');
    czastki.emit(x + 0.5, y + 0.5, z + 0.5, { n: 60, kolor: [0.45, 0.42, 0.4], obszar: 2.5, rozrzut: 9, vy: 5, zycie: 1.1, rozmiar: 0.16 });
    czastki.emit(x + 0.5, y + 0.5, z + 0.5, { n: 25, kolor: [1, 0.7, 0.2], obszar: 1.5, rozrzut: 7, vy: 4, zycie: 0.5, rozmiar: 0.14 });
    sprzatnijOsierocone(x, y, z, 4);
    // Wstrząs zrywa kruche stropy w szerokim promieniu.
    for (let dy = -BLAST_SHAKE; dy <= BLAST_SHAKE; dy++) for (let dz = -BLAST_SHAKE; dz <= BLAST_SHAKE; dz++) for (let dx = -BLAST_SHAKE; dx <= BLAST_SHAKE; dx++)
        if (isHanging(world, x + dx, y + dy, z + dz)) zaplanujSpadek(x + dx, y + dy, z + dz, 0.3 + Math.random() * 0.7);
    sprawdzWode(x, y, z);
    stuk(0.08, 0.9, 1.1); stuk(0.3, 0.6, 0.4); wstrzas = 2;
    const b = $('blysk'); b.style.transition = 'none'; b.style.opacity = 0.8;
    requestAnimationFrame(() => requestAnimationFrame(() => { b.style.transition = 'opacity .6s'; b.style.opacity = 0; }));
    const p = player.pos;
    if (Math.hypot(p.x - x - 0.5, p.y + 0.9 - y - 0.5, p.z - z - 0.5) < BLAST_DANGER) omdlenie('Wybuch był za blisko.', 'saper');
    odswiezHud(); zapisz();
}
function dynamit(dt) {
    for (let i = lonty.length - 1; i >= 0; i--) {
        const l = lonty[i];
        l.t -= dt;
        if ((l.tik += dt) > 0.35) { l.tik = 0; stuk(3, 0.12, 0.03); }       // syk lontu
        czastki.emit(l.x + 0.5, l.y + 0.85, l.z + 0.5, { kolor: [1, 0.8, 0.3], rozrzut: 1.2, vy: 1.5, zycie: 0.3, rozmiar: 0.05, obszar: 0.1 });
        if (l.t > 0) continue;
        lonty.splice(i, 1);
        if (world.get(l.x, l.y, l.z) === DYNAMITE) wybuch(l.x, l.y, l.z);
    }
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
    if (hit && myszWcisnieta && wybrany === 0) {
        const b = BLOCKS[hit.id];
        if (b.staly) komunikat('Tego nie da się wykopać');
        else if (!eko.mozeKopac(stan, hit.id)) komunikat(`${b.nazwa} jest za twardy — potrzebny ${eko.KILOFY[b.poziom].nazwa.toLowerCase()}`);
        else if (b.wartosc && eko.czyPelny(stan)) komunikat('Plecak pełny — sprzedaj urobek na powierzchni');
        else {
            kopie = true;
            postep += dt / eko.czasKopania(stan, hit.id);
            if (postep >= 1) {
                zmienBlok(hit.x, hit.y, hit.z, AIR);
                sprzatnijOsierocone(hit.x, hit.y, hit.z, 1);
                poWstrzasie(hit.x, hit.y, hit.z);
                sprawdzWode(hit.x, hit.y, hit.z);
                odlamki(hit.x, hit.y, hit.z, hit.id, 12);
                if (hit.id === FOSSIL || hit.id === CHEST) {
                    const w = hit.id === FOSSIL ? znajdz(stan, 'skamienialosc') : otworzSkrzynke(stan);
                    komunikat(`${w.nowe ? 'Nowe znalezisko' : 'Znalezisko'}: ${w.okaz.nazwa} (+${w.monety} monet)${w.zapas ? ` i ${eko.ZAPASY[w.zapas].nazwa.toLowerCase()} +${w.ile}` : ''}`, 4500);
                    czastki.emit(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, { n: 16, kolor: [1, 0.85, 0.3], obszar: 0.9, rozrzut: 2.5, vy: 3.5, zycie: 0.9, rozmiar: 0.07 });
                    stuk(2.4, 0.2, 0.15); zapisz();
                }
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
    if (kopie && przed > 0 && Math.sin(zamach) <= 0) {
        stuk(1 + Math.random() * 0.3);
        // Iskry i okruchy w miejscu uderzenia kilofa.
        const o = player.eye(), d = player.dir(), t = Math.max(0, hit.dist - 0.05);
        czastki.emit(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t, { n: 3, kolor: KOLOR_SUROWCA[hit.id] || kolory[BLOCKS[hit.id].tekstury[1]], rozrzut: 2, vy: 1.5, zycie: 0.4, rozmiar: 0.05, obszar: 0.1 });
    }
    kilofGrupa.position.set(0.34, -0.3, -0.6);
    kilofGrupa.visible = wybrany === 0;
    kilofGrupa.rotation.set(-0.5 - Math.max(0, Math.sin(zamach)) * 0.9, 0.3, -0.35);
}

// ---------- Pętla gry ----------
const NIEBO = new THREE.Color(0x8ec5ee), CIEMNOSC = new THREE.Color(0x020203), GLEBINA = new THREE.Color(0x0c3050);
let podWoda = false, lampaOstrzezenie = 0, kroki = 0;
function klatka(dt) {
    if (gra && !sklepOtwarty && !komendaOtwarta()) {
        player.update(dt, {
            fx: DOTYK ? palce.fx : undefined, sx: DOTYK ? palce.sx : undefined,
            forward: klawisze.has('KeyW'), back: klawisze.has('KeyS'),
            left: klawisze.has('KeyA'), right: klawisze.has('KeyD'),
            jump: klawisze.has('Space') || palce.skok,
            down: klawisze.has('ShiftLeft') || klawisze.has('ShiftRight') || palce.dol,
            sprint: klawisze.has('ControlLeft')
        });
        kopanie(dt);
        zawaly(dt);
        dynamit(dt);
        podWoda = woda(dt);
        // Odgłos kroków (w wodzie - chlupot).
        if (player.onGround || player.inWater) {
            kroki += Math.hypot(player.vel.x, player.vel.z) * dt;
            if (kroki > 2.2) { kroki = 0; if (player.inWater) stuk(1.6, 0.08, 0.12); else stuk(0.3 + Math.random() * 0.12, 0.09, 0.05); }
        }
        if (player.pos.y <= kopalnia.shaft.bottomY + 0.6) zdobadz('dno');
        nietoperze.update(dt, player.eye(), eko.poziomPaliwa(stan) > 0, () => {
            for (let i = 0; i < 3; i++) setTimeout(() => stuk(6 + Math.random() * 3, 0.07, 0.035), i * 90);
            zdobadz('nietoperze');
        });
        if (!stan.osiagniecia?.grzybiarz && player.touches(id => id === MUSHROOM)) zdobadz('grzybiarz');

        // Lina ratunkowa: przytrzymaj R.
        linaCzas = klawisze.has('KeyR') || palce.lina ? linaCzas + dt : 0;
        if (linaCzas > 1.5) { naPowierzchnie(); linaCzas = 0; klawisze.delete('KeyR'); palce.lina = false; komunikat('Lina wyciągnęła cię na powierzchnię'); }
    }

    npc.update(dt, player.pos);
    for (const c of chmury.children) { c.position.x += c.userData.v * dt; if (c.position.x > 200) c.position.x = -200; }

    const oko = player.eye();
    camera.position.set(oko.x + (Math.random() - 0.5) * wstrzas * 0.06, oko.y + (Math.random() - 0.5) * wstrzas * 0.06, oko.z);
    camera.rotation.set(player.pitch, player.yaw, 0);
    lampa.position.copy(camera.position);

    // Im głębiej pod ziemią, tym ciemniej - zostaje tylko lampa.
    const pod = Math.max(0, Math.min(1, (kopalnia.groundY + 1 + EYE_HEIGHT - oko.y) / 5));
    // Lampa: pod ziemią ubywa paliwa, na powierzchni dolewa się do pełna.
    // Pusta lampa ledwo się tli - wtedy ratują pochodnie.
    if (gra && !sklepOtwarty) {
        if (pod > 0.5) stan.paliwo = Math.max(0, stan.paliwo - dt);
        else if (pod === 0 && eko.poziomPaliwa(stan) < 1) { if (eko.poziomPaliwa(stan) < 0.9) komunikat('Lampa napełniona'); eko.napelnijLampe(stan); lampaOstrzezenie = 0; }
    }
    const paliwo = eko.poziomPaliwa(stan);
    if (paliwo <= 0 && lampaOstrzezenie < 2) { lampaOstrzezenie = 2; zdobadz('ciemnosc'); komunikat('Lampa zgasła! Wracaj na powierzchnię.', 4000); }
    else if (paliwo > 0 && paliwo < 0.2 && lampaOstrzezenie < 1) { lampaOstrzezenie = 1; komunikat('Lampa przygasa — kończy się paliwo.', 4000); }
    const moc = paliwo <= 0 ? 0.12 : paliwo < 0.2 ? 0.7 + 0.3 * Math.sin(performance.now() / 70) * Math.sin(performance.now() / 23) : 1;
    const zasieg = eko.LAMPY[stan.lampa].zasieg * (paliwo <= 0 ? 0.4 : 1);
    scene.background.copy(NIEBO).lerp(CIEMNOSC.setHex(charakter(MINES[stan.kopalnia]).mgla), pod);
    if (podWoda) scene.background.lerp(GLEBINA, 0.85);
    scene.fog.color.copy(scene.background);
    scene.fog.near = podWoda ? 0.3 : 2 + (1 - pod) * 30;
    scene.fog.far = podWoda ? 9 : 80 + (zasieg * 1.4 - 80) * pod;
    ambient.intensity = 2.2 - 2.1 * pod;
    sun.intensity = 1.6 * (1 - pod);
    lampa.distance = zasieg * 1.3;
    lampa.intensity = (6 + zasieg * 0.15) * (0.25 + 0.75 * pod) * moc;
    $('lampa-pasek').firstElementChild.style.width = Math.round(paliwo * 100) + '%';
    $('lampa-pasek').classList.toggle('malo', paliwo < 0.2);
    $('oddech').style.display = oddech < 1 ? 'block' : 'none';
    $('oddech').firstElementChild.style.width = Math.round(oddech * 100) + '%';
    $('podwoda').style.opacity = podWoda ? 1 : 0;
    zycieSwiata(dt, pod); czastki.update(dt); osiagnieciaKlatka();
    chmury.visible = npc.group.visible = pod < 1;
    glowica.material.color.setHex(eko.KILOFY[stan.kilof].kolor);

    const glebokosc = Math.max(0, Math.floor(kopalnia.groundY + 1 - player.pos.y));
    $('glebokosc').textContent = glebokosc > 0 ? `Głębokość: ${glebokosc} m` : MINES[stan.kopalnia].nazwa + ' — powierzchnia';
    $('podpowiedz').textContent = !gra || sklepOtwarty ? '' : linaCzas > 0.2 ? 'Wciągam linę…'
        : DOTYK ? '' : przySklepie() ? 'E — pogadaj z Bronkiem (skup i sklep)' : maSzyb() ? 'E — szyb (winda, wózek)' : player.onLadder ? 'Spacja — w górę, Shift — w dół'
            : wybrany ? 'Lewy przycisk myszy — postaw' : '';
    if (DOTYK) { $('d-sklep').hidden = !przySklepie() && !maSzyb(); $('d-sklep').textContent = przySklepie() ? 'Sklep' : 'Szyb'; }
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
// Aplikacja na komputer: stan aktualizacji na ekranie startowym.
if (window.desktop) {
    const pokaz = tekst => { $('aktualizacja').textContent = tekst || ''; };
    window.desktop.stanAktualizacji().then(pokaz);
    window.desktop.naAktualizacje(pokaz);
}
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
    start() { bezMyszy = true; zlapMysz(); }, palce, dotyk: DOTYK, wybierz, postaw, zapisz,
    get pochodnie() { return pochodnie; }, get oddech() { return oddech; }, get spadki() { return spadki.length + lecace.length; },
    get przeplyw() { return !!przeplyw; }, kop(x, y, z) { zmienBlok(x, y, z, AIR); sprzatnijOsierocone(x, y, z, 1); poWstrzasie(x, y, z); sprawdzWode(x, y, z); },
    akcjaE, get lonty() { return lonty.length; }, npc, zdobadz, omdlenie, nietoperze, komenda: wykonajKomende, otworzSklep,
    mysz(v) { myszWcisnieta = v; }, klawisz(k, v) { v ? klawisze.add(k) : klawisze.delete(k); }
};
