import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const load = () => { const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync('assets/catalog-config.js', 'utf8'), ctx); return ctx.window.ACE_CATALOG; };

// Founding setup/monthly from ace_v2.checkout_offers_launch_20261020 (cents / 100), approved 12 Oct 19:46Z.
const EXPECTED = { 1:[495,149],2:[0,49],3:[495,229],4:[0,99],5:[695,219],6:[0,99],7:[795,399],8:[0,99],9:[499,497],10:[749,1097],11:[999,1997],12:[1249,2997],
  13:[895,799],14:[1095,1299],15:[1395,2099],16:[1795,2999],17:[795,349],18:[1295,599],19:[2250,1095],20:[995,449],21:[1495,699],22:[2495,1195],23:[2500,1499],24:[3500,2099],25:[5000,3499] };

test('28 catalog lines, 25 buyable, 3 top-ups not buyable here', () => {
  const c = load();
  assert.equal(c.lines.length, 28);
  assert.equal(c.lines.filter(l => l.buyable).length, 25);
  assert.deepEqual([...c.lines.filter(l => !l.buyable).map(l => l.monthlyFounding)], [20, 50, 100]);
});

test('every buyable line matches the approved Stripe offer amounts', () => {
  const c = load();
  for (const l of c.lines.filter(x => x.buyable)) assert.deepEqual([l.setupFounding, l.monthlyFounding], [...EXPECTED[l.line]], l.key);
});

test('no line is buyable while links are placeholders; test and foreign links refused', () => {
  const c = load();
  for (const l of c.lines) assert.equal(c.isConfigured(l.key), false, l.key);
  assert.equal(c.isLiveLink('https://buy.stripe.com/test_abc123'), false);
  assert.equal(c.isLiveLink('https://evil.example/abc'), false);
  assert.equal(c.isLiveLink('https://buy.stripe.com/abc123'), true);
});

test('page is held and noindex', () => {
  const html = fs.readFileSync('catalog/index.html', 'utf8');
  assert.match(html, /data-release-state="APPROVAL_HELD"/);
  assert.match(html, /noindex/);
});

test('descriptions use only allowed claims vocabulary (no guarantees, no numbers of results)', () => {
  const c = load();
  const banned = /guarantee|ROI|\d+x|double|triple|revenue|AI-powered|24\/7/i;
  for (const l of c.lines) assert.doesNotMatch(l.description, banned, l.key);
});
