// Site menu + Checkout button (assets/site-nav.js). Fail-closed release flag,
// separate from every page's own data-release-state.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const src = read('assets/site-nav.js');
const PAGES = ['index.html', 'terms/index.html', 'refund/index.html', 'privacy/index.html', 'start/index.html', 'checkout/ace-mkt/index.html'];

const withState = (v) => src.replace('const NAV_RELEASE_STATE="APPROVAL_HELD";', `const NAV_RELEASE_STATE=${JSON.stringify(v)};`);

function run(source, search = '') {
  const ctx = { window: { location: { search } }, URLSearchParams };
  vm.runInNewContext(source, ctx); // no document: must not touch the DOM
  return ctx.window.ACE_SITE_NAV;
}

test('ships held', () => {
  assert.match(src, /const NAV_RELEASE_STATE="APPROVAL_HELD";/);
  const nav = run(src);
  assert.equal(nav.released, false);
  assert.equal(nav.shown, false);
});

test('only the exact string RELEASED releases it', () => {
  for (const v of ['released', 'RELEASED ', 'Released', '', 'APPROVED']) {
    const nav = run(withState(v));
    assert.equal(nav.released, v === 'RELEASED', `value ${JSON.stringify(v)}`);
  }
  assert.equal(run(withState('RELEASED')).shown, true);
});

test('?preview=1 shows the held nav for review but does not release it', () => {
  const nav = run(src, '?preview=1');
  assert.equal(nav.shown, true);
  assert.equal(nav.released, false);
});

test('Checkout leads to the catalog; no payment link or price in this file', () => {
  assert.equal(run(src).checkoutHref, '/catalog/#plans');
  assert.doesNotMatch(src, /buy\.stripe\.com|\$\d/);
  assert.doesNotMatch(src, /fetch\(|XMLHttpRequest|sendBeacon/);
});

test('every listed page loads the nav once and keeps its own release state', () => {
  for (const p of PAGES) {
    const html = read(p);
    assert.equal((html.match(/src="\/assets\/site-nav\.js"/g) || []).length, 1, p);
  }
  for (const p of ['start/index.html', 'checkout/ace-mkt/index.html']) {
    assert.match(read(p), /data-release-state="APPROVAL_HELD"/, p);
  }
});
