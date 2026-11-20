// Sprawdzenia logiki gry (bez przeglądarki): node tools/sprawdz.mjs
import assert from 'node:assert/strict';
import { MINES } from '../src/mines.js';
import { generateMine } from '../src/mine.js';
import { meshChunk } from '../src/mesher.js';
import { BLOCKS, M, AIR, LADDER, COAL, DIAMOND, STONE, SLATE, isSolid } from '../src/blocks.js';
import { MINERALY, SKALY, RODZAJE } from '../src/minerals.js';
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
            for (const r of def.rudy) assert.ok(licz[r[0]] > 15, 'jest ' + BLOCKS[r[0]].nazwa + ': ' + licz[r[0]]);
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
        if (['drabina', 'pochodnia', 'stempel', 'dynamit'].includes(n)) assert.ok(pelne > 300 && pelne < 3000);
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
    // Skup odkłada 4 węgle na lampę naftową (jej przepis), resztę sprzedaje.
    assert.equal(eko.wartoscUrobku(s), 80);
    assert.equal(eko.sprzedajWszystko(s), 80);
    assert.equal(s.kasa, 80); assert.equal(eko.ileWPlecaku(s), 0);
    assert.deepEqual(s.sklad, { [COAL]: 4 });
    const t0 = eko.czasKopania(s, STONE);
    assert.ok(!eko.kupUlepszenie(s, 'kilof'), 'kamienny kilof wymaga krzemienia');
    s.przedmioty[M.krzemien] = 5;
    assert.deepEqual(eko.skladniki(s, eko.KILOFY[1].surowce), [[M.krzemien, 4, 5]]);
    assert.ok(eko.kupUlepszenie(s, 'kilof')); assert.equal(s.kasa, 20);
    assert.equal(s.przedmioty[M.krzemien], 1, 'przepis zużył 4 krzemienie');
    assert.ok(eko.czasKopania(s, STONE) < t0);
    assert.ok(!eko.kupUlepszenie(s, 'plecak'));               // za mało monet
    assert.ok(!eko.kupKopalnie(s, 1));
    s.kasa = 99999;
    assert.ok(eko.kupKopalnie(s, 1) && !eko.kupKopalnie(s, 1));
    // Lampa: węgiel bierze ze składu.
    assert.ok(eko.kupUlepszenie(s, 'lampa')); assert.deepEqual(s.sklad, {});
    // Z pełnym składem da się zrobić wszystkie kilofy i lampy po kolei.
    for (const m of MINERALY) s.sklad[m.id] = 50;
    while (eko.kupUlepszenie(s, 'kilof'));
    while (eko.kupUlepszenie(s, 'lampa'));
    assert.equal(eko.nastepne(s, 'lampa'), null);
    assert.equal(s.sklad[M.zelazo], 50 - 12 - 16, 'żelazo zużyte na żelazny i stalowy kilof');
    // Dynamit z surowców, bez monet.
    const d0 = s.dynamit, k0 = s.kasa;
    assert.ok(eko.wytworzZapas(s, 'dynamit') && s.dynamit === d0 + 2 && s.kasa === k0 && !eko.wytworzZapas(s, 'drabiny'));
    // Sprzedaż składu; gdy nie ma już czego ulepszać, nic nie jest odkładane.
    assert.deepEqual(eko.rezerwa(s), {});
    assert.ok(eko.sprzedajSklad(s) > 0); assert.deepEqual(s.sklad, {});
    assert.equal(eko.nastepne(s, 'kilof'), null);
    assert.ok(eko.mozeKopac(s, DIAMOND));
    // Każdą rudę da się wykopać jakimś kilofem, a ceny rosną.
    for (const b of BLOCKS) if (b && b.wartosc) assert.ok(b.poziom < eko.KILOFY.length);
    for (const l of [eko.KILOFY, eko.PLECAKI, eko.LAMPY]) for (let i = 1; i < l.length; i++) assert.ok(l[i].cena > l[i - 1].cena);
    // Przepisy: składniki istnieją, a każdy da się wykopać kilofem o stopień
    // słabszym niż ten, który z nich powstaje (inaczej gra by się zablokowała).
    eko.KILOFY.forEach((k, i) => { for (const klucz of Object.keys(k.surowce || {})) {
        assert.ok(M[klucz], 'surowiec istnieje: ' + klucz);
        assert.ok(BLOCKS[M[klucz]].poziom <= i - 1, `${k.nazwa}: ${klucz} da się wykopać poprzednim kilofem`);
    } });
    for (const p of [...eko.LAMPY.map(l => l.surowce), ...Object.values(eko.ZAPASY).map(z => z.przepis)])
        for (const klucz of Object.keys(p || {})) assert.ok(M[klucz], 'surowiec istnieje: ' + klucz);
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

// --- Drabiny, pochodnie, światło, zapis zmian ---
import { computeLight, TORCH_LIGHT } from '../src/light.js';
import { applyChanges } from '../src/mine.js';
import { TORCH, LADDER_E, PLACED_LADDERS, WALLS, ladderWall, isLadder } from '../src/blocks.js';
{
    const m = generateMine(MINES[0], 9), w = m.world;
    assert.equal(computeLight(w), 0);
    assert.ok(w.light.every(l => l === 0), 'bez pochodni nie ma światła');
    // Zamknięta komora 3x1x1 wykopana w litej skale: światło słabnie o 1 na blok i nie wychodzi przez ścianę.
    const y = 3; let x0 = 0, z0 = 0;
    szukaj: for (let z = 5; z < 60; z++) for (let x = 5; x < 55; x++) {
        let lite = true;
        for (let dx = -2; dx <= 5 && lite; dx++) for (let dz = -2; dz <= 2 && lite; dz++) for (let dy = -2; dy <= 2; dy++) if (!w.solid(x + dx, y + dy, z + dz)) { lite = false; break; }
        if (lite) { x0 = x; z0 = z; break szukaj; }
    }
    assert.ok(x0, 'jest kawałek litej skały do testu');
    const zmiany = {};
    for (let i = 0; i < 3; i++) zmiany[w.index(x0 + i, y, z0)] = i === 0 ? TORCH : AIR;
    applyChanges(w, zmiany);
    assert.equal(w.get(x0, y, z0), TORCH);
    assert.equal(computeLight(w), 1);
    assert.deepEqual([0, 1, 2].map(i => w.getLight(x0 + i, y, z0)), [TORCH_LIGHT, TORCH_LIGHT - 1, TORCH_LIGHT - 2]);
    assert.equal(w.getLight(x0 + 3, y, z0), 0, 'światło nie wchodzi w skałę');
    assert.equal(w.getLight(x0, y + 2, z0), 0, 'światło nie przechodzi przez strop');
    // Mesher oddaje światło dla każdego wierzchołka; przy pochodni jest jasno.
    const g = meshChunk(w, Math.floor(x0 / CHUNK), 0, Math.floor(z0 / CHUNK), TILE_INDEX);
    assert.equal(g.lit.length, g.pos.length / 3);
    assert.ok(Math.max(...g.lit) > 0.8 && g.lit.every(l => l >= 0));
    // Postawiona drabina: nie blokuje, da się po niej wejść.
    assert.ok(isLadder(LADDER_E) && ladderWall(LADDER_E) === 1 && !isSolid(LADDER_E) && !isSolid(TORCH));
    assert.equal(PLACED_LADDERS.length, WALLS.length);
    const sx = m.spawn.x | 0, sz = m.spawn.z | 0, gy = m.groundY;
    for (let i = 0; i < 4; i++) { w.set(sx, gy - i, sz, i === 3 ? AIR : LADDER_E); w.set(sx, gy - i, sz, LADDER_E); }
    const p = new Player(w); p.pos.x = sx + 0.5; p.pos.z = sz + 0.5; p.pos.y = gy + 1;
    for (let i = 0; i < 300; i++) p.update(1 / 60, { down: true });
    assert.ok(Math.abs(p.pos.y - (gy - 3)) < 0.05, 'zejście po postawionej drabinie: ' + p.pos.y);
    for (let i = 0; i < 300; i++) p.update(1 / 60, { jump: true });
    assert.ok(p.pos.y >= gy + 0.9, 'wejście po postawionej drabinie: ' + p.pos.y);
    // Raycast podaje ścianę, w którą trafił.
    p.pos.y = gy + 1; p.pos.x = sx + 2.5; p.pitch = -1.5;
    const hit = raycast(w, p.eye(), p.dir(), 4.5);
    assert.deepEqual([hit.nx, hit.ny, hit.nz], [0, 1, 0]);
    // Zapasy.
    const s = eko.nowyStan(); s.kasa = 20;
    assert.ok(eko.kupZapas(s, 'drabiny') && s.drabiny === 13 && s.kasa === 5 && !eko.kupZapas(s, 'pochodnie'));
    ok++; console.log('  ok  drabiny, pochodnie, światło, zapis zmian');
}

// --- Zawały, woda, lampa ---
import { shaken, pulled, landingY, isHanging } from '../src/cavein.js';
import { findWater, settleWater } from '../src/water.js';
import { UNSTABLE, WATER, RUBBLE, isOpen } from '../src/blocks.js';
import { World } from '../src/mine.js';
{
    // Mały świat z litego kamienia do prób.
    const w = new World(12, 12, 12); w.data.fill(STONE);
    // Krucha skała nad pustką wisi; podparta - nie.
    w.set(5, 5, 5, UNSTABLE); w.set(6, 5, 5, UNSTABLE); w.set(5, 6, 5, UNSTABLE); w.set(9, 5, 5, UNSTABLE);
    assert.ok(!isHanging(w, 5, 5, 5));
    for (let y = 2; y <= 4; y++) { w.set(5, y, 5, AIR); w.set(6, y, 5, AIR); }
    assert.ok(isHanging(w, 5, 5, 5) && isHanging(w, 6, 5, 5) && !isHanging(w, 5, 6, 5) && !isHanging(w, 9, 5, 5));
    assert.equal(shaken(w, 5, 3, 5).length, 2, 'kopanie 2 bloki niżej zrywa wiszące bloki');
    assert.equal(shaken(w, 5, 2, 9).length, 0, 'kopanie daleko niczego nie zrywa');
    assert.deepEqual(pulled(w, 5, 5, 5).sort(), [[5, 6, 5], [6, 5, 5]], 'spadający blok ciągnie bok i górę');
    assert.equal(landingY(w, 5, 5, 5), 2);

    // Woda: zbiornik 2x2x2 (8 pól) nad chodnikiem; po przebiciu spływa na dno.
    const v = new World(12, 12, 12); v.data.fill(STONE);
    for (let x = 2; x < 4; x++) for (let y = 6; y < 8; y++) for (let z = 2; z < 4; z++) v.set(x, y, z, WATER);
    for (let x = 4; x < 10; x++) for (let y = 2; y < 4; y++) v.set(x, y, 2, AIR);      // chodnik 6x2x1 = 12 pól, niżej
    assert.deepEqual(settleWater(v, v.index(2, 6, 2)), { remove: [], add: [] }, 'zamknięty zbiornik stoi');
    assert.equal(findWater(v, 6, 2, 2), -1, 'chodnik nie jest połączony z wodą');
    for (let y = 2; y < 7; y++) v.set(4, y, 2, AIR);                                    // przebicie: pion przy zbiorniku
    const start = findWater(v, 4, 6, 2);
    assert.ok(start >= 0);
    const plan = settleWater(v, start);
    assert.equal(plan.remove.length, plan.add.length);
    for (const i of plan.remove) v.data[i] = AIR;
    for (const i of plan.add) v.data[i] = WATER;
    let ile = 0, najwyzej = 0;
    for (let i = 0; i < v.data.length; i++) if (v.data[i] === WATER) { ile++; najwyzej = Math.max(najwyzej, Math.floor(i / 144)); }
    assert.equal(ile, 8, 'wody jest tyle samo');
    assert.ok(najwyzej <= 3, 'woda spłynęła do chodnika: ' + najwyzej);
    for (let x = 4; x < 10; x++) assert.equal(v.get(x, 2, 2), WATER, 'dno chodnika zalane');
    assert.deepEqual(settleWater(v, findWater(v, 4, 2, 2)), { remove: [], add: [] }, 'po przelaniu woda stoi');

    // W wygenerowanych kopalniach: zbiorniki są szczelne i spokojne, krucha skała jest.
    for (const def of MINES) {
        const m = generateMine(def, 21), g = m.world;
        let krucha = 0, woda = 0;
        for (const b of g.data) { if (b === UNSTABLE) krucha++; if (b === WATER) woda++; }
        assert.ok(krucha > 20 && woda > 50, def.nazwa);
        if (!def.charakter) assert.ok(m.zbiorniki.length >= 2, def.nazwa);
        assert.ok(m.poziomy.length >= 3 && m.poziomy.every(y => g.get(m.shaft.x, y, m.shaft.z) === LADDER), 'poziomy windy są na drabinie szybu');
        for (const [x, y, z] of m.zbiorniki) {
            assert.equal(g.get(x, y, z), WATER);
            assert.deepEqual(settleWater(g, g.index(x, y, z)), { remove: [], add: [] }, 'zbiornik stoi: ' + def.nazwa);
        }
    }
    // Gracz w wodzie: tonie powoli, płynie w górę.
    const b = new World(8, 12, 8); b.data.fill(STONE);
    for (let y = 1; y < 9; y++) b.set(4, y, 4, WATER);
    const p = new Player(b); p.pos.x = 4.5; p.pos.z = 4.5; p.pos.y = 6;
    for (let i = 0; i < 30; i++) p.update(1 / 60, {});
    assert.ok(p.inWater && p.vel.y < 0 && p.vel.y >= -2.2, 'powolne opadanie: ' + p.vel.y);
    for (let i = 0; i < 60; i++) p.update(1 / 60, { jump: true });
    assert.ok(p.pos.y > 6.5, 'płynięcie w górę');
    // Lampa i strata urobku.
    const s = eko.nowyStan();
    assert.equal(eko.poziomPaliwa(s), 1);
    s.paliwo = 60; assert.equal(eko.poziomPaliwa(s), 0.25);
    s.kasa = 500; s.przedmioty = { [COAL]: 4 }; eko.kupUlepszenie(s, 'lampa'); assert.equal(eko.poziomPaliwa(s), 1, 'nowa lampa jest pełna');
    s.paliwo = 0; eko.napelnijLampe(s); assert.equal(s.paliwo, eko.LAMPY[1].paliwo);
    s.przedmioty = { [COAL]: 7, [DIAMOND]: 1 };
    assert.equal(eko.zgubPoloweUrobku(s), 3);
    assert.deepEqual(s.przedmioty, { [COAL]: 4, [DIAMOND]: 1 });
    assert.ok(isOpen(WATER) && isOpen(AIR) && !isOpen(RUBBLE) && !isSolid(WATER));
    ok++; console.log('  ok  zawały, woda, lampa, omdlenie');
}

// --- Stemple, dynamit, wózek, winda, charakter kopalni ---
import { blast, BLAST_RADIUS } from '../src/blast.js';
import { PROP, DYNAMITE, BEDROCK, GOLD, isThin } from '../src/blocks.js';
import { charakter } from '../src/mines.js';
{
    // Stempel pod wiszącą kruchą skałą: przestaje wisieć.
    const w = new World(12, 12, 12); w.data.fill(STONE);
    w.set(5, 5, 5, UNSTABLE); w.set(5, 4, 5, AIR); w.set(5, 3, 5, AIR);
    assert.ok(isHanging(w, 5, 5, 5));
    w.set(5, 3, 5, PROP); assert.ok(isHanging(w, 5, 5, 5), 'stempel za niski - strop dalej wisi');
    w.set(5, 4, 5, PROP); assert.ok(!isHanging(w, 5, 5, 5) && shaken(w, 5, 4, 6).length === 0, 'podparty strop się trzyma');
    assert.ok(isThin(PROP) && isThin(DYNAMITE) && !isSolid(PROP) && !isOpen(PROP));

    // Wybuch: kruszy skałę (także za twardą na kilof), zostawia litą skałę
    // i za twarde rudy, zbiera rudy na miarę kilofa.
    const b = new World(16, 16, 16); b.data.fill(SLATE);
    b.set(8, 8, 8, DYNAMITE); b.set(9, 8, 8, COAL); b.set(8, 9, 8, GOLD); b.set(7, 8, 8, BEDROCK); b.set(8, 8, 10, DYNAMITE); b.set(8, 8, 12, COAL);
    const s = eko.nowyStan();
    const plan = blast(b, 8, 8, 8, id => eko.mozeKopac(s, id), id => eko.dodajUrobek(s, id));
    for (const [x, y, z, id] of plan.usun) b.set(x, y, z, id);
    assert.equal(b.get(8, 8, 8), AIR); assert.equal(b.get(8, 7, 8), AIR, 'łupek skruszony mimo drewnianego kilofa');
    assert.equal(b.get(9, 8, 8), AIR); assert.deepEqual(s.przedmioty, { [COAL]: 1 }, 'węgiel zebrany');
    assert.equal(b.get(8, 9, 8), GOLD, 'złoto za twarde - zostaje'); assert.equal(b.get(7, 8, 8), BEDROCK);
    assert.equal(b.get(8, 8, 12), COAL, 'poza zasięgiem'); assert.ok(BLAST_RADIUS < 4);
    assert.deepEqual(plan.lancuch, [[8, 8, 10]], 'drugi dynamit odpali się łańcuchowo');
    assert.equal(b.get(8, 8, 10), DYNAMITE);

    // Wózek i urządzenia.
    const g = eko.nowyStan(); g.przedmioty = { [COAL]: 6 }; g.kasa = 500;
    assert.ok(eko.kupUrzadzenie(g, 'wozek') && !eko.kupUrzadzenie(g, 'wozek') && !eko.kupUrzadzenie(g, 'winda'));
    assert.equal(eko.wyslijUrobek(g), 6); assert.equal(eko.ileWPlecaku(g), 0);
    g.przedmioty = { [COAL]: 4 }; assert.equal(eko.zgubPoloweUrobku(g), 2);
    assert.equal(eko.ileSurowca(g, COAL), 8, 'wózek chroni wywieziony urobek');
    assert.equal(eko.sprzedajWszystko(g), 4 * 5); assert.deepEqual(g.sklad, { [COAL]: 4 }, 'węgiel na lampę zostaje w składzie');
    assert.ok(eko.kupZapas(g, 'stemple') && g.stemple === 7 && eko.kupZapas(g, 'dynamit') && g.dynamit === 3);

    // Charakter kopalni: Mokra ma zalane dno, Kruchy Uskok dużo kruchej skały.
    const licz = (def, blok) => { let n = 0; for (const v of generateMine(def, 4).world.data) if (v === blok) n++; return n; };
    const [stara, , , mokra, kruchy] = MINES;
    assert.ok(charakter(mokra).zalane > 0 && licz(mokra, WATER) > 4 * licz(stara, WATER));
    assert.ok(licz(kruchy, UNSTABLE) > 3 * licz(MINES[1], UNSTABLE));
    const m = generateMine(mokra, 4);
    assert.equal(m.world.get(m.shaft.x + 1, m.shaft.bottomY, m.shaft.z + 1), WATER, 'dno szybu Mokrej Sztolni pod wodą');
    assert.deepEqual(settleWater(m.world, m.world.index(m.shaft.x + 1, m.shaft.bottomY, m.shaft.z + 1)), { remove: [], add: [] }, 'zalane dno stoi spokojnie');
    assert.equal(MINES.slice(0, 3).map(d => d.nazwa).join(), 'Stara Sztolnia,Srebrny Szyb,Głębia Kryształów', 'stare numery kopalni bez zmian');
    ok++; console.log('  ok  stemple, dynamit, wózek, winda, charakter kopalni');
}

// --- Surowce i minerały ---
{
    assert.ok(MINERALY.length >= 30, 'bogata lista surowców');
    const ids = [...MINERALY, ...SKALY].map(r => r.id), klucze = [...MINERALY, ...SKALY].map(r => r.klucz);
    assert.equal(new Set(ids).size, ids.length, 'numery bloków się nie powtarzają');
    assert.equal(new Set(klucze).size, klucze.length, 'klucze się nie powtarzają');
    assert.ok(TILE_NAMES.length <= 64, 'tekstury mieszczą się w atlasie 8x8');
    assert.equal(new Set(TILE_NAMES).size, TILE_NAMES.length);
    assert.deepEqual([9, 10, 11, 12, 13, 14, 15, 16], MINERALY.slice(0, 8).map(r => r.id), 'stare surowce mają stare numery');
    for (const r of MINERALY) {
        assert.ok(r.rodzaj in RODZAJE && r.wartosc > 0 && r.poziom >= 0 && r.poziom < eko.KILOFY.length, r.klucz);
        assert.ok(TILE_NAMES.includes(r.skala) && BLOCKS[r.id].nazwa === r.nazwa, r.klucz);
        assert.ok(MINES.some(m => m.rudy.some(x => x[0] === r.id)), r.nazwa + ' występuje w jakiejś kopalni');
        // Tekstura surowca różni się od gołej skały (surowiec naprawdę widać).
        const a = makeTile(r.klucz), b = makeTile(r.skala); let inne = 0;
        for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) inne++;
        assert.ok(inne > 120 && inne < 3000, `${r.klucz}: widać w skale (${inne} pikseli)`);
    }
    // Droższe surowce wymagają co najmniej tak dobrego kilofa jak tańsze z tego samego rodzaju... ogólnie: wartość rośnie z kilofem.
    for (let p = 1; p < eko.KILOFY.length; p++) {
        const min = Math.min(...MINERALY.filter(r => r.poziom === p).map(r => r.wartosc)), maxNizej = Math.max(...MINERALY.filter(r => r.poziom === p - 1).map(r => r.wartosc));
        assert.ok(min >= maxNizej * 0.4, 'wartości rosną z poziomem kilofa: ' + p);
    }
    // Każda kopalnia ma coś własnego, czego nie ma w żadnej innej.
    for (const m of MINES) assert.ok(m.rudy.some(x => MINES.every(o => o === m || !o.rudy.some(y => y[0] === x[0]))), m.nazwa + ' ma własny surowiec');
    // W pierwszej kopalni drewnianym kilofem da się zdobyć krzemień na kamienny kilof.
    assert.ok(MINES[0].rudy.some(x => x[0] === M.krzemien) && BLOCKS[M.krzemien].poziom === 0);
    const s = eko.nowyStan(); eko.dodajUrobek(s, M.sol);
    assert.deepEqual(s.odkryte, { [M.sol]: true }, 'wykopany surowiec trafia do atlasu');
    ok++; console.log('  ok  surowce i minerały: ' + MINERALY.length + ' surowców, ' + SKALY.length + ' nowe skały');
}

// --- Zlecenia ---
import { mulberry32 } from '../src/rng.js';
{
    const rnd = mulberry32(5), s = eko.nowyStan();
    eko.uzupelnijZlecenia(s, rnd);
    assert.equal(s.zlecenia.length, eko.MAX_ZLECEN);
    assert.equal(new Set(s.zlecenia.map(z => z.id)).size, 3, 'zlecenia na różne surowce');
    for (const z of s.zlecenia) {
        assert.ok(MINES[0].rudy.some(r => r[0] === z.id), 'surowiec z kupionej kopalni: ' + BLOCKS[z.id].nazwa);
        assert.ok(BLOCKS[z.id].poziom <= s.kilof + 1 && z.ile >= 3 && z.ile <= 16);
        assert.ok(z.nagroda >= 2 * z.ile * BLOCKS[z.id].wartosc, 'nagroda co najmniej podwójna');
    }
    // Wiele losowań: nigdy nic spoza zasięgu, a łatwe zlecenia przeważają.
    let ambitne = 0;
    for (let i = 0; i < 300; i++) { const t = eko.nowyStan(); const z = eko.noweZlecenie(t, rnd); assert.ok(BLOCKS[z.id].poziom <= 1); if (BLOCKS[z.id].poziom === 1) ambitne++; }
    assert.ok(ambitne > 30 && ambitne < 130, 'ambitnych około jednej czwartej: ' + ambitne);
    for (let i = 0; i < 50; i++) { const t = eko.nowyStan(); eko.uzupelnijZlecenia(t, rnd); assert.ok(t.zlecenia.filter(z => BLOCKS[z.id].poziom > 0).length <= 1, 'najwyżej jedno ambitne zlecenie'); }
    // Oddanie: za mało - nic; dość - surowiec znika (najpierw ze składu), nagroda wpada, pojawia się nowe.
    const z = s.zlecenia[0], ids = s.zlecenia.map(x => x.id);
    s.przedmioty[z.id] = z.ile - 1;
    assert.ok(!eko.mozeOddac(s, 0)); assert.equal(eko.oddajZlecenie(s, 0, rnd), 0);
    s.sklad[z.id] = 3;
    // Skup nie sprzedaje surowca na zlecenie.
    // (ten sam surowiec może być też potrzebny na kilof albo lampę - wtedy odkłada więcej)
    assert.ok(eko.odlozone(s)[z.id] >= z.ile, 'surowiec zlecenia jest odkładany');
    eko.sprzedajWszystko(s);
    const mam = eko.ileSurowca(s, z.id), kasa = s.kasa;
    assert.ok(mam >= z.ile && !s.przedmioty[z.id], 'odłożone leży w składzie');
    assert.equal(eko.oddajZlecenie(s, 0, rnd), z.nagroda);
    assert.equal(s.kasa, kasa + z.nagroda); assert.equal(eko.ileSurowca(s, z.id), mam - z.ile);
    assert.equal(s.wykonaneZlecenia, 1); assert.equal(s.zlecenia.length, 3);
    assert.equal(new Set(s.zlecenia.map(x => x.id)).size, 3);
    // Wymiana: kosztuje, daje inny surowiec, bez monet się nie da.
    const przed = s.zlecenia[1].id, k2 = s.kasa;
    assert.ok(eko.wymienZlecenie(s, 1, rnd)); assert.equal(s.kasa, k2 - eko.KOSZT_WYMIANY);
    assert.notEqual(s.zlecenia[1].id, przed); assert.equal(new Set(s.zlecenia.map(x => x.id)).size, 3);
    s.kasa = 0; assert.ok(!eko.wymienZlecenie(s, 1, rnd));
    // Z lepszym kilofem i nowymi kopalniami pojawiają się nowe surowce.
    const b = eko.nowyStan(); b.kilof = 4; b.kopalnie = [0, 1, 2, 3, 4];
    const rozne = new Set(); for (let i = 0; i < 400; i++) rozne.add(eko.noweZlecenie(b, rnd).id);
    assert.ok(rozne.size >= 25, 'zlecenia korzystają z całej listy surowców: ' + rozne.size);
    ok++; console.log('  ok  zlecenia: losowanie, oddawanie, wymiana, odkładanie surowców');
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

