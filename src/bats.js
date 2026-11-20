// ------------------------------------------------------------
// NIETOPERZE - mieszkańcy komór. Wiszą pod stropem, a gdy górnik
// podejdzie ze światłem, zrywają się i odlatują w ciemność; po
// chwili siadają pod innym stropem. Nikomu nie robią krzywdy.
// ------------------------------------------------------------
import * as THREE from '../lib/three/three.module.js';
import { AIR } from './blocks.js';

const CIALO = new THREE.MeshLambertMaterial({ color: 0x2c2530 });
const SKRZYDLO = new THREE.MeshLambertMaterial({ color: 0x3a3040, side: THREE.DoubleSide });

function zbuduj() {
    const g = new THREE.Group();
    const cialo = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.22), CIALO);
    const uszy = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.04), CIALO); uszy.position.set(0, 0.09, 0.09);
    g.add(cialo, uszy);
    const skrzydla = [-1, 1].map(s => {
        const zawias = new THREE.Group(); zawias.position.x = s * 0.07;
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), SKRZYDLO);
        pl.rotation.x = -Math.PI / 2; pl.position.x = s * 0.15;
        zawias.add(pl); g.add(zawias);
        return zawias;
    });
    return { g, skrzydla };
}

export function createBats(max = 16) {
    const group = new THREE.Group();
    let world = null, lista = [], pisk = 0;
    const wolne = (x, y, z) => world.get(Math.floor(x), Math.floor(y), Math.floor(z)) === AIR;
    // Miejsce pod stropem nad punktem (x, y, z) - albo null.
    function strop(x, y, z, zasieg = 8) {
        if (!wolne(x, y, z)) return null;
        for (let i = 0; i < zasieg; i++) { if (!wolne(x, y + 1, z)) return world.solid(Math.floor(x), Math.floor(y + 1), Math.floor(z)) ? Math.floor(y) + 0.86 : null; y++; }
        return null;
    }

    return {
        group,
        get lecace() { return lista.filter(b => b.leci).length; },
        get ile() { return lista.length; },
        reset(nowySwiat, komory) {
            world = nowySwiat;
            for (const b of lista) group.remove(b.g);
            lista = [];
            // W co drugiej komorze, po 1-3 sztuki.
            for (let i = 0; i < komory.length && lista.length < max; i += 2) {
                const [x, y, z] = komory[i];
                for (let k = 0, n = 1 + (i * 7 % 3); k < n && lista.length < max; k++) {
                    const bx = x + 0.5 + ((i + k * 3) % 3 - 1) * 0.6, bz = z + 0.5 + ((i + k) % 3 - 1) * 0.6, by = strop(bx, y, bz);
                    if (by === null) continue;
                    const b = zbuduj();
                    Object.assign(b, { x: bx, y: by, z: bz, dom: [bx, by, bz], vx: 0, vy: 0, vz: 0, leci: false, t: 6 + Math.random() * 6, skret: 0 });
                    group.add(b.g); lista.push(b);
                }
            }
        },
        // gracz - pozycja oczu; jasno - czy lampa świeci; naSploszenie() - raz na zerwanie się stada.
        update(dt, gracz, jasno, naSploszenie) {
            pisk -= dt;
            for (const b of lista) {
                const dx = b.x - gracz.x, dy = b.y - gracz.y, dz = b.z - gracz.z, odl = Math.hypot(dx, dy, dz);
                b.t += dt;
                if (!b.leci) {
                    // Świeżo po wylądowaniu jest zmęczony - zrywa się tylko, gdy ktoś podejdzie całkiem blisko.
                    if (odl < (jasno && b.t > 6 ? 6.5 : 2.5)) {
                        b.leci = true; b.t = 0;
                        const k = 4 / Math.max(0.5, odl);
                        b.vx = dx * k + (Math.random() - 0.5) * 3; b.vz = dz * k + (Math.random() - 0.5) * 3; b.vy = -1.5;
                        if (pisk <= 0) { pisk = 1.5; naSploszenie(); }
                    }
                    // Wisi głową w dół, skrzydła złożone; czasem się poruszy.
                    b.g.rotation.set(Math.PI, b.g.rotation.y, Math.sin(b.t * 0.8) * 0.05);
                    b.skrzydla[0].rotation.z = 1.35; b.skrzydla[1].rotation.z = -1.35;
                } else {
                    // Lot: nerwowe zmiany kierunku, byle dalej od światła.
                    if ((b.skret -= dt) <= 0) {
                        b.skret = 0.2 + Math.random() * 0.25;
                        b.vx += (Math.random() - 0.5) * 5; b.vy += (Math.random() - 0.5) * 3; b.vz += (Math.random() - 0.5) * 5;
                        if (odl < 8) { b.vx += dx / odl * 3; b.vz += dz / odl * 3; }
                        const v = Math.hypot(b.vx, b.vy, b.vz), cel = 4.2;
                        b.vx *= cel / v; b.vy *= cel / v * 0.6; b.vz *= cel / v;
                    }
                    // Odbijanie się od ścian, osobno w każdą stronę.
                    if (wolne(b.x + b.vx * dt * 3, b.y, b.z)) b.x += b.vx * dt; else b.vx = -b.vx;
                    if (wolne(b.x, b.y + b.vy * dt * 3, b.z)) b.y += b.vy * dt; else b.vy = -b.vy;
                    if (wolne(b.x, b.y, b.z + b.vz * dt * 3)) b.z += b.vz * dt; else b.vz = -b.vz;
                    b.g.rotation.set(0, Math.atan2(b.vx, b.vz), 0);
                    const mach = Math.sin(b.t * 30) * 0.9;
                    b.skrzydla[0].rotation.z = -mach; b.skrzydla[1].rotation.z = mach;
                    // Dość latania - siada pod najbliższym stropem, z dala od gracza.
                    if ((b.t > 4 && odl > 9) || b.t > 14) {
                        const s = strop(b.x, b.y, b.z);
                        if (s !== null) { b.y = s; b.leci = false; b.t = 0; }
                    }
                    // Zabłądził (np. wyleciał szybem na powierzchnię) - wraca do swojej komory,
                    // gdy gracz nie patrzy z bliska.
                    if (b.t > 22 && odl > 10 && Math.hypot(b.dom[0] - gracz.x, b.dom[1] - gracz.y, b.dom[2] - gracz.z) > 10) {
                        [b.x, b.y, b.z] = b.dom; b.leci = false; b.t = 0;
                    }
                }
                b.g.position.set(b.x, b.y, b.z);
            }
        }
    };
}
