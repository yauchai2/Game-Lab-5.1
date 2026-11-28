// Persistent online wallets and a shared, server-simulated boss arena.
const { DatabaseSync } = require('node:sqlite');
const { createHash } = require('node:crypto');
const { mkdirSync } = require('node:fs');
const path = require('node:path');

module.exports = function createGuild(filename, { scaleRaidPopulation = false } = {}) {
  if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive:true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS members(id TEXT PRIMARY KEY, coins INTEGER NOT NULL DEFAULT 0, amber INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS lots(id INTEGER PRIMARY KEY, seller TEXT NOT NULL, price INTEGER NOT NULL);
  `);
  const AUCTION_TAX_RATE = 0.08;
  const rooms = new Map(), online = new Map();
  const send = (me, msg) => { if (me.ws.readyState===1) me.ws.send(JSON.stringify(msg)); };
  const fetchLots = () => db.prepare('SELECT id,price,seller FROM lots ORDER BY price,id LIMIT 50').all();
  function wallet(me, cachedLots = null) {
    if (!me.member) return;
    const balance = db.prepare('SELECT coins,amber FROM members WHERE id=?').get(me.member);
    const rawLots = cachedLots || fetchLots();
    const lots = rawLots.map(l => ({ id: l.id, price: l.price, mine: l.seller === me.member ? 1 : 0 }));
    send(me,{t:'wallet',...balance,lots});
  }
  function scaleUnstartedRaid(room) {
    if (!scaleRaidPopulation || room.started) return;
    const players = [...room.members.values()].filter(fighter => !fighter.bot).length;
    room.hp = room.maxHp = 112 + 32 * (Math.max(1, players) - 1);
  }
  function leave(me) {
    const room = me.raid; if (!room) return;
    room.members.delete(me.id); me.raid=null;
    if (![...room.members.values()].some(fighter => !fighter.bot)) rooms.delete(room.code);
    else scaleUnstartedRaid(room);
    send(me,{t:'raidExit'});
  }
  function disconnect(me) { leave(me); if (online.get(me.member)===me) online.delete(me.member); }
  function trade(me,m) {
    let affectedSeller = null;
    db.exec('BEGIN IMMEDIATE');
    try {
      if (m.op==='list' && Number.isSafeInteger(m.price) && m.price>0 && m.price<=9999) {
        const count=db.prepare('SELECT count(*) AS n FROM lots WHERE seller=?').get(me.member).n;
        if (count<10 && db.prepare('UPDATE members SET amber=amber-1 WHERE id=? AND amber>=1').run(me.member).changes) {
          db.prepare('INSERT INTO lots(seller,price) VALUES(?,?)').run(me.member,m.price);
        }
      } else if ((m.op==='buy'||m.op==='cancel') && Number.isSafeInteger(m.id)) {
        const lot=db.prepare('SELECT * FROM lots WHERE id=?').get(m.id);
        if (lot && m.op==='cancel' && lot.seller===me.member) {
          db.prepare('UPDATE members SET amber=amber+1 WHERE id=?').run(me.member);
          db.prepare('DELETE FROM lots WHERE id=?').run(m.id);
        } else if (lot && m.op==='buy' && lot.seller!==me.member && db.prepare('UPDATE members SET coins=coins-?,amber=amber+1 WHERE id=? AND coins>=?').run(lot.price,me.member,lot.price).changes) {
          const tax = Math.max(1, Math.round(lot.price * AUCTION_TAX_RATE));
          db.prepare('UPDATE members SET coins=coins+? WHERE id=?').run(lot.price - tax, lot.seller);
          db.prepare('DELETE FROM lots WHERE id=?').run(m.id);
          affectedSeller = lot.seller;
        }
      }
      db.exec('COMMIT');
    } catch(e) { db.exec('ROLLBACK'); throw e; }
    // Phase M4A：單次查詢共享 lots 快取，避免 N 人同時在線引發全服 DB 查詢風暴
    const sharedLots = fetchLots();
    wallet(me, sharedLots);
    if (affectedSeller && online.has(affectedSeller)) wallet(online.get(affectedSeller), sharedLots);
    if (online.size <= 32) {
      for (const member of online.values()) {
        if (member !== me && member.member !== affectedSeller) wallet(member, sharedLots);
      }
    } else {
      for (const member of online.values()) {
        if (member !== me && member.member !== affectedSeller) send(member, { t: 'marketDirty' });
      }
    }
  }
  function joinRaid(me, code, power = 8) {
    let room = rooms.get(code);
    if (!room) {
      room = { code, members: new Map(), hp: 144, maxHp: 144, started: false, x: 0, z: 0, clock: 0, portalsLeft: 6 };
      rooms.set(code, room);
    }
    if (room.members.size >= 4) { send(me, { t: 'guildNotice', text: '此組隊副本已滿。' }); return null; }
    room.members.set(me.id, { me, x: 0, z: 4, dx: 0, dz: 0, hp: 100, attack: false, cooldown: 0, damage: 0, power, mitigated: 0 });
    me.raid = room;
    scaleUnstartedRaid(room);
    send(me, { t: 'raidStart', code, portalsLeft: room.portalsLeft });
    return room;
  }

  function startDungeonRaid(members, id, bots) {
    let room;
    for (const member of members) room = joinRaid(member, `lobby-${id}`) || room;
    if (!room) return;
    for (let i = 0; i < bots; i++) {
      const actor = { id: `ai-${i}`, name: i === 0 ? '巡燈衛士（AI）' : '林風遊俠（AI）' };
      room.members.set(actor.id, { me: actor, bot: true, x: i ? -2 : 2, z: 4, dx: 0, dz: 0, hp: 100,
        attack: false, cooldown: 0, damage: 0, power: 4, mitigated: 0 });
    }
  }
  function message(me,m) {
    if (m.t==='guildHello') {
      if (me.member || typeof m.secret!=='string' || !/^[a-f0-9]{64}$/.test(m.secret)) return;
      const id=createHash('sha256').update(m.secret).digest('hex');
      if (online.has(id)) { send(me,{t:'guildNotice',text:'此角色已在另一個視窗連線。'}); return; }
      me.member=id; online.set(id,me);
      db.prepare('INSERT OR IGNORE INTO members(id) VALUES(?)').run(id); wallet(me); return;
    }
    if (!me.member) return;
    if (m.t==='raidInput') {
      const fighter=me.raid?.members.get(me.id);
      if (fighter) {
        fighter.dx=Number.isFinite(m.x)?Math.sign(m.x):0; fighter.dz=Number.isFinite(m.z)?Math.sign(m.z):0;
        fighter.attack=m.attack===true; fighter.inputAt=Date.now();
      }
      return;
    }
    if (m.t==='raidLeave') { leave(me); return; }
    if (Date.now()-(me.guildAt||0)<180) return;
    me.guildAt=Date.now();
    if (m.t==='trade') { trade(me,m); return; }
    if (m.t!=='raidJoin'||me.raid) return;
    const code=String(m.code||'').trim().slice(0,12) || ('個人-'+me.id);
    if (code.startsWith('lobby-')) return;
    const power = Number.isFinite(+m.power) ? Math.max(6, Math.min(32, Math.round(+m.power))) : 8;
    joinRaid(me, code, power);
  }
  function membersHaveFought(room) {
    return [...room.members.values()].some(fighter => !fighter.bot && fighter.hp > 0 && room.clock - (fighter.lastHit ?? -Infinity) < 70);
  }

  function tick() {
    const now=Date.now();
    for (const room of rooms.values()) {
      room.clock++;
      const impact=room.clock%40===0;
      for (const f of room.members.values()) {
        if (f.hp<=0) continue;
        if (f.bot) {
          const dx = room.x - f.x, dz = room.z - f.z, dist = Math.hypot(dx, dz) || 1;
          const dodge = room.clock % 40 >= 30;
          const move = dodge ? (dist < 3.8 ? -1 : 0) : (dist > 2.6 ? 1 : 0);
          f.dx = dx / dist * move; f.dz = dz / dist * move;
          f.attack = !dodge && membersHaveFought(room);
        } else if (now-(f.inputAt||0)>550) {f.dx=f.dz=0;f.attack=false;}
        const length=Math.hypot(f.dx,f.dz)||1;
        f.x=Math.max(-4.6,Math.min(4.6,f.x+f.dx/length*.45));
        f.z=Math.max(-4.6,Math.min(4.6,f.z+f.dz/length*.45));
        f.cooldown=Math.max(0,f.cooldown-1);
        const dist=Math.hypot(f.x-room.x,f.z-room.z);
        if (f.attack&&!f.cooldown&&dist<3) {room.started=true;room.hp-=f.power;f.damage+=f.power;f.cooldown=5;f.lastHit=room.clock;}
        if (impact&&dist<3.4) {
          f.hp=Math.max(0,f.hp-16);
          f.mitigated+=16;
          if (f.hp<=0 && room.portalsLeft>0) { room.portalsLeft--; }
        }
      }
      const members=[...room.members.values()];
      const snapshot={t:'raidFrame',hp:Math.max(0,room.hp),maxHp:room.maxHp,portalsLeft:room.portalsLeft,warn:room.clock%40>=30,
        members:members.map(f=>({id:f.me.id,name:f.me.name,hp:f.hp,x:f.x,z:f.z}))};
      const humans = members.filter(f => !f.bot);
      for(const f of humans) send(f.me,snapshot);
      if(room.hp>0 && humans.some(f=>f.hp>0)) continue;
      const won=room.hp<=0;
      const topBreaker = [...humans].sort((a,b)=>b.damage-a.damage)[0];
      const topTank = [...humans].sort((a,b)=>b.mitigated-a.mitigated)[0];
      const mvps = won ? [
        topBreaker && topBreaker.damage > 0 ? { badge: '🦌 精準破位王', name: topBreaker.me.name } : null,
        topTank && topTank.mitigated > 0 ? { badge: '🏮 救命提燈人', name: topTank.me.name } : null,
      ].filter(Boolean) : [];
      db.exec('BEGIN IMMEDIATE');
      try {
        if(won) for(const f of humans) if(f.damage>0) db.prepare('UPDATE members SET coins=coins+12,amber=amber+1 WHERE id=?').run(f.me.member);
        db.exec('COMMIT');
      } catch(e) {db.exec('ROLLBACK');throw e;}
      const mvpTxt = mvps.length ? ' ｜ 高光：' + mvps.map(x=>`${x.badge} ${x.name}`).join(' · ') : '';
      for (const f of humans) {
        send(f.me, { t: 'raidResult', won, contributed: f.damage > 0 });
        leave(f.me); wallet(f.me);
        send(f.me, { t: 'guildNotice', mvps,
          text: (won && f.damage > 0 ? '守護獸已平息 · 公會幣 +12、琥珀 +1'
            : won ? '隊友已平息守護獸' : '隊伍已返回燈谷鎮') + mvpTxt });
      }
    }
  }
  return {message,disconnect,tick,startDungeonRaid};
};
