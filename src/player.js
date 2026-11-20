// ------------------------------------------------------------
// GRACZ: ruch, grawitacja, zderzenia z blokami, drabina
// i wskazywanie bloku, na który patrzy (raycast).
// Pozycja gracza to środek jego stóp.
// ------------------------------------------------------------
import { PLAYER_WIDTH, PLAYER_HEIGHT, EYE_HEIGHT, WALK_SPEED, SPRINT_SPEED, JUMP_SPEED, GRAVITY, LADDER_SPEED } from './config.js';
import { LADDER, AIR } from './blocks.js';

const HW = PLAYER_WIDTH / 2, EPS = 0.001;

export class Player {
    constructor(world) {
        this.world = world;
        this.pos = { x: 0, y: 0, z: 0 };
        this.vel = { x: 0, y: 0, z: 0 };
        this.yaw = 0; this.pitch = 0;
        this.onGround = false; this.onLadder = false;
    }

    eye() { return { x: this.pos.x, y: this.pos.y + EYE_HEIGHT, z: this.pos.z }; }
    // Kierunek patrzenia.
    dir() {
        const c = Math.cos(this.pitch);
        return { x: -Math.sin(this.yaw) * c, y: Math.sin(this.pitch), z: -Math.cos(this.yaw) * c };
    }

    // Czy pudełko gracza nachodzi na blok spełniający warunek?
    touches(test) {
        const p = this.pos, w = this.world;
        for (let y = Math.floor(p.y); y <= Math.floor(p.y + PLAYER_HEIGHT - EPS); y++)
            for (let z = Math.floor(p.z - HW); z <= Math.floor(p.z + HW - EPS); z++)
                for (let x = Math.floor(p.x - HW); x <= Math.floor(p.x + HW - EPS); x++)
                    if (test(w.get(x, y, z), x, y, z)) return true;
        return false;
    }
    collides() { return this.touches((id, x, y, z) => this.world.solid(x, y, z)); }

    // Przesuń wzdłuż jednej osi; przy zderzeniu dosuń do ściany.
    move(axis, d) {
        const steps = Math.max(1, Math.ceil(Math.abs(d) / 0.4));
        const lo = axis === 'y' ? 0 : HW, hi = axis === 'y' ? PLAYER_HEIGHT : HW;
        for (let i = 0; i < steps; i++) {
            this.pos[axis] += d / steps;
            if (!this.collides()) continue;
            if (d > 0) this.pos[axis] = Math.floor(this.pos[axis] + hi) - hi - EPS;
            else this.pos[axis] = Math.floor(this.pos[axis] - lo) + 1 + lo + EPS;
            return true;
        }
        return false;
    }

    update(dt, input) {
        let fx = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
        let sx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        const len = Math.hypot(fx, sx) || 1;
        const speed = input.sprint ? SPRINT_SPEED : WALK_SPEED;
        const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
        const tx = (-sin * fx + cos * sx) / len * speed;
        const tz = (-cos * fx - sin * sx) / len * speed;
        const k = Math.min(1, dt * (this.onGround || this.onLadder ? 14 : 4));
        this.vel.x += (tx - this.vel.x) * k;
        this.vel.z += (tz - this.vel.z) * k;

        this.onLadder = this.touches(id => id === LADDER);
        if (this.onLadder) {
            this.vel.y = input.jump ? LADDER_SPEED : input.down ? -LADDER_SPEED : 0;
        } else {
            this.vel.y = Math.max(-40, this.vel.y - GRAVITY * dt);
            if (input.jump && this.onGround) this.vel.y = JUMP_SPEED;
        }

        if (this.move('x', this.vel.x * dt)) this.vel.x = 0;
        if (this.move('z', this.vel.z * dt)) this.vel.z = 0;
        const hit = this.move('y', this.vel.y * dt);
        this.onGround = hit && this.vel.y <= 0;
        if (hit) this.vel.y = 0;
    }
}

// Pierwszy blok na linii wzroku (przechodzi przez powietrze i drabinę).
export function raycast(world, o, d, maxDist) {
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
    const tdx = sx ? Math.abs(1 / d.x) : Infinity, tdy = sy ? Math.abs(1 / d.y) : Infinity, tdz = sz ? Math.abs(1 / d.z) : Infinity;
    let tx = sx ? (sx > 0 ? x + 1 - o.x : o.x - x) * tdx : Infinity;
    let ty = sy ? (sy > 0 ? y + 1 - o.y : o.y - y) * tdy : Infinity;
    let tz = sz ? (sz > 0 ? z + 1 - o.z : o.z - z) * tdz : Infinity;
    let t = 0;
    while (t <= maxDist) {
        const id = world.get(x, y, z);
        if (id !== AIR && id !== LADDER) return { x, y, z, id, dist: t };
        if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; }
        else if (ty < tz) { y += sy; t = ty; ty += tdy; }
        else { z += sz; t = tz; tz += tdz; }
    }
    return null;
}
