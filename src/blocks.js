import { MINERALY, SKALY, PRODUKTY } from './minerals.js';

// ------------------------------------------------------------
// BLOKI. Każdy blok ma:
//   nazwa     - nazwa dla gracza
//   twardosc  - ile sekund kopie się go drewnianym kilofem
//   poziom    - jaki najsłabszy kilof go ruszy (0 = drewniany)
//   wartosc   - ile monet za sztukę (0 = nic nie wypada)
//   staly     - nie da się go wykopać (szalunki, drabina, lita skała)
//   tekstury  - [góra, bok, dół] - nazwy z src/textures.js
// ------------------------------------------------------------

export const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, SLATE = 4, BASALT = 5,
    BEDROCK = 6, PLANKS = 7, LADDER = 8, COAL = 9, COPPER = 10, IRON = 11,
    SILVER = 12, GOLD = 13, EMERALD = 14, RUBY = 15, DIAMOND = 16,
    // Drabiny stawiane przez gracza: przy ścianie -x, +x, -z, +z.
    LADDER_W = 17, LADDER_E = 18, LADDER_N = 19, LADDER_S = 20, TORCH = 21,
    UNSTABLE = 22, RUBBLE = 23, WATER = 24, PROP = 25, DYNAMITE = 26, MUSHROOM = 54,
    FOSSIL = 55, GEODE = 56, CHEST = 57;

function blok(nazwa, twardosc, poziom, wartosc, tekstury, extra = {}) {
    const t = typeof tekstury === 'string' ? [tekstury, tekstury, tekstury] : tekstury;
    return { nazwa, twardosc, poziom, wartosc, tekstury: t, staly: false, ...extra };
}

export const BLOCKS = [];
BLOCKS[AIR] = null;
BLOCKS[GRASS] = blok('Trawa', 0.5, 0, 0, ['trawa_gora', 'trawa_bok', 'ziemia']);
BLOCKS[DIRT] = blok('Ziemia', 0.5, 0, 0, 'ziemia');
BLOCKS[STONE] = blok('Kamień', 1.2, 0, 0, 'kamien');
BLOCKS[SLATE] = blok('Łupek', 2.6, 2, 0, 'lupek');
BLOCKS[BASALT] = blok('Bazalt', 4.5, 4, 0, 'bazalt');
BLOCKS[BEDROCK] = blok('Lita skała', 1, 99, 0, 'lita_skala', { staly: true });
BLOCKS[PLANKS] = blok('Szalunek', 1, 99, 0, 'deski', { staly: true });
BLOCKS[LADDER] = blok('Drabina', 1, 99, 0, 'drabina', { staly: true });
// Surowce i skały z tabeli (src/minerals.js). M.cyna, M.granit itd.
// to numery bloków po kluczu.
export const M = {};
for (const r of MINERALY) { BLOCKS[r.id] = blok(r.nazwa, r.twardosc, r.poziom, r.wartosc, r.klucz, { rodzaj: r.rodzaj }); M[r.klucz] = r.id; }
for (const r of SKALY) { BLOCKS[r.id] = blok(r.nazwa, r.twardosc, r.poziom, 0, r.klucz); M[r.klucz] = r.id; }
for (const id of [LADDER_W, LADDER_E, LADDER_N, LADDER_S]) BLOCKS[id] = blok('Drabina', 1, 99, 0, 'drabina', { staly: true });
BLOCKS[TORCH] = blok('Pochodnia', 1, 99, 0, 'pochodnia', { staly: true });

// Krucha skała spada, gdy nic jej nie podpiera i ktoś kopie w pobliżu
// (src/cavein.js); po upadku zostaje z niej rumosz. Woda: src/water.js.
BLOCKS[UNSTABLE] = blok('Krucha skała', 0.9, 0, 0, 'krucha');
BLOCKS[RUBBLE] = blok('Rumosz', 0.6, 0, 0, 'rumosz');
BLOCKS[WATER] = blok('Woda', 1, 99, 0, 'kamien', { staly: true });

// Stempel podpiera kruchy strop (pole pod skałą nie jest już puste).
BLOCKS[PROP] = blok('Stempel', 1, 99, 0, 'stempel', { staly: true });
BLOCKS[DYNAMITE] = blok('Dynamit', 1, 99, 0, 'dynamit', { staly: true });
// Cienkie rzeczy stojące w polu: gracz przez nie przechodzi.
export function isThin(id) { return id === TORCH || id === PROP || id === DYNAMITE || id === MUSHROOM; }

// Świecący grzyb rośnie w chodnikach i komorach - daje trochę światła.
BLOCKS[MUSHROOM] = blok('Świecący grzyb', 1, 99, 0, 'grzyb', { staly: true });
// Stopy z pieca: przedmioty (nie stoją w kopalni). Poziom = najlepszy
// kilof potrzebny do zdobycia składników.
for (const p of PRODUKTY) {
    const poziom = Math.max(...Object.keys(p.z).map(k => BLOCKS[M[k]].poziom));
    BLOCKS[p.id] = blok(p.nazwa, 1, poziom, p.wartosc, p.klucz, { staly: true, produkt: true });
    M[p.klucz] = p.id;
}

// Znaleziska (src/finds.js). "cenny" - dynamit tego nie rusza, trzeba
// wykopać kilofem. Geoda trafia do plecaka i rozbija się ją w skupie.
BLOCKS[FOSSIL] = blok('Skamieniałość', 1.6, 0, 0, 'skamielina', { cenny: true });
BLOCKS[GEODE] = blok('Geoda', 2.0, 0, 15, 'geoda', { cenny: true });
BLOCKS[CHEST] = blok('Stara skrzynka', 1.0, 0, 0, ['skrzynka_gora', 'skrzynka', 'skrzynka_gora'], { cenny: true });

// Kierunek ściany, o którą opiera się drabina: [dx, dz].
export const WALLS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
export const PLACED_LADDERS = [LADDER_W, LADDER_E, LADDER_N, LADDER_S];
// Numer ściany drabiny (0-3) albo -1, gdy to nie drabina.
export function ladderWall(id) { return id === LADDER ? 0 : id >= LADDER_W && id <= LADDER_S ? id - LADDER_W : -1; }
export function isLadder(id) { return ladderWall(id) >= 0; }

// Drabiny i pochodnie nie zatrzymują gracza i widać przez nie ściany.
export function isSolid(id) { return id !== AIR && id !== WATER && !isThin(id) && ladderWall(id) < 0; }
// Pola, przez które coś może spaść albo przepłynąć.
export function isOpen(id) { return id === AIR || id === WATER; }

// Skały, w których mogą siedzieć żyły surowców.
const HOST = new Set([STONE, SLATE, BASALT, ...SKALY.map(r => r.id)]);
export function isHostRock(id) { return HOST.has(id); }
