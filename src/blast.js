// ------------------------------------------------------------
// DYNAMIT. Wybuch kruszy każdą skałę w kuli o promieniu BLAST_RADIUS,
// ale:
//   - stałe rzeczy (lita skała, szalunki, drabina szybu) zostają,
//   - rudy, których obecny kilof nie ruszy, zostają w ścianie,
//   - rudy, które kilof ruszy, trafiają do plecaka (dopóki jest miejsce;
//     gdy się nie mieszczą, też zostają).
// Czysta logika: zwraca, co zniknie i co zostało zebrane.
// ------------------------------------------------------------
import { AIR, WATER, DYNAMITE, BLOCKS, isThin, ladderWall, LADDER } from './blocks.js';

export const BLAST_RADIUS = 2.6;     // co niszczy
export const BLAST_DANGER = 3.8;     // z jakiej odległości powala gracza
export const BLAST_SHAKE = 6;        // jak daleko zrywa kruche stropy

// mozeKopac(id) i zbierz(id) pochodzą z gospodarki (src/economy.js).
export function blast(world, cx, cy, cz, mozeKopac, zbierz) {
    const usun = [], lancuch = [];
    const R = Math.ceil(BLAST_RADIUS);
    for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy + dz * dz > BLAST_RADIUS * BLAST_RADIUS) continue;
        const x = cx + dx, y = cy + dy, z = cz + dz;
        if (!world.inside(x, y, z)) continue;
        const id = world.get(x, y, z);
        if (id === AIR || id === WATER) continue;
        if (id === DYNAMITE && (dx || dy || dz)) { lancuch.push([x, y, z]); continue; }   // odpali się zaraz sam
        const postawione = isThin(id) || (ladderWall(id) >= 0 && id !== LADDER);
        if (BLOCKS[id].staly && !postawione) continue;
        if (BLOCKS[id].wartosc && !(mozeKopac(id) && zbierz(id))) continue;
        usun.push([x, y, z, AIR]);
    }
    return { usun, lancuch };
}
