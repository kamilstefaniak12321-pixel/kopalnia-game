// Ikonka gry: tekstura złota 64x64 powiększona 4x -> desktop/icon.png (256x256).
// Uruchomienie: node tools/ikona.mjs, potem python tools/android_ikony.py
import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { makeTile } from '../src/textures.js';

const S = 64, K = 4, W = S * K;
const tile = makeTile('zloto');
const raw = Buffer.alloc((W * 4 + 1) * W);
for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
        const brzeg = x < K || y < K || x >= W - K || y >= W - K;      // ciemna ramka
        const i = ((y / K | 0) * S + (x / K | 0)) * 4, o = y * (W * 4 + 1) + 1 + x * 4;
        for (let c = 0; c < 3; c++) raw[o + c] = brzeg ? tile[i + c] * 0.35 : tile[i + c];
        raw[o + 3] = 255;
    }
}
const chunk = (typ, dane) => {
    const b = Buffer.concat([Buffer.from(typ), dane]), len = Buffer.alloc(4), crc = Buffer.alloc(4);
    len.writeUInt32BE(dane.length); crc.writeUInt32BE(crc32(b));
    return Buffer.concat([len, b, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(W, 4); ihdr[8] = 8; ihdr[9] = 6;
writeFileSync('desktop/icon.png', Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('desktop/icon.png gotowe');
