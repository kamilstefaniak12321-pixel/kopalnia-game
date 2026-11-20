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
    UNSTABLE = 22, RUBBLE = 23, WATER = 24, PROP = 25, DYNAMITE = 26;

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
BLOCKS[COAL] = blok('Węgiel', 1.5, 0, 5, 'wegiel');
BLOCKS[COPPER] = blok('Miedź', 2.0, 1, 12, 'miedz');
BLOCKS[IRON] = blok('Żelazo', 2.6, 2, 25, 'zelazo');
BLOCKS[SILVER] = blok('Srebro', 3.4, 3, 60, 'srebro');
BLOCKS[GOLD] = blok('Złoto', 3.8, 3, 120, 'zloto');
BLOCKS[EMERALD] = blok('Szmaragd', 5.0, 4, 250, 'szmaragd');
BLOCKS[RUBY] = blok('Rubin', 5.5, 4, 400, 'rubin');
BLOCKS[DIAMOND] = blok('Diament', 7.0, 5, 800, 'diament');
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
export function isThin(id) { return id === TORCH || id === PROP || id === DYNAMITE; }

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
export function isHostRock(id) { return id === STONE || id === SLATE || id === BASALT; }
