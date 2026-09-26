// playable-scripts build, plus one alias: pixi's deprecated utils.url is the only importer of the
// Node `url` polyfill (which drags in qs, ~50 KB) and nothing calls it. CLI flags still work.
process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';

const { runBuild } = require('@smoud/playable-scripts');

runBuild(undefined, undefined, undefined, { resolve: { alias: { url: false } } }).catch(() => process.exit(1));
