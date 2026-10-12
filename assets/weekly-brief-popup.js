(()=>{"use strict";

// ACE WEEKLY BRIEF pop-up controller (index.html #weekly-brief).
//
// Release gate (fail-closed): the pop-up ships with the `hidden` attribute.
// This script can show it ONLY when assets/weekly-brief-config.js says
// POPUP_RELEASE_STATE === "RELEASED", or when the URL carries ?preview=1
// (review only, with a "held preview" ribbon). Preview never enables
// submission. If the config fails to load, nothing is shown.
//
// Shows once per visitor, 10 seconds after arrival. Never on /checkout/
// pages, never on a page that already has the /marketing/ offer pop-up
// (#offerPanel), and never while another dialog is open. If browser storage
// is unavailable the pop-up does not show at all (fails safe: no repeat
// nagging).
//
// Subscribe form: same intake contract as assets/demo-picker.js and
// assets/start-funnel.js (endpoint, honeypot, proof-of-work, idempotency
// key, strict held receipt). No Kit or other third-party call from here.

const CONFIG=window.ACE_WEEKLY_BRIEF_CONFIG;
if(!CONFIG)return;

const params=new URLSearchParams(location.search);
const PREVIEW=params.get("preview")==="1";
const RELEASE_AUTHORIZED=Boolean(CONFIG&&CONFIG.popupReleased===true);
if(!RELEASE_AUTHORIZED&&!PREVIEW)return;

if(/(^|\/)checkout(\/|$)/.test(String(location.pathname||"")))return;
if(document.getElementById("offerPanel"))return;

const popup=document.getElementById("weekly-brief");
if(!popup)return;

const SEEN_KEY=CONFIG.SEEN_KEY;
const DELAY_MS=Number(CONFIG.DELAY_MS)>=10000?Number(CONFIG.DELAY_MS):10000;
const RETRY_MS=5000;
const ENDPOINT="https://withyoudaily.app.n8n.cloud/webhook/ace-lead";
const HELD_NOTE="Preview: this pop-up is held until launch authorization. Nothing was sent.";
const FAILURE_MESSAGE="Something went wrong. Please try again, or email AceGrowth.os@gmail.com.";
const UTM_KEYS=["utm_source","utm_medium","utm_campaign","utm_term","utm_content"];

// Storage that throws (private mode, blocked) counts as "already seen".
const alreadySeen=()=>{
  try{return window.localStorage.getItem(SEEN_KEY)==="1"}catch(error){return true}
};
const markSeen=()=>{
  try{window.localStorage.setItem(SEEN_KEY,"1")}catch(error){/* nothing to record */}
};
if(alreadySeen())return;

const $=id=>document.getElementById(id);
const form=$("wbpForm"),done=$("wbpDone");
if(!form||!done)return;

let shown=false;
// Any other modal dialog actually on screen (the demo player, the custom
// demo request, the overview cinema or the commander theatre). Some of those
// hide with a CSS class rather than `hidden`, so check for rendered boxes.
const otherDialogOpen=()=>Array.from(document.querySelectorAll('[aria-modal="true"]'))
  .some(el=>el!==popup&&!el.hidden&&el.getClientRects().length>0);

function onKeydown(event){if(event.key==="Escape")dismiss()}

const show=()=>{
  if(shown)return;
  if(otherDialogOpen()){setTimeout(show,RETRY_MS);return}
  if(alreadySeen())return;
  shown=true;
  markSeen();
  popup.hidden=false;
  popup.removeAttribute("inert");
  const ribbon=$("wbpPreview");
  if(ribbon)ribbon.hidden=RELEASE_AUTHORIZED;
  document.addEventListener("keydown",onKeydown);
};

const dismiss=()=>{
  markSeen();
  popup.hidden=true;
  popup.setAttribute("inert","");
  document.removeEventListener("keydown",onKeydown);
};

const close=$("wbpClose"),later=$("wbpLater");
if(close)close.addEventListener("click",dismiss);
if(later)later.addEventListener("click",dismiss);

// ---------------- subscribe form ----------------
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

const buildPayload=()=>{
  const data=new FormData(form);
  const one=name=>String(data.get(name)||"").trim();
  return{
    form:one("form"),
    source:one("source"),
    product_key:one("product_key"),
    offer_code:one("offer_code"),
    ...attribution,
    first_name:one("first_name"),
    email:one("email"),
    brief_optin:true,
    page_path:cleanParam(location.pathname,200),
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
  const note=$("wbpHeldNote");
  if(note){note.textContent=held?HELD_NOTE:"";note.hidden=!held}
  done.hidden=false;
  if(later)later.textContent="Close";
  if(done.focus)done.focus({preventScroll:true});
};

form.addEventListener("submit",async event=>{
  event.preventDefault();
  if(!form.reportValidity())return;
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

setTimeout(show,DELAY_MS);

})();
