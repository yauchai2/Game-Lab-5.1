import * as THREE from 'three';
import { questNavigationTarget } from './map_navigation.js';

const LIGHT_COUNT = 13;
const SPACING = 1.35;
const PLAYER_RADIUS = 0.38;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function findQuestRoute(world, boxes, start, target, interior) {
  // Use the player's collision footprints and subdivide edges so lights cannot cut corners.
  const height = interior ? () => 0 : (x, z) => world.gh(x, z);
  const walk = interior
    ? (x, z) => Math.abs(x) <= interior.halfW && Math.abs(z) <= interior.halfD
    : (x, z) => {
      if (!world.isWalk(x, z)) return false;
      const y = height(x, z);
      return !world.obstacles.some(o => Math.abs((o.h || 0) - y) <= 1.3
        && Math.hypot(x - o.x, z - o.z) < o.r + PLAYER_RADIUS * 0.7)
        && !boxes.some(b => !b.enemiesOnly && Math.abs((b.h || 0) - y) <= 1.8
          && Math.hypot(Math.max(0, Math.abs(x - b.x) - b.hw), Math.max(0, Math.abs(z - b.z) - b.hd)) < PLAYER_RADIUS);
    };
  const canConnect = (a, b, startsAtPlayer = false) => {
    const steps = Math.max(1, Math.ceil(distance(a, b) / 0.32));
    let previousY = height(a.x, a.z);
    for (let i = 1; i <= steps; i++) {
      const x = a.x + (b.x - a.x) * i / steps;
      const z = a.z + (b.z - a.z) * i / steps;
      const y = height(x, z);
      // The player may stand overlapping a collision boundary. Only let the first sample exit it.
      if ((!startsAtPlayer || i > 1 || i === steps) && !walk(x, z)) return false;
      if (Math.abs(y - previousY) > 0.55) return false;
      previousY = y;
    }
    return true;
  };

  if (canConnect(start, target, true)) return [start, target];

  const spacing = world.res;
  const side = Math.round(2 * world.half / spacing) + 1;
  const toPoint = index => ({
    x: index % side * spacing - world.half,
    z: Math.floor(index / side) * spacing - world.half,
  });
  const cellX = x => Math.round((x + world.half) / spacing);
  const sx = cellX(start.x), sz = cellX(start.z);
  const parents = new Int32Array(side * side).fill(-2);
  const queue = [];
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = sx + dx, z = sz + dz;
      if (x < 0 || x >= side || z < 0 || z >= side) continue;
      const index = z * side + x;
      if (!canConnect(start, toPoint(index), true)) continue;
      parents[index] = -1;
      queue.push(index);
    }
  }
  const offsets = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let nearest = -1, nearestDistance = 1.65;
  for (let head = 0; head < queue.length && head < 10000; head++) {
    const index = queue[head], point = toPoint(index);
    const remaining = distance(point, target);
    if (remaining < nearestDistance) {
      nearest = index;
      nearestDistance = remaining;
      if (remaining < spacing * 0.75 || canConnect(point, target)) break;
    }

    const x = index % side, z = Math.floor(index / side);
    for (const [dx, dz] of offsets) {
      const nx = x + dx, nz = z + dz, next = nz * side + nx;
      if (nx < 0 || nx >= side || nz < 0 || nz >= side || parents[next] !== -2) continue;
      const end = toPoint(next);
      if (!walk(end.x, end.z)) { parents[next] = -3; continue; }
      if (!canConnect(point, end)) continue;
      parents[next] = index;
      queue.push(next);
    }
  }
  if (nearest < 0) return [];
  const path = [];
  for (let i = nearest; i >= 0; i = parents[i]) path.push(toPoint(i));
  path.push(start);
  path.reverse();

  const route = [start];
  for (let i = 0; i < path.length - 1;) {
    let next = Math.min(i + 12, path.length - 1);
    while (next > i + 1 && !canConnect(path[i], path[next], i === 0)) next--;
    route.push(path[next]);
    i = next;
  }
  const end = route.at(-1);
  if (distance(end, target) > 0.01 && canConnect(end, target)) route.push(target);
  return route;
}

function pixelTexture(paint) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 24;
  const ctx = canvas.getContext('2d');
  const rect = (color, x, y, width, height) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  };
  const glow = ctx.createRadialGradient(12, 12, 1, 12, 12, 12);
  glow.addColorStop(0, '#ffd781a8');
  glow.addColorStop(1, '#ffad5200');
  rect(glow, 0, 0, 24, 24);
  paint(rect);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  return texture;
}

export class QuestGuide {
  enabled = null;
  route = [];
  points = [];

  showByDefault() {
    this.enabled ??= true;
  }

  createLights(scene) {
    const spark = pixelTexture(rect => {
      rect('#ffc453', 10, 6, 4, 12);
      rect('#ffd98a', 6, 10, 12, 4);
      rect('#fff6c5', 10, 10, 4, 4);
    });
    const lantern = pixelTexture(rect => {
      rect('#fff0c5', 2, 9, 5, 4);
      rect('#ffdfa0', 4, 12, 4, 3);
      rect('#fff0c5', 17, 9, 5, 4);
      rect('#ffdfa0', 16, 12, 4, 3);
      rect('#704334', 10, 3, 4, 3);
      rect('#704334', 8, 6, 8, 13);
      rect('#704334', 7, 8, 10, 9);
      rect('#ec963f', 9, 8, 6, 9);
      rect('#ffcf69', 10, 9, 4, 7);
      rect('#fff6b2', 10, 11, 4, 4);
      rect('#845438', 9, 12, 2, 2);
      rect('#845438', 13, 12, 2, 2);
    });
    const material = map => ({ map, transparent: true, depthWrite: false, alphaTest: 0.03, toneMapped: false });
    this.motes = new THREE.InstancedMesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial(material(spark)), LIGHT_COUNT);
    this.motes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.motes.frustumCulled = false;
    this.lantern = new THREE.Sprite(new THREE.SpriteMaterial(material(lantern)));
    this.root = new THREE.Group();
    this.root.name = 'Quest guide';
    this.root.userData.noNormal = true;
    this.motes.userData.noNormal = this.lantern.userData.noNormal = true;
    this.root.add(this.motes, this.lantern);
    this.transform = new THREE.Object3D();
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    scene.add(this.root);
  }

  update(g) {
    const target = this.enabled && g.canUseTouchControls() && !g.ui.regionMapOpen
      ? questNavigationTarget(g) : null;
    const player = g.player.pos;
    if (!target || distance(player, target) < 1.2) {
      this.target = null;
      if (this.root) this.root.visible = false;
      return;
    }

    const newArea = this.room !== g.zone || this.spots !== g.spots;
    const needsRoute = newArea || !this.target || target.label !== this.target.label
      || (g.time >= this.nextReplan && (distance(this.start, player) > 1.1 || distance(this.target, target) > 1.1 || !this.points.length));
    if (needsRoute) {
      this.room = g.zone;
      this.spots = g.spots;
      this.target = target;
      this.start = { x: player.x, z: player.z };
      this.route = findQuestRoute(g.world, g.worldBoxes, this.start, target, g.interior);
      this.points = [];
      let untilNext = SPACING;
      for (let i = 1; i < this.route.length && this.points.length < LIGHT_COUNT; i++) {
        const a = this.route[i - 1], b = this.route[i];
        const length = distance(a, b);
        while (untilNext < length && this.points.length < LIGHT_COUNT) {
          const t = untilNext / length;
          this.points.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
          untilNext += SPACING;
        }
        untilNext -= length;
      }
      if (this.route.length && this.points.length < LIGHT_COUNT) this.points.push(this.route.at(-1));
      this.nextReplan = g.time + (this.points.length ? 0.4 : 1.2);
    }
    if (!this.points.length) {
      if (this.root) this.root.visible = false;
      return;
    }
    if (!this.root) this.createLights(g.scene);
    this.root.visible = true;
    this.motes.count = this.points.length - 1;
    this.transform.quaternion.copy(g.camera.quaternion);
    const bob = this.reducedMotion.matches ? 0 : g.time;
    const height = (x, z) => g.interior ? g.player.y : g.world.gh(x, z);
    for (let i = 0; i < this.motes.count; i++) {
      const { x, z } = this.points[i];
      const phase = bob ? Math.sin(bob * 3.4 - i * 0.8) : 0;
      this.transform.scale.setScalar(0.62 + phase * 0.12);
      this.transform.position.set(x, height(x, z) + 0.32 + phase * 0.095, z);
      this.transform.updateMatrix();
      this.motes.setMatrixAt(i, this.transform.matrix);
    }
    this.motes.instanceMatrix.needsUpdate = true;
    const { x, z } = this.points.at(-1);
    this.lantern.position.set(x, height(x, z) + 1.15 + Math.sin(bob * 2.8) * 0.15, z);
    this.lantern.scale.setScalar(1.85);
  }
}
