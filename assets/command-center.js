(()=>{"use strict";

// ACE Command Center: project tabs on top of the owner Draft Center.
// Reads and writes only through owner RPCs (public.owner_command_list,
// public.owner_command_set, public.owner_launch_checklist), which check the
// signed-in owner server-side. The Approvals tab is the existing Draft Center.
const $=s=>document.querySelector(s);
const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=t=>{if(!t)return"";const d=new Date(t);return d.toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})};

const PROJECTS=[
  ["alerts","🚨 Alerts"],["approvals","Approvals"],["vault","Marketing Vault"],["launch","Launch checklist"],
  ["demo_videos","Demo videos"],["hannah_videos","Hannah videos"],["ace_outreach","ACE outreach"],
  ["withyou_outreach","WithYou outreach"],["website","Website"],["my_ace","My ACE"],
  ["agentic","Agentic engineering"],["withyou_app","WithYou App"],["ace_app","ACE App"]
];
const LABEL=Object.fromEntries(PROJECTS);
const EMPTY={alerts:"No open alerts. Everything is running.",launch:"No open launch tasks for you."};

const SAMPLE={ok:true,drafts_pending:2,counts:{alerts:1,ace_outreach:1,demo_videos:1},items:[
  {id:1,project:"general",item_type:"alert",severity:"P0",owner:"Jim",status:"open",title:"Smartlead mailbox disconnected",body:"murray@ stopped sending at 10:14. Reconnect it in Smartlead → Email Accounts.",source:"Monitor",created_at:new Date().toISOString()},
  {id:2,project:"ace_outreach",item_type:"task",severity:"P1",owner:"Jim",status:"open",title:"Reply from a roofing owner: interested",body:"Michael, Queen City Roofing, asked for a call this week.",source:"Reply router",created_at:new Date().toISOString()},
  {id:3,project:"ace_outreach",item_type:"update",severity:"info",owner:"Claude",status:"open",title:"Daily send report",body:"HVAC 20 sent · Plumbing 20 · Roofing 20 · Dental 20. 2 replies, 0 bounces.",source:"Claude",created_at:new Date().toISOString()},
  {id:4,project:"demo_videos",item_type:"task",severity:"P1",owner:"Jim",status:"open",title:"Pick the demo music",body:"Three versions of the Pipeline demo were sent. Reply with the one you want.",source:"Claude",created_at:new Date().toISOString()}
]};
const SAMPLE_CK={ok:true,items:[{item_id:"7.03",stage:7,task:"Production canary with readbacks",owner:"Claude",status:"AWAITING_VERIFY",committed_date:"2026-10-17"},{item_id:"4.05",stage:4,task:"Demo videos embedded and playable",owner:"Claude",status:"OPEN",committed_date:"2026-10-20"}]};

let api=null,current="alerts",showDone=false,last=null;

function nav(counts,drafts){
  $("#proj").innerHTML=PROJECTS.map(([k,l])=>{
    const n=k==="approvals"?drafts:(counts[k]||0);
    return `<button type="button" data-p="${k}" aria-current="${k===current}">${esc(l)}<span class="b">${n?esc(n):""}</span></button>`;
  }).join("");
}

function itemCard(i){
  const closed=i.status!=="open";
  const kind=i.item_type==="alert"?(i.severity==="P0"?"Alert · urgent":"Alert"):i.item_type==="task"?(i.owner==="Jim"?"Your task":"Task · "+i.owner):"Update";
  const meta=[`<span class="pill${i.severity==="P0"?" urgent":""}">${esc(kind)}</span>`,
    current==="alerts"&&i.project!=="general"?`<span class="pill">${esc(LABEL[i.project]||i.project)}</span>`:"",
    `<span class="pill">${esc(fmt(i.created_at))}</span>`,
    i.source?`<span class="pill">From ${esc(i.source)}</span>`:"",
    i.due_at?`<span class="pill">Due ${esc(fmt(i.due_at))}</span>`:""].join("");
  const link=i.link?`<p style="margin:.6rem 0 0"><a href="${esc(i.link)}" target="_blank" rel="noopener">Open →</a></p>`:"";
  const acts=closed
    ?`<p class="done">${i.status==="done"?"Done":"Dismissed"}${i.done_at?" · "+esc(fmt(i.done_at)):""}</p>
      <div class="row"><button class="btn btn-ghost" type="button" data-set="open">Reopen</button></div>`
    :i.item_type==="update"
    ?`<div class="row"><button class="btn btn-ghost" type="button" data-set="done">Got it</button></div>`
    :`<div class="row"><button class="btn btn-approve" type="button" data-set="done">Done</button>
      <button class="btn btn-ghost" type="button" data-set="dismissed">Dismiss</button></div>`;
  return `<article class="card item ${esc(i.severity)} ${i.item_type==="task"?"task":""} ${closed?"closed":""}" data-id="${esc(i.id)}">
    <div class="meta">${meta}</div><p class="d-title">${esc(i.title)}</p>
    ${i.body?`<p class="d-body">${esc(i.body)}</p>`:""}${link}${acts}<p class="status" data-st role="status"></p></article>`;
}

function checklist(r){
  const rows=(r&&r.items)||[];
  if(!rows.length)return"";
  const open=rows.filter(x=>x.status!=="VERIFIED"&&x.status!=="DONE_NO_VERIFY_NEEDED");
  const done=rows.length-open.length;
  return `<p class="sec">Launch checklist · ${done} of ${rows.length} verified</p><div class="card">${rows.map(x=>
    `<div class="ck"><b>${esc(x.item_id)}</b><span>${esc(x.task)}</span><span class="s ${esc(x.status)}">${esc(String(x.status).replace(/_/g," "))}</span><small>${esc(x.owner||"")}${x.committed_date?" · due "+esc(x.committed_date):""}</small></div>`).join("")}</div>`;
}

async function load(){
  const preview=api.preview;
  const r=preview?SAMPLE:await api.rpc("owner_command_list",{p_project:null});
  if(!r||!r.ok)return;
  last=r;nav(r.counts||{},r.drafts_pending||0);
  if(current==="approvals"){$("#panel-cmd").hidden=true;$("#panel-approvals").hidden=false;return}
  $("#panel-approvals").hidden=true;$("#panel-cmd").hidden=false;
  $("#cmd-title").textContent=LABEL[current]||"Alerts";
  $("#cmd-showall").hidden=current==="vault";
  if(current==="vault"){if(window.ACE_VAULT)await window.ACE_VAULT.show(api);return}
  let items=(r.items||[]).filter(i=>current==="alerts"?i.item_type==="alert":i.project===current);
  const openItems=items.filter(i=>i.status==="open");
  const shown=showDone?items:openItems;
  const mine=shown.filter(i=>i.item_type!=="update"&&(i.owner==="Jim"||i.item_type==="alert"));
  const others=shown.filter(i=>!mine.includes(i));
  let html="";
  if(current==="launch"){const ck=preview?SAMPLE_CK:await api.rpc("owner_launch_checklist",{}).catch(()=>null);html+=checklist(ck)}
  if(mine.length)html+=`<p class="sec">Needs you</p>`+mine.map(itemCard).join("");
  if(others.length)html+=`<p class="sec">${current==="alerts"?"Other alerts":"Updates and team tasks"}</p>`+others.map(itemCard).join("");
  if(!mine.length&&!others.length&&current!=="launch")html=`<p class="card empty">${esc(EMPTY[current]||"Nothing open here. Updates will appear as work moves.")}</p>`;
  $("#cmd-list").innerHTML=html;
  $("#cmd-showall").textContent=showDone?"Hide done":"Show done";
}

function select(p){
  current=PROJECTS.some(([k])=>k===p)?p:"alerts";
  try{const u=new URL(location.href);u.searchParams.set("tab",current);history.replaceState(null,"",u)}catch(_){}
  load().catch(()=>{});
  if(current==="approvals"&&api.reloadDrafts)api.reloadDrafts().catch(()=>{});
}

function wire(){
  $("#proj").addEventListener("click",e=>{const b=e.target.closest("[data-p]");if(b)select(b.dataset.p)});
  $("#cmd-showall").addEventListener("click",()=>{showDone=!showDone;load().catch(()=>{})});
  $("#cmd-list").addEventListener("click",async e=>{
    const t=e.target.closest("[data-set]");if(!t)return;
    const art=t.closest("article");const st=art.querySelector("[data-st]");
    if(api.preview){st.textContent="Preview only. Nothing was saved.";return}
    art.querySelectorAll("button").forEach(b=>b.disabled=true);st.textContent="Saving...";
    try{const r=await api.rpc("owner_command_set",{p_id:Number(art.dataset.id),p_status:t.dataset.set});
      if(r&&r.ok)await load();else{st.textContent="Could not update. Refreshing.";setTimeout(()=>load().catch(()=>{}),900)}}
    catch(_){st.textContent="That did not save. Check your connection and try again.";art.querySelectorAll("button").forEach(b=>b.disabled=false)}
  });
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")load().catch(()=>{})});
}

let started=false;
function start(){
  if(started||!window.ACE_OWNER)return;started=true;
  api=window.ACE_OWNER;
  wire();
  const p=new URLSearchParams(location.search).get("tab");
  select(p||"alerts");
}
window.addEventListener("ace-owner-ready",start);
start();
})();
