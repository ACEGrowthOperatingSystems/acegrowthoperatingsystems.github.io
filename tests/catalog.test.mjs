// /catalog/ pricing page: config, gates, add-on flag, rendered prices and
// claims. No network I/O: scripts run in vm contexts against a stub DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const configSrc = read('assets/catalog-config.js');
const rendererSrc = read('assets/catalog.js');
const html = read('catalog/index.html');
const css = read('assets/catalog.css');

const load = (src = configSrc) => { const ctx = { window: {} }; vm.runInNewContext(src, ctx); return ctx.window.ACE_CATALOG; };

// Founding setup/monthly from ace_v2.checkout_offers_launch_20261020 (cents / 100), approved 12 Oct 19:46Z.
const EXPECTED = { 1:[495,149],2:[0,49],3:[495,229],4:[0,99],5:[695,219],6:[0,99],7:[795,399],8:[0,99],9:[499,497],10:[749,1097],11:[999,1997],12:[1249,2997],
  13:[895,799],14:[1095,1299],15:[1395,2099],16:[1795,2999],17:[795,349],18:[1295,599],19:[2250,1095],20:[995,449],21:[1495,699],22:[2495,1195],23:[2500,1499],24:[3500,2099],25:[5000,3499] };
// Standard setup/monthly from the approved Claude Doc (fe43efe3), Founding / Standard columns.
const STANDARD = { 1:[695,199],2:[0,49],3:[795,249],4:[0,99],5:[895,299],6:[0,99],7:[1195,449],8:[0,99],9:[499,697],10:[749,1397],11:[999,2497],12:[1249,3497],
  13:[1295,999],14:[1495,1599],15:[1995,2599],16:[2495,3699],17:[1195,429],18:[1795,699],19:[2750,1295],20:[1495,549],21:[2250,899],22:[3500,1495],23:[3500,1799],24:[4500,2699],25:[6500,4499] };

const FLAG_LINE = 'const ADDONS_APPROVED=false;';
const withAddons = (src = configSrc) => { assert.ok(src.includes(FLAG_LINE)); return src.replace(FLAG_LINE, 'const ADDONS_APPROVED=true;'); };
const withLiveLinks = (src) => src.replaceAll('"link":"REPLACE_WITH_LIVE_LINK"', '"link":"https://buy.stripe.com/live123"');

// ---------------- stub DOM ----------------
class Node {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null; this.attrs = {}; this.dataset = {};
    this._text = ''; this.className = ''; this.hidden = false; this.listeners = {}; this.id = ''; const self = this;
    this.classList = { add: (c) => { self.className = (self.className + ' ' + c).trim(); }, contains: (c) => self.className.split(/\s+/).includes(c) }; }
  appendChild(n) { n.parentNode = this; this.children.push(n); return n; }
  insertBefore(n, ref) { n.parentNode = this; const i = this.children.indexOf(ref); this.children.splice(i < 0 ? this.children.length : i, 0, n); return n; }
  get firstChild() { return this.children[0] || null; }
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  click() { (this.listeners.click || []).forEach((f) => f({ preventDefault() {}, target: this })); }
  querySelectorAll() { return []; }
  focus() {}
  all() { return [this, ...this.children.flatMap((c) => c.all())]; }
  up(pred) { let n = this; while (n) { if (pred(n)) return n; n = n.parentNode; } return null; }
}

function render({ config = configSrc, released = false } = {}) {
  const ids = {};
  for (const id of ['catalogRoot', 'checkoutStatus', 'panel-alacarte', 'panel-leadgen', 'panel-os', 'panel-topups']) { ids[id] = new Node('div'); ids[id].id = id; }
  const assigned = [];
  const document = { createElement: (t) => new Node(t), getElementById: (id) => ids[id] || null, addEventListener() {} };
  const window = { location: { hash: '', assign: (u) => assigned.push(u) }, ACE_RELEASE: { isReleased: () => released } };
  const ctx = { window, document };
  vm.runInNewContext(config, ctx);
  vm.runInNewContext(rendererSrc, ctx);
  const panels = ['panel-alacarte', 'panel-leadgen', 'panel-os', 'panel-topups'].map((id) => ids[id]);
  const nodes = panels.flatMap((p) => p.all());
  return { cat: window.ACE_CATALOG, ids, panels, nodes, assigned, status: ids.checkoutStatus };
}
const usd = (n) => '$' + Number(n).toLocaleString('en-US');

// ---------------- config ----------------
test('28 approved lines (25 buyable + 3 top-ups) plus 2 add-on lines that are never buyable', () => {
  const c = load();
  const approved = c.lines.filter((l) => l.family !== 'LEAD GENERATOR ADD-ON');
  assert.equal(approved.length, 28);
  assert.equal(approved.filter((l) => l.buyable).length, 25);
  assert.deepEqual([...approved.filter((l) => !l.buyable).map((l) => l.monthlyFounding)], [20, 50, 100]);
  const addons = c.lines.filter((l) => l.family === 'LEAD GENERATOR ADD-ON');
  assert.equal(addons.length, 2);
  for (const a of addons) { assert.equal(a.buyable, false, a.key); assert.equal(a.pending, true, a.key); }
  assert.deepEqual(JSON.parse(JSON.stringify(addons.map((a) => [a.product, a.setupFounding, a.setupStandard, a.monthlyFounding, a.monthlyStandard]))),
    [['Website Lead Generator', 99, 149, 29, 49], ['Extra Sending Mailbox', 49, 49, 19, 19]]);
});

test('every buyable line matches the approved Founding and Standard amounts', () => {
  const c = load();
  for (const l of c.lines.filter((x) => x.buyable)) {
    assert.deepEqual([l.setupFounding, l.monthlyFounding], [...EXPECTED[l.line]], l.key);
    assert.deepEqual([l.setupStandard, l.monthlyStandard], [...STANDARD[l.line]], l.key);
  }
});

test('no line is buyable while links are placeholders; test and foreign links refused; add-ons refused even with a live link', () => {
  const c = load();
  for (const l of c.lines) assert.equal(c.isConfigured(l.key), false, l.key);
  assert.equal(c.isLiveLink('https://buy.stripe.com/test_abc123'), false);
  assert.equal(c.isLiveLink('https://evil.example/abc'), false);
  assert.equal(c.isLiveLink('https://buy.stripe.com/abc123'), true);
  const live = load(withAddons(withLiveLinks(configSrc)).replace(/("family":"LEAD GENERATOR ADD-ON".*?)"buyable":false/g, '$1"buyable":true'));
  for (const l of live.lines.filter((x) => x.family === 'LEAD GENERATOR ADD-ON')) assert.equal(live.isConfigured(l.key), false, l.key);
  assert.equal(live.isConfigured('L01-AUTOMATED-CONTENT-CREATION'), true);
});

test('ADDONS_APPROVED ships false; Founding deadline is March 1, 2027', () => {
  assert.equal(load().FOUNDING_RATE_ENDS, '2027-03-01T00:00:00-05:00');
  assert.ok(configSrc.includes(FLAG_LINE));
  assert.equal(load().ADDONS_APPROVED, false);
  assert.equal(load(withAddons()).ADDONS_APPROVED, true);
});

// ---------------- page ----------------
test('page is held and noindex; family selector is an accessible tablist', () => {
  assert.match(html, /<body[^>]*data-release-state="APPROVAL_HELD"/);
  assert.match(html, /<meta name="robots" content="noindex/);
  const tabs = [...html.matchAll(/<button[^>]*role="tab"[^>]*>([^<]+)<\/button>/g)];
  assert.deepEqual(tabs.map((t) => t[1]), ['A la carte', 'Lead Generator', 'Operating Systems', 'Top-ups', 'How pricing works']);
  assert.equal(tabs.filter((t) => /aria-selected="true"/.test(t[0])).length, 1);
  for (const t of tabs) {
    const panel = /aria-controls="([^"]+)"/.exec(t[0])[1];
    assert.match(html, new RegExp(`id="${panel}"[^>]*role="tabpanel"`), panel);
  }
  assert.match(html, /role="tablist"/);
  assert.match(html, /<dialog id="demoDialog"/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /focus-visible/);
});

test('held page: every Add to cart is inert and never navigates', () => {
  const r = render({ released: false });
  const buys = r.nodes.filter((n) => n.dataset.buy);
  assert.equal(buys.length, 25);
  for (const b of buys) {
    assert.equal(b.getAttribute('aria-disabled'), 'true', b.dataset.buy);
    assert.equal(b.dataset.inertReason, 'RELEASE_HELD');
    b.click();
  }
  assert.deepEqual(r.assigned, []);
  assert.match(r.status.textContent, /held pending release authorization/);
  // Held even when every link is live.
  const r2 = render({ config: withLiveLinks(configSrc), released: false });
  for (const b of r2.nodes.filter((n) => n.dataset.buy)) { assert.equal(b.getAttribute('aria-disabled'), 'true'); b.click(); }
  assert.deepEqual(r2.assigned, []);
});

test('released page with placeholder links is still inert; both gates open navigates', () => {
  const r = render({ released: true });
  for (const b of r.nodes.filter((n) => n.dataset.buy)) {
    assert.equal(b.dataset.inertReason, 'LINK_PLACEHOLDER'); b.click();
  }
  assert.deepEqual(r.assigned, []);
  const r2 = render({ config: withLiveLinks(configSrc), released: true });
  const b = r2.nodes.find((n) => n.dataset.buy === 'L09-ACE-LEAD-GENERATOR-IGNITE');
  assert.equal(b.getAttribute('aria-disabled'), 'false');
  b.click();
  assert.deepEqual(r2.assigned, ['https://buy.stripe.com/live123']);
});

test('add-on block hidden while ADDONS_APPROVED=false; when true it is "Pending approval" and never buyable', () => {
  const off = render();
  assert.equal(off.nodes.filter((n) => n.dataset.addon || n.dataset.addons).length, 0);
  const allText = off.panels.map((p) => p.textContent).join(' ');
  assert.doesNotMatch(allText, /Website Lead Generator|Extra Sending Mailbox|add-on/i);

  // Flag on, page released, live links, and lines forced buyable: still no buy button.
  const hacked = withAddons(withLiveLinks(configSrc)).replace(/("family":"LEAD GENERATOR ADD-ON".*?)"buyable":false/g, '$1"buyable":true');
  const on = render({ config: hacked, released: true });
  const cards = on.nodes.filter((n) => n.dataset.addon);
  assert.equal(cards.length, 2);
  for (const c of cards) {
    assert.equal(c.all().filter((n) => n.dataset.buy).length, 0, c.dataset.addon);
    assert.match(c.textContent, /Pending approval/);
  }
  assert.ok(on.ids['panel-leadgen'].all().some((n) => n.dataset.addons === 'shown'));
});

test('every rendered price equals the config, and every line is rendered', () => {
  for (const config of [configSrc, withAddons()]) {
    const r = render({ config });
    const priced = r.nodes.filter((n) => n.dataset.field);
    assert.ok(priced.length > 100);
    for (const n of priced) {
      const offer = n.up((x) => x.dataset.offer).dataset.offer;
      const l = r.cat.get(offer);
      assert.equal(n.textContent.replace('/month', ''), usd(l[n.dataset.field]), `${offer} ${n.dataset.field}`);
    }
    const shown = new Set(r.nodes.filter((n) => n.dataset.offer).map((n) => n.dataset.offer));
    const expected = r.cat.lines.filter((l) => l.family !== 'LEAD GENERATOR ADD-ON' || r.cat.ADDONS_APPROVED).map((l) => l.key);
    assert.deepEqual([...shown].sort(), [...expected].sort());
    // Each tier body shows its Founding monthly; Standard struck only when it differs.
    for (const l of r.cat.lines) {
      const body = r.nodes.find((n) => n.dataset.offer === l.key); if (!body) continue;
      const f = body.all().filter((n) => n.dataset.field).map((n) => n.dataset.field);
      assert.ok(f.includes('monthlyFounding'), l.key);
      assert.equal(f.includes('monthlyStandard'), l.monthlyStandard !== l.monthlyFounding, l.key);
      if (l.plan !== 'TOPUP') assert.ok(f.includes('setupFounding'), l.key);
      assert.equal(f.includes('includedCredit'), Boolean(l.includedCredit), l.key);
      const founding = l.setupStandard !== l.setupFounding || l.monthlyStandard !== l.monthlyFounding;
      assert.equal(/Founding Member Rate until March 1, 2027/.test(body.textContent), founding, l.key);
    }
  }
});

test('DIY plans show $0 setup; a la carte toggle switches Done for you / DIY', () => {
  const r = render();
  for (const l of r.cat.lines.filter((x) => /^DIY/.test(x.plan))) {
    const body = r.nodes.find((n) => n.dataset.offer === l.key);
    assert.match(body.textContent, /\$0 setup/, l.key);
    assert.equal(body.hidden, true, l.key + ' hidden until DIY is chosen');
  }
  const toggles = r.ids['panel-alacarte'].all().filter((n) => n.dataset.plan);
  assert.equal(toggles.length, 8);
  const diy = toggles.find((t) => t.dataset.plan === 'diy');
  diy.click();
  assert.equal(diy.getAttribute('aria-pressed'), 'true');
  assert.equal(r.nodes.find((n) => n.dataset.offer === 'L02-AUTOMATED-CONTENT-CREATION-DIY').hidden, false);
  assert.equal(r.nodes.find((n) => n.dataset.offer === 'L01-AUTOMATED-CONTENT-CREATION').hidden, true);
});

test('one "Recommended" (second) tier per tiered product; never "Most popular"', () => {
  const r = render();
  const rec = r.nodes.filter((n) => n.className.includes('is-recommended'));
  assert.deepEqual(rec.map((n) => n.all().find((x) => x.tagName === 'H4').textContent), ['Accelerate', 'Accelerate', 'Pro', 'Pro', 'Growth Pro']);
  assert.doesNotMatch(r.panels.map((p) => p.textContent).join(' '), /most popular|best seller|bestseller/i);
});

test('checklists use only approved claims and catalog plan terms', () => {
  const r = render({ config: withAddons() });
  const CAPS = new Set(['Answers new leads within minutes', 'Sends proposals', 'Follows up and books calls', 'Schedules your social posts',
    'Builds prospect lists', 'You approve from your phone']);
  const TERMS = new Set(['3-month minimum', 'Monthly plan starts at your first delivery', 'Monthly plan starts at the first send',
    'Sending mailboxes warm up for 14-21 days before the first send', 'No setup fee', 'Billed monthly from checkout', 'email only, 1 form']);
  const lis = r.nodes.filter((n) => n.tagName === 'LI');
  assert.ok(lis.length > 60);
  for (const li of lis) {
    const t = li.textContent;
    const l = r.cat.get(li.up((x) => x.dataset.offer).dataset.offer);
    if (CAPS.has(t) || TERMS.has(t)) continue;
    const credit = /^Larger monthly usage credit: (\$[\d,]+)$/.exec(t);
    if (credit) { assert.equal(credit[1], usd(l.includedCredit), l.key); continue; }
    assert.ok(r.cat.tierFacts(l.key).includes(t), `${l.key}: unapproved checklist item "${t}"`);
  }
  for (const h of r.nodes.filter((n) => n.className === 'tier-list-head')) assert.match(h.textContent, /^(What's included:|Everything in [A-Za-z ]+, plus:)$/);
  const banned = /guarantee|ROI|\d+x\b|double|triple|revenue|AI-powered|24\/7|testimonial|unlimited|best|#1|most popular|risk[- ]free/i;
  for (const p of r.panels) assert.doesNotMatch(p.textContent, banned);
  for (const l of r.cat.lines) assert.doesNotMatch(l.description, banned, l.key);
});

test('tier facts are limited to approved prospects/posts counts', () => {
  const c = load();
  for (const l of c.lines) for (const f of c.tierFacts(l.key)) assert.match(f, /^[\d,]+ (prospects|posts) a month$/, l.key);
});
