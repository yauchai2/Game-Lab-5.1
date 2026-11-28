// Original skills grouped by how the player aims and delivers them. Each row is
// [id, name, minimum level, seconds cooldown, mana, power, reach, behavior].
const ACTIVE_FAMILIES = {
  bolt: {
    icon: '➶', hint: '朝瞄準方向發射', shape: [[0, 0], [1, 0]], tags: ['projectile'],
    rows: [
      ['reed_dart', '蘆鋒', 2, 2.2, 5, 1.08, 13, { speed: 19 }],
      ['hollow_needle', '空心針', 5, 3.0, 7, 0.86, 15, { speed: 22, pierce: 1 }],
      ['cinder_shot', '炭核彈', 7, 3.6, 8, 1.45, 9, { speed: 12, element: 'fire' }],
      ['rime_javelin', '霜礁梭', 10, 4.6, 10, 1.13, 14, { speed: 17, pierce: 1, slow: 1.5, element: 'frost' }],
      ['forked_glint', '雙岔光', 14, 4.2, 12, 0.88, 12, { speed: 18, count: 2, spread: 0.19 }],
      ['ridge_pin', '斷脊釘', 20, 5.3, 13, 1.68, 16, { speed: 26, stun: 0.5, pierce: 2 }],
    ],
  },
  fan: {
    icon: '⋔', hint: '扇射，對每隻敵人只結算一發', shape: [[0, 0], [1, 0], [1, 1]], tags: ['projectile'],
    rows: [
      ['seed_fan', '草籽扇', 3, 3.2, 6, 0.75, 9, { count: 3, spread: 0.30 }],
      ['briar_fan', '棘籬裂', 6, 4.0, 8, 0.84, 9, { count: 4, spread: 0.35 }],
      ['hush_fan', '低語散翎', 9, 4.8, 9, 0.82, 12, { count: 3, spread: 0.22, slow: 1.3 }],
      ['glass_fan', '碎璃羽', 12, 4.5, 11, 1.06, 10, { count: 3, spread: 0.18, pierce: 1 }],
      ['wisp_fan', '火絮散', 16, 5.4, 13, 0.92, 10, { count: 5, spread: 0.29, element: 'fire' }],
      ['hail_fan', '寒潮裂羽', 22, 6.2, 15, 0.94, 13, { count: 5, spread: 0.18, pierce: 1, slow: 1.1, element: 'frost' }],
    ],
  },
  impact: {
    icon: '◆', hint: '在瞄準點落下一次有預兆的爆擊', shape: [[0, 0], [0, 1], [1, 1]], tags: ['area', 'target'],
    rows: [
      ['stone_stamp', '墜石印', 2, 4.4, 6, 1.5, 6, { radius: 1.5, delay: 0.45 }],
      ['bell_drop', '鐘墜', 5, 5.6, 8, 1.4, 7, { radius: 1.8, delay: 0.5, stun: 0.55 }],
      ['kiln_brand', '窯心燙印', 8, 5.0, 9, 1.86, 7, { radius: 1.5, delay: 0.8, element: 'fire' }],
      ['frost_seal', '凍潮刻印', 11, 5.8, 10, 1.22, 8, { radius: 2.2, delay: 0.55, slow: 2, element: 'frost' }],
      ['storm_peg', '引雷樁', 15, 6.2, 13, 1.65, 9, { radius: 1.8, delay: 0.65, element: 'shock' }],
      ['fallen_cairn', '碎碑墜', 21, 7.6, 16, 2.35, 8, { radius: 2.4, delay: 0.95, stun: 0.6 }],
    ],
  },
  pulse: {
    icon: '◎', hint: '以自身為中心打出一圈', shape: [[0, 0], [1, 0], [0, 1]], tags: ['area'],
    rows: [
      ['bramble_step', '踏苔震', 2, 4.8, 6, 1.45, 0, { radius: 2.0 }],
      ['rime_breath', '霜息圈', 5, 5.5, 8, 1.08, 0, { radius: 2.35, slow: 1.4, element: 'frost' }],
      ['forge_beat', '鍛爐鼓震', 8, 6.0, 9, 1.75, 0, { radius: 2.05, element: 'fire' }],
      ['anchor_pulse', '沉錨震', 12, 6.5, 11, 1.52, 0, { radius: 2.5, stun: 0.62 }],
      ['mire_current', '泥沼回流', 16, 6.8, 12, 1.58, 0, { radius: 2.7, slow: 1.6, element: 'shock' }],
      ['lantern_toll', '巡燈晚鐘', 22, 7.7, 15, 1.92, 0, { radius: 3.15, stun: 0.45 }],
    ],
  },
  trail: {
    icon: '⋮', hint: '朝前方逐段炸開，適合沿路排列的敵人', shape: [[0, 0], [0, 1], [1, 1], [1, 2]], tags: ['area', 'line'],
    rows: [
      ['root_stitch', '根線縫', 3, 5.1, 7, 0.93, 5, { count: 2, radius: 1.05 }],
      ['chalk_fault', '白壤裂跡', 6, 5.7, 9, 0.90, 7, { count: 3, radius: 1.15 }],
      ['smolder_path', '炭痕道', 10, 6.1, 11, 1.02, 6, { count: 3, radius: 1.0, element: 'fire' }],
      ['rime_zig', '霜折徑', 13, 6.5, 12, 0.84, 8, { count: 3, radius: 1.2, slow: 1.4, element: 'frost' }],
      ['rolling_sparks', '串雷跡', 17, 7.1, 14, 0.88, 10, { count: 4, radius: 1.2, element: 'shock' }],
      ['watch_footfalls', '守望足跡', 23, 7.8, 16, 1.13, 9, { count: 4, radius: 1.25, stun: 0.34 }],
    ],
  },
  field: {
    icon: '▧', hint: '在目標地點留下一片持續傷害地面', shape: [[0, 0], [1, 0], [0, 1], [1, 1]], tags: ['area', 'target', 'field'],
    rows: [
      ['nettle_patch', '蕁麻甸', 3, 7.0, 7, 0.28, 5, { radius: 1.7, duration: 3 }],
      ['ash_pool', '溫灰窪', 6, 7.5, 9, 0.33, 6, { radius: 1.8, duration: 3.5, element: 'fire' }],
      ['slick_wash', '滑霜窪', 9, 8.0, 10, 0.23, 7, { radius: 2.15, duration: 4, slow: 0.9, element: 'frost' }],
      ['copper_mire', '銅潮澤', 13, 8.4, 12, 0.32, 7, { radius: 2.1, duration: 4, element: 'shock' }],
      ['sour_basin', '酸葉盆', 17, 8.8, 13, 0.42, 6, { radius: 1.75, duration: 5 }],
      ['furnace_bed', '窯床', 24, 9.4, 16, 0.40, 8, { radius: 2.65, duration: 4.5, element: 'fire' }],
    ],
  },
  ward: {
    icon: '✚', hint: '在範圍內立即恢復少量生命並傷及敵人', shape: [[0, 0], [1, 0], [2, 0]], tags: ['area', 'target', 'heal'],
    rows: [
      ['balm_glow', '微芒敷', 3, 8.0, 7, 0.55, 0, { radius: 1.9, heal: 0.065 }],
      ['moss_salute', '苔祈', 6, 8.5, 9, 0.67, 4, { radius: 2.3, heal: 0.075 }],
      ['rime_mantle', '霜披肩', 9, 9.1, 10, 0.77, 3, { radius: 2.1, heal: 0.075, slow: 1.2, element: 'frost' }],
      ['coal_vigil', '餘炭夜禱', 13, 9.0, 12, 1.0, 5, { radius: 2.05, heal: 0.08, element: 'fire' }],
      ['cairn_vigil', '石守禱', 18, 10.2, 13, 0.95, 5, { radius: 2.5, heal: 0.10, stun: 0.35 }],
      ['shore_beacon', '渡岸長明', 25, 11.0, 16, 1.04, 6, { radius: 2.9, heal: 0.11 }],
    ],
  },
  dash: {
    icon: '➤', hint: '向前短移並在落點打擊，移動無無敵', shape: [[0, 0], [1, 0], [2, 0], [2, 1]], tags: ['area', 'dash'],
    rows: [
      ['hedge_step', '籬間步', 4, 5.5, 7, 1.08, 2.1, { radius: 1.4 }],
      ['cold_stride', '凝霜踏', 7, 6.0, 9, 1.17, 2.45, { radius: 1.55, slow: 1.2, element: 'frost' }],
      ['flare_stride', '掠火步', 10, 6.4, 11, 1.52, 2.7, { radius: 1.45, element: 'fire' }],
      ['slag_hop', '躍渣踏', 14, 6.7, 12, 1.36, 3.2, { radius: 1.65, stun: 0.35 }],
      ['bolt_stride', '雷梭步', 18, 7.1, 13, 1.48, 3.45, { radius: 1.75, element: 'shock' }],
      ['bastion_leap', '跨垣踏', 25, 8.0, 16, 1.80, 3.7, { radius: 2.0, stun: 0.5 }],
    ],
  },
};

const ELEMENT_COLORS = { fire: '#ea7040', frost: '#65bddc', shock: '#a895eb' };
const FAMILY_COLORS = ['#779f50', '#39a788', '#d1924e', '#d97f8b', '#bd8e50', '#8caa5f', '#71bd9e', '#c09bc8'];
const ELEMENT_LABELS = { fire: '火焰', frost: '冰霜', shock: '雷電' };
export const NEW_ACTIVE_GEMS = Object.fromEntries(Object.entries(ACTIVE_FAMILIES).flatMap(([family, spec], i) =>
  spec.rows.map(([id, name, level, cd, mana, power, reach, behavior]) => {
    const traits = [
      ELEMENT_LABELS[behavior.element], behavior.radius && `半徑 ${behavior.radius} m`,
      reach && `距離 ${reach} m`, behavior.count && `${behavior.count} 段`,
      behavior.pierce && `穿透 ${behavior.pierce} 個目標`, behavior.delay && `${behavior.delay} 秒後生效`,
      behavior.duration && `持續 ${behavior.duration} 秒`, behavior.slow && `緩速 ${behavior.slow} 秒`,
      behavior.stun && `暈眩 ${behavior.stun} 秒`, behavior.heal && `範圍內自療 ${Math.round(behavior.heal * 100)}%`,
    ].filter(Boolean);
    return [id, {
      id, type: 'active', family, tags: spec.tags, name, short: name.slice(0, 3), icon: spec.icon, level, cd, mana,
      color: ELEMENT_COLORS[behavior.element] || FAMILY_COLORS[i], shape: spec.shape,
      price: 12 + level * 3, power, reach, ...behavior, desc: `${spec.hint}。 ${traits.join(' · ')}`,
    }];
  })
));

// Variants in the same family compete for the same link. Each variant trades
// damage, mana, geometry or time for a different use of the skill.
const SUPPORT_FAMILIES = [
  { family: 'focus', tag: 'area', icon: '⊙', color: '#c48d55', desc: '增加傷害、縮小半徑', rows: [
    ['pinpoint', '針孔透鏡', 3, { power: 0.10, radius: -0.16 }],
    ['hard_focus', '聚焦石', 10, { power: 0.15, radius: -0.25 }],
    ['kiln_focus', '窯心透鏡', 18, { power: 0.19, radius: -0.3, mana: 0.12 }],
  ] },
  { family: 'reach', tag: 'target', icon: '⌖', color: '#64adab', desc: '延伸瞄準距離、增加耗魔或冷卻', rows: [
    ['survey', '丈量刻', 4, { reach: 1.4, mana: 0.12 }],
    ['far_beacon', '遠標', 11, { reach: 2.4, cdr: -0.12 }],
    ['horizon', '天際刻', 20, { reach: 3.4, mana: 0.20 }],
  ] },
  { family: 'wide', tag: 'area', icon: '◉', color: '#62aa8c', desc: '擴大半徑、降低傷害', rows: [
    ['wide_stitch', '展形線', 3, { radius: 0.17, power: -0.10 }],
    ['broad_ring', '闊環', 9, { radius: 0.25, power: -0.14 }],
    ['moor_ring', '長野環', 17, { radius: 0.34, power: -0.20 }],
  ] },
  { family: 'quiver', tag: 'projectile', icon: '⋔', color: '#c8a35d', desc: '增加扇射投射物、降低單發威力', rows: [
    ['side_fletch', '側翎', 4, { extra: 1, power: -0.10, spread: 0.06 }],
    ['loose_fletch', '鬆羽', 12, { extra: 2, power: -0.19, spread: 0.12 }],
    ['tight_fletch', '齊翎', 20, { extra: 1, power: -0.12, spread: -0.09 }],
  ] },
  { family: 'pierce', tag: 'projectile', icon: '⌁', color: '#84a9d8', desc: '穿透敵人，交換法力或威力', rows: [
    ['reed_bore', '穿蘆孔', 6, { pierce: 1, mana: 0.15 }],
    ['long_bore', '長孔', 13, { pierce: 2, power: -0.12 }],
    ['deep_bore', '深芯孔', 21, { pierce: 3, power: -0.17, cdr: -0.13 }],
  ] },
  { family: 'velocity', tag: 'projectile', icon: '»', color: '#75a7bb', desc: '投射加速或延長飛行，交換傷害或法力', rows: [
    ['runner_wire', '疾行絲', 4, { speed: 0.24, power: -0.08 }],
    ['tail_wire', '延尾絲', 11, { speed: 0.17, duration: 0.20, mana: 0.16 }],
    ['zip_wire', '引疾絲', 19, { speed: 0.45, power: -0.13 }],
  ] },
  { family: 'efficiency', icon: '◈', color: '#887ed0', desc: '節省法力，犧牲威力或增加冷卻', rows: [
    ['light_spool', '輕線輪', 3, { mana: -0.15, power: -0.08 }],
    ['quiet_spool', '靜線輪', 8, { mana: -0.23, cdr: -0.14 }],
    ['hollow_spool', '空芯輪', 16, { mana: -0.29, power: -0.14 }],
  ] },
  { family: 'rhythm', icon: '⌛', color: '#7bae6f', desc: '縮短冷卻、增加耗魔或降低傷害', rows: [
    ['quick_notch', '急節槽', 4, { cdr: 0.08, mana: 0.16 }],
    ['split_notch', '錯節槽', 10, { cdr: 0.13, power: -0.10 }],
    ['clock_notch', '鐘節槽', 18, { cdr: 0.17, mana: 0.22, power: -0.10 }],
  ] },
  { family: 'chill', icon: '❅', color: '#74badc', desc: '命中緩速，犧牲傷害或增加冷卻', rows: [
    ['mist_lace', '霧紋', 3, { slow: 0.65, power: -0.07 }],
    ['rime_lace', '凍紋', 10, { slow: 1.1, power: -0.12 }],
    ['still_lace', '寂霜紋', 18, { slow: 1.5, cdr: -0.15 }],
  ] },
  { family: 'persistence', tag: 'field', icon: '▤', color: '#95a868', desc: '延長地面效果，交換冷卻或範圍', rows: [
    ['wet_wick', '浸芯', 5, { duration: 0.23, cdr: -0.11 }],
    ['peat_wick', '泥炭芯', 12, { duration: 0.32, radius: -0.13 }],
    ['deep_wick', '沉底芯', 19, { duration: 0.45, power: -0.18 }],
  ] },
  { family: 'medicine', tag: 'heal', icon: '✚', color: '#75b594', desc: '增加治療量，交換範圍或耗魔', rows: [
    ['balm_thread', '藥香縷', 5, { heal: 0.16, mana: 0.14 }],
    ['pure_thread', '清藥縷', 12, { heal: 0.24, radius: -0.18 }],
    ['sap_thread', '藤露縷', 20, { heal: 0.33, power: -0.20, mana: 0.15 }],
  ] },
  { family: 'stride', tag: 'dash', icon: '➤', color: '#cb8aba', desc: '增加落點位移，交換傷害或冷卻', rows: [
    ['step_knot', '踏程結', 6, { reach: 0.65, power: -0.10 }],
    ['long_knot', '遠程結', 13, { reach: 1.0, cdr: -0.17 }],
    ['span_knot', '渡程結', 21, { reach: 1.45, power: -0.19, mana: 0.15 }],
  ] },
  { family: 'force', tag: 'impact', icon: '♢', color: '#d18d62', desc: '延長命中暈眩，交換傷害或冷卻', rows: [
    ['dull_anvil', '鈍砧', 6, { stun: 0.20, power: -0.10 }],
    ['dense_anvil', '密砧', 14, { stun: 0.35, cdr: -0.16 }],
    ['deep_anvil', '沉砧', 22, { stun: 0.48, power: -0.18, mana: 0.15 }],
  ] },
];
const SUPPORT_SHAPES = [[[0, 0], [1, 0]], [[0, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0]]];
const SUPPORT_LABELS = {
  power: '傷害', radius: '半徑', mana: '耗魔', cdr: '冷卻縮減', reach: '距離', extra: '投射物', spread: '散角',
  pierce: '穿透數', speed: '投射速度', duration: '持續時間', slow: '緩速', heal: '治療', stun: '暈眩',
};
const SUPPORT_TAGS = { area: '範圍', target: '瞄準', projectile: '投射', field: '地面', heal: '治療', dash: '位移', impact: '衝擊' };
const PERCENT_EFFECTS = new Set(['power', 'radius', 'mana', 'cdr', 'speed', 'duration', 'heal']);
export const NEW_SUPPORT_GEMS = Object.fromEntries(SUPPORT_FAMILIES.flatMap(spec =>
  spec.rows.map(([id, name, level, effects], i) => {
    const numbers = Object.entries(effects).map(([key, value]) => {
      const formatted = PERCENT_EFFECTS.has(key) ? `${Math.round(value * 100)}%` : value;
      const unit = key === 'reach' ? ' m' : key === 'slow' || key === 'stun' ? ' 秒' : key === 'spread' ? ' rad' : '';
      return `${SUPPORT_LABELS[key]} ${value > 0 ? '+' : ''}${formatted}${unit}`;
    });
    return [id, {
      id, type: 'support', family: spec.family, tag: spec.tag, effects, name, short: name.slice(0, 3),
      icon: spec.icon, color: spec.color, shape: SUPPORT_SHAPES[i], price: 10 + level * 2, level,
      desc: `${spec.tag ? `適用${SUPPORT_TAGS[spec.tag]}技能。 ` : ''}${spec.desc}。 ${numbers.join(' · ')}`,
    }];
  })
));
