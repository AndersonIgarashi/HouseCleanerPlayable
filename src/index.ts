import './index.css';

import { sdk } from '@smoud/playable-sdk';
import { Game } from './Game';

sdk.init((width: number, height: number) => {
  const game = new Game(width, height);
  sdk.on('resize', game.resize, game);
  sdk.on('pause', game.pause, game);
  sdk.on('resume', game.resume, game);
  sdk.on('volume', game.volume, game);
  sdk.on('finish', () => game.finish());

  (window as any).game = game;

  game.init().then(() => {
    document.getElementById('splash')?.classList.add('hidden');
    sdk.start();
  });
});
