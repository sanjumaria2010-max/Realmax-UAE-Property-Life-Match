const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const exports = {};
  const source = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, { exports, require: (name) => dependencies[name] });
  return exports;
}
const frontend = load('src/sakan-data.ts');
const engine = load('../api-server/src/lib/sakan-engine.ts');
const validation = load('../api-server/src/lib/sakan-validation.ts', { './sakan-engine': engine });
test('old briefs without a payment preference default to no preference', () => {
  assert.equal(frontend.initialBrief.rentPayment, 'any');
  assert.equal(engine.initialBrief.rentPayment, 'any');
  assert.equal(validation.validateBrief({}).rentPayment, 'any');
});
test('both payment preferences and no preference survive workspace validation', () => {
  for (const rentPayment of ['upfront', 'monthly', 'any']) {
    const draft = validation.validateDraft({ goal: 'rent', brief: { rentPayment }, destinations: [] });
    assert.equal(draft.brief.rentPayment, rentPayment);
    assert.equal(draft.brief.rentBudget, engine.initialBrief.rentBudget);
    assert.equal(draft.brief.rentUpfront, engine.initialBrief.rentUpfront);
    assert.equal(typeof frontend.rentPaymentLabels[rentPayment], 'string');
  }
});
test('unsupported payment values cannot be saved', () => {
  for (const rentPayment of ['weekly', '', null, 12]) {
    assert.throws(() => validation.validateBrief({ rentPayment }), /Invalid rentPayment/);
  }
});
test('monthly preference displays annual rent divided by twelve without mutating the source', () => {
  const display = frontend.rentDisplay(120000, 'monthly');
  assert.equal(display.amount, 10000);
  assert.equal(display.label, 'Monthly rent');
  assert.equal(display.suffix, ' / month');
  assert.equal(display.summary, 'AED 10,000 monthly rent');
  assert.equal(frontend.rentDisplay(115000, 'monthly').amount, 115000 / 12);
});
test('upfront and flexible preferences retain the annual amount with the appropriate labels', () => {
  const upfront = frontend.rentDisplay(120000, 'upfront');
  assert.equal(upfront.amount, 120000);
  assert.equal(upfront.label, 'Annual rent · upfront');
  assert.equal(upfront.suffix, ' / year · upfront');
  const flexible = frontend.rentDisplay(120000, 'any');
  assert.equal(flexible.amount, 120000);
  assert.equal(flexible.label, 'Annual rent');
});
