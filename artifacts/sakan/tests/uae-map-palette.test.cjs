const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const exported = {};
const source = fs.readFileSync(path.join(__dirname, '../src/uae-map-palette.ts'), 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: exported });
const colour = (r, g, b, a = 255) => [...exported.tintUaeMapPixels(new Uint8ClampedArray([r, g, b, a]))];
test('sea becomes a richer blue while land stays warm sand and roads become golden', () => {
  const sea = colour(163, 197, 216);
  assert(sea[2] > sea[1] && sea[1] > sea[0] + 60);
  const sand = colour(238, 238, 213);
  assert(sand[0] > sand[1] && sand[1] > sand[2]);
  const road = colour(196, 146, 126);
  assert(road[0] > road[1] && road[1] > road[2] + 50);
});
test('dark labels, neutral whites, transparency and alpha values are preserved', () => {
  assert.deepEqual(colour(45, 45, 45), [45, 45, 45, 255]);
  assert.deepEqual(colour(255, 255, 255), [255, 255, 255, 255]);
  assert.deepEqual(colour(163, 197, 216, 0), [163, 197, 216, 0]);
  assert.equal(colour(163, 197, 216, 128)[3], 128);
});
