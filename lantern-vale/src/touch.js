export function bindTouch(g) {
  const el = id => document.getElementById(id);
  const hud = el('hud');
  const pad = el('touchMove'), knob = pad.firstElementChild;
  const interact = g.touchInteract = el('touchInteract');
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

  function move(e) {
    const r = pad.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) / (r.width * 0.38);
    const z = (e.clientY - r.top - r.height / 2) / (r.height * 0.38);
    const distance = Math.hypot(x, z);
    const strength = Math.max(0, Math.min(1, (distance - 0.13) / 0.87));
    input.x = distance ? x / distance * strength : 0;
    input.z = distance ? z / distance * strength : 0;
    knob.style.transform = `translate(${input.x * 25}px, ${input.z * 25}px)`;
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
  }

  const releaseMove = hold(pad, move, () => { input.x = input.z = 0; knob.style.transform = ''; }, move);
  const releaseAttack = hold(el('touchAttack'), () => { input.attack = true; attack(); }, () => { input.attack = false; });
  const releaseJump = hold(el('touchJump'), () => { input.glide = !g.raid; jump(); }, () => { input.glide = false; });
  const releaseRoll = hold(el('touchRoll'), roll, () => {});
  const reset = () => { releaseMove(); releaseAttack(); releaseJump(); releaseRoll(); };
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
