const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const exportsObject = {};
const source = fs.readFileSync(path.join(__dirname, '../src/life-place-order.ts'), 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: exportsObject });
const { reconcileLifeOrder, moveLifeEntry, reorderDestinations } = exportsObject;
const sample = [{ id: 'w', kind: 'Work', maxMinutes: 35 }, { id: 's', kind: 'School', maxMinutes: 30 }, { id: 'p', kind: 'Worship', maxMinutes: 25 }];
const plain = (value) => JSON.parse(JSON.stringify(value));

test('default layout includes all requested roles without creating placeholder destinations', () => {
  const entries = reconcileLifeOrder([], sample);
  assert.deepEqual(plain(entries.map((e) => e.kind)), ['Work', 'School', 'Partner work', 'Worship', 'Sport']);
  assert.equal(entries.filter((e) => e.id).length, sample.length);
});
test('all cards can move, including empty roles, and order survives serialization', () => {
  const entries = reconcileLifeOrder([], sample);
  const next = moveLifeEntry(entries, 4, 0);
  const restored = reconcileLifeOrder(plain(next), sample);
  assert.equal(restored[0].kind, 'Sport');
  assert.equal(entries[0].kind, 'Work');
  assert.equal(moveLifeEntry(entries, 0, -1), entries);
});
test('saving in a moved slot retains its position and supports multiple schools', () => {
  const entries = moveLifeEntry(reconcileLifeOrder([], sample), 2, 0);
  const added = [...sample, { id: 'partner', kind: 'Partner work' }, { id: 'second-school', kind: 'School' }];
  const next = reconcileLifeOrder(entries, added);
  assert.equal(next[0].id, 'partner');
  assert.equal(next.filter((e) => e.kind === 'School').length, 2);
  assert.equal(new Set(next.filter((e) => e.id).map((e) => e.id)).size, added.length);
});
test('removal restores a role slot and cannot resurrect deleted destinations', () => {
  const before = reconcileLifeOrder([], sample);
  const next = reconcileLifeOrder(before, sample.filter((d) => d.id !== 's'));
  assert.equal(next[1].key, 'slot:School');
  assert(!next.some((entry) => entry.id === 's'));
});
test('persisting order preserves record identity and rejects incomplete or duplicated IDs', () => {
  const next = reorderDestinations(sample, ['p', 's', 'w']);
  assert.equal(next[0], sample[2]);
  assert.equal(next[2].maxMinutes, 35);
  assert.equal(reorderDestinations(sample, ['p', 'w']), null);
  assert.equal(reorderDestinations(sample, ['p', 'p', 'w']), null);
  assert.equal(reorderDestinations(sample, ['p', 's', 'unknown']), null);
});
