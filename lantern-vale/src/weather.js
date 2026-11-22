import * as THREE from 'three';
import { rand } from './util.js';

export class Weather {
  constructor(scene) { this.scene=scene;this.matrix=new THREE.Matrix4(); }
  reset(biome) {
    if(this.mesh) {this.scene.remove(this.mesh);this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
    this.snow=biome.key==='snow';
    const count=this.snow?140:60, color=this.snow?0xffffff:biome.key==='ember'?0xffa050:0xfff2a0;
    this.mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.07,.07,.07),new THREE.MeshBasicMaterial({color}),count);
    this.mesh.userData.noNormal=true;this.mesh.frustumCulled=false;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.points=Array.from({length:count},()=>({x:rand(Math.random,-22,22),z:rand(Math.random,-22,22),y:rand(Math.random,0,this.snow?8:3),phase:Math.random()*6.28}));
    this.scene.add(this.mesh);this.mesh.count=0;
  }
  update(time,dt,center,storm) {
    let visible=0;
    for(const point of this.points) {
      const phase=point.phase;
      let x=point.x,y=point.y,z=point.z;
      if(this.snow) {
        point.y-=dt*(storm?3:1.2);point.x+=dt*(storm?3:.5);
        if(point.y<0) {point.y=8;point.x=center.x+rand(Math.random,-22,22);point.z=center.z+rand(Math.random,-18,18);}
        x=point.x+Math.sin(time+phase)*.3;y=point.y;z=point.z;
      } else {
        if(Math.sin(time*1.5+phase*3)<=-.3) continue;
        x+=Math.sin(time*.5+phase)*1.2;y+=Math.sin(time*.9+phase*2)*.4;z+=Math.cos(time*.4+phase)*1.2;
      }
      this.mesh.setMatrixAt(visible++,this.matrix.makeTranslation(x,y,z));
    }
    this.mesh.count=visible;this.mesh.instanceMatrix.needsUpdate=true;
  }
}
