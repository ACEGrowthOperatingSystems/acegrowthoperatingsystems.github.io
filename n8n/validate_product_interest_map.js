/**
 * Local, non-deployed reference implementation of a corrected validator/mapper
 * for the marketing/p12 PRODUCT_INTEREST contract. NOT wired into any live n8n
 * workflow. This node only checks payload SCHEMA validity and maps a payload
 * shape for local testing; it makes no qualification, tagging, or release
 * decision, and passing this validator never sends, publishes, contacts a
 * customer, or authorizes any external action.
 *
 * REQUIRED DOWNSTREAM BRANCH CONDITION (must be enforced by whoever later
 * wires this into a real n8n graph): every downstream node that can reach
 * Kit, Notion, customer contact, or any other external-action target MUST be
 * gated behind one explicit check on this node's output:
 *
 *     if ($json.external_action_authorized !== true) { <stop / no-op branch> }
 *
 * This node always sets external_action_authorized: false. There is
 * currently no code path, live or planned, that flips it to true -- that is
 * a separate, human-approved release decision that does not exist yet. A
 * workflow implementer must not treat any other field on this output
 * (schema_valid, consent_granted, qualified, etc.) as a stand-in for release
 * authorization; external_action_authorized is the only field any external-
 * action branch may key off of.
 *
 * Field names consent_granted, form, synthetic, and idempotency_key are
 * preserved to match the only known live consumer of a structurally similar
 * node: 13_Website_Lead_Intake's "Validate + Map To Live Schema" node and its
 * downstream response-body and Supabase-insert nodes
 * (Raw_Exports/n8n/13_Website_Lead_Intake_sanitized.json). notion_tags is
 * intentionally returned empty with tag_mapping_status: 'UNRESOLVED' because
 * no live Kit/Notion tag registry for PRODUCT_INTEREST leads has been read
 * back -- inventing tag values here would be an unverified assumption.
 * qualified is intentionally false with qualification_status: 'PENDING'
 * because completing this form proves schema validity only, not commercial
 * qualification -- those are kept as two distinct fields, never conflated.
 */
const src=$('Website Form').first().json;
const body=src.body||src||{};
const clean=(value,max)=>String(value||'').trim().slice(0,max);

const email=clean(body.email,320).toLowerCase();
if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('INVALID_EMAIL');

// automate-demo (/start/) sends first_name and bottleneck; demo-question
// (homepage #choose-demo) sends first_name and question. They fill name/need.
const name=clean(body.name||body.first_name,200);
if(!name) throw new Error('INVALID_NAME');

const need=clean(body.need||body.bottleneck||body.question,200);
if(!need) throw new Error('INVALID_NEED');

const CONTRACTS={
  'ace-mkt-interest':{product_key:'ACE-MKT',offer_code:'SYS-MKT',source:'ace-mkt',notion_source:'Website - ACE-MKT product interest'},
  'p12-interest':{product_key:'ACE-PRO',offer_code:'P12',source:'ace-p12',notion_source:'Website - P12 product interest'},
  'grow-interest':{product_key:'ACE-GROW',offer_code:'SYS-GROW',source:'ace-grow',notion_source:'Website - ACE-GROW product interest'},
  'automate-demo':{product_key:'ACE-DEMO',offer_code:'DEMO-AUTOMATE',source:'ig-comment-automate',notion_source:'Website - AUTOMATE demo funnel'},
  'demo-question':{product_key:'ACE-DEMO',offer_code:'DEMO-QUESTION',source:'website-demo',notion_source:'Website - Choose Your Demo question'}
};
const form=clean(body.form,50);
const contract=CONTRACTS[form];
if(!contract) throw new Error('INVALID_FORM');
if(clean(body.product_key,50)!==contract.product_key) throw new Error('INVALID_PRODUCT_KEY');
if(clean(body.offer_code,50)!==contract.offer_code) throw new Error('INVALID_OFFER_CODE');
if(clean(body.source,100)!==contract.source) throw new Error('INVALID_SOURCE');

if(body.consent!==true) throw new Error('CONSENT_REQUIRED');

// idempotency_key is REQUIRED and is validated, never sanitized: silently
// stripping disallowed characters from two different raw inputs can collapse
// them onto the same key (e.g. "a!b" and "a?b" would both become "ab" under
// a strip-then-use approach). A key that fails the pattern is rejected
// outright instead of being transformed.
const rawKey=body.idempotency_key;
if(typeof rawKey!=='string'||rawKey.length===0) throw new Error('INVALID_IDEMPOTENCY_KEY');
if(!/^[A-Za-z0-9._:-]{1,120}$/.test(rawKey)) throw new Error('INVALID_IDEMPOTENCY_KEY');
const idempotency_key=rawKey;

const submittedAt=clean(body.submitted_at,40);
if(!submittedAt||Number.isNaN(Date.parse(submittedAt))) throw new Error('INVALID_SUBMISSION_TIMESTAMP');

// The client-supplied release_state is checked but never trusted as
// authority: a supplied value other than APPROVAL_HELD is rejected outright,
// and even when it does equal APPROVAL_HELD the OUTPUT below sets the value
// server-side rather than passing the client's string through.
const suppliedReleaseState=clean(body.release_state,40);
if(suppliedReleaseState!=='APPROVAL_HELD') throw new Error('RELEASE_NOT_APPROVAL_HELD');

// Extra questionnaire fields carried by the /start/ AUTOMATE funnel only.
const extra={};
if(form==='automate-demo'){
  extra.first_name=clean(body.first_name,120);
  extra.business_type=clean(body.business_type,100);
  extra.team_size=clean(body.team_size,20);
  extra.bottleneck=clean(body.bottleneck,200);
  extra.interests=(Array.isArray(body.interests)?body.interests:[]).slice(0,10).map(v=>clean(v,100)).filter(Boolean);
  extra.src=clean(body.src,100);
  for(const k of ['utm_source','utm_medium','utm_campaign','utm_term','utm_content']) extra[k]=clean(body[k],200);
}
// Choose Your Demo "Ask a question" (homepage #choose-demo) carries the full
// question (need above is its first 200 chars) and the demo keys watched.
// A representative follows up within 24 hours: that is a human task, never
// an automated send from this node.
if(form==='demo-question'){
  const DEMO_KEYS=['followup','pipeline','content','proposal','growth'];
  extra.first_name=clean(body.first_name,120);
  extra.question=clean(body.question||body.need,2000);
  if(!extra.question) throw new Error('INVALID_QUESTION');
  extra.interests=(Array.isArray(body.interests)?body.interests:[]).map(v=>clean(v,20).toLowerCase()).filter(v=>DEMO_KEYS.includes(v)).slice(0,5);
  extra.followup_sla_hours=24;
  extra.src=clean(body.src,100);
  for(const k of ['utm_source','utm_medium','utm_campaign','utm_term','utm_content']) extra[k]=clean(body[k],200);
}

return [{json:{
  ...extra,
  email,name,need,form,
  product_key:contract.product_key,offer_code:contract.offer_code,source:contract.source,
  notion_source:contract.notion_source,
  schema_valid:true,
  consent_granted:true,
  qualified:false,
  qualification_status:'PENDING',
  notion_tags:[],
  tag_mapping_status:'UNRESOLVED',
  idempotency_key,
  submitted_at:new Date(submittedAt).toISOString(),
  release_state:'APPROVAL_HELD',
  external_action_authorized:false,
  synthetic:(body.synthetic===true||email.endsWith('@example.test')),
  received_at:new Date().toISOString()
}}];
