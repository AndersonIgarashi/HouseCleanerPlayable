import * as PIXI from '../core/pixi';
import { FONT_FAMILY } from '../core/assets';

export const NAVY = 0x26214a;

export function label(text: string, size: number, opts: Partial<PIXI.ITextStyle> = {}): PIXI.Text {
  const t = new PIXI.Text(text, {
    fontFamily: FONT_FAMILY,
    fontSize: size,
    fill: 0xffffff,
    stroke: NAVY,
    strokeThickness: Math.round(size * 0.22),
    lineJoin: 'round',
    align: 'center',
    ...opts
  });
  t.resolution = 2;
  t.anchor.set(0.5);
  return t;
}

export function sprite(tex: PIXI.Texture, ax = 0.5, ay = 0.5): PIXI.Sprite {
  const s = new PIXI.Sprite(tex);
  s.anchor.set(ax, ay);
  return s;
}

export function fitSprite(s: PIXI.Sprite, size: number): PIXI.Sprite {
  const k = size / Math.max(s.texture.width, s.texture.height);
  s.scale.set(k);
  return s;
}

export function button(c: PIXI.Container, onTap: () => void): void {
  c.eventMode = 'static';
  c.cursor = 'pointer';
  c.on('pointertap', onTap);
}
