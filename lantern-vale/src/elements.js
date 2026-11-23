// 環境元素連鎖反應引擎（Divinity: Original Sin 2 / Magicka 風格）
// 支援地表狀態轉換：積水 → 冰面(滑倒) → 蒸汽(遮蔽視線) → 雷暴蒸汽(大範圍感電) / 毒霧爆燃

export const SURFACE_DEFS = {
  water:             { name: '潮濕積水', icon: '🌊', color: 0x46b0e8, opacity: 0.42, dur: 7.0, dmgMul: 0.15, slow: 0.6 },
  ice:               { name: '極寒冰面', icon: '❄️', color: 0x9cf0ff, opacity: 0.52, dur: 6.5, dmgMul: 0.35, slow: 2.4, slipStun: 1.1 },
  steam:             { name: '高溫蒸汽雲', icon: '☁️', color: 0xdce8f0, opacity: 0.56, dur: 6.5, dmgMul: 0.25, blindVision: 0.45 },
  electrified_water: { name: '感電水窪', icon: '⚡', color: 0x70e8ff, opacity: 0.54, dur: 5.5, dmgMul: 0.85, shock: 5.0 },
  electrified_steam: { name: '雷暴蒸汽雲', icon: '🌩️', color: 0xc88cff, opacity: 0.62, dur: 5.5, dmgMul: 1.15, shock: 6.0, blindVision: 0.45 },
  poison:            { name: '劇毒孢子池', icon: '🧪', color: 0x52c868, opacity: 0.44, dur: 5.5, dmgMul: 0.55, poison: 5.0, slow: 1.4 },
  magma:             { name: '熔岩火海', icon: '🔥', color: 0xff6a30, opacity: 0.50, dur: 5.5, dmgMul: 0.78, fire: true },
  frost:             { name: '極光冰陣', icon: '❄️', color: 0x7ae8ff, opacity: 0.44, dur: 5.0, dmgMul: 0.45, slow: 2.2, slipStun: 0.9 },
  rain:              { name: '星羽雨區', icon: '🌊', color: 0x6cb8ff, opacity: 0.40, dur: 5.0, dmgMul: 0.65, wet: true },
  sakura:            { name: '櫻花領域', icon: '🌸', color: 0xffa6c9, opacity: 0.42, dur: 5.2, dmgMul: 0.52, slow: 1.2 },
};

// 將不同來源地表歸一化為基礎元素態（water / ice / steam / poison / magma）
export function normalizeSurface(kind) {
  if (kind === 'rain' || kind === 'water') return 'water';
  if (kind === 'frost' || kind === 'ice') return 'ice';
  if (kind === 'steam') return 'steam';
  if (kind === 'poison') return 'poison';
  if (kind === 'magma') return 'magma';
  if (kind === 'electrified_water' || kind === 'electrified_steam') return kind;
  return null;
}

// 核心連鎖反應矩陣：輸入既有地表與新注入元素（frost / fire / shock / water）
export function resolveSurfaceReaction(surfaceKind, incomingElement) {
  const base = normalizeSurface(surfaceKind);
  if (!base || !incomingElement) return null;

  if (base === 'water' && incomingElement === 'frost') {
    return {
      reaction: 'freeze_ground', nextKind: 'ice',
      label: '❄️ 水面結冰！敵人踏上將滑倒暈眩',
      color: 0x9cf0ff, radiusMult: 1.12, bonusDmgMult: 0.95, stun: 1.1, slow: 2.6,
    };
  }
  if (base === 'water' && incomingElement === 'fire') {
    return {
      reaction: 'vaporize', nextKind: 'steam',
      label: '☁️ 水火蒸發！升騰蒸汽遮蔽敵人視線',
      color: 0xdce8f0, radiusMult: 1.25, bonusDmgMult: 0.9,
    };
  }
  if (base === 'ice' && incomingElement === 'fire') {
    return {
      reaction: 'melt_steam', nextKind: 'steam',
      label: '☁️ 融冰蒸發！化為高溫導電蒸汽雲',
      color: 0xdce8f0, radiusMult: 1.28, bonusDmgMult: 1.25,
    };
  }
  if (base === 'water' && incomingElement === 'shock') {
    return {
      reaction: 'electro_water', nextKind: 'electrified_water',
      label: '⚡ 感電水窪！電流沿水面傳導群敵',
      color: 0x70e8ff, radiusMult: 1.22, bonusDmgMult: 1.55, shock: 5.5,
    };
  }
  if (base === 'steam' && incomingElement === 'shock') {
    return {
      reaction: 'thunder_cloud', nextKind: 'electrified_steam',
      label: '🌩️ 雷暴蒸汽爆發！大範圍連鎖感電！',
      color: 0xc88cff, radiusMult: 1.45, bonusDmgMult: 2.15, shock: 6.5, stun: 0.75,
    };
  }
  if (base === 'poison' && incomingElement === 'fire') {
    return {
      reaction: 'toxic_blast', nextKind: 'magma',
      label: '💥 劇毒爆燃！毒霧點燃引爆烈焰！',
      color: 0xff6a30, radiusMult: 1.35, bonusDmgMult: 2.25, fire: true, stun: 0.65,
    };
  }
  if (base === 'magma' && incomingElement === 'water') {
    return {
      reaction: 'quench_steam', nextKind: 'steam',
      label: '☁️ 急冷蒸汽雲！遮蔽視線並準備感電',
      color: 0xdce8f0, radiusMult: 1.25, bonusDmgMult: 0.85,
    };
  }
  return null;
}

// 判斷技能／攻擊所帶有的環境元素標籤
export function inferElement({ fire, slow, frost, shock, water, poison } = {}) {
  if (shock) return 'shock';
  if (fire) return 'fire';
  if (frost || slow) return 'frost';
  if (water) return 'water';
  if (poison) return 'poison';
  return null;
}
