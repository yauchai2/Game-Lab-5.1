// server/dev_tune.cjs：只接受 flame.json 內已存在的數字／布林；忽略未知欄位、variants、型別不符。
const assert = require('node:assert/strict');
const { merge } = require('../server/dev_tune.cjs');
const base = { _doc: 'x', max: 100, gain: { kill: 3, flag: false }, variants: { default: { drainMul: 1 } }, name: 'n' };
const st = { changed: 0 };
merge(base, { _doc: 'hacked', max: 120, gain: { kill: 'evil', flag: true, extra: 9 }, variants: { default: { drainMul: 9 } }, name: 'z', newKey: 1 }, st);
assert.deepEqual(base, { _doc: 'x', max: 120, gain: { kill: 3, flag: true }, variants: { default: { drainMul: 1 } }, name: 'n' });
assert.equal(st.changed, 2);
console.log('dev_tune_merge OK');
