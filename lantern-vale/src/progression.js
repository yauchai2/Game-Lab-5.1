// Phase B2：循序漸進系統解鎖、里程碑引導與地圖危險度評級

export const CORRUPT_UNLOCK_LV = 8;
export const ATLAS_UNLOCK_LV = 10;

export const PROGRESSION_MILESTONES = [
  { lv: 1,  title: '晨光草原啟程',         desc: '熟悉移動、揮擊、採集、屬性配點與物理背包' },
  { lv: 3,  title: '技能拼圖入門',         desc: '棋盤格擴充，可串聯第一顆輔助寶石' },
  { lv: 5,  title: 'T2 精鋼裝 · 藥劑上限 +1', desc: '開放 2 瓶藥劑與 T2 怪物素材鍛造，前往【低語森林】' },
  { lv: 8,  title: '鐵匠腐化改造解鎖',     desc: '開放裝備不可逆腐化賭博與進階強化共鳴' },
  { lv: 10, title: 'T1 坐騎馴養 · 異界地圖', desc: '達 60 殺可鍛造【林間巨鹿】鞍具，並解鎖 T3 星銀裝與異界地圖' },
  { lv: 12, title: '職業二轉覺醒試煉',     desc: '完成精英與專屬試煉後，於星燈祭壇覺醒二轉與 3D 招牌寶石' },
  { lv: 15, title: 'T2 雲絨角獸 · 深淵門檻', desc: '藥劑上限 3 瓶、T2 坐騎門檻，進軍 Lv.15+ 深淵抗性區域' },
  { lv: 20, title: 'T3 星翼浮鰩解鎖門檻',  desc: '二轉＋討伐守護獸 2 次可鍛造低空懸浮坐騎' },
  { lv: 25, title: 'T4 櫻風神狐 · 終局遠征', desc: '探索 12 區＋300 殺可鍛造頂級坐騎，進軍紅楓工坊與深淵古堡' },
];

export function getFieldDanger(fieldLevel, playerLevel = 1) {
  const diff = (fieldLevel || 1) - (playerLevel || 1);
  if (diff >= 6) {
    return {
      tier: 'danger',
      icon: '🔴',
      label: `極危 (高出 ${diff} 級)`,
      short: '極危',
      color: '#c83434',
      desc: '越級警戒：敵方具 45% 減傷且傷害 ×1.5，建議升級或強化裝備後再挑戰',
      xpBonus: 0,
      redZone: true,
    };
  }
  if (diff >= 3) {
    return {
      tier: 'challenge',
      icon: '🟠',
      label: `挑戰 (+25% XP)`,
      short: '挑戰',
      color: '#d97a26',
      desc: '略高於目前等級，手動擊殺可獲得 +25% 越級經驗獎勵',
      xpBonus: 0.25,
      redZone: false,
    };
  }
  if (diff <= -3) {
    return {
      tier: 'easy',
      icon: '🟢',
      label: '輕鬆巡遊',
      short: '輕鬆',
      color: '#2f8a58',
      desc: '適合輕鬆採集素材或開啟提燈自動巡遊',
      xpBonus: 0,
      redZone: false,
    };
  }
  return {
    tier: 'normal',
    icon: '🟡',
    label: '適中推薦',
    short: '適中',
    color: '#a87d28',
    desc: '與目前等級相符的推薦探險區域',
    xpBonus: 0,
    redZone: false,
  };
}

export function canCorruptGear(g) {
  if (g?.dev?.on) return true;
  return (g?.meta?.p?.level || 1) >= CORRUPT_UNLOCK_LV;
}

export function nextMilestone(playerLevel = 1) {
  return PROGRESSION_MILESTONES.find(m => m.lv > playerLevel) || null;
}

export function milestoneText(lv) {
  const hit = PROGRESSION_MILESTONES.find(m => m.lv === lv);
  return hit ? `🎯 里程碑解鎖：${hit.title} — ${hit.desc}` : null;
}
