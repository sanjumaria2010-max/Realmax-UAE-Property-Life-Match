const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, require: (name) => imports[name] });
  return exports;
}
const data = load('sakan-data.ts');
const geo = load('sample-place-geometry.ts', { './sakan-data': data });

test('every supported sample place maps, but unknown addresses never silently snap', () => {
  assert.equal(data.samplePlaces.length, 7);
  for (const place of data.samplePlaces) {
    const point = geo.samplePlacePoint(place);
    assert.equal(point.place, place);
    assert(point.lat > 24 && point.lat < 26);
    assert(point.lng > 54 && point.lng < 56);
  }
  assert.equal(geo.samplePlacePoint('Unknown school Dubai'), null);
  assert.equal(geo.samplePlacePoint(''), null);
});
test('nearby candidates use straight-line distance, remain supported and sort closest first', () => {
  const point = geo.samplePlacePoint('DIFC Gate Avenue');
  const nearby = geo.nearbySamplePlaces(data.samplePlaces, point.lat, point.lng);
  assert.equal(nearby[0].place, 'DIFC Gate Avenue');
  assert.equal(nearby[0].km, 0);
  assert(nearby.every((p) => p.km <= 3 && data.samplePlaces.includes(p.place)));
  for (let i = 1; i < nearby.length; i++) assert(nearby[i].km >= nearby[i - 1].km);
  assert.equal(geo.nearbySamplePlaces(data.samplePlaces, 0, 0).length, 0);
});
test('school and internet city sample markers are distinct without claiming exact addresses', () => {
  const school = geo.samplePlacePoint('GEMS Wellington International School');
  const work = geo.samplePlacePoint('Dubai Internet City');
  assert.notEqual(school.lat, work.lat);
  assert.equal(school.area, work.area);
  assert(geo.distanceKm(school.lat, school.lng, work.lat, work.lng) < 1);
});
test('nearby clickable symbols are separated at every zoom without moving source coordinates', () => {
  const original = [{ x: 100, y: 100 }, { x: 103, y: 105 }, { x: 100, y: 100 }, { x: 104, y: 102 }];
  const before = JSON.stringify(original);
  const display = geo.separateMarkerPixels(original);
  assert.equal(JSON.stringify(original), before);
  for (let i = 0; i < display.length; i++) {
    for (let j = i + 1; j < display.length; j++) {
      assert(Math.hypot(display[i].x - display[j].x, display[i].y - display[j].y) >= 34);
    }
  }
});
