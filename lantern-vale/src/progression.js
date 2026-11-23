// Phase B2：循序漸進系統解鎖、里程碑引導與地圖危險度評級

export const CORRUPT_UNLOCK_LV = 8;
export const ATLAS_UNLOCK_LV = 10;

export const PROGRESSION_MILESTONES = [
  { lv: 1,  title: '晨光草原啟程',     desc: '熟悉移動、揮擊、採集與物理背包' },
  { lv: 3,  title: '技能拼圖入門',     desc: '棋盤格擴充，可串聯第一顆輔助寶石' },
  { lv: 5,  title: '藥劑上限 +1 (2 瓶)', desc: '建議前往【低語森林】挑戰進階怪物' },
  { lv: 8,  title: '鐵匠腐化改造解鎖', desc: '開放裝備不可逆腐化賭博與精鋼階鍛造' },
  { lv: 10, title: '異界地圖裝置解鎖', desc: '開放詞綴疊加地城（Atlas Map Crafter）' },
  { lv: 14, title: '藥劑上限 +1 (3 瓶)', desc: '具備遠征沉淵與星穹群島的續航力' },
  { lv: 22, title: '頂尖旅人覺醒',     desc: '解鎖高危異星蜂巢與深淵古堡終局挑戰' },
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
