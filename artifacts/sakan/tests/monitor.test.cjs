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

function storageHarness(initial = null, blocked = false, alertStore = false, legacy = false, seed = null) {
  const primary = alertStore ? 'realmax.price-alerts.v2.live' : 'realmax.monitor.v2.live';
  const oldKey = alertStore ? 'realmax.price-alerts.v1' : 'realmax.monitor.v1';
  const values = new Map(seed || []);
  if (initial !== null) {
    let raw = initial;
    if (!alertStore && !legacy) {
      try {
        const ids = JSON.parse(raw);
        if (Array.isArray(ids)) raw = JSON.stringify({ ids, view: { propertyId: null, metric: 'sale', range: 3, horizon: 2, showForecast: false, showTable: false } });
      } catch {}
    }
    values.set(legacy ? oldKey : primary, raw);
  }
  const events = {};
  const handlers = new Map();
  const window = {
    localStorage: {
      getItem(key) { if (blocked) throw Error('blocked'); return values.get(key) ?? null; },
      setItem(key, value) { if (blocked) throw Error('blocked'); values.set(key, value); },
      removeItem(key = primary) { if (blocked) throw Error('blocked'); values.delete(key); },
    },
    addEventListener(name, fn) {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name).add(fn);
      events[name] = (event) => handlers.get(name)?.forEach((handler) => handler(event));
    },
    removeEventListener(name, fn) { handlers.get(name)?.delete(fn); },
  };
  const module = alertStore
    ? load('src/hooks/use-price-alerts.ts', { window, require: (name) => name === '../price-alerts-data' ? alertData : { useSyncExternalStore() {} } })
    : load('src/hooks/use-monitor.ts', { window });
  return { store: alertStore ? module.priceAlertsStore : module.monitorStore, module, values, window, events, get raw() { return values.get(primary) ?? null; } };
}

test('monitor additions, removals and reload persistence are independent of saved homes', () => {
  const h = storageHarness();
  assert.equal(h.store.get().ids.length, 0);
  h.store.add('a'); h.store.add('a'); h.store.toggle('b');
  assert.equal(JSON.stringify(h.store.get().ids), '["a","b"]');
  assert.equal(JSON.stringify(storageHarness(h.raw).store.get().ids), '["a","b"]');
  h.store.toggle('a'); assert.equal(JSON.stringify(h.store.get().ids), '["b"]');
  h.store.clear(); assert.equal(JSON.parse(h.raw).ids.length, 0);
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
  h.events.storage({ key: 'realmax.monitor.v2.live' });
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
  assert.equal(h.raw, '{}');
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

test('Buy and Invest keep independent properties, selections and chart preferences after reload', () => {
  const h = storageHarness();
  const buy = h.module.getMonitorStore('live');
  const invest = h.module.getMonitorStore('invest');
  buy.add('home-a'); invest.add('investment-b');
  buy.setView({ propertyId: 'home-a', range: 2, horizon: 3, showForecast: true });
  invest.setView({ propertyId: 'investment-b', metric: 'rent', range: 3 });
  assert.equal(JSON.stringify(buy.get().ids), '["home-a"]');
  assert.equal(JSON.stringify(invest.get().ids), '["investment-b"]');
  const fresh = storageHarness(null, false, false, false, h.values);
  const freshBuy = fresh.module.getMonitorStore('live').get();
  const freshInvest = fresh.module.getMonitorStore('invest').get();
  assert.equal(freshBuy.view.propertyId, 'home-a');
  assert.equal(freshBuy.view.range, 2);
  assert.equal(freshBuy.view.metric, 'sale');
  assert.equal(freshInvest.view.propertyId, 'investment-b');
  assert.equal(freshInvest.view.metric, 'rent');
  assert.equal(freshInvest.view.showForecast, false);
  buy.remove('home-a');
  assert.equal(invest.get().ids[0], 'investment-b');
});

test('legacy properties are copied once, with no resurrection after one journey removes them', () => {
  const h = storageHarness('["shared-home"]', false, false, true);
  const buy = h.module.getMonitorStore('live'), invest = h.module.getMonitorStore('invest');
  assert.equal(buy.get().ids[0], 'shared-home');
  assert.equal(invest.get().ids[0], 'shared-home');
  buy.remove('shared-home');
  const fresh = storageHarness(null, false, false, false, h.values);
  assert.equal(fresh.module.getMonitorStore('live').get().ids.length, 0);
  assert.equal(fresh.module.getMonitorStore('invest').get().ids[0], 'shared-home');
  assert.equal(h.values.get('realmax.monitor.v1'), '["shared-home"]');
});

test('alerts for the same property and metric are independent between journeys', () => {
  const h = storageHarness(null, false, true);
  const buy = h.module.getPriceAlertsStore('live'), invest = h.module.getPriceAlertsStore('invest');
  assert.equal(buy.save('same-home', 'sale', 100, 200), null);
  assert.equal(invest.save('same-home', 'sale', 300, 400), null);
  assert.equal(buy.get().rules['same-home:sale'].max, 200);
  assert.equal(invest.get().rules['same-home:sale'].max, 400);
  buy.remove('same-home', 'sale');
  assert.equal(invest.get().rules['same-home:sale'].min, 300);
  const fresh = storageHarness(null, false, true, false, h.values);
  assert.equal(Object.keys(fresh.module.getPriceAlertsStore('live').get().rules).length, 0);
  assert.equal(fresh.module.getPriceAlertsStore('invest').get().rules['same-home:sale'].max, 400);
});

test('legacy alerts are retained separately and clearing one journey never clears the other', () => {
  const legacy = JSON.stringify({ 'shared:sale': { propertyId: 'shared', metric: 'sale', min: 10, max: 20, enabled: true } });
  const h = storageHarness(legacy, false, true, true);
  assert.equal(h.store.get().rules['shared:sale'].max, 20);
  const invest = h.module.getPriceAlertsStore('invest');
  assert.equal(invest.get().rules['shared:sale'].max, 20);
  h.store.clear();
  const fresh = storageHarness(null, false, true, false, h.values);
  assert.equal(Object.keys(fresh.module.getPriceAlertsStore('live').get().rules).length, 0);
  assert.equal(fresh.module.getPriceAlertsStore('invest').get().rules['shared:sale'].max, 20);
});

test('cross-tab updates are delivered only to the affected journey', () => {
  const h = storageHarness();
  let buyNotices = 0, investNotices = 0;
  h.store.subscribe(() => buyNotices++);
  h.module.getMonitorStore('invest').subscribe(() => investNotices++);
  h.events.storage({ key: 'realmax.monitor.v2.invest' });
  assert.equal(buyNotices, 0);
  assert.equal(investNotices, 1);
});

test('private-workspace reset clears both journeys and the legacy backups', () => {
  const h = storageHarness('["legacy"]', false, false, true);
  h.store.add('buy');
  h.module.getMonitorStore('invest').add('invest');
  assert.equal(h.module.clearAllMonitors(), null);
  assert.equal(h.store.get().ids.length, 0);
  assert.equal(h.module.getMonitorStore('invest').get().ids.length, 0);
  assert(!h.values.has('realmax.monitor.v1'));
  const alerts = storageHarness(null, false, true);
  alerts.store.save('buy', 'sale', 100, null);
  alerts.module.getPriceAlertsStore('invest').save('invest', 'rent', 10, null);
  assert.equal(alerts.module.clearAllPriceAlerts(), null);
  assert.equal(Object.keys(alerts.store.get().rules).length, 0);
  assert.equal(Object.keys(alerts.module.getPriceAlertsStore('invest').get().rules).length, 0);
});
