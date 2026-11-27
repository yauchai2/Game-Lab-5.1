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

/** 滑動不足 16px 時沿用點按自動瞄準。 */
export function computeSkillDragAim(dx, dy, threshold = 16) {
  const dist = Math.hypot(dx || 0, dy || 0);
  if (dist < threshold) return { active: false, dirX: 0, dirZ: 0, rangeFrac: 0 };
  return {
    active: true,
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

  let skillGesture = null;
  function readSkillDrag(x, y, gesture) {
    const drag = computeSkillDragAim(x - gesture.x, y - gesture.y);
    if (cancelZone && drag.active) {
      cancelZone.hidden = false;
      const rect = cancelZone.getBoundingClientRect();
      drag.cancelled = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      cancelZone.classList.toggle('hot', drag.cancelled);
    } else if (cancelZone) {
      cancelZone.hidden = true;
      cancelZone.classList.remove('hot');
    }
    return drag;
  }

  function endSkillGesture(event) {
    const gesture = skillGesture;
    if (!gesture || (event && event.pointerId !== gesture.id)) return;
    const release = event?.type === 'pointerup' && g.canUseTouchControls();
    const drag = release ? readSkillDrag(event.clientX, event.clientY, gesture) : null;
    skillGesture = null;
    gesture.button.classList.remove('held');
    if (cancelZone) {
      cancelZone.hidden = true;
      cancelZone.classList.remove('hot');
    }
    if (gesture.button.hasPointerCapture(gesture.id)) gesture.button.releasePointerCapture(gesture.id);
    if (!drag || drag.cancelled) return;
    let aim;
    if (drag.active) {
      const { pos, y } = g.player;
      const reach = 2.6 + drag.rangeFrac * 7.4;
      const c = Math.cos(g.camYaw || 0), s = Math.sin(g.camYaw || 0);
      aim = g.aim.clone().set(pos.x + (drag.dirX * c + drag.dirZ * s) * reach,
        y, pos.z + (drag.dirZ * c - drag.dirX * s) * reach);
    } else {
      g.aimForTouch();
      aim = g.aim.clone();
    }
    g.ui.activateHotbar(gesture.slot, true, aim);
  }
  for (let slot = 0; slot < 4; slot++) {
    const button = el(`sk-s${slot}`);
    if (!button) continue;
    button.addEventListener('pointerdown', event => {
      if (!['touch', 'pen'].includes(event.pointerType) || !g.canUseTouchControls() || g.raid || skillGesture) return;
      event.preventDefault();
      g.audio.init();
      skillGesture = { slot, button, id: event.pointerId, x: event.clientX, y: event.clientY };
      button.setPointerCapture(event.pointerId);
      button.classList.add('held');
    });
    button.addEventListener('pointermove', event => {
      if (skillGesture?.id === event.pointerId) readSkillDrag(event.clientX, event.clientY, skillGesture);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, endSkillGesture);
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
  const reset = () => { releaseMove(); releaseAttack(); releaseJump(); releaseRoll(); endSkillGesture(); };
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

  el('btnRegionMap').onclick = () => g.ui.toggleRegionMap(g);
  el('btnRegionMapClose').onclick = () => g.ui.toggleRegionMap(g);
  el('btnChatTouch').onclick = () => g.ui.focusChat();
  for (const button of document.querySelectorAll('[data-hud-action]')) {
    button.onclick = () => { el(button.dataset.hudAction).click(); };
  }
}
