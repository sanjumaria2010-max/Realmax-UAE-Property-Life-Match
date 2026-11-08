const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relative, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: () => ({ useSyncExternalStore() {} }), ...globals });
  return exports;
}
const data = load('src/monitor-data.ts');
const alertData = load('src/price-alerts-data.ts');

test('sample history is stable, monthly, positive, and anchored to the listing', () => {
  for (const metric of ['sale', 'rent']) {
    const history = data.buildHistory('sample-home', metric, 125000);
    assert.equal(history.length, 36);
    assert.equal(history.at(-1).value, 125000);
    assert.equal(history.at(-1).month, '2026-11');
    assert.equal(history[0].month, '2023-12');
    assert.equal(new Set(history.map(p => p.month)).size, 36);
    assert(history.every(p => Number.isFinite(p.value) && p.value > 0));
    assert.equal(JSON.stringify(history), JSON.stringify(data.buildHistory('sample-home', metric, 125000)));
  }
  assert.notEqual(JSON.stringify(data.buildHistory('a', 'sale', 100000)), JSON.stringify(data.buildHistory('b', 'sale', 100000)));
});

test('all future scenario values compound from the current figure', () => {
  for (const metric of ['sale', 'rent']) {
    const assumptions = data.scenarioAssumptions('sample-home', metric);
    assert(assumptions.downside < assumptions.base && assumptions.base < assumptions.upside);
    for (const years of [1, 2, 3]) {
      const points = data.buildScenarios(100000, assumptions, years);
      assert.equal(points.length, years * 12 + 1);
      assert.equal(points[0].base, 100000);
      for (const end of data.scenarioEndpoints(100000, assumptions, years)) {
        assert.equal(end.value, points.at(-1)[end.key]);
        assert.equal(end.value, Math.round(100000 * (1 + assumptions[end.key] / 100) ** years));
        assert.equal(end.change, end.value - 100000);
      }
    }
  }
  assert.equal(data.compound(100000, -10, 12), 90000);
});

test('historical summary uses endpoint change and monthly fluctuations', () => {
  const result = data.summarizeHistory([{label:'A',value:100}, {label:'B',value:110}, {label:'C',value:99}]);
  assert.equal(result.change, -1);
  assert.equal(result.changePct, -1);
  assert.equal(result.maxRise.pct, 10);
  assert.equal(result.maxFall.pct, -10);
  assert.equal(result.avgAbsPct, 10);
});

function storageHarness(initial = null, blocked = false, alertStore = false) {
  let raw = initial;
  const events = {};
  const window = {
    localStorage: {
      getItem() { if (blocked) throw Error('blocked'); return raw; },
      setItem(_key, value) { if (blocked) throw Error('blocked'); raw = value; },
      removeItem() { if (blocked) throw Error('blocked'); raw = null; },
    },
    addEventListener(name, fn) { events[name] = fn; },
    removeEventListener(name) { delete events[name]; },
  };
  const module = alertStore
    ? load('src/hooks/use-price-alerts.ts', { window, require: (name) => name === '../price-alerts-data' ? alertData : { useSyncExternalStore() {} } })
    : load('src/hooks/use-monitor.ts', { window });
  return { store: alertStore ? module.priceAlertsStore : module.monitorStore, window, events, get raw() { return raw; } };
}

test('monitor additions, removals and reload persistence are independent of saved homes', () => {
  const h = storageHarness();
  assert.equal(h.store.get().ids.length, 0);
  h.store.add('a'); h.store.add('a'); h.store.toggle('b');
  assert.equal(JSON.stringify(h.store.get().ids), '["a","b"]');
  assert.equal(JSON.stringify(storageHarness(h.raw).store.get().ids), '["a","b"]');
  h.store.toggle('a'); assert.equal(JSON.stringify(h.store.get().ids), '["b"]');
  h.store.clear(); assert.equal(h.raw, null);
});

test('malformed or blocked storage exposes an error rather than pretending persistence', () => {
  assert.match(storageHarness('{bad').store.get().error, /malformed/);
  assert.match(storageHarness('{"ids":[]}').store.get().error, /unreadable/);
  const h = storageHarness(null, true);
  assert.match(h.store.get().error, /blocked/);
  h.store.add('a');
  assert.equal(h.store.get().ids[0], 'a');
  assert.match(h.store.get().error, /lost on reload/);
});

test('removal from another tab clears the current monitored list', () => {
  const h = storageHarness('["a"]');
  h.store.get();
  let notices = 0;
  const unsubscribe = h.store.subscribe(() => notices++);
  h.window.localStorage.removeItem();
  h.events.storage({ key: 'realmax.monitor.v1' });
  assert.equal(h.store.get().ids.length, 0);
  assert.equal(notices, 1);
  unsubscribe();
});

test('threshold validation accepts one bound and rejects invalid or reversed bounds', () => {
  for (const [min, max] of [[null, null], [0, null], [-1, 4], [NaN, 5], [Infinity, null], [10, 10], [12, 10]]) {
    assert.equal(typeof alertData.validatePriceAlert(min, max), 'string');
  }
  for (const [min, max] of [[10, null], [null, 10], [10, 20]]) {
    assert.equal(alertData.validatePriceAlert(min, max), null);
  }
});

test('alerts trigger inclusively at the bounds and stay independent per metric', () => {
  const rule = { propertyId: 'a', metric: 'sale', min: 100, max: 200, enabled: true };
  assert.equal(alertData.evaluatePriceAlert(rule, 100).state, 'below');
  assert.equal(alertData.evaluatePriceAlert(rule, 200).state, 'above');
  assert.equal(alertData.evaluatePriceAlert(rule, 150).state, 'within');
  assert.equal(alertData.evaluatePriceAlert(undefined, 150).state, 'unset');
  assert.equal(alertData.evaluatePriceAlert(rule, -1).state, 'unset');
  assert.notEqual(alertData.alertKey('a', 'sale'), alertData.alertKey('a', 'rent'));
});

test('alert settings persist, edit, remove and clear without affecting other property metrics', () => {
  const h = storageHarness(null, false, true);
  assert.equal(h.store.save('a', 'sale', 100, 200), null);
  assert.equal(h.store.save('a', 'rent', null, 20), null);
  assert.equal(h.store.save('b', 'sale', 300, null), null);
  assert.equal(h.store.save('a', 'sale', 120, 220), null);
  assert.equal(h.store.get().rules['a:sale'].min, 120);
  const restored = storageHarness(h.raw, false, true);
  assert.equal(restored.store.get().rules['a:rent'].max, 20);
  h.store.remove('a', 'sale');
  assert.equal(h.store.get().rules['a:sale'], undefined);
  assert.equal(h.store.get().rules['a:rent'].max, 20);
  assert.equal(h.store.clear(), null);
  assert.equal(h.raw, null);
});

test('invalid and blocked alert writes cannot report a successful save', () => {
  const h = storageHarness(null, false, true);
  assert.equal(typeof h.store.save('a', 'sale', 200, 100), 'string');
  assert.equal(h.raw, null);
  const blocked = storageHarness(null, true, true);
  assert.equal(typeof blocked.store.save('a', 'sale', 100, null), 'string');
  assert.equal(Object.keys(blocked.store.get().rules).length, 0);
  assert.match(blocked.store.get().error, /Could not save/);
  assert.match(storageHarness('{"a:sale":{"propertyId":"a"}}', false, true).store.get().error, /could not be read/);
});
