// 極簡統一試玩入口頁（?test 或 ?playtest=hub）：對陌生測試者零術語，進階測試選項收合於底部。
export function isTestHub() {
  const q = new URLSearchParams(location.search);
  return q.has('test') || q.get('playtest') === 'hub';
}

export function mountTestHub() {
  const build = document.querySelector('meta[name=lv-build]')?.content || 'local';
  const state = { order: 'AB', build: 'none' };

  const makeUrl = params => {
    const q = new URLSearchParams(params);
    const qs = q.toString();
    return (location.origin && location.origin !== 'null' ? location.pathname : './') + (qs ? '?' + qs : '');
  };
  const ambushHref = (extra = {}) => {
    const p = { playtest: 'ambush', order: state.order, ...extra };
    if (state.build !== 'none') p.build = state.build;
    return makeUrl(p);
  };

  document.title = '燈谷行 · 試玩';
  document.body.innerHTML = '';
  document.body.style.cssText = 'margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;background:#f4ead5;color:#2f241c;font-family:-apple-system,BlinkMacSystemFont,"PingFang TC","Microsoft JhengHei",sans-serif;-webkit-user-select:none;user-select:none;';

  const card = document.createElement('main');
  card.style.cssText = 'width:100%;max-width:380px;background:#fffaf0;border:2px solid #5a4332;border-radius:18px;padding:28px 22px 22px;box-shadow:0 8px 0 rgba(59,42,42,.12);display:flex;flex-direction:column;gap:14px;';
  card.innerHTML = `
    <header style="text-align:center;display:flex;flex-direction:column;gap:6px;margin-bottom:4px">
      <h1 style="margin:0;font-size:26px;letter-spacing:1px">燈谷行</h1>
      <p style="margin:0;font-size:14px;color:#6c5746;line-height:1.5">兩場約 30 秒的短戰鬥，直接開打試試手感。</p>
    </header>

    <a id="hubGoAmbush" style="display:block;text-align:center;text-decoration:none;padding:15px 18px;border-radius:12px;background:#3a7d5c;color:#fff;font-weight:700;font-size:17px;letter-spacing:.5px;box-shadow:0 3px 0 #26573f">▶ 開始戰鬥試玩</a>

    <a href="${makeUrl({})}" style="display:block;text-align:center;text-decoration:none;padding:12px 16px;border-radius:12px;border:1.5px solid #5a4332;background:#fff;color:#2f241c;font-weight:600;font-size:15px">進入完整遊戲</a>

    <details style="margin-top:6px;border-top:1px dashed #d8c6a6;padding-top:12px">
      <summary style="cursor:pointer;font-size:13px;color:#7a6552;list-style:none;text-align:center">進階測試選項 ▾</summary>
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <span style="font-size:13px;color:#6c5746">關卡順序</span>
          <div style="display:flex;gap:6px">
            <button type="button" data-order="AB">AB</button>
            <button type="button" data-order="BA">BA</button>
          </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <span style="font-size:13px;color:#6c5746">技能風格</span>
          <div style="display:flex;gap:6px">
            <button type="button" data-build="none">標準</button>
            <button type="button" data-build="frost">❄ 霜緩</button>
            <button type="button" data-build="leech">♥ 汲血</button>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <a id="hubGoBot" style="flex:1;text-align:center;text-decoration:none;padding:9px 10px;border-radius:8px;background:#2f639a;color:#fff;font-weight:600;font-size:13px">🤖 AI 自動打</a>
          <button type="button" id="hubCopyAmbush" style="flex:1;padding:9px 10px;border-radius:8px;border:1.5px solid #5a4332;background:#f4ead5;color:#2f241c;font-weight:600;font-size:13px;cursor:pointer">複製此連結</button>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="hubParty" value="LANQA" maxlength="12" aria-label="組隊代碼" style="flex:1;min-width:0;padding:8px 10px;border:1.5px solid #927659;border-radius:8px;background:#fff;font:inherit;font-size:13px;-webkit-user-select:text;user-select:text">
          <a id="hubGoParty" style="white-space:nowrap;text-decoration:none;padding:8px 14px;border-radius:8px;background:#c97b2c;color:#fff;font-weight:600;font-size:13px">小隊進入</a>
        </div>
        <p id="hubMsg" role="status" style="margin:0;min-height:16px;font-size:12px;color:#3a7d5c;word-break:break-all"></p>
        <div style="text-align:center;font-size:11px;color:#9b8876">build ${build}</div>
      </div>
    </details>
  `;
  document.body.append(card);

  const stylePill = (btn, active) => {
    btn.style.cssText = `padding:5px 10px;border-radius:7px;border:1.5px solid #5a4332;cursor:pointer;font:inherit;font-size:12px;font-weight:${active ? 700 : 500};background:${active ? '#5a4332' : '#fff'};color:${active ? '#fff' : '#2f241c'};`;
  };
  const sync = () => {
    for (const b of card.querySelectorAll('[data-order]')) stylePill(b, b.dataset.order === state.order);
    for (const b of card.querySelectorAll('[data-build]')) stylePill(b, b.dataset.build === state.build);
    card.querySelector('#hubGoAmbush').href = ambushHref();
    card.querySelector('#hubGoBot').href = ambushHref({ bot: '1' });
    const party = card.querySelector('#hubParty').value.trim() || 'LANQA';
    card.querySelector('#hubGoParty').href = makeUrl({ join: party });
  };
  for (const b of card.querySelectorAll('[data-order]')) b.onclick = () => { state.order = b.dataset.order; sync(); };
  for (const b of card.querySelectorAll('[data-build]')) b.onclick = () => { state.build = b.dataset.build; sync(); };
  card.querySelector('#hubParty').oninput = sync;
  card.querySelector('#hubCopyAmbush').onclick = async () => {
    const full = new URL(ambushHref(), location.href).href;
    try { await navigator.clipboard.writeText(full); card.querySelector('#hubMsg').textContent = '已複製連結'; }
    catch { card.querySelector('#hubMsg').textContent = full; }
  };
  sync();
}
