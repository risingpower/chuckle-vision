// Confetti bursts for good rounds.

import { C } from './palette';

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  life: number;
}

const COLORS = [C.sun, C.tomato, C.cyan, C.mint, C.white];
const GRAVITY = 900;

export class Confetti {
  private bits: Bit[] = [];

  burst(x: number, y: number, count: number, power: number) {
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
      const v = power * (0.4 + Math.random() * 0.8);
      this.bits.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 14,
        size: 8 + Math.random() * 10,
        color: COLORS[i % COLORS.length]!,
        life: 2.5 + Math.random(),
      });
    }
  }

  update(dt: number) {
    for (const b of this.bits) {
      b.vy += GRAVITY * dt;
      b.vx *= 1 - 0.8 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.vr * dt;
      b.life -= dt;
    }
    this.bits = this.bits.filter((b) => b.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const b of this.bits) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.fillStyle = b.color;
      ctx.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2);
      ctx.restore();
    }
  }

  clear() {
    this.bits = [];
  }
}
