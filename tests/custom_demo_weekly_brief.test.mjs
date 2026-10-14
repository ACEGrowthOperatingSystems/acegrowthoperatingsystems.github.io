// Customized demo request (homepage #custom-demo inside #choose-demo) and the
// ACE Weekly Brief pop-up (#weekly-brief). Both are HELD by fail-closed flags.
// No network I/O: controllers run in vm contexts against stub DOMs, and any
// fetch is a recording stub.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { extractSection, loadRealSources, checkManifestMatchesImplementation, checkMapperMatchesManifest } from '../scripts/verify_launch_pages.mjs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const demoConfigSrc = read('assets/demo-config.js');
const cdrSrc = read('assets/custom-demo-request.js');
const briefConfigSrc = read('assets/weekly-brief-config.js');
const popupSrc = read('assets/weekly-brief-popup.js');
const demoCss = read('assets/choose-demo.css');
const popupCss = read('assets/weekly-brief-popup.css');
const indexHtml = read('index.html');
const mapperSrc = read('n8n/validate_product_interest_map.js');
const manifest = JSON.parse(read('launch-readiness/product-pages-20260913.json'));
const section = extractSection(indexHtml, 'choose-demo');
const popupHtml = extractSection(indexHtml, 'weekly-brief');
const cdrHtml = section.slice(section.indexOf('<div class="cdr-entry" id="custom-demo">'), section.indexOf('</div>', section.indexOf('id="cdrOpen"')) + 6)
  + section.slice(section.indexOf('<!-- CUSTOMIZED DEMO REQUEST'));
const deq = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, m);
const ENDPOINT = 'https://withyoudaily.app.n8n.cloud/webhook/ace-lead';
const DEMO_HELD = 'const SECTION_RELEASE_STATE="APPROVAL_HELD"';
const POPUP_HELD = 'const POPUP_RELEASE_STATE="APPROVAL_HELD"';
const released = (src, line) => src.replace(line, line.replace('APPROVAL_HELD', 'RELEASED'));
const runMapper = (body) => new Function('$', '$execution', mapperSrc)(
  () => ({ first: () => ({ json: { body } }) }), { id: 'cdr-wbp-test' })[0].json;

// ---------------- stub DOM ----------------
class E {
  constructor(id = '') {
    this.id = id; this.hidden = true; this.attrs = {}; this.dataset = {}; this.listeners = {}; this.children = [];
    this.textContent = ''; this.style = {}; this.disabled = false; this.checked = false; this.value = ''; this.qs = {}; this.qsa = {};
  }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] || []).filter(x => x !== f); }
  async fire(t, ev = {}) { for (const f of this.listeners[t] || []) await f({ preventDefault() {}, target: this, ...ev }); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
  focus() {} scrollIntoView() {}
  getClientRects() { return this.hidden || this.displayNone ? [] : [{}]; }
  querySelector(s) { return this.qs[s] || null; }
  querySelectorAll(s) { return this.qsa[s] || []; }
  appendChild(c) { this.children.push(c); return c; }
  reportValidity() { return true; }
  reset() { this.wasReset = true; }
}

// FormData stub: reads form.data, drops fields whose inputs are disabled
// (as the browser does), and includes the injected honeypot.
const makeFormData = () => class {
  constructor(form) { this.form = form; }
  entries() {
    const out = {};
    for (const [k, v] of Object.entries(this.form.data)) {
      if (this.form.disabledFields && this.form.disabledFields().includes(k)) continue;
      out[k] = v;
    }
    for (const c of this.form.children) if (c.name) out[c.name] = c.value || '';
    return out;
  }
  get(k) { const v = this.entries()[k]; return v === undefined ? null : Array.isArray(v) ? v[0] : v; }
  getAll(k) { const v = this.entries()[k]; return v === undefined ? [] : Array.isArray(v) ? v : [v]; }
};

function makeDocument(map, { strict = false, openDialog = null } = {}) {
  const calls = [];
  return {
    calls,
    documentElement: { style: {} },
    activeElement: null,
    getElementById(id) {
      calls.push(id);
      if (strict) throw new Error('TOUCHED_PAST_GATE');
      return map[id] ?? null;
    },
    querySelector() {
      if (strict) throw new Error('TOUCHED_PAST_GATE');
      return null;
    },
    querySelectorAll(s) {
      if (strict) throw new Error('TOUCHED_PAST_GATE');
      return s === '[aria-modal="true"]' && openDialog ? [openDialog] : [];
    },
    createElement() { return new E(); },
    addEventListener() {}, removeEventListener() {},
  };
}

function recordingFetch(receipt) {
  const calls = [];
  const fn = async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => receipt(JSON.parse(init.body)) }; };
  fn.calls = calls;
  return fn;
}
const strictReceipt = (p) => ({
  ok: true, accepted: true, accepted_for_review: true, action_taken: false, synthetic: false, schema_valid: true,
  form: p.form, qualified: false, qualification_status: 'PENDING', consent_recorded: true, release_state: 'APPROVAL_HELD',
  external_action_authorized: false, tag_mapping_status: 'UNRESOLVED',
});

// ---------------- custom demo controller harness ----------------
function customDemoDom() {
  const form = new E('cdrForm'); form.hidden = false;
  const status = new E(); const send = new E();
  const supplement = new E('cdrSupplement');
  const supYes = new E(); const supNo = new E(); supYes.disabled = supNo.disabled = true;
  supplement.qsa.input = [supYes, supNo];
  form.qs['[role=status]'] = status; form.qs['[type=submit]'] = send;
  form.data = {
    form: 'custom-demo-request', source: 'website-custom-demo', product_key: 'ACE-DEMO', offer_code: 'CUSTOM-DEMO-REQUEST',
    business_name: 'Synthetic Plumbing', industry: 'Home services / trades', business_description: 'We fix pipes.',
    capabilities: ['growth', 'followup', 'bogus'], timeframe: 'within-30-days', preferred_day: 'tuesday', preferred_time: 'morning',
    interested_ace_lead_generator: 'maybe', has_lead_generator: 'no', supplement_lead_generator: 'yes',
    first_name: 'Synthetic', email: 'synthetic@example.test', phone: '', consent: 'on',
  };
  form.disabledFields = () => (supYes.disabled ? ['supplement_lead_generator'] : []);
  const map = {
    cdrOpen: new E('cdrOpen'), cdrModal: new E('cdrModal'), cdrForm: form, cdrDone: new E('cdrDone'),
    cdrClose: new E('cdrClose'), cdrSupplement: supplement, cdrHeldNote: new E('cdrHeldNote'), cdrPreview: new E('cdrPreview'),
  };
  return { map, form, status, supplement, supYes, supNo };
}

function runCustomDemo({ release = false, search = '', strict = false, fetchImpl } = {}) {
  const window = {};
  vm.runInNewContext(release ? released(demoConfigSrc, DEMO_HELD) : demoConfigSrc, { window, Date });
  const dom = customDemoDom();
  const document = makeDocument(dom.map, { strict });
  const fetch = fetchImpl || recordingFetch(strictReceipt);
  try {
    vm.runInNewContext(cdrSrc, {
      window, document, location: { search, hash: '', pathname: '/' }, URLSearchParams, FormData: makeFormData(),
      crypto: globalThis.crypto, TextEncoder, fetch,
    });
  } catch (e) { if (e.message !== 'TOUCHED_PAST_GATE') throw e; }
  return { ...dom, document, fetch };
}

// ---------------- popup controller harness ----------------
function popupDom() {
  const form = new E('wbpForm'); form.hidden = false;
  const status = new E(); const send = new E();
  form.qs['[role=status]'] = status; form.qs['[type=submit]'] = send;
  form.data = { form: 'weekly-brief-subscribe', source: 'website-popup', product_key: 'ACE-BRIEF', offer_code: 'WEEKLY-BRIEF',
    first_name: 'Synthetic', email: 'synthetic@example.test', consent: 'on' };
  const popup = new E('weekly-brief'); popup.attrs.inert = '';
  const map = { 'weekly-brief': popup, wbpForm: form, wbpDone: new E('wbpDone'), wbpClose: new E('wbpClose'),
    wbpLater: new E('wbpLater'), wbpHeldNote: new E('wbpHeldNote'), wbpPreview: new E('wbpPreview') };
  return { map, form, popup, status };
}
function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
}
const throwingStorage = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); } };

function runPopup({ release = false, search = '', pathname = '/', strict = false, storage = memoryStorage(), offerPanel = false, openDialog = null, fetchImpl } = {}) {
  const window = { localStorage: storage };
  vm.runInNewContext(release ? released(briefConfigSrc, POPUP_HELD) : briefConfigSrc, { window });
  const dom = popupDom();
  if (offerPanel) dom.map.offerPanel = new E('offerPanel');
  const document = makeDocument(dom.map, { strict, openDialog });
  const timers = [];
  const fetch = fetchImpl || recordingFetch(strictReceipt);
  try {
    vm.runInNewContext(popupSrc, {
      window, document, location: { search, pathname }, URLSearchParams, FormData: makeFormData(),
      crypto: globalThis.crypto, TextEncoder, fetch, setTimeout: (f, ms) => timers.push({ f, ms }),
    });
  } catch (e) { if (e.message !== 'TOUCHED_PAST_GATE') throw e; }
  return { ...dom, document, timers, fetch, storage };
}

// ================= flags =================
test('both flags ship held; only the exact string RELEASED releases', () => {
  assert.ok(demoConfigSrc.includes(`${DEMO_HELD};`));
  assert.ok(briefConfigSrc.includes(`${POPUP_HELD};`));
  const cfg = (src) => { const w = {}; vm.runInNewContext(src, { window: w }); return w.ACE_WEEKLY_BRIEF_CONFIG; };
  assert.equal(cfg(briefConfigSrc).popupReleased, false);
  assert.equal(cfg(briefConfigSrc).FORM_KEY, 'weekly-brief-subscribe');
  assert.ok(cfg(briefConfigSrc).DELAY_MS >= 10000);
  for (const v of ['released', 'Released', 'RELEASED ', '', 'TRUE']) {
    assert.equal(cfg(briefConfigSrc.replace(POPUP_HELD, `const POPUP_RELEASE_STATE="${v}"`)).popupReleased, false, v);
  }
  assert.equal(cfg(released(briefConfigSrc, POPUP_HELD)).popupReleased, true);
  for (const src of [cdrSrc, popupSrc]) {
    assert.equal([...src.matchAll(/\b[A-Z][A-Z0-9_]*_AUTHORIZED\s*=\s*true\b/g)].length, 0);
  }
  // No page release state was touched: the homepage has no page-level flag.
  assert.doesNotMatch(indexHtml, /data-release-state=/);
});

// ================= (a) customized demo request =================
test('custom demo: button sits below the demo tiles inside the held section', () => {
  assert.ok(section.startsWith('<section id="choose-demo" class="cyd" hidden inert '));
  const btn = section.indexOf('id="cdrOpen"');
  assert.ok(btn > section.indexOf('</fieldset>') && btn > section.indexOf('id="cydWatch"'), 'button must be below the listed demos');
  assert.match(section, /<button class="cdr-open" id="cdrOpen" type="button"[^>]*>Click here to request a customized demo for your business<\/button>/);
  assert.match(section, /<div class="cyd-modal cdr-modal" id="cdrModal" hidden role="dialog" aria-modal="true"/);
  assert.match(demoCss, /\.cyd\[hidden\],\.cyd \[hidden\]\{display:none!important\}/);
  // Script order: config -> picker (reveals section) -> custom demo controller.
  const at = (f) => indexHtml.indexOf(`<script src="assets/${f}" defer></script>`);
  assert.ok(at('demo-config.js') > -1 && at('demo-config.js') < at('demo-picker.js') && at('demo-picker.js') < at('custom-demo-request.js'));
});

test('custom demo: questionnaire fields, capabilities, timing, lead-generator questions', () => {
  for (const f of ['business_name', 'business_description', 'first_name', 'email']) assert.match(cdrHtml, new RegExp(`name="${f}"[^>]*required`), f);
  for (const f of ['industry', 'timeframe', 'preferred_day', 'preferred_time']) assert.match(cdrHtml, new RegExp(`<select name="${f}" required>`), f);
  assert.match(cdrHtml, /<input type="tel" name="phone"[^>]*>/);
  assert.doesNotMatch(cdrHtml.match(/<input type="tel" name="phone"[^>]*>/)[0], /required/, 'phone is optional');
  deq([...cdrHtml.matchAll(/name="capabilities" value="([a-z-]+)"/g)].map(m => m[1]), ['pipeline', 'content', 'followup', 'proposal', 'growth', 'not-sure']);
  const w = {}; vm.runInNewContext(demoConfigSrc, { window: w, Date });
  for (const d of w.ACE_DEMO_CONFIG.DEMOS) assert.ok(cdrHtml.includes(`<b>${d.title.replace(/&/g, '&amp;')}</b>`), d.title);
  assert.ok(cdrHtml.includes('<b>Not sure yet</b>'));
  for (const label of ['ASAP', 'Within 30 days', '1&ndash;3 months', 'Just exploring']) assert.ok(cdrHtml.includes(`>${label}</option>`), label);
  assert.ok(cdrHtml.includes('Eastern Time'));
  assert.ok(cdrHtml.includes('Are you interested in the ACE Lead Generator?'));
  deq([...cdrHtml.matchAll(/name="interested_ace_lead_generator" value="(\w+)"/g)].map(m => m[1]), ['yes', 'no', 'maybe']);
  assert.ok(cdrHtml.includes('Do you already have your own lead generator?'));
  deq([...cdrHtml.matchAll(/name="has_lead_generator" value="(\w+)"/g)].map(m => m[1]), ['yes', 'no']);
  assert.match(cdrHtml, /<fieldset class="cdr-group" id="cdrSupplement" hidden>\s*<legend class="cdr-q">Are you looking to supplement it\?<\/legend>/);
  assert.match(cdrHtml, /name="supplement_lead_generator" value="yes" required disabled/);
  const consent = cdrHtml.match(/<input[^>]*name="consent"[^>]*>/)[0];
  assert.match(consent, /type="checkbox"/); assert.match(consent, /required/); assert.doesNotMatch(consent, /checked/);
});

test('custom demo: HELD without ?preview=1 touches nothing and never posts', () => {
  for (const search of ['', '?preview=0', '?preview=true', '?ask=1']) {
    const r = runCustomDemo({ search, strict: true });
    assert.equal(r.document.calls.length, 0, search);
    assert.equal(r.fetch.calls.length, 0, search);
  }
  assert.ok(cdrSrc.indexOf('if(!RELEASE_AUTHORIZED&&!PREVIEW)return;') < cdrSrc.indexOf('document.getElementById'));
  assert.doesNotMatch(cdrSrc, /section\.hidden=false|\.hidden=false;\s*section/, 'the section is revealed only by demo-picker.js');
});

test('custom demo: ?preview=1 shows the ribbon, stores the payload and never posts', async () => {
  const r = runCustomDemo({ search: '?preview=1&utm_source=ig' });
  assert.equal(r.map.cdrPreview.hidden, false);
  await r.map.cdrOpen.fire('click');
  assert.equal(r.map.cdrModal.hidden, false);
  await r.form.fire('submit');
  assert.equal(r.fetch.calls.length, 0, 'preview must never post');
  const p = JSON.parse(r.form.dataset.lastPayload);
  assert.equal(p.form, 'custom-demo-request'); assert.equal(p.product_key, 'ACE-DEMO');
  assert.equal(p.offer_code, 'CUSTOM-DEMO-REQUEST'); assert.equal(p.source, 'website-custom-demo');
  deq(p.capabilities, ['followup', 'growth']);
  assert.equal(p.release_state, 'APPROVAL_HELD'); assert.equal(p.consent, true); assert.equal(p.bot_field, '');
  assert.equal(p.utm_source, 'ig'); assert.equal(p.preferred_timezone, 'America/New_York');
  assert.match(p.idempotency_key, /^[0-9a-f-]{36}$/); assert.ok(p.interaction_started_at && p.submitted_at);
  assert.ok(p.pow_digest.startsWith('000'));
  assert.equal(r.map.cdrDone.hidden, false);
  assert.match(r.map.cdrHeldNote.textContent, /held .*Nothing was sent/);
});

test('custom demo: the supplement question appears only when they already have a lead generator', async () => {
  const r = runCustomDemo({ search: '?preview=1' });
  assert.equal(r.supplement.hidden, true); assert.equal(r.supYes.disabled, true);
  r.form.data.has_lead_generator = 'yes';
  await r.form.fire('change');
  assert.equal(r.supplement.hidden, false); assert.equal(r.supYes.disabled, false); assert.equal(r.supNo.disabled, false);
  await r.form.fire('submit');
  assert.equal(JSON.parse(r.form.dataset.lastPayload).supplement_lead_generator, 'yes');
  r.form.data.has_lead_generator = 'no';
  await r.form.fire('change');
  assert.equal(r.supplement.hidden, true); assert.equal(r.supYes.disabled, true);
  // A hidden supplement answer is never sent.
  const r2 = runCustomDemo({ search: '?preview=1' });
  await r2.form.fire('submit');
  assert.equal(JSON.parse(r2.form.dataset.lastPayload).supplement_lead_generator, '');
});

test('custom demo: at least one capability (or "Not sure yet") is required', async () => {
  const r = runCustomDemo({ search: '?preview=1' });
  r.form.data.capabilities = [];
  await r.form.fire('submit');
  assert.equal(r.form.dataset.lastPayload, undefined);
  assert.match(r.status.textContent, /Not sure yet/);
  r.form.data.capabilities = ['not-sure'];
  await r.form.fire('submit');
  deq(JSON.parse(r.form.dataset.lastPayload).capabilities, ['not-sure']);
});

test('custom demo: only RELEASED posts, once, to the intake, with a strict held receipt', async () => {
  const r = runCustomDemo({ release: true });
  assert.equal(r.map.cdrPreview.hidden, true, 'no ribbon when released');
  await r.form.fire('submit');
  assert.equal(r.fetch.calls.length, 1);
  assert.equal(r.fetch.calls[0].url, ENDPOINT);
  assert.equal(r.map.cdrDone.hidden, false); assert.equal(r.map.cdrHeldNote.hidden, true);
  // A lax receipt is a failure, not a success.
  const lax = runCustomDemo({ release: true, fetchImpl: recordingFetch(p => ({ ...strictReceipt(p), action_taken: true })) });
  await lax.form.fire('submit');
  assert.equal(lax.map.cdrDone.hidden, true);
  assert.match(lax.status.textContent, /Something went wrong/);
  // Gate precedes the only fetch.
  const gate = cdrSrc.indexOf('if(!RELEASE_AUTHORIZED){\n      form.dataset.lastPayload');
  assert.ok(gate > -1 && gate < cdrSrc.indexOf('fetch(')); assert.equal((cdrSrc.match(/fetch\(/g) || []).length, 1);
});

// ================= (b) weekly brief pop-up =================
test('pop-up markup ships hidden + inert, outside #choose-demo, loaded after its config', () => {
  assert.ok(popupHtml, 'section#weekly-brief missing');
  assert.match(popupHtml, /^<section id="weekly-brief" class="wbp" hidden inert role="dialog"/);
  assert.ok(!section.includes('id="weekly-brief"'));
  for (const t of ['ACE Weekly Brief', 'How to get ahead with Automation', 'The Power of Automation', 'ACE Academy',
    'Details and discounts on ACE Growth Operating Systems', 'Partnership opportunities', 'Stop paying the price for not automating.']) {
    assert.ok(popupHtml.includes(t), t);
  }
  for (const f of ['first_name', 'email']) assert.match(popupHtml, new RegExp(`name="${f}"[^>]*required`), f);
  const consent = popupHtml.match(/<input[^>]*name="consent"[^>]*>/)[0];
  assert.match(consent, /type="checkbox"/); assert.match(consent, /required/); assert.doesNotMatch(consent, /checked/);
  assert.match(popupHtml, /id="wbpClose"/); assert.match(popupHtml, /id="wbpLater"/);
  assert.match(popupCss, /\.wbp\[hidden\],\.wbp \[hidden\]\{display:none!important\}/);
  assert.match(indexHtml, /<link rel="stylesheet" href="assets\/weekly-brief-popup\.css">/);
  const at = (f) => indexHtml.indexOf(`<script src="assets/${f}" defer></script>`);
  assert.ok(at('weekly-brief-config.js') > -1 && at('weekly-brief-config.js') < at('weekly-brief-popup.js'));
});

test('pop-up: HELD without ?preview=1 touches nothing, schedules nothing, never posts', () => {
  for (const search of ['', '?preview=0', '?preview=yes']) {
    const r = runPopup({ search, strict: true });
    assert.equal(r.document.calls.length, 0, search);
    assert.equal(r.timers.length, 0, search);
    assert.equal(r.popup.hidden, true, search);
  }
});

test('pop-up: ?preview=1 appears after 10s with a held ribbon, shows once, and never posts', async () => {
  const r = runPopup({ search: '?preview=1' });
  assert.equal(r.timers.length, 1); assert.ok(r.timers[0].ms >= 10000);
  assert.equal(r.popup.hidden, true, 'not before the delay');
  r.timers[0].f();
  assert.equal(r.popup.hidden, false); assert.ok(!('inert' in r.popup.attrs));
  assert.equal(r.map.wbpPreview.hidden, false);
  assert.equal(r.storage.getItem('ace-weekly-brief-popup-seen'), '1');
  await r.form.fire('submit');
  assert.equal(r.fetch.calls.length, 0, 'preview must never post');
  const p = JSON.parse(r.form.dataset.lastPayload);
  deq([p.form, p.product_key, p.offer_code, p.source], ['weekly-brief-subscribe', 'ACE-BRIEF', 'WEEKLY-BRIEF', 'website-popup']);
  assert.equal(p.release_state, 'APPROVAL_HELD'); assert.equal(p.consent, true); assert.equal(p.brief_optin, true);
  assert.match(p.idempotency_key, /^[0-9a-f-]{36}$/); assert.ok(p.pow_digest.startsWith('000'));
  assert.match(r.map.wbpHeldNote.textContent, /held .*Nothing was sent/);
  // Next page view in the same browser: suppressed.
  const again = runPopup({ search: '?preview=1', storage: r.storage });
  assert.equal(again.timers.length, 0);
});

test('pop-up: dismissing suppresses it; storage failure fails safe (never shows)', async () => {
  const storage = memoryStorage();
  const r = runPopup({ release: true, storage });
  r.timers[0].f();
  await r.map.wbpLater.fire('click');
  assert.equal(r.popup.hidden, true); assert.equal('inert' in r.popup.attrs, true);
  assert.equal(storage.getItem('ace-weekly-brief-popup-seen'), '1');
  assert.equal(runPopup({ release: true, storage }).timers.length, 0, 'suppressed once dismissed');
  const c = runPopup({ release: true });
  c.timers[0].f(); await c.map.wbpClose.fire('click');
  assert.equal(c.popup.hidden, true);
  assert.equal(runPopup({ release: true, storage: c.storage }).timers.length, 0);
  const t = runPopup({ release: true, storage: throwingStorage });
  assert.equal(t.timers.length, 0); assert.equal(t.popup.hidden, true);
});

test('pop-up: never on /checkout/ pages, never alongside the /marketing/ offer pop-up, waits for open dialogs', () => {
  for (const pathname of ['/checkout/', '/checkout/ace-mkt/', '/checkout/ace-mkt/index.html', '/checkout']) {
    const r = runPopup({ release: true, pathname });
    assert.equal(r.timers.length, 0, pathname); assert.equal(r.popup.hidden, true, pathname);
  }
  const m = runPopup({ release: true, offerPanel: true });
  assert.equal(m.timers.length, 0); assert.equal(m.popup.hidden, true);
  // Not included on checkout or /marketing/ pages at all.
  assert.doesNotMatch(read('checkout/ace-mkt/index.html'), /weekly-brief/);
  assert.doesNotMatch(read('marketing/index.html'), /weekly-brief-popup/);
  // Another dialog (demo player / custom demo) open: retry later instead of stacking.
  const player = new E('cydModal'); player.hidden = false;
  const d = runPopup({ release: true, openDialog: player });
  d.timers[0].f();
  assert.equal(d.popup.hidden, true);
  assert.equal(d.timers.length, 2);
  player.hidden = true; d.timers[1].f();
  assert.equal(d.popup.hidden, false, 'shows once the other dialog closes');
  // A dialog hidden by CSS (like #cinema without .on) does not block it.
  const cinema = new E('cinema'); cinema.hidden = false; cinema.displayNone = true;
  const c = runPopup({ release: true, openDialog: cinema });
  c.timers[0].f();
  assert.equal(c.popup.hidden, false);
});

test('pop-up: only RELEASED posts, once, to the intake; no Kit call or key in the browser', async () => {
  const r = runPopup({ release: true });
  r.timers[0].f();
  assert.equal(r.map.wbpPreview.hidden, true);
  await r.form.fire('submit');
  assert.equal(r.fetch.calls.length, 1); assert.equal(r.fetch.calls[0].url, ENDPOINT);
  assert.equal(r.map.wbpDone.hidden, false); assert.equal(r.map.wbpHeldNote.hidden, true);
  const gate = popupSrc.indexOf('if(!RELEASE_AUTHORIZED){\n      form.dataset.lastPayload');
  assert.ok(gate > -1 && gate < popupSrc.indexOf('fetch(')); assert.equal((popupSrc.match(/fetch\(/g) || []).length, 1);
  for (const src of [popupSrc, briefConfigSrc, cdrSrc, popupHtml, cdrHtml]) {
    assert.doesNotMatch(src, /kit\.com|convertkit|api_key|api_secret|apiKey|Bearer|ck_[A-Za-z0-9]{8,}/i);
  }
});

// ================= routes =================
test('both routes are registered like automate-demo and demo-question', () => {
  const byForm = (f) => manifest.routes.find(r => r.form === f);
  deq(byForm('custom-demo-request'), {
    path: '/#custom-demo', product_key: 'ACE-DEMO', offer_code: 'CUSTOM-DEMO-REQUEST', form: 'custom-demo-request',
    source: 'website-custom-demo', consent_required: true, release_gate: 'assets/demo-config.js SECTION_RELEASE_STATE',
  });
  deq(byForm('weekly-brief-subscribe'), {
    path: '/#weekly-brief', product_key: 'ACE-BRIEF', offer_code: 'WEEKLY-BRIEF', form: 'weekly-brief-subscribe',
    source: 'website-popup', consent_required: true, release_gate: 'assets/weekly-brief-config.js POPUP_RELEASE_STATE',
  });
  assert.equal(manifest.release_state, 'APPROVAL_HELD'); assert.equal(manifest.live_submission_enabled, false);
  const hiddenIn = (html, n) => (html.match(new RegExp(`name="${n}" value="([^"]+)"`)) || [])[1];
  deq(['form', 'source', 'product_key', 'offer_code'].map(n => hiddenIn(cdrHtml, n)), ['custom-demo-request', 'website-custom-demo', 'ACE-DEMO', 'CUSTOM-DEMO-REQUEST']);
  deq(['form', 'source', 'product_key', 'offer_code'].map(n => hiddenIn(popupHtml, n)), ['weekly-brief-subscribe', 'website-popup', 'ACE-BRIEF', 'WEEKLY-BRIEF']);

  const real = loadRealSources();
  assert.ok(real.weeklyBrief && real.weeklyBrief.startsWith('<section id="weekly-brief"'));
  assert.equal(checkManifestMatchesImplementation(real).pass, true, checkManifestMatchesImplementation(real).detail);
  assert.equal(checkMapperMatchesManifest(real).pass, true, checkMapperMatchesManifest(real).detail);
  // Drift fails closed: a released pop-up flag, an un-hidden pop-up, or a missing mapper contract.
  const drift = { ...real, 'assets/weekly-brief-config.js': released(real['assets/weekly-brief-config.js'], POPUP_HELD) };
  assert.equal(checkManifestMatchesImplementation(drift).pass, false);
  assert.equal(checkManifestMatchesImplementation({ ...real, weeklyBrief: real.weeklyBrief.replace(' hidden inert ', ' inert ') }).pass, false);
  assert.equal(checkManifestMatchesImplementation({ ...real, home: real.home.replace('value="CUSTOM-DEMO-REQUEST"', 'value="CUSTOM"') }).pass, false);
  assert.equal(checkMapperMatchesManifest({ ...real, mapper: real.mapper.replace(/\n  'weekly-brief-subscribe':\{[^\n]*\n/, '\n') }).pass, false);
});

test('reference mapper: custom demo request whitelists choices and keeps the supplement conditional', () => {
  const body = {
    form: 'custom-demo-request', source: 'website-custom-demo', product_key: 'ACE-DEMO', offer_code: 'CUSTOM-DEMO-REQUEST',
    first_name: 'Synthetic', email: 'Synthetic@Example.test', business_name: 'Synthetic Plumbing', industry: 'Home services / trades',
    business_description: 'We fix pipes. '.repeat(30), capabilities: ['growth', 'followup', 'bogus', 'growth', 'not-sure'],
    timeframe: 'within-30-days', preferred_day: 'tuesday', preferred_time: 'sunrise', interested_ace_lead_generator: 'maybe',
    has_lead_generator: 'no', supplement_lead_generator: 'yes', phone: '+1 (555) 010-0000<script>',
    consent: true, idempotency_key: 'cdr-1', submitted_at: '2026-10-12T00:00:00Z', release_state: 'APPROVAL_HELD',
  };
  const r = runMapper(body);
  assert.equal(r.form, 'custom-demo-request'); assert.equal(r.name, 'Synthetic'); assert.equal(r.need.length, 200);
  deq(r.capabilities, ['growth', 'followup', 'not-sure']);
  assert.equal(r.timeframe, 'within-30-days'); assert.equal(r.preferred_day, 'tuesday'); assert.equal(r.preferred_time, '');
  assert.equal(r.preferred_timezone, 'America/New_York');
  assert.equal(r.supplement_lead_generator, '', 'no supplement answer without an existing lead generator');
  assert.equal(runMapper({ ...body, has_lead_generator: 'yes' }).supplement_lead_generator, 'yes');
  assert.equal(r.phone, '+1 (555) 010-0000');
  assert.equal(r.qualified, false); assert.equal(r.external_action_authorized, false); assert.equal(r.release_state, 'APPROVAL_HELD');
  assert.throws(() => runMapper({ ...body, consent: false }), /CONSENT_REQUIRED/);
  assert.throws(() => runMapper({ ...body, offer_code: 'DEMO-QUESTION' }), /INVALID_OFFER_CODE/);
  assert.throws(() => runMapper({ ...body, source: 'website-demo' }), /INVALID_SOURCE/);
});

test('reference mapper: weekly brief subscription needs only first name, email and consent', () => {
  const body = {
    form: 'weekly-brief-subscribe', source: 'website-popup', product_key: 'ACE-BRIEF', offer_code: 'WEEKLY-BRIEF',
    first_name: 'Synthetic', email: 'synthetic@example.test', page_path: '/', consent: true, idempotency_key: 'wbp-1',
    submitted_at: '2026-10-12T00:00:00Z', release_state: 'APPROVAL_HELD',
  };
  const r = runMapper(body);
  assert.equal(r.need, 'ACE Weekly Brief subscription'); assert.equal(r.newsletter, 'ace-weekly-brief'); assert.equal(r.brief_optin, true);
  assert.equal(r.external_action_authorized, false); assert.equal(r.qualified, false); assert.equal(r.tag_mapping_status, 'UNRESOLVED');
  assert.throws(() => runMapper({ ...body, product_key: 'ACE-DEMO' }), /INVALID_PRODUCT_KEY/);
  assert.throws(() => runMapper({ ...body, consent: false }), /CONSENT_REQUIRED/);
  assert.throws(() => runMapper({ ...body, release_state: 'RELEASED' }), /RELEASE_NOT_APPROVAL_HELD/);
  // The weekly-brief default need never leaks into other forms.
  assert.throws(() => runMapper({ ...body, form: 'demo-question', product_key: 'ACE-DEMO', offer_code: 'DEMO-QUESTION', source: 'website-demo' }), /INVALID_NEED/);
});

// ================= copy =================
test('copy: no prices, no disallowed claims, ACE palette only', () => {
  const visible = { 'custom demo markup': cdrHtml, 'weekly brief markup': popupHtml };
  const code = { 'custom-demo-request.js': cdrSrc, 'weekly-brief-popup.js': popupSrc, 'weekly-brief-config.js': briefConfigSrc };
  for (const [name, src] of Object.entries({ ...visible, ...code })) {
    assert.doesNotMatch(src, /\$\s?\d|\bUSD\b|\d+\s*\/\s*(mo|month)\b|per month|\bfree trial\b/i, `${name}: price`);
    assert.doesNotMatch(src, /guarantee|risk[- ]free|money[- ]back|trusted by|\b\d[\d,]*\+?\s*(customers|clients|businesses|companies|users)\b|\d+\s*%|\b\d+x\b|#1|award|\bROI\b|24\/7|never miss|double your|triple your|instantly/i, `${name}: claim`);
  }
  for (const [name, src] of Object.entries(visible)) {
    assert.doesNotMatch(src, /WithYou/i, name);
    assert.doesNotMatch(src, /within 24 hours|same day|overnight/i, `${name}: no timing promises beyond "within minutes"`);
  }
  assert.ok(cdrHtml.includes('Answers new leads within minutes, follows up and books calls'));
  assert.ok(cdrHtml.includes('Is the cost of not automating weighing you down?'));
  const newCss = demoCss.slice(demoCss.indexOf('/* ---------- customized demo request')) + popupCss;
  assert.doesNotMatch(newCss, /#5fa8ff|#07111f|#0d1b2e|#142b4b|navy|\bblue\b/i);
  assert.match(popupCss, /@media \(max-width:760px\)/);
});
