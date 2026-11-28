import * as THREE from 'three';
import { creditGrowthField } from './growth_journey.js';

export function clearGrowthWatch(game) {
  const watch = game.growthWatch;
  if (!watch) return;
  game.spots = game.spots.filter(spot => {
    if (spot.kind !== 'growthWatch') return true;
    spot.mesh.removeFromParent();
    spot.mesh.geometry.dispose();
    spot.mesh.material.dispose();
    return false;
  });
  if (watch.pin && game.mapPin === watch.pin) game.mapPin = watch.previousPin;
  game.growthWatch = null;
}

function addMarker(game, point, label, color, index = null) {
  const geometry = index === null ? new THREE.OctahedronGeometry(0.48) : new THREE.CylinderGeometry(0.26, 0.38, 0.85, 6);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color }));
  mesh.position.set(point.x, game.world.gh(point.x, point.z) + 1.05, point.z);
  game.scene.add(mesh);
  game.spots.push({ ...point, kind: 'growthWatch', top: 1.6, label, mesh, index });
}

export function syncGrowthWatch(game, packet) {
  if (game.growthPrototype !== 'progression' || !game.net.growthWorld ||
      game.field !== 1 || packet.shard !== game.net.shard?.id) return;
  const previous = game.growthWatch;
  const { id, state, station, lamps, remaining, contributed } = packet;
  const lit = lamps.filter(lamp => lamp.lit).length;
  if (!previous || previous.id !== id || previous.state !== state || previous.lit !== lit) {
    clearGrowthWatch(game);
    const watch = game.growthWatch = { id, state, lit, total: lamps.length, deadline: performance.now() + remaining };
    const label = {
      idle: '開始公開守燈', active: `查看公開守燈 · ${lit}/${lamps.length}`,
      cleared: '公開守燈 · 已完成', expired: '公開守燈 · 已結束',
    }[state];
    addMarker(game, station, label, 0xffb75a);
    if (state === 'active') {
      const nextLamp = lamps.find(lamp => !lamp.lit);
      watch.previousPin = game.mapPin;
      watch.pin = game.mapPin = { x: nextLamp.x, z: nextLamp.z, label: '公開守燈 · 待修路燈' };
      lamps.forEach((lamp, index) => {
        addMarker(game, lamp, lamp.lit ? '路燈已修復' : `修復路燈 ${index + 1}`, lamp.lit ? 0xffdc8b : 0xff9564, index);
      });
      if (previous?.id !== id) {
        game.ui.toast(`公開守燈開始 · ${lit}/${lamps.length} · 餘下 ${Math.ceil(remaining / 1000)} 秒`, '#ffd68c');
      } else {
        game.audio.sfx('wisp');
        game.ui.toast(`公開守燈 · 已修復 ${lit}/${lamps.length}`, '#ffd68c');
      }
    } else if (state === 'cleared' && previous?.state === 'active') {
      game.ui.toast('公開守燈完成，路燈已全部修復。', '#ffd68c');
    } else if (state === 'expired' && previous?.state === 'active') {
      game.ui.toast('公開守燈時間已到，稍後可再開始。', '#ffd68c');
    }
  }
  if (state === 'cleared' && contributed && game.attackGrowthRank() > 0 && creditGrowthField(game.meta.p, 1)) {
    game.meta.save();
    game.ui.toast('公開守燈貢獻已記入草原里程碑。', '#a4d5ff');
    game.offerGrowthLesson();
  }
}

export function interactGrowthWatch(game, spot) {
  const watch = game.growthWatch;
  if (!watch || !game.net.ok) return;
  if (watch.state === 'active' && spot.index === null) {
    const seconds = Math.max(0, Math.ceil((watch.deadline - performance.now()) / 1000));
    game.ui.toast(`已修復 ${watch.lit}/${watch.total} 盞 · 餘下 ${seconds} 秒`, '#ffd68c');
    return;
  }
  if (watch.state !== 'idle' && (watch.state !== 'active' || spot.lit)) return;
  if (game.attackGrowthRank() <= 0) {
    game.ui.toast('先完成草原首戰並學會永久招式。', '#ffd68c');
    return;
  }
  game.posT = 0;
  game.updateNet(0);
  game.net.send(watch.state === 'idle' ? { t: 'growth_watch_start' }
    : { t: 'growth_watch_light', id: watch.id, index: spot.index });
}
