import * as PIXI from '../core/pixi';
import { Ease, tweens } from '../core/tween';
import { fitSprite, label, sprite } from './common';

const TRACK_W = 460;
const TRACK_H = 58;
const PAD = 8;
const FILL_H = TRACK_H - PAD * 2;

export class TopBar extends PIXI.Container {
  private fill: PIXI.NineSlicePlane;
  private badge = new PIXI.Container();
  private icon: PIXI.Sprite;
  private shown = 0;
  private target = 0;
  private levelPill = new PIXI.Container();

  constructor(tex: Record<string, PIXI.Texture>, level: number) {
    super();
    const pill = new PIXI.NineSlicePlane(tex.pill, 30, 28, 30, 30);
    pill.width = 220;
    pill.height = 64;
    pill.position.set(-110, -32);
    const lvl = label(`LEVEL ${level}`, 34, { strokeThickness: 7, stroke: 0x1b2150 });
    lvl.y = -2;
    this.levelPill.addChild(pill, lvl);
    this.levelPill.y = 52;

    const bar = new PIXI.Container();
    bar.y = 124;
    const track = new PIXI.NineSlicePlane(tex.bar_track, 30, 29, 30, 29);
    track.width = TRACK_W;
    track.height = TRACK_H;
    track.position.set(-TRACK_W / 2 - 30, -TRACK_H / 2);
    this.fill = new PIXI.NineSlicePlane(tex.bar_fill, 23, 23, 23, 23);
    this.fill.height = FILL_H;
    this.fill.position.set(-TRACK_W / 2 - 30 + PAD, -FILL_H / 2);
    this.fill.visible = false;
    bar.addChild(track, this.fill);

    const b = sprite(tex.badge);
    b.scale.set(0.9);
    this.icon = fitSprite(sprite(tex.icon_house), 92);
    this.icon.y = -4;
    this.badge.addChild(b, this.icon);
    this.badge.position.set(TRACK_W / 2 - 20, 124);

    this.addChild(this.levelPill, bar, this.badge);
  }

  setProgress(p: number): void {
    this.target = Math.max(this.target, Math.min(1, p));
  }

  pulseBadge(): void {
    tweens.punch(this.badge.scale, 0.3, 700, { x: 1, y: 1 });
    tweens.kill(this.icon);
    this.icon.rotation = -0.25;
    tweens.to(this.icon, { rotation: 0 }, 700, Ease.elasticOut);
  }

  fillTip(): { x: number; y: number } {
    const w = this.fillWidth(this.shown);
    const p = this.toGlobal(new PIXI.Point(-TRACK_W / 2 - 30 + PAD + w, 124));
    return { x: p.x, y: p.y };
  }

  badgeGlobal(): { x: number; y: number } {
    const p = this.badge.getGlobalPosition();
    return { x: p.x, y: p.y };
  }

  private fillWidth(v: number): number {
    return FILL_H + (TRACK_W - PAD * 2 - FILL_H) * v;
  }

  intro(delay = 0): void {
    this.levelPill.scale.set(0);
    tweens.popIn(this.levelPill.scale, 1, 600, delay);
    this.badge.scale.set(0);
    tweens.popIn(this.badge.scale, 1, 600, delay + 180);
  }

  update(dt: number): void {
    if (this.shown === this.target) return;
    const k = 1 - Math.exp(-dt / 120);
    this.shown += (this.target - this.shown) * k;
    if (Math.abs(this.target - this.shown) < 0.001) this.shown = this.target;
    this.fill.visible = this.shown > 0.002;
    this.fill.width = this.fillWidth(this.shown);
  }
}
