// Loaded by the local Playwright runner. Drives the same movement and combat inputs as a player.
(() => {
  const g = window.__game;
  if (!g?.ambushTrial) return;
  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.setAttribute('aria-label', '自動試玩監看');
  Object.assign(panel.style, {
    position: 'fixed', zIndex: 40, left: '12px', top: '12px', width: 'min(620px, 80vw)',
    boxSizing: 'border-box', maxHeight: 'min(220px, 35vh)', overflow: 'auto',
    fontFamily: 'var(--font-ui)', color: 'var(--ink)',
  });
  panel.innerHTML = `<strong>自動試玩</strong> <button type="button">暫停電腦操作</button>
    <div role="status"></div><div style="white-space:pre-wrap;overflow-wrap:anywhere"></div>`;
  document.body.append(panel);
  const [status, log] = panel.querySelectorAll('div');
  const button = panel.querySelector('button');
  let settings, paused = false, elapsed = 0, previousFrame, lastAction, lastUi = 0, lastLog = 0;
  let frames = [], movement = '待命', frameMs = 0;
  const zero = () => {
    g.touchInput.x = g.touchInput.z = 0;
    g.mouse.l = false;
  };
  button.onclick = () => {
    paused = !paused;
    zero();
    button.textContent = paused ? '繼續電腦操作' : '暫停電腦操作';
    // The controller pauses game simulation too, preserving the current test.
    g.draftPause = paused;
    g.keys = {};
  };
  addEventListener('pointerdown', event => {
    if (event.target.closest('#view') && settings && !paused) event.preventDefault();
  }, true);
  document.addEventListener('visibilitychange', () => { previousFrame = undefined; });
  const projected = g.player.pos.clone();

  function move(x, z) {
    const yaw = g.camYaw;
    g.touchInput.x = x * Math.cos(yaw) - z * Math.sin(yaw);
    g.touchInput.z = x * Math.sin(yaw) + z * Math.cos(yaw);
  }
  function awayFromThreat(x, z) {
    const p = g.player.pos;
    for (const sign of [1, -1]) {
      const dx = x * sign, dz = z * sign;
      if ([0.8, 1.8, 3.6].every(n => g.world.isWalk(p.x + dx * n, p.z + dz * n))) {
        move(dx, dz);
        return true;
      }
    }
    return false;
  }
  function decide() {
    const p = g.player;
    const enemies = g.enemies.filter(e => !e.dead);
    if (!enemies.length) return '等待下一波';
    if (p.roll > 0) return '翻滾中';
    const boar = enemies.find(e => e.type === 'boar');
    const thorn = enemies.find(e => e.type === 'thorn');
    const target = (settings.priority === 'thorn' ? thorn : boar) || enemies[0];
    if (p.hp < p.stats.maxHp * 0.58 && p.flask.charges && !p.healOver) g.tryFlask();

    if (boar && ['wind', 'charge'].includes(boar.state)) {
      const charge = boar.cdir;
      const x = p.pos.x - boar.pos.x, z = p.pos.z - boar.pos.z;
      const forward = x * charge.x + z * charge.y;
      const side = x * charge.y - z * charge.x;
      const sign = side >= 0 ? 1 : -1;
      if (forward > -0.55 && forward < 6.6 && Math.abs(side) < 1.32 &&
        awayFromThreat(charge.y * sign, -charge.x * sign)) {
        if (boar.state === 'charge' || boar.t >= settings.rollAt) g.tryRoll();
        return p.roll > 0 ? '翻滾避開衝鋒' : '側移離開衝鋒線';
      }
    }

    const shot = g.eprojs.find(pr => {
      const x = p.pos.x - pr.mesh.position.x, z = p.pos.z - pr.mesh.position.z;
      const speed = Math.hypot(pr.vx, pr.vz);
      const along = (x * pr.vx + z * pr.vz) / speed;
      const side = (x * pr.vz - z * pr.vx) / speed;
      return along > 0 && along < settings.shotLead && Math.abs(side) < 0.72;
    });
    if (shot && p.cds.roll <= 0) {
      const speed = Math.hypot(shot.vx, shot.vz);
      if (awayFromThreat(shot.vz / speed, -shot.vx / speed)) {
        g.tryRoll();
        return '翻滾避開荊棘彈';
      }
    }

    const x = target.pos.x - p.pos.x, z = target.pos.z - p.pos.z;
    const dist = Math.hypot(x, z);
    const name = target.type === 'thorn' ? '棘芽射手' : '狂豬';
    projected.copy(target.pos).setY(p.y).project(g.camera);
    g.mouse.x = (projected.x + 1) * innerWidth / 2;
    g.mouse.y = (1 - projected.y) * innerHeight / 2;
    const cover = g.ambushTrial.cover;
    const blocked = cover && [0.2, 0.4, 0.6, 0.8].some(t =>
      Math.abs(p.pos.x + x * t - cover.x) < cover.hw + 0.28 &&
      Math.abs(p.pos.z + z * t - cover.z) < cover.hd + 0.28);
    if (dist <= 2.52 && !blocked) {
      g.mouse.l = true;
      return boar === target && boar.state === 'rest' ? '趁狂豬收招反打' : `攻擊${name}`;
    }
    if (blocked) {
      g.world.computeFlow(target.pos.x, target.pos.z);
      const dir = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; return this; },
        normalize() { const len = Math.hypot(this.x, this.y) || 1; return this.set(this.x / len, this.y / len); } };
      if (g.world.flowDir(p.pos.x, p.pos.z, dir)) {
        move(dir.x, dir.y);
        return `繞過掩體接近${name}`;
      }
    }
    if (dist > 0.001) move(x / dist, z / dist);
    return `接近${name}`;
  }

  function tick(now) {
    const gap = previousFrame === undefined ? 0 : now - previousFrame;
    previousFrame = now;
    if (g.ambushTrial.active && settings && !paused && !document.hidden) {
      elapsed += Math.min(50, gap);
      if (gap > 0 && frames.length < 30000) {
        frames.push(gap);
        frameMs = frameMs ? frameMs * 0.9 + gap * 0.1 : gap;
      }
      zero();
      movement = decide();
      if (movement !== lastAction && now - lastLog > 700) {
        lastLog = now;
        lastAction = movement;
        console.debug('[自動試玩]', movement);
      }
      if (elapsed >= settings.limitMs) g.ambushTrial.finish('abandoned');
    }
    if (now - lastUi > 160) {
      lastUi = now;
      const last = g.ambushTrial.attempts.at(-1);
      const active = g.ambushTrial.active;
      const variant = active?.variant || last?.variant || '–';
      status.textContent = paused ? '已暫停' : `${variant} 版 · ${settings?.label || '準備中'} · ${active ? movement : '等待回合'}${active && frameMs ? ` · ${Math.round(1000 / frameMs)} FPS` : ''}`;
      button.hidden = !active;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  window.__qaPlaytest = {
    setStrategy(next) {
      settings = next;
      elapsed = 0;
      frames = [];
      frameMs = 0;
      lastAction = '';
      console.info('[自動試玩] 開始回合', settings.label);
    },
    show(text) { log.textContent = text; },
    progress() { return { paused, hidden: document.hidden }; },
    timings() {
      const sorted = frames.slice().sort((a, b) => a - b);
      return { simulatedMs: Math.round(elapsed), samples: sorted.length, p95Ms: Math.round(sorted[Math.floor((sorted.length - 1) * 0.95)] || 0) };
    },
  };
})();
