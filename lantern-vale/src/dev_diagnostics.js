import { redactDevText } from './dev_log_sanitize.cjs';

const prefix = 'lantern-dev-event:';
const maxPending = 240;
const retention = 7 * 24 * 60 * 60 * 1000;
const pending = new Map();
let enabled = false;
let started = false;
let sending = false;
let timer;
let retryAfter = 0;
let session;
let sequence = 0;
let readContext = () => ({});
let lastSlowFrame = -Infinity;

function erase(id) {
  pending.delete(id);
  try { localStorage.removeItem(prefix + id); } catch (_) {}
}

function trim() {
  const values = [...pending.values()];
  if (values.length <= maxPending) return;
  values.sort((a, b) => Number(a.level === 'error') - Number(b.level === 'error') || a.time - b.time);
  values.slice(0, values.length - maxPending).forEach(event => erase(event.id));
}

function restore() {
  try {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(prefix));
    for (const key of keys) {
      const id = key.slice(prefix.length);
      try {
        const event = JSON.parse(localStorage.getItem(key));
        if (event?.id === id && Date.now() - event.time < retention) pending.set(id, event);
        else erase(id);
      } catch (_) { erase(id); }
    }
  } catch (_) {}
  trim();
}

async function flush() {
  if (sending || !pending.size || !window.LV_DEV_DIAGNOSTICS || Date.now() < retryAfter) return;
  sending = true;
  const events = [...pending.values()].slice(0, 8);
  try {
    const response = await fetch('/__dev/events', {
      method: 'POST', credentials: 'omit', keepalive: true,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(events),
    });
    if (!response.ok) throw Error('Dev log storage unavailable');
    const { handled } = await response.json();
    for (const event of events) if (handled.includes(event.id)) erase(event.id);
    retryAfter = 0;
  } catch (_) {
    retryAfter = Date.now() + 10000;
  } finally {
    sending = false;
    schedule(retryAfter ? 10000 : 350);
  }
}

function schedule(ms) {
  if (!window.LV_DEV_DIAGNOSTICS || timer !== undefined || !pending.size) return;
  timer = setTimeout(() => {
    timer = undefined;
    if (Date.now() < retryAfter) schedule(retryAfter - Date.now());
    else void flush();
  }, ms);
}

function logValue(value) {
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === 'object' && value !== null) return '[object]';
  if (typeof value === 'function') return '[function]';
  return String(value).slice(0, 16000);
}

export function recordDevEvent(level, kind, values) {
  if (!enabled) return;
  try {
    const event = {
      id: session + ':' + (++sequence),
      time: Date.now(), level, kind,
      build: document.querySelector('meta[name="lv-build"]')?.content,
      ...readContext(),
      text: redactDevText(values.slice(0, 8).map(logValue).join(' '), 1600),
    };
    pending.set(event.id, event);
    try { localStorage.setItem(prefix + event.id, JSON.stringify(event)); } catch (_) {}
    trim();
    schedule(350);
  } catch (_) {}
}

export function setDevRecording(on) {
  if (!started || enabled === on) return;
  if (!on) recordDevEvent('log', 'mode', ['Dev Mode 關閉']);
  enabled = on;
  if (on) recordDevEvent('log', 'mode', ['Dev Mode 開啟']);
}

export function setDevContext(context) { readContext = context; }

export function recordDevSlowFrame(elapsedMs) {
  const now = performance.now();
  if (!enabled || document.hidden || elapsedMs < 150 || elapsedMs > 2000 || now - lastSlowFrame < 30000) return;
  lastSlowFrame = now;
  recordDevEvent('warn', 'performance', [`慢幀：${Math.round(elapsedMs)} ms`]);
}

export function installDevDiagnostics() {
  if ((typeof __LV_PROD__ !== 'undefined' && __LV_PROD__) || started ||
      !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return;
  started = true;
  session = Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16).padStart(8, '0')).join('');
  restore();
  schedule(350);
  window.addEventListener('online', () => { retryAfter = 0; restore(); void flush(); });
  window.addEventListener('pagehide', () => { void flush(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) void flush(); });
  for (const level of ['log', 'info', 'debug', 'warn', 'error']) {
    const previous = console[level].bind(console);
    console[level] = (...args) => {
      recordDevEvent(level, 'console', args);
      previous(...args);
    };
  }
  window.addEventListener('error', event => {
    if (event instanceof ErrorEvent) {
      const source = event.filename ? `\n${event.filename}:${event.lineno}:${event.colno}` : '';
      recordDevEvent('error', 'uncaught', [event.error || event.message, source]);
    } else {
      const target = event.target;
      const source = target?.currentSrc || target?.src || target?.href;
      if (typeof source === 'string') recordDevEvent('error', 'resource', ['資源載入失敗', source]);
    }
  }, true);
  window.addEventListener('unhandledrejection', event => recordDevEvent('error', 'promise', [event.reason]));
  try { setDevRecording(localStorage.getItem('lv_dev_mode') === '1'); } catch (_) {}
}
