// ------------------------------------------------------------
// TEKSTURY 64x64 - na razie rysowane kodem (zastępcze, pikselowe).
// Każda funkcja zwraca tablicę RGBA 64x64. Docelowo można je
// podmienić plikami PNG 64x64 o tych samych nazwach.
// Wszystkie tekstury skał "kafelkują się" - brzegi pasują do siebie.
// ------------------------------------------------------------
import { TILE } from './config.js';
import { mulberry32, hash2 } from './rng.js';

const S = TILE;

// Kolejność w atlasie.
export const TILE_NAMES = ['trawa_gora', 'trawa_bok', 'ziemia', 'kamien', 'lupek', 'bazalt',
    'lita_skala', 'deski', 'drabina', 'wegiel', 'miedz', 'zelazo', 'srebro', 'zloto',
    'szmaragd', 'rubin', 'diament'];
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
function skala(base, seed, { odcienie = 5, kontrast = 0.5, pekniecia = 0.011, drobinki = 0.03 } = {}) {
    const buf = new Uint8ClampedArray(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const q = Math.min(odcienie - 1, Math.floor(fbm(x, y, seed) * 1.5 * odcienie - odcienie * 0.25));
        let k = 1 - kontrast / 2 + kontrast * Math.max(0, q) / (odcienie - 1);
        if (Math.abs(vnoise(x, y, 5, seed + 7) - 0.5) < pekniecia) k *= 0.62;
        const h = hash2(x, y, seed + 9);
        if (h < drobinki) k *= 0.8; else if (h > 1 - drobinki) k *= 1.14;
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
        case 'wegiel': return ruda(kamien(), [30, 30, 36], 101, { ile: 9 });
        case 'miedz': return ruda(kamien(), [214, 120, 62], 102);
        case 'zelazo': return ruda(kamien(), [206, 168, 138], 103);
        case 'srebro': return ruda(lupek(), [226, 232, 242], 104);
        case 'zloto': return ruda(lupek(), [250, 206, 60], 105);
        case 'szmaragd': return ruda(bazalt(), [40, 214, 112], 106, { ile: 6, klejnot: true });
        case 'rubin': return ruda(bazalt(), [228, 44, 74], 107, { ile: 6, klejnot: true });
        case 'diament': return ruda(bazalt(), [112, 236, 246], 108, { ile: 6, klejnot: true });
    }
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
