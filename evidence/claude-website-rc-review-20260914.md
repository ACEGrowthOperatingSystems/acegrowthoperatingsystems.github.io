# ACE Website Release-Candidate — Independent Review

**Reviewer:** Claude Sonnet 5 (independent review, not the original author)
**Date:** 2026-09-14
**Repository:** ACEGrowthOperatingSystems/acegrowthoperatingsystems.github.io
**Branch reviewed:** codex/product-launch-pages-20260913
**Review/repair branch:** claude/website-rc-independent-review-20260914
**Local working copy:** C:\Users\Jim Lanier\ACE-Website-RC

This is an independent verification pass, not a rebuild. Scope was limited to
`/marketing/`, `/p12/`, their shared assets, the form controller, the release
manifest, and directly related tests.

## Commit hashes

| | Hash |
|---|---|
| Expected starting HEAD | `80ab48d4fd4c09f9dd453d6da1f6befb5b144a1c` |
| Actual starting HEAD (confirmed match) | `80ab48d4fd4c09f9dd453d6da1f6befb5b144a1c` |
| Local evidence commit 1 (independent review + defect fix) | `fd67a2f17354e518531e58dad2f5de90be669fd0` |
| Local evidence commit 2 (evidence-integrity correction) | see final chat report for this branch's `HEAD` after commit "Correct website release evidence claim" |

Starting HEAD matched exactly — review proceeded.

## Files reviewed

- `marketing/index.html`
- `p12/index.html`
- `assets/product-launch.css`
- `assets/product-launch.js`
- `launch-readiness/product-pages-20260913.json`
- `index.html` (top-level, checked only for nav/link references into scope)
- `tests/stage9a_lead_capture.test.mjs`
- `tests/stage9a_n8n_mapper.test.mjs`
- `n8n/validate_map.js` (referenced by the above test)
- `withyou-assets/README.md` (checked for WithYou/ACE separation)

## Files changed (this review)

| File | Change | Reason |
|---|---|---|
| `p12/index.html` | 2-line correction (`<title>` and hero eyebrow) | Proven defect: incorrect canonical product ownership (see below) |
| `scripts/verify_launch_pages.mjs` | new file | Fail-closed local verifier for `/marketing/` and `/p12/` scope (required deliverable) |
| `tests/verify_launch_pages.test.mjs` | new file | Tests proving the verifier actually fails closed, not just passes |
| `evidence/claude-website-rc-review-20260914.md` | new file | This report |
| `evidence/claude-website-rc-review-20260914.v1.json` | new file | Machine-readable version of this report |
| `launch-readiness/product-pages-20260913.json` | follow-up correction (evidence-integrity) | Relabeled the unreproducible `21/21 PASS` claim and recorded the independent verifier's actual total — see "Evidence-integrity correction" below |
| `scripts/verify_launch_pages.mjs` | follow-up addition (1 new check, 17th) | `checkVerificationClaimsLabeled` — fails closed if a pass-count claim isn't labeled `UNVERIFIED`/`LEGACY`, or if no independent result is recorded |
| `tests/verify_launch_pages.test.mjs` | follow-up addition (3 new assertions) | Tests for the new labeling check, both positive and negative |

No files outside `/marketing/`, `/p12/`, shared assets, the form controller,
the release manifest, or the evidence/test/verifier artifacts were modified.
`RELEASE_AUTHORIZED`, the release manifest's `release_state`, and
`live_submission_enabled` were **not** changed — they remain `false` /
`APPROVAL_HELD` exactly as found.

## Defect found and corrected

**Defect:** `p12/index.html` misstated canonical product ownership.

- The task's canonical product truth states `/p12/` is **P12 — ACE Account
  Intelligence Engine and ICP Builder**, belonging to the **ACE Prospecting
  Operating System**, and that the commercial offer name "ACE Account
  Intelligence Sprint" must not replace or obscure that canonical identity.
- As found, the page's `<title>` was `ACE Account Intelligence Sprint | P12`
  and its hero eyebrow read `ACE Professional Services · P12`. The strings
  "ACE Prospecting Operating System" and "Account Intelligence Engine and ICP
  Builder" did not appear anywhere on the page — the canonical product
  identity was fully absent, and the parent system named ("ACE Professional
  Services") does not exist in the canonical product truth at all.
- **Correction (smallest necessary, 2 lines):**
  - `<title>` → `P12 — ACE Account Intelligence Engine and ICP Builder | ACE Account Intelligence Sprint`
  - Hero eyebrow → `ACE Prospecting Operating System · P12 Account Intelligence Engine and ICP Builder`
  - The commercial offer name ("ACE Account Intelligence Sprint") was
    preserved in both places — it was not removed, only no longer allowed to
    stand alone in place of the canonical identity.
- No pricing, tier, or scope changes were made. No completion score changed.
  No new launch gate was added.

Full diff:

```diff
--- a/p12/index.html
+++ b/p12/index.html
@@ -3,7 +3,7 @@
 <head>
 <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
 <meta name="robots" content="noindex,nofollow">
-<title>ACE Account Intelligence Sprint | P12</title>
+<title>P12 — ACE Account Intelligence Engine and ICP Builder | ACE Account Intelligence Sprint</title>
 <meta name="description" content="Turn a scattered prospect list into a governed, prioritized account-intelligence system.">
 <link rel="stylesheet" href="../assets/product-launch.css">
 </head>
@@ -12,7 +12,7 @@
 <header><div class="wrap nav"><a class="brand" href="../">ACE GROWTH OS</a><span class="tag">P12 · APPROVAL-HELD PREVIEW</span></div></header>
 <main id="main">
 <section class="hero"><div class="wrap">
-<p class="eyebrow">ACE Professional Services · P12</p>
+<p class="eyebrow">ACE Prospecting Operating System · P12 Account Intelligence Engine and ICP Builder</p>
 <h1>Know which accounts deserve your next move.</h1>
 <p class="lede">The ACE Account Intelligence Sprint turns fragmented prospect data into a practical, prioritized system your team can use to decide who to pursue, why now, and what to do next.</p>
 <div class="actions"><a class="button" href="#interest">Review the sprint</a><a class="button secondary" href="#deliverables">See what is included</a></div>
```

## Verification checklist

| Check | Result | Evidence |
|---|---|---|
| Both routes exist and render | PASS | `marketing/index.html`, `p12/index.html` present, well-formed `<html>/<title>/<main>` |
| Canonical product ownership accurate | PASS (after correction) | see defect above; verified by `checkP12Ownership`/`checkMarketingOwnership` |
| Navigation and CTAs work | PASS | All in-page `href="#id"` CTAs resolve to an existing `id` in the same file (`checkAnchorsResolve`) |
| Forms require consent | PASS | `consent` checkbox is `type="checkbox"` and `required` on both routes |
| Consent unchecked by default | PASS | No `checked` attribute on either consent checkbox |
| Duplicate submissions protected by idempotency | PASS | `assets/product-launch.js` attaches `idempotency_key: crypto.randomUUID()` to every submission payload |
| `RELEASE_AUTHORIZED=false` | PASS | Literal `const RELEASE_AUTHORIZED=false;` in `assets/product-launch.js` |
| No live submission occurs | PASS (structural) | The `!RELEASE_AUTHORIZED` gate `return`s before the `fetch()` call is reachable in source order |
| No secrets or credentials | PASS | No API-key/bearer-token/private-key patterns found in `assets/`, `marketing/`, `p12/` |
| No unsupported pricing/tier/integration/readiness claims | PASS | No `$` figures; no "Essential/Professional/Growth/Enterprise/à la carte" tier language outside the org's own name ("ACE Growth Operating Systems") |
| Mobile and keyboard usable | PASS | `@media(max-width:760px)` breakpoint present; visible `.skip:focus` and `input:focus,select:focus,textarea:focus{outline...}` styles present |
| Manifest matches physical implementation | PASS | `launch-readiness/product-pages-20260913.json` route fields (`product_key`, `offer_code`, `form`, `source`, `release_state`, `consent_required`) all match the hidden form fields and `data-release-state` in both HTML files |
| WithYou not represented as an ACE product | PASS | No "WithYou" string found in `marketing/index.html` or `p12/index.html` |

### Evidence-integrity correction: the manifest's "21/21 PASS" claim

**Update (second pass, same review):** the original report below reported the
"21/21 PASS" figure as a flagged-but-uncorrected blocker. On explicit
instruction, this has since been corrected in the manifest itself, because an
unreproducible pass-count claim left unlabeled in a release manifest is an
evidence-integrity defect in its own right, not merely a note.

`launch-readiness/product-pages-20260913.json` originally stated
`"static_contract_checks": "21/21 PASS"` as an unqualified verified result. No
test file in this repository (at the reviewed commit, or since) executes any
check against `/marketing/` or `/p12/` — `tests/stage9a_*.test.mjs` verify the
unrelated top-level `index.html` splash page only. This reviewer cannot
reproduce or falsify the "21/21" figure from the repository as checked out;
it may reflect a manual/external review not captured in this snapshot.

**Correction applied**, using the manifest's existing `verification` object
(no schema restructuring):

```diff
   "verification": {
-    "static_contract_checks": "21/21 PASS",
+    "static_contract_checks": "UNVERIFIED LEGACY CLAIM: 21/21 PASS — not reproducible from any test file in this repository as of 2026-09-14; do not treat as a verified result",
+    "independent_verifier_result": "17/17 PASS (scripts/verify_launch_pages.mjs, run 2026-09-14, see evidence/claude-website-rc-review-20260914.md)",
     "external_actions": 0,
     "secrets_in_client": 0,
```

- The historical "21/21 PASS" statement is **preserved**, but now explicitly
  labeled `UNVERIFIED LEGACY CLAIM` per instruction — it is no longer
  presented as a verified result.
- The new `scripts/verify_launch_pages.mjs` verifier's **actual, reproducible**
  passing total is recorded separately as `independent_verifier_result`
  (`17/17 PASS`, up from 16/16 in the first pass — a 17th check,
  `checkVerificationClaimsLabeled`, was added specifically to keep this
  labeling requirement enforced going forward, so an unlabeled pass-count
  claim reappearing in this manifest will fail the verifier).
- `release_state`, `live_submission_enabled`, `endpoint_contract`, `routes`,
  and `approval_boundaries` were **not** touched. No completion score changed.
  No launch gate was added or removed — `remaining_before_gate_pass` is
  unchanged.

## Commands executed and exit codes

```
$ git rev-parse HEAD
80ab48d4fd4c09f9dd453d6da1f6befb5b144a1c                                    (n/a, read-only)

$ git fetch origin main                                                     exit 0
$ git diff --stat origin/main...HEAD                                        exit 0
$ node tests/stage9a_lead_capture.test.mjs                                  exit 0  (before and after correction)
$ node tests/stage9a_n8n_mapper.test.mjs                                    exit 0  (before and after correction)
$ git checkout -b claude/website-rc-independent-review-20260914             exit 0
$ node scripts/verify_launch_pages.mjs                                      exit 0  (16/16 checks, after correction)
$ node tests/verify_launch_pages.test.mjs                                   exit 0
$ git commit ("Independently verify ACE website release candidate")        exit 0

--- second pass: evidence-integrity correction ---
$ node scripts/verify_launch_pages.mjs                                      exit 0  (17/17 checks, after adding checkVerificationClaimsLabeled)
$ node tests/stage9a_lead_capture.test.mjs                                  exit 0
$ node tests/stage9a_n8n_mapper.test.mjs                                    exit 0
$ node tests/verify_launch_pages.test.mjs                                   exit 0
$ git diff --check                                                          exit 0
$ git diff --cached --check                                                 exit 0
$ grep -RInE '<secret-pattern-set>' -- tracked text files                   exit 0  (matches were only the pattern definitions/synthetic fixtures)
$ git commit ("Correct website release evidence claim")                     exit 0
```

## Test totals

**First pass (defect fix):**
- Pre-existing repository tests: 2/2 PASS (`stage9a_lead_capture`, `stage9a_n8n_mapper`).
- New verifier self-tests: 1/1 PASS (`tests/verify_launch_pages.test.mjs`, 12 internal assertions).
- New fail-closed verifier run: 16/16 checks PASS.
- Total: 4/4 test invocations exit 0.

**Second pass (evidence-integrity correction), final state:**
- Pre-existing repository tests: 2/2 PASS (`stage9a_lead_capture`, `stage9a_n8n_mapper`) — still unaffected; they do not exercise `/marketing/` or `/p12/`.
- Verifier self-tests: 1/1 PASS (`tests/verify_launch_pages.test.mjs`, now 15 internal assertions — 3 added for the new labeling check).
- Fail-closed verifier run: **17/17 checks PASS** (`scripts/verify_launch_pages.mjs`, up from 16/16 — 1 check added).
- `git diff --check`: exit 0 (no whitespace/conflict-marker errors).
- Secret scan across tracked text files: exit 0, no real secrets found.
- **Total: 4/4 test invocations exit 0, plus 2 additional hygiene checks (`git diff --check`, secret scan), both exit 0.**

## Remaining blockers (per manifest)

- Authorized merge and deployment
- Deployed route readback
- Synthetic form submission
- Backend receipt readback
- The manifest's `static_contract_checks` field is now explicitly labeled
  `UNVERIFIED LEGACY CLAIM` rather than presented as a verified result (see
  "Evidence-integrity correction" above) — this is no longer an
  evidence-integrity defect, but the underlying "21/21" figure itself remains
  unconfirmed and is a matter for the author to verify or retire upstream.

This review does not resolve, waive, or add to any of the above beyond the
relabeling itself. No launch gates were added or removed.

## Working-tree state at end of review

- Branch: `claude/website-rc-independent-review-20260914`
- Two local commits made, in order:
  1. `fd67a2f17354e518531e58dad2f5de90be669fd0` — "Independently verify ACE website release candidate"
  2. "Correct website release evidence claim" — hash reported in the final chat summary for this branch
- Working tree clean after each commit.
- Nothing pushed to any remote.
- No Supabase, Notion, n8n, DNS, or GitHub settings were touched.
