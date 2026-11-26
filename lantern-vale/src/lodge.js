import { GOODS, craft, rememberGear, xpForNextLevel } from './frontier.js';
import { CLASSES } from './puzzle.js';
import { MONSTER_MATS, GEAR_RECIPES, missingRecipeCosts, craftMonsterGear } from './mmo_rpg.js';
import { RARITY, fmtOf, canEquipItem, itemReqLevel, itemScore } from './loot.js';
import { addGearToBag } from './physbag.js';
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
export const AUCTION_TAX_RATE = 0.08;
export function calcAuctionNet(price) {
  return Math.max(1, price - Math.max(1, Math.round(price * AUCTION_TAX_RATE)));
}
function settle(p, now) {
  const pending = [];
  for (const lot of p.sales) {
    if (lot.due <= now) p.coins += calcAuctionNet(lot.price);
    else pending.push(lot);
  }
  p.sales = pending;
}
export function buildLodge(g, body, title, kind, recipeId = null) {
  const p = g.meta.p, now = Date.now();
  settle(p, now); g.meta.save();
  const refresh = () => buildLodge(g, body, title, kind, recipeId);
  title.textContent = { market:'溪畔拍賣行', home:'旅人小屋', workshop:'素材工坊' }[kind];
  body.replaceChildren();
  const line = (label, hint) => {
    const row = document.createElement('div'); row.className = 'prow';
    const text = document.createElement('div'); text.className = 'pl'; text.textContent = label;
    if (hint) { const sub = document.createElement('small'); sub.textContent = hint; text.append(document.createElement('br'),sub); }
    row.append(text); body.append(row); return row;
  };
  const buyGoods = (key, quantity, unitPrice) => {
    const cost = quantity * unitPrice;
    if (p.coins < cost) return;
    p.coins -= cost;
    p.goods[key] += quantity;
  };
  const action = (row, label, enabled, fn) => {
    const b = document.createElement('button'); b.className = 'btn small'; b.textContent = label; b.disabled = !enabled;
    b.onclick = () => { fn(); g.meta.save(); g.recalc(); refresh(); }; row.append(b);
  };
  line('Lv.' + p.level + '　經驗 ' + p.xp + '/' + xpForNextLevel(p.level) + '　金幣 ' + p.coins, Object.entries(GOODS).map(([k,n])=> n + ' ' + p.goods[k]).join('　') + '　鑰石 ' + p.keys);
  if (kind === 'market') {
    if (g.wallet) {
      const b=document.createElement('button');b.className='btn small';b.textContent='公會交易所';b.onclick=()=>g.ui.openPanel('exchange');body.append(b);
    }
    for (const [key,name] of Object.entries(GOODS)) {
      const price = quote(key, now);
      const row = line(name + ' · ' + trendLabel(key, price), '每份 ' + price + ' 金幣 · 成交稅 8%（回收通膨）');
      action(row,'買入',p.coins >= price,() => buyGoods(key, 1, price));
      action(row,'寄售',p.goods[key] > 0,() => { p.goods[key]--; p.sales.push({ key, price, due:Date.now()+30000 }); });
    }
    for (const lot of p.sales) line(GOODS[lot.key] + ' · 已寄售', Math.max(1,Math.ceil((lot.due-now)/1000)) + ' 秒後由商人收購');
    action(line('NPC 商人每五分鐘調價','已裝備及鍛造的物品綁定角色。'),'結算',true,()=>{});
  } else if (kind === 'workshop') {
    const mm = p.mMats || {};
    const materialStock = () => line('📦 怪物鍛造材料庫', Object.values(MONSTER_MATS)
      .map(m => `${m.icon}${m.name} ×${mm[m.id] || 0}`).join('　'));
    const preferred = GEAR_RECIPES.find(rec => rec.id === recipeId);
    const resourceLabel = key => ({ coins: '金幣', shards: '星砂' })[key] || GOODS[key] || MONSTER_MATS[key]?.name || key;
    const renderRecipe = rec => {
      const c = rec.cost || {};
      const gdStr = Object.entries(c.goods || {}).map(([k, n]) => `${GOODS[k] || k}×${n}`).join(' ');
      const matStr = Object.entries(c.mMats || {}).map(([k, n]) => `${MONSTER_MATS[k]?.icon || ''}${MONSTER_MATS[k]?.name || k}×${n}`).join(' ');
      const costStr = `🪙${c.coins || 0}${c.shards ? ` 💎${c.shards}` : ''}${gdStr ? ` ${gdStr}` : ''} ${matStr}`;
      const rName = RARITY[rec.rarity]?.name || '裝備';
      const reqLv = rec.reqLevel || 1;
      const missing = missingRecipeCosts(p, rec);
      const shortage = missing.map(({ key, count }) => `${resourceLabel(key)} ×${count}`).join('、');
      const levelNote = (p.level || 1) < reqLv ? `Lv.${reqLv} 才能穿戴` : `Lv.${reqLv} 裝備`;
      const title = `${rec === preferred ? '洞窟素材配方 · ' : ''}${rec.name} · T${rec.tier} ${rName}`;
      const row = line(title, `${shortage ? '還差 ' + shortage : '材料齊備'} · ${levelNote}`);
      row.dataset.recipeId = rec.id;
      const costInfo = document.createElement('small');
      costInfo.textContent = `配方需求 ${costStr.trim()} · ${rec.desc}`;
      row.firstElementChild.append(document.createElement('br'), costInfo);
      if (rec === preferred) {
        const sources = [];
        if (missing.some(({ key }) => key === 'ore')) sources.push('星紋礦可開採或向拍賣行購買');
        if (missing.some(({ key }) => key === 'boar_tusk')) sources.push('擊敗狂豬有機會掉落利牙，重打草原洞窟也可取得');
        if (sources.length) {
          const sourceInfo = document.createElement('small');
          sourceInfo.textContent = sources.join(' · ');
          row.firstElementChild.append(document.createElement('br'), sourceInfo);
        }
      }
      action(
        row,
        '鍛造',
        !missing.length,
        () => {
          const res = craftMonsterGear(p, rec.id, fmtOf);
          if (!res.ok) return;
          const it = res.item;
          const prev = g.player.equip[it.slot];
          if (canEquipItem(it, p.level || 1) && (!prev || itemScore(it) > itemScore(prev))) {
            if (prev) addGearToBag(p, prev);
            g.player.equip[it.slot] = it; rememberGear(g);
            g.ui.toast(`🔨 親手鍛造並自動換裝：【${it.name}】！`, RARITY[it.rarity]?.color || '#ffd85a');
          } else {
            addGearToBag(p, it);
            const lockNote = !canEquipItem(it, p.level || 1) ? `（需 Lv.${itemReqLevel(it)} 穿戴）` : '';
            g.ui.toast(`🔨 親手鍛造成功：【${it.name}】已收入物理背包${lockNote}！`, RARITY[it.rarity]?.color || '#ffd85a');
          }
          g.audio?.sfx?.(it.rarity >= 3 ? 'corruptGod' : 'classup');
        },
      );
    };
    if (preferred) {
      renderRecipe(preferred);
      const oreMissing = (preferred.cost?.goods?.ore || 0) - (p.goods.ore || 0);
      if (oreMissing > 0 && g.zone === 'town') {
        const price = quote('ore', now);
        const total = price * oreMissing;
        const offer = line(`向拍賣行補齊星紋礦 ×${oreMissing}`,
          p.coins < total ? `需 ${total} 金幣 · 金幣不足` : `共 ${total} 金幣`);
        offer.dataset.recipeOre = String(oreMissing);
        action(offer, `買入 ×${oreMissing}`, p.coins >= total, () => {
          if (preferred.cost.goods.ore - (p.goods.ore || 0) === oreMissing) buyGoods('ore', oreMissing, price);
        });
      }
    }
    materialStock();
    for (const rec of GEAR_RECIPES) if (rec !== preferred) renderRecipe(rec);
    action(line('基礎鍛造（隨機詞綴）','香杉木 ×2、星紋礦 ×3'), '鍛造',p.goods.wood>=2 && p.goods.ore>=3,()=>{const name=craft(g); if(name) g.ui.toast('裝備了 '+name);});
    action(line('製作副本鑰石','星紋礦 ×2'), '製作',p.goods.ore>=2,()=>{p.goods.ore-=2;p.keys++;});
    action(line('鑲嵌餘燼寶石','星紋礦 ×4 · 解鎖 Q 震擊 · 附加 4 點火傷'),p.gem?'已鑲嵌':'鑲嵌',!p.gem && p.goods.ore>=4,()=>{p.goods.ore-=4;p.gem=true;});
    for (const [id,label] of Object.entries(weapons)) {
      const hint = {staff:'近身杖擊', bow:'遠距離箭矢', blades:'攻擊速度 +40%', shield:'護甲 +15'}[id];
      action(line(label,hint),p.weapon===id?'使用中':'裝備',p.weapon!==id,()=>{p.weapon=id;});
    }
  } else {
    const cost=3*(p.home+1);
    action(line('家園 · '+['營地','木屋','花園木屋','燈塔小屋'][p.home],'擴建消耗香杉木 ×'+cost),'擴建',p.home<3 && p.goods.wood>=cost,()=>{p.goods.wood-=cost;p.home++;g.updateHome();});
    action(line('香煎溪魚','溪銀魚 ×1 · 每秒恢復 2 點生命（在 🍗 夜市熱點島生營火可享 +50% 共食加成！）'),'烹調',p.goods.fish>=1,()=>{p.goods.fish--;p.mealBoost=1;p.mealUntil=Date.now()+300000;});
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
