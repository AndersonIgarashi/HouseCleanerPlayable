import * as PIXI from 'pixi.js';
import { Ease, EaseFn } from '../core/tween';
import { rand, pick } from '../core/utils';

interface Particle {
  sp: PIXI.Sprite;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  life: number;
  age: number;
  spin: number;
  s0: number;
  s1: number;
  a0: number;
  a1: number;
  scaleEase: EaseFn;
  flutter: number;
  phase: number;
  fadeStart: number;
}

export interface SpawnOpts {
  vx?: number;
  vy?: number;
  gravity?: number;
  drag?: number;
  life?: number;
  spin?: number;
  rotation?: number;
  s0?: number;
  s1?: number;
  a0?: number;
  a1?: number;
  tint?: number;
  scaleEase?: EaseFn;
  flutter?: number;
  blend?: PIXI.BLEND_MODES;
  // Alpha holds at a0 until this share of the life, then fades to a1
  fadeStart?: number;
}

const CONFETTI_COLORS = [0xff5a6e, 0xffc83d, 0x3fa9f5, 0x8e5be8, 0x5dd65a, 0xff7a2f, 0x2bd6c4, 0xff8fd0];

export class Fx {
  public readonly back = new PIXI.Container();
  public readonly front = new PIXI.Container();
  public scale = 1;
  private particles: Particle[] = [];
  private pool: PIXI.Sprite[] = [];

  constructor(private tex: Record<string, PIXI.Texture>) {}

  spawn(layer: PIXI.Container, texKey: string, x: number, y: number, o: SpawnOpts = {}): PIXI.Sprite {
    const sp = this.pool.pop() || new PIXI.Sprite();
    sp.texture = this.tex[texKey];
    sp.anchor.set(0.5);
    sp.position.set(x, y);
    sp.rotation = o.rotation ?? 0;
    sp.tint = o.tint ?? 0xffffff;
    sp.alpha = o.a0 ?? 1;
    sp.blendMode = o.blend ?? PIXI.BLEND_MODES.NORMAL;
    const s0 = (o.s0 ?? 1) * this.scale;
    sp.scale.set(s0);
    layer.addChild(sp);
    this.particles.push({
      sp,
      vx: (o.vx ?? 0) * this.scale,
      vy: (o.vy ?? 0) * this.scale,
      gravity: (o.gravity ?? 0) * this.scale,
      drag: o.drag ?? 0,
      life: o.life ?? 600,
      age: 0,
      spin: o.spin ?? 0,
      s0,
      s1: (o.s1 ?? o.s0 ?? 1) * this.scale,
      a0: o.a0 ?? 1,
      a1: o.a1 ?? 0,
      scaleEase: o.scaleEase ?? Ease.quadOut,
      flutter: o.flutter ?? 0,
      phase: Math.random() * 6.28,
      fadeStart: o.fadeStart ?? (o.flutter ? 0.8 : 0)
    });
    return sp;
  }

  puff(x: number, y: number, size = 1, tint = 0xf2e8d8, layer = this.back): void {
    const a = rand(0, Math.PI * 2);
    const sp = rand(30, 90) * size;
    this.spawn(layer, 'puff', x, y, {
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 40 * size,
      drag: 2.5,
      life: rand(420, 650),
      spin: rand(-1.5, 1.5),
      rotation: rand(0, 6.28),
      s0: 0.12 * size,
      s1: rand(0.42, 0.55) * size,
      a0: 0.95,
      a1: 0,
      fadeStart: 0.4,
      tint,
      scaleEase: Ease.backOut
    });
  }

  dustTrail(x: number, y: number, dirX: number, dirY: number): void {
    for (let i = 0; i < 2; i++) {
      this.spawn(this.back, 'puff', x + rand(-18, 18) * this.scale, y + rand(-8, 8) * this.scale, {
        vx: -dirX * rand(40, 120) + rand(-30, 30),
        vy: -dirY * rand(40, 120) - rand(20, 60),
        drag: 3,
        life: rand(380, 560),
        spin: rand(-2, 2),
        rotation: rand(0, 6.28),
        s0: 0.08,
        s1: rand(0.22, 0.32),
        a0: 0.85,
        tint: 0xe9dcc6,
        scaleEase: Ease.backOut
      });
    }
  }

  burst(x: number, y: number, count = 8, radius = 60, size = 1, tint = 0xf2e8d8): void {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rand(-0.3, 0.3);
      const r = rand(0.3, 1) * radius * this.scale;
      this.puff(x + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.25, size, tint);
    }
  }

  /** Dense cloud of puffs covering a screen rectangle (house makeover). */
  bigPoof(x0: number, y0: number, x1: number, y1: number): void {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const w = x1 - x0;
    const h = y1 - y0;
    for (let i = 0; i < 30; i++) {
      const u = rand(-0.5, 0.5);
      const v = rand(-0.45, 0.5);
      const x = cx + u * w;
      const y = cy + v * h;
      const a = Math.atan2(v, u);
      const sp = rand(120, 320);
      const big = (Math.max(w, h) / 256 / this.scale) * rand(0.24, 0.34);
      this.spawn(this.front, 'puff', x, y, {
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.6 - 40,
        drag: 2.6,
        life: rand(750, 1050),
        spin: rand(-1.2, 1.2),
        rotation: rand(0, 6.28),
        s0: big * 0.35,
        s1: big * rand(1.0, 1.3),
        a0: 1,
        a1: 0,
        fadeStart: 0.55,
        tint: pick([0xffffff, 0xf4ecdf, 0xece0cc]),
        scaleEase: Ease.backOutStrong
      });
    }
    for (let i = 0; i < 8; i++) {
      const big = (Math.max(w, h) / 256 / this.scale) * rand(0.34, 0.42);
      this.spawn(this.front, 'puff', cx + rand(-0.25, 0.25) * w, cy + rand(-0.2, 0.25) * h, {
        vx: rand(-60, 60),
        vy: rand(-80, -20),
        drag: 2,
        life: rand(650, 800),
        spin: rand(-0.8, 0.8),
        rotation: rand(0, 6.28),
        s0: big * 0.4,
        s1: big,
        a0: 1,
        a1: 0,
        fadeStart: 0.6,
        tint: 0xffffff,
        scaleEase: Ease.backOutStrong
      });
    }
  }

  sparkles(x: number, y: number, count = 8, radius = 80, tint = 0xfff3a0, layer = this.front): void {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(80, 260);
      this.spawn(layer, 'sparkle', x + Math.cos(a) * rand(0, radius) * 0.3 * this.scale, y + Math.sin(a) * rand(0, radius) * 0.3 * this.scale, {
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 60,
        drag: 3,
        life: rand(450, 800),
        spin: rand(-4, 4),
        s0: rand(0.25, 0.5),
        s1: 0,
        a0: 1,
        a1: 0.6,
        tint,
        scaleEase: Ease.quadIn,
        blend: PIXI.BLEND_MODES.ADD
      });
    }
  }

  twinkle(x: number, y: number, size = 0.5, tint = 0xffffff): void {
    this.spawn(this.front, 'sparkle', x, y, {
      life: 520,
      spin: 3,
      s0: 0,
      s1: size,
      a0: 1,
      a1: 0,
      tint,
      scaleEase: (t) => Math.sin(t * Math.PI),
      blend: PIXI.BLEND_MODES.ADD
    });
  }

  ring(x: number, y: number, size = 0.8, tint = 0xffffff): void {
    this.spawn(this.front, 'ring', x, y, { life: 450, s0: size * 0.2, s1: size, a0: 0.9, a1: 0, tint, scaleEase: Ease.cubicOut });
  }

  splat(x: number, y: number, tint: number, dirX = 0, dirY = 0): void {
    const a = rand(0, Math.PI * 2);
    const sp = rand(60, 200);
    this.spawn(this.front, 'splat', x, y, {
      vx: Math.cos(a) * sp + dirX * 80,
      vy: Math.sin(a) * sp - 120 + dirY * 80,
      gravity: 900,
      drag: 1,
      life: rand(380, 600),
      spin: rand(-6, 6),
      rotation: rand(0, 6.28),
      s0: rand(0.22, 0.4),
      s1: 0.05,
      a0: 1,
      a1: 0.9,
      tint,
      scaleEase: Ease.quadIn
    });
  }

  confettiBurst(x: number, y: number, angle: number, spread: number, count: number, power = 1): void {
    for (let i = 0; i < count; i++) {
      const a = angle + rand(-spread, spread);
      const sp = rand(1100, 2100) * power;
      this.spawn(this.front, pick(['conf_rect', 'conf_rect', 'conf_curl', 'conf_star', 'conf_circle', 'conf_tri']), x, y, {
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        gravity: 1400,
        drag: 1.7,
        life: rand(1700, 2600),
        spin: rand(-10, 10),
        rotation: rand(0, 6.28),
        s0: rand(0.7, 1.1),
        a0: 1,
        a1: 1,
        tint: pick(CONFETTI_COLORS),
        flutter: rand(6, 12)
      });
    }
  }

  confettiRain(width: number, count: number): void {
    for (let i = 0; i < count; i++) {
      this.spawn(this.front, pick(['conf_rect', 'conf_curl', 'conf_star', 'conf_circle']), rand(0, width), rand(-300, -20), {
        vx: rand(-60, 60),
        vy: rand(80, 240),
        gravity: 180,
        drag: 0.8,
        life: rand(2600, 3800),
        spin: rand(-6, 6),
        rotation: rand(0, 6.28),
        s0: rand(0.6, 1),
        a0: 1,
        a1: 1,
        tint: pick(CONFETTI_COLORS),
        flutter: rand(5, 10)
      });
    }
  }

  update(dt: number): void {
    const s = dt / 1000;
    const list = this.particles;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.age += dt;
      const t = Math.min(1, p.age / p.life);
      if (t >= 1) {
        p.sp.parent?.removeChild(p.sp);
        this.pool.push(p.sp);
        list.splice(i, 1);
        continue;
      }
      const k = Math.exp(-p.drag * s);
      p.vx *= k;
      p.vy = p.vy * k + p.gravity * s;
      p.sp.x += p.vx * s;
      p.sp.y += p.vy * s;
      p.sp.rotation += p.spin * s;
      const sc = p.s0 + (p.s1 - p.s0) * p.scaleEase(t);
      if (p.flutter) {
        p.sp.scale.set(sc, sc * Math.cos(p.age / 1000 * p.flutter + p.phase));
        p.sp.x += Math.sin(p.age / 1000 * p.flutter * 0.5 + p.phase) * 40 * s * this.scale;
      } else {
        p.sp.scale.set(sc);
      }
      const fadeT = p.fadeStart > 0 ? Math.max(0, (t - p.fadeStart) / (1 - p.fadeStart)) : t;
      p.sp.alpha = p.a0 + (p.a1 - p.a0) * fadeT - (p.flutter ? fadeT : 0);
    }
  }
}
