// My ACE customer account page (5.09, Jim 12 Oct). No network I/O.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const html = read('my-ace/index.html');
const js = read('assets/my-ace.js');
const cfgSrc = read('assets/my-ace-config.js');

function loadConfig() {
  const ctx = { window: {} };
  vm.runInNewContext(cfgSrc, ctx);
  return ctx.window.ACE_MYACE_CONFIG;
}

test('page is held by its own flag and noindex', () => {
  assert.match(html, /<body[^>]*data-release-state="APPROVAL_HELD"/);
  assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
  assert.match(html, /<main[\s>]/);
  assert.ok(html.indexOf('release-flag.js') < html.indexOf('assets/my-ace.js'));
  assert.ok(html.indexOf('my-ace-config.js') < html.indexOf('assets/my-ace.js'));
});

test('ids are unique', () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'duplicate id');
});

test('every element the controller reads exists in the page', () => {
  const wanted = [...new Set([...js.matchAll(/\$\("#([a-z0-9-]+)"\)/g)].map(m => m[1]))];
  for (const id of wanted) assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  for (const id of ['signin', 'nocustomer', 'dash', 'held']) assert.ok(html.includes(`id="${id}"`));
});

test('all approved sections are present', () => {
  for (const s of ['Sign in', 'Usage credit', 'Drafts awaiting your approval', 'My plan', 'Onboarding', 'Billing', 'live representative']) {
    assert.ok(html.includes(s), s);
  }
});

test('held page never touches the network', () => {
  const held = js.slice(js.indexOf('if(!RELEASED){'), js.indexOf('startLive().catch'));
  assert.ok(held.length > 0);
  assert.doesNotMatch(held, /startLive\(|createClient|signInWithOtp|rpc\(/);
  assert.match(js, /const RELEASED=Boolean\(window\.ACE_RELEASE&&window\.ACE_RELEASE\.isReleased\(\)\)/);
});

test('only the three granted RPCs are called', () => {
  const calls = [...new Set([...js.matchAll(/rpc\("([a-z_]+)"/g)].map(m => m[1]))].sort();
  assert.deepEqual(calls, ['my_ace_decide_draft', 'my_ace_request_live_rep', 'my_ace_summary']);
});

test('config carries only a publishable key and no secret', () => {
  const cfg = loadConfig();
  assert.match(cfg.supabaseKey, /^sb_publishable_/);
  assert.doesNotMatch(cfgSrc, /sb_secret_|service_role|sk_live_|sk_test_|rk_live_/);
  assert.equal(cfg.billingPortalUrl, null, 'billing portal stays null until Jim approves live Stripe');
  assert.equal(JSON.stringify(cfg.topUps.map(t => t.usd)), "[20,50,100]");
  assert.ok(cfg.topUps.every(t => t.url === null || /^https:\/\/buy\.stripe\.com\/[A-Za-z0-9_]+$/.test(t.url)));
});

test('third-party script is pinned to an exact version', () => {
  assert.match(html, /@supabase\/supabase-js@\d+\.\d+\.\d+\//);
});

test('user-provided text is escaped before rendering', () => {
  assert.match(js, /const esc=/);
  assert.match(js, /\$\{esc\(d\.title\)\}/);
  assert.match(js, /\$\{esc\(x\.category\)\}/);
});
