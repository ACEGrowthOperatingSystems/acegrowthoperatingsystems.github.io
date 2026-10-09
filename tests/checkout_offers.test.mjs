import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadConfig(src) {
  const ctx = { window: {} };
  vm.runInNewContext(src ?? fs.readFileSync('assets/checkout-config.js', 'utf8'), ctx);
  return ctx.window.ACE_CHECKOUT;
}

// Approved launch prices (ace_v2.price_schedule; standard = launch / 0.65 rounded down to $10).
const APPROVED = {
  'ENTRY-CONTENT-STARTER': ['$99/month', '$150/month', '$10'],
  'SA-CONTENT-DISTRIBUTION': ['$405/month', '$620/month', '$42'],
  'SA-CONTENT-CREATION': ['$510/month', '$780/month', '$54'],
  'SA-CREATION-DISTRIBUTION': ['$815/month', '$1,250/month', '$84'],
  'TIER-ESSENTIAL': ['$1,500 onboarding + $810/month', '$2,300 onboarding + $1,240/month', '$78'],
  'TIER-PROFESSIONAL': ['$3,500 onboarding + $1,530/month', '$5,380 onboarding + $2,350/month', '$180'],
  'TIER-GROWTH': ['$7,500 onboarding + $3,060/month', '$11,530 onboarding + $4,700/month', '$360'],
};

test('every offer shows the approved launch, standard and credit figures', () => {
  const c = loadConfig();
  assert.deepEqual(Object.keys(c.prices).sort(), Object.keys(APPROVED).sort());
  for (const [k, [launch, std, credit]] of Object.entries(APPROVED)) {
    assert.equal(c.prices[k], launch, k);
    assert.equal(c.standard[k], std, k);
    assert.equal(c.credit[k], credit, k);
  }
});

test('no offer is configured while links are placeholders', () => {
  const c = loadConfig();
  for (const k of Object.keys(APPROVED)) assert.equal(c.isConfigured(k), false, k);
});

test('a Stripe TEST link never counts as configured; a live link does', () => {
  const src = fs.readFileSync('assets/checkout-config.js', 'utf8');
  const t = loadConfig(src.replace('{key:"TIER-ESSENTIAL",name:"Essential",launch:"$1,500 onboarding + $810/month",standard:"$2,300 onboarding + $1,240/month",credit:"$78",link:PLACEHOLDER}',
    '{key:"TIER-ESSENTIAL",name:"Essential",launch:"$1,500 onboarding + $810/month",standard:"$2,300 onboarding + $1,240/month",credit:"$78",link:"https://buy.stripe.com/test_abc123"}'));
  assert.equal(t.isConfigured('TIER-ESSENTIAL'), false);
  const l = loadConfig(src.replace('{key:"TIER-ESSENTIAL",name:"Essential",launch:"$1,500 onboarding + $810/month",standard:"$2,300 onboarding + $1,240/month",credit:"$78",link:PLACEHOLDER}',
    '{key:"TIER-ESSENTIAL",name:"Essential",launch:"$1,500 onboarding + $810/month",standard:"$2,300 onboarding + $1,240/month",credit:"$78",link:"https://buy.stripe.com/abc123"}'));
  assert.equal(l.isConfigured('TIER-ESSENTIAL'), true);
  assert.equal(l.isConfigured('https://evil.example'), false);
});

test('checkout page has a buy button for each offer and stays held', () => {
  const html = fs.readFileSync('checkout/ace-mkt/index.html', 'utf8');
  assert.match(html, /data-release-state="APPROVAL_HELD"/);
  for (const k of Object.keys(APPROVED)) assert.match(html, new RegExp(`data-buy="${k}"`), k);
  assert.doesNotMatch(html, /data-buy="TIER-ENTERPRISE"/);
  assert.match(html, /href="..\/..\/terms\/"/);
  assert.match(html, /href="..\/..\/refund\/"/);
});
