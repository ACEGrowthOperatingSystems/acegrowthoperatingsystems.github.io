const src=$('Website Form').first().json;
const body=src.body||src||{};
const clean=(value,max)=>String(value||'').trim().slice(0,max);
const email=clean(body.email,320).toLowerCase();
if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('INVALID_EMAIL');
const form=body.form==='brief'?'brief':body.form==='readiness'?'readiness':'';
if(!form) throw new Error('INVALID_FORM');
const suppliedKey=clean(body.idempotency_key,120);
const idempotency_key=suppliedKey ? suppliedKey.replace(/[^A-Za-z0-9._:-]/g,'') : String($execution.id);
if(!idempotency_key) throw new Error('INVALID_IDEMPOTENCY_KEY');
const consentText='I agree to receive the ACE Weekly Brief by email. I can unsubscribe at any time.';
const consentVersion='ace-weekly-brief-consent-v1';
const consentTimestamp=clean(body.consent_timestamp,40);
if(body.consent_granted!==true||body.consent_text!==consentText||body.consent_version!==consentVersion||body.consent_channel!=='website'||!consentTimestamp||Number.isNaN(Date.parse(consentTimestamp))) throw new Error('CONSENT_REQUIRED');
const submittedAt=clean(body.ts,40);
if(!submittedAt||Number.isNaN(Date.parse(submittedAt))) throw new Error('INVALID_SUBMISSION_TIMESTAMP');
const first=clean(body.first_name,120);
const problem=clean(body.problem,200);
const urgency=clean(body.urgency,100);
const ai_maturity=clean(body.ai_maturity,100);
const constraint=clean(body.constraint,100);
const completedCheck=form==='readiness'&&!!(problem&&urgency&&ai_maturity&&constraint);
const briefOptIn=body.brief_optin===true;
if(!briefOptIn) throw new Error('BRIEF_OPT_IN_REQUIRED');
const fields={};
if(problem) fields.ace_biggest_bottleneck=problem;
if(ai_maturity) fields.ace_current_ai_use=ai_maturity;
const urg=urgency.toLowerCase();
const con=constraint.toLowerCase();
const notion_urgency=urg.includes('quarter')||urg.includes('urgent')?'This quarter':urg.includes('6 month')||urg.includes('six month')?'Next 6 months':urg.includes('planning')?'Planning ahead':'Unknown';
const notion_constraint=con.includes('no time')?'No time':con.includes('no one')?'No one to build it':con.includes('budget')?'Budget':con.includes('where to start')?'Do not know where to start':'Unknown';
const notion_tags=['AUDIENCE - ACE Prospect','DO NOT CROSS-SEND - Commercial','PROGRAM - Weekly AI Brief'];
if(form==='readiness') notion_tags.push('SOURCE - Growth Readiness Check');
if(completedCheck) notion_tags.push('ACE - Qualified Lead');
return [{json:{
  email,first_name:first,form,fields,notion_tags,notion_urgency,notion_constraint,
  notion_source:form==='brief'?'Website - Brief opt-in':'Website - Readiness Check',
  problem,ai_maturity,urgency,constraint,brief_optin:briefOptIn,qualified:completedCheck,
  synthetic:body.synthetic===true,idempotency_key,submitted_at:new Date(submittedAt).toISOString(),
  consent_granted:true,consent_text:consentText,consent_version:consentVersion,
  consent_timestamp:new Date(consentTimestamp).toISOString(),consent_channel:'website',
  source:clean(body.source,100),landing_url:clean(body.landing_url,1000),referrer:clean(body.referrer,1000),
  utm_source:clean(body.utm_source,200),utm_medium:clean(body.utm_medium,200),
  utm_campaign:clean(body.utm_campaign,200),utm_term:clean(body.utm_term,200),
  utm_content:clean(body.utm_content,200),received_at:new Date().toISOString()
}}];
