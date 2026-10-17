(()=>{"use strict";

// ACE Owner Draft Center controller.
// Sign in by email code (Supabase Auth OTP). The server decides who is an owner
// (ace_v2.owner_accounts); this page only renders what the owner RPCs return.
// ?preview=1 renders sample drafts with no network call (for design review).
const CFG=window.ACE_OWNER_CONFIG||{};
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const show=(id,on)=>{const el=$(id);if(el)el.hidden=!on};
const KIND={ad_post:"Ad post",agentic_post:"Agentic Automation post",video_script:"Video script",video:"Video",outreach:"Outreach",offer_copy:"Website copy",demo:"Demo",other:"Draft"};
const DONE={APPROVED:"Approved",CHANGE_REQUESTED:"Change requested",REJECTED:"Rejected"};
const fmt=t=>{if(!t)return"";const d=new Date(t);return d.toLocaleString([], {weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})};

const SAMPLE={ok:true,counts:{PENDING:2,APPROVED:1},drafts:[
  {id:1,source:"ChatGPT",kind:"ad_post",channel:"instagram",title:"Day 1 · Ad 1 · Slow lead response",body:"Still waiting hours to answer new leads?\n\nEvery minute you delay, your hottest prospects cool off. ACE answers new leads within minutes.\n\nTap Follow\nReply DEMO for a free demo",scheduled_for:"2026-10-20T13:00:00Z",urgent:false,status:"PENDING",ref:"MSG-13239"},
  {id:2,source:"Claude",kind:"video",channel:"instagram",title:"ACE Baby · Cowboy 8-Stage short (v8)",body:"Final approved cut, ready to schedule.",media_url:"/media/posts/ace-baby-cowboy-8stage-v8.mp4",stage:"final",urgent:true,status:"PENDING",ref:"5.03"}]};

let client=null,tab="PENDING",preview=false,data=SAMPLE;

function card(d){
  const media=d.media_url?(/\.(mp4|mov|webm)(\?|$)/i.test(d.media_url)
      ?`<div class="d-media"><video src="${esc(d.media_url)}" controls playsinline preload="metadata"></video></div>`
      :`<div class="d-media"><img src="${esc(d.media_url)}" alt="" loading="lazy"></div>`):"";
  const meta=[d.urgent?'<span class="pill urgent">Urgent</span>':"",
    `<span class="pill">${esc(KIND[d.kind]||d.kind||"Draft")}</span>`,
    d.channel?`<span class="pill">${esc(d.channel)}</span>`:"",
    d.scheduled_for?`<span class="pill">Slot ${esc(fmt(d.scheduled_for))}</span>`:"",
    `<span class="pill">From ${esc(d.source)}</span>`,
    d.ref?`<span class="pill">${esc(d.ref)}</span>`:""].join("");
  const local=t=>{const x=new Date(t);x.setMinutes(x.getMinutes()-x.getTimezoneOffset());return x.toISOString().slice(0,16)};
  const slot=d.scheduled_for&&new Date(d.scheduled_for)>new Date()?d.scheduled_for:new Date(Date.now()+3600e3).toISOString();
  const textOnly=d.kind==="outreach"||d.kind==="other";
  const approveRow=d.stage==="preview"
    ?`<p class="hint">Free draft. Approving this lets Claude add the Hedra lip-sync animation (about $1.20–$1.90). The animated reel comes back here for your final OK.</p>
      <div class="row"><button class="btn btn-approve" type="button" data-decide="APPROVED">Approve → animate</button></div>`
    :textOnly
    ?`<div class="row"><button class="btn btn-approve" type="button" data-decide="APPROVED">Approve</button></div>`
    :`<div class="row"><button class="btn btn-approve" type="button" data-decide="APPROVED" data-when="now">Approve + post now</button></div>
      <label class="when">Or schedule for <input type="datetime-local" data-when-input value="${esc(local(slot))}"></label>
      <div class="row"><button class="btn btn-approve alt" type="button" data-decide="APPROVED" data-when="schedule">Approve + schedule</button></div>`;
  const pub=d.status==="APPROVED"&&d.publish_at?` · Goes out ${esc(fmt(d.published_at||d.publish_at))}`:"";
  const actions=d.status==="PENDING"
    ?`${approveRow}
      <textarea aria-label="Change requested" placeholder="What should change? (needed for Change)" data-comment></textarea>
      <div class="row"><button class="btn btn-change" type="button" data-decide="CHANGE_REQUESTED">Change</button>
      <button class="btn btn-reject" type="button" data-decide="REJECTED">Reject</button></div>
      <p class="status" data-status role="status"></p>`
    :`<p class="done ${esc(d.status)}">${esc(DONE[d.status]||d.status)}${d.decided_at?" · "+esc(fmt(d.decided_at)):""}${pub}${d.publish_result?" · "+esc(d.publish_result):""}${d.owner_comment?" · “"+esc(d.owner_comment)+"”":""}</p>`;
  return `<article class="card" data-id="${esc(d.id)}"><div class="meta">${meta}</div>
    <p class="d-title">${esc(d.title)}</p>${media}${d.body?`<p class="d-body">${esc(d.body)}</p>`:""}${actions}</article>`;
}

function render(r){
  const c=r.counts||{};
  $("#n-pending").textContent=c.PENDING||0;$("#n-approved").textContent=c.APPROVED||0;
  $("#n-change").textContent=c.CHANGE_REQUESTED||0;$("#n-rejected").textContent=c.REJECTED||0;
  const list=(r.drafts||[]).filter(d=>d.status===tab);
  $("#list").innerHTML=list.length?list.map(card).join("")
    :`<p class="card empty">${tab==="PENDING"?"Nothing waiting. You are all caught up.":"Nothing here in the last 30 days."}</p>`;
  if(navigator.setAppBadge&&tab==="PENDING"){try{(c.PENDING?navigator.setAppBadge(c.PENDING):navigator.clearAppBadge()).catch(()=>{})}catch(_){}}
}

async function rpc(name,args){const {data,error}=await client.rpc(name,args||{});if(error)throw error;return data}
// Shares the signed-in session with the Command Center tabs (assets/command-center.js).
let announced=false;
function ready(){if(announced)return;announced=true;window.ACE_OWNER={rpc,preview,client,reloadDrafts:()=>refresh()};window.dispatchEvent(new CustomEvent("ace-owner-ready"))}

async function refresh(){
  if(preview){render(data);return}
  const {data:sess}=await client.auth.getSession();
  if(!sess||!sess.session){show("#dash",false);show("#notowner",false);show("#signin",true);return}
  const r=await rpc("owner_list_drafts",{p_status:tab});
  if(!r||!r.ok){show("#signin",false);show("#dash",false);show("#notowner",true);$("#no-email").textContent=sess.session.user.email;return}
  show("#signin",false);show("#notowner",false);show("#dash",true);
  render(r);setupPush();
  ready();
}

function wire(){
  $$(".tabs button").forEach(b=>b.addEventListener("click",()=>{
    tab=b.dataset.tab;$$(".tabs button").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));
    refresh().catch(()=>{});
  }));
  $("#list").addEventListener("click",async e=>{
    const t=e.target.closest("[data-decide]");if(!t)return;
    const art=t.closest("article");const st=art.querySelector("[data-status]");
    const comment=(art.querySelector("[data-comment]").value||"").trim();
    if(t.dataset.decide==="CHANGE_REQUESTED"&&!comment){st.textContent="Type what should change, then tap Change.";art.querySelector("[data-comment]").focus();return}
    if(preview){st.textContent="Preview only. Nothing was saved.";return}
    art.querySelectorAll("button").forEach(b=>b.disabled=true);st.textContent="Saving...";
    try{let when=null;
      if(t.dataset.when==="schedule"){const v=art.querySelector("[data-when-input]").value;if(!v){st.textContent="Pick a date and time first.";art.querySelectorAll("button").forEach(b=>b.disabled=false);return}
        when=new Date(v);if(when<new Date()){st.textContent="That time has passed. Pick a future time or tap Post now.";art.querySelectorAll("button").forEach(b=>b.disabled=false);return}when=when.toISOString()}
      const r=await rpc("owner_decide_draft",{p_draft_id:Number(art.dataset.id),p_decision:t.dataset.decide,p_comment:comment||null,p_publish_at:when});
      if(r&&r.ok){await refresh()}else{st.textContent="Already decided or not allowed. Refreshing.";setTimeout(()=>refresh(),900)}}
    catch(_){st.textContent="That did not save. Check your connection and try again.";art.querySelectorAll("button").forEach(b=>b.disabled=false)}
  });
  $$("[data-signout]").forEach(b=>b.addEventListener("click",async()=>{if(client)await client.auth.signOut();location.reload()}));
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refresh().catch(()=>{})});
}

// ---------- phone alerts (Web Push) ----------
const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent);
const standalone=window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
function b64ToBytes(s){const p="=".repeat((4-s.length%4)%4);const b=atob((s+p).replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from(b,c=>c.charCodeAt(0))}
async function setupPush(){
  const pc=$("#push-card");
  if(!("serviceWorker" in navigator)){pc.hidden=true;return}
  const reg=await navigator.serviceWorker.register("/owner/sw.js",{scope:"/owner/"}).catch(()=>null);
  if(!reg){pc.hidden=true;return}
  if(!("PushManager" in window)){
    if(isIOS&&!standalone){pc.hidden=false;$("#push-text").textContent="To get phone alerts on iPhone: tap the Share button, then 'Add to Home Screen', then open ACE Command from your home screen.";$("#push-btn").hidden=true}
    else pc.hidden=true;
    return;
  }
  const existing=await reg.pushManager.getSubscription();
  if(existing&&Notification.permission==="granted"){pc.hidden=true;saveSub(existing).catch(()=>{});return}
  pc.hidden=false;$("#push-btn").hidden=false;
}
async function saveSub(sub){const r=await rpc("owner_save_push_subscription",{p_sub:sub.toJSON(),p_ua:navigator.userAgent});if(!r||!r.ok)throw new Error("save")}
async function enablePush(){
  const st=$("#push-status");st.textContent="Asking your phone...";
  try{
    const perm=await Notification.requestPermission();
    if(perm!=="granted"){st.textContent="Alerts are off. Allow notifications for this app in your phone settings, then try again.";return}
    const reg=await navigator.serviceWorker.ready;
    const k=await fetch(CFG.pushFunctionUrl+"?action=key").then(r=>r.json());
    const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToBytes(k.publicKey)});
    await saveSub(sub);
    st.textContent="Alerts are on. Sending a test alert...";
    const t=await fetch(CFG.pushFunctionUrl+"?action=test",{method:"POST"}).then(r=>r.json()).catch(()=>null);
    st.textContent=t&&t.sent?"Alerts are on. You should see a test alert now.":"Alerts are on.";
    setTimeout(()=>{$("#push-card").hidden=true},4000);
  }catch(_){st.textContent="Could not turn on alerts. Try again in a moment."}
}

async function startLive(){
  if(!window.supabase||!CFG.supabaseUrl||!CFG.supabaseKey){$("#signin-status").textContent="Sign-in is unavailable right now.";show("#signin",true);return}
  client=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,storageKey:"ace-owner-auth"}});
  $("#email-form").addEventListener("submit",async e=>{
    e.preventDefault();
    const email=$("#email").value.trim();
    $("#signin-status").textContent="Sending your code...";
    const {error}=await client.auth.signInWithOtp({email,options:{shouldCreateUser:true}});
    if(error){$("#signin-status").textContent="We could not send a code to that address.";return}
    $("#signin-status").textContent="Check your email for a 6-digit code.";
    $("#code-form").hidden=false;$("#code").focus();
  });
  $("#code-form").addEventListener("submit",async e=>{
    e.preventDefault();
    const {error}=await client.auth.verifyOtp({email:$("#email").value.trim(),token:$("#code").value.trim(),type:"email"});
    if(error){$("#signin-status").textContent="That code did not work. Try again or request a new one.";return}
    await refresh();
  });
  $("#push-btn").addEventListener("click",enablePush);
  wire();
  await refresh();
}

function init(){
  preview=new URLSearchParams(location.search).get("preview")==="1";
  if(preview){wire();show("#dash",true);render(data);ready();return}
  startLive().catch(()=>{$("#signin-status").textContent="Sign-in is unavailable right now.";show("#signin",true)});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
