import * as PIXI from '../core/pixi';
import { Ease, tweens } from '../core/tween';
import { clamp, damp } from '../core/utils';

export class Tool extends PIXI.Container {
  public uiScale = 1;
  public readonly vel = { x: 0, y: 0 };
  public travelled = 0;
  protected body = new PIXI.Container();
  protected size = 1;
  protected baseRot = 0;
  private goal = { x: 0, y: 0 };
  private squash = { v: 0 };
  private show_ = { s: 0 };
  private wobble = 0;
  private idleT = 0;

  constructor(protected offsetY: number) {
    super();
    this.addChild(this.body);
    this.visible = false;
  }

  show(x: number, y: number): void {
    this.visible = true;
    this.position.set(x, y);
    this.goal = { x, y };
    tweens.kill(this.show_);
    this.show_.s = 0;
    tweens.to(this.show_, { s: 1 }, 650, Ease.elasticOut);
  }

  hide(): Promise<void> {
    tweens.kill(this.show_);
    return tweens
      .to(this.show_, { s: 0 }, 260, Ease.backIn)
      .finished()
      .then(() => {
        this.visible = false;
      });
  }

  moveTo(x: number, y: number, snap = false): void {
    this.goal = { x, y: y + this.offsetY * this.uiScale };
    if (snap) this.position.set(this.goal.x, this.goal.y);
  }

  kick(amount = 0.25): void {
    this.squash.v = amount;
  }

  /** Screen point where the tool does its work. */
  tip(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  update(dt: number): void {
    if (!this.visible) return;
    const k = damp(22, dt);
    const nx = this.x + (this.goal.x - this.x) * k;
    const ny = this.y + (this.goal.y - this.y) * k;
    const s = dt > 0 ? 1000 / dt : 60;
    const vx = (nx - this.x) * s;
    const vy = (ny - this.y) * s;
    this.vel.x += (vx - this.vel.x) * damp(14, dt);
    this.vel.y += (vy - this.vel.y) * damp(14, dt);
    const d = Math.hypot(nx - this.x, ny - this.y);
    this.travelled += d;
    this.position.set(nx, ny);
    const speed = Math.hypot(this.vel.x, this.vel.y) / this.uiScale;
    this.squash.v *= Math.exp(-dt / 140);
    const st = clamp(speed / 2600, 0, 0.22) + this.squash.v;
    this.wobble = Math.sin(this.travelled / (38 * this.uiScale)) * clamp(speed / 1500, 0, 1) * 0.22;
    this.idleT += dt / 1000;
    const still = 1 - clamp(speed / 300, 0, 1);
    const idle = Math.sin(this.idleT * 3.2) * 0.07 * still;
    const breathe = Math.sin(this.idleT * 6.4) * 0.03 * still;
    const b = this.size * this.uiScale * this.show_.s;
    this.body.scale.set(b * (1 + st - breathe), b * (1 - st * 0.8 + breathe));
    this.body.rotation = this.baseRot + clamp(this.vel.x / this.uiScale / 5000, -0.35, 0.35) + this.wobble + idle;
  }
}

export class Broom extends Tool {
  constructor(tex: Record<string, PIXI.Texture>) {
    super(-24);
    const sp = new PIXI.Sprite(tex.broom);
    sp.anchor.set(0.52, 0.86);
    this.body.addChild(sp);
    this.size = 330 / 420;
    this.baseRot = 0.42;
  }
}

export class Roller extends Tool {
  private foam: PIXI.Sprite;

  constructor(tex: Record<string, PIXI.Texture>) {
    super(-70);
    const sp = new PIXI.Sprite(tex.roller);
    sp.anchor.set(0.535, 0.172);
    this.foam = new PIXI.Sprite(tex.roller_foam);
    this.foam.anchor.set(0.535, 0.172);
    this.body.addChild(sp, this.foam);
    this.size = 300 / 380;
    this.baseRot = -0.12;
  }

  setColor(c: number): void {
    this.foam.tint = c;
    this.kick(0.3);
  }
}
