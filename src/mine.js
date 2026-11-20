// ------------------------------------------------------------
// GENERATOR KOPALNI. Z definicji kopalni i ziarna buduje cały świat:
// powierzchnię ze sklepem, szyb z drabiną, poziomy z chodnikami,
// komory i żyły surowców. Czysta logika - działa też bez przeglądarki
// (sprawdzenia w tools/).
// ------------------------------------------------------------
import { WORLD_X, WORLD_Z, SURFACE_AIR } from './config.js';
import { mulberry32, noise2 } from './rng.js';
import { charakter } from './mines.js';
import { AIR, GRASS, DIRT, BEDROCK, PLANKS, LADDER, UNSTABLE, WATER, MUSHROOM, BLOCKS, isSolid, isHostRock } from './blocks.js';

export class World {
    constructor(w, h, d) {
        this.w = w; this.h = h; this.d = d;
        this.data = new Uint8Array(w * h * d);
        this.light = new Uint8Array(w * h * d);   // światło pochodni 0..14 (src/light.js)
    }
    index(x, y, z) { return x + z * this.w + y * this.w * this.d; }
    getLight(x, y, z) { return this.inside(x, y, z) ? this.light[this.index(x, y, z)] : 0; }
    inside(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < this.w && y < this.h && z < this.d; }
    // Poza światem: po bokach i pod spodem lita skała, nad nim powietrze.
    get(x, y, z) {
        if (y >= this.h) return AIR;
        if (!this.inside(x, y, z)) return BEDROCK;
        return this.data[x + z * this.w + y * this.w * this.d];
    }
    set(x, y, z, id) {
        if (this.inside(x, y, z)) this.data[x + z * this.w + y * this.w * this.d] = id;
    }
    solid(x, y, z) { return isSolid(this.get(x, y, z)); }
}

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

export function generateMine(def, seed) {
    const W = WORLD_X, D = WORLD_Z, H = def.depth + SURFACE_AIR;
    const groundY = def.depth - 1;          // najwyższy blok ziemi
    const world = new World(W, H, D);
    const rnd = mulberry32(seed);
    const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));   // całkowita a..b
    const cx = W / 2, cz = D / 2;
    const ch = charakter(def);

    // --- 1. Warstwy skał (granice lekko falują) ---
    for (let y = 0; y <= groundY; y++) {
        const depth = groundY - y;
        for (let z = 0; z < D; z++) {
            for (let x = 0; x < W; x++) {
                const fala = Math.floor(noise2(x / 9, z / 9, seed) * 4);
                let id;
                if (depth === 0) id = GRASS;
                else if (depth <= 2 + (fala >> 1)) id = DIRT;
                else {
                    id = def.warstwy[0].blok;
                    for (const w of def.warstwy) if (depth + fala - 2 >= w.od) id = w.blok;
                }
                world.set(x, y, z, id);
            }
        }
    }

    // --- 2. Lita skała: dno i ściany (na powierzchni niski wał) ---
    for (let z = 0; z < D; z++) {
        for (let x = 0; x < W; x++) {
            world.set(x, 0, z, BEDROCK);
            if (x === 0 || z === 0 || x === W - 1 || z === D - 1) {
                for (let y = 0; y <= groundY + 3; y++) world.set(x, y, z, BEDROCK);
            }
        }
    }

    // Kopanie korytarzy: nie ruszamy stałych bloków ani płytkiej ziemi.
    const tunel = [];   // komórki chodników - przy nich dosypiemy rudy
    function carve(x, y, z) {
        if (x < 2 || z < 2 || x > W - 3 || z > D - 3 || y < 1 || y > groundY - 4) return;
        const id = world.get(x, y, z);
        if (id === AIR || BLOCKS[id].staly) return;
        world.set(x, y, z, AIR);
    }
    function komora(x, y, z, rx, ry) {
        for (let dy = 0; dy <= Math.ceil(ry); dy++)
            for (let dz = -Math.ceil(rx); dz <= Math.ceil(rx); dz++)
                for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
                    const k = (dx * dx + dz * dz) / (rx * rx) + (dy * dy) / (ry * ry);
                    if (k <= 1 + (rnd() - 0.5) * 0.3) carve(x + dx, y + dy, z + dz);
                }
        tunel.push([x, y, z]);
    }
    function chodnik(x, y, z, dir, len, glebia) {
        for (let i = 0; i < len; i++) {
            const [dx, dz] = DIRS[dir];
            carve(x, y, z); carve(x, y + 1, z);
            if (rnd() < 0.35) { carve(x + dz, y, z + dx); carve(x + dz, y + 1, z + dx); }
            if (rnd() < 0.2) carve(x, y + 2, z);
            tunel.push([x, y, z]);
            if (i > 3 && rnd() < 0.12) dir = (dir + (rnd() < 0.5 ? 1 : 3)) % 4;
            if (i > 3 && rnd() < 0.07) y = Math.max(2, Math.min(groundY - 6, y + (rnd() < 0.5 ? 1 : -1)));
            if (glebia < 2 && i > 5 && rnd() < 0.06)
                chodnik(x, y, z, (dir + (rnd() < 0.5 ? 1 : 3)) % 4, ri(6, 16), glebia + 1);
            const [ndx, ndz] = DIRS[dir];
            x += ndx; z += ndz;
            if (x < 3 || z < 3 || x > W - 4 || z > D - 4) break;
        }
        komora(x, y, z, 2.5 + rnd() * 2.5, 1.5 + rnd() * 1.5);
    }

    // --- 3. Szyb 2x2 z drabiną ---
    const bottomY = Math.max(2, groundY - Math.floor(def.depth * 0.82));
    for (let y = bottomY; y <= groundY; y++)
        for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 2; dx++) world.set(cx + dx, y, cz + dz, AIR);

    // --- 4. Poziomy: co kilka bloków chodniki odchodzą od szybu ---
    const poziomy = [];
    for (let g = 8; groundY - g > bottomY + 4; g += ri(8, 11)) poziomy.push(groundY - g);
    poziomy.push(bottomY);
    for (const L of poziomy) {
        const start = ri(0, 3), ile = ri(2, 3);
        for (let k = 0; k < ile; k++) {
            const dir = (start + k) % 4;
            const [dx, dz] = DIRS[dir];
            const bok = ri(0, 1);
            const x = dx > 0 ? cx + 2 : dx < 0 ? cx - 1 : cx + bok;
            const z = dz > 0 ? cz + 2 : dz < 0 ? cz - 1 : cz + bok;
            chodnik(x, L, z, dir, ri(14, 30), 0);
        }
    }

    // --- 5. Ukryte komory - trzeba się do nich dokopać ---
    for (let i = 0; i < Math.floor(def.depth / 5); i++)
        komora(ri(5, W - 6), ri(2, groundY - 12), ri(5, D - 6), 2 + rnd() * 1.5, 1.2 + rnd());

    // Drabina na całej wysokości szybu (i szczebel ponad ziemię).
    for (let y = bottomY; y <= groundY + 1; y++) world.set(cx, y, cz, LADDER);

    // --- 6. Żyły surowców ---
    function zyla(x, y, z, blok, rozmiar) {
        for (let i = 0; i < rozmiar; i++) {
            if (isHostRock(world.get(x, y, z))) world.set(x, y, z, blok);
            const o = ri(0, 5);
            if (o === 0) x++; else if (o === 1) x--; else if (o === 2) z++; else if (o === 3) z--; else if (o === 4) y++; else y--;
        }
    }
    for (const [blok, od, doG, ile, rozmiar] of def.rudy) {
        const dno = Math.min(doG, def.depth - 2);
        for (let i = 0; i < ile; i++)
            zyla(ri(2, W - 3), groundY - ri(od, dno), ri(2, D - 3), blok, rozmiar);
    }
    // Trochę rudy w ścianach chodników, żeby było co kopać od razu.
    for (const [x, y, z] of tunel) {
        if (rnd() > 0.14) continue;
        const depth = groundY - y;
        const pasuje = def.rudy.filter(r => depth >= r[1] && depth <= r[2]);
        if (!pasuje.length) continue;
        const r = pasuje[ri(0, pasuje.length - 1)];
        const [dx, dz] = DIRS[ri(0, 3)];
        zyla(x + dx * ri(1, 2), y + ri(0, 1), z + dz * ri(1, 2), r[0], r[4]);
    }

    // --- 6b. Krucha skała: spękane płaty w stropach chodników ---
    for (const [x, y, z] of tunel) {
        if (rnd() > 0.045 * ch.krucha) continue;
        let sy = y;
        while (sy < groundY - 5 && !world.solid(x, sy, z)) sy++;          // strop nad chodnikiem
        let bx = x, by = sy, bz = z;
        for (let i = 0, n = ri(5, 14); i < n; i++) {
            if (by <= groundY - 5 && isHostRock(world.get(bx, by, bz))) world.set(bx, by, bz, UNSTABLE);
            const o = ri(0, 5);
            if (o === 0) bx++; else if (o === 1) bx--; else if (o === 2) bz++; else if (o === 3) bz--; else if (o === 4) by++; else by = Math.max(sy, by - 1);
        }
    }

    // --- 6c. Zbiorniki wody: zamknięte, pełne komory w skale ---
    const zbiorniki = [];
    for (let i = 0; i < Math.floor(def.depth / 6 * ch.woda); i++) {
        const x = ri(7, W - 8), y = ri(5, groundY - 14), z = ri(7, D - 8);
        const rx = 2.2 + rnd() * 1.6, ry = 1.4 + rnd() * 1.2;
        if (Math.abs(x - cx) < 9 && Math.abs(z - cz) < 9) continue;         // nie przy szybie
        const pola = []; let szczelny = true;
        for (let dy = -Math.ceil(ry) - 1; dy <= Math.ceil(ry) + 1 && szczelny; dy++)
            for (let dz = -Math.ceil(rx) - 1; dz <= Math.ceil(rx) + 1 && szczelny; dz++)
                for (let dx = -Math.ceil(rx) - 1; dx <= Math.ceil(rx) + 1; dx++) {
                    const id = world.get(x + dx, y + dy, z + dz);
                    if (!isSolid(id) || BLOCKS[id].staly || y + dy < 1) { szczelny = false; break; }
                    if ((dx * dx + dz * dz) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) pola.push([x + dx, y + dy, z + dz]);
                }
        if (!szczelny) continue;
        for (const [a, b, c] of pola) world.set(a, b, c, WATER);
        zbiorniki.push([x, y, z]);
    }

    // --- 6d. Zalane dno: wszystko, co puste poniżej lustra wody ---
    if (ch.zalane > 0) {
        const lustro = bottomY + Math.floor((groundY - bottomY) * ch.zalane);
        for (let y = 1; y <= lustro; y++) for (let z = 1; z < D - 1; z++) for (let x = 1; x < W - 1; x++)
            if (world.get(x, y, z) === AIR) world.set(x, y, z, WATER);
    }

    // --- 6e. Świecące grzyby: kępki na dnie chodników i komór ---
    for (const [x, y, z] of tunel) {
        if (rnd() > 0.03) continue;
        for (let i = 0, n = ri(1, 3); i < n; i++) {
            const gx = x + ri(-1, 1), gz = z + ri(-1, 1);
            let gy = y;
            while (gy > 1 && world.get(gx, gy - 1, gz) === AIR) gy--;      // w komorze: na dno
            if (world.get(gx, gy, gz) === AIR && world.solid(gx, gy - 1, gz)) world.set(gx, gy, gz, MUSHROOM);
        }
    }

    // --- 7. Powierzchnia: szalunek wokół szybu i budka skupu ---
    for (let dz = -1; dz <= 2; dz++) for (let dx = -1; dx <= 2; dx++) {
        const wSzybie = dx >= 0 && dx <= 1 && dz >= 0 && dz <= 1;
        if (!wSzybie) world.set(cx + dx, groundY, cz + dz, PLANKS);
    }
    const sx = cx + 7, sz = cz - 2, gy = groundY + 1;
    for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 4; z++) world.set(sx + 3, gy + y, sz + z, PLANKS);        // tył
        for (let x = 1; x < 4; x++) { world.set(sx + x, gy + y, sz, PLANKS); world.set(sx + x, gy + y, sz + 3, PLANKS); }
    }
    for (let z = 0; z < 4; z++) for (let x = 0; x < 4; x++) world.set(sx + x, gy + 3, sz + z, PLANKS);   // dach
    world.set(sx + 1, gy, sz + 1, PLANKS); world.set(sx + 1, gy, sz + 2, PLANKS);                         // lada
    world.set(sx + 3, gy + 4, sz, BEDROCK);                                                               // komin pieca

    return {
        world, groundY, seed, zbiorniki, poziomy,
        spawn: { x: cx - 3.5, y: groundY + 1, z: cz + 1 },
        shaft: { x: cx, z: cz, bottomY },
        shop: { x: sx + 0.5, z: sz + 2 },
        komin: { x: sx + 3.5, y: gy + 5, z: sz + 0.5 }
    };
}

// Zapisane zmiany gracza (wykopane i postawione bloki): { numer pola: blok }.
export function applyChanges(world, zmiany) {
    for (const [i, id] of Object.entries(zmiany)) if (i >= 0 && i < world.data.length && BLOCKS[id] !== undefined) world.data[i] = id;
}
