import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function includesAll(values, label) {
  for (const value of values) assert.ok(html.includes(value), `${label}: missing ${value}`);
}

// 9A.1 — the deployed-source handler must remain bound to the canonical endpoint.
includesAll([
  'https://withyoudaily.app.n8n.cloud/webhook/ace-lead',
  "wire('fn','em','go','note'",
  "wire('fn2','em2','go2','note2'",
  "wire('fn3','em3','go3','note3'",
], 'handler binding');

// 9A.3/9A.4 — every public capture surface requires explicit, versioned consent.
for (const id of ['consent', 'consent2', 'consent3']) {
  assert.match(html, new RegExp(`id=["']${id}["'][^>]*type=["']checkbox["']|type=["']checkbox["'][^>]*id=["']${id}["']`), `${id} checkbox missing`);
}
includesAll([
  'ace-weekly-brief-consent-v1',
  'consent_granted',
  'consent_text',
  'consent_version',
  'consent_timestamp',
  'consent_channel',
], 'consent payload');

// Correct routing: two brief CTAs and one diagnostic/readiness CTA.
assert.match(html, /wire\('fn','em','go','note','consent','brief',true\)/);
assert.match(html, /wire\('fn2','em2','go2','note2','consent2','brief',true\)/);
assert.match(html, /wire\('fn3','em3','go3','note3','consent3','readiness',true\)/);

// 9A.5 — deterministic acquisition context and canonical analytics lifecycle.
includesAll([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'landing_url', 'referrer',
  'ace_lead_submit_attempt', 'ace_lead_submit_success', 'ace_lead_submit_failure',
  'window.dataLayer', 'CustomEvent',
], 'analytics/provenance binding');

// Guard against the defect that classified every button except #go as readiness.
assert.ok(!html.includes("form:(btnId==='go'?'brief':'readiness')"), 'legacy misclassification remains');

// Execute the real handler in a deterministic browser stub, not just a text check.
const handlerSource = html.slice(
  html.indexOf('const LEAD_ENDPOINT'),
  html.indexOf('/* Problem selector doubles')
) + '\nconst dx={urgency:"urgent",maturity:"some automation",constraint:"time"};';
const elements = new Map();
for (const id of ['em','go','note','consent','fn2','em2','go2','note2','consent2','fn3','em3','go3','note3','consent3']) {
  elements.set(id, {
    value: id.startsWith('em') ? `${id}@example.test` : id.startsWith('fn') ? 'Synthetic' : '',
    checked: false, disabled: false, textContent: '', listeners: {}, dataset: {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
    focus() { this.focused = true; }
  });
}
const requests = [];
const dispatched = [];
const windowStub = {
  location: {search:'?utm_source=qa&utm_medium=synthetic&utm_campaign=stage9a', href:'https://example.test/?utm_source=qa', pathname:'/'},
  dataLayer: [],
  crypto: {randomUUID: () => '00000000-0000-4000-8000-000000000009'},
  dispatchEvent(event) { dispatched.push(event); }
};
const context = {
  window: windowStub,
  document: {referrer:'https://referrer.test/', getElementById: id => elements.get(id) || null},
  URLSearchParams,
  CustomEvent: class { constructor(type, init) { this.type=type; this.detail=init.detail; } },
  fetch: async (url, options) => { requests.push({url, options}); return {ok:true}; },
  console
};
vm.runInNewContext(handlerSource, context);

await elements.get('go2').listeners.click();
assert.equal(requests.length, 0, 'submission must be blocked without consent');
assert.equal(elements.get('consent2').focused, true, 'consent control must receive focus');

elements.get('consent2').checked = true;
await elements.get('go2').listeners.click();
let payload = JSON.parse(requests.at(-1).options.body);
assert.equal(payload.form, 'brief');
assert.equal(payload.brief_optin, true);
assert.equal(payload.consent_granted, true);
assert.equal(payload.consent_version, 'ace-weekly-brief-consent-v1');
assert.equal(payload.idempotency_key, '00000000-0000-4000-8000-000000000009');
assert.equal(payload.utm_source, 'qa');
assert.equal(payload.referrer, 'https://referrer.test/');

elements.get('consent3').checked = true;
await elements.get('go3').listeners.click();
payload = JSON.parse(requests.at(-1).options.body);
assert.equal(payload.form, 'readiness');
assert.deepEqual(windowStub.dataLayer.map(x => x.event_name), [
  'ace_lead_submit_attempt', 'ace_lead_submit_success',
  'ace_lead_submit_attempt', 'ace_lead_submit_success'
]);
assert.equal(dispatched.length, 4, 'canonical browser events must mirror dataLayer events');

console.log('PASS: Stage 9A public lead-capture source contract');
