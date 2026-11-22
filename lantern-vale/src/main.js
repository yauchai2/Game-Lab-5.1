import { Pipeline } from './render.js';
import { Game } from './game.js';
import { UI } from './ui.js';

const pipe = new Pipeline(document.getElementById('view'));
const ui = new UI();
const game = new Game(pipe, ui);
ui.bind(game);
window.__game = game; // debug / screenshot hook
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  game.update(dt);
  pipe.render(game.scene, game.camera, game.time);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
