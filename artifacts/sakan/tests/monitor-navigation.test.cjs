const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, requireMock = () => ({})) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8');
  const exports = {};
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(js, { exports, require: requireMock });
  return exports;
}
const navigation = load('monitor-navigation.ts');
test('Monitor belongs only to Buy to live and Invest', () => {
  assert.equal(navigation.canMonitorGoal('rent'), false);
  assert.equal(navigation.canMonitorGoal('live'), true);
  assert.equal(navigation.canMonitorGoal('invest'), true);
});
test('property-specific monitor links preserve the selected property across reloads', () => {
  for (const id of ['dubai-marina-1', 'sample/property #2']) {
    const hash = navigation.monitorHash(id);
    assert(navigation.isMonitorHash(hash));
    assert.equal(navigation.monitorPropertyFromHash(hash), id);
  }
  assert(navigation.isMonitorHash('#monitor'));
  assert.equal(navigation.isMonitorHash('#places'), false);
  assert.equal(navigation.monitorPropertyFromHash('#monitor/%broken'), null);
});
test('monitor links identify their journey as well as the property', () => {
  for (const scope of ['live', 'invest']) {
    const hash = navigation.monitorHash('same-property', scope);
    assert.equal(navigation.monitorScopeFromHash(hash), scope);
    assert.equal(navigation.monitorPropertyFromHash(hash), 'same-property');
  }
  assert.equal(navigation.monitorScopeFromHash('#monitor/legacy-property'), null);
});
for (const alreadyMonitored of [false, true]) {
  test(`property action opens its own monitor without toggling tracking (${alreadyMonitored ? 'existing' : 'new'})`, () => {
    const monitor = load('components/sakan-monitor.tsx', (name) => {
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      if (name === '../hooks/use-monitor') return { useMonitor: (scope) => {
        assert.equal(scope, 'invest');
        return { isMonitored: () => alreadyMonitored, toggle: () => assert.fail('Must not toggle tracking') };
      } };
      return {};
    });
    let opened = null, stopped = false;
    const button = monitor.MonitorToggle({ listing: { id: 'target-property', name: 'Target home' }, scope: 'invest', onOpen: (id) => { opened = id; } });
    button.props.onClick({ stopPropagation: () => { stopped = true; } });
    assert.equal(opened, 'target-property');
    assert(stopped);
    assert.equal(button.props['aria-pressed'], undefined);
    assert.equal(button.props['aria-label'], 'Open monitoring for Target home');
  });
}
