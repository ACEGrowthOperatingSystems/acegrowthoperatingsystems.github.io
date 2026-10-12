(()=>{"use strict";

// CUSTOMIZED DEMO REQUEST questionnaire, inside the homepage section
// #choose-demo (button #cdrOpen under the demo tiles, dialog #cdrModal).
//
// Release gate (fail-closed): this is part of the Choose Your Demo section,
// so it uses that section's own flag, assets/demo-config.js
// SECTION_RELEASE_STATE. Nothing here runs unless that flag is exactly
// "RELEASED", or the URL carries ?preview=1 (review only). The section
// itself is revealed by assets/demo-picker.js, never by this file.
// Preview never enables submission: while held, the payload is stored in
// form.dataset.lastPayload and a held note is shown. Nothing is posted.
//
// Same intake contract as assets/demo-picker.js and assets/start-funnel.js
// (endpoint, honeypot, proof-of-work, idempotency key, strict held receipt).

const CONFIG=window.ACE_DEMO_CONFIG;
if(!CONFIG)return;

const params=new URLSearchParams(location.search);
const PREVIEW=params.get("preview")==="1";
const RELEASE_AUTHORIZED=Boolean(CONFIG&&CONFIG.sectionReleased===true);
if(!RELEASE_AUTHORIZED&&!PREVIEW)return;

const $=id=>document.getElementById(id);
const opener=$("cdrOpen"),modal=$("cdrModal"),form=$("cdrForm"),done=$("cdrDone");
if(!opener||!modal||!form||!done)return;

const ENDPOINT="https://withyoudaily.app.n8n.cloud/webhook/ace-lead";
const HELD_NOTE="Preview: this request form is held until launch authorization. Nothing was sent.";
const FAILURE_MESSAGE="Something went wrong sending your request. Please try again, or email AceGrowth.os@gmail.com.";
const NEED_CAPABILITY="Pick at least one area you'd like to see, or “Not sure yet”.";
const UTM_KEYS=["utm_source","utm_medium","utm_campaign","utm_term","utm_content"];
const CAPABILITY_KEYS=CONFIG.KEYS.concat(["not-sure"]);

if(!RELEASE_AUTHORIZED){
  const ribbon=$("cdrPreview");
  if(ribbon)ribbon.hidden=false;
}

// ---------------- open / close ----------------
let lastFocus=null;
const onKey=e=>{if(e.key==="Escape")closeModal()};
const openModal=()=>{
  lastFocus=document.activeElement;
  modal.hidden=false;
  opener.setAttribute("aria-expanded","true");
  document.documentElement.style.overflow="hidden";
  document.addEventListener("keydown",onKey);
  const first=form.querySelector('input[name="business_name"]');
  if(first&&!form.hidden)first.focus({preventScroll:true});
};
const closeModal=()=>{
  modal.hidden=true;
  opener.setAttribute("aria-expanded","false");
  document.documentElement.style.overflow="";
  document.removeEventListener("keydown",onKey);
  if(lastFocus&&lastFocus.focus)lastFocus.focus({preventScroll:true});
};
opener.addEventListener("click",openModal);
const closer=$("cdrClose");
if(closer)closer.addEventListener("click",closeModal);
modal.addEventListener("click",e=>{if(e.target===modal)closeModal()});

// ---------------- conditional "supplement" question ----------------
// Shown only when "Do you already have your own lead generator?" is Yes.
// While hidden its inputs are disabled, so they are neither required nor sent.
const supplement=$("cdrSupplement");
const supplementInputs=supplement?Array.from(supplement.querySelectorAll("input")):[];
const syncSupplement=()=>{
  const has=String(new FormData(form).get("has_lead_generator")||"");
  const show=has==="yes";
  if(supplement)supplement.hidden=!show;
  supplementInputs.forEach(input=>{
    input.disabled=!show;
    if(!show)input.checked=false;
  });
};
form.addEventListener("change",syncSupplement);
syncSupplement();

// ---------------- intake contract ----------------
const bytesToHex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
const sha256=async value=>bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))));
const solveProof=async payload=>{
  const challenge=`${payload.idempotency_key}:${payload.submitted_at}:${payload.interaction_started_at}:`;
  for(let nonce=0;nonce<=2000000;nonce++){
    const digest=await sha256(challenge+nonce);
    if(digest.startsWith("000"))return{pow_nonce:nonce,pow_digest:digest};
  }
  throw new Error("BOT_PROOF_UNAVAILABLE");
};

const isStrictHeldReceipt=(receipt,payload)=>Boolean(
  receipt&&
  receipt.ok===true&&
  receipt.accepted===true&&
  receipt.accepted_for_review===true&&
  receipt.action_taken===false&&
  receipt.synthetic===false&&
  receipt.schema_valid===true&&
  receipt.form===payload.form&&
  receipt.qualified===false&&
  receipt.qualification_status==="PENDING"&&
  receipt.consent_recorded===true&&
  receipt.release_state==="APPROVAL_HELD"&&
  receipt.external_action_authorized===false&&
  receipt.tag_mapping_status==="UNRESOLVED"
);

const cleanParam=(value,max)=>String(value||"").trim().slice(0,max).replace(/[^\w.\-:+ ]/g,"");
const attribution={src:cleanParam(params.get("src"),100)};
UTM_KEYS.forEach(key=>{attribution[key]=cleanParam(params.get(key),200)});

const status=form.querySelector("[role=status]");
const send=form.querySelector("[type=submit]");
const startedAt=new Date().toISOString();
const botField=document.createElement("input");
botField.type="text";
botField.name="bot_field";
botField.tabIndex=-1;
botField.autocomplete="off";
botField.setAttribute("aria-hidden","true");
botField.style.cssText="position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden";
form.appendChild(botField);

const capabilities=data=>{
  const wanted=new Set(data.getAll("capabilities").map(v=>String(v).trim().toLowerCase()));
  return CAPABILITY_KEYS.filter(k=>wanted.has(k));
};

const buildPayload=()=>{
  const data=new FormData(form);
  const one=name=>String(data.get(name)||"").trim();
  const hasLeadGenerator=one("has_lead_generator");
  return{
    form:one("form"),
    source:one("source"),
    product_key:one("product_key"),
    offer_code:one("offer_code"),
    ...attribution,
    business_name:one("business_name").slice(0,200),
    industry:one("industry"),
    business_description:one("business_description").slice(0,1000),
    capabilities:capabilities(data),
    timeframe:one("timeframe"),
    preferred_day:one("preferred_day"),
    preferred_time:one("preferred_time"),
    preferred_timezone:"America/New_York",
    interested_ace_lead_generator:one("interested_ace_lead_generator"),
    has_lead_generator:hasLeadGenerator,
    supplement_lead_generator:hasLeadGenerator==="yes"?one("supplement_lead_generator"):"",
    first_name:one("first_name"),
    email:one("email"),
    phone:one("phone").slice(0,40),
    consent:data.get("consent")==="on",
    bot_field:String(data.get("bot_field")||""),
    interaction_started_at:startedAt,
    idempotency_key:crypto.randomUUID(),
    submitted_at:new Date().toISOString(),
    release_state:"APPROVAL_HELD"
  };
};

const showDone=held=>{
  form.hidden=true;
  const note=$("cdrHeldNote");
  if(note){note.textContent=held?HELD_NOTE:"";note.hidden=!held}
  done.hidden=false;
  if(done.focus)done.focus({preventScroll:true});
};

form.addEventListener("submit",async event=>{
  event.preventDefault();
  syncSupplement();
  if(!form.reportValidity())return;
  if(capabilities(new FormData(form)).length===0){
    status.textContent=NEED_CAPABILITY;
    const firstBox=form.querySelector('input[name="capabilities"]');
    if(firstBox)firstBox.focus();
    return;
  }
  send.disabled=true;
  status.textContent="Sending…";
  try{
    const payload=buildPayload();
    Object.assign(payload,await solveProof(payload));

    if(!RELEASE_AUTHORIZED){
      form.dataset.lastPayload=JSON.stringify(payload);
      status.textContent="";
      showDone(true);
      return;
    }

    const response=await fetch(ENDPOINT,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    });
    if(!response.ok)throw new Error("HTTP_ERROR");

    const receipt=await response.json();
    if(!isStrictHeldReceipt(receipt,payload))throw new Error("INVALID_HELD_RECEIPT");

    status.textContent="";
    form.reset();
    showDone(false);
  }catch(error){
    status.textContent=FAILURE_MESSAGE;
  }finally{
    send.disabled=false;
  }
});

})();
