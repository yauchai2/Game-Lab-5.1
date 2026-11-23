// Phase M1：權威區域服核心引擎（30m×30m AOI 空間網格、全區世界潮汐、動態分流、星圖巡迴熱點）
'use strict';

const AOI_CELL_SIZE = 30;
const SHARD_SOFT_CAP = 25;
const SHARD_HARD_CAP = 30;
const TOTAL_FIELDS = 20;

/**
 * 30m × 30m 空間雜湊網格（Spatial Hash Grid）
 * 僅向客戶端同步周圍 3×3 格內之玩家與實體，降低 85%–90% 頻寬
 */
class SpatialGrid {
  constructor(cellSize = AOI_CELL_SIZE) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }
  _key(cx, cz) { return `${cx},${cz}`; }
  _coord(v) { return Math.floor((v || 0) / this.cellSize); }
  clear() { this.cells.clear(); }
  insert(entity) {
    const cx = this._coord(entity.x), cz = this._coord(entity.z);
    const k = this._key(cx, cz);
    let bucket = this.cells.get(k);
    if (!bucket) { bucket = []; this.cells.set(k, bucket); }
    bucket.push(entity);
  }
  queryNearby(x, z, cellRadius = 1) {
    const cx = this._coord(x), cz = this._coord(z);
    const out = [];
    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dz = -cellRadius; dz <= cellRadius; dz++) {
        const bucket = this.cells.get(this._key(cx + dx, cz + dz));
        if (bucket) {
          for (let i = 0; i < bucket.length; i++) out.push(bucket[i]);
        }
      }
    }
    return out;
  }
}

/**
 * 全區共享・世界餘燼潮汐（Zone-Wide Ember Tide）
 */
class ZoneTide {
  constructor(zoneId) {
    this.zoneId = zoneId;
    this.heat = 0;          // 0..100
    this.phase = 0;         // 0 晨光, 1 火星, 2 狂潮, 3 熾炎巔峰
    this.bossActive = false;
    this.bossHpMult = 1.0;
    this.restTimer = 0;     // 擊敗後 25 秒共享營火休整
  }
  addKill(weight = 1, activePlayers = 1) {
    if (this.restTimer > 0) return this.snapshot();
    // 依現場人數平滑稀釋單人貢獻，避免 25 人同區 5 秒爆表
    const scale = 1 / Math.max(1, Math.sqrt(activePlayers));
    this.heat = Math.min(100, this.heat + weight * 4.5 * scale);
    this.phase = this.heat >= 100 ? 3 : this.heat >= 65 ? 2 : this.heat >= 30 ? 1 : 0;
    if (this.heat >= 100 && !this.bossActive) {
      this.bossActive = true;
      this.bossHpMult = Math.round((1 + Math.max(0, activePlayers - 1) * 0.65) * 100) / 100;
    }
    return this.snapshot();
  }
  onBossDefeated() {
    this.bossActive = false;
    this.heat = 0;
    this.phase = 0;
    this.restTimer = 25; // 25 秒集體營火休整期
    return this.snapshot();
  }
  tick(dtSec) {
    if (this.restTimer > 0) {
      this.restTimer = Math.max(0, this.restTimer - dtSec);
    } else if (!this.bossActive && this.heat > 0) {
      this.heat = Math.max(0, this.heat - dtSec * 0.45);
      this.phase = this.heat >= 65 ? 2 : this.heat >= 30 ? 1 : 0;
    }
  }
  snapshot() {
    return {
      zoneId: this.zoneId,
      heat: Math.round(this.heat * 10) / 10,
      phase: this.phase,
      bossActive: this.bossActive,
      bossHpMult: this.bossHpMult,
      restTimer: Math.round(this.restTimer * 10) / 10,
    };
  }
}

/**
 * 動態分流指派（Dynamic Sharding）
 * 15–25 人合流，超過 30 人自動開啟新分流，並優先將同隊友配至同一分流
 */
function assignShard(shardsMap, baseZone, partyCode = '') {
  let list = shardsMap.get(baseZone);
  if (!list) {
    list = [{ id: `${baseZone}#1`, count: 0, parties: new Set() }];
    shardsMap.set(baseZone, list);
  }
  // 1. 優先與同小隊隊友進入同分流（未達硬上限 30 人）
  if (partyCode) {
    const mateShard = list.find(s => s.parties.has(partyCode) && s.count < SHARD_HARD_CAP);
    if (mateShard) {
      mateShard.count++;
      return mateShard.id;
    }
  }
  // 2. 優先填入未滿 25 人的現有分流，避免人口稀釋（鬼服感）
  const open = list.find(s => s.count < SHARD_SOFT_CAP);
  if (open) {
    open.count++;
    if (partyCode) open.parties.add(partyCode);
    return open.id;
  }
  // 3. 所有現有分流皆滿載，建立新分流
  const next = { id: `${baseZone}#${list.length + 1}`, count: 1, parties: new Set() };
  if (partyCode) next.parties.add(partyCode);
  list.push(next);
  return next.id;
}

/**
 * 三層星圖巡迴聚焦熱點（每 30 分鐘輪換 2 座熱門島嶼）
 */
function pickHotspots(nowMs = Date.now(), totalFields = TOTAL_FIELDS) {
  const slot = Math.floor(nowMs / (30 * 60 * 1000));
  const fieldA = ((slot * 7 + 3) % totalFields) + 1;
  let fieldB = ((slot * 13 + 9) % totalFields) + 1;
  if (fieldB === fieldA) fieldB = (fieldB % totalFields) + 1;
  const nextSwitchMs = (slot + 1) * 30 * 60 * 1000;
  return {
    slot,
    nextSwitchMs,
    hotspots: [
      { fieldId: fieldA, kind: 'gold_tide',  name: '🔥 餘燼金潮', bonus: '經驗＆掉寶 +40%' },
      { fieldId: fieldB, kind: 'food_night', name: '🍗 旅人美食夜市', bonus: '共享營火料理 Buff +50%' },
    ],
  };
}

module.exports = {
  AOI_CELL_SIZE,
  SHARD_SOFT_CAP,
  SHARD_HARD_CAP,
  SpatialGrid,
  ZoneTide,
  assignShard,
  pickHotspots,
};
