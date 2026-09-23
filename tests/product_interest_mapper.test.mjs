import assert from 'node:assert/strict';
import fs from 'node:fs';

const code = fs.readFileSync(new URL('../n8n/validate_product_interest_map.js', import.meta.url), 'utf8');
const run = (body) => new Function('$', '$execution', code)(
  () => ({ first: () => ({ json: { body } }) }),
  { id: 'test-execution' }
);

const base = {
  email: 'Synthetic@example.test', name: 'Synthetic Person', need: 'Full operating system',
  form: 'ace-mkt-interest', product_key: 'ACE-MKT', offer_code: 'SYS-MKT', source: 'ace-mkt',
  consent: true, idempotency_key: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  submitted_at: '2026-09-17T00:00:00.000Z', release_state: 'APPROVAL_HELD'
};

// 1. Valid ACE-MKT payload stays held, unqualified, untagged, and unauthorized
//    for external action.
{
  const r = run(base)[0].json;
  assert.equal(r.schema_valid, true);
  assert.equal(r.qualified, false);
  assert.equal(r.qualification_status, 'PENDING');
  assert.deepEqual(r.notion_tags, []);
  assert.equal(r.tag_mapping_status, 'UNRESOLVED');
  assert.equal(r.release_state, 'APPROVAL_HELD');
  assert.equal(r.external_action_authorized, false);
  assert.equal(r.consent_granted, true);
  assert.equal(r.form, 'ace-mkt-interest');
  console.log('1 OK: valid ACE-MKT stays held/unqualified/untagged/unauthorized');
}

// 2. Valid P12 payload maps correctly and is equally held/unqualified/
//    untagged/unauthorized -- proves this isn't special-cased to one product.
{
  const p12 = { ...base, form: 'p12-interest', product_key: 'ACE-PRO', offer_code: 'P12', source: 'ace-p12' };
  const r = run(p12)[0].json;
  assert.equal(r.product_key, 'ACE-PRO');
  assert.equal(r.qualified, false);
  assert.deepEqual(r.notion_tags, []);
  assert.equal(r.external_action_authorized, false);
  console.log('2 OK: valid P12 maps correctly, still held/unqualified/untagged/unauthorized');
}

// 3. Missing idempotency_key must fail, with no fallback.
assert.throws(() => run({ ...base, idempotency_key: undefined }), /INVALID_IDEMPOTENCY_KEY/);
console.log('3 OK: missing idempotency_key rejected');

// 4. Malformed idempotency_key must fail, with no sanitization.
assert.throws(() => run({ ...base, idempotency_key: 'a!b' }), /INVALID_IDEMPOTENCY_KEY/);
console.log('4 OK: malformed idempotency_key rejected');

// 5. Two different malformed keys that would collide under a strip-then-use
//    approach ("a!b" and "a?b" would both become "ab") must be independently
//    rejected, never silently merged into an accepted, colliding key.
assert.throws(() => run({ ...base, idempotency_key: 'a!b' }), /INVALID_IDEMPOTENCY_KEY/);
assert.throws(() => run({ ...base, idempotency_key: 'a?b' }), /INVALID_IDEMPOTENCY_KEY/);
console.log('5 OK: both would-collide malformed keys independently rejected, not merged');

// 6. Cross-binding: ace-mkt-interest form with ACE-PRO product_key must fail.
assert.throws(() => run({ ...base, product_key: 'ACE-PRO' }), /INVALID_PRODUCT_KEY/);
console.log('6 OK: ace-mkt-interest + ACE-PRO cross-binding rejected');

// 7. Cross-binding: p12-interest form with ACE-MKT product_key must fail.
{
  const p12 = { ...base, form: 'p12-interest', product_key: 'ACE-PRO', offer_code: 'P12', source: 'ace-p12' };
  assert.throws(() => run({ ...p12, product_key: 'ACE-MKT' }), /INVALID_PRODUCT_KEY/);
  console.log('7 OK: p12-interest + ACE-MKT cross-binding rejected');
}

// 8. A release_state other than APPROVAL_HELD must fail -- proves this
//    validator cannot be used to smuggle through a live-release claim.
assert.throws(() => run({ ...base, release_state: 'LIVE' }), /RELEASE_NOT_APPROVAL_HELD/);
console.log('8 OK: non-held release_state rejected');

// 9. Missing/false consent must fail.
assert.throws(() => run({ ...base, consent: false }), /CONSENT_REQUIRED/);
console.log('9 OK: missing consent rejected');

// 10. Exact output shape: the returned object's key set matches exactly (no
//     extra, no missing fields), and every field's type is correct.
{
  const r = run(base)[0].json;
  const expectedKeys = ['email','name','need','form','product_key','offer_code','source','notion_source',
    'schema_valid','consent_granted','qualified','qualification_status','notion_tags','tag_mapping_status',
    'idempotency_key','submitted_at','release_state','external_action_authorized','synthetic','received_at'];
  assert.deepEqual(Object.keys(r).sort(), expectedKeys.sort());
  assert.equal(typeof r.email, 'string');
  assert.equal(typeof r.name, 'string');
  assert.equal(typeof r.need, 'string');
  assert.equal(typeof r.form, 'string');
  assert.equal(typeof r.product_key, 'string');
  assert.equal(typeof r.offer_code, 'string');
  assert.equal(typeof r.source, 'string');
  assert.equal(typeof r.notion_source, 'string');
  assert.equal(typeof r.schema_valid, 'boolean');
  assert.equal(typeof r.consent_granted, 'boolean');
  assert.equal(typeof r.qualified, 'boolean');
  assert.equal(typeof r.qualification_status, 'string');
  assert.ok(Array.isArray(r.notion_tags));
  assert.equal(typeof r.tag_mapping_status, 'string');
  assert.equal(typeof r.idempotency_key, 'string');
  assert.equal(typeof r.submitted_at, 'string');
  assert.equal(typeof r.release_state, 'string');
  assert.equal(typeof r.external_action_authorized, 'boolean');
  assert.equal(typeof r.synthetic, 'boolean');
  assert.equal(typeof r.received_at, 'string');
  console.log('10 OK: exact output field set and types confirmed');
}

// 11. Incorrect offer_code for the given form must fail.
assert.throws(() => run({ ...base, offer_code: 'WRONG-CODE' }), /INVALID_OFFER_CODE/);
console.log('11 OK: incorrect offer_code rejected');

// 12. Incorrect source for the given form must fail.
assert.throws(() => run({ ...base, source: 'wrong-source' }), /INVALID_SOURCE/);
console.log('12 OK: incorrect source rejected');

// 13. An invalid submitted_at (unparseable date) must fail.
assert.throws(() => run({ ...base, submitted_at: 'not-a-date' }), /INVALID_SUBMISSION_TIMESTAMP/);
console.log('13 OK: invalid submitted_at rejected');

console.log('PASS: PRODUCT_INTEREST mapper schema-validity, non-qualification, and non-authorization contract');
