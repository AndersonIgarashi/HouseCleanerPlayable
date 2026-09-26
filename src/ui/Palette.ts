import * as PIXI from '../core/pixi';
import { Ease, tweens } from '../core/tween';
import { hexToNum } from '../core/utils';
import { label, sprite } from './common';

const SW_SCALE = 0.74;

class Swatch extends PIXI.Container {
  public color = 0xffffff;
  private base: PIXI.Sprite;
  private frame: PIXI.Sprite;
  private frameAnim = { s: 0 };
  private t = Math.random() * 6;
  public selected = false;

  constructor(tex: Record<string, PIXI.Texture>) {
    super();
    this.frame = sprite(tex.swatch_active);
    this.frame.visible = false;
    this.base = sprite(tex.swatch);
    const gloss = sprite(tex.swatch_gloss);
    this.addChild(this.frame, this.base, gloss);
    this.scale.set(SW_SCALE);
  }

  setColor(c: number): void {
    this.color = c;
    this.base.tint = c;
  }

  select(on: boolean): void {
    this.selected = on;
    this.frame.visible = on;
    if (on) {
      this.frameAnim.s = 0.4;
      tweens.kill(this.frameAnim);
      tweens.to(this.frameAnim, { s: 1 }, 600, Ease.elasticOut);
      tweens.punch(this.scale, 0.22, 550, { x: SW_SCALE, y: SW_SCALE });
    }
  }

  update(dt: number): void {
    this.t += dt / 1000;
    if (this.frame.visible) {
      this.frame.scale.set(this.frameAnim.s * (1 + Math.sin(this.t * 6) * 0.03));
      this.frame.alpha = 0.8 + Math.sin(this.t * 6) * 0.2;
    }
  }
}

export class Palette extends PIXI.Container {
  public readonly swatches: Swatch[] = [];
  public onPick?: (index: number, color: number) => void;
  private header: PIXI.Text;
  private tab = new PIXI.Container();
  public enabled = false;

  constructor(tex: Record<string, PIXI.Texture>) {
    super();
    const gap = 156;
    const panel = new PIXI.NineSlicePlane(tex.panel, 44, 44, 44, 44);
    panel.width = 4 * gap + 40;
    panel.height = 196;
    panel.position.set(-panel.width / 2, -90);
    const pill = new PIXI.NineSlicePlane(tex.pill, 30, 28, 30, 30);
    pill.width = 200;
    pill.height = 60;
    pill.position.set(-100, -30);
    this.header = label('WALLS', 32, { strokeThickness: 7, stroke: 0x1b2150 });
    this.header.y = -2;
    this.tab.addChild(pill, this.header);
    this.tab.y = -96;
    this.addChild(panel, this.tab);
    for (let i = 0; i < 4; i++) {
      const s = new Swatch(tex);
      s.position.set((i - 1.5) * gap, 10);
      s.eventMode = 'static';
      s.cursor = 'pointer';
      s.on('pointertap', () => {
        if (!this.enabled) return;
        this.select(i);
        this.onPick?.(i, s.color);
      });
      this.swatches.push(s);
      this.addChild(s);
    }
  }

  setPass(title: string, colors: string[], animate: boolean): void {
    this.header.text = title;
    tweens.punch(this.tab.scale, 0.25, 600, { x: 1, y: 1 });
    this.swatches.forEach((s, i) => {
      s.select(false);
      const c = hexToNum(colors[i]);
      if (!animate) {
        s.setColor(c);
        return;
      }
      tweens.kill(s.scale);
      tweens.to(s.scale, { x: 0, y: SW_SCALE * 1.15 }, 140, Ease.quadIn, i * 70).onComplete(() => {
        s.setColor(c);
        tweens.to(s.scale, { x: SW_SCALE, y: SW_SCALE }, 520, Ease.elasticOut);
      });
    });
  }

  select(i: number): void {
    this.swatches.forEach((s, k) => {
      if (k === i) s.select(true);
      else if (s.selected) s.select(false);
    });
  }

  intro(delay = 0): void {
    this.tab.scale.set(0);
    tweens.popIn(this.tab.scale, 1, 500, delay);
    this.swatches.forEach((s, i) => {
      s.scale.set(0);
      tweens.popIn(s.scale, SW_SCALE, 560, delay + 100 + i * 80);
    });
  }

  update(dt: number): void {
    for (const s of this.swatches) s.update(dt);
  }
}
