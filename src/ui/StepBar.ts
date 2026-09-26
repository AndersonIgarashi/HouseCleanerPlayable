import * as PIXI from '../core/pixi';
import { StepId, config } from '../config';
import { Ease, tweens } from '../core/tween';
import { fitSprite, label, sprite } from './common';

const ICONS: Record<StepId, string> = {
  clean: 'icon_broom',
  paint: 'icon_roller_yellow',
  floor: 'icon_floor',
  furniture: 'icon_chair'
};

class Slot extends PIXI.Container {
  public done = false;
  public active = false;
  public readonly locked: boolean;
  public readonly icon: PIXI.Sprite;
  private frame: PIXI.Sprite;
  private check: PIXI.Sprite;
  private text: PIXI.Text;
  private iconBase: number;
  private frameAnim = { s: 0.78 };
  private iconRot = 0;
  private t = Math.random() * 6;

  constructor(tex: Record<string, PIXI.Texture>, public readonly id: StepId, locked: boolean) {
    super();
    this.locked = locked;
    const bg = sprite(tex.slot);
    bg.scale.set(0.78);
    this.frame = sprite(tex.slot_active);
    this.frame.scale.set(0.78);
    this.frame.visible = false;
    this.icon = fitSprite(sprite(tex[ICONS[id]]), id === 'clean' ? 128 : 104);
    this.icon.y = -14;
    if (id === 'clean') this.iconRot = this.icon.rotation = 0.62;
    this.iconBase = this.icon.scale.x;
    this.text = label(config.game.stepLabels[id], id === 'furniture' ? 19 : 23, { strokeThickness: 6 });
    this.text.y = 50;
    this.check = sprite(tex.check);
    this.check.visible = false;
    this.check.position.set(30, -30);
    this.addChild(this.frame, bg, this.icon, this.text, this.check);
    if (locked) {
      this.icon.alpha = 0.45;
      this.icon.tint = 0x9aa0c0;
      this.text.alpha = 0.55;
      const lock = fitSprite(sprite(tex.icon_lock), 50);
      lock.position.set(44, -44);
      this.addChild(lock);
    }
  }

  setActive(on: boolean): void {
    this.active = on;
    this.frame.visible = on;
    if (on) {
      this.frameAnim.s = 0.3;
      tweens.kill(this.frameAnim);
      tweens.to(this.frameAnim, { s: 0.78 }, 600, Ease.elasticOut);
      tweens.punch(this.icon.scale, 0.3, 600, { x: this.iconBase, y: this.iconBase });
    }
  }

  press(): void {
    tweens.punch(this.scale, 0.18, 450, { x: 1, y: 1 });
  }

  complete(): void {
    this.done = true;
    this.setActive(false);
    this.icon.alpha = 0.55;
    this.check.visible = true;
    this.check.scale.set(2.2);
    this.check.alpha = 0;
    this.check.rotation = -0.5;
    tweens.to(this.check, { alpha: 1, rotation: 0 }, 180, Ease.quadOut);
    tweens.to(this.check.scale, { x: 0.62, y: 0.62 }, 200, Ease.quadIn).onComplete(() => {
      tweens.punch(this.check.scale, 0.35, 600, { x: 0.62, y: 0.62 });
      tweens.punch(this.scale, 0.12, 500, { x: 1, y: 1 });
    });
  }

  update(dt: number): void {
    this.t += dt / 1000;
    if (this.active) {
      const k = 1 + Math.sin(this.t * 6) * 0.05;
      this.frame.alpha = 0.75 + Math.sin(this.t * 6) * 0.25;
      this.icon.rotation = this.iconRot + Math.sin(this.t * 3) * 0.08;
      this.frame.scale.set(this.frameAnim.s * k);
    } else {
      this.icon.rotation += (this.iconRot - this.icon.rotation) * 0.1;
    }
  }
}

export class StepBar extends PIXI.Container {
  public readonly slots: Slot[] = [];
  public onSelect?: (id: StepId) => void;

  constructor(tex: Record<string, PIXI.Texture>) {
    super();
    const ids = config.game.steps.filter((s) => config.game.showLockedSteps || config.game.playableSteps.includes(s));
    const gap = 156;
    const panel = new PIXI.NineSlicePlane(tex.panel, 44, 44, 44, 44);
    panel.width = ids.length * gap + 40;
    panel.height = 196;
    panel.position.set(-panel.width / 2, -98);
    this.addChild(panel);
    ids.forEach((id, i) => {
      const s = new Slot(tex, id, !config.game.playableSteps.includes(id));
      s.x = (i - (ids.length - 1) / 2) * gap;
      s.eventMode = 'static';
      s.cursor = 'pointer';
      s.on('pointertap', () => {
        s.press();
        if (s.locked && !s.done) {
          tweens.kill(s);
          s.rotation = 0.12;
          tweens.to(s, { rotation: 0 }, 400, Ease.elasticOut);
        }
        this.onSelect?.(id);
      });
      this.slots.push(s);
      this.addChild(s);
    });
  }

  slot(id: StepId): Slot {
    return this.slots.find((s) => s.id === id)!;
  }

  setActive(id: StepId | null): void {
    for (const s of this.slots) if (s.active !== (s.id === id)) s.setActive(s.id === id);
  }

  intro(delay = 0): void {
    this.slots.forEach((s, i) => {
      s.scale.set(0);
      tweens.popIn(s.scale, 1, 560, delay + i * 80);
    });
  }

  update(dt: number): void {
    for (const s of this.slots) s.update(dt);
  }
}
