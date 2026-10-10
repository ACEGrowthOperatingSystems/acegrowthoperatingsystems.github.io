// CHOOSE YOUR DEMO funnel: homepage picker, player, question form, checkout
// waterfall. No network I/O: scripts run in vm contexts against stub DOMs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { extractSection, loadRealSources, checkManifestMatchesImplementation, checkMapperMatchesManifest } from '../scripts/verify_launch_pages.mjs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const configSrc = read('assets/demo-config.js');
const pickerSrc = read('assets/demo-picker.js');
const waterfallSrc = read('assets/checkout-waterfall.js');
const checkoutConfigSrc = read('assets/checkout-config.js');
const css = read('assets/choose-demo.css');
const wfCss = read('assets/checkout-waterfall.css');
const indexHtml = read('index.html');
const section = extractSection(indexHtml, 'choose-demo');
const checkoutHtml = read('checkout/ace-mkt/index.html');
const startHtml = read('start/index.html');
const startFunnel = read('assets/start-funnel.js');
const mapperSrc = read('n8n/validate_product_interest_map.js');
const manifest = JSON.parse(read('launch-readiness/product-pages-20260913.json'));
const deq = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, m);
const hidden = (name) => (section.match(new RegExp(`name="${name}" value="([^"]+)"`)) || [])[1];

function loadConfig(src = configSrc) {
  const ctx = { window: {}, Date };
  vm.runInNewContext(src, ctx);
  return ctx.window.ACE_DEMO_CONFIG;
}
const runMapper = (body) => new Function('$', '$execution', mapperSrc)(
  () => ({ first: () => ({ json: { body } }) }), { id: 'choose-demo-test' })[0].json;

const DEMOS = [
  ['followup', 'The Follow-Up Machine', 'Answer every lead fast and book more calls'],
  ['pipeline', 'Pipeline Builder', 'Find new clients every week'],
  ['content', 'Content Autopilot', 'Post every day without the work'],
  ['proposal', 'Proposal Engine', 'Send proposals the same day and close more'],
  ['growth', 'The Growth Engine', 'See the whole ACE system working together'],
];

// ---------------- config ----------------
test('demo-config: held, five demos with placeholders, no deadline', () => {
  const c = loadConfig();
  assert.equal(c.SECTION_RELEASE_STATE, 'APPROVAL_HELD');
  assert.equal(c.sectionReleased, false);
  assert.equal(c.QUESTION_FORM_KEY, 'demo-question');
  assert.equal(c.LAUNCH_PRICING_ENDS, null);
  deq(c.DEMOS.map(d => [d.key, d.title, d.outcome]), DEMOS);
  for (const d of c.DEMOS) {
    assert.equal(d.file, 'REPLACE_WITH_VIDEO_URL', d.key);
    assert.equal(c.isVideoConfigured(d.file), false, d.key);
    assert.ok('poster' in d && 'duration' in d, d.key);
  }
  assert.equal(c.isVideoConfigured('https://cdn.example.test/a.mp4'), true);
  assert.equal(c.isVideoConfigured('/assets/demos/followup.mp4'), true);
  assert.equal(c.isVideoConfigured('http://insecure.example/a.mp4'), false);
  assert.equal(c.isVideoConfigured('javascript:alert(1)'), false);
  // Only the exact string RELEASED releases.
  assert.equal(loadConfig(configSrc.replace('const SECTION_RELEASE_STATE="APPROVAL_HELD"', 'const SECTION_RELEASE_STATE="released"')).sectionReleased, false);
  assert.equal(loadConfig(configSrc.replace('const SECTION_RELEASE_STATE="APPROVAL_HELD"', 'const SECTION_RELEASE_STATE="RELEASED"')).sectionReleased, true);
});

test('playlist order is fixed and growth closes it', () => {
  const c = loadConfig();
  deq(c.normalizeKeys('growth,content,followup'), ['followup', 'content', 'growth']);
  deq(c.normalizeKeys(['growth']), ['growth']);
  deq(c.normalizeKeys('bogus, CONTENT ,content'), ['content']);
  deq(c.normalizeKeys(''), []);
});

// ---------------- mapping ----------------
test('/start/ interests map to demo keys', () => {
  const c = loadConfig();
  const cases = {
    'Automated prospecting': ['pipeline'],
    'Automated marketing & social posting': ['content'],
    'Automated sales systems': ['followup', 'proposal'],
    'Instant lead response & follow-up': ['followup'],
    'Automated booking': ['followup'],
    'Automated proposals': ['proposal'],
    'Accelerated growth & profitability': ['growth'],
  };
  for (const [label, keys] of Object.entries(cases)) deq(c.mapStartInterests([label]), keys, label);
  deq(c.mapStartInterests(['Accelerated growth & profitability', 'Automated booking', 'Automated sales systems']),
    ['followup', 'proposal', 'growth']);
  // Every checkbox on /start/ has a mapping (HTML entities decoded as FormData does).
  const options = [...startHtml.matchAll(/name="interests" value="([^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&'));
  assert.equal(options.length, 7);
  for (const o of options) assert.ok(c.mapStartInterests([o]).length > 0, `unmapped /start/ option: ${o}`);
});

test('/start/ success links to the homepage picker with mapped interests', () => {
  assert.match(startHtml, /id="chooseDemo" href="\/#choose-demo">Choose your demo</);
  assert.ok(startHtml.indexOf('demo-config.js') < startHtml.indexOf('start-funnel.js'));
  assert.match(startFunnel, /`\/\?interests=\$\{keys\.join\(","\)\}#choose-demo`/);
  assert.match(startFunnel, /unlock\(true,payload\.interests\)/);
  assert.match(startFunnel, /unlock\(false,payload\.interests\)/);
});

// ---------------- homepage gating ----------------
test('homepage section ships hidden + inert, right after the hero', () => {
  assert.ok(section, 'section#choose-demo missing');
  assert.match(section, /^<section id="choose-demo" class="cyd" hidden inert /);
  const heroEnd = indexHtml.indexOf('<a class="scroll" href="#stuck">');
  const sec = indexHtml.indexOf('<section id="choose-demo"');
  const stuck = indexHtml.indexOf('<section id="stuck">');
  assert.ok(heroEnd < sec && sec < stuck, 'section must sit between the hero and #stuck');
  assert.ok(section.includes('>CHOOSE YOUR DEMO<'));
  assert.ok(section.includes("Pick what matters most to your business. We'll build your demo playlist."));
  assert.match(section, /id="cydWatch" type="button" disabled/);
  assert.ok(section.includes('Watch Demo Video'));
  assert.ok(section.includes('Make selections above to select the appropriate demo'));
  const tiles = [...section.matchAll(/name="demo" value="([a-z]+)"/g)].map(m => m[1]);
  deq(tiles, DEMOS.map(d => d[0]));
  for (const [, title, outcome] of DEMOS) { assert.ok(section.includes(title)); assert.ok(section.includes(outcome)); }
  assert.match(css, /\.cyd\[hidden\],\.cyd \[hidden\]\{display:none!important\}/);
  // config loads before the controller, both after the page's own script
  assert.ok(indexHtml.indexOf('<script src="assets/demo-config.js" defer>') < indexHtml.indexOf('<script src="assets/demo-picker.js" defer>'));
  assert.ok(indexHtml.indexOf('<script src="assets/demo-config.js" defer>') > indexHtml.indexOf('<section id="choose-demo"'));
  assert.match(indexHtml, /<link rel="stylesheet" href="assets\/choose-demo.css">/);
  // No public nav link points at the held section.
  assert.equal((indexHtml.match(/href="#choose-demo"/g) || []).length, 0);
});

function runPicker({ released = false, search = '' } = {}) {
  const sec = { hidden: true, attrs: { inert: '' }, removeAttribute(k) { delete this.attrs[k]; }, querySelectorAll() { throw new Error('REVEALED_PAST_GATE'); }, querySelector() { throw new Error('REVEALED_PAST_GATE'); } };
  let touched = 0;
  const document = {
    getElementById(id) {
      if (id === 'choose-demo') return sec;
      touched++;
      throw new Error('REVEALED_PAST_GATE');
    },
  };
  const window = {};
  vm.runInNewContext(released ? configSrc.replace('const SECTION_RELEASE_STATE="APPROVAL_HELD"', 'const SECTION_RELEASE_STATE="RELEASED"') : configSrc, { window, Date });
  try {
    vm.runInNewContext(pickerSrc, { window, document, location: { search, hash: '' }, URLSearchParams });
  } catch (e) { if (e.message !== 'REVEALED_PAST_GATE') throw e; }
  return { sec, touched };
}

test('gating: HELD without ?preview=1 keeps the section hidden and touches nothing', () => {
  for (const search of ['', '?preview=0', '?preview=true', '?interests=content']) {
    const { sec, touched } = runPicker({ search });
    assert.equal(sec.hidden, true, search);
    assert.ok('inert' in sec.attrs, search);
    assert.equal(touched, 0, search);
  }
});

test('gating: ?preview=1 or RELEASED reveals; preview never authorizes submission', () => {
  assert.equal(runPicker({ search: '?preview=1' }).sec.hidden, false);
  assert.equal(runPicker({ released: true }).sec.hidden, false);
  assert.match(pickerSrc, /const RELEASE_AUTHORIZED=Boolean\(CONFIG&&CONFIG\.sectionReleased===true\);/);
  assert.match(pickerSrc, /if\(!RELEASE_AUTHORIZED&&!PREVIEW\)return;/);
  assert.ok(pickerSrc.indexOf('if(!RELEASE_AUTHORIZED&&!PREVIEW)return;') < pickerSrc.indexOf('section.hidden=false'));
  assert.equal([...pickerSrc.matchAll(/\b[A-Z][A-Z0-9_]*_AUTHORIZED\s*=\s*true\b/g)].length, 0);
  const gate = pickerSrc.indexOf('if(!RELEASE_AUTHORIZED){\n      form.dataset.lastPayload');
  const call = pickerSrc.indexOf('fetch(');
  assert.ok(gate > -1 && call > gate, 'submission gate must precede fetch');
  assert.match(pickerSrc.slice(gate, pickerSrc.indexOf('return;', gate) + 7), /return;/);
  assert.equal((pickerSrc.match(/fetch\(/g) || []).length, 1);
});

test('player handles placeholders and vertical video; end panel offers both choices', () => {
  assert.match(pickerSrc, /if\(CONFIG\.isVideoConfigured\(demo\.file\)\)\{/);
  assert.match(section, /<video id="cydVideo" playsinline/);
  assert.ok(section.includes('Demo video coming soon'));
  assert.match(css, /aspect-ratio:9\/16/);
  assert.match(pickerSrc, /video\.addEventListener\("ended"/);
  assert.ok(section.includes('See plans &amp; pricing'));
  assert.ok(section.includes('Ask a question'));
  assert.ok(pickerSrc.includes('return `checkout/ace-mkt/?from=demo${keys.length?`&interests=${keys.join(",")}`:""}`;'));
  assert.ok(pickerSrc.includes('Got it. A representative will follow up within 24 hours.') ||
    section.includes('Got it. A representative will follow up within 24 hours.'));
});

// ---------------- question form / route registration ----------------
test('question form posts as demo-question and is registered like automate-demo', () => {
  assert.equal(hidden('form'), 'demo-question');
  assert.equal(hidden('source'), 'website-demo');
  assert.equal(hidden('product_key'), 'ACE-DEMO');
  assert.equal(hidden('offer_code'), 'DEMO-QUESTION');
  const consent = section.match(/<input[^>]*name="consent"[^>]*>/)[0];
  assert.match(consent, /type="checkbox"/); assert.match(consent, /required/); assert.doesNotMatch(consent, /checked/);
  for (const f of ['first_name', 'email', 'question']) assert.match(section, new RegExp(`name="${f}"[^>]*required`), f);

  const route = manifest.routes.find(r => r.form === 'demo-question');
  assert.ok(route, 'demo-question must be in the launch manifest');
  deq({ ...route }, {
    path: '/#choose-demo', product_key: 'ACE-DEMO', offer_code: 'DEMO-QUESTION', form: 'demo-question',
    source: 'website-demo', consent_required: true, release_gate: 'assets/demo-config.js SECTION_RELEASE_STATE',
  });
  const real = loadRealSources();
  assert.ok(real.home && real.home.startsWith('<section id="choose-demo"'));
  assert.equal(checkManifestMatchesImplementation(real).pass, true, checkManifestMatchesImplementation(real).detail);
  assert.equal(checkMapperMatchesManifest(real).pass, true, checkMapperMatchesManifest(real).detail);
  // A released config must not satisfy a held manifest.
  const drift = { ...real, 'assets/demo-config.js': real['assets/demo-config.js'].replace('const SECTION_RELEASE_STATE="APPROVAL_HELD"', 'const SECTION_RELEASE_STATE="RELEASED"') };
  assert.equal(checkManifestMatchesImplementation(drift).pass, false);
  const unhidden = { ...real, home: real.home.replace(' hidden inert ', ' inert ') };
  assert.equal(checkManifestMatchesImplementation(unhidden).pass, false);
});

test('reference mapper accepts the question payload and keeps it held', () => {
  const body = {
    form: 'demo-question', source: 'website-demo', product_key: 'ACE-DEMO', offer_code: 'DEMO-QUESTION',
    first_name: 'Synthetic', email: 'Synthetic@Example.test', question: 'Does it work with my CRM? '.repeat(20),
    interests: ['content', 'growth', 'bogus'], consent: true, idempotency_key: 'demo-q-1',
    submitted_at: '2026-10-10T00:00:00Z', release_state: 'APPROVAL_HELD',
  };
  const r = runMapper(body);
  assert.equal(r.form, 'demo-question');
  assert.equal(r.name, 'Synthetic');
  assert.equal(r.need.length, 200);
  assert.ok(r.question.length > 200);
  deq(r.interests, ['content', 'growth']);
  assert.equal(r.followup_sla_hours, 24);
  assert.equal(r.qualified, false); assert.equal(r.external_action_authorized, false); assert.equal(r.release_state, 'APPROVAL_HELD');
  assert.throws(() => runMapper({ ...body, consent: false }), /CONSENT_REQUIRED/);
  assert.throws(() => runMapper({ ...body, offer_code: 'DEMO-AUTOMATE' }), /INVALID_OFFER_CODE/);
  assert.throws(() => runMapper({ ...body, source: 'ig-comment-automate' }), /INVALID_SOURCE/);
});

// ---------------- checkout waterfall ----------------
class N {
  constructor(tag) { this.tagName = tag; this.children = []; this.className = ''; this._text = ''; this.dataset = {}; this.attrs = {}; this.hidden = false; this.id = ''; this.parent = null; this.href = ''; }
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(' '); }
  get firstChild() { return this.children[0] || null; }
  remove() { if (this.parent) { this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; } }
  appendChild(c) { c.remove(); this.children.push(c); c.parent = this; return c; }
  insertBefore(c, ref) { c.remove(); const i = ref ? this.children.indexOf(ref) : -1; this.children.splice(i < 0 ? this.children.length : i, 0, c); c.parent = this; return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  get classList() { const n = this; return { add(c) { n.className = (n.className + ' ' + c).trim(); } }; }
  querySelectorAll(sel) { return sel === '[data-offer]' ? this.children.filter(c => c.dataset.offer) : []; }
}

function runWaterfall({ search, demoSrc = configSrc, checkoutSrc = checkoutConfigSrc } = {}) {
  const window = {};
  vm.runInNewContext(checkoutSrc, { window });
  vm.runInNewContext(demoSrc, { window, Date });
  const grid = new N('div');
  const keys = [...checkoutHtml.matchAll(/data-offer="([A-Z-]+)"/g)].map(m => m[1]);
  for (const k of keys) { const c = new N('div'); c.dataset.offer = k; c.className = 'checkout'; grid.appendChild(c); }
  const top = new N('div'); top.hidden = true; const bottom = new N('div'); bottom.hidden = true;
  const document = {
    createElement: t => new N(t),
    querySelector: s => (s === '.offers' ? grid : null),
    getElementById: id => ({ wfTop: top, wfBottom: bottom }[id] || null),
  };
  const intervals = [];
  vm.runInNewContext(waterfallSrc, { window, document, location: { search }, URLSearchParams, Date, Math, Number, String,
    setInterval: (f) => intervals.push(f) });
  return { grid, top, bottom, intervals, text: top.textContent + ' ' + bottom.textContent };
}

test('waterfall renders nothing without ?from=demo', () => {
  const r = runWaterfall({ search: '?interests=content' });
  assert.equal(r.top.hidden, true); assert.equal(r.bottom.hidden, true);
  assert.equal(r.top.children.length + r.bottom.children.length, 0);
});

test('waterfall: computed %, recommendations, bundle saving, downsell; no countdown while LAUNCH_PRICING_ENDS is null', () => {
  const r = runWaterfall({ search: '?from=demo&interests=content' });
  assert.equal(r.top.hidden, false);
  // Every launch price rounds to 35% below standard in checkout-config.js.
  assert.ok(r.text.includes('Launch pricing: save 35% vs standard'), r.text);
  assert.doesNotMatch(r.text, /ends|left|hurry|today only|expires/i, 'no deadline text while LAUNCH_PRICING_ENDS is null');
  assert.equal(r.intervals.length, 0, 'no countdown timer while LAUNCH_PRICING_ENDS is null');
  // content -> Content Creation Machine + Creation + Distribution, moved first and badged.
  deq(r.grid.children.slice(0, 2).map(c => c.dataset.offer), ['SA-CONTENT-CREATION', 'SA-CREATION-DISTRIBUTION']);
  assert.ok(r.grid.children[0].className.includes('wf-rec'));
  assert.ok(r.grid.children[0].textContent.includes('Recommended for you'));
  // Bundle: $510 + $405 = $915 vs $815 => $100/month, all from config.
  assert.ok(r.text.includes('Creation + Distribution saves $100/month'), r.text);
  assert.ok(r.top.textContent.includes('saves $100/month'), 'content interest puts the bundle up top');
  assert.ok(runWaterfall({ search: '?from=demo&interests=followup' }).bottom.textContent.includes('saves $100/month'));
  assert.ok(r.text.includes('$915/month'));
  // Downsell: ask a question + start smaller with the lowest active offer.
  assert.ok(r.text.includes('Not ready yet?'));
  assert.ok(r.text.includes('Ask a question'));
  assert.ok(r.text.includes('Start smaller: Content Distribution Machine at $405/month'), r.text);
  assert.doesNotMatch(r.text, /Content Starter|\$99/);
  const ask = r.bottom.children.at(-1).children[1].children[0];
  assert.equal(ask.href, '../../?ask=1&interests=content#choose-demo');
});

test('waterfall: follow-up/proposal/pipeline/growth recommend Essential + Professional', () => {
  for (const k of ['followup', 'proposal', 'pipeline', 'growth']) {
    const r = runWaterfall({ search: `?from=demo&interests=${k}` });
    deq(r.grid.children.slice(0, 2).map(c => c.dataset.offer), ['TIER-ESSENTIAL', 'TIER-PROFESSIONAL'], k);
  }
});

test('waterfall: non-uniform discount falls back to "save vs standard"; real deadline shows a countdown', () => {
  const skew = checkoutConfigSrc.replace('launch:"$405/month",standard:"$620/month"', 'launch:"$405/month",standard:"$900/month"');
  assert.notEqual(skew, checkoutConfigSrc);
  const res = runWaterfall({ search: '?from=demo', checkoutSrc: skew });
  assert.ok(res.text.includes('Launch pricing \u2014 save vs standard'), res.text);
  assert.doesNotMatch(res.text, /save \d+%/);
  const future = new Date(Date.now() + 5 * 864e5).toISOString();
  const withDate = configSrc.replace('const LAUNCH_PRICING_ENDS=null;', `const LAUNCH_PRICING_ENDS="${future}";`);
  const d = runWaterfall({ search: '?from=demo', demoSrc: withDate });
  assert.match(d.text, /Launch pricing ends .+ \u00b7 \d+d \d+h \d+m left/);
  assert.equal(d.intervals.length, 1);
  const past = configSrc.replace('const LAUNCH_PRICING_ENDS=null;', 'const LAUNCH_PRICING_ENDS="2020-01-01T00:00:00Z";');
  const p = runWaterfall({ search: '?from=demo', demoSrc: past });
  assert.doesNotMatch(p.text, /ends|left/);
  assert.equal(p.intervals.length, 0);
});

test('checkout page stays held; waterfall never touches buy buttons or links', () => {
  assert.match(checkoutHtml, /data-release-state="APPROVAL_HELD"/);
  assert.match(checkoutHtml, /<meta name="robots" content="noindex,nofollow">/);
  const tag = (f) => checkoutHtml.indexOf(`<script src="../../assets/${f}" defer>`);
  assert.ok(tag('checkout.js') > -1 && tag('checkout.js') < tag('checkout-waterfall.js'));
  assert.ok(tag('demo-config.js') > -1 && tag('demo-config.js') < tag('checkout-waterfall.js'));
  assert.match(checkoutHtml, /<div id="wfTop" hidden><\/div>/);
  assert.match(checkoutHtml, /<div id="wfBottom" hidden><\/div>/);
  assert.doesNotMatch(waterfallSrc, /data-buy|\.links\b|isConfigured|location\.assign|buy\.stripe/);
  assert.doesNotMatch(checkoutHtml, /\$\d/);
});

// ---------------- forbidden strings ----------------
test('no forbidden strings, invented prices or Stripe links in the funnel', () => {
  const files = {
    'assets/demo-config.js': configSrc, 'assets/demo-picker.js': pickerSrc, 'assets/checkout-waterfall.js': waterfallSrc,
    'assets/choose-demo.css': css, 'assets/checkout-waterfall.css': wfCss, 'index.html#choose-demo': section,
    'checkout/ace-mkt/index.html': checkoutHtml, 'start/index.html': startHtml,
  };
  for (const [name, src] of Object.entries(files)) {
    for (const bad of ['$99', 'Content Starter', 'eight images', 'buy.stripe.com/test_', 'buy.stripe.com/']) {
      assert.ok(!src.includes(bad), `${name} contains forbidden "${bad}"`);
    }
  }
  for (const [name, src] of [['demo-config.js', configSrc], ['demo-picker.js', pickerSrc], ['checkout-waterfall.js', waterfallSrc], ['section', section]]) {
    assert.doesNotMatch(src, /\$\d/, `${name} hard-codes a dollar figure`);
  }
  assert.doesNotMatch(section, /WithYou/i);
  // ACE palette: no navy/blue in the new styles.
  for (const [name, src] of [['choose-demo.css', css], ['checkout-waterfall.css', wfCss]]) {
    assert.doesNotMatch(src, /#5fa8ff|#07111f|#0d1b2e|#142b4b|navy|\bblue\b/i, name);
  }
});
