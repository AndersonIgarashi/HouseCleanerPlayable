import { Howl, Howler } from 'howler';
import { config } from '../config';
import { MusicResource, SoundResources } from './assets';

export class Sound {
  private sounds: Record<string, Howl> = {};
  private music?: Howl;
  private lastPlayed: Record<string, number> = {};
  private musicStarted = false;

  constructor() {
    for (const key in SoundResources) {
      this.sounds[key] = new Howl({ src: [SoundResources[key]], format: ['mp3'], volume: config.sounds.volume });
    }
    this.music = new Howl({
      src: [MusicResource.src],
      format: ['mp3'],
      volume: config.sounds.music,
      sprite: { loop: [MusicResource.loopStartMs, MusicResource.loopMs, true] }
    });
  }

  play(key: string, volume = 1, rate = 1): void {
    const s = this.sounds[key];
    if (!s) return;
    const id = s.play();
    s.volume(volume * config.sounds.volume, id);
    if (rate !== 1) s.rate(rate, id);
  }

  playThrottled(key: string, cooldownMs: number, volume = 1, rate = 1): void {
    const now = performance.now();
    if (now - (this.lastPlayed[key] || 0) < cooldownMs) return;
    this.lastPlayed[key] = now;
    this.play(key, volume, rate);
  }

  startMusic(): void {
    if (this.musicStarted || !this.music) return;
    this.musicStarted = true;
    this.music.play('loop');
  }

  unlock(): void {
    const ctx = (Howler as any).ctx as AudioContext | undefined;
    if (ctx && ctx.state !== 'running') ctx.resume();
  }

  mute(muted: boolean): void {
    Howler.mute(muted);
  }

  volume(v: number): void {
    Howler.volume(v);
  }
}
