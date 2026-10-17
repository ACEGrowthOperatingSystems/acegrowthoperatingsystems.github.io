(()=>{"use strict";

// ACE Marketing Vault: owner-only image/video library inside the Command Center.
// Files live in the private Supabase Storage bucket "ace-vault" (owner-only
// storage policies); metadata lives in ace_v2.vault_assets via owner RPCs.
// Viewing uses short-lived signed URLs, so nothing in the vault is public.
const $=s=>document.querySelector(s);
const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const BUCKET="ace-vault";
const CATS=[
  ["all","All"],["brand","Brand & logo"],["lead_generator","ACE Lead Generator"],["prospecting_os","Prospecting Autopilot OS"],
  ["social_os","Social Media Marketing OS"],["customer_acq_os","Customer Acquisition OS"],["growth_os","Growth Autopilot OS"],
  ["a_la_carte","À la carte products"],["add_ons","Add-ons & Fast Start"],["specialist_command","Specialist Command (Think Tank)"],
  ["ads_campaigns","Ads & campaigns"],["ace_baby","ACE Baby"],["website","Website"],["other","Other"]
];
const LABEL=Object.fromEntries(CATS);
const SAMPLE={ok:true,counts:{brand:1,specialist_command:1},items:[
  {id:1,category:"brand",title:"ACE logo — primary (silver & red)",storage_path:"/assets/brand/ace-logo-primary.jpg",mime_type:"image/jpeg",status:"approved",source:"Jim",created_at:new Date().toISOString()},
  {id:2,category:"specialist_command",title:"Specialist Command — hero concept",storage_path:"/assets/ace-logo.jpg",mime_type:"image/jpeg",status:"saved",source:"ChatGPT",created_at:new Date().toISOString()}]};

let api=null,cat="all",wired=false;

function slug(s){return String(s||"file").toLowerCase().replace(/\.[a-z0-9]+$/,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)||"file"}
function isVideo(m,p){return /^video\//.test(m||"")||/\.(mp4|mov|webm)$/i.test(p||"")}

async function urlsFor(items){
  const out={};
  const stored=items.filter(i=>!String(i.storage_path).startsWith("/"));
  items.filter(i=>String(i.storage_path).startsWith("/")).forEach(i=>out[i.storage_path]=i.storage_path);
  if(stored.length&&!api.preview&&api.client){
    const {data}=await api.client.storage.from(BUCKET).createSignedUrls(stored.map(i=>i.storage_path),3600);
    (data||[]).forEach(d=>{if(d.signedUrl)out[d.path]=d.signedUrl});
  }
  return out;
}

function shell(){
  return `<div class="vault-bar">
      <select id="v-cat" aria-label="Category">${CATS.map(([k,l])=>`<option value="${k}"${k===cat?" selected":""}>${esc(l)}</option>`).join("")}</select>
      <label class="btn btn-primary v-up">Upload<input id="v-file" type="file" accept="image/*,video/*,application/pdf" multiple hidden></label>
    </div>
    <p class="status" id="v-status" role="status"></p>
    <div class="vgrid" id="v-grid"></div>`;
}

function tile(i,url){
  const media=isVideo(i.mime_type,i.storage_path)
    ?`<video src="${esc(url)}" preload="metadata" playsinline controls></video>`
    :/pdf/.test(i.mime_type||"")?`<div class="vpdf">PDF</div>`:`<img src="${esc(url)}" alt="${esc(i.title)}" loading="lazy">`;
  return `<figure class="vtile" data-id="${esc(i.id)}">${media}
    <figcaption><b>${esc(i.title)}</b><span>${esc(LABEL[i.category]||i.category)} · ${i.status==="approved"?"Approved":"Saved"} · ${esc(i.source)}</span>
    <span class="vacts"><a href="${esc(url)}" download target="_blank" rel="noopener">Download</a>
    ${/pdf/.test(i.mime_type||"")?"":`<button type="button" data-post>Post</button>`}
    ${i.status!=="approved"?`<button type="button" data-v="approved">Approve</button>`:""}
    <button type="button" data-v="archived">Archive</button></span></figcaption>
    <div class="vpost" hidden></div></figure>`;
}

const pad=n=>String(n).padStart(2,"0");
function localNow(h){const d=new Date(Date.now()+h*3600e3);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`}

function postForm(i){
  const vid=isVideo(i.mime_type,i.storage_path);
  return `<label>Caption<textarea data-cap rows="4" maxlength="2200" placeholder="What the post says"></textarea></label>
    <div class="vch"><label><input type="checkbox" value="instagram" checked> Instagram</label>
    <label><input type="checkbox" value="facebook" checked> Facebook</label>
    <label${vid?"":` title="YouTube takes videos only"`}><input type="checkbox" value="youtube"${vid?" checked":" disabled"}> YouTube${vid?"":" (video only)"}</label></div>
    <div class="row"><button class="btn btn-approve" type="button" data-go="now">Approve + post now</button></div>
    <label class="when">Or schedule for <input type="datetime-local" data-at value="${localNow(2)}"></label>
    <div class="row"><button class="btn btn-approve alt" type="button" data-go="schedule">Approve + schedule</button>
    <button class="btn btn-ghost" type="button" data-go="cancel">Cancel</button></div>
    <p class="status" data-pst role="status"></p>`;
}

// Posting = your approval. It creates a draft, then approves it from YOUR
// signed-in session (owner_decide_draft), exactly like the Approvals tab.
// The ACE Draft Center Publisher then sends it to Publer.
async function post(fig,i,mode){
  const box=fig.querySelector(".vpost"),st=box.querySelector("[data-pst]");
  const cap=box.querySelector("[data-cap]").value.trim();
  const ch=[...box.querySelectorAll(".vch input:checked")].map(x=>x.value);
  if(!cap){st.textContent="Write a caption first.";box.querySelector("[data-cap]").focus();return}
  if(!ch.length){st.textContent="Pick at least one channel.";return}
  let when=null;
  if(mode==="schedule"){
    const v=box.querySelector("[data-at]").value;if(!v){st.textContent="Pick a date and time first.";return}
    const d=new Date(v);
    if(d<new Date()){st.textContent="That time has passed. Pick a future time or tap Post now.";return}
    if(d-Date.now()>6.5*864e5){st.textContent="Schedule within 6 days (the private file link lasts 7).";return}
    when=d.toISOString();
  }
  if(api.preview){st.textContent="Preview only. Nothing was posted.";return}
  box.querySelectorAll("button").forEach(b=>b.disabled=true);st.textContent="Sending...";
  try{
    let media;
    if(String(i.storage_path).startsWith("/"))media=location.origin+i.storage_path;
    else{const {data,error}=await api.client.storage.from(BUCKET).createSignedUrl(i.storage_path,604800);if(error||!data)throw new Error("link");media=data.signedUrl}
    const r=await api.rpc("owner_vault_to_post",{p_asset_id:i.id,p_caption:cap,p_channels:ch.join(","),p_media_url:media});
    if(!r||!r.ok)throw new Error(r&&r.error||"draft");
    const d=await api.rpc("owner_decide_draft",{p_draft_id:r.draft_id,p_decision:"APPROVED",p_comment:"Posted from Marketing Vault",p_publish_at:when});
    if(!d||!d.ok){st.textContent="Draft saved, but approval did not go through. Open Approvals to finish it.";return}
    st.textContent=when?`Approved. Goes out ${new Date(when).toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})} to ${ch.join(", ")}.`
      :`Approved. Posting to ${ch.join(", ")} within about 5 minutes. Result shows in Approvals → Decided.`;
    if(api.reloadDrafts)api.reloadDrafts().catch(()=>{});
  }catch(e){st.textContent="That did not post. Check your connection and try again.";box.querySelectorAll("button").forEach(b=>b.disabled=false)}
}

let lastItems=[];

async function render(){
  const panel=$("#cmd-list");
  if(!$("#v-grid"))panel.innerHTML=shell(),wire();
  const r=api.preview?SAMPLE:await api.rpc("owner_vault_list",{p_category:cat==="all"?null:cat});
  if(!r||!r.ok){$("#v-grid").innerHTML=`<p class="card empty">Vault unavailable. Refresh and try again.</p>`;return}
  const items=(r.items||[]).filter(i=>cat==="all"||i.category===cat);
  const sel=$("#v-cat");[...sel.options].forEach(o=>{const n=o.value==="all"?Object.values(r.counts||{}).reduce((a,b)=>a+b,0):((r.counts||{})[o.value]||0);o.textContent=LABEL[o.value]+(n?` (${n})`:"")});
  if(!items.length){$("#v-grid").innerHTML=`<p class="card empty">Nothing saved in ${esc(LABEL[cat])} yet. Tap Upload to add images or videos.</p>`;return}
  lastItems=items;
  const urls=await urlsFor(items);
  $("#v-grid").innerHTML=items.map(i=>tile(i,urls[i.storage_path]||"")).join("");
}

async function upload(files){
  const st=$("#v-status");
  const target=cat==="all"?"other":cat;
  if(api.preview){st.textContent="Preview only. Nothing was uploaded.";return}
  let ok=0,fail=0;
  for(const f of files){
    st.textContent=`Uploading ${ok+fail+1} of ${files.length}...`;
    const ext=(f.name.match(/\.[a-z0-9]+$/i)||[""])[0].toLowerCase();
    const path=`vault/${target}/${new Date().toISOString().slice(0,10)}-${Math.random().toString(36).slice(2,8)}-${slug(f.name)}${ext}`;
    try{
      const {error}=await api.client.storage.from(BUCKET).upload(path,f,{contentType:f.type||undefined,upsert:false});
      if(error)throw error;
      const r=await api.rpc("owner_vault_add",{p_category:target,p_title:f.name.replace(/\.[a-z0-9]+$/i,"").slice(0,150)||"Untitled",p_path:path,p_mime:f.type||null,p_size:f.size,p_tags:[],p_notes:null});
      if(!r||!r.ok)throw new Error("save");ok++;
    }catch(_){fail++}
  }
  st.textContent=fail?`Saved ${ok}. ${fail} did not upload (check size under 200 MB and file type).`:`Saved ${ok} to ${LABEL[target]}.`;
  await render();
}

function wire(){
  $("#v-cat").addEventListener("change",e=>{cat=e.target.value;render().catch(()=>{})});
  $("#v-file").addEventListener("change",e=>{const fs=[...e.target.files];e.target.value="";if(fs.length)upload(fs).catch(()=>{})});
  $("#v-grid").addEventListener("click",async e=>{
    const fig=e.target.closest(".vtile");if(!fig)return;
    const item=lastItems.find(x=>String(x.id)===fig.dataset.id);
    if(e.target.closest("[data-post]")){const box=fig.querySelector(".vpost");
      if(box.hidden){box.innerHTML=postForm(item);box.hidden=false;fig.classList.add("posting");box.querySelector("[data-cap]").focus()}else{box.hidden=true;fig.classList.remove("posting")}return}
    const g=e.target.closest("[data-go]");
    if(g){if(g.dataset.go==="cancel"){fig.querySelector(".vpost").hidden=true;fig.classList.remove("posting");return}post(fig,item,g.dataset.go).catch(()=>{});return}
    const b=e.target.closest("[data-v]");if(!b)return;
    const id=Number(b.closest("[data-id]").dataset.id);
    if(api.preview){$("#v-status").textContent="Preview only. Nothing was saved.";return}
    b.disabled=true;
    const r=await api.rpc("owner_vault_update",{p_id:id,p_category:null,p_title:null,p_status:b.dataset.v}).catch(()=>null);
    $("#v-status").textContent=r&&r.ok?(b.dataset.v==="approved"?"Approved.":"Archived."):"That did not save. Try again.";
    render().catch(()=>{});
  });
}

window.ACE_VAULT={show:async a=>{api=a;await render()}};
})();
