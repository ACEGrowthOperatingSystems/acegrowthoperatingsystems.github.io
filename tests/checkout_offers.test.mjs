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
  'SA-CONTENT-DISTRIBUTION': ['$405/month', '$620/month', '$42'],
  'SA-CONTENT-CREATION': ['$510/month', '$780/month', '$54'],
  'SA-CREATION-DISTRIBUTION': ['$815/month', '$1,250/month', '$84'],
  'TIER-ESSENTIAL': ['$1,500 onboarding + $810/month', '$2,300 onboarding + $1,240/month', '$78'],
  'TIER-PROFESSIONAL': ['$3,500 onboarding + $1,530/month', '$5,380 onboarding + $2,350/month', '$180'],
  'TIER-GROWTH': ['$7,500 onboarding + $3,060/month', '$11,530 onboarding + $4,700/month', '$360'],
};

// Enterprise is display-only (sold by contact), priced from the same config.
const ENTERPRISE = ['TIER-ENTERPRISE', 'From $15,000 onboarding + $7,650/month'];

test('exactly six buyable offers; Content Starter is retired', () => {
  const c = loadConfig();
  const buyable = [...c.offers].filter(o => !o.contactOnly).map(o => String(o.key));
  assert.equal(buyable.length, 6);
  assert.deepEqual([...buyable].sort(), Object.keys(APPROVED).sort());
  assert.equal(c.prices['ENTRY-CONTENT-STARTER'], undefined);
});

test('Enterprise price lives in config and is contact-only, never a buy link', () => {
  const src = fs.readFileSync('assets/checkout-config.js', 'utf8');
  const c = loadConfig(src);
  assert.equal(c.prices[ENTERPRISE[0]], ENTERPRISE[1]);
  assert.equal(c.contactOnly[ENTERPRISE[0]], true);
  assert.equal(c.isConfigured(ENTERPRISE[0]), false);
  const live = loadConfig(src.replace('credit:null,link:PLACEHOLDER,contactOnly:true', 'credit:null,link:"https://buy.stripe.com/abc123",contactOnly:true'));
  assert.equal(live.isConfigured(ENTERPRISE[0]), false, 'contact-only offer must never become buyable');
});

test('every offer shows the approved launch, standard and credit figures', () => {
  const c = loadConfig();
  assert.deepEqual(Object.keys(c.prices).sort(), [...Object.keys(APPROVED), ENTERPRISE[0]].sort());
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
  assert.doesNotMatch(html, /ENTRY-CONTENT-STARTER|Content Starter/);
  assert.match(html, /data-price-for="TIER-ENTERPRISE"/);
  assert.doesNotMatch(html, /\$\d/, 'no price may be hard-coded in the checkout page');
  assert.match(html, /href="..\/..\/terms\/"/);
  assert.match(html, /href="..\/..\/refund\/"/);
});
