import * as PIXI from 'pixi.js';
import { config } from '../config';
import { ImagesResources } from '../core/assets';
import { Ease, tweens } from '../core/tween';
import { EndCard } from './EndCard';
import { Fx } from './Fx';
import { Palette } from './Palette';
import { StepBar } from './StepBar';
import { Broom, Roller } from './Tools';
import { TopBar } from './TopBar';
import { TutorialHand } from './TutorialHand';

export type PointerCb = (x: number, y: number, onUi: boolean) => void;

export class UI {
  public readonly app: PIXI.Application;
  public tex: Record<string, PIXI.Texture> = {};
  public fx: Fx;
  public topBar: TopBar;
  public stepBar: StepBar;
  public palette: Palette;
  public hand: TutorialHand;
  public broom: Broom;
  public roller: Roller;
  public endcard: EndCard;
  public s = 1;
  public width = 1;
  public height = 1;
  public portrait = true;
  public onDown?: PointerCb;
  public onMove?: PointerCb;
  public onUp?: PointerCb;

  private top = new PIXI.Container();
  private bottom = new PIXI.Container();
  private tools = new PIXI.Container();
  private flashG = new PIXI.Graphics();
  private bottomMode: 'steps' | 'palette' | 'none' = 'none';
  private topHidden = false;

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this.app = new PIXI.Application({
      view: canvas,
      width,
      height,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true
    });
  }

  async load(): Promise<void> {
    const keys = Object.keys(ImagesResources);
    const list = await Promise.all(keys.map((k) => PIXI.Assets.load<PIXI.Texture>(ImagesResources[k])));
    keys.forEach((k, i) => (this.tex[k] = list[i]));
    this.build();
  }

  private build(): void {
    const t = this.tex;
    this.fx = new Fx(t);
    this.topBar = new TopBar(t, config.game.level);
    this.stepBar = new StepBar(t);
    this.palette = new Palette(t);
    this.hand = new TutorialHand(t, this.fx);
    this.broom = new Broom(t);
    this.roller = new Roller(t);
    this.endcard = new EndCard(t);
    this.top.addChild(this.topBar);
    this.bottom.addChild(this.stepBar, this.palette);
    this.stepBar.visible = false;
    this.palette.visible = false;
    this.tools.addChild(this.broom, this.roller);
    const stage = this.app.stage;
    stage.addChild(this.fx.back, this.tools, this.top, this.bottom, this.endcard, this.fx.front, this.flashG, this.hand);
    this.top.visible = false;
    for (const c of [this.fx.back, this.fx.front, this.tools, this.flashG, this.hand]) c.eventMode = 'none';

    stage.eventMode = 'static';
    const isUi = (e: PIXI.FederatedPointerEvent) => e.target !== stage;
    stage.on('pointerdown', (e) => this.onDown?.(e.global.x, e.global.y, isUi(e)));
    stage.on('globalpointermove', (e) => this.onMove?.(e.global.x, e.global.y, isUi(e)));
    stage.on('pointerup', (e) => this.onUp?.(e.global.x, e.global.y, isUi(e)));
    stage.on('pointerupoutside', (e) => this.onUp?.(e.global.x, e.global.y, true));
  }

  /** Lays everything out; returns the screen space the HUD takes at the top and bottom. */
  layout(w: number, h: number): { top: number; bottom: number } {
    this.width = w;
    this.height = h;
    this.app.renderer.resize(w, h);
    this.app.stage.hitArea = new PIXI.Rectangle(0, 0, w, h);
    this.portrait = h >= w;
    const s = this.portrait ? Math.min(w / 720, h / 1280) : Math.min(w / 1280, h / 720) * 0.82;
    this.s = s;
    this.fx.scale = s;
    this.broom.uiScale = s;
    this.roller.uiScale = s;
    this.hand.scaleBase = s * 0.95;

    tweens.kill(this.top);
    tweens.kill(this.bottom);
    this.top.position.set(w / 2, this.topHidden ? -260 * s : 6 * s);
    this.top.scale.set(s);
    this.bottom.position.set(w / 2, this.bottomMode === 'none' ? h + 180 * s : h - 116 * s);
    this.bottom.scale.set(s);

    const e = this.endcard;
    if (this.portrait) {
      e.ribbon.position.set(w / 2, h * 0.2);
      e.logo.position.set(w / 2, h * 0.17);
      e.play.position.set(w / 2, h - 150 * s);
    } else {
      e.ribbon.position.set(w / 2, h * 0.17);
      e.logo.position.set(w * 0.2, h * 0.45);
      e.play.position.set(w * 0.8, h * 0.72);
    }
    this.flashG.clear().beginFill(0xffffff).drawRect(0, 0, w, h).endFill();
    this.flashG.alpha = 0;
    e.relayout(this.logoScale(), this.playScale());
    return { top: 185 * s, bottom: 228 * s * (this.portrait ? 1 : 0.7) };
  }

  logoScale(): number {
    const { width: w, height: h } = this;
    return this.portrait ? Math.min((h * 0.26) / 567, (w * 0.62) / 537) : Math.min((h * 0.62) / 567, (w * 0.3) / 537);
  }

  playScale(): number {
    return this.portrait ? Math.min(this.s * 0.85, (this.width * 0.7) / 660) : this.s * 0.75;
  }

  ribbonScale(): number {
    return this.portrait ? Math.min(this.s * 0.82, (this.width * 0.9) / 940) : this.s * 0.8;
  }

  endcardRegion(): { top: number; bottom: number } {
    const h = this.height;
    return this.portrait ? { top: h * 0.3, bottom: 250 * this.s } : { top: h * 0.08, bottom: h * 0.06 };
  }

  showTop(delay = 0): void {
    this.top.visible = true;
    this.topBar.intro(delay);
    const y = this.top.y;
    this.top.y = y - 240 * this.s;
    tweens.to(this.top, { y }, 600, Ease.backOut, delay);
  }

  hideTop(): void {
    this.topHidden = true;
    tweens.to(this.top, { y: -260 * this.s }, 400, Ease.backIn);
  }

  setBottom(mode: 'steps' | 'palette' | 'none', delay = 0): Promise<void> {
    if (mode === this.bottomMode) return Promise.resolve();
    const prev = this.bottomMode;
    this.bottomMode = mode;
    const baseY = this.height - 116 * this.s;
    const outY = this.height + 180 * this.s;
    const swap = () => {
      this.stepBar.visible = mode === 'steps';
      this.palette.visible = mode === 'palette';
      if (mode === 'none') return;
      this.bottom.y = outY;
      tweens.to(this.bottom, { y: baseY }, 560, Ease.backOut);
      if (mode === 'steps') this.stepBar.intro(120);
      else this.palette.intro(120);
    };
    if (prev === 'none') {
      tweens.delay(delay, swap);
      return tweens.wait(delay + 560);
    }
    tweens.to(this.bottom, { y: outY }, 300, Ease.backIn, delay);
    return tweens.wait(delay + 320).then(() => {
      swap();
      return tweens.wait(560);
    });
  }

  flash(alpha = 0.7, duration = 380): void {
    tweens.kill(this.flashG);
    this.flashG.alpha = alpha;
    tweens.to(this.flashG, { alpha: 0 }, duration, Ease.quadOut);
  }

  update(dt: number): void {
    this.fx.update(dt);
    this.topBar.update(dt);
    this.stepBar.update(dt);
    this.palette.update(dt);
    this.broom.update(dt);
    this.roller.update(dt);
    this.endcard.update(dt);
  }
}
