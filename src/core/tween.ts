export type EaseFn = (t: number) => number;

const c1 = 1.70158;
const c3 = c1 + 1;

export const Ease = {
  linear: (t: number) => t,
  quadIn: (t: number) => t * t,
  quadOut: (t: number) => 1 - (1 - t) * (1 - t),
  quadInOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  cubicOut: (t: number) => 1 - Math.pow(1 - t, 3),
  cubicIn: (t: number) => t * t * t,
  sineInOut: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  sineOut: (t: number) => Math.sin((t * Math.PI) / 2),
  backOut: (t: number) => 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2),
  backIn: (t: number) => c3 * t * t * t - c1 * t * t,
  backOutStrong: (t: number) => {
    const s = 3.2;
    return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
  },
  elasticOut: (t: number) =>
    t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  elasticOutSoft: (t: number) =>
    t === 0 || t === 1 ? t : Math.pow(2, -8 * t) * Math.sin((t * 7 - 0.75) * ((2 * Math.PI) / 3.4)) + 1,
  bounceOut: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }
};

type Props = Record<string, number>;

export class Tween {
  public done = false;
  private elapsed = 0;
  private from: Props = {};
  private started = false;
  private updateCb?: (t: number) => void;
  private completeCb?: () => void;
  private yoyoLeft = 0;
  private loops = 0;
  private forward = true;

  constructor(
    public readonly target: any,
    private readonly to: Props,
    private readonly duration: number,
    private readonly ease: EaseFn,
    private delay: number
  ) {}

  onUpdate(cb: (t: number) => void): this {
    this.updateCb = cb;
    return this;
  }

  onComplete(cb: () => void): this {
    this.completeCb = cb;
    return this;
  }

  /** Play forward then back, n round trips (Infinity for endless). */
  yoyo(n = 1): this {
    this.yoyoLeft = n * 2 - 1;
    return this;
  }

  /** Restart from the captured start values n extra times (Infinity for endless). */
  repeat(n = Infinity): this {
    this.loops = n;
    return this;
  }

  kill(): void {
    this.done = true;
  }

  finished(): Promise<void> {
    return new Promise((resolve) => {
      const prev = this.completeCb;
      this.completeCb = () => {
        prev?.();
        resolve();
      };
    });
  }

  update(dt: number): void {
    if (this.done) return;
    if (this.delay > 0) {
      this.delay -= dt;
      if (this.delay > 0) return;
      dt = -this.delay;
      this.delay = 0;
    }
    if (!this.started) {
      this.started = true;
      for (const k in this.to) this.from[k] = this.target[k];
    }
    this.elapsed += dt;
    const raw = this.duration <= 0 ? 1 : Math.min(1, this.elapsed / this.duration);
    const p = this.forward ? raw : 1 - raw;
    const e = this.ease(p);
    for (const k in this.to) this.target[k] = this.from[k] + (this.to[k] - this.from[k]) * e;
    this.updateCb?.(e);
    if (raw < 1) return;
    if (this.yoyoLeft > 0) {
      this.yoyoLeft--;
      this.forward = !this.forward;
      this.elapsed = 0;
      return;
    }
    if (this.loops > 0) {
      this.loops--;
      this.elapsed = 0;
      this.forward = true;
      return;
    }
    this.done = true;
    this.completeCb?.();
  }
}

export class Tweens {
  private list: Tween[] = [];
  private timers: { left: number; cb: () => void }[] = [];

  to(target: any, props: Props, duration: number, ease: EaseFn = Ease.quadOut, delay = 0): Tween {
    const t = new Tween(target, props, duration, ease, delay);
    this.list.push(t);
    return t;
  }

  /** Animate a 0..1 value, handy for arcs and custom curves. */
  run(duration: number, ease: EaseFn, fn: (t: number) => void, delay = 0): Tween {
    return this.to({ v: 0 }, { v: 1 }, duration, ease, delay).onUpdate(fn);
  }

  kill(target: any): void {
    for (const t of this.list) if (t.target === target) t.kill();
  }

  delay(ms: number, cb: () => void): void {
    this.timers.push({ left: ms, cb });
  }

  wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.delay(ms, resolve));
  }

  /** Squash & stretch punch on a scale-like object, settling back to its base value. */
  punch(scale: { x: number; y: number }, amount = 0.25, duration = 520, base = { x: scale.x, y: scale.y }): void {
    this.kill(scale);
    scale.x = base.x * (1 + amount);
    scale.y = base.y * (1 - amount);
    this.to(scale, { x: base.x, y: base.y }, duration, Ease.elasticOut);
  }

  /** Pop-in from zero with overshoot and a stretch on the way. */
  popIn(scale: { x: number; y: number }, to = 1, duration = 520, delay = 0): Tween {
    this.kill(scale);
    scale.x = 0;
    scale.y = 0;
    this.to(scale, { x: to * 0.85 }, duration * 0.35, Ease.quadOut, delay);
    this.to(scale, { y: to * 1.2 }, duration * 0.35, Ease.quadOut, delay);
    this.to(scale, { x: to }, duration * 0.65, Ease.elasticOutSoft, delay + duration * 0.35);
    return this.to(scale, { y: to }, duration * 0.65, Ease.elasticOutSoft, delay + duration * 0.35);
  }

  update(dt: number): void {
    const list = this.list;
    for (let i = 0; i < list.length; i++) list[i].update(dt);
    this.list = list.filter((t) => !t.done);
    if (this.timers.length) {
      const due: (() => void)[] = [];
      for (const t of this.timers) {
        t.left -= dt;
        if (t.left <= 0) due.push(t.cb);
      }
      this.timers = this.timers.filter((t) => t.left > 0);
      due.forEach((cb) => cb());
    }
  }
}

export const tweens = new Tweens();
