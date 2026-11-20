// ------------------------------------------------------------
// WODA. Woda nie płynie bez przerwy - gdy ktoś przebije się do
// zbiornika, liczymy od razu, gdzie ta sama ilość wody się ułoży:
// zbieramy zbiornik i wszystkie puste pola, do których woda może
// dopłynąć bez wspinania się ponad swój poziom, i wypełniamy je
// od najniższych. Gra potem przelewa wodę stopniowo (src/main.js).
// Czysta logika.
// ------------------------------------------------------------
import { AIR, WATER, isSolid } from './blocks.js';

// Najbliższa woda połączona pustymi polami z (x, y, z) - albo -1.
export function findWater(world, x, y, z, limit = 300) {
    const { w, d, h, data } = world, layer = w * d;
    if (!world.inside(x, y, z)) return -1;
    const start = world.index(x, y, z), seen = new Set([start]), queue = [start];
    for (let head = 0; head < queue.length && queue.length < limit; head++) {
        const i = queue[head];
        if (data[i] === WATER) return i;
        const cx = i % w, cz = Math.floor(i / w) % d, cy = Math.floor(i / layer);
        for (const j of [cx > 0 ? i - 1 : -1, cx < w - 1 ? i + 1 : -1, cz > 0 ? i - w : -1, cz < d - 1 ? i + w : -1, cy > 0 ? i - layer : -1, cy < h - 1 ? i + layer : -1]) {
            if (j < 0 || seen.has(j) || isSolid(data[j])) continue;
            seen.add(j); queue.push(j);
        }
    }
    return -1;
}

// Zwraca { remove, add }: z których pól woda odpłynie i do których
// dopłynie (tyle samo pól). Puste listy = woda już stoi spokojnie.
export function settleWater(world, start, limit = 30000) {
    const { w, d, h, data } = world, layer = w * d;
    if (data[start] !== WATER) return null;
    const neighbours = i => {
        const cx = i % w, cz = Math.floor(i / w) % d, cy = Math.floor(i / layer);
        return [cx > 0 ? i - 1 : -1, cx < w - 1 ? i + 1 : -1, cz > 0 ? i - w : -1, cz < d - 1 ? i + w : -1, cy > 0 ? i - layer : -1, cy < h - 1 ? i + layer : -1];
    };
    // 1. Zbiornik: woda połączona z polem startowym i jej najwyższy poziom.
    const dist = new Map([[start, 0]]), queue = [start];
    let yMax = 0;
    for (let head = 0; head < queue.length; head++) {
        const i = queue[head];
        yMax = Math.max(yMax, Math.floor(i / layer));
        for (const j of neighbours(i)) if (j >= 0 && data[j] === WATER && !dist.has(j)) { dist.set(j, 0); queue.push(j); }
    }
    // 2. Dokąd woda może dopłynąć, nie wspinając się ponad swój poziom.
    for (let head = 0; head < queue.length && queue.length < limit; head++) {
        const i = queue[head];
        for (const j of neighbours(i)) {
            if (j < 0 || dist.has(j) || isSolid(data[j]) || Math.floor(j / layer) > yMax) continue;
            dist.set(j, dist.get(i) + 1); queue.push(j);
        }
    }
    // 3. Tę samą ilość wody układamy od najniższych pól (przy remisie
    //    woda zostaje tam, gdzie jest, potem najbliższe pola).
    const pola = queue.filter(i => data[i] === AIR || data[i] === WATER);
    const ile = pola.reduce((n, i) => n + (data[i] === WATER ? 1 : 0), 0);
    pola.sort((a, b) => Math.floor(a / layer) - Math.floor(b / layer)
        || (data[b] === WATER) - (data[a] === WATER) || dist.get(a) - dist.get(b));
    const cel = new Set(pola.slice(0, ile));
    const remove = pola.filter(i => data[i] === WATER && !cel.has(i)).sort((a, b) => Math.floor(b / layer) - Math.floor(a / layer));
    const add = pola.filter(i => data[i] === AIR && cel.has(i)).sort((a, b) => dist.get(a) - dist.get(b));
    return { remove, add };
}
