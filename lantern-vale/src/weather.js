import * as THREE from 'three';
import { rand } from './util.js';

export class Weather {
  constructor(scene) { this.scene = scene; this.matrix = new THREE.Matrix4(); this.isRaining = false; }
  reset(biome) {
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
    this.snow = biome.key === 'snow';
    this.isRaining = biome.key === 'marsh' || biome.key === 'coral' || biome.key === 'storm' || !!biome.rain;
    const count = this.isRaining ? 160 : this.snow ? 140 : 60;
    const color = this.isRaining ? 0x9ce2ff : this.snow ? 0xffffff : biome.key === 'ember' ? 0xffa050 : 0xfff2a0;
    const geo = this.isRaining ? new THREE.BoxGeometry(0.03, 0.42, 0.03) : new THREE.BoxGeometry(0.07, 0.07, 0.07);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color, transparent: this.isRaining, opacity: this.isRaining ? 0.72 : 1 }), count);
    this.mesh.userData.noNormal = true; this.mesh.frustumCulled = false; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.points = Array.from({ length: count }, () => ({ x: rand(Math.random, -22, 22), z: rand(Math.random, -22, 22), y: rand(Math.random, 0, (this.snow || this.isRaining) ? 9 : 3), phase: Math.random() * 6.28 }));
    this.scene.add(this.mesh); this.mesh.count = 0;
  }
  update(time, dt, center, storm) {
    let visible = 0;
    for (const point of this.points) {
      const phase = point.phase;
      let x = point.x, y = point.y, z = point.z;
      if (this.isRaining) {
        point.y -= dt * (storm ? 18 : 13.5);
        point.x += dt * (storm ? 2.4 : 0.9);
        if (point.y < 0) { point.y = 9.5; point.x = center.x + rand(Math.random, -22, 22); point.z = center.z + rand(Math.random, -18, 18); }
        x = point.x; y = point.y; z = point.z;
      } else if (this.snow) {
        point.y -= dt * (storm ? 3 : 1.2); point.x += dt * (storm ? 3 : 0.5);
        if (point.y < 0) { point.y = 8; point.x = center.x + rand(Math.random, -22, 22); point.z = center.z + rand(Math.random, -18, 18); }
        x = point.x + Math.sin(time + phase) * 0.3; y = point.y; z = point.z;
      } else {
        if (Math.sin(time * 1.5 + phase * 3) <= -0.3) continue;
        x += Math.sin(time * 0.5 + phase) * 1.2; y += Math.sin(time * 0.9 + phase * 2) * 0.4; z += Math.cos(time * 0.4 + phase) * 1.2;
      }
      this.mesh.setMatrixAt(visible++, this.matrix.makeTranslation(x, y, z));
    }
    this.mesh.count = visible; this.mesh.instanceMatrix.needsUpdate = true;
  }
}
