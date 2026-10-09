// Checklist 4.10 (GROW-07): /growth/ route contract. No network I/O.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../growth/index.html', import.meta.url), 'utf8');
const code = fs.readFileSync(new URL('../n8n/validate_product_interest_map.js', import.meta.url), 'utf8');
const run = (body) => new Function('$', '$execution', code)(
  () => ({ first: () => ({ json: { body } }) }), { id: 'test-execution' });
const hidden = (name) => (html.match(new RegExp(`name="${name}" value="([^"]+)"`)) || [])[1];

// 1. Page renders and is held by its own flag.
assert.match(html, /<html[\s>]/); assert.match(html, /<title>/); assert.match(html, /<main[\s>]/);
assert.match(html, /data-release-state="APPROVAL_HELD"/);
assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
assert.match(html, /release-flag\.js/); assert.match(html, /product-launch\.js/);
console.log('1 OK: /growth/ renders and is APPROVAL_HELD');

// 2. Canonical ownership: ACE Growth Operating System, no WithYou.
assert.match(html, /ACE Growth Operating System/); assert.doesNotMatch(html, /WithYou/i);
console.log('2 OK: canonical ownership');

// 3. Form contract matches intake route grow-interest.
assert.equal(hidden('form'), 'grow-interest');
assert.equal(hidden('product_key'), 'ACE-GROW');
assert.equal(hidden('offer_code'), 'SYS-GROW');
assert.equal(hidden('source'), 'ace-grow');
for (const f of ['email', 'name', 'need']) assert.match(html, new RegExp(`name="${f}"[^>]*required`));
const consent = html.match(/<input[^>]*name="consent"[^>]*>/)[0];
assert.match(consent, /required/); assert.doesNotMatch(consent, /checked/);
console.log('3 OK: form posts grow-interest with name, need, unchecked required consent');

// 4. In-page anchors resolve; legal links present.
const ids = new Set([...html.matchAll(/\sid="([\w-]+)"/g)].map(m => m[1]));
for (const a of [...html.matchAll(/href="#([\w-]+)"/g)].map(m => m[1])) assert.ok(ids.has(a), a);
for (const l of ['../terms/', '../refund/', '../privacy/']) assert.ok(html.includes(`href="${l}"`), l);
console.log('4 OK: anchors resolve, Terms/Refund/Privacy linked');

// 5. Reference mapper accepts the page payload and keeps it held.
const body = { email: 'synthetic@example.test', name: 'Synthetic', need: 'Build the full system',
  form: hidden('form'), product_key: hidden('product_key'), offer_code: hidden('offer_code'), source: hidden('source'),
  consent: true, idempotency_key: 'grow-test-1', submitted_at: '2026-10-09T00:00:00Z', release_state: 'APPROVAL_HELD' };
const r = run(body)[0].json;
assert.equal(r.product_key, 'ACE-GROW'); assert.equal(r.qualified, false);
assert.equal(r.external_action_authorized, false); assert.deepEqual(r.notion_tags, []);
assert.throws(() => run({ ...body, product_key: 'ACE-MKT' }), /INVALID_PRODUCT_KEY/);
console.log('5 OK: grow-interest maps to ACE-GROW, held/unqualified/unauthorized, cross-binding rejected');
