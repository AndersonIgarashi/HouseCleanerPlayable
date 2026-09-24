import { sdk } from '@smoud/playable-sdk';
import { StepId, config } from './config';
import { FONT_FAMILY, FontResource } from './core/assets';
import { Sound } from './core/sound';
import { tweens } from './core/tween';
import { clamp, pick, rand, vibrate } from './core/utils';
import { UI } from './ui/UI';
import { Debris, PassId, World3D } from './world/World3D';

type Phase =
  | 'loading'
  | 'intro'
  | 'chooseClean'
  | 'clean'
  | 'repair'
  | 'choosePaint'
  | 'chooseColor'
  | 'paint'
  | 'passDone'
  | 'complete'
  | 'endcard';

const INTERACTIVE: Phase[] = ['chooseClean', 'clean', 'choosePaint', 'chooseColor', 'paint', 'endcard'];

export class Game {
  public isFinished = false;
  private world: World3D;
  private ui: UI;
  private sound: Sound;
  private phase: Phase = 'loading';
  private width: number;
  private height: number;
  private down = false;
  private lastPt = { x: 0, y: 0 };
  private trailDist = 0;
  private cleaned = 0;
  private combo = 0;
  private lastPop = 0;
  private progress = { clean: 0, walls: 0, roof: 0 };
  private passIndex = 0;
  private passColor = 0xffffff;
  private passDone?: () => void;
  private stepWanted: StepId | null = null;
  private stepResolve?: () => void;
  private colorResolve?: (c: number) => void;
  private cleanResolve?: () => void;
  private idle = 0;
  private hinted: Partial<Record<Phase, boolean>> = {};
  private lastInteraction = performance.now();
  private musicOn = false;
  private paused = false;
  private endTap = false;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    const root = document.getElementById('game') || document.body;
    const c3 = document.createElement('canvas');
    const c2 = document.createElement('canvas');
    c3.className = 'layer3d';
    c2.className = 'layer2d';
    root.append(c3, c2);
    this.world = new World3D(c3);
    this.ui = new UI(c2, width, height);
    this.sound = new Sound();
  }

  async init(): Promise<void> {
    await Promise.all([this.loadFont(), this.world.load()]);
    await this.ui.load();
    this.wire();
    this.resize(this.width, this.height);
    this.world.update(0);
    this.ui.app.ticker.add(() => this.update(this.ui.app.ticker.deltaMS));
    this.initIdleBailout();
    tweens.delay(config.timings.introDelay, () => this.run());
  }

  private async loadFont(): Promise<void> {
    try {
      const face = new FontFace(FONT_FAMILY, `url(${FontResource})`);
      await face.load();
      (document as any).fonts.add(face);
    } catch (e) {
      console.warn('font load failed', e);
    }
  }

  private wire(): void {
    const ui = this.ui;
    ui.onDown = (x, y, onUi) => this.pointerDown(x, y, onUi);
    ui.onMove = (x, y) => this.pointerMove(x, y);
    ui.onUp = (_x, _y, onUi) => this.pointerUp(onUi);
    ui.stepBar.onSelect = (id) => {
      this.sound.play('sfx_tap');
      if (!config.game.playableSteps.includes(id)) return;
      if (id === this.stepWanted && this.stepResolve) {
        const r = this.stepResolve;
        this.stepResolve = undefined;
        this.stepWanted = null;
        r();
      }
    };
    ui.palette.onPick = (_i, color) => {
      this.sound.play('sfx_color', 1, rand(0.95, 1.08));
      if (this.colorResolve) {
        const r = this.colorResolve;
        this.colorResolve = undefined;
        r(color);
      } else if (this.phase === 'paint') {
        this.passColor = color;
        this.world.setPaintColor(this.passId(), color);
        this.ui.roller.setColor(color);
        const p = this.ui.roller.tip();
        for (let i = 0; i < 6; i++) this.ui.fx.splat(p.x, p.y, color);
      }
    };
    ui.endcard.onInstall = () => this.install();
  }

  private alive(): boolean {
    return !this.isFinished;
  }

  // ------------------------------------------------------------------ flow

  private async run(): Promise<void> {
    this.phase = 'intro';
    this.ui.showTop(0);
    this.world.introDebris();
    this.sound.play('sfx_whoosh', 0.7);
    await this.ui.setBottom('steps', 450);
    if (!this.alive()) return;

    await this.chooseStep('clean');
    if (!this.alive()) return;
    await this.cleanPhase();
    if (!this.alive()) return;
    await this.repair();
    if (!this.alive()) return;

    await this.chooseStep('paint');
    if (!this.alive()) return;
    this.sound.play('sfx_select');
    await this.ui.setBottom('palette');
    const passes = config.game.paintPasses;
    for (let i = 0; i < passes.length; i++) {
      if (!this.alive()) return;
      this.passIndex = i;
      await this.paintPass(i);
    }
    if (!this.alive()) return;
    await this.complete();
  }

  private chooseStep(id: StepId): Promise<void> {
    this.phase = id === 'clean' ? 'chooseClean' : 'choosePaint';
    this.ui.stepBar.setActive(id);
    this.stepWanted = id;
    this.hintSoon();
    return new Promise((resolve) => (this.stepResolve = resolve));
  }

  private async cleanPhase(): Promise<void> {
    this.phase = 'clean';
    this.ui.hand.hide();
    this.sound.play('sfx_select');
    this.ui.stepBar.setActive(null);
    await this.ui.setBottom('none');
    const c = this.world.houseScreenCenter();
    this.ui.broom.show(this.width * 0.66, Math.min(this.height * 0.72, c.y + 220 * this.ui.s));
    this.ui.broom.kick(0.35);
    this.ui.fx.burst(this.ui.broom.x, this.ui.broom.y, 5, 40, 0.7);
    this.sound.play('sfx_pop', 0.7, 1.2);
    this.hintSoon(500);
    return new Promise((resolve) => (this.cleanResolve = resolve));
  }

  private sweepDebris(d: Debris, dx: number, dy: number): void {
    const p = this.world.debrisScreen(d);
    this.world.sweep(d, dx, dy);
    const fx = this.ui.fx;
    fx.burst(p.x, p.y, d.flat ? 5 : 7, 70, d.flat ? 0.8 : 1, d.flat ? 0xd9c4a4 : 0xf2e8d8);
    fx.sparkles(p.x, p.y - 10 * this.ui.s, 4, 60);
    const now = performance.now();
    this.combo = now - this.lastPop < 700 ? Math.min(this.combo + 1, 8) : 0;
    this.lastPop = now;
    this.sound.play('sfx_pop', 0.9, 1 + this.combo * 0.07);
    if (!d.flat) this.sound.playThrottled('sfx_whoosh', 120, 0.5, rand(0.9, 1.2));
    vibrate(config.haptics.hit, config.haptics.enabled);
    this.cleaned++;
    const total = this.world.debris.length;
    this.progress.clean = this.cleaned / total;
    this.updateProgress();
    if (this.cleaned / total >= config.game.cleanAutoFinish) this.autoSweepRest();
    if (this.cleaned >= total) this.finishClean();
  }

  private autoSweepRest(): void {
    this.world.aliveDebris().forEach((d, i) => {
      d.alive = false;
      tweens.delay(120 + i * 110, () => {
        d.alive = true;
        if (this.phase === 'clean') this.sweepDebris(d, rand(-1, 1), rand(-1, 0.2));
      });
    });
  }

  private finishClean(): void {
    if (!this.cleanResolve) return;
    const r = this.cleanResolve;
    this.cleanResolve = undefined;
    tweens.delay(350, r);
  }

  private async repair(): Promise<void> {
    this.phase = 'repair';
    this.down = false;
    this.ui.hand.hide();
    await this.ui.broom.hide();
    const world = this.world;
    const fx = this.ui.fx;
    world.zoomPunch(0.05, 900);
    await world.squashHouse();
    const r = world.houseScreenRect();
    fx.bigPoof(r.x0, r.y0, r.x1, r.y1);
    this.sound.play('sfx_poof', 1);
    this.sound.play('sfx_transform', 0.9);
    vibrate(config.haptics.step, config.haptics.enabled);
    await tweens.wait(300);
    world.swapToUnpainted();
    world.shakeCamera(0.14);
    this.ui.flash(0.45, 450);
    const c = world.houseScreenCenter();
    fx.sparkles(c.x, c.y, 18, 260);
    await tweens.wait(650);
    if (!this.alive()) return;
    await this.ui.setBottom('steps');
    this.ui.stepBar.slot('clean').complete();
    this.sound.play('sfx_stamp');
    tweens.delay(160, () => this.sound.play('sfx_step', 0.8));
    this.progress.clean = 1;
    this.updateProgress(true);
    await tweens.wait(650);
  }

  private passId(): PassId {
    return config.game.paintPasses[this.passIndex].id;
  }

  private async paintPass(i: number): Promise<void> {
    const pass = config.game.paintPasses[i];
    const ui = this.ui;
    ui.palette.setPass(pass.label, pass.colors, i > 0);
    ui.palette.enabled = true;
    this.phase = 'chooseColor';
    this.hintSoon(i === 0 ? 700 : 900);
    const color = await new Promise<number>((resolve) => (this.colorResolve = resolve));
    if (!this.alive()) return;
    this.phase = 'paint';
    this.ui.hand.hide();
    this.passColor = color;
    this.world.beginPaint(pass.id, color);
    ui.roller.setColor(color);
    const r = this.world.houseScreenRect(pass.id);
    ui.roller.show((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2);
    ui.roller.kick(0.4);
    for (let k = 0; k < 8; k++) ui.fx.splat(ui.roller.x, ui.roller.y, color);
    this.hintSoon(450);
    await new Promise<void>((resolve) => (this.passDone = resolve));
    if (!this.alive()) return;
    this.phase = 'passDone';
    ui.hand.hide();
    await ui.roller.hide();
    this.world.flashPainted(pass.id);
    this.world.wobbleHouse();
    const rr = this.world.houseScreenRect(pass.id);
    for (let k = 0; k < 6; k++) {
      tweens.delay(k * 70, () => ui.fx.twinkle(rand(rr.x0, rr.x1), rand(rr.y0, rr.y1), rand(0.5, 0.9)));
    }
    ui.fx.sparkles((rr.x0 + rr.x1) / 2, (rr.y0 + rr.y1) / 2, 14, 220);
    this.sound.play('sfx_step', 0.85);
    vibrate(config.haptics.step, config.haptics.enabled);
    await tweens.wait(750);
  }

  private completePass(): void {
    if (this.phase !== 'paint' || !this.passDone) return;
    const done = this.passDone;
    this.passDone = undefined;
    this.down = false;
    const id = this.passId();
    this.world.finishPaint(id, 420).then(() => {
      this.progress[id] = 1;
      this.updateProgress(true);
      done();
    });
  }

  private async complete(): Promise<void> {
    this.phase = 'complete';
    const ui = this.ui;
    ui.hand.hide();
    ui.palette.enabled = false;
    await ui.setBottom('steps');
    ui.stepBar.slot('paint').complete();
    this.sound.play('sfx_stamp');
    this.updateProgress(true);
    tweens.delay(300, () => {
      ui.topBar.pulseBadge();
      const b = ui.topBar.badgeGlobal();
      ui.fx.sparkles(b.x, b.y, 14, 120);
      this.sound.play('sfx_ding', 0.9, 1.25);
    });
    await tweens.wait(1000);
    if (!this.alive()) return;
    ui.hideTop();
    ui.setBottom('none');
    const reg = ui.endcardRegion();
    this.world.frameEndcard(reg.top, reg.bottom);
    this.world.popHouse(0.9);
    this.world.bloomFlowers();
    this.sound.play('sfx_win', 0.9);
    this.sound.play('sfx_confetti', 0.9);
    vibrate(config.haptics.win, config.haptics.enabled);
    this.celebrate();
    await ui.endcard.showComplete(ui.ribbonScale());
    await tweens.wait(config.timings.completeToEndcard - 900);
    if (!this.alive()) return;
    await ui.endcard.hideComplete();
    this.showEndcard();
  }

  private celebrate(): void {
    const { width: w, height: h } = this;
    const fx = this.ui.fx;
    fx.confettiBurst(-10, h * 0.85, -Math.PI * 0.32, 0.35, 45, 1.1);
    fx.confettiBurst(w + 10, h * 0.85, -Math.PI * 0.68, 0.35, 45, 1.1);
    tweens.delay(350, () => fx.confettiRain(w, 40));
    tweens.delay(700, () => {
      fx.confettiBurst(w * 0.2, h * 0.9, -Math.PI * 0.42, 0.3, 20, 0.9);
      fx.confettiBurst(w * 0.8, h * 0.9, -Math.PI * 0.58, 0.3, 20, 0.9);
    });
  }

  private showEndcard(): void {
    const ui = this.ui;
    ui.endcard.showEndcard(ui.logoScale(), ui.playScale());
    this.sound.play('sfx_pop', 0.8, 0.9);
    tweens.delay(350, () => this.sound.play('sfx_pop', 0.8, 1.15));
    this.finish();
  }

  /** Idle bailout: skip straight to the end card from anywhere in the flow. */
  private forceEnd(): void {
    if (this.isFinished) return;
    this.phase = 'complete';
    this.ui.hand.hide();
    if (this.ui.broom.visible) this.ui.broom.hide();
    if (this.ui.roller.visible) this.ui.roller.hide();
    this.ui.hideTop();
    this.ui.setBottom('none');
    const reg = this.ui.endcardRegion();
    this.world.frameEndcard(reg.top, reg.bottom);
    this.showEndcard();
  }

  finish(): void {
    if (this.isFinished) return;
    this.isFinished = true;
    this.phase = 'endcard';
    this.hinted.endcard = false;
    this.idle = 0;
    this.hintSoon(1800);
    sdk.finish();
    const delay = config.directToStore.endCardAutoStoreMs;
    if (delay > 0) tweens.delay(delay, () => this.install());
  }

  private install(): void {
    this.sound.play('sfx_tap');
    sdk.install();
  }

  private initIdleBailout(): void {
    const limit = config.directToStore.noInteractionPlaytime;
    if (!limit) return;
    const check = () => {
      if (this.isFinished) return;
      if (!this.paused && performance.now() - this.lastInteraction > limit * 1000) this.forceEnd();
      else tweens.delay(1000, check);
    };
    tweens.delay(1000, check);
  }

  // ------------------------------------------------------------------ progress

  private updateProgress(pulse = false): void {
    const sh = config.game.progressShare;
    const p = this.progress;
    const v = p.clean * sh.clean + p.walls * sh.walls + p.roof * sh.roof;
    this.ui.topBar.setProgress(v);
    if (pulse) {
      this.ui.topBar.pulseBadge();
      const t = this.ui.topBar.fillTip();
      tweens.delay(250, () => this.ui.fx.sparkles(t.x, t.y, 8, 60));
    }
  }

  // ------------------------------------------------------------------ input

  private pointerDown(x: number, y: number, onUi: boolean): void {
    this.lastInteraction = performance.now();
    this.idle = 0;
    this.sound.unlock();
    if (!this.musicOn) {
      this.musicOn = true;
      this.sound.startMusic();
    }
    // Store opens on release: touch browsers only allow window.open from pointerup
    if (this.phase === 'endcard') {
      this.endTap = !onUi;
      return;
    }
    this.ui.hand.hide();
    if (onUi) return;
    this.down = true;
    this.lastPt = { x, y };
    this.trailDist = 0;
    if (this.phase === 'clean') {
      this.ui.broom.moveTo(x, y);
      this.ui.broom.kick(0.25);
      this.cleanAt(x, y, 0, 0);
    } else if (this.phase === 'paint') {
      this.ui.roller.kick(0.3);
      this.paintAt(x, y, 0);
    }
  }

  private pointerMove(x: number, y: number): void {
    if (!this.down) return;
    this.lastInteraction = performance.now();
    this.idle = 0;
    const dx = x - this.lastPt.x;
    const dy = y - this.lastPt.y;
    this.lastPt = { x, y };
    if (this.phase === 'clean') {
      this.ui.broom.moveTo(x, y);
      this.cleanAt(x, y, dx, dy);
    } else if (this.phase === 'paint') {
      this.paintAt(x, y, dx);
    }
  }

  private pointerUp(onUi: boolean): void {
    if (this.endTap) {
      this.endTap = false;
      if (!onUi && this.phase === 'endcard') this.install();
      return;
    }
    if (!this.down) return;
    this.down = false;
    if (this.phase === 'paint' && this.world.paintProgress(this.passId()) >= config.game.paintAutoFinish) {
      this.completePass();
    }
  }

  private cleanAt(x: number, y: number, dx: number, dy: number): void {
    const s = this.ui.s;
    const tipY = y - 24 * s;
    const len = Math.hypot(dx, dy);
    this.trailDist += len;
    if (this.trailDist > 34 * s) {
      this.trailDist = 0;
      this.ui.fx.dustTrail(x, tipY + 10 * s, dx / (len || 1), dy / (len || 1));
      this.sound.playThrottled(pick(['sfx_sweep1', 'sfx_sweep2']), 210, 0.55, rand(0.9, 1.15));
    }
    const r = config.game.sweepRadius * s;
    for (const d of this.world.aliveDebris()) {
      const p = this.world.debrisScreen(d);
      if (Math.hypot(p.x - x, p.y - tipY) < r) this.sweepDebris(d, dx, dy);
    }
  }

  private paintAt(x: number, y: number, dx: number): void {
    const id = this.passId();
    const r = this.world.houseScreenRect(id);
    const margin = (r.y1 - r.y0) * 0.2;
    const ry = clamp(y - 70 * this.ui.s, r.y0 + margin, r.y1 - margin);
    this.ui.roller.moveTo(x, ry + 70 * this.ui.s);
    const coord = this.world.paintCoord(x, (r.y0 + r.y1) / 2);
    const before = this.world.paintProgress(id);
    const prog = this.world.paintAt(id, coord);
    this.trailDist += Math.abs(dx) + 4;
    if (this.trailDist > 30 * this.ui.s) {
      this.trailDist = 0;
      const t = this.ui.roller.tip();
      this.ui.fx.splat(t.x + rand(-30, 30) * this.ui.s, t.y + rand(-10, 30) * this.ui.s, this.passColor, Math.sign(dx), 0);
      this.sound.playThrottled('sfx_paint', 160, 0.65, rand(0.9, 1.1));
    }
    if (prog > before) {
      this.progress[id] = prog;
      this.updateProgress();
    }
    if (prog >= 0.985) this.completePass();
  }

  // ------------------------------------------------------------------ hints

  private hintSoon(delay = 400): void {
    if (!config.tutorial.enabled) return;
    const phase = this.phase;
    if (this.hinted[phase]) return;
    this.hinted[phase] = true;
    tweens.delay(delay, () => {
      if (this.phase === phase && !this.down) this.showHint();
    });
  }

  private showHint(): void {
    const ui = this.ui;
    const s = ui.s;
    switch (this.phase) {
      case 'chooseClean':
      case 'choosePaint': {
        const slot = ui.stepBar.slot(this.phase === 'chooseClean' ? 'clean' : 'paint');
        ui.hand.tap(() => slot.getGlobalPosition());
        break;
      }
      case 'chooseColor': {
        const sw = ui.palette.swatches[0];
        ui.hand.tap(() => sw.getGlobalPosition());
        break;
      }
      case 'clean': {
        ui.hand.swipe(() => {
          const pts = this.world
            .aliveDebris()
            .map((d) => this.world.debrisScreen(d))
            .sort((a, b) => a.y - b.y)
            .slice(-3)
            .sort((a, b) => a.x - b.x)
            .map((p) => ({ x: p.x, y: p.y + 24 * s }));
          if (pts.length < 2) {
            const c = this.world.houseScreenCenter();
            return [{ x: c.x - 120 * s, y: c.y + 200 * s }, { x: c.x + 120 * s, y: c.y + 200 * s }];
          }
          return pts;
        });
        break;
      }
      case 'paint': {
        ui.hand.swipe(() => {
          const r = this.world.houseScreenRect(this.passId());
          const y = (r.y0 + r.y1) / 2 + 70 * s;
          const w = r.x1 - r.x0;
          return [
            { x: r.x0 + w * 0.12, y },
            { x: r.x0 + w * 0.5, y: y + 10 * s },
            { x: r.x0 + w * 0.88, y }
          ];
        });
        break;
      }
      case 'endcard': {
        ui.hand.tap(() => ui.endcard.play.getGlobalPosition());
        break;
      }
    }
  }

  private tickIdle(dt: number): void {
    if (!config.tutorial.enabled || this.down || !INTERACTIVE.includes(this.phase) || this.ui.hand.visible) return;
    this.idle += dt;
    if (this.idle > config.timings.idleHint) {
      this.idle = 0;
      this.showHint();
    }
  }

  // ------------------------------------------------------------------ lifecycle

  private update(dt: number): void {
    dt = Math.min(dt, 50);
    tweens.update(dt);
    this.world.update(dt);
    this.ui.update(dt);
    this.tickIdle(dt);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (!this.ui.fx) return;
    const r = this.ui.layout(width, height);
    const endcard = this.phase === 'complete' || this.phase === 'endcard';
    const reg = endcard ? this.ui.endcardRegion() : r;
    if (endcard) {
      tweens.kill(this.world.view);
      this.world.view.radius = config.camera.endcardRadius;
    }
    this.world.resize(width, height, reg.top, reg.bottom);
  }

  pause(): void {
    this.paused = true;
    this.ui.app.ticker.stop();
    this.sound.mute(true);
  }

  resume(): void {
    this.paused = false;
    this.lastInteraction = performance.now();
    this.ui.app.ticker.start();
    this.sound.mute(false);
  }

  volume(v: number): void {
    this.sound.volume(v);
  }
}
