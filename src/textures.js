// ------------------------------------------------------------
// TEKSTURY 64x64 - na razie rysowane kodem (zastępcze, pikselowe).
// Każda funkcja zwraca tablicę RGBA 64x64. Docelowo można je
// podmienić plikami PNG 64x64 o tych samych nazwach.
// Wszystkie tekstury skał "kafelkują się" - brzegi pasują do siebie.
// ------------------------------------------------------------
import { TILE } from './config.js';
import { mulberry32, hash2 } from './rng.js';
import { MINERALY, SKALY, PRODUKTY } from './minerals.js';

const S = TILE;

// Kolejność w atlasie.
export const TILE_NAMES = ['trawa_gora', 'trawa_bok', 'ziemia', 'kamien', 'lupek', 'bazalt',
    'lita_skala', 'deski', 'drabina', 'pochodnia', 'krucha', 'rumosz', 'stempel', 'dynamit',
    ...SKALY.map(r => r.klucz), ...MINERALY.map(r => r.klucz), 'grzyb', ...PRODUKTY.map(r => r.klucz),
    'skamielina', 'geoda', 'skrzynka', 'skrzynka_gora'];
// Tekstury z przezroczystym tłem (cienkie rzeczy i ikony przedmiotów).
export const PRZEZROCZYSTE = new Set(['drabina', 'pochodnia', 'stempel', 'dynamit', 'grzyb', ...PRODUKTY.map(r => r.klucz)]);
export const TILE_INDEX = Object.fromEntries(TILE_NAMES.map((n, i) => [n, i]));

// Gładki szum, który powtarza się co 64 piksele.
function vnoise(x, y, cells, seed) {
    const fx = x / S * cells, fy = y / S * cells;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const g = (i, j) => hash2(((i % cells) + cells) % cells, ((j % cells) + cells) % cells, seed);
    return (g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * sx) * (1 - sy)
        + (g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * sx) * sy;
}
function fbm(x, y, seed) {
    return vnoise(x, y, 4, seed) * 0.45 + vnoise(x, y, 8, seed + 1) * 0.3 + vnoise(x, y, 16, seed + 2) * 0.25;
}
function put(buf, x, y, r, g, b, a = 255) {
    const i = (((y % S) + S) % S * S + ((x % S) + S) % S) * 4;
    buf[i] = Math.max(0, Math.min(255, r)); buf[i + 1] = Math.max(0, Math.min(255, g));
    buf[i + 2] = Math.max(0, Math.min(255, b)); buf[i + 3] = a;
}
function mul(buf, x, y, k) {
    const i = (((y % S) + S) % S * S + ((x % S) + S) % S) * 4;
    buf[i] *= k; buf[i + 1] *= k; buf[i + 2] *= k;
}

// Skała: kilka odcieni jednego koloru + ciemne spękania + drobinki.
function skala(base, seed, { odcienie = 5, kontrast = 0.5, pekniecia = 0.011, drobinki = 0.03, pasy = false } = {}) {
    const buf = new Uint8ClampedArray(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const q = Math.min(odcienie - 1, Math.floor(fbm(x, y, seed) * 1.5 * odcienie - odcienie * 0.25));
        let k = 1 - kontrast / 2 + kontrast * Math.max(0, q) / (odcienie - 1);
        if (Math.abs(vnoise(x, y, 5, seed + 7) - 0.5) < pekniecia) k *= 0.62;
        const h = hash2(x, y, seed + 9);
        if (h < drobinki) k *= 0.8; else if (h > 1 - drobinki) k *= 1.14;
        if (pasy) k *= 0.93 + 0.12 * Math.sin((y + vnoise(x, y, 4, seed + 5) * 9) / S * Math.PI * 10);   // warstwy osadu
        put(buf, x, y, base[0] * k, base[1] * k, base[2] * k);
    }
    return buf;
}

// Ruda: skała + bryłki surowca z jasnym brzegiem u góry i cieniem u dołu.
function ruda(buf, kolor, seed, { ile = 7, klejnot = false } = {}) {
    const rnd = mulberry32(seed);
    const brylki = [];
    for (let i = 0; i < ile; i++) brylki.push([rnd() * S, rnd() * S, 3 + rnd() * 3.5]);
    const wrap = d => { d = Math.abs(d); return d > S / 2 ? S - d : d; };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        for (const [bx, by, r] of brylki) {
            const dx = wrap(x - bx), dy = wrap(y - by);
            const d = Math.sqrt(dx * dx + dy * dy) + (hash2(x >> 1, y >> 1, seed) - 0.5) * 2.2;
            if (d > r + 1) continue;
            if (d > r) { mul(buf, x, y, 0.55); continue; }           // ciemna obwódka
            let sx = x - bx, sy = y - by;
            if (sx > S / 2) sx -= S; if (sx < -S / 2) sx += S;
            if (sy > S / 2) sy -= S; if (sy < -S / 2) sy += S;
            const t = (sx + sy) / r;
            let k = t < -0.5 ? 1.25 : t > 0.6 ? 0.68 : 1;
            if (klejnot && Math.abs(sx + 1) < 1 && Math.abs(sy + 1) < 1) k = 1.7;   // błysk
            put(buf, x, y, kolor[0] * k, kolor[1] * k, kolor[2] * k);
            break;
        }
    }
    return buf;
}

// Inne sposoby, w jakie surowiec siedzi w skale. Każdy rysuje na
// gotowej teksturze skały i sam dba o kafelkowanie.
const kolorK = (buf, x, y, c, k) => put(buf, x, y, c[0] * k, c[1] * k, c[2] * k);
const zawin = d => { d = ((d % S) + S) % S; return d > S / 2 ? d - S : d; };

function krysztaly(buf, kolor, seed, blysk) {
    // Graniaste kryształy: romby z jasną i ciemną ścianką.
    const rnd = mulberry32(seed), lista = [];
    for (let i = 0; i < 8; i++) lista.push([rnd() * S, rnd() * S, 3 + rnd() * 4, 0.6 + rnd() * 0.8]);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) for (const [bx, by, r, w] of lista) {
        const dx = zawin(x - bx), dy = zawin(y - by), d = Math.abs(dx) / w + Math.abs(dy);
        if (d > r + 1) continue;
        if (d > r) { mul(buf, x, y, 0.5); break; }
        let k = dx < 0 ? (dy < 0 ? 1.3 : 1.05) : (dy < 0 ? 0.9 : 0.62);
        if (blysk && Math.abs(dx + 1) < 1 && Math.abs(dy + r * 0.4) < 1.2) k = 1.8;
        kolorK(buf, x, y, kolor, k); break;
    }
    return buf;
}
function zyly(buf, kolor, seed) {
    // Żyły: wijące się pasma przez całą skałę.
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const d = Math.abs(vnoise(x, y, 3, seed) * 0.7 + vnoise(x, y, 8, seed + 1) * 0.3 - 0.5);
        if (d < 0.022) kolorK(buf, x, y, kolor, d < 0.008 ? 1.2 : 0.95 - hash2(x, y, seed) * 0.2);
        else if (d < 0.03) mul(buf, x, y, 0.6);
    }
    return buf;
}
function ziarna(buf, kolor, seed, blysk) {
    // Drobne ziarna rozsiane skupiskami.
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const gesto = vnoise(x, y, 4, seed), h = hash2(x >> 1, y >> 1, seed + 3);
        if (gesto > 0.52 && h < (gesto - 0.52) * 2.2) kolorK(buf, x, y, kolor, blysk && hash2(x, y, seed + 4) > 0.9 ? 1.5 : 0.8 + hash2(x, y, seed + 5) * 0.4);
    }
    return buf;
}
function warstwy(buf, kolor, seed) {
    // Faliste pasy na przemian jaśniejsze i ciemniejsze (malachit, jadeit).
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const n = vnoise(x, y, 3, seed);
        if (n < 0.62) continue;
        const pas = Math.sin((y + vnoise(x, y, 4, seed + 2) * 22) / S * Math.PI * 12);
        if (n < 0.645) mul(buf, x, y, 0.5); else kolorK(buf, x, y, kolor, pas > 0.3 ? 1.2 : pas < -0.3 ? 0.62 : 0.9);
    }
    return buf;
}
function teczowy(buf, kolor, seed) {
    // Opal: mleczne bryłki mieniące się kolorami.
    const przed = buf.slice();
    ruda(buf, kolor, seed, { ile: 7 });
    const barwy = [[255, 120, 160], [120, 220, 255], [150, 255, 170], [255, 230, 120]];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4;
        if (buf[i] === przed[i] || buf[i] < kolor[0] * 0.9) continue;            // tylko jasne wnętrze bryłek
        if (hash2(x >> 1, y >> 1, seed + 8) > 0.6) { const c = barwy[Math.floor(hash2(x >> 1, y >> 1, seed + 9) * 4)]; put(buf, x, y, c[0], c[1], c[2]); }
    }
    return buf;
}
function surowiec(r) {
    const buf = makeTile(r.skala), seed = 92 + r.id;
    switch (r.styl) {
        case 'krysztaly': return krysztaly(buf, r.kolor, seed, r.blysk);
        case 'zyly': return zyly(buf, r.kolor, seed);
        case 'ziarna': return ziarna(buf, r.kolor, seed, r.blysk);
        case 'warstwy': return warstwy(buf, r.kolor, seed);
        case 'teczowy': return teczowy(buf, r.kolor, seed);
        default: return ruda(buf, r.kolor, seed, { ile: r.klucz === 'wegiel' ? 9 : r.blysk ? 6 : 7, klejnot: r.blysk });
    }
}

function trawaGora() {
    const buf = skala([84, 148, 60], 31, { odcienie: 5, kontrast: 0.45, pekniecia: 0, drobinki: 0.08 });
    return buf;
}
function trawaBok() {
    const buf = skala([124, 86, 54], 21, { kontrast: 0.4, pekniecia: 0.01 });
    for (let x = 0; x < S; x++) {
        const h = 9 + Math.floor(vnoise(x, 0, 16, 55) * 9) + (hash2(x, 3, 56) < 0.3 ? 2 : 0);
        for (let y = 0; y < h; y++) {
            const k = 0.82 + 0.3 * hash2(x >> 1, y >> 1, 57) - (y > h - 3 ? 0.22 : 0);
            put(buf, x, y, 84 * k, 148 * k, 60 * k);
        }
    }
    return buf;
}
function deski() {
    const buf = new Uint8ClampedArray(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const deska = y >> 4, r = y & 15;
        const slojeN = vnoise(x, (y * 5) % S, 16, 71 + deska) * 0.6 + vnoise(x, y, 4, 75) * 0.4;
        let k = 0.84 + Math.floor(slojeN * 4) * 0.07 + (hash2(deska, 0, 72) - 0.5) * 0.14;
        if (r === 0) k *= 0.5; else if (r === 15) k *= 0.76; else if (r === 1) k *= 1.08;
        const styk = Math.floor(hash2(deska, 1, 73) * S);
        if (x === styk) k *= 0.55;
        if ((x === (styk + 3) % S || x === (styk + S - 3) % S) && (r === 4 || r === 11)) k *= 0.45;   // gwoździe
        put(buf, x, y, 178 * k, 132 * k, 78 * k);
    }
    return buf;
}
function drabina() {
    const buf = new Uint8ClampedArray(S * S * 4);   // przezroczyste tło
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const szczebel = (y & 15) >= 5 && (y & 15) < 10 && x >= 8 && x < 56;
        const belka = (x >= 8 && x < 15) || (x >= 49 && x < 56);
        if (!szczebel && !belka) continue;
        let k = 0.9 + hash2(x >> 1, y >> 2, 81) * 0.2;
        if (belka) k *= (x === 8 || x === 49) ? 1.15 : (x === 14 || x === 55) ? 0.65 : 1;
        else k *= (y & 15) === 5 ? 1.1 : (y & 15) === 9 ? 0.6 : 0.88;
        put(buf, x, y, 150 * k, 106 * k, 60 * k);
    }
    return buf;
}

function rumosz() {
    // Luźne kamienie: komórki o różnych odcieniach z ciemnymi szczelinami.
    const buf = new Uint8ClampedArray(S * S * 4), rnd = mulberry32(77), pts = [];
    for (let i = 0; i < 34; i++) pts.push([rnd() * S, rnd() * S, 0.7 + rnd() * 0.5]);
    const wrap = d => { d = Math.abs(d); return d > S / 2 ? S - d : d; };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        let d1 = 1e9, d2 = 1e9, k = 1;
        for (const [px, py, pk] of pts) {
            const dd = Math.hypot(wrap(x - px), wrap(y - py));
            if (dd < d1) { d2 = d1; d1 = dd; k = pk; } else if (dd < d2) d2 = dd;
        }
        if (d2 - d1 < 1.6) k = 0.38;
        k *= 0.92 + hash2(x, y, 78) * 0.16;
        put(buf, x, y, 120 * k, 112 * k, 104 * k);
    }
    return buf;
}

function stempel() {
    // Drewniany słup na całą wysokość pola, z poprzeczkami u góry i dołu.
    const buf = new Uint8ClampedArray(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const klin = y < 7 || y >= S - 5;
        if (!(x >= 24 && x < 40) && !(klin && x >= 12 && x < 52)) continue;
        let k = 0.85 + vnoise(x * 4 % S, y, 8, 95) * 0.3;
        if (x === 24 || (klin && x === 12)) k *= 1.2; else if (x === 39 || (klin && x === 51)) k *= 0.6;
        if (y === 7 || y === S - 6) k *= 0.6;
        put(buf, x, y, 156 * k, 112 * k, 64 * k);
    }
    return buf;
}
function dynamit() {
    // Trzy czerwone laski związane sznurkiem, z lontem.
    const buf = new Uint8ClampedArray(S * S * 4);
    for (let i = 0; i < 3; i++) for (let y = 26; y < S; y++) for (let x = 17 + i * 10; x < 27 + i * 10; x++) {
        const lx = x - 17 - i * 10;
        let k = lx === 0 ? 0.6 : lx < 3 ? 1.25 : lx > 7 ? 0.7 : 1;
        if (y === 26 || y === S - 1) k *= 0.6;
        if (y >= 40 && y < 45) put(buf, x, y, 214 * k * 0.9, 190 * k * 0.9, 130 * k * 0.9); else put(buf, x, y, 204 * k, 40 * k, 34 * k);
    }
    for (let y = 12; y < 26; y++) { const x = 31 + Math.round(Math.sin(y * 0.7) * 2); put(buf, x, y, 60, 50, 40); put(buf, x + 1, y, 90, 76, 60); }
    for (const [dx, dy] of [[0, 0], [1, 0], [0, -1], [-1, -1], [2, -1], [1, -2]]) put(buf, 31 + dx, 11 + dy, 255, 210, 80);
    return buf;
}

function grzyb() {
    // Kępka świecących grzybów: trzy kapelusze na cienkich nóżkach.
    const buf = new Uint8ClampedArray(S * S * 4);
    for (const [cx, top, r] of [[20, 40, 7], [36, 30, 9], [47, 46, 5]]) {
        for (let y = top; y < S; y++) for (let x = cx - 1; x <= cx + 1; x++) put(buf, x, y, 170, 214, 200);
        for (let y = top - r; y <= top + 1; y++) for (let x = cx - r; x <= cx + r; x++) {
            const dx = (x - cx) / r, dy = (y - top) / r;
            if (dx * dx + dy * dy * 2.4 > 1 || dy > 0.15) continue;
            const k = dy < -0.35 ? 1.25 : 1;
            put(buf, x, y, 70 * k, 226 * k, 196 * k);
        }
        put(buf, cx - 2, top - Math.round(r * 0.4), 220, 255, 240); put(buf, cx + 2, top - Math.round(r * 0.25), 220, 255, 240);
    }
    return buf;
}
function sztabka(kolor) {
    // Ikona sztabki: bryła w kształcie trapezu z jasną górą.
    const buf = new Uint8ClampedArray(S * S * 4);
    for (let y = 18; y < 48; y++) {
        const t = (y - 18) / 30, x1 = Math.round(14 - t * 8), x2 = Math.round(50 + t * 8);
        for (let x = x1; x < x2; x++) {
            let k = y < 26 ? 1.25 : y > 42 ? 0.6 : 0.95;
            if (x < x1 + 2 || x >= x2 - 2 || y === 18 || y === 47) k = 0.4;
            else if (x < x1 + 5) k *= 1.15; else if (x > x2 - 6) k *= 0.75;
            put(buf, x, y, kolor[0] * k, kolor[1] * k, kolor[2] * k);
        }
    }
    for (let i = 0; i < 4; i++) put(buf, 22 + i, 22, 255, 255, 255);
    return buf;
}

function skamielina() {
    // Amonit w wapieniu: spirala z jasnymi żeberkami.
    const buf = makeTile('wapien');
    for (let t = 0; t < 520; t++) {
        const a = t * 0.06, rad = 2 + a * 1.25;
        if (rad > 24) break;
        const x = Math.round(32 + Math.cos(a) * rad), y = Math.round(33 + Math.sin(a) * rad), zebro = t % 9 < 2;
        for (let d = 0; d < 3; d++) {
            const px = Math.round(x + Math.cos(a) * d), py = Math.round(y + Math.sin(a) * d), k = zebro ? 1.15 : d === 0 ? 0.5 : 0.72;
            put(buf, px, py, 150 * k, 128 * k, 96 * k);
        }
    }
    return buf;
}
function geoda() {
    // Okrągła, guzowata bryła w skale z pęknięciem, w którym coś błyszczy.
    const buf = makeTile('kamien');
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const dx = x - 32, dy = y - 32, d = Math.hypot(dx, dy) + (vnoise(x, y, 8, 61) - 0.5) * 7;
        if (d > 22) continue;
        if (d > 20) { mul(buf, x, y, 0.5); continue; }
        const k = 0.75 + vnoise(x, y, 16, 62) * 0.45 + (dx + dy < -14 ? 0.18 : dx + dy > 16 ? -0.2 : 0);
        put(buf, x, y, 92 * k, 84 * k, 80 * k);
        const szpara = Math.abs(dx - Math.sin(y * 0.35) * 3);
        if (szpara < 2.2 && Math.abs(dy) < 13) put(buf, x, y, ...(hash2(x, y, 63) > 0.55 ? [214, 150, 255] : hash2(x, y, 64) > 0.5 ? [150, 90, 220] : [70, 40, 110]));
    }
    return buf;
}
function skrzynka(gora) {
    // Stara skrzynka: ciemne deski w okuciach, z przodu zamek.
    const buf = new Uint8ClampedArray(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        let k = 0.8 + vnoise(x, (y * 5) % S, 16, 66) * 0.25;
        if (x % 16 === 0) k *= 0.6;
        let c = [128, 88, 48];
        const okucie = x < 5 || x >= S - 5 || y < 5 || y >= S - 5 || (!gora && y >= 20 && y < 25);
        if (okucie) { c = [86, 88, 96]; k = 0.8 + hash2(x >> 1, y >> 1, 67) * 0.35; if (x === 4 || y === 4 || x === S - 5 || y === S - 5) k *= 0.6; }
        if (!gora && x >= 27 && x < 37 && y >= 17 && y < 31) { c = [214, 180, 70]; k = x === 27 || y === 30 ? 0.6 : 1; if (x >= 31 && x < 33 && y >= 23 && y < 28) k = 0.25; }
        put(buf, x, y, c[0] * k, c[1] * k, c[2] * k);
    }
    return buf;
}

function pochodnia() {
    const buf = new Uint8ClampedArray(S * S * 4);   // przezroczyste tło
    for (let y = 26; y < S; y++) for (let x = 28; x < 36; x++) {           // trzonek
        const k = (x === 28 ? 1.2 : x === 35 ? 0.6 : 0.9) * (0.9 + hash2(x >> 1, y >> 2, 91) * 0.2);
        put(buf, x, y, 132 * k, 92 * k, 52 * k);
    }
    for (let y = 4; y < 28; y++) for (let x = 20; x < 44; x++) {           // płomień
        const dx = (x - 31.5) / (4 + (y - 4) * 0.33), dy = (y - 27) / 23;
        const d = dx * dx + dy * dy * 0.9 + (hash2(x >> 1, y >> 1, 92) - 0.5) * 0.25;
        if (d > 1) continue;
        if (d < 0.25) put(buf, x, y, 255, 250, 200); else if (d < 0.6) put(buf, x, y, 255, 200, 70); else put(buf, x, y, 240, 120, 30);
    }
    return buf;
}

export function makeTile(name) {
    const kamien = () => skala([128, 128, 134], 11);
    const lupek = () => skala([78, 86, 102], 12, { odcienie: 4, pekniecia: 0.03 });
    const bazalt = () => skala([56, 52, 62], 13, { odcienie: 4, kontrast: 0.6, pekniecia: 0.012 });
    switch (name) {
        case 'trawa_gora': return trawaGora();
        case 'trawa_bok': return trawaBok();
        case 'ziemia': return skala([124, 86, 54], 21, { kontrast: 0.4, pekniecia: 0.01 });
        case 'kamien': return kamien();
        case 'lupek': return lupek();
        case 'bazalt': return bazalt();
        case 'lita_skala': return skala([34, 34, 40], 14, { odcienie: 3, kontrast: 0.9, pekniecia: 0.04 });
        case 'deski': return deski();
        case 'drabina': return drabina();
        case 'pochodnia': return pochodnia();
        // Krucha skała ma być widoczna z daleka: jaśniejsza, gęsto spękana.
        case 'krucha': return skala([150, 140, 122], 15, { odcienie: 4, kontrast: 0.45, pekniecia: 0.07, drobinki: 0.06 });
        case 'rumosz': return rumosz();
        case 'stempel': return stempel();
        case 'dynamit': return dynamit();
    }
    const sk = SKALY.find(r => r.klucz === name);
    if (sk) return skala(sk.kolor, 40 + sk.id, sk.wyglad);
    if (name === 'grzyb') return grzyb();
    if (name === 'skamielina') return skamielina();
    if (name === 'geoda') return geoda();
    if (name === 'skrzynka' || name === 'skrzynka_gora') return skrzynka(name === 'skrzynka_gora');
    const pr = PRODUKTY.find(r => r.klucz === name);
    if (pr) return sztabka(pr.kolor);
    const su = MINERALY.find(r => r.klucz === name);
    if (su) return surowiec(su);
    throw new Error('Nieznana tekstura: ' + name);
}

// Pęknięcia na kopanym bloku: etap 1..5, każdy następny dokłada rysy.
export function makeCrack(etap) {
    const buf = new Uint8ClampedArray(S * S * 4);
    const rnd = mulberry32(900);
    for (let i = 0; i < etap * 3; i++) {
        let x = 32 + (rnd() - 0.5) * 12, y = 32 + (rnd() - 0.5) * 12;
        let kat = rnd() * Math.PI * 2;
        const len = 12 + rnd() * 22;
        for (let j = 0; j < len; j++) {
            if (x < 0 || y < 0 || x >= S || y >= S) break;
            put(buf, Math.floor(x), Math.floor(y), 10, 8, 8, 215);
            if (rnd() < 0.5) put(buf, Math.floor(x) + 1, Math.floor(y), 10, 8, 8, 150);
            kat += (rnd() - 0.5) * 0.9;
            x += Math.cos(kat); y += Math.sin(kat);
        }
    }
    return buf;
}
