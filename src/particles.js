// ------------------------------------------------------------
// CZĄSTECZKI: małe kostki do odłamków skały, iskier, kropel i dymu.
// Wszystkie rysowane jednym poleceniem (InstancedMesh), więc są tanie.
// emit(x, y, z, opcje):
//   n - ile, kolor - [r, g, b] 0..1, rozrzut - prędkość na boki,
//   vy - prędkość w górę, grawitacja, zycie (s), rozmiar, rosnie - czy
//   kostka rośnie z czasem (dym) zamiast maleć.
// ------------------------------------------------------------
import * as THREE from '../lib/three/three.module.js';

export function createParticles(max = 500) {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), max);
    mesh.frustumCulled = false;
    const lista = [], m = new THREE.Matrix4(), kolor = new THREE.Color();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) { mesh.setMatrixAt(i, zero); mesh.setColorAt(i, kolor); lista.push({ t: 0 }); }
    let nastepna = 0;

    return {
        mesh,
        emit(x, y, z, { n = 1, kolor: c = [1, 1, 1], rozrzut = 1.5, vy = 2, grawitacja = 14, zycie = 0.6, rozmiar = 0.08, rosnie = false, obszar = 0.3 } = {}) {
            for (let i = 0; i < n; i++) {
                const p = lista[nastepna];
                p.x = x + (Math.random() - 0.5) * obszar; p.y = y + (Math.random() - 0.5) * obszar; p.z = z + (Math.random() - 0.5) * obszar;
                p.vx = (Math.random() - 0.5) * rozrzut; p.vz = (Math.random() - 0.5) * rozrzut; p.vy = vy * (0.5 + Math.random());
                p.g = grawitacja; p.t = p.t0 = zycie * (0.6 + Math.random() * 0.8); p.r = rozmiar * (0.6 + Math.random() * 0.8); p.rosnie = rosnie;
                const j = 0.8 + Math.random() * 0.4;
                mesh.setColorAt(nastepna, kolor.setRGB(c[0] * j, c[1] * j, c[2] * j));
                nastepna = (nastepna + 1) % max;
            }
            mesh.instanceColor.needsUpdate = true;
        },
        update(dt) {
            for (let i = 0; i < max; i++) {
                const p = lista[i];
                if (p.t <= 0) continue;
                p.t -= dt;
                if (p.t <= 0) { mesh.setMatrixAt(i, zero); continue; }
                p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
                const wiek = 1 - p.t / p.t0, s = p.rosnie ? p.r * (1 + wiek * 2.5) : p.r * (1 - wiek * 0.7);
                m.makeScale(s, s, s).setPosition(p.x, p.y, p.z);
                mesh.setMatrixAt(i, m);
            }
            mesh.instanceMatrix.needsUpdate = true;
        }
    };
}
