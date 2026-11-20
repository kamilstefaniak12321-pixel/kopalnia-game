// ------------------------------------------------------------
// MESHER - zamienia kawałek świata (16x16x16) na trójkąty.
// Rysuje tylko ściany stykające się z powietrzem i przyciemnia
// narożniki (ambient occlusion), żeby korytarze miały głębię.
// Czysta logika: zwraca zwykłe tablice liczb.
// ------------------------------------------------------------
import { CHUNK, ATLAS_TILES, TILE } from './config.js';
import { AIR, LADDER, BLOCKS, isSolid } from './blocks.js';

const FACE_LIGHT = { '0+': 0.8, '0-': 0.8, '1+': 1.0, '1-': 0.5, '2+': 0.66, '2-': 0.66 };
const CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]];
const INSET = 0.02 / TILE;   // żeby sąsiednia tekstura atlasu nie przeciekała

export function meshChunk(world, cx, cy, cz, tileIndex) {
    const pos = [], nor = [], uv = [], col = [], idx = [];
    const x0 = cx * CHUNK, y0 = cy * CHUNK, z0 = cz * CHUNK;
    const p = [0, 0, 0], q = [0, 0, 0];

    function quadUV(tile, verts) {
        const tu = tile % ATLAS_TILES, tv = Math.floor(tile / ATLAS_TILES);
        for (const [u, v] of verts) {
            uv.push((tu + INSET + u * (1 - 2 * INSET)) / ATLAS_TILES,
                1 - (tv + INSET + (1 - v) * (1 - 2 * INSET)) / ATLAS_TILES);
        }
    }

    for (let y = y0; y < y0 + CHUNK; y++) for (let z = z0; z < z0 + CHUNK; z++) for (let x = x0; x < x0 + CHUNK; x++) {
        const id = world.get(x, y, z);
        if (id === AIR) continue;
        const def = BLOCKS[id];

        if (id === LADDER) {
            // Płaska drabina przy ścianie szybu, widoczna z obu stron.
            const base = pos.length / 3, X = x + 0.08;
            pos.push(X, y, z, X, y, z + 1, X, y + 1, z + 1, X, y + 1, z);
            for (let i = 0; i < 4; i++) { nor.push(1, 0, 0); col.push(1, 1, 1); }
            quadUV(tileIndex[def.tekstury[1]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
            idx.push(base, base + 2, base + 1, base, base + 3, base + 2, base, base + 1, base + 2, base, base + 2, base + 3);
            continue;
        }

        const c = [x, y, z];
        for (let a = 0; a < 3; a++) for (let s = -1; s <= 1; s += 2) {
            const u = (a + 1) % 3, v = (a + 2) % 3;
            p[0] = x; p[1] = y; p[2] = z; p[a] += s;
            if (isSolid(world.get(p[0], p[1], p[2]))) continue;

            const light = FACE_LIGHT[a + (s > 0 ? '+' : '-')];
            const tile = tileIndex[def.tekstury[a === 1 ? (s > 0 ? 0 : 2) : 1]];
            const base = pos.length / 3, ao = [], tex = [];
            for (const [du, dv] of CORNERS) {
                q[a] = c[a] + (s > 0 ? 1 : 0); q[u] = c[u] + du; q[v] = c[v] + dv;
                pos.push(q[0], q[1], q[2]);
                nor.push(a === 0 ? s : 0, a === 1 ? s : 0, a === 2 ? s : 0);
                // cień w narożniku: dwa boki i róg w warstwie przed ścianą
                const su = du ? 1 : -1, sv = dv ? 1 : -1;
                q[a] = p[a]; q[u] = c[u] + su; q[v] = c[v];
                const s1 = isSolid(world.get(q[0], q[1], q[2])) ? 1 : 0;
                q[u] = c[u]; q[v] = c[v] + sv;
                const s2 = isSolid(world.get(q[0], q[1], q[2])) ? 1 : 0;
                q[u] = c[u] + su;
                const s3 = isSolid(world.get(q[0], q[1], q[2])) ? 1 : 0;
                const o = (s1 && s2) ? 0 : 3 - s1 - s2 - s3;
                ao.push(o);
                const b = light * (0.5 + o * 0.5 / 3);
                col.push(b, b, b);
                tex.push(a === 2 ? [du, dv] : [dv, du]);   // pion tekstury = pion świata
            }
            quadUV(tile, tex);
            const flip = ao[0] + ao[2] < ao[1] + ao[3];
            const order = flip ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
            if (s > 0) for (const i of order) idx.push(base + i);
            else for (let i = 5; i >= 0; i--) idx.push(base + order[i]);
        }
    }
    return { pos, nor, uv, col, idx };
}
