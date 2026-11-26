const focusable = 'button, a[href], input, select, textarea, summary, [tabindex]';

// Existing panels keep ownership of their open/close state and game-specific cleanup.
export function bindGameLayers(game, definitions) {
  const layers = definitions.map(([id, close, initial, shortcuts = []]) => {
    const root = document.getElementById(id);
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.tabIndex = -1;
    const heading = root.querySelector('h2, h3');
    if (root.dataset.dialogLabel) root.setAttribute('aria-label', root.dataset.dialogLabel);
    else if (heading) {
      heading.id ||= id + '-title';
      root.setAttribute('aria-labelledby', heading.id);
    }
    return { root, close, initial, shortcuts, visible: false, opener: null, previousFocus: null };
  });
  let stack = [];
  const blocked = new Set();
  const nativeOpen = () => document.querySelector('dialog[open]');
  const canFocus = el => !el.disabled && el.tabIndex >= 0 && !el.closest('[inert]') && el.getClientRects().length > 0;
  const targets = layer => [...layer.root.querySelectorAll(focusable)].filter(canFocus);
  const focusLayer = layer => {
    const requested = layer.initial && layer.root.querySelector(layer.initial);
    (requested && canFocus(requested) ? requested : targets(layer)[0] || layer.root).focus({ preventScroll: true });
  };

  function sync() {
    let returnTo;
    for (const layer of layers) {
      const visible = !layer.root.classList.contains('hide');
      if (visible === layer.visible) continue;
      layer.visible = visible;
      if (visible) {
        const focused = document.activeElement;
        layer.opener = layer.root.contains(focused) || focused === document.body ? layer.previousFocus : focused;
        game.keys = {};
        game.mouse.l = game.mouse.r = false;
        game.clearTouchInput?.();
        stack.push(layer);
      } else {
        if (stack.at(-1) === layer) returnTo = layer.opener;
        stack = stack.filter(item => item !== layer);
      }
    }
    for (const el of blocked) el.inert = false;
    blocked.clear();
    const top = stack.at(-1);
    if (top) {
      for (let node = top.root; node.parentElement && node !== document.body; node = node.parentElement) {
        for (const sibling of node.parentElement.children) {
          if (sibling === node || sibling.inert || sibling.matches('script, style, dialog, #toasts')) continue;
          sibling.inert = true;
          blocked.add(sibling);
        }
      }
    }
    if (nativeOpen()) return;
    if (returnTo?.isConnected && canFocus(returnTo)) {
      returnTo.focus({ preventScroll: true });
    } else if (top && !top.root.contains(document.activeElement)) {
      focusLayer(top);
    }
  }

  document.addEventListener('focusin', event => {
    for (const layer of layers) {
      if (!layer.visible && !layer.root.contains(event.target)) layer.previousFocus = event.target;
    }
  });
  const observer = new MutationObserver(sync);
  for (const layer of layers) observer.observe(layer.root, { attributes: true, attributeFilter: ['class'] });
  game.ui.blocksGameKey = event => {
    const native = nativeOpen();
    if (native) return native.id !== 'worldMap' || !['KeyM', 'Escape'].includes(event.code);
    if (document.querySelector('#menuPop:not(.hide)')) return true;
    const top = stack.at(-1);
    return !!top && (!top.shortcuts.includes(event.code) ||
      !!event.target.closest?.('input, select, textarea, [contenteditable]'));
  };
  window.addEventListener('keydown', event => {
    const top = stack.at(-1);
    if (!top || nativeOpen() || event.isComposing) return;
    if (event.key === 'Escape' && top.close) {
      event.preventDefault();
      event.stopImmediatePropagation();
      top.close();
    } else if (event.key === 'Tab') {
      const items = targets(top);
      const at = items.indexOf(document.activeElement);
      if (!items.length || at < 0 || (event.shiftKey ? at === 0 : at === items.length - 1)) {
        event.preventDefault();
        (items[event.shiftKey ? items.length - 1 : 0] || top.root).focus();
      }
    }
  }, true);
  sync();
}

export function openTextDialog(options) {
  const dialog = document.getElementById('textDialog');
  if (dialog.open) return;
  const form = dialog.querySelector('form');
  const field = dialog.querySelector('textarea');
  const submit = dialog.querySelector('[type="submit"]');
  const cancel = dialog.querySelector('[data-dialog-cancel]');
  const message = dialog.querySelector('[role="alert"]');
  const opener = document.activeElement;
  dialog.querySelector('h2').textContent = options.title;
  dialog.querySelector('p').textContent = options.description;
  field.parentElement.hidden = options.value === undefined;
  field.value = options.value ?? '';
  field.readOnly = !!options.readOnly;
  field.removeAttribute('aria-invalid');
  message.textContent = '';
  submit.hidden = !options.action;
  submit.textContent = options.action || '';
  submit.classList.toggle('danger', !!options.danger);
  cancel.textContent = options.action ? '取消' : '關閉';
  form.onsubmit = event => {
    event.preventDefault();
    const result = options.submit?.(field.value);
    if (typeof result === 'string') {
      message.textContent = result;
      field.setAttribute('aria-invalid', 'true');
      field.focus();
    } else dialog.close();
  };
  cancel.onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    field.value = '';
    form.onsubmit = null;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }, { once: true });
  dialog.showModal();
  (field.parentElement.hidden ? cancel : field).focus();
  if (options.readOnly) field.select();
}
