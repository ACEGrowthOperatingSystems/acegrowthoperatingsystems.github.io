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
  checkVerificationClaimsLabeled,
  checkMapperMatchesManifest,
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
    verification: {
      static_contract_checks: 'UNVERIFIED LEGACY CLAIM: 21/21 PASS — not reproducible from this repository',
      independent_verifier_result: '17/17 PASS (scripts/verify_launch_pages.mjs)',
    },
  });

  // Minimal stand-in for n8n/validate_product_interest_map.js: same CONTRACTS
  // shape and same hold/authorization outputs, without the full field set.
  const mapper = `const src=$('Website Form').first().json;
const body=src.body||src||{};
const clean=(v,m)=>String(v||'').trim().slice(0,m);
const CONTRACTS={
  'ace-mkt-interest':{product_key:'ACE-MKT',offer_code:'SYS-MKT',source:'ace-mkt'},
  'p12-interest':{product_key:'ACE-PRO',offer_code:'P12',source:'ace-p12'}
};
const form=clean(body.form,50);
const contract=CONTRACTS[form];
if(!contract) throw new Error('INVALID_FORM');
if(clean(body.product_key,50)!==contract.product_key) throw new Error('INVALID_PRODUCT_KEY');
if(clean(body.offer_code,50)!==contract.offer_code) throw new Error('INVALID_OFFER_CODE');
if(clean(body.source,100)!==contract.source) throw new Error('INVALID_SOURCE');
if(body.consent!==true) throw new Error('CONSENT_REQUIRED');
return [{json:{form,product_key:contract.product_key,offer_code:contract.offer_code,
source:contract.source,qualified:false,release_state:'APPROVAL_HELD',
external_action_authorized:false}}];`;

  return { marketing: marketingHtml, p12: p12Html, js, css, manifest, mapper };
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

// 13. An unlabeled pass-count claim (e.g. a bare "21/21 PASS" with no
//     UNVERIFIED/LEGACY qualifier) must fail closed — this is the exact
//     shape of the defect being corrected.
{
  const sources = goodSources();
  const manifest = JSON.parse(sources.manifest);
  manifest.verification.static_contract_checks = '21/21 PASS';
  sources.manifest = JSON.stringify(manifest);
  const result = checkVerificationClaimsLabeled(sources);
  assert.equal(result.pass, false, 'an unlabeled pass-count claim must be caught');
}

// 14. A missing independent_verifier_result must fail closed.
{
  const sources = goodSources();
  const manifest = JSON.parse(sources.manifest);
  delete manifest.verification.independent_verifier_result;
  sources.manifest = JSON.stringify(manifest);
  const result = checkVerificationClaimsLabeled(sources);
  assert.equal(result.pass, false, 'a missing independent_verifier_result must be caught');
}

// 15. A properly labeled legacy claim alongside a real independent result
//     must pass (proves the check isn't just failing everything).
{
  const sources = goodSources();
  const result = checkVerificationClaimsLabeled(sources);
  assert.equal(result.pass, true, 'a properly labeled legacy claim with an independent result must pass');
}

// 16. A mapper that agrees with the manifest must pass (positive control —
//     proves the new check can say PASS and isn't failing everything).
{
  const result = checkMapperMatchesManifest(goodSources());
  assert.equal(result.pass, true, `agreeing mapper must pass, got: ${result.detail}`);
}

// 17. A missing mapper file must fail closed, not be silently skipped.
{
  const sources = { ...goodSources(), mapper: null };
  const result = checkMapperMatchesManifest(sources);
  assert.equal(result.pass, false, 'a missing mapper must be caught');
}

// 18. Mapper/manifest drift on offer_code must fail closed. This is the exact
//     defect the check exists for: the manifest still says SYS-MKT, the mapper
//     no longer does, and manifest<->HTML checks would not notice.
{
  const sources = goodSources();
  sources.mapper = sources.mapper.replace("offer_code:'SYS-MKT'", "offer_code:'SYS-WRONG'");
  const result = checkMapperMatchesManifest(sources);
  assert.equal(result.pass, false, 'mapper/manifest offer_code drift must be caught');
}

// 19. A mapper that authorizes external action must fail closed — this is the
//     single field every downstream external-action branch keys off.
{
  const sources = goodSources();
  sources.mapper = sources.mapper.replace('external_action_authorized:false', 'external_action_authorized:true');
  const result = checkMapperMatchesManifest(sources);
  assert.equal(result.pass, false, 'a mapper authorizing external action must be caught');
}

// 20. A mapper that accepts a cross-bound product_key (p12 payload posted to
//     the ACE-MKT form) must fail closed.
{
  const sources = goodSources();
  sources.mapper = sources.mapper.replace(
    "if(clean(body.product_key,50)!==contract.product_key) throw new Error('INVALID_PRODUCT_KEY');",
    ''
  );
  const result = checkMapperMatchesManifest(sources);
  assert.equal(result.pass, false, 'a mapper accepting cross-bound product_key must be caught');
}

// 21. A mapper declaring a route the manifest does not must fail closed —
//     an undeclared form is an ungoverned intake path.
{
  const sources = goodSources();
  sources.mapper = sources.mapper.replace(
    "'p12-interest':{product_key:'ACE-PRO',offer_code:'P12',source:'ace-p12'}",
    "'p12-interest':{product_key:'ACE-PRO',offer_code:'P12',source:'ace-p12'},\n  'ghost-interest':{product_key:'ACE-GHOST',offer_code:'GHOST',source:'ace-ghost'}"
  );
  const result = checkMapperMatchesManifest(sources);
  assert.equal(result.pass, false, 'a mapper form absent from the manifest must be caught');
}

// 22. A mapper that drops the consent requirement must fail closed.
{
  const sources = goodSources();
  sources.mapper = sources.mapper.replace(
    "if(body.consent!==true) throw new Error('CONSENT_REQUIRED');",
    ''
  );
  const result = checkMapperMatchesManifest(sources);
  assert.equal(result.pass, false, 'a mapper without a consent gate must be caught');
}

// 23. REGRESSION (upstream fd14c07): renaming the release gate and flipping it
//     to true must fail closed even when a literal RELEASE_AUTHORIZED=false
//     line is still present elsewhere in the file. This is the exact shape of
//     the defect that enabled live submission while the manifest still
//     declared live_submission_enabled: false.
{
  const sources = goodSources();
  sources.js = `(()=>{"use strict";const RELEASE_AUTHORIZED=false;
const SUBMISSION_AUTHORIZED=true;
if(!SUBMISSION_AUTHORIZED){return}
fetch("https://example.test");
const payload={idempotency_key:crypto.randomUUID()};
})();`;
  const result = checkReleaseAuthorizedFalse(sources);
  assert.equal(result.pass, false, 'a renamed gate set to true must be caught');
  assert.match(result.detail, /SUBMISSION_AUTHORIZED/, 'the failure must name the offending constant');
}

// 24. Any other *_AUTHORIZED constant set to true must also fail closed —
//     the guard is not hardcoded to the one name that happened to regress.
{
  const sources = goodSources();
  sources.js = sources.js.replace(
    'const RELEASE_AUTHORIZED=false;',
    'const RELEASE_AUTHORIZED=false;const LIVE_SEND_AUTHORIZED=true;'
  );
  const result = checkReleaseAuthorizedFalse(sources);
  assert.equal(result.pass, false, 'any *_AUTHORIZED=true constant must be caught');
  assert.match(result.detail, /LIVE_SEND_AUTHORIZED/, 'the failure must name the offending constant');
}

// 25. The guard must not false-positive on the strict held-receipt validator,
//     which legitimately compares lowercase external_action_authorized===false.
{
  const sources = goodSources();
  sources.js = sources.js.replace(
    'const RELEASE_AUTHORIZED=false;',
    'const RELEASE_AUTHORIZED=false;const held=r=>r.external_action_authorized===false;'
  );
  const result = checkReleaseAuthorizedFalse(sources);
  assert.equal(result.pass, true, 'lowercase receipt fields must not false-positive as a release gate');
}

// 26. The real, current form controller must satisfy the strengthened guard —
//     proves the remediation actually landed in the shipped file.
{
  const result = checkReleaseAuthorizedFalse(loadRealSources());
  assert.equal(result.pass, true, `real form controller must hold submission, got: ${result.detail}`);
}

console.log('PASS: verify_launch_pages fail-closed contract');
