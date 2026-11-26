// 統一測試入口頁（?test 或 ?playtest=hub）：所有本機、區網與外網測試模式共用單一連結。
export function isTestHub() {
  const q = new URLSearchParams(location.search);
  return q.has('test') || q.get('playtest') === 'hub';
}

export function mountTestHub() {
  const build = document.querySelector('meta[name=lv-build]')?.content || 'local';
  const base = location.origin && location.origin !== 'null' ? location.origin + location.pathname : './';
  const state = { order: 'AB', build: 'none', party: 'LANQA' };

  const makeUrl = params => {
    const q = new URLSearchParams(params);
    const qs = q.toString();
    return (location.origin && location.origin !== 'null' ? location.pathname : './') + (qs ? '?' + qs : '');
  };
  const ambushHref = () => {
    const p = { playtest: 'ambush', order: state.order };
    if (state.build !== 'none') p.build = state.build;
    return makeUrl(p);
  };

  document.title = '燈谷行 · 統一測試入口';
  document.body.innerHTML = '';
  document.body.style.cssText = 'margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;background:#f4ead5;color:#2f241c;font-family:-apple-system,BlinkMacSystemFont,"PingFang TC","Microsoft JhengHei",sans-serif;';

  const card = document.createElement('main');
  card.style.cssText = 'width:100%;max-width:520px;background:#fffaf0;border:2px solid #5a4332;border-radius:14px;padding:22px;box-shadow:0 8px 0 rgba(59,42,42,.15);display:flex;flex-direction:column;gap:16px;';
  card.innerHTML = `
    <header style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap">
      <h1 style="margin:0;font-size:22px;letter-spacing:.5px">燈谷行 · 統一測試入口</h1>
      <code style="font-size:12px;padding:2px 8px;border-radius:999px;background:#efe2c6;color:#5a4332">build ${build}</code>
    </header>
    <p style="margin:0;font-size:13px;color:#6c5746;word-break:break-all">目前站點：${base}</p>

    <section style="display:flex;flex-direction:column;gap:8px;padding-top:10px;border-top:1px dashed #cbb896">
      <div style="font-weight:700;font-size:14px">1. 岔道伏擊灰盒試玩（30 秒核心循環）</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <span style="font-size:13px;color:#6c5746">順序：</span>
        <button type="button" data-order="AB">AB</button>
        <button type="button" data-order="BA">BA</button>
        <span style="font-size:13px;color:#6c5746;margin-left:8px">構築：</span>
        <button type="button" data-build="none">無寶石</button>
        <button type="button" data-build="frost">❄ 霜緩</button>
        <button type="button" data-build="leech">♥ 汲血</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
        <a id="hubGoAmbush" style="flex:1;text-align:center;text-decoration:none;padding:10px 14px;border-radius:8px;background:#3a7d5c;color:#fff;font-weight:700;font-size:14px">開始岔道伏擊試玩</a>
        <button type="button" id="hubCopyAmbush" style="padding:10px 12px;border-radius:8px;border:1.5px solid #5a4332;background:#f4ead5;color:#2f241c;font-weight:600;cursor:pointer">複製連結</button>
      </div>
    </section>

    <section style="display:flex;flex-direction:column;gap:8px;padding-top:10px;border-top:1px dashed #cbb896">
      <div style="font-weight:700;font-size:14px">2. 完整遊戲與多人同分流</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a href="${makeUrl({})}" style="flex:1;text-align:center;text-decoration:none;padding:10px 14px;border-radius:8px;background:#5a4332;color:#fff;font-weight:700;font-size:14px">進入完整遊戲</a>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <label style="font-size:13px;color:#6c5746" for="hubParty">組隊代碼：</label>
        <input id="hubParty" value="LANQA" maxlength="12" style="width:110px;padding:6px 8px;border:1.5px solid #927659;border-radius:6px;background:#fff;font:inherit;font-size:13px">
        <a id="hubGoParty" style="flex:1;text-align:center;text-decoration:none;padding:8px 12px;border-radius:8px;background:#c97b2c;color:#fff;font-weight:700;font-size:13px">以小隊連結進入</a>
      </div>
    </section>

    <p id="hubMsg" role="status" style="margin:0;min-height:18px;font-size:12px;color:#3a7d5c"></p>
  `;
  document.body.append(card);

  const stylePill = (btn, active) => {
    btn.style.cssText = `padding:5px 10px;border-radius:6px;border:1.5px solid #5a4332;cursor:pointer;font:inherit;font-size:13px;font-weight:${active ? 700 : 500};background:${active ? '#5a4332' : '#fff'};color:${active ? '#fff' : '#2f241c'};`;
  };
  const sync = () => {
    for (const b of card.querySelectorAll('[data-order]')) stylePill(b, b.dataset.order === state.order);
    for (const b of card.querySelectorAll('[data-build]')) stylePill(b, b.dataset.build === state.build);
    card.querySelector('#hubGoAmbush').href = ambushHref();
    const party = card.querySelector('#hubParty').value.trim() || 'LANQA';
    card.querySelector('#hubGoParty').href = makeUrl({ join: party });
  };
  for (const b of card.querySelectorAll('[data-order]')) b.onclick = () => { state.order = b.dataset.order; sync(); };
  for (const b of card.querySelectorAll('[data-build]')) b.onclick = () => { state.build = b.dataset.build; sync(); };
  card.querySelector('#hubParty').oninput = sync;
  card.querySelector('#hubCopyAmbush').onclick = async () => {
    const full = new URL(ambushHref(), location.href).href;
    try { await navigator.clipboard.writeText(full); card.querySelector('#hubMsg').textContent = '已複製：' + full; }
    catch { card.querySelector('#hubMsg').textContent = full; }
  };
  sync();
}
