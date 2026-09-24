import * as PIXI from 'pixi.js';
import { Ease, tweens } from '../core/tween';
import { label, sprite } from './common';

export class EndCard extends PIXI.Container {
  public onInstall?: () => void;
  public readonly ribbon = new PIXI.Container();
  public readonly logo = new PIXI.Container();
  public readonly play = new PIXI.Container();
  private letters: PIXI.Text[] = [];
  private rays: PIXI.Sprite;
  private t = 0;
  private playBase = 1;
  private lettersLive = false;
  private playLive = false;

  constructor(tex: Record<string, PIXI.Texture>) {
    super();
    this.ribbon.addChild(sprite(tex.ribbon));
    const word = 'COMPLETE!';
    const style = { fill: [0xffffff, 0xffe6ef] as any, stroke: 0x8e1f45, strokeThickness: 12 };
    const widths = word.split('').map((ch) => label(ch, 92, style).width - 12);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = -total / 2;
    word.split('').forEach((ch, i) => {
      const t = label(ch, 92, { ...style, dropShadow: true, dropShadowColor: 0x5a0f2a, dropShadowDistance: 6, dropShadowAngle: Math.PI / 2, dropShadowAlpha: 0.6, dropShadowBlur: 0 });
      t.x = x + widths[i] / 2;
      const u = (t.x / (total / 2));
      t.y = -26 + u * u * 16;
      t.rotation = u * 0.08;
      x += widths[i];
      this.letters.push(t);
      this.ribbon.addChild(t);
    });

    this.rays = sprite(tex.rays);
    this.rays.tint = 0xffe066;
    this.rays.alpha = 0.85;
    this.rays.scale.set(1.55);
    const glow = sprite(tex.dot);
    glow.scale.set(11);
    glow.alpha = 0.75;
    glow.tint = 0xfff6c8;
    this.logo.addChild(glow, this.rays, sprite(tex.logo));

    this.play.addChild(sprite(tex.btn_play));
    this.play.eventMode = 'static';
    this.play.cursor = 'pointer';
    this.play.on('pointertap', () => {
      this.playLive = false;
      tweens.punch(this.play.scale, 0.2, 500, { x: this.playBase, y: this.playBase });
      tweens.delay(500, () => (this.playLive = true));
      this.onInstall?.();
    });

    for (const c of [this.ribbon, this.logo, this.play]) {
      c.visible = false;
      this.addChild(c);
    }
  }

  async showComplete(scale: number): Promise<void> {
    const r = this.ribbon;
    r.visible = true;
    const targetY = r.y;
    r.y = targetY - 500 * scale;
    r.scale.set(scale * 0.6, scale * 1.3);
    tweens.to(r, { y: targetY }, 420, Ease.backOut);
    tweens.to(r.scale, { x: scale * 1.15, y: scale * 0.85 }, 200, Ease.quadOut, 380);
    tweens.to(r.scale, { x: scale, y: scale }, 700, Ease.elasticOut, 580);
    this.letters.forEach((t, i) => {
      t.scale.set(0);
      tweens.popIn(t.scale, 1, 600, 420 + i * 55);
    });
    await tweens.wait(420 + this.letters.length * 55 + 400);
    this.lettersLive = true;
  }

  async hideComplete(): Promise<void> {
    const r = this.ribbon;
    const s = r.scale.x;
    tweens.kill(r.scale);
    await tweens.to(r.scale, { x: s * 1.12, y: s * 1.12 }, 120, Ease.quadOut).finished();
    await tweens.to(r.scale, { x: 0, y: 0 }, 260, Ease.backIn).finished();
    r.visible = false;
    this.lettersLive = false;
  }

  showEndcard(logoScale: number, playScale: number): void {
    this.logo.visible = true;
    this.logo.scale.set(0);
    tweens.popIn(this.logo.scale, logoScale, 750);
    this.play.visible = true;
    this.playBase = playScale;
    this.play.scale.set(0);
    tweens.popIn(this.play.scale, playScale, 700, 350).onComplete(() => (this.playLive = true));
  }

  relayout(logoScale: number, playScale: number): void {
    if (this.logo.visible) this.logo.scale.set(logoScale);
    this.playBase = playScale;
    if (this.play.visible && !this.playLive) this.play.scale.set(playScale);
  }

  update(dt: number): void {
    this.t += dt / 1000;
    this.rays.rotation += dt * 0.0003;
    if (this.lettersLive) {
      this.letters.forEach((l, i) => {
        l.scale.y = 1 + Math.sin(this.t * 7 - i * 0.6) * 0.06;
        l.scale.x = 1 - Math.sin(this.t * 7 - i * 0.6) * 0.04;
      });
    }
    if (this.playLive) {
      const k = 1 + Math.sin(this.t * 5.5) * 0.055;
      this.play.scale.set(this.playBase * k, this.playBase * (2 - k));
    }
  }
}
