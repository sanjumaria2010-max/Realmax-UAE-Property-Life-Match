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
test('sea, land, roads and parks stay in the blue family without warm accent colours', () => {
  const sea = colour(163, 197, 216);
  const land = colour(238, 238, 213);
  const road = colour(196, 146, 126);
  const park = colour(193, 218, 178);
  for (const pixel of [sea, land, road, park]) assert(pixel[2] > pixel[1] && pixel[1] > pixel[0]);
  assert(land[1] > sea[1], 'coastline and land must contrast with the ocean');
  assert(road[1] > land[1], 'roads must remain visible above land');
});
test('dark labels become legible pale text while transparency and alpha are preserved', () => {
  const label = colour(45, 45, 45);
  assert(label[0] > 150 && label[1] > 180 && label[2] > 200);
  const background = colour(255, 255, 255);
  assert(background[0] < 50 && background[2] < 120);
  assert.deepEqual(colour(163, 197, 216, 0), [163, 197, 216, 0]);
  assert.equal(colour(163, 197, 216, 128)[3], 128);
});
