import * as THREE from 'three';
import { WEAPON_CUES } from './action_audio.js';
import { buildPlayer, buildStag } from './models.js';

function accountKey(game) {
  const key='lv_guild_'+game.net.url+'_'+(game.slot||0);
  let secret=localStorage.getItem(key);
  if (!secret) {
    secret=Array.from(crypto.getRandomValues(new Uint8Array(32)), b=>b.toString(16).padStart(2,'0')).join('');
    localStorage.setItem(key,secret);
  }
  return secret;
}
export function bindGuild(g) {
  const n=g.net;
  n.on('guildNotice', m=>g.ui.toast(m.text));
  n.on('wallet', m=>{
    g.wallet=m;
    if (g.ui.guildMarketOpen) g.ui.drawGuildMarket();
  });
  g.identifyGuild=()=>{try { n.send({t:'guildHello',secret:accountKey(g)}); } catch {g.ui.toast('無法儲存公會身分，請開啟此網站的本機儲存空間。');}};
  n.on('raidStart',()=>{
    g.dungeon.raidStarted();
    g.ui.mapDialog.close();g.ui.closePanel();g.field=0;
    g.runSeed=31415;g.loadRoom(9,null,true,{raid:true});
    if(g.touchInteract)g.touchInteract.textContent='離隊';
    g.state='raid'; g.fade=0;
    g.pipe.postMat.uniforms.uFade.value=0; g.pipe.postMat.uniforms.uHurt.value=0;
    g.clearRemotes();g.net.send({t:'pos',zone:'guild:'+g.party,x:0,z:4});
    g.player.stats.maxHp=100;document.getElementById('myTag').style.display='none'; g.keys={};g.mouse.l=false;
    const boss=buildStag();g.world.group.add(boss.root);
    const warning=new THREE.Mesh(new THREE.RingGeometry(3.18,3.4,36),new THREE.MeshBasicMaterial({color:0xff794b,side:THREE.DoubleSide,transparent:true,opacity:0.4,depthWrite:false}));
    warning.rotation.x=-Math.PI/2;warning.position.y=.11;warning.visible=false;g.world.group.add(warning);
    const allies=new Map();
    g.raid={boss,warning,allies,sendIn:0,warn:false,windup:0,windupPose:0,impactPose:0};
    g.player.pos.set(0,0,4);g.player.m.root.visible=true;
    g.ui.banner('共鳴樹庭','靠近守護獸揮擊 · 紅圈亮起時撤離 · Esc 離開');
    g.ui.bossBar(true,'共鳴守護獸',1);
  });
  n.on('raidFrame',m=>{
    if (!g.raid) return;
    const raid = g.raid;
    const {allies,boss,warning}=raid;
    if (m.warn && !raid.warn) g.enemyCue('enemyWind', boss.root.position);
    if (m.impact) {
      g.enemyCue('enemyRelease', boss.root.position);
      raid.impactPose = 0.22;
      g.puffs.burst(0, 0.18, 0, 12, { c: 0xe6b085, s: 0.23, speed: 3.0, up: 0.6, life: 0.4 });
    }
    raid.warn = m.warn;
    raid.windup = m.warn ? (m.windup ?? 0.5) : 0;
    warning.visible=m.warn;g.ui.bossBar(true,m.warn?'守護獸蓄力 · 離開紅圈':'共鳴守護獸',m.hp/144);
    const present=new Set();
    for(const member of m.members) {
      if(member.id===n.id) {
        const p = g.player;
        p.vel.set((member.x - p.pos.x) * 10, 0, (member.z - p.pos.z) * 10);
        p.walkT = p.vel.lengthSq() > 0.04 ? (p.walkT || 0.01) : 0;
        if (p.hp > member.hp) {
          g.audio.sfx('hurt');
          p.recoilPose = 0.18;
          p.heroRig?.play('hit', { once: true, force: true });
        }
        p.pos.set(member.x,0,member.z);p.y=0;p.hp=member.hp;
        if (member.strike) {
          g.audio.sfx(WEAPON_CUES[g.meta.p.weapon] || 'staffSwing');
          p.swingT = 0.20;
          p.heroRig?.play('attack', { once: true, fade: 0.05 });
        }
        continue;
      }
      present.add(member.id);
      let actor=allies.get(member.id);
      if(!actor) {actor=buildPlayer(0x9775ae,0x705183);allies.set(member.id,actor);g.world.group.add(actor.root);}
      actor.moving = actor.root.position.distanceToSquared({ x: member.x, y: 0, z: member.z }) > 0.0004;
      actor.root.position.set(member.x,0,member.z);actor.root.rotation.y=Math.atan2(-member.x,-member.z);
      if (member.strike) {
        actor.strikePose = 0.25;
        g.cueAt('staffSwing', actor.root.position, 12, 0.53);
      }
      actor.root.visible=member.hp>0;
    }
    for(const [id,actor] of allies) if(!present.has(id)) {g.world.group.remove(actor.root);allies.delete(id);}
  });
  g.exitRaid=()=>{if(!g.raid)return;g.raid=null;if(g.touchInteract)g.touchInteract.textContent='互動';g.keys={};g.mouse.l=false;g.enterTown();};
  n.on('raidExit',g.exitRaid);
}
export function updateRaid(g,dt) {
  const r=g.raid, p=g.player;
  const touch = g.touchInput;
  const attack = g.mouse.l || !!g.keys[' '] || !!touch?.attack;
  r.sendIn-=dt;
  if(r.sendIn<=0) {
    r.sendIn=.1;
    const x = Number(!!g.keys.d) - Number(!!g.keys.a) + (touch?.x || 0);
    const z = Number(!!g.keys.s) - Number(!!g.keys.w) + (touch?.z || 0);
    g.net.send({t:'raidInput',x,z,attack});
  }
  g.time+=dt;
  p.facing=Math.atan2(-p.pos.x,-p.pos.z);
  if (p.walkT > 0) p.walkT += dt * 11;
  p.swingT = Math.max(0, p.swingT - dt);
  g.animatePlayer(dt);
  for (const actor of r.allies.values()) {
    actor.strikePose = Math.max(0, (actor.strikePose || 0) - dt);
    actor.staff.rotation.x = Math.sin((actor.strikePose / 0.25) * Math.PI) * 1.65;
    const stride = actor.moving ? Math.sin(g.time * 13) : 0;
    actor.legL.position.z = stride * 0.13;
    actor.legR.position.z = -stride * 0.13;
    actor.body.position.y = Math.abs(stride) * 0.075;
  }
  r.impactPose = Math.max(0, r.impactPose - dt);
  r.windupPose += (r.windup - r.windupPose) * (1 - Math.exp(-dt * 14));
  r.boss.body.position.y = 0.07 * Math.sin(g.time * 3) + 0.40 * r.windupPose;
  r.boss.body.rotation.x = -0.30 * r.windupPose + r.impactPose;
  r.warning.material.opacity = 0.44 + 0.48 * r.windupPose;
  g.puffs.update(dt);
  g.updateCamera(dt);g.ui.update(g);
  document.getElementById('roomInfo').textContent='共鳴樹庭 · '+(r.allies.size+1)+' 人';
}

export function drawExchange(g,body,title) {
  title.textContent='公會交易所';
  const wallet=g.wallet; body.replaceChildren();
  if (!wallet) {body.textContent='連線後可交易副本取得的琥珀。';return;}
  const row=(text)=>{const el=document.createElement('div');el.className='prow';const label=document.createElement('span');label.textContent=text;el.append(label);body.append(el);return el;};
  const action=(row,label,disabled,fn)=>{const b=document.createElement('button');b.className='btn small';b.textContent=label;b.disabled=disabled;b.onclick=()=>{b.disabled=true;fn();};row.append(b);};
  row('公會幣 '+wallet.coins+'　共鳴琥珀 '+wallet.amber);
  const list=row('上架 1 枚琥珀');
  const price=document.createElement('input');price.type='number';price.min=1;price.max=9999;price.value='5';price.style.width='5em';price.setAttribute('aria-label','售價（公會幣）');list.append(price);
  action(list,'上架',wallet.amber<1,()=>g.net.send({t:'trade',op:'list',price:Math.min(9999,Math.max(1,Math.floor(+price.value)||1))}));
  for(const lot of wallet.lots){
    const order=row('共鳴琥珀 · '+lot.price+' 公會幣');
    action(order,lot.mine?'撤回':'買入',!lot.mine&&wallet.coins<lot.price,()=>g.net.send({t:'trade',op:lot.mine?'cancel':'buy',id:lot.id}));
  }
  if(!wallet.lots.length) row('目前沒有掛單。成交時收取 10% 交易稅。');
}
