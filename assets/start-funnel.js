(()=>{"use strict";

// /start/ AUTOMATE funnel controller: 4-step questionnaire -> demo unlock.
//
// Same intake contract as assets/product-launch.js (same endpoint, honeypot,
// proof-of-work, idempotency key, strict held-receipt check and per-page
// release gate). It is a separate file only because this form has a
// multi-value field (interests[]) and a success state that unlocks the demo.
//
// Per-page flag from assets/release-flag.js, which must be loaded first.
// If that script is missing the expression is false, so the page stays HELD.
const RELEASE_AUTHORIZED=Boolean(window.ACE_RELEASE&&window.ACE_RELEASE.isReleased());
const ENDPOINT="https://withyoudaily.app.n8n.cloud/webhook/ace-lead";
const CONFIG=window.ACE_START_CONFIG||{videoConfigured:false,bookingConfigured:false};

const HELD_NOTE="Preview: this page is held until launch authorization. Nothing was sent.";
const FAILURE_MESSAGE="Something went wrong. Please try again, or email AceGrowth.os@gmail.com.";
const UTM_KEYS=["utm_source","utm_medium","utm_campaign","utm_term","utm_content"];

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

// Attribution from the DM link, e.g. /start/?src=ig-comment-automate&utm_campaign=...
const params=new URLSearchParams(location.search);
const cleanParam=(value,max)=>String(value||"").trim().slice(0,max).replace(/[^\w.\-:+ ]/g,"");
const attribution={src:cleanParam(params.get("src"),100)};
UTM_KEYS.forEach(key=>{attribution[key]=cleanParam(params.get(key),200)});

const form=document.querySelector("[data-start-form]");
if(!form)return;
const steps=Array.from(form.querySelectorAll("[data-step]"));
const progressLabel=document.getElementById("stepLabel");
const progressFill=document.getElementById("stepFill");
const progressBar=document.getElementById("stepBar");
const status=form.querySelector("[role=status]");
const submitButton=form.querySelector("[type=submit]");
const success=document.getElementById("unlocked");
const startedAt=new Date().toISOString();
let current=0;

const botField=document.createElement("input");
botField.type="text";
botField.name="bot_field";
botField.tabIndex=-1;
botField.autocomplete="off";
botField.setAttribute("aria-hidden","true");
botField.style.cssText="position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden";
form.appendChild(botField);

// Stepper is progressive enhancement: without this script every step shows.
form.classList.add("is-stepper");
const progress=document.getElementById("progress");
if(progress)progress.hidden=false;

const show=index=>{
  current=Math.max(0,Math.min(index,steps.length-1));
  steps.forEach((step,i)=>{step.hidden=i!==current});
  const n=current+1;
  if(progressLabel)progressLabel.textContent=`Step ${n} of ${steps.length}`;
  if(progressFill)progressFill.style.width=`${(n/steps.length)*100}%`;
  if(progressBar)progressBar.setAttribute("aria-valuenow",String(n));
  status.textContent="";
};

const stepValid=index=>{
  const fields=Array.from(steps[index].querySelectorAll("input,select,textarea"));
  for(const field of fields){
    if(!field.checkValidity()){field.reportValidity();return false}
  }
  return true;
};

const focusStep=()=>{
  const heading=steps[current].querySelector("[data-step-focus]");
  if(heading){heading.focus({preventScroll:true})}
  const top=form.getBoundingClientRect().top+window.scrollY-16;
  if(window.scrollY>top)window.scrollTo({top,behavior:"smooth"});
};

form.addEventListener("click",event=>{
  const next=event.target.closest("[data-next]");
  const back=event.target.closest("[data-back]");
  if(next){
    event.preventDefault();
    if(!stepValid(current))return;
    show(current+1);focusStep();
  }else if(back){
    event.preventDefault();
    show(current-1);focusStep();
  }
});

const buildPayload=()=>{
  const data=new FormData(form);
  const one=name=>String(data.get(name)||"").trim();
  return{
    form:one("form"),
    source:one("source"),
    product_key:one("product_key"),
    offer_code:one("offer_code"),
    ...attribution,
    business_type:one("business_type"),
    team_size:one("team_size"),
    bottleneck:one("bottleneck"),
    interests:data.getAll("interests").map(String),
    first_name:one("first_name"),
    email:one("email"),
    consent:data.get("consent")==="on",
    bot_field:String(data.get("bot_field")||""),
    interaction_started_at:startedAt,
    idempotency_key:crypto.randomUUID(),
    submitted_at:new Date().toISOString(),
    release_state:"APPROVAL_HELD"
  };
};

// "Choose your demo": /?interests=<demo keys>#choose-demo, mapped from the
// questionnaire's interests by assets/demo-config.js (START_INTEREST_MAP).
const chooseDemoHref=interests=>{
  const demo=window.ACE_DEMO_CONFIG;
  const keys=demo&&demo.mapStartInterests?demo.mapStartInterests(interests):[];
  return keys.length?`/?interests=${keys.join(",")}#choose-demo`:"/#choose-demo";
};

const unlock=(held,interests=[])=>{
  const slot=document.getElementById("videoSlot");
  const inbox=document.getElementById("videoInbox");
  if(CONFIG.videoConfigured){
    const video=document.createElement("video");
    video.controls=true;
    video.playsInline=true;
    video.setAttribute("playsinline","");
    video.preload="metadata";
    if(CONFIG.DEMO_POSTER_URL)video.poster=CONFIG.DEMO_POSTER_URL;
    video.src=CONFIG.DEMO_VIDEO_URL;
    video.setAttribute("aria-label","ACE demo video");
    slot.appendChild(video);
    slot.hidden=false;
    inbox.hidden=true;
  }else{
    slot.hidden=true;
    inbox.hidden=false;
  }
  const book=document.getElementById("bookDemo");
  if(CONFIG.bookingConfigured){
    book.href=CONFIG.BOOKING_URL;
    book.hidden=false;
  }else{
    book.hidden=true;
    book.removeAttribute("href");
  }
  const choose=document.getElementById("chooseDemo");
  if(choose)choose.href=chooseDemoHref(interests);
  const heldNote=document.getElementById("heldNote");
  if(heldNote){heldNote.textContent=held?HELD_NOTE:"";heldNote.hidden=!held}
  form.hidden=true;
  if(progress)progress.hidden=true;
  const intro=document.getElementById("formIntro");
  if(intro)intro.hidden=true;
  success.hidden=false;
  const heading=success.querySelector("h2");
  if(heading)heading.focus({preventScroll:true});
  success.scrollIntoView({block:"start",behavior:"smooth"});
};

form.addEventListener("submit",async event=>{
  event.preventDefault();
  // Enter in an earlier step advances instead of submitting.
  if(current<steps.length-1){
    if(stepValid(current)){show(current+1);focusStep()}
    return;
  }
  for(let i=0;i<steps.length;i++){
    if(!stepValid(i)){show(i);return}
  }

  submitButton.disabled=true;
  status.textContent="Unlocking your demo…";
  try{
    const payload=buildPayload();
    Object.assign(payload,await solveProof(payload));

    if(!RELEASE_AUTHORIZED){
      form.dataset.lastPayload=JSON.stringify(payload);
      status.textContent="";
      unlock(true,payload.interests);
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
    unlock(false,payload.interests);
  }catch(error){
    status.textContent=FAILURE_MESSAGE;
  }finally{
    submitButton.disabled=false;
  }
});

show(0);

})();
