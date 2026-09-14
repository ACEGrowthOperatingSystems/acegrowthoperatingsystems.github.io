import assert from 'node:assert/strict';
import {
  runAllChecks,
  loadRealSources,
  checkP12Ownership,
  checkConsentRequiredUnchecked,
  checkReleaseAuthorizedFalse,
  checkNoLiveSubmission,
  checkNoSecrets,
  checkNoUnsupportedClaims,
  checkManifestMatchesImplementation,
} from '../scripts/verify_launch_pages.mjs';

// --- Fixtures: minimal but structurally valid stand-ins for the real routes. ---
function goodSources() {
  const marketingHtml = `<!doctype html><html><head><title>ACE Automated Marketing Operating System</title></head>
<body data-release-state="APPROVAL_HELD">
<main id="main">
<a href="#interest">Review</a>
<section id="interest"></section>
<form><input type="hidden" name="product_key" value="ACE-MKT"><input type="hidden" name="offer_code" value="SYS-MKT">
<input type="hidden" name="form" value="ace-mkt-interest"><input type="hidden" name="source" value="ace-mkt">
<input type="checkbox" name="consent" required></form>
</main></body></html>`;

  const p12Html = `<!doctype html><html><head><title>P12</title></head>
<body data-release-state="APPROVAL_HELD">
<main id="main">
<p>ACE Prospecting Operating System · P12 Account Intelligence Engine and ICP Builder</p>
<a href="#interest">Review</a>
<section id="interest"></section>
<form><input type="hidden" name="product_key" value="ACE-PRO"><input type="hidden" name="offer_code" value="P12">
<input type="hidden" name="form" value="p12-interest"><input type="hidden" name="source" value="ace-p12">
<input type="checkbox" name="consent" required></form>
</main></body></html>`;

  const js = `(()=>{"use strict";const RELEASE_AUTHORIZED=false;
if(!RELEASE_AUTHORIZED){return}
fetch("https://example.test");
const payload={idempotency_key:crypto.randomUUID()};
})();`;

  const css = `@media(max-width:760px){.grid{grid-template-columns:1fr}}
.skip:focus{left:1rem}
input:focus,select:focus,textarea:focus{outline:3px solid blue}`;

  const manifest = JSON.stringify({
    release_state: 'APPROVAL_HELD',
    live_submission_enabled: false,
    routes: [
      { path: '/p12/', product_key: 'ACE-PRO', offer_code: 'P12', form: 'p12-interest', source: 'ace-p12', consent_required: true },
      { path: '/marketing/', product_key: 'ACE-MKT', offer_code: 'SYS-MKT', form: 'ace-mkt-interest', source: 'ace-mkt', consent_required: true },
    ],
  });

  return { marketing: marketingHtml, p12: p12Html, js, css, manifest };
}

// 1. The good fixture set must pass every check (proves the verifier isn't
//    just failing everything, i.e. it can actually say PASS).
{
  const results = runAllChecks(goodSources());
  const failed = results.filter(r => !r.pass);
  assert.equal(failed.length, 0, `expected all checks to pass on good fixtures, failed: ${JSON.stringify(failed)}`);
  assert.ok(results.length >= 10, 'expected a substantial number of checks to run');
}

// 2. Fail-closed: a missing file must fail, not be silently skipped.
{
  const sources = { ...goodSources(), p12: null };
  const results = runAllChecks(sources);
  assert.ok(results.some(r => !r.pass), 'missing p12 source must cause at least one failure');
}

// 3. Reintroducing the proven defect (wrong parent system) must fail closed.
{
  const sources = goodSources();
  sources.p12 = sources.p12.replace('ACE Prospecting Operating System', 'ACE Professional Services');
  const result = checkP12Ownership(sources);
  assert.equal(result.pass, false, 'incorrect parent system must be caught');
}

// 4. Dropping the canonical P12 identity entirely must fail closed.
{
  const sources = goodSources();
  sources.p12 = sources.p12.replace('Account Intelligence Engine and ICP Builder', 'Account Intelligence Sprint');
  const result = checkP12Ownership(sources);
  assert.equal(result.pass, false, 'missing canonical P12 identity must be caught');
}

// 5. A checked-by-default consent box must fail closed.
{
  const sources = goodSources();
  sources.marketing = sources.marketing.replace(
    '<input type="checkbox" name="consent" required>',
    '<input type="checkbox" name="consent" required checked>'
  );
  const result = checkConsentRequiredUnchecked(sources, 'marketing', 'marketing');
  assert.equal(result.pass, false, 'checked-by-default consent must be caught');
}

// 6. A missing consent checkbox must fail closed.
{
  const sources = goodSources();
  sources.marketing = sources.marketing.replace('<input type="checkbox" name="consent" required>', '');
  const result = checkConsentRequiredUnchecked(sources, 'marketing', 'marketing');
  assert.equal(result.pass, false, 'missing consent checkbox must be caught');
}

// 7. RELEASE_AUTHORIZED flipped to true must fail closed.
{
  const sources = goodSources();
  sources.js = sources.js.replace('RELEASE_AUTHORIZED=false', 'RELEASE_AUTHORIZED=true');
  const result = checkReleaseAuthorizedFalse(sources);
  assert.equal(result.pass, false, 'RELEASE_AUTHORIZED=true must be caught');
}

// 8. A live submission path (fetch before the gate returns) must fail closed.
{
  const sources = goodSources();
  sources.js = `(()=>{"use strict";const RELEASE_AUTHORIZED=false;
fetch("https://example.test");
if(!RELEASE_AUTHORIZED){return}
})();`;
  const result = checkNoLiveSubmission(sources);
  assert.equal(result.pass, false, 'fetch() reachable before the gate must be caught');
}

// 9. A leaked secret must fail closed.
{
  const sources = goodSources();
  sources.js += '\nconst key="sk-abcdefghijklmnopqrstuvwx";';
  const result = checkNoSecrets(sources);
  assert.equal(result.pass, false, 'a leaked-looking secret must be caught');
}

// 10. An invented pricing tier must fail closed, while the org's own brand name
//     ("ACE Growth Operating Systems") must NOT false-positive.
{
  const sources = goodSources();
  const clean = checkNoUnsupportedClaims(sources, 'marketing', 'marketing');
  assert.equal(clean.pass, true, 'brand name must not false-positive as a tier claim');

  sources.marketing = sources.marketing.replace('</main>', '<p>Enterprise plan: $499/mo</p></main>');
  const dirty = checkNoUnsupportedClaims(sources, 'marketing', 'marketing');
  assert.equal(dirty.pass, false, 'an invented pricing tier must be caught');
}

// 11. A manifest/implementation mismatch (wrong product_key) must fail closed.
{
  const sources = goodSources();
  const manifest = JSON.parse(sources.manifest);
  manifest.routes[0].product_key = 'WRONG-KEY';
  sources.manifest = JSON.stringify(manifest);
  const result = checkManifestMatchesImplementation(sources);
  assert.equal(result.pass, false, 'a manifest/implementation product_key mismatch must be caught');
}

// 12. The verifier must actually run against the real, current repository files
//     and pass, proving loadRealSources() is wired to the real routes.
{
  const results = runAllChecks(loadRealSources());
  const failed = results.filter(r => !r.pass);
  assert.equal(failed.length, 0, `expected the real repo to pass, failed: ${JSON.stringify(failed)}`);
}

console.log('PASS: verify_launch_pages fail-closed contract');
