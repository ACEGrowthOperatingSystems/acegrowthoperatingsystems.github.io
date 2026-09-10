import assert from 'node:assert/strict';
import fs from 'node:fs';

const code=fs.readFileSync(new URL('../n8n/validate_map.js',import.meta.url),'utf8');
const run=(body)=>new Function('$','$execution',code)(
  ()=>({first:()=>({json:{body}})}),
  {id:'test-execution'}
);
const base={
  email:'Synthetic@example.test',first_name:'Synthetic',form:'readiness',brief_optin:true,
  problem:'Pipeline',urgency:'urgent this quarter',ai_maturity:'some automation',constraint:'no time',
  idempotency_key:'stage9a-consent-test',ts:'2026-09-10T02:00:00.000Z',synthetic:true,
  consent_granted:true,
  consent_text:'I agree to receive the ACE Weekly Brief by email. I can unsubscribe at any time.',
  consent_version:'ace-weekly-brief-consent-v1',consent_timestamp:'2026-09-10T02:00:00.000Z',
  consent_channel:'website',source:'ace-splash',landing_url:'https://example.test/',
  referrer:'https://referrer.test/',utm_source:'qa',utm_medium:'synthetic',utm_campaign:'stage9a'
};

assert.throws(()=>run({...base,consent_granted:false}),/CONSENT_REQUIRED/);
assert.throws(()=>run({...base,consent_version:'unknown'}),/CONSENT_REQUIRED/);
assert.throws(()=>run({...base,form:'unknown'}),/INVALID_FORM/);
const readiness=run(base)[0].json;
assert.equal(readiness.email,'synthetic@example.test');
assert.equal(readiness.form,'readiness');
assert.equal(readiness.qualified,true);
assert.equal(readiness.consent_granted,true);
assert.equal(readiness.utm_campaign,'stage9a');
assert.ok(readiness.notion_tags.includes('ACE - Qualified Lead'));

const brief=run({...base,form:'brief',problem:'',urgency:'',ai_maturity:'',constraint:''})[0].json;
assert.equal(brief.form,'brief');
assert.equal(brief.qualified,false);
assert.equal(brief.notion_source,'Website - Brief opt-in');

console.log('PASS: Stage 9A n8n consent and destination mapping contract');
