// Intentional opt-in for a local, offline playtest. The normal cave uses its own layout.
export const AMBUSH_SEED = 19917;
export const AMBUSH_LAYOUTS = {
  A: { thorn: { x: 0, z: -4.8 }, cover: null },
  B: { thorn: { x: 4.8, z: -3.2 }, cover: { x: 2.1, z: 0.15, hw: 1.25, hd: 0.75, height: 2.1 } },
};
export const AMBUSH_BOAR = { x: -2, z: -1 };
export const AMBUSH_START = { x: 0, z: 5.6 };
export const AMBUSH_BUILDS = {
  none:  { id: 'none',  label: '無寶石', gemId: null },
  frost: { id: 'frost', label: '❄ 霜緩', gemId: 'frost' },
  leech: { id: 'leech', label: '♥ 汲血', gemId: 'leech' },
};

export function ambushTrialOrder() {
  const query = new URLSearchParams(location.search);
  if (query.get('playtest') !== 'ambush') return null;
  return query.get('order') === 'BA' ? 'BA' : 'AB';
}

export function ambushTrialBuild() {
  const query = new URLSearchParams(location.search);
  const raw = query.get('build');
  return raw && AMBUSH_BUILDS[raw] ? raw : 'none';
}

// Segment/box intersection, including the cover's vertical extent.
export function hitsAmbushCover(cover, fromX, y, fromZ, toX, toZ) {
  if (!cover || y < 0 || y > cover.height) return false;
  let start = 0, end = 1;
  for (const [from, to, min, max] of [
    [fromX, toX, cover.x - cover.hw, cover.x + cover.hw],
    [fromZ, toZ, cover.z - cover.hd, cover.z + cover.hd],
  ]) {
    const delta = to - from;
    if (delta === 0) {
      if (from < min || from > max) return false;
      continue;
    }
    const a = (min - from) / delta, b = (max - from) / delta;
    start = Math.max(start, Math.min(a, b));
    end = Math.min(end, Math.max(a, b));
    if (start > end) return false;
  }
  return true;
}

function inChargeLane(charge, pos) {
  const x = pos.x - charge.x, z = pos.z - charge.z;
  const forward = x * charge.dx + z * charge.dz;
  const side = x * charge.dz - z * charge.dx;
  return forward >= 0 && forward <= 6.0 + charge.radius && Math.abs(side) < charge.radius;
}

const millis = value => Math.round(value);
const outcomes = { cleared: '通關', defeated: '倒下', abandoned: '提前結束' };

export class AmbushTrial {
  constructor(game, order) {
    this.game = game;
    this.order = order;
    this.build = ambushTrialBuild();
    this.attempts = [];
    this.index = 0;
    this.cover = null;
    this.active = null;
  }

  mount() {
    document.body.classList.add('ambush-trial');
    document.getElementById('title').classList.add('hide');
    this.hud = document.getElementById('hud');
    this.panel = document.createElement('section');
    this.panel.className = 'ambush-panel panel';
    this.panel.setAttribute('aria-label', '岔道伏擊測試');
    const buildButtons = Object.values(AMBUSH_BUILDS).map(b =>
      `<button type="button" class="btn small${b.id === this.build ? ' on' : ''}" data-build="${b.id}" aria-pressed="${b.id === this.build}">${b.label}</button>`
    ).join('');
    this.panel.innerHTML = `
      <h1>岔道伏擊</h1>
      <p id="ambushStatus" role="status"></p>
      <p class="ambush-instructions">擊倒狂豬與棘芽射手。<br>
        <span class="ambush-keyboard">WASD 移動 · 左鍵普攻 · 右鍵技能 · 空白鍵翻滾 · R 喝藥</span>
        <span class="ambush-touch">左側搖桿移動 · 右側普攻、技能、翻滾與喝藥</span>
      </p>
      <div class="ambush-builds" role="group" aria-label="構築比較">
        <span>構築：</span>${buildButtons}
      </div>
      <div class="ambush-actions">
        <button type="button" class="btn" data-action="start">開始第一場</button>
        <button type="button" class="btn" data-action="retry" hidden>重試這一場</button>
        <button type="button" class="btn" data-action="next" hidden>開始第二場</button>
        <button type="button" class="btn" data-action="stop" hidden>結束此場</button>
        <button type="button" class="btn" data-action="export" hidden>下載戰報</button>
        <a class="btn" data-action="exit" href="./">回到主畫面</a>
      </div>`;
    document.body.append(this.panel);
    const button = id => this.panel.querySelector(`[data-action="${id}"]`);
    this.status = this.panel.querySelector('#ambushStatus');
    this.buildButtons = [...this.panel.querySelectorAll('[data-build]')];
    for (const el of this.buildButtons) {
      el.onclick = () => {
        if (this.active) return;
        this.build = el.dataset.build;
        for (const btn of this.buildButtons) {
          const on = btn.dataset.build === this.build;
          btn.classList.toggle('on', on);
          btn.setAttribute('aria-pressed', String(on));
        }
      };
    }
    this.buttons = Object.fromEntries(['start', 'retry', 'next', 'stop', 'export', 'exit'].map(id => [id, button(id)]));
    this.buttons.start.onclick = () => this.start();
    this.buttons.retry.onclick = () => this.start(true);
    this.buttons.next.onclick = () => { this.index++; this.start(); };
    this.buttons.stop.onclick = () => this.finish('abandoned');
    this.buttons.export.onclick = () => this.download();
    addEventListener('keydown', e => {
      if (this.game.state !== 'trial-result' || this.active || e.repeat || e.defaultPrevented || e.isComposing) return;
      const a = document.activeElement;
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
      if (e.code === 'KeyR') {
        e.preventDefault();
        this.start(true);
      } else if ((e.code === 'Enter' || e.code === 'Space') && !e.target.closest?.('button, a[href], summary')) {
        e.preventDefault();
        if (this.index === 0) { this.index++; this.start(); }
        else this.start(true);
      }
    });
    this.status.textContent = '兩場短戰鬥。每場都可以重試。';
    this.buttons.start.focus();
  }

  start(retry = false) {
    if (this.active) return;
    const now = performance.now();
    const previous = this.attempts.at(-1);
    const variant = this.order[this.index];
    const buildSpec = AMBUSH_BUILDS[this.build] || AMBUSH_BUILDS.none;
    this.active = {
      variant, round: this.index + 1, buildPreset: buildSpec.id, events: [], charges: [], damageTaken: 0, healingDone: 0, killOrder: [],
      retryAfterMs: retry ? millis(now - this.endedAt) : null,
      retryOf: retry ? previous.id : null, id: this.attempts.length + 1,
    };
    this.beganAt = now;
    this.cover = AMBUSH_LAYOUTS[variant].cover;
    const g = this.game;
    g.audio.init();
    g.keys = {};
    g.mouse.l = g.mouse.r = false;
    g.clearTouchInput();
    g.dayTime = 0.5;
    g.meta.p.level = 3;
    g.meta.p.gear = {};
    const board = [{ uid: 1, id: 'paladin_sword', x: 1, y: 1, rot: 0 }];
    if (buildSpec.gemId) board.push({ uid: 2, id: buildSpec.gemId, x: 2, y: 1, rot: 0 });
    g.meta.p.puzzle = { activePreset: 0, nextUid: 10, presets: [board, [], []], bag: [], partyGem: null, initializedClass: 0 };
    g.lastSpace = 0;
    g.hitstop = 0;
    g.combo = { count: 0, timer: 0 };
    g.puzzleIcd.clear();
    g.ui.clearDamageNumbers();
    // Reuse normal cave combat, including level scaling and part breaks.
    g.startRun({ cave: { tier: 'normal', stage: 0 } });
    this.hud.classList.remove('hide');
    this.panel.classList.add('playing');
    const buildTag = buildSpec.gemId ? ` · ${buildSpec.label}` : '';
    this.status.textContent = `第 ${this.index + 1}／2 場${buildTag}`;
    for (const [id, el] of Object.entries(this.buttons)) el.hidden = id !== 'stop';
    this.buttons.stop.blur();
  }

  event(kind, data = {}) {
    if (!this.active) return;
    this.active.events.push({ ms: millis(performance.now() - this.beganAt), kind, ...data });
  }

  beginCharge(enemy, player) {
    if (!this.active) return;
    const charge = {
      id: this.active.charges.length + 1, x: enemy.pos.x, z: enemy.pos.z,
      dx: enemy.cdir.x, dz: enemy.cdir.y, radius: enemy.r + 0.5,
      startedInLane: false, rolled: false, rollContact: false, hit: false,
    };
    charge.startedInLane = inChargeLane(charge, player.pos);
    enemy.ambushCharge = charge;
    this.active.charges.push(charge);
    this.event('boarTelegraph', { charge: charge.id, inLane: charge.startedInLane });
  }

  roll(enemy) {
    const charge = enemy?.ambushCharge;
    if (charge && (enemy.state === 'wind' || enemy.state === 'charge')) charge.rolled = true;
    this.event('roll');
  }

  endCharge(enemy, player, reach, blocked) {
    const charge = enemy.ambushCharge;
    if (!this.active || !charge) return;
    charge.endedOutsideLane = !inChargeLane(charge, player.pos);
    charge.safeResponse = charge.startedInLane && !charge.hit
      && (charge.rollContact || charge.endedOutsideLane);
    const distance = Math.hypot(player.pos.x - enemy.pos.x, player.pos.z - enemy.pos.z);
    this.event('boarRecovery', {
      charge: charge.id, safeResponse: charge.safeResponse, rolled: charge.rolled,
      windowMs: millis(enemy.chargeRecoveryS * 1000), chargeEnd: blocked ? 'blocked' : 'completed',
      distance: Math.round(distance * 100) / 100, withinMeleeReach: distance <= reach + enemy.r,
      attackWaitMs: millis(Math.max(0, player.cds.atk, player.roll) * 1000),
      rollContact: charge.rollContact, endedOutsideLane: charge.endedOutsideLane,
    });
  }

  enemyHit(enemy, damage, dot) {
    if (!this.active) return;
    this.event('enemyHit', { enemy: enemy.type, damage });
    const charge = enemy.ambushCharge;
    if (!dot && enemy.state === 'rest' && enemy.t < enemy.chargeRecoveryS &&
        charge?.endedOutsideLane !== undefined && !charge.punished) {
      charge.punished = true;
      this.event('boarPunish', {
        charge: charge.id, safeResponse: charge.safeResponse, recoveryElapsedMs: millis(enemy.t * 1000),
      });
    }
  }

  playerHit(amount, enemy, attack) {
    if (!this.active) return;
    this.active.damageTaken += amount;
    this.event('playerHit', { amount, enemy, attack });
  }

  healed(amount) {
    if (!this.active || !(amount > 0)) return;
    this.active.healingDone += Math.round(amount);
  }

  kill(enemy) {
    if (!this.active) return;
    this.active.killOrder.push(enemy.type);
    this.event('kill', { enemy: enemy.type });
  }

  finish(outcome) {
    if (!this.active) return;
    this.endedAt = performance.now();
    const attempt = this.active;
    attempt.durationMs = millis(this.endedAt - this.beganAt);
    attempt.outcome = outcome;
    this.attempts.push(attempt);
    this.active = null;
    const g = this.game;
    g.state = 'trial-result';
    g.mouse.l = g.mouse.r = false;
    g.clearTouchInput();
    this.hud.classList.add('hide');
    this.panel.classList.remove('playing');
    this.status.textContent = `第 ${this.index + 1}／2 場 · ${outcomes[outcome]}`;
    this.buttons.stop.hidden = true;
    this.buttons.retry.hidden = false;
    this.buttons.export.hidden = false;
    this.buttons.exit.hidden = false;
    this.buttons.next.hidden = this.index !== 0;
    (this.index === 0 ? this.buttons.next : this.buttons.export).focus();
  }

  report() {
    return {
      version: 2, build: document.querySelector('meta[name=lv-build]')?.content || null, encounter: 'meadow-cave-ambush', order: this.order,
      input: matchMedia('(pointer: coarse)').matches ? 'touch-layout' : 'desktop-layout',
      attempts: this.attempts,
    };
  }

  download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(this.report(), null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lantern-vale-ambush-playtest.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
