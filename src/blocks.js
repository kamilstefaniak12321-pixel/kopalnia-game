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
    SILVER = 12, GOLD = 13, EMERALD = 14, RUBY = 15, DIAMOND = 16;

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

// Drabina nie zatrzymuje gracza i widać przez nią sąsiednie ściany.
export function isSolid(id) { return id !== AIR && id !== LADDER; }

// Skały, w których mogą siedzieć żyły surowców.
export function isHostRock(id) { return id === STONE || id === SLATE || id === BASALT; }
