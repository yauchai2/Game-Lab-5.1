import { Pipeline } from './render.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';
import { ambushTrialOrder } from './ambush_trial.js';
import { isTestHub, mountTestHub } from './test_hub.js';
import { makeItem } from './loot.js';
import { installDevDiagnostics, recordDevSlowFrame, setDevContext } from './dev_diagnostics.js';

const hideBootSplash = () => {
  const el = document.getElementById('bootSplash');
  if (!el) return;
  el.classList.add('out');
  setTimeout(() => el.remove(), 300);
};

if (isTestHub()) {
  document.getElementById('bootSplash')?.remove();
  mountTestHub();
} else {
  startApp();
}

function startApp() {
installDevDiagnostics();

const pipe = new Pipeline(document.getElementById('view'));
const ui = new UI();
const audio = new Audio();
const game = new Game(pipe, ui, audio, ambushTrialOrder());
ui.audio = audio;
ui.bind(game);
game.ambushTrial?.mount();
if (game.ambushTrial) {
  game.updateCamera(0);
  setDevContext(() => ({
    zone: 'playtest:ambush',
    state: game.state,
    viewport: `${innerWidth}x${innerHeight}`,
  }));
}
if (typeof __LV_PROD__ === 'undefined' || !__LV_PROD__) { window.__game = game; window.__makeItem = makeItem; } // debug / screenshot hook (stripped in --prod)
game.updateCamera(0);
pipe.render(game.scene, game.camera, game.time);
hideBootSplash();
let last = null;
document.addEventListener('visibilitychange', () => {
  last = null;
  if (document.hidden) game.audio.setGlide(false);
});
function frame(now) {
  const elapsedMs = last === null ? 1000 / 60 : now - last;
  const dt = Math.min(0.05, Math.max(0, elapsedMs / 1000));
  last = now;
  const t0 = performance.now();
  game.update(dt);
  game.audio.setGlide(Boolean(game.player.gliding && game.state === 'play' && !game.ui.mapDialog?.open &&
    !game.draftPause && !game.sailing && !game.photoMode && !document.hidden));
  game.questGuide.update(game);
  const t1 = performance.now();
  pipe.render(game.scene, game.camera, game.time);
  const t2 = performance.now();
  game.dbg?.recordFrame(dt, t1 - t0, t2 - t1);
  recordDevSlowFrame(elapsedMs);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
}
