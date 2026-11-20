// ------------------------------------------------------------
// ZAWAŁY. Krucha skała "wisi", gdy pod nią jest pusto (albo woda).
// Wisząca skała trzyma się, dopóki nikt nie kopie w pobliżu -
// wstrząs od kilofa (2 bloki w każdą stronę) ją zrywa, a spadający
// blok pociąga za sobą sąsiednie wiszące bloki. Czysta logika.
// ------------------------------------------------------------
import { UNSTABLE, isOpen } from './blocks.js';

export const SHAKE_RADIUS = 2;

export function isHanging(world, x, y, z) {
    return world.get(x, y, z) === UNSTABLE && isOpen(world.get(x, y - 1, z));
}

// Które kruche bloki zerwie wykopanie bloku (x, y, z)?
export function shaken(world, x, y, z) {
    const out = [];
    for (let dy = -SHAKE_RADIUS; dy <= SHAKE_RADIUS; dy++) for (let dz = -SHAKE_RADIUS; dz <= SHAKE_RADIUS; dz++) for (let dx = -SHAKE_RADIUS; dx <= SHAKE_RADIUS; dx++)
        if (isHanging(world, x + dx, y + dy, z + dz)) out.push([x + dx, y + dy, z + dz]);
    return out;
}

// Sąsiedzi, których pociągnie blok spadający z (x, y, z): boki i góra.
export function pulled(world, x, y, z) {
    return [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]]
        .map(([dx, dy, dz]) => [x + dx, y + dy, z + dz])
        .filter(([a, b, c]) => world.get(a, b, c) === UNSTABLE && (b > y || isOpen(world.get(a, b - 1, c))));
}

// Na jakiej wysokości wyląduje blok spadający z (x, y, z)?
export function landingY(world, x, y, z) {
    while (y > 0 && isOpen(world.get(x, y - 1, z))) y--;
    return y;
}
