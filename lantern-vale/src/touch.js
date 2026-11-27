/** 計算浮動搖桿圓心：夾緊在左手感應區內避免切邊 */
export function computeFloatingOrigin(clientX, clientY, zoneRect, padRadius = 54) {
  const minX = zoneRect.left + padRadius;
  const maxX = Math.max(minX, zoneRect.right - padRadius);
  const minY = zoneRect.top + padRadius;
  const maxY = Math.max(minY, zoneRect.bottom - padRadius);
  const cx = Math.max(minX, Math.min(maxX, clientX));
  const cy = Math.max(minY, Math.min(maxY, clientY));
  return { cx, cy, offsetX: cx - zoneRect.left - padRadius, offsetY: cy - zoneRect.top - padRadius };
}

/** 計算搖桿正規化向量與旋鈕位移（含 14% 防抖死區） */
export function computeJoystickVector(clientX, clientY, originX, originY, maxTravel = 40, deadzone = 0.14) {
  const dx = clientX - originX;
  const dy = clientY - originY;
  const dist = Math.hypot(dx, dy);
  const norm = dist / Math.max(1, maxTravel);
  const strength = Math.max(0, Math.min(1, (norm - deadzone) / (1 - deadzone)));
  const ux = dist > 0 ? dx / dist : 0;
  const uz = dist > 0 ? dy / dist : 0;
  const knobTravel = maxTravel * 0.72;
  return {
    x: ux * strength,
    z: uz * strength,
    strength,
    knobX: +(ux * Math.min(1, norm) * knobTravel).toFixed(1),
    knobY: +(uz * Math.min(1, norm) * knobTravel).toFixed(1),
  };
}

/** P1 技能按住拖曳瞄準與取消區判定：滑動 < 16px 視為輕點自動鎖敵；滑至右上角取消區則取消施法 */
export function computeSkillDragAim(dx, dy, threshold = 16, cancelDx = 42, cancelDy = -52) {
  const dist = Math.hypot(dx || 0, dy || 0);
  if (dist < threshold) return { active: false, cancelled: false, dirX: 0, dirZ: 0, rangeFrac: 0 };
  if (dx >= cancelDx && dy <= cancelDy) return { active: true, cancelled: true, dirX: 0, dirZ: 0, rangeFrac: 0 };
  return {
    active: true,
    cancelled: false,
    dirX: +(dx / dist).toFixed(3),
    dirZ: +(dy / dist).toFixed(3),
    rangeFrac: +Math.min(1, dist / 72).toFixed(3),
  };
}

const HAPTIC_PATTERNS = {
  light: 10,
  combo3: 12,
  crit: 18,
  hurt: 28,
  enhance: [15, 40, 25],
};

/** P2 觸覺震動分級回饋（安全檢查瀏覽器支援與設定開關） */
export function triggerHaptic(kind = 'light', enabled = true) {
  if (!enabled) return false;
  const pat = HAPTIC_PATTERNS[kind] || HAPTIC_PATTERNS.light;
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { return !!navigator.vibrate(pat); } catch { return false; }
  }
  return false;
}

export function bindTouch(g) {
  const el = id => document.getElementById(id);
  const hud = el('hud');
  const zone = el('touchMovement');
  const pad = el('touchMove'), knob = pad.firstElementChild;
  const interact = g.touchInteract = el('touchInteract');
  const cancelZone = el('touchCancelZone');
  const input = g.touchInput = { x: 0, z: 0, attack: false, glide: false };

  function hold(button, start, stop, move = null) {
    let pointer = null;
    function release(e) {
      if (pointer === null || (e?.pointerId != null && e.pointerId !== pointer)) return;
      const id = pointer;
      pointer = null;
      button.classList.remove('held');
      stop();
      if (button.hasPointerCapture(id)) button.releasePointerCapture(id);
    }
    button.addEventListener('touchstart', e => {
      if (g.canUseTouchControls()) e.preventDefault();
    }, { passive: false });
    button.addEventListener('contextmenu', e => e.preventDefault());
    button.addEventListener('pointerdown', e => {
      if (pointer !== null || e.button !== 0 || !g.canUseTouchControls()) return;
      e.preventDefault();
      pointer = e.pointerId;
      button.setPointerCapture(pointer);
      button.classList.add('held');
      start(e);
    });
    if (move) button.addEventListener('pointermove', e => { if (e.pointerId === pointer) move(e); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, release);
    return release;
  }
  const blockSelect = e => {
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
  };
  hud.addEventListener('selectstart', blockSelect);
  hud.addEventListener('contextmenu', blockSelect);

  let joyOrigin = null;
  function startMove(e) {
    const zr = zone.getBoundingClientRect();
    const padR = (pad.offsetWidth || 108) * 0.5;
    const o = computeFloatingOrigin(e.clientX, e.clientY, zr, padR);
    joyOrigin = { x: o.cx, y: o.cy, maxTravel: Math.max(32, padR * 0.78) };
    pad.classList.add('held', 'floating');
    pad.style.left = `${o.offsetX}px`;
    pad.style.top = `${o.offsetY}px`;
    pad.style.bottom = 'auto';
    updateMove(e);
  }
  function updateMove(e) {
    if (!joyOrigin) return;
    const v = computeJoystickVector(e.clientX, e.clientY, joyOrigin.x, joyOrigin.y, joyOrigin.maxTravel);
    input.x = v.x;
    input.z = v.z;
    knob.style.transform = `translate(${v.knobX}px, ${v.knobY}px)`;
  }
  function stopMove() {
    joyOrigin = null;
    input.x = input.z = 0;
    knob.style.transform = '';
    pad.classList.remove('held', 'floating');
    pad.style.left = '';
    pad.style.top = '';
    pad.style.bottom = '';
  }

  // P1 技能按住拖曳瞄準與取消區（#sk-s0..3）
  for (let slot = 0; slot < 4; slot++) {
    const btn = el(`sk-s${slot}`);
    if (!btn) continue;
    let pid = null, sx = 0, sy = 0, dragAim = null;
    btn.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch' || !g.canUseTouchControls() || pid !== null) return;
      pid = e.pointerId; sx = e.clientX; sy = e.clientY; dragAim = null;
      btn.setPointerCapture(pid);
      btn.classList.add('held');
    });
    btn.addEventListener('pointermove', e => {
      if (e.pointerId !== pid) return;
      const res = computeSkillDragAim(e.clientX - sx, e.clientY - sy);
      dragAim = res;
      if (cancelZone) {
        cancelZone.hidden = !res.active;
        cancelZone.classList.toggle('hot', res.cancelled);
      }
      if (res.active && !res.cancelled && g.player?.pos && g.aim) {
        const reach = 2.6 + res.rangeFrac * 7.4;
        g.aim.set(g.player.pos.x + res.dirX * reach, g.player.y || 0, g.player.pos.z + res.dirZ * reach);
      }
    });
    const endSkillDrag = e => {
      if (pid === null || (e?.pointerId != null && e.pointerId !== pid)) return;
      const wasActive = !!dragAim?.active;
      const wasCancelled = !!dragAim?.cancelled;
      const id = pid; pid = null; dragAim = null;
      btn.classList.remove('held');
      if (cancelZone) { cancelZone.hidden = true; cancelZone.classList.remove('hot'); }
      if (btn.hasPointerCapture(id)) btn.releasePointerCapture(id);
      if (wasCancelled) {
        g.ui?.toast?.('已取消施法', '#b8c4d8');
        btn.dataset.suppressClick = '1';
        setTimeout(() => { delete btn.dataset.suppressClick; }, 60);
      } else if (wasActive && g.canUseTouchControls()) {
        triggerHaptic('light', g.settings?.haptics !== 0);
        g.tryCastPuzzleSkill?.(slot);
        btn.dataset.suppressClick = '1';
        setTimeout(() => { delete btn.dataset.suppressClick; }, 60);
      }
    };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(type, endSkillDrag);
    btn.addEventListener('click', e => {
      if (btn.dataset.suppressClick) { e.stopImmediatePropagation(); e.preventDefault(); }
    }, true);
  }

  function attack() {
    if (g.raid) return;
    g.audio.init();
    g.aimForTouch();
    g.tryAttack();
  }
  function jump() {
    if (g.raid) return;
    g.audio.init();
    g.tryJump();
  }
  function roll() {
    if (g.raid || !g.canUseTouchControls()) return;
    g.audio.init();
    g.aimForTouch();
    g.tryRoll();
    triggerHaptic('light', g.settings?.haptics !== 0);
  }

  const releaseMove = hold(zone, startMove, stopMove, updateMove);
  const releaseAttack = hold(el('touchAttack'), () => { input.attack = true; attack(); }, () => { input.attack = false; });
  const releaseJump = hold(el('touchJump'), () => { input.glide = !g.raid; jump(); }, () => { input.glide = false; });
  const releaseRoll = hold(el('touchRoll'), roll, () => {});
  const reset = () => { releaseMove(); releaseAttack(); releaseJump(); releaseRoll(); if (cancelZone) cancelZone.hidden = true; };
  g.clearTouchInput = reset;
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', reset);
  matchMedia('(any-pointer: coarse)').addEventListener('change', reset);

  el('touchAttack').onclick = e => { if (e.detail === 0 && g.canUseTouchControls()) attack(); };
  el('touchJump').onclick = e => { if (e.detail === 0 && g.canUseTouchControls()) jump(); };
  el('touchRoll').onclick = e => { if (e.detail === 0 && g.canUseTouchControls()) roll(); };
  interact.onclick = () => {
    if (g.raid) { g.net.send({ t: 'raidLeave' }); return; }
    if (g.gatherActive) { g.gatherActive.trigger(); return; }
    if (g.canUseTouchControls() && !g.tryInteract()) g.tryPickup();
  };

  const details = el('touchDetails');
  details.onclick = () => {
    reset();
    if (g.ui.openTouchJourney?.()) return;
    const open = hud.classList.toggle('touch-details-open');
    details.setAttribute('aria-expanded', String(open));
  };
  el('btnRegionMap').onclick = () => g.ui.toggleRegionMap(g);
  el('btnRegionMapClose').onclick = () => g.ui.toggleRegionMap(g);
  el('btnChatTouch').onclick = () => g.ui.focusChat();
  for (const button of document.querySelectorAll('[data-hud-action]')) {
    button.onclick = () => { el(button.dataset.hudAction).click(); };
  }
}
