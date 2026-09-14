// Fail-closed verifier for the ACE /marketing/ and /p12/ launch-preview routes.
// Every check must explicitly PASS; any error, missing file, or unmet condition
// is treated as FAIL. Nothing here performs network I/O.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function readFileSafe(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}

function fail(name, detail) {
  return { name, pass: false, detail };
}
function ok(name, detail = '') {
  return { name, pass: true, detail };
}

// --- Individual checks. Each takes an in-memory "sources" bag so they can be
// unit-tested against fixtures without touching the real filesystem. ---

export function checkRouteRenders(sources, routeKey, routeLabel) {
  const html = sources[routeKey];
  if (html == null) return fail(`${routeLabel}: file exists`, 'file missing');
  if (!/<html[\s>]/i.test(html) || !/<title>/i.test(html) || !/<main[\s>]/i.test(html)) {
    return fail(`${routeLabel}: renders`, 'missing <html>/<title>/<main>');
  }
  return ok(`${routeLabel}: renders`);
}

export function checkMarketingOwnership(sources) {
  const html = sources.marketing;
  if (html == null) return fail('marketing: canonical ownership', 'file missing');
  if (!/ACE Automated Marketing Operating System/.test(html)) {
    return fail('marketing: canonical ownership', 'missing canonical product name "ACE Automated Marketing Operating System"');
  }
  if (/WithYou/i.test(html)) {
    return fail('marketing: canonical ownership', 'WithYou must not be represented on an ACE product page');
  }
  return ok('marketing: canonical ownership');
}

export function checkP12Ownership(sources) {
  const html = sources.p12;
  if (html == null) return fail('p12: canonical ownership', 'file missing');
  if (!/ACE Prospecting Operating System/.test(html)) {
    return fail('p12: canonical ownership', 'missing parent system "ACE Prospecting Operating System"');
  }
  if (!/Account Intelligence Engine and ICP Builder/.test(html)) {
    return fail('p12: canonical ownership', 'missing canonical identity "Account Intelligence Engine and ICP Builder"');
  }
  if (/ACE Professional Services/.test(html)) {
    return fail('p12: canonical ownership', 'incorrect parent system "ACE Professional Services" still present');
  }
  if (/WithYou/i.test(html)) {
    return fail('p12: canonical ownership', 'WithYou must not be represented on an ACE product page');
  }
  return ok('p12: canonical ownership');
}

export function checkAnchorsResolve(sources, routeKey, routeLabel) {
  const html = sources[routeKey];
  if (html == null) return fail(`${routeLabel}: CTA anchors resolve`, 'file missing');
  const hrefIds = [...html.matchAll(/href="#([\w-]+)"/g)].map(m => m[1]);
  const ids = new Set([...html.matchAll(/\sid="([\w-]+)"/g)].map(m => m[1]));
  const missing = hrefIds.filter(id => !ids.has(id));
  if (hrefIds.length === 0) return fail(`${routeLabel}: CTA anchors resolve`, 'no in-page CTA anchors found');
  if (missing.length) return fail(`${routeLabel}: CTA anchors resolve`, `unresolved anchors: ${missing.join(', ')}`);
  return ok(`${routeLabel}: CTA anchors resolve`);
}

export function checkConsentRequiredUnchecked(sources, routeKey, routeLabel) {
  const html = sources[routeKey];
  if (html == null) return fail(`${routeLabel}: consent required + unchecked`, 'file missing');
  const m = html.match(/<input[^>]*name="consent"[^>]*>/);
  if (!m) return fail(`${routeLabel}: consent required + unchecked`, 'no consent checkbox found');
  const tag = m[0];
  if (!/type="checkbox"/.test(tag)) return fail(`${routeLabel}: consent required + unchecked`, 'consent field is not a checkbox');
  if (!/\brequired\b/.test(tag)) return fail(`${routeLabel}: consent required + unchecked`, 'consent checkbox is not required');
  if (/\bchecked\b/.test(tag)) return fail(`${routeLabel}: consent required + unchecked`, 'consent checkbox is checked by default');
  return ok(`${routeLabel}: consent required + unchecked`);
}

export function checkReleaseAuthorizedFalse(sources) {
  const js = sources.js;
  if (js == null) return fail('form controller: RELEASE_AUTHORIZED=false', 'file missing');
  if (!/RELEASE_AUTHORIZED\s*=\s*false\s*;/.test(js)) {
    return fail('form controller: RELEASE_AUTHORIZED=false', 'RELEASE_AUTHORIZED is not literally false');
  }
  return ok('form controller: RELEASE_AUTHORIZED=false');
}

export function checkNoLiveSubmission(sources) {
  const js = sources.js;
  if (js == null) return fail('form controller: no live submission', 'file missing');
  const gateIdx = js.indexOf('if(!RELEASE_AUTHORIZED)');
  const fetchIdx = js.indexOf('fetch(');
  if (gateIdx === -1) return fail('form controller: no live submission', 'no RELEASE_AUTHORIZED gate found');
  if (fetchIdx === -1) return fail('form controller: no live submission', 'no fetch() call found to gate');
  if (gateIdx > fetchIdx) return fail('form controller: no live submission', 'RELEASE_AUTHORIZED gate is not before fetch()');
  const gateBlock = js.slice(gateIdx, js.indexOf('}', gateIdx) + 1);
  if (!/return/.test(gateBlock)) {
    return fail('form controller: no live submission', 'gate block does not return before reaching fetch()');
  }
  return ok('form controller: no live submission');
}

export function checkIdempotencyKey(sources) {
  const js = sources.js;
  if (js == null) return fail('form controller: idempotency key', 'file missing');
  if (!/idempotency_key\s*:\s*crypto\.randomUUID\(\)/.test(js)) {
    return fail('form controller: idempotency key', 'payload does not attach a fresh idempotency_key');
  }
  return ok('form controller: idempotency key');
}

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9]{16,}/,
  /AIza[0-9A-Za-z_-]{20,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /Authorization"\s*:\s*"Bearer /,
  /SUPABASE_SERVICE_ROLE/,
  /\bpassword"\s*:\s*"[^"]+"/i,
];

export function checkNoSecrets(sources) {
  for (const [key, content] of Object.entries(sources)) {
    if (content == null) continue;
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(content)) {
        return fail('no secrets or credentials', `pattern ${pattern} matched in ${key}`);
      }
    }
  }
  return ok('no secrets or credentials');
}

const DISALLOWED_TIER_WORDS = ['Essential', 'Professional', 'Growth', 'Enterprise', 'à la carte', 'a la carte'];

export function checkNoUnsupportedClaims(sources, routeKey, routeLabel) {
  const html = sources[routeKey];
  if (html == null) return fail(`${routeLabel}: no unsupported pricing/tier claims`, 'file missing');
  if (/\$\d/.test(html)) {
    return fail(`${routeLabel}: no unsupported pricing/tier claims`, 'a dollar figure is present');
  }
  // Strip known non-tier brand usages ("ACE Growth Operating Systems", "ACE GROWTH OS")
  // before scanning, so the org's own name doesn't false-positive as a pricing tier.
  const scanText = html
    .replace(/ACE Growth Operating Systems/gi, '')
    .replace(/ACE GROWTH OS/gi, '');
  for (const word of DISALLOWED_TIER_WORDS) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(scanText)) {
      return fail(`${routeLabel}: no unsupported pricing/tier claims`, `tier word "${word}" present`);
    }
  }
  return ok(`${routeLabel}: no unsupported pricing/tier claims`);
}

export function checkMobileKeyboardUsable(sources) {
  const css = sources.css;
  if (css == null) return fail('mobile/keyboard usability', 'css file missing');
  if (!/@media\(max-width:760px\)/.test(css)) {
    return fail('mobile/keyboard usability', 'no mobile breakpoint found');
  }
  if (!/\.skip:focus/.test(css)) {
    return fail('mobile/keyboard usability', 'no visible skip-link focus style');
  }
  if (!/input:focus,select:focus,textarea:focus\{outline/.test(css)) {
    return fail('mobile/keyboard usability', 'no visible focus outline on form fields');
  }
  return ok('mobile/keyboard usability');
}

export function checkManifestMatchesImplementation(sources) {
  const name = 'manifest matches physical implementation';
  if (sources.manifest == null) return fail(name, 'manifest file missing');
  let manifest;
  try {
    manifest = JSON.parse(sources.manifest);
  } catch (e) {
    return fail(name, `manifest is not valid JSON: ${e.message}`);
  }
  if (manifest.release_state !== 'APPROVAL_HELD') return fail(name, 'manifest release_state is not APPROVAL_HELD');
  if (manifest.live_submission_enabled !== false) return fail(name, 'manifest live_submission_enabled is not false');

  const routeMap = { '/marketing/': 'marketing', '/p12/': 'p12' };
  for (const route of manifest.routes || []) {
    const key = routeMap[route.path];
    if (!key) return fail(name, `manifest references unknown route path ${route.path}`);
    const html = sources[key];
    if (html == null) return fail(name, `route file missing for ${route.path}`);
    for (const [field, expected] of [
      ['product_key', route.product_key],
      ['offer_code', route.offer_code],
      ['form', route.form],
      ['source', route.source],
    ]) {
      const re = new RegExp(`name="${field}"\\s+value="${expected}"`);
      if (!re.test(html)) {
        return fail(name, `${route.path}: hidden field ${field} does not equal manifest value "${expected}"`);
      }
    }
    const bodyTag = html.match(/<body[^>]*data-release-state="([^"]+)"/);
    if (!bodyTag || bodyTag[1] !== manifest.release_state) {
      return fail(name, `${route.path}: data-release-state does not match manifest release_state`);
    }
    if (route.consent_required !== true) {
      return fail(name, `${route.path}: manifest does not mark consent_required true`);
    }
  }
  return ok(name);
}

export function runAllChecks(sources) {
  return [
    checkRouteRenders(sources, 'marketing', 'marketing'),
    checkRouteRenders(sources, 'p12', 'p12'),
    checkMarketingOwnership(sources),
    checkP12Ownership(sources),
    checkAnchorsResolve(sources, 'marketing', 'marketing'),
    checkAnchorsResolve(sources, 'p12', 'p12'),
    checkConsentRequiredUnchecked(sources, 'marketing', 'marketing'),
    checkConsentRequiredUnchecked(sources, 'p12', 'p12'),
    checkReleaseAuthorizedFalse(sources),
    checkNoLiveSubmission(sources),
    checkIdempotencyKey(sources),
    checkNoSecrets(sources),
    checkNoUnsupportedClaims(sources, 'marketing', 'marketing'),
    checkNoUnsupportedClaims(sources, 'p12', 'p12'),
    checkMobileKeyboardUsable(sources),
    checkManifestMatchesImplementation(sources),
  ];
}

export function loadRealSources() {
  return {
    marketing: readFileSafe('marketing/index.html'),
    p12: readFileSafe('p12/index.html'),
    js: readFileSafe('assets/product-launch.js'),
    css: readFileSafe('assets/product-launch.css'),
    manifest: readFileSafe('launch-readiness/product-pages-20260913.json'),
  };
}

function main() {
  const results = runAllChecks(loadRealSources());
  const failed = results.filter(r => !r.pass);
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}: ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  // Fail-closed: any failure, or zero checks having run at all, is a hard failure.
  if (failed.length > 0 || results.length === 0) {
    process.exit(1);
  }
  process.exit(0);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
