// Sprawdzenia logiki gry (bez przeglądarki): node tools/sprawdz.mjs
import assert from 'node:assert/strict';
import { MINES } from '../src/mines.js';
import { generateMine } from '../src/mine.js';
import { meshChunk } from '../src/mesher.js';
import { BLOCKS, AIR, LADDER, COAL, DIAMOND, STONE, SLATE, isSolid } from '../src/blocks.js';
import { TILE_NAMES, TILE_INDEX, makeTile, makeCrack } from '../src/textures.js';
import * as eko from '../src/economy.js';
import { CHUNK } from '../src/config.js';

let ok = 0;
const test = (nazwa, fn) => { fn(); ok++; console.log('  ok  ' + nazwa); };

for (const [mi, def] of MINES.entries()) {
    for (const seed of [1, 7, 12345]) {
        test(`kopalnia "${def.nazwa}" ziarno ${seed}: da się dojść i są rudy`, () => {
            const m = generateMine(def, seed), w = m.world;
            // Ten sam wynik dla tego samego ziarna.
            assert.deepEqual(generateMine(def, seed).world.data, w.data);
            // Gracz nie startuje w ścianie i stoi na ziemi.
            const sx = Math.floor(m.spawn.x), sz = Math.floor(m.spawn.z);
            assert.equal(w.get(sx, m.spawn.y, sz), AIR);
            assert.equal(w.get(sx, m.spawn.y + 1, sz), AIR);
            assert.ok(w.solid(sx, m.spawn.y - 1, sz));
            // Zalanie od startu przez puste pola (gracz ma 2 bloki wysokości
            // nie jest tu liczone - wystarczy, że korytarze łączą się z szybem).
            const seen = new Uint8Array(w.data.length), kolejka = [[sx, m.spawn.y, sz]];
            const id = (x, y, z) => x + z * w.w + y * w.w * w.d;
            seen[id(sx, m.spawn.y, sz)] = 1;
            let dno = false, puste = 0; const rudyPrzyDrodze = new Set();
            while (kolejka.length) {
                const [x, y, z] = kolejka.pop(); puste++;
                if (y === m.shaft.bottomY) dno = true;
                for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
                    const nx = x + dx, ny = y + dy, nz = z + dz;
                    if (!w.inside(nx, ny, nz)) continue;
                    const b = w.get(nx, ny, nz);
                    if (isSolid(b)) { if (BLOCKS[b].wartosc) rudyPrzyDrodze.add(b); continue; }
                    if (seen[id(nx, ny, nz)]) continue;
                    seen[id(nx, ny, nz)] = 1; kolejka.push([nx, ny, nz]);
                }
            }
            assert.ok(dno, 'dno szybu osiągalne');
            assert.ok(rudyPrzyDrodze.size >= 2, 'przy chodnikach widać co najmniej 2 rodzaje rud');
            // Każda ruda z definicji występuje w kopalni.
            const licz = {};
            for (const b of w.data) licz[b] = (licz[b] || 0) + 1;
            for (const r of def.rudy) assert.ok(licz[r[0]] > 20, 'jest ' + BLOCKS[r[0]].nazwa);
            // Drabina od dna po powierzchnię.
            for (let y = m.shaft.bottomY; y <= m.groundY + 1; y++) assert.equal(w.get(m.shaft.x, y, m.shaft.z), LADDER);
            // W pierwszej kopalni przy starcie da się coś kopać drewnianym kilofem.
            if (mi === 0) assert.ok(rudyPrzyDrodze.has(COAL));
        });
    }
}

test('mesher: poprawne tablice dla całej kopalni', () => {
    const m = generateMine(MINES[0], 3), w = m.world;
    let trojkaty = 0;
    for (let cy = 0; cy < w.h / CHUNK; cy++) for (let cz = 0; cz < w.d / CHUNK; cz++) for (let cx = 0; cx < w.w / CHUNK; cx++) {
        const g = meshChunk(w, cx, cy, cz, TILE_INDEX);
        assert.equal(g.pos.length / 3, g.uv.length / 2);
        assert.equal(g.pos.length, g.nor.length);
        assert.equal(g.pos.length, g.col.length);
        assert.equal(g.idx.length % 3, 0);
        assert.ok(g.idx.every(i => i < g.pos.length / 3));
        assert.ok(g.uv.every(v => v >= 0 && v <= 1));
        trojkaty += g.idx.length / 3;
    }
    assert.ok(trojkaty > 5000);
    assert.equal(MINES.every(d => (d.depth + 10) % CHUNK === 0), true, 'wysokość świata dzieli się na kawałki');
});

test('tekstury: 64x64, nieprzezroczyste (poza drabiną), kafelkują się', () => {
    for (const n of TILE_NAMES) {
        const t = makeTile(n);
        assert.equal(t.length, 64 * 64 * 4);
        let pelne = 0;
        for (let i = 3; i < t.length; i += 4) if (t[i] === 255) pelne++;
        if (n === 'drabina') assert.ok(pelne > 500 && pelne < 3000);
        else assert.equal(pelne, 64 * 64, n);
    }
    for (const b of BLOCKS) if (b) for (const t of b.tekstury) assert.ok(t in TILE_INDEX, t);
    for (let e = 1; e <= 5; e++) assert.equal(makeCrack(e).length, 64 * 64 * 4);
});

test('gospodarka: urobek, sprzedaż, ulepszenia, kopalnie', () => {
    const s = eko.nowyStan();
    assert.ok(eko.mozeKopac(s, STONE) && eko.mozeKopac(s, COAL));
    assert.ok(!eko.mozeKopac(s, SLATE) && !eko.mozeKopac(s, DIAMOND) && !eko.mozeKopac(s, LADDER));
    assert.equal(eko.dodajUrobek(s, STONE), false);          // kamień nic nie daje
    for (let i = 0; i < 25; i++) eko.dodajUrobek(s, COAL);
    assert.equal(eko.ileWPlecaku(s), 20);                     // torba mieści 20
    assert.ok(eko.czyPelny(s));
    assert.equal(eko.sprzedajWszystko(s), 100);
    assert.equal(s.kasa, 100); assert.equal(eko.ileWPlecaku(s), 0);
    const t0 = eko.czasKopania(s, STONE);
    assert.ok(eko.kupUlepszenie(s, 'kilof')); assert.equal(s.kasa, 40);
    assert.ok(eko.czasKopania(s, STONE) < t0);
    assert.ok(!eko.kupUlepszenie(s, 'plecak'));               // za mało monet
    assert.ok(!eko.kupKopalnie(s, 1));
    s.kasa = 99999;
    assert.ok(eko.kupKopalnie(s, 1) && !eko.kupKopalnie(s, 1));
    while (eko.kupUlepszenie(s, 'kilof'));
    assert.equal(eko.nastepne(s, 'kilof'), null);
    assert.ok(eko.mozeKopac(s, DIAMOND));
    // Każdą rudę da się wykopać jakimś kilofem, a ceny rosną.
    for (const b of BLOCKS) if (b && b.wartosc) assert.ok(b.poziom < eko.KILOFY.length);
    for (const l of [eko.KILOFY, eko.PLECAKI, eko.LAMPY]) for (let i = 1; i < l.length; i++) assert.ok(l[i].cena > l[i - 1].cena);
});


// --- Gracz ---
import { Player, raycast } from '../src/player.js';
import { PLAYER_HEIGHT } from '../src/config.js';
{
    const m = generateMine(MINES[0], 5), w = m.world;
    const p = new Player(w); Object.assign(p.pos, m.spawn); p.pos.y += 2;
    const brak = {};
    for (let i = 0; i < 120; i++) p.update(1 / 60, brak);
    assert.ok(p.onGround && Math.abs(p.pos.y - (m.groundY + 1)) < 0.01, 'gracz ląduje na ziemi');
    assert.ok(PLAYER_HEIGHT <= 2, 'gracz mieści się w 2 blokach');
    // Idzie w ścianę z litej skały i zatrzymuje się przed nią.
    p.yaw = Math.PI / 2;   // patrzy w stronę -x
    for (let i = 0; i < 1200; i++) p.update(1 / 60, { forward: true });
    assert.ok(p.pos.x > 1.29 && p.pos.x < 1.32, 'ściana zatrzymuje gracza: ' + p.pos.x);
    // Patrząc w dół widzi trawę pod nogami.
    p.pitch = -Math.PI / 2 + 0.01;
    const hit = raycast(w, p.eye(), p.dir(), 4.5);
    assert.ok(hit && hit.y === m.groundY, 'raycast trafia w ziemię');
    // Drabina: wejście do szybu, zejście na dno i powrót na górę.
    p.pos.x = m.shaft.x + 0.5; p.pos.z = m.shaft.z + 0.5; p.pos.y = m.groundY + 1; p.vel.y = 0;
    for (let i = 0; i < 60 * 40; i++) p.update(1 / 60, { down: true });
    assert.ok(Math.abs(p.pos.y - m.shaft.bottomY) < 0.05, 'zejście drabiną na dno: ' + p.pos.y);
    for (let i = 0; i < 60 * 40; i++) p.update(1 / 60, { jump: true });
    assert.ok(p.pos.y >= m.groundY + 1, 'wyjście drabiną na powierzchnię: ' + p.pos.y);
    ok++; console.log('  ok  gracz: grawitacja, ściany, raycast, drabina');
}

// --- Wersja i pliki aplikacji ---
import { readFileSync, existsSync } from 'node:fs';
import { VERSION } from '../src/config.js';
{
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
    assert.equal(VERSION, pkg.version, 'wersja w src/config.js = package.json');
    assert.equal(lock.version, pkg.version, 'wersja w package-lock.json');
    assert.equal(lock.packages[''].version, pkg.version, 'wersja w package-lock.json (packages)');
    assert.ok(readFileSync('CHANGELOG.md', 'utf8').includes('## ' + pkg.version), 'CHANGELOG ma sekcję tej wersji');
    for (const f of [pkg.main, 'desktop/preload.cjs', 'desktop/icon.png', 'android/app/klucz-testowy.keystore']) assert.ok(existsSync(f), f);
    ok++; console.log('  ok  wersja i pliki aplikacji');
}

console.log(`\nWszystko w porządku (${ok} sprawdzeń).`);

