// ------------------------------------------------------------
// ŚWIATŁO POCHODNI. Każda pochodnia świeci z siłą 14 i światło
// "rozlewa się" po pustych polach, słabnąc o 1 na blok - więc
// nie przechodzi przez ściany, ale skręca za róg korytarza.
// ------------------------------------------------------------
import { TORCH, MUSHROOM, isSolid } from './blocks.js';

export const TORCH_LIGHT = 14;
// Co świeci i jak mocno.
export const SOURCES = { [TORCH]: TORCH_LIGHT, [MUSHROOM]: 10 };

// Liczy światło od zera dla całego świata; zwraca liczbę źródeł światła.
export function computeLight(world) {
    const { w, h, d, data, light } = world;
    const layer = w * d, queue = [];
    light.fill(0);
    for (let i = 0; i < data.length; i++) { const moc = SOURCES[data[i]]; if (moc) { light[i] = moc; queue.push(i); } }
    const torches = queue.length;
    for (let head = 0; head < queue.length; head++) {
        const i = queue[head], l = light[i] - 1;
        if (l <= 0) continue;
        const x = i % w, z = Math.floor(i / w) % d, y = Math.floor(i / layer);
        const visit = j => { if (!isSolid(data[j]) && light[j] < l) { light[j] = l; queue.push(j); } };
        if (x > 0) visit(i - 1); if (x < w - 1) visit(i + 1);
        if (z > 0) visit(i - w); if (z < d - 1) visit(i + w);
        if (y > 0) visit(i - layer); if (y < h - 1) visit(i + layer);
    }
    return torches;
}
