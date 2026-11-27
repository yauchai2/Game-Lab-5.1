// Usage: node tools/retarget_locomotion.mjs UAL1.glb
// Run from lantern-vale with the no-root-motion Quaternius export.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PropertyBinding, Quaternion } from 'three';

const [, , input] = process.argv;
assert.ok(input, 'Provide the path to Quaternius UAL1.glb');
const rigPath = 'game/assets/char/adventurer_base.glb';
const output = 'game/assets/char/locomotion.json';

function readGlb(path) {
  const bytes = fs.readFileSync(path);
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
  const binStart = 28 + jsonLength;
  const indices = new Map(json.nodes.map(({ name }, index) => [name, index]));
  const parents = new Map();
  for (const [index, node] of json.nodes.entries()) {
    for (const child of node.children || []) parents.set(child, index);
  }
  const local = index => new Quaternion().fromArray(json.nodes[index].rotation || [0, 0, 0, 1]);
  function world(index) {
    const rotation = local(index);
    const parent = parents.get(index);
    return parent === undefined ? rotation : rotation.premultiply(world(parent));
  }
  function frames(index, width) {
    const { bufferView, byteOffset = 0, count, componentType, sparse } = json.accessors[index];
    assert.equal(componentType, 5126, 'Expected float samples');
    assert.equal(sparse, undefined, 'Expected dense animation samples');
    const view = json.bufferViews[bufferView];
    const start = binStart + (view.byteOffset || 0) + byteOffset;
    const stride = view.byteStride || width * 4;
    return Array.from({ length: count }, (_, i) =>
      Array.from({ length: width }, (_, j) => bytes.readFloatLE(start + i * stride + j * 4)));
  }
  return { json, indices, local, world, frames };
}

const source = readGlb(input);
const target = readGlb(rigPath);
const clips = {
  Walk: 'Walk_Loop',
  Run: 'Sprint_Loop',
  RunBack: 'Jog_Bwd_Loop',
  RunL: 'Jog_Left_Loop',
  RunR: 'Jog_Right_Loop',
};
const limbs = [
  ['thigh_l', 'Leg.leg.L.001'], ['calf_l', 'Leg.leg.L.003'], ['foot_l', 'Leg.foot.L.001'],
  ['thigh_r', 'Leg.leg.R.001'], ['calf_r', 'Leg.leg.R.003'], ['foot_r', 'Leg.foot.R.001'],
];
const round = value => Number(value.toFixed(6));

const result = Object.entries(clips).map(([name, sourceName]) => {
  const animation = source.json.animations.find(clip => clip.name === sourceName);
  assert.ok(animation, sourceName);
  const tracks = limbs.map(([sourceBone, targetBone]) => {
    const from = source.indices.get(sourceBone);
    const to = target.indices.get(targetBone);
    assert.ok(to !== undefined, targetBone);
    const channel = animation.channels.find(c => c.target.node === from && c.target.path === 'rotation');
    assert.ok(channel, sourceBone);
    const { input, output, interpolation } = animation.samplers[channel.sampler];
    assert.equal(interpolation, 'LINEAR');
    // Express the animated rotation relative to the source rest pose, then
    // transfer that delta into the destination bone's rest coordinate system.
    const invSourceRest = source.local(from).invert();
    const basis = target.world(to).invert().multiply(source.world(from));
    const invBasis = basis.clone().invert();
    const targetRest = target.local(to);
    const values = source.frames(output, 4).flatMap(frame =>
      targetRest.clone().multiply(basis).multiply(invSourceRest)
        .multiply(new Quaternion().fromArray(frame)).multiply(invBasis).normalize().toArray().map(round));
    const times = source.frames(input, 1).flat().map(round);
    return { name: PropertyBinding.sanitizeNodeName(targetBone) + '.quaternion', type: 'quaternion', times, values };
  });
  const duration = Math.max(...tracks.map(track => track.times.at(-1)));
  return { name, duration, tracks };
});
fs.writeFileSync(output, JSON.stringify(result) + '\n');
