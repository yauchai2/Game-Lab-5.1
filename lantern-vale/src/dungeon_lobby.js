import { ensureAtlas } from './atlas.js';

const BOT_NAMES = ['巡燈衛士（AI）', '林風遊俠（AI）'];
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class DungeonLobby {
  constructor(g) {
    this.g = g;
    this.pending = null;
    this.run = null;
    this.bots = [];
    const net = g.net;
    net.on('dungeon_lobby', info => {
      if (!this.pending) return;
      this.pending.info = info;
      g.ui.refreshDungeonLobby?.();
    });
    net.on('dungeon_error', info => {
      if (!this.pending) return;
      this.pending.error = info.message;
      this.pending.online = false;
      g.ui.refreshDungeonLobby?.();
    });
    net.on('dungeon_begin', info => this.begin(info));
    net.on('dungeon_team', info => {
      if (this.run?.id !== info.id) return;
      if (this.run.leader !== info.leader || info.count < 2) this.clearAttacks();
      Object.assign(this.run, { leader: info.leader, count: info.count, bots: info.bots });
    });
    net.on('dungeon_wave_state', info => {
      if (!this.isWave(info)) return;
      info.hp.forEach((hp, index) => this.applyHealth(index, hp));
    });
    net.on('dungeon_enemy', info => {
      if (this.isWave(info)) this.applyHealth(info.enemy, info.hp, !info.bot, info.impact === true && info.by !== net.id);
    });
    net.on('dungeon_exit', info => {
      if (!this.isWave(info) || this.run.exit === info.exit) return;
      this.run.exit = info.exit;
      const exit = g.exits[info.exit];
      if (!exit) return;
      g.mapPin = { x: exit.x, z: exit.z, label: '隊伍選擇的出口' };
      g.ui.toast('隊伍已選定出口，跟地圖標記繼續。', '#ffe08a');
    });
    net.on('dungeon_attack', info => this.receiveAttack(info));
    net.on('dungeon_positions', info => {
      if (this.isWave(info)) this.run.points = info.points;
    });
  }

  open(spec, label, start) {
    const g = this.g;
    this.leave();
    g.keys = {};
    g.mouse.l = g.mouse.r = false;
    if (!['raid', 'cave'].includes(spec.kind)) {
      const atlas = ensureAtlas(g.meta.p);
      spec = { ...spec, variant: [atlas.density, ...[...atlas.mechanics].sort(),
        g.meta.has('swarm') ? 'extra_swarm' : 'base', g.meta.has('elite') ? 'extra_elite' : 'no_elite'].join('-') };
    }
    const online = g.net.ok && g.net.dungeonLobbies;
    this.pending = { spec, label, start, online, fill: true };
    g.ui.openPanel('dungeonLobby');
    if (online) {
      // Position precedes the join on the same socket, including a recent zone change.
      g.posT = 0;
      g.updateNet(0);
      g.net.send({ t: 'dungeon_join', spec });
    }
    return true;
  }

  cancel() {
    if (!this.pending) return;
    if (this.pending.online) this.g.net.send({ t: 'dungeon_leave' });
    this.pending = null;
  }

  disconnected() {
    this.pending && Object.assign(this.pending, { online: false, info: null, starting: false });
    this.clearAttacks();
    if (this.run) this.run.id = null;
    this.g.ui.refreshDungeonLobby?.();
  }

  launch() {
    const lobby = this.pending;
    if (!lobby || lobby.starting) return;
    if (lobby.online) {
      if (lobby.info?.leader !== this.g.net.id) return;
      lobby.starting = true;
      this.g.net.send({ t: 'dungeon_start', id: lobby.info.id, fill: lobby.fill });
      this.g.ui.refreshDungeonLobby?.();
    } else if (lobby.spec.kind !== 'raid') {
      this.begin({ bots: lobby.fill ? 2 : 0, count: 1 });
    }
  }

  begin(info) {
    const lobby = this.pending;
    if (!lobby || (info.id != null && info.id !== lobby.info?.id)) {
      if (info.id != null) this.g.net.send({ t: 'dungeon_leave' });
      return;
    }
    this.pending = null;
    this.run = { ...info, path: 'entry' };
    this.g.ui.closePanel();
    if (lobby.start(info) === false) this.leave();
  }

  raidStarted() {
    this.pending = null;
  }

  leave() {
    this.cancel();
    this.clearAttacks();
    if (this.run?.id != null) this.g.net.send({ t: 'dungeon_leave' });
    for (const bot of this.bots) this.g.removeRemote(bot.id);
    this.bots = [];
    this.run = null;
  }

  roomChanged() {
    this.clearAttacks();
    for (const bot of this.bots) this.g.removeRemote(bot.id);
    this.bots = [];
    if (this.run) {
      this.run.wave = null;
      this.run.lastFight = -Infinity;
      this.run.points = null;
      this.run.exit = null;
    }
  }

  registerWave(enemies) {
    const g = this.g, run = this.run;
    if (run?.id == null || enemies.length === 0) return;
    this.clearAttacks();
    run.wave = `${run.path}:${g.towerFloor || 0}:${g.waveIdx}`;
    run.enemies = enemies;
    run.points = null;
    run.exit = null;
    enemies.forEach((enemy, index) => { enemy.dungeonIndex = index; });
    g.posT = 0;
    g.updateNet(0);
    g.net.send({ t: 'dungeon_wave', id: run.id, wave: run.wave, count: enemies.length });
  }

  isWave(info) {
    return this.run?.id != null && this.run.id === info.id && this.run.wave === info.wave;
  }

  sharesEnemyAttack(enemy) {
    const run = this.run;
    return run?.id != null && run.attackSync && run.count > 1 && run.wave
      && run.enemies[enemy.dungeonIndex] === enemy;
  }

  followsEnemyAttack(enemy) {
    return this.sharesEnemyAttack(enemy) && this.run.leader !== this.g.net.id;
  }

  sendAttack(enemy, phase, hint, decal) {
    if (!this.sharesEnemyAttack(enemy) || this.run.leader !== this.g.net.id) return;
    const run = this.run;
    if (phase === 'warn') enemy.sharedAttack = { state: enemy.state, charge: hint[0] === 1, decal };
    else if (!enemy.sharedAttack) return;
    else if (phase === 'release' && enemy.sharedAttack.charge) enemy.sharedAttack.state = 'charge';
    else if (phase === 'end') this.clearAttack(enemy);
    else enemy.sharedAttack = null;
    this.g.net.send({ t: 'dungeon_attack', id: run.id, wave: run.wave, enemy: enemy.dungeonIndex, phase, hint });
  }

  clearAttack(enemy) {
    const attack = enemy.incomingAttack || enemy.sharedAttack;
    if (attack?.decal && !attack.decal.dead) {
      attack.decal.onDone = null;
      attack.decal.t = attack.decal.dur;
    }
    if (attack && !enemy.dead && (enemy.incomingAttack || enemy.state === attack.state)) {
      enemy.state = 'move';
      enemy.t = 0;
      enemy.cd = Math.max(0.35, enemy.cd || 0);
    }
    enemy.incomingAttack = enemy.sharedAttack = null;
  }

  clearAttacks() {
    for (const enemy of this.run?.enemies || []) this.clearAttack(enemy);
  }

  receiveAttack(info) {
    if (!this.isWave(info)) return;
    const g = this.g, enemy = this.run.enemies[info.enemy];
    if (!enemy || enemy.dead || !this.followsEnemyAttack(enemy)) return;
    if (info.phase === 'warn') {
      this.clearAttack(enemy);
      const [shape, x, z, size, extra, duration] = info.hint;
      const charge = shape === 1;
      const decal = charge
        ? g.addDecal('rect', x, z, { w: size, l: 6.4 }, 0xff5040, duration, extra)
        : g.addDecal('circle', x, z, size, 0xff633b, duration, null);
      decal.mesh.position.y = g.world.gh(x, z) + 0.16;
      enemy.incomingAttack = { charge, x, z, size, extra, decal, until: g.time + duration + 1 };
      enemy.state = charge ? 'wind' : 'meadow-strike';
      enemy.t = 0;
      if (charge) {
        enemy.facing = extra;
      } else if (enemy.type === 'thorn') enemy.rootCastLast = true;
      g.enemyCue(enemy.type === 'boar' ? 'enemyWind' : 'enemyCast', enemy.pos);
    } else {
      const attack = enemy.incomingAttack;
      if (!attack) return;
      if (info.phase === 'end') {
        this.clearAttack(enemy);
      } else if (info.phase === 'release') {
        attack.decal.t = attack.decal.dur;
        if (attack.charge) {
          enemy.state = 'charge';
          enemy.t = 0;
          attack.until = g.time + 0.9;
          g.enemyCue('enemyRelease', enemy.pos);
        } else {
          g.resolveMeadowImpact(enemy, attack.x, attack.z, attack.size, attack.extra);
          this.clearAttack(enemy);
        }
      }
    }
  }

  updateAttacks() {
    const g = this.g, run = this.run;
    if (!run.attackSync || run.count < 2 || !run.wave) return;
    for (const enemy of run.enemies) {
      const incoming = enemy.incomingAttack;
      if (incoming && (enemy.dead || g.time > incoming.until)) this.clearAttack(enemy);
      if (enemy.sharedAttack && (enemy.dead || enemy.sharedAttack.state !== enemy.state
        || enemy.sharedAttack.state !== 'charge' && (enemy.stun > 0 || enemy.statuses?.freeze > 0))) {
        this.sendAttack(enemy, 'end');
      }
    }
  }

  damage(enemy, amount, bot, impact) {
    const run = this.run;
    if (run?.id == null || !run.wave || run.enemies[enemy.dungeonIndex] !== enemy) return false;
    this.g.net.send({ t: 'dungeon_hit', id: run.id, wave: run.wave, enemy: enemy.dungeonIndex, fraction: amount / enemy.maxHp, bot: !!bot, impact });
    return true;
  }

  applyHealth(index, hp, playerHit = false, teammateImpact = false) {
    const e = this.run.enemies[index];
    if (!e || e.dead) return;
    if (e.hp > hp * e.maxHp) {
      e.flash = 0.14;
      if (teammateImpact) {
        e.squash = Math.max(e.squash || 0, 0.12);
        this.g.cueAt('hit', e.pos, 13, 0.57);
      }
      if (playerHit) this.run.lastFight = this.g.time;
    }
    e.hp = hp * e.maxHp;
    if (hp <= 0) {
      this.clearAttack(e);
      this.g.killEnemy(e);
    }
  }

  canUseExit(index) {
    const run = this.run;
    if (run?.id == null || !run.wave || (run.count < 2 && run.exit == null)) return true;
    if (run.exit != null) {
      if (run.exit !== index) this.g.ui.toast('請使用地圖標記的隊伍出口。', '#ffe08a');
      return run.exit === index;
    }
    if (this.g.time >= (run.nextExitRequest || 0)) {
      run.nextExitRequest = this.g.time + 0.45;
      this.g.net.send({ t: 'dungeon_exit', id: run.id, wave: run.wave, exit: index });
    }
    return false;
  }

  update(dt) {
    const g = this.g, run = this.run;
    if (!run || g.field || g.depth < 0 || g.state !== 'play') return;
    this.updateAttacks();
    if (run.id != null && run.wave && run.count > 1) {
      if (run.leader === g.net.id && g.time >= (run.nextPosition || 0)) {
        run.nextPosition = g.time + 0.2;
        g.net.send({ t: 'dungeon_positions', id: run.id, wave: run.wave,
          points: run.enemies.map(e => [Math.round(e.pos.x * 20) / 20, Math.round(e.pos.z * 20) / 20]) });
      } else if (run.leader !== g.net.id && run.points) {
        const blend = 1 - Math.exp(-dt * 9);
        run.points.forEach(([x, z], i) => {
          const e = run.enemies[i];
          if (!e || e.dead) return;
          const nx = e.pos.x + (x - e.pos.x) * blend;
          const nz = e.pos.z + (z - e.pos.z) * blend;
          if (g.world.isLand(nx, nz)) { e.pos.x = nx; e.pos.z = nz; }
        });
      }
    }
    if (!run.bots) return;
    const p = g.player;
    if (this.bots.length < run.bots) {
      for (let i = this.bots.length; i < run.bots; i++) {
        const id = 'bot-dungeon-' + i;
        const actor = g.addRemote(id, BOT_NAMES[i], i + 2, 'villager', i);
        actor.dungeonBot = true;
        const offset = i ? -1 : 1;
        actor.tx = p.pos.x; actor.tz = p.pos.z;
        actor.ty = g.world.gh(actor.tx, actor.tz);
        this.bots.push({ id, actor, offset, cd: 1 + i * 0.3 });
      }
    }
    for (const bot of this.bots) {
      const actor = bot.actor;
      const pos = { x: actor.tx, z: actor.tz };
      let target = null, best = 20;
      for (const enemy of g.enemies) {
        if (enemy.dead) continue;
        const d = distance(pos, enemy.pos);
        if (d < best) { best = d; target = enemy; }
      }
      const destination = target?.pos || { x: p.pos.x + 1.8 * bot.offset, z: p.pos.z + 1.5 };
      const dx = destination.x - pos.x, dz = destination.z - pos.z;
      const d = Math.hypot(dx, dz);
      const reach = bot.offset > 0 ? 1.8 : 5;
      actor.a = 0;
      if (d > (target ? reach : 1)) {
        const step = Math.min(4.2 * dt, d);
        g.moveEntity(pos, dx / d * step, dz / d * step, 0.28, actor.ty);
        actor.tx = pos.x; actor.tz = pos.z; actor.ty = g.world.gh(pos.x, pos.z);
        actor.a = 1;
      }
      if (d > 0.2) actor.tf = Math.atan2(dx, dz);
      bot.cd = Math.max(0, bot.cd - dt);
      if (target && d <= reach + 0.15 && bot.cd === 0 && g.time - (run.lastFight ?? -Infinity) < 7) {
        bot.cd = bot.offset > 0 ? 1.45 : 1.85;
        actor.pendingCombat = bot.offset < 0 ? 'bow' : 'shield';
        if (bot.offset < 0) actor.pendingCombatTarget = target.pos;
        if (run.id == null || run.leader === g.net.id) {
          g.hitEnemy(target, { dmg: Math.max(1, Math.round(2 + p.stats.baseDmg * 0.28)) }, 0, 0, { dungeonBot: true, isTrigger: true });
        }
      }
    }
  }
}
