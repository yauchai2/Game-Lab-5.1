import { Pipeline } from './render.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';

const pipe = new Pipeline(document.getElementById('view'));
const ui = new UI();
const audio = new Audio();
const game = new Game(pipe, ui, audio);
ui.audio = audio;
ui.bind(game);
if (typeof __LV_PROD__ === 'undefined' || !__LV_PROD__) window.__game = game; // debug / screenshot hook (stripped in --prod)
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const t0 = performance.now();
  game.update(dt);
  const t1 = performance.now();
  pipe.render(game.scene, game.camera, game.time);
  const t2 = performance.now();
  game.dbg?.recordFrame(dt, t1 - t0, t2 - t1);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
