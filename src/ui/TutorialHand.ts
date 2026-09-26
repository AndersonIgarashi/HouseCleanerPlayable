import * as PIXI from '../core/pixi';
import { Ease, Tween, tweens } from '../core/tween';
import { Fx } from './Fx';

type Pt = { x: number; y: number };

export class TutorialHand extends PIXI.Container {
  public scaleBase = 1;
  private hand: PIXI.Sprite;
  private anim: Tween[] = [];
  private token = 0;

  constructor(tex: Record<string, PIXI.Texture>, private fx: Fx) {
    super();
    this.hand = new PIXI.Sprite(tex.hand);
    this.hand.anchor.set(0.3, 0.05);
    this.hand.rotation = -0.35;
    this.addChild(this.hand);
    this.visible = false;
  }

  hide(): void {
    this.token++;
    this.anim.forEach((a) => a.kill());
    this.anim = [];
    tweens.kill(this);
    tweens.kill(this.hand.scale);
    this.visible = false;
  }

  private start(): number {
    this.hide();
    this.visible = true;
    this.alpha = 0;
    this.anim.push(tweens.to(this, { alpha: 1 }, 200));
    return this.token;
  }

  /** Repeated tap on a (possibly moving) point. */
  tap(target: () => Pt): void {
    const tk = this.start();
    const loop = () => {
      if (tk !== this.token) return;
      const p = target();
      const b = this.scaleBase;
      this.position.set(p.x + 60 * b, p.y + 70 * b);
      this.hand.scale.set(b);
      this.anim.push(
        tweens.to(this, { x: p.x, y: p.y }, 380, Ease.cubicOut),
        tweens.to(this.hand.scale, { x: b * 0.86, y: b * 0.8 }, 120, Ease.quadOut, 380)
      );
      tweens.delay(500, () => {
        if (tk !== this.token) return;
        this.fx.ring(p.x, p.y, 0.9, 0xffffff);
        this.anim.push(tweens.to(this.hand.scale, { x: b, y: b }, 400, Ease.elasticOut));
      });
      tweens.delay(1250, loop);
    };
    loop();
  }

  /** Repeated drag gesture along a path of points. */
  swipe(path: () => Pt[]): void {
    const tk = this.start();
    const loop = () => {
      if (tk !== this.token) return;
      const pts = path();
      const b = this.scaleBase;
      this.position.set(pts[0].x, pts[0].y);
      this.hand.scale.set(b);
      this.anim.push(tweens.to(this.hand.scale, { x: b * 0.88, y: b * 0.82 }, 150, Ease.quadOut));
      const seg = 420;
      pts.slice(1).forEach((p, i) => {
        this.anim.push(tweens.to(this, { x: p.x, y: p.y }, seg, Ease.sineInOut, 200 + i * seg));
      });
      const end = 200 + (pts.length - 1) * seg;
      this.anim.push(tweens.to(this.hand.scale, { x: b, y: b }, 250, Ease.backOut, end));
      tweens.delay(end + 550, loop);
    };
    loop();
  }
}
