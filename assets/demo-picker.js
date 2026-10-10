(()=>{"use strict";

// CHOOSE YOUR DEMO controller for the homepage section #choose-demo.
//
// Release gate (fail-closed): the section ships with the `hidden` attribute.
// This script reveals it ONLY when assets/demo-config.js says
// SECTION_RELEASE_STATE === "RELEASED", or when the URL carries ?preview=1
// (review screenshots). Preview never enables submission. If demo-config.js
// fails to load, nothing is revealed.
//
// The "Ask a question" form uses the same intake contract as
// assets/product-launch.js and assets/start-funnel.js (endpoint, honeypot,
// proof-of-work, idempotency key, strict held receipt). Its release gate is
// the section's own flag, because the homepage has no page-level flag.

const CONFIG=window.ACE_DEMO_CONFIG;
const section=document.getElementById("choose-demo");
if(!section||!CONFIG)return;

const params=new URLSearchParams(location.search);
const PREVIEW=params.get("preview")==="1";
const RELEASE_AUTHORIZED=Boolean(CONFIG&&CONFIG.sectionReleased===true);
if(!RELEASE_AUTHORIZED&&!PREVIEW)return;

const ENDPOINT="https://withyoudaily.app.n8n.cloud/webhook/ace-lead";
const HELD_NOTE="Preview: this section is held until launch authorization. Nothing was sent.";
const FAILURE_MESSAGE="Something went wrong sending your question. Please try again, or email AceGrowth.os@gmail.com.";
const UTM_KEYS=["utm_source","utm_medium","utm_campaign","utm_term","utm_content"];

section.hidden=false;
section.removeAttribute("inert");
if(!RELEASE_AUTHORIZED){
  const ribbon=document.getElementById("cydPreview");
  if(ribbon)ribbon.hidden=false;
}

const $=id=>document.getElementById(id);
const DEMOS=CONFIG.DEMOS;
const byKey=Object.fromEntries(DEMOS.map(d=>[d.key,d]));
const boxes=Array.from(section.querySelectorAll('.cyd-grid input[name="demo"]'));
const watch=$("cydWatch"),count=$("cydCount"),cta=section.querySelector(".cyd-cta");

const selected=()=>CONFIG.normalizeKeys(boxes.filter(b=>b.checked).map(b=>b.value));

const refresh=()=>{
  const keys=selected();
  boxes.forEach(b=>b.closest(".cyd-tile").classList.toggle("is-on",b.checked));
  watch.disabled=keys.length===0;
  count.hidden=keys.length===0;
  count.textContent=keys.length===1?"1 demo":`${keys.length} demos`;
  if(cta)cta.classList.toggle("is-ready",keys.length>0);
};
boxes.forEach(b=>b.addEventListener("change",refresh));

// Preselect from ?interests=followup,content (demo keys).
const preset=CONFIG.normalizeKeys(params.get("interests")||"");
boxes.forEach(b=>{if(preset.includes(b.value))b.checked=true});
refresh();

// ---------------- player ----------------
const modal=$("cydModal"),chips=$("cydChips"),stage=$("cydStage"),end=$("cydEnd");
const video=$("cydVideo"),soon=$("cydSoon");
const prev=$("cydPrev"),next=$("cydNext");
let playlist=[],index=0,lastFocus=null;
const played=new Set();

const linkWithInterests=keys=>{
  // keys are normalized demo keys ([a-z] only), safe to place in the URL as-is.
  return `checkout/ace-mkt/?from=demo${keys.length?`&interests=${keys.join(",")}`:""}`;
};

const renderChips=()=>{
  chips.textContent="";
  const atEnd=!end.hidden;
  chips.hidden=playlist.length===0;
  playlist.forEach((key,i)=>{
    const isNow=!atEnd&&i===index,isDone=!isNow&&played.has(key)&&(atEnd||i<index);
    const li=document.createElement("li");
    const b=document.createElement("button");
    b.type="button";
    b.className="cyd-chip"+(isNow?" is-now":"")+(isDone?" is-done":"");
    if(isNow)b.setAttribute("aria-current","true");
    const n=document.createElement("i");
    n.textContent=isDone?"\u2713":String(i+1);
    b.append(n,document.createTextNode(byKey[key].title));
    b.addEventListener("click",()=>play(i));
    li.appendChild(b);
    chips.appendChild(li);
  });
};

const stopVideo=()=>{
  try{video.pause()}catch(e){}
  video.removeAttribute("src");
  try{video.load()}catch(e){}
};

const play=i=>{
  index=Math.max(0,Math.min(i,playlist.length-1));
  const demo=byKey[playlist[index]];
  played.add(demo.key);
  stage.hidden=false;end.hidden=true;
  $("cydStep").textContent=`Demo ${index+1} of ${playlist.length}`;
  $("cydNowTitle").textContent=demo.title;
  $("cydNowOut").textContent=demo.outcome;
  const dur=$("cydDur");
  dur.hidden=!demo.duration;dur.textContent=demo.duration?`Runs ${demo.duration}`:"";
  prev.disabled=index===0;
  next.textContent=index===playlist.length-1?"Finish":"Next demo";
  if(CONFIG.isVideoConfigured(demo.file)){
    soon.hidden=true;video.hidden=false;
    if(demo.poster)video.poster=demo.poster;else video.removeAttribute("poster");
    video.src=demo.file;
    video.setAttribute("aria-label",`${demo.title} demo video`);
    const p=video.play();
    if(p&&p.catch)p.catch(()=>{/* autoplay refused: controls remain */});
  }else{
    stopVideo();video.hidden=true;soon.hidden=false;
    $("cydSoonTitle").textContent=demo.title;
    $("cydSoonOut").textContent=demo.outcome;
  }
  renderChips();
};

const showEnd=(openForm=false)=>{
  stopVideo();
  stage.hidden=true;end.hidden=false;
  index=playlist.length;
  renderChips();
  $("cydAgain").hidden=playlist.length===0;
  $("cydPricing").href=linkWithInterests(playlist);
  const deadline=$("cydDeadline");
  const ends=CONFIG.launchPricingEnds();
  if(ends){
    deadline.textContent="Launch pricing ends "+ends.toLocaleDateString("en-US",{month:"long",day:"numeric",timeZone:"America/New_York"});
    deadline.hidden=false;
  }else{deadline.hidden=true;deadline.textContent=""}
  if(openForm)toggleForm(true);
  const h=$("cydEndTitle");if(h)h.focus({preventScroll:true});
};

video.addEventListener("ended",()=>{index<playlist.length-1?play(index+1):showEnd()});
next.addEventListener("click",()=>{index<playlist.length-1?play(index+1):showEnd()});
prev.addEventListener("click",()=>play(index-1));
$("cydAgain").addEventListener("click",()=>{played.clear();play(0)});

const onKey=e=>{if(e.key==="Escape")closePlayer()};
const openPlayer=(keys,{atEnd=false,openForm=false}={})=>{
  playlist=keys.slice();
  played.clear();
  lastFocus=document.activeElement;
  modal.hidden=false;
  document.documentElement.style.overflow="hidden";
  document.addEventListener("keydown",onKey);
  if(atEnd)showEnd(openForm);else play(0);
  $("cydClose").focus({preventScroll:true});
};
const closePlayer=()=>{
  stopVideo();
  modal.hidden=true;
  document.documentElement.style.overflow="";
  document.removeEventListener("keydown",onKey);
  if(lastFocus&&lastFocus.focus)lastFocus.focus({preventScroll:true});
};
$("cydClose").addEventListener("click",closePlayer);
modal.addEventListener("click",e=>{if(e.target===modal)closePlayer()});
watch.addEventListener("click",()=>{const keys=selected();if(keys.length)openPlayer(keys)});

// ---------------- question form ----------------
const ask=$("cydAsk"),form=$("cydForm"),done=$("cydDone");
const toggleForm=open=>{
  const show=open===undefined?form.hidden:open;
  if(!done.hidden)return;
  form.hidden=!show;
  ask.setAttribute("aria-expanded",String(show));
  if(show){
    const first=form.querySelector('input[name="first_name"]');
    if(first)first.focus({preventScroll:true});
    form.scrollIntoView({block:"nearest",behavior:"smooth"});
  }
};
ask.addEventListener("click",()=>toggleForm());

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
    question:one("question").slice(0,2000),
    interests:playlist.slice(),
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
  ask.setAttribute("aria-expanded","false");
  const note=$("cydHeldNote");
  note.textContent=held?HELD_NOTE:"";note.hidden=!held;
  done.hidden=false;
  done.focus({preventScroll:true});
  done.scrollIntoView({block:"nearest",behavior:"smooth"});
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

// Deep links: ?ask=1 opens straight to the question form (from checkout's
// "Not ready yet?"); #choose-demo with ?interests scrolls the picker in.
if(params.get("ask")==="1"){
  openPlayer(preset,{atEnd:true,openForm:true});
}else if(location.hash==="#choose-demo"){
  requestAnimationFrame(()=>section.scrollIntoView({block:"start"}));
}

})();
