(()=>{"use strict";

// My ACE controller. Sign in by email code (Supabase Auth OTP), then render:
// credit meter, usage by category, drafts awaiting approval, plan + onboarding,
// billing (Stripe customer portal) and a live-representative request.
//
// Release gate: the per-page flag from assets/release-flag.js. While the page
// is HELD nothing touches the network: ?preview=1 renders sample data only.
const RELEASED=Boolean(window.ACE_RELEASE&&window.ACE_RELEASE.isReleased());
const CFG=window.ACE_MYACE_CONFIG||{};
const $=s=>document.querySelector(s);
const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const usd=n=>"$"+Number(n||0).toFixed(2);
const show=(id,on)=>{const el=$(id);if(el)el.hidden=!on};

const SAMPLE={signed_in:true,email:"owner@example.com",customer:true,
  account:{display_name:"Sample Plumbing Co",has_billing:true},
  plan:{tier:"Sample plan (preview)",period_start:"2026-10-20T00:00:00Z",period_end:"2026-11-20T00:00:00Z",included_credit_usd:60},
  credit:{total_usd:60,used_usd:49.2,remaining_usd:10.8,pct_used:82,alert:"ALERT_80"},
  usage_by_category:[{category:"AI writing",used_usd:21.4},{category:"Video",used_usd:18.6},{category:"Research",used_usd:9.2}],
  onboarding:[{offer:"Social Media Marketing OS",tier:"Sample",status:"FIRST_DRAFTS_SENT",since:"2026-10-20T15:00:00Z"}],
  drafts:[{id:0,title:"Tuesday tip: 3 signs your water heater is failing",channel:"instagram",preview_text:"Caption and image ready for your approval."}]};

function meterState(c){
  if(!c)return{cls:"ok",msg:"No usage yet this period."};
  if(c.alert==="PAUSED_AT_100")return{cls:"stop",msg:"Your usage credit is used up. Work is paused, except replies to new leads, until you top up."};
  if(c.alert==="ALERT_80")return{cls:"warn",msg:"You have used over 80% of this month's usage credit. Top up to keep everything running."};
  return{cls:"ok",msg:"Plenty of usage credit left this period."};
}

function render(s,preview){
  show("#signin",false);show("#nocustomer",false);show("#dash",true);
  $("#who").textContent=(s.account&&s.account.display_name)||s.email;
  $("#who-email").textContent=s.email;
  const c=s.credit||{total_usd:0,used_usd:0,remaining_usd:0,pct_used:0,alert:"OK"};
  const st=meterState(s.credit);
  const pct=Math.max(0,Math.min(100,Number(c.pct_used)||0));
  $("#meter").className="card meter "+st.cls;
  $("#meter-fill").style.width=pct+"%";
  $("#meter-fill").setAttribute("aria-valuenow",String(pct));
  $("#meter-left").textContent=usd(c.remaining_usd)+" left";
  $("#meter-of").textContent=usd(c.used_usd)+" used of "+usd(c.total_usd);
  $("#meter-msg").textContent=st.msg;
  const cats=s.usage_by_category||[];
  $("#cats").innerHTML=cats.length?cats.map(x=>`<li><span>${esc(x.category)}</span><b>${usd(x.used_usd)}</b></li>`).join(""):"<li><span>No usage yet this period.</span></li>";
  const topups=(CFG.topUps||[]);
  $("#topups").innerHTML=topups.map(t=>t.url&&!preview
    ?`<a class="btn btn-primary" href="${esc(t.url)}" rel="noopener">Top up $${esc(t.usd)}</a>`
    :`<button class="btn btn-primary" type="button" data-topup="${esc(t.usd)}">Top up $${esc(t.usd)}</button>`).join("");
  const drafts=s.drafts||[];
  $("#drafts-count").textContent=String(drafts.length);
  $("#drafts").innerHTML=drafts.length?drafts.map(d=>`<li class="draft" data-id="${esc(d.id)}">
      <p class="draft-t">${esc(d.title)}</p><p class="draft-m">${esc(d.channel||"")}</p>
      ${d.preview_text?`<p class="draft-p">${esc(d.preview_text)}</p>`:""}
      ${d.preview_url?`<p><a href="${esc(d.preview_url)}" target="_blank" rel="noopener">Open preview</a></p>`:""}
      <div class="row"><button class="btn btn-primary" type="button" data-decide="APPROVED">Approve</button>
      <button class="btn btn-ghost" type="button" data-decide="CHANGE_REQUESTED">Request a change</button></div></li>`).join("")
    :"<li class=\"empty\">Nothing waiting for you. ACE will text or email you when a new draft is ready.</li>";
  const p=s.plan;
  $("#plan").innerHTML=p?`<li><span>Plan</span><b>${esc(p.tier)}</b></li>
      <li><span>Included usage credit</span><b>${usd(p.included_credit_usd)} / month</b></li>
      <li><span>This period</span><b>${esc(String(p.period_start).slice(0,10))} to ${esc(String(p.period_end).slice(0,10))}</b></li>`
    :"<li><span>Plan</span><b>Not active yet</b></li>";
  const ob=s.onboarding||[];
  $("#onboarding").innerHTML=ob.length?ob.map(o=>`<li><span>${esc(o.offer)}${o.tier?" ("+esc(o.tier)+")":""}</span><b>${esc(String(o.status||"").replace(/_/g," ").toLowerCase())}</b></li>`).join(""):"<li><span>No onboarding in progress.</span></li>";
  $("#billing").hidden=false;
}

let client=null;
async function rpc(name,args){
  const {data,error}=await client.rpc(name,args||{});
  if(error)throw error;
  return data;
}
async function refresh(){
  const s=await rpc("my_ace_summary");
  if(!s||!s.signed_in){show("#dash",false);show("#signin",true);return}
  if(!s.customer){show("#signin",false);show("#dash",false);show("#nocustomer",true);$("#nc-email").textContent=s.email;return}
  render(s,false);
}

function wire(preview){
  document.addEventListener("click",async e=>{
    const t=e.target.closest("[data-decide],[data-topup],[data-signout],#billing-btn");
    if(!t)return;
    if(t.dataset.topup){
      $("#topup-note").hidden=false;
      $("#topup-note").textContent=preview?"Preview: no payment is taken here.":"Online top-up opens at launch. Email "+(CFG.supportEmail||"us")+" and we will add credit today.";
      return;
    }
    if(t.id==="billing-btn"){
      if(CFG.billingPortalUrl&&!preview){location.href=CFG.billingPortalUrl}
      else{$("#billing-note").hidden=false;$("#billing-note").textContent=preview?"Preview: the secure Stripe billing page opens here (card, invoices, cancel).":"Billing self-service opens at launch. Email "+(CFG.supportEmail||"us")+" for invoices or card changes."}
      return;
    }
    if(t.hasAttribute("data-signout")){if(client)await client.auth.signOut();location.reload();return}
    const li=t.closest(".draft");
    if(!li)return;
    if(preview){li.querySelector(".row").outerHTML="<p class=\"draft-m\">Preview: decision not sent.</p>";return}
    let comment=null;
    if(t.dataset.decide==="CHANGE_REQUESTED"){comment=prompt("What would you like changed?");if(comment===null)return}
    t.disabled=true;
    try{await rpc("my_ace_decide_draft",{p_draft_id:Number(li.dataset.id),p_decision:t.dataset.decide,p_comment:comment});await refresh()}
    catch(_){t.disabled=false;alert("That did not go through. Please try again.")}
  });
  $("#rep-form").addEventListener("submit",async e=>{
    e.preventDefault();
    const note=$("#rep-status");
    if(preview){note.textContent="Preview: request not sent.";return}
    if(!$("#rep-tick").checked){note.textContent="Tick the box to ask for a call.";return}
    try{const r=await rpc("my_ace_request_live_rep",{p_comment:$("#rep-comment").value||null});
      note.textContent=r&&r.ok?"Thanks. A live representative will contact you.":"Please try again in a little while."}
    catch(_){note.textContent="That did not go through. Please try again."}
  });
}

async function startLive(){
  if(!window.supabase||!CFG.supabaseUrl||!CFG.supabaseKey){$("#signin-status").textContent="Sign-in is unavailable right now.";return}
  client=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true}});
  $("#code-form").hidden=true;
  $("#email-form").addEventListener("submit",async e=>{
    e.preventDefault();
    const email=$("#email").value.trim();
    $("#signin-status").textContent="Sending your code...";
    const {error}=await client.auth.signInWithOtp({email,options:{shouldCreateUser:true}});
    if(error){$("#signin-status").textContent="We could not send a code. Check the address and try again.";return}
    $("#signin-status").textContent="Check your email for a 6-digit code.";
    $("#code-form").hidden=false;$("#code").focus();
  });
  $("#code-form").addEventListener("submit",async e=>{
    e.preventDefault();
    const {error}=await client.auth.verifyOtp({email:$("#email").value.trim(),token:$("#code").value.trim(),type:"email"});
    if(error){$("#signin-status").textContent="That code did not work. Try again or request a new one.";return}
    await refresh();
  });
  wire(false);
  const {data}=await client.auth.getSession();
  if(data&&data.session)await refresh();else show("#signin",true);
}

function init(){
  const preview=new URLSearchParams(location.search).get("preview")==="1";
  if(!RELEASED){
    show("#held",true);
    if(preview){wire(true);render(SAMPLE,true)}
    else{show("#signin",true);$("#email-form").addEventListener("submit",e=>{e.preventDefault();$("#signin-status").textContent="My ACE opens at launch. Nothing was sent."})}
    return;
  }
  startLive().catch(()=>{$("#signin-status").textContent="Sign-in is unavailable right now."});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
