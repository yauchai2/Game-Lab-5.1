import { GOODS, craft } from './frontier.js';
import { CLASSES } from './puzzle.js';
const labels = { slime:'苔團', thorn:'棘木靈', boar:'岩背野豬', moth:'暮光蛾', stag:'古樹鹿王' };
const weapons = { staff:'燈杖', blades:'雙刀', bow:'短弓', shield:'守衛盾' };
const MARKET = {
  wood: { base: 4, phase: 0, span: 4 },
  ore: { base: 6, phase: 2, span: 5 },
  fish: { base: 5, phase: 1, span: 4 },
};
export function quote(kind, time) {
  const m = MARKET[kind] || { base: 4, phase: 0, span: 4 };
  const slot = Math.floor(time / 300000);
  const delta = ((slot * (m.phase + 2) + m.phase * 3) % m.span) - 1;
  return Math.max(2, m.base + delta);
}
export function trendLabel(kind, price) {
  const base = (MARKET[kind] || { base: 4 }).base;
  if (price > base) return '▲ 高價';
  if (price < base) return '▼ 低價';
  return '● 平盤';
}
function settle(p, now) {
  const pending = [];
  for (const lot of p.sales) {
    if (lot.due <= now) p.coins += lot.price - Math.ceil(lot.price * .1);
    else pending.push(lot);
  }
  p.sales = pending;
}
export function buildLodge(g, body, title, kind) {
  const p = g.meta.p, now = Date.now();
  settle(p, now); g.meta.save();
  const refresh = () => buildLodge(g, body, title, kind);
  title.textContent = { market:'溪畔拍賣行', home:'旅人小屋', workshop:'素材工坊' }[kind];
  body.replaceChildren();
  const line = (label, hint) => {
    const row = document.createElement('div'); row.className = 'prow';
    const text = document.createElement('div'); text.className = 'pl'; text.textContent = label;
    if (hint) { const sub = document.createElement('small'); sub.textContent = hint; text.append(document.createElement('br'),sub); }
    row.append(text); body.append(row); return row;
  };
  const action = (row, label, enabled, fn) => {
    const b = document.createElement('button'); b.className = 'btn small'; b.textContent = label; b.disabled = !enabled;
    b.onclick = () => { fn(); g.meta.save(); g.recalc(); refresh(); }; row.append(b);
  };
  line('Lv.' + p.level + '　經驗 ' + p.xp + '/' + (p.level * 40) + '　金幣 ' + p.coins, Object.entries(GOODS).map(([k,n])=> n + ' ' + p.goods[k]).join('　') + '　鑰石 ' + p.keys);
  if (kind === 'market') {
    if (g.wallet) {
      const b=document.createElement('button');b.className='btn small';b.textContent='公會交易所';b.onclick=()=>g.ui.openPanel('exchange');body.append(b);
    }
    for (const [key,name] of Object.entries(GOODS)) {
      const price = quote(key, now);
      const row = line(name + ' · ' + trendLabel(key, price), '每份 ' + price + ' 金幣 · 成交稅 10%');
      action(row,'買入',p.coins >= price,() => { p.coins -= price; p.goods[key]++; });
      action(row,'寄售',p.goods[key] > 0,() => { p.goods[key]--; p.sales.push({ key, price, due:Date.now()+30000 }); });
    }
    for (const lot of p.sales) line(GOODS[lot.key] + ' · 已寄售', Math.max(1,Math.ceil((lot.due-now)/1000)) + ' 秒後由商人收購');
    action(line('NPC 商人每五分鐘調價','已裝備及鍛造的物品綁定角色。'),'結算',true,()=>{});
  } else if (kind === 'workshop') {
    action(line('鍛造並裝備珍稀裝備','香杉木 ×2、星紋礦 ×3'), '鍛造',p.goods.wood>=2 && p.goods.ore>=3,()=>{const name=craft(g); if(name) g.ui.toast('裝備了 '+name);});
    action(line('製作副本鑰石','星紋礦 ×2'), '製作',p.goods.ore>=2,()=>{p.goods.ore-=2;p.keys++;});
    action(line('鑲嵌餘燼寶石','星紋礦 ×4 · 解鎖 Q 震擊 · 附加 4 點火傷'),p.gem?'已鑲嵌':'鑲嵌',!p.gem && p.goods.ore>=4,()=>{p.goods.ore-=4;p.gem=true;});
    for (const [id,label] of Object.entries(weapons)) {
      const hint = {staff:'近身杖擊', bow:'遠距離箭矢', blades:'攻擊速度 +40%', shield:'護甲 +15'}[id];
      action(line(label,hint),p.weapon===id?'使用中':'裝備',p.weapon!==id,()=>{p.weapon=id;});
    }
  } else {
    const cost=3*(p.home+1);
    action(line('家園 · '+['營地','木屋','花園木屋','燈塔小屋'][p.home],'擴建消耗香杉木 ×'+cost),'擴建',p.home<3 && p.goods.wood>=cost,()=>{p.goods.wood-=cost;p.home++;g.updateHome();});
    action(line('香煎溪魚','溪銀魚 ×1 · 每秒恢復 2 點生命，持續五分鐘'),'烹調',p.goods.fish>=1,()=>{p.goods.fish--;p.mealUntil=Date.now()+300000;});
    const curJob = g.character?.job ?? 0;
    for (const cls of CLASSES) {
      action(line(`轉職 · ${cls.icon} ${cls.name}`, cls.summary + ' · ' + cls.desc), curJob === cls.id ? '目前職業' : '轉職', curJob !== cls.id, () => {
        if (!g.character) g.character = { job: cls.id };
        else g.character.job = cls.id;
        p.weapon = cls.weapon;
        g.ui.toast(`已轉職為 ${cls.icon} ${cls.name}`, '#ffd85a');
      });
    }
    line('生物圖鑑',Object.entries(labels).map(([id,label])=> p.species[id]?label+' ×'+p.species[id]:'未發現').join('　'));
  }
}
