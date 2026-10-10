// /start/ AUTOMATE funnel: questionnaire gateway to the ACE demo. No network I/O.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const html = read('start/index.html');
const configSrc = read('assets/start-config.js');
const controller = read('assets/start-funnel.js');
const mapperSrc = read('n8n/validate_product_interest_map.js');
const manifest = JSON.parse(read('launch-readiness/product-pages-20260913.json'));
const hidden = (name) => (html.match(new RegExp(`name="${name}" value="([^"]+)"`)) || [])[1];

function loadConfig(src = configSrc) {
  const ctx = { window: {} };
  vm.runInNewContext(src, ctx);
  return ctx.window.ACE_START_CONFIG;
}
const runMapper = (body) => new Function('$', '$execution', mapperSrc)(
  () => ({ first: () => ({ json: { body } }) }), { id: 'start-funnel-test' })[0].json;

const INTERESTS = [
  'Automated prospecting', 'Automated marketing &amp; social posting', 'Automated sales systems',
  'Instant lead response &amp; follow-up', 'Automated booking', 'Automated proposals',
  'Accelerated growth &amp; profitability',
];

test('page is held by its own flag and noindex', () => {
  assert.match(html, /<body[^>]*data-release-state="APPROVAL_HELD"/);
  assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.match(html, /<main[\s>]/);
  // release-flag.js must load before the controller so the gate can read it.
  assert.ok(html.indexOf('release-flag.js') < html.indexOf('start-funnel.js'));
  assert.ok(html.indexOf('start-config.js') < html.indexOf('start-funnel.js'));
});

test('form posts as automate-demo from ig-comment-automate', () => {
  assert.equal(hidden('form'), 'automate-demo');
  assert.equal(hidden('source'), 'ig-comment-automate');
  const route = manifest.routes.find(r => r.form === 'automate-demo');
  assert.ok(route, 'automate-demo must be registered in the launch manifest');
  assert.equal(route.path, '/start/');
  assert.equal(hidden('product_key'), route.product_key);
  assert.equal(hidden('offer_code'), route.offer_code);
});

test('headline, 4 questions and all 7 interest options are present', () => {
  assert.ok(html.includes('Your free ACE demo is one minute away.'));
  assert.ok(html.includes('Answer 4 quick questions and watch how ACE automates your growth.'));
  for (const q of ['What kind of business do you run?', 'How many people on your team?',
    'What’s slowing your growth most right now?', 'Could your business benefit from…']) {
    assert.ok(html.includes(q), `missing question: ${q}`);
  }
  assert.equal((html.match(/data-step="\d"/g) || []).length, 4, 'four steps');
  for (const opt of ['Home services / trades', 'Professional services', 'Health &amp; wellness', 'Real estate',
    'Retail / e-commerce', 'Agency / consulting']) assert.ok(html.includes(`<option>${opt}</option>`), opt);
  for (const size of ['1', '2–5', '6–20', '21–50', '50+']) assert.ok(html.includes(`name="team_size" value="${size}"`), size);
  for (const b of ['Not enough leads', 'Leads go cold before we follow up', 'Too much time on admin',
    'Inconsistent marketing / posting', 'Proposals and quotes take too long']) {
    assert.ok(html.includes(`name="bottleneck" value="${b}"`), b);
  }
  const boxes = [...html.matchAll(/<input type="checkbox" name="interests" value="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(boxes, INTERESTS);
  assert.ok(html.includes('>Unlock my demo<'));
  assert.ok(html.includes('>Book your free demo<'));
  // Success state hands off to the homepage CHOOSE YOUR DEMO picker (mapped interests).
  assert.match(html, /id="chooseDemo" href="\/#choose-demo">Choose your demo</);
  assert.match(controller, /choose\.href=chooseDemoHref\(interests\)/);
});

test('email is required; consent is a required, unchecked checkbox with a Privacy link', () => {
  assert.match(html, /<input type="email" name="email"[^>]*required/);
  assert.match(html, /name="first_name"[^>]*required/);
  assert.match(html, /<select id="business_type" name="business_type" required>/);
  const consent = html.match(/<input[^>]*name="consent"[^>]*>/)[0];
  assert.match(consent, /type="checkbox"/); assert.match(consent, /required/); assert.doesNotMatch(consent, /checked/);
  assert.match(html, /I can unsubscribe at any time\. See the <a href="\.\.\/privacy\/">Privacy Policy<\/a>/);
  for (const l of ['../terms/', '../refund/', '../privacy/', 'mailto:AceGrowth.os@gmail.com']) assert.ok(html.includes(`href="${l}"`), l);
});

test('placeholders in start-config.js gate the video and the booking button', () => {
  const c = loadConfig();
  assert.equal(c.DEMO_VIDEO_URL, 'REPLACE_WITH_DEMO_VIDEO');
  assert.equal(c.BOOKING_URL, 'REPLACE_WITH_BOOKING_LINK');
  assert.equal(c.videoConfigured, false);
  assert.equal(c.bookingConfigured, false);
  assert.equal(c.isConfigured('http://insecure.example/x.mp4'), false, 'http is never configured');
  const live = loadConfig(configSrc
    .replace('"REPLACE_WITH_DEMO_VIDEO"', '"https://cdn.example.test/demo.mp4"')
    .replace('"REPLACE_WITH_BOOKING_LINK"', '"https://cal.example.test/ace"'));
  assert.equal(live.videoConfigured, true);
  assert.equal(live.bookingConfigured, true);
  // The controller only builds a <video> / reveals booking behind those flags,
  // and the page ships with the booking button and video slot hidden.
  assert.match(controller, /if\(CONFIG\.videoConfigured\)\{[\s\S]*createElement\("video"\)/);
  assert.match(controller, /if\(CONFIG\.bookingConfigured\)\{[\s\S]*book\.hidden=false/);
  assert.match(html, /id="bookDemo" hidden/);
  assert.match(html, /id="videoSlot" hidden/);
  assert.ok(html.includes('Your demo video is on its way to your inbox.'));
  assert.match(html, /\[hidden\]\{display:none!important\}/, 'hidden must beat .btn display');
});

test('controller holds submission: per-page gate returns before fetch', () => {
  assert.match(controller, /const RELEASE_AUTHORIZED=Boolean\(window\.ACE_RELEASE&&window\.ACE_RELEASE\.isReleased\(\)\);/);
  assert.equal([...controller.matchAll(/\b[A-Z][A-Z0-9_]*_AUTHORIZED\s*=\s*true\b/g)].length, 0);
  const gate = controller.indexOf('if(!RELEASE_AUTHORIZED)');
  const call = controller.indexOf('fetch(');
  assert.ok(gate > -1 && call > gate, 'gate must precede fetch');
  assert.match(controller.slice(gate, controller.indexOf('}', gate) + 1), /return/);
  assert.match(controller, /idempotency_key:crypto\.randomUUID\(\)/);
  assert.match(controller, /interests:data\.getAll\("interests"\)/);
  for (const f of ['business_type', 'team_size', 'bottleneck', 'first_name', 'email', 'consent']) {
    assert.ok(controller.includes(`${f}:`), `payload field ${f}`);
  }
  assert.match(controller, /params\.get\("src"\)/);
  assert.match(controller, /"utm_source","utm_medium","utm_campaign","utm_term","utm_content"/);
});

test('reference mapper accepts the /start/ payload and keeps it held', () => {
  const body = {
    form: 'automate-demo', source: 'ig-comment-automate', product_key: hidden('product_key'), offer_code: hidden('offer_code'),
    src: 'ig-comment-automate', utm_source: 'instagram', utm_campaign: 'automate',
    business_type: 'Real estate', team_size: '2–5', bottleneck: 'Not enough leads',
    interests: ['Automated prospecting', 'Automated booking'], first_name: 'Synthetic', email: 'Synthetic@Example.test',
    consent: true, idempotency_key: 'start-test-1', submitted_at: '2026-10-10T00:00:00Z', release_state: 'APPROVAL_HELD',
  };
  const r = runMapper(body);
  assert.equal(r.form, 'automate-demo');
  assert.equal(r.email, 'synthetic@example.test');
  assert.equal(r.name, 'Synthetic'); assert.equal(r.need, 'Not enough leads');
  assert.deepEqual(r.interests, ['Automated prospecting', 'Automated booking']);
  assert.equal(r.business_type, 'Real estate'); assert.equal(r.team_size, '2–5'); assert.equal(r.src, 'ig-comment-automate');
  assert.equal(r.qualified, false); assert.equal(r.external_action_authorized, false); assert.equal(r.release_state, 'APPROVAL_HELD');
  assert.throws(() => runMapper({ ...body, consent: false }), /CONSENT_REQUIRED/);
  assert.throws(() => runMapper({ ...body, product_key: 'ACE-GROW' }), /INVALID_PRODUCT_KEY/);
  assert.throws(() => runMapper({ ...body, source: 'ace-grow' }), /INVALID_SOURCE/);
});

test('no forbidden strings or unapproved pricing on the funnel', () => {
  for (const [name, src] of [['start/index.html', html], ['start-config.js', configSrc], ['start-funnel.js', controller]]) {
    for (const bad of ['$99', 'Content Starter', 'eight images', 'buy.stripe.com/test_']) {
      assert.ok(!src.includes(bad), `${name} contains forbidden "${bad}"`);
    }
    assert.doesNotMatch(src, /\$\d/, `${name} contains a dollar figure`);
  }
  // Public copy is ACE-only (the controller's shared intake host is exempt).
  assert.doesNotMatch(html, /WithYou/i, 'page mentions WithYou');
});
