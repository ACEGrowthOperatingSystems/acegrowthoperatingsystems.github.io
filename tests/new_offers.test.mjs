// New offers (Jim 15 Oct): /growth-website/ and /ace-mobile/. No network I/O.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const code = read('n8n/validate_product_interest_map.js');
const run = (body) => new Function('$', '$execution', code)(
  () => ({ first: () => ({ json: { body } }) }), { id: 'test-execution' });

// Approved 15 Oct (Perplexity-priced): setup / monthly per tier.
const PAGES = {
  'growth-website': { form: 'growth-website-reserve', product: 'ACE-WEB', offer: 'WEB-GROWTH', source: 'ace-growth-website',
    tiers: [['Launch Site', '$3,997', '$399'], ['Growth Site', '$7,997', '$1,199'], ['Autopilot Site', '$14,997', '$1,999']] },
  'ace-mobile': { form: 'ace-mobile-reserve', product: 'ACE-MOBILE', offer: 'MOBILE-COMMAND', source: 'ace-mobile',
    tiers: [['Mobile Command', '$2,997', '$199'], ['Sales Team App', '$9,997', '$599'], ['Growth App', '$17,997', '$1,199']] },
};

for (const [slug, c] of Object.entries(PAGES)) {
  const html = read(`${slug}/index.html`);
  const hidden = (n) => (html.match(new RegExp(`name="${n}" value="([^"]+)"`)) || [])[1];

  test(`${slug}: held by its own flag, noindex, gated scripts`, () => {
    assert.match(html, /data-release-state="APPROVAL_HELD"/);
    assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
    assert.ok(html.indexOf('release-flag.js') < html.indexOf('product-launch.js'));
  });

  test(`${slug}: approved prices, in tier order`, () => {
    let at = 0;
    for (const [name, setup, mo] of c.tiers) {
      const i = html.indexOf(`<h3>${name}</h3>`, at);
      assert.ok(i > at, `${name} missing or out of order`); at = i;
      const card = html.slice(i, html.indexOf('</article>', i));
      assert.ok(card.includes(`<span>${setup}</span> setup`), `${name} setup`);
      assert.ok(card.includes(`<span>${mo}</span>/month`), `${name} monthly`);
    }
  });

  test(`${slug}: no Stripe link, no WithYou, no earnings claims`, () => {
    assert.doesNotMatch(html, /buy\.stripe\.com|checkout\.stripe/);
    assert.doesNotMatch(html, /WithYou|LifeGuide/i);
    assert.doesNotMatch(html, /guarantee|\bROI\b|revenue of \$|earn \$/i);
  });

  test(`${slug}: 6-month minimum stated (Jim 15 Oct) and matched in Terms/Refund`, () => {
    assert.ok(html.includes('Cancel anytime after 6 months.'));
    assert.match(read('terms/index.html'), /6-month minimum term/);
    assert.match(read('refund/index.html'), /6-month minimum term/);
  });

  test(`${slug}: anchors resolve, legal linked`, () => {
    const ids = new Set([...html.matchAll(/\sid="([\w-]+)"/g)].map(m => m[1]));
    for (const a of [...html.matchAll(/href="#([\w-]+)"/g)].map(m => m[1])) assert.ok(ids.has(a), a);
    for (const l of ['../terms/', '../refund/', '../privacy/']) assert.ok(html.includes(`href="${l}"`), l);
  });

  test(`${slug}: reserve form maps through the intake contract and stays held`, () => {
    assert.equal(hidden('form'), c.form); assert.equal(hidden('product_key'), c.product);
    assert.equal(hidden('offer_code'), c.offer); assert.equal(hidden('source'), c.source);
    const body = { email: 'synthetic@example.test', name: 'Synthetic', need: c.tiers[0][0], form: c.form,
      product_key: c.product, offer_code: c.offer, source: c.source, consent: true,
      idempotency_key: `${slug}-test-1`, submitted_at: '2026-10-15T00:00:00Z', release_state: 'APPROVAL_HELD' };
    const r = run(body)[0].json;
    assert.equal(r.product_key, c.product); assert.equal(r.qualified, false);
    assert.equal(r.external_action_authorized, false);
    assert.throws(() => run({ ...body, product_key: 'ACE-GROW' }), /INVALID_PRODUCT_KEY/);
  });
}
