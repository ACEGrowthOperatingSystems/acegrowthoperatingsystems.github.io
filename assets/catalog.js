(()=>{"use strict";

// /catalog/ renderer: a pricing page with a product-family selector, tier
// cards side by side and a checklist per tier.
//
// Two independent gates must both be open before an Add to cart button
// navigates: this page's release flag is exactly RELEASED, and the offer has
// a LIVE buy.stripe.com link in assets/catalog-config.js. Either closed: the
// button is inert and says why. No network calls here.
//
// Lead Generator add-ons are rendered only when ACE_CATALOG.ADDONS_APPROVED
// is true. A line still marked pending shows "Pending approval" and no buy
// button. Prices come only from assets/catalog-config.js.
//
// Checklist wording is limited to approved capability claims and plan terms
// already in the catalog. Do not add volumes, features or promises here.

const cat=window.ACE_CATALOG;
const released=Boolean(window.ACE_RELEASE&&window.ACE_RELEASE.isReleased());
const root=document.getElementById("catalogRoot");
const status=document.getElementById("checkoutStatus");
const HELD="Checkout is not open. This page is held pending release authorization and no payment can be taken.";
const NOLINK="Checkout is not open. No payment link is configured for this plan yet.";
if(!cat||!root)return;

const DEMOS={pipeline:"../assets/demos/pipeline.mp4",content:"../assets/demos/content.mp4",
  followup:"../assets/demos/followup.mp4",proposal:"../assets/demos/proposal.mp4",growth:"../assets/demos/growth.mp4"};
const FOUNDING_NOTE="Founding Member Rate until March 1, 2027";
const usd=cat.usd;

// Approved capability claims only (see the header comment).
const C={
  answers:"Answers new leads within minutes",
  proposals:"Sends proposals",
  books:"Follows up and books calls",
  social:"Schedules your social posts",
  lists:"Builds prospect lists",
  phone:"You approve from your phone"
};
const CAPS={
  "Automated Content Creation":[],
  "Automated Social Marketing":[C.social],
  "Automated Lead Generation":[C.answers,C.books],
  "Automated Prospecting Machine":[C.lists],
  "ACE Lead Generator":[C.lists,C.books],
  "Prospecting Autopilot OS":[C.lists,C.books],
  "Social Media Marketing OS":[C.social],
  "Customer Acquisition OS":[C.answers,C.books],
  "Growth Autopilot OS":[C.answers,C.proposals,C.books,C.social,C.lists]
};
// Capabilities a higher tier adds, as written in the approved catalog doc.
const TIER_CAPS={"L21-CUSTOMER-ACQUISITION-OS-PRO":[C.proposals]};

const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
const isDIY=l=>/^DIY/.test(l.plan);
const isLG=l=>l.family==="LEAD GENERATOR";
const hasFounding=l=>l.setupStandard!==l.setupFounding||l.monthlyStandard!==l.monthlyFounding;
const planLabel=l=>isDIY(l)?"Do it yourself":"Done for you";
const diyDetail=l=>{const m=/^DIY \((.+)\)$/.exec(l.plan);return m?m[1]:null;};

// Plan terms for the first tier (or for each a la carte plan).
const baseTerms=l=>{
  const t=[];
  if(isDIY(l)){t.push("No setup fee");t.push("Billed monthly from checkout");}
  else if(isLG(l)){t.push("Sending mailboxes warm up for 14-21 days before the first send");t.push("Monthly plan starts at the first send");}
  else t.push("Monthly plan starts at your first delivery");
  t.push("3-month minimum");
  return t;
};

// Checklist: {heading, items}. Higher tiers say "Everything in <previous>, plus:".
const checklist=(l,prev)=>{
  const facts=[...cat.tierFacts(l.key)];
  if(!prev){
    const items=[...facts,...(CAPS[l.product]||[])];
    if(!isDIY(l))items.push(C.phone);
    if(isDIY(l)&&diyDetail(l)&&!facts.length)items.push(diyDetail(l));
    return {heading:"What's included:",items:[...items,...baseTerms(l)]};
  }
  const items=[...facts,...(TIER_CAPS[l.key]||[])];
  if(l.includedCredit)items.push("Larger monthly usage credit: "+usd(l.includedCredit));
  return {heading:"Everything in "+prev.tier+", plus:",items};
};

// Builds the price block. Every number here comes straight from the config.
const priceBlock=l=>{
  const box=el("div","tier-price");
  const big=el("p","price-big");
  const amt=el("span","price-amt",usd(l.monthlyFounding));amt.dataset.field="monthlyFounding";
  big.appendChild(amt);big.appendChild(el("span","price-per","/month"));
  box.appendChild(big);
  if(l.monthlyStandard!==l.monthlyFounding){
    const s=el("p","price-std");s.appendChild(el("span",null,"Standard "));
    const st=el("s",null,usd(l.monthlyStandard)+"/month");st.dataset.field="monthlyStandard";s.appendChild(st);box.appendChild(s);
  }
  const setup=el("p","price-setup");
  if(l.setupFounding){
    const sf=el("span",null,usd(l.setupFounding));sf.dataset.field="setupFounding";
    setup.appendChild(el("span",null,"+ "));setup.appendChild(sf);setup.appendChild(el("span",null," one-time setup"));
    if(l.setupStandard!==l.setupFounding){
      setup.appendChild(el("span",null," (Standard "));
      const ss=el("s",null,usd(l.setupStandard));ss.dataset.field="setupStandard";setup.appendChild(ss);
      setup.appendChild(el("span",null,")"));
    }
  }else{
    const sf=el("span",null,"$0");sf.dataset.field="setupFounding";
    setup.appendChild(sf);setup.appendChild(el("span",null," setup"));
  }
  box.appendChild(setup);
  if(hasFounding(l))box.appendChild(el("p","founding-note",FOUNDING_NOTE));
  const credit=el("p","price-credit");
  if(l.includedCredit){
    credit.appendChild(el("span",null,"Includes "));
    const c=el("strong",null,usd(l.includedCredit));c.dataset.field="includedCredit";credit.appendChild(c);
    credit.appendChild(el("span",null," monthly usage credit"));
  }else credit.textContent="No included usage credit";
  box.appendChild(credit);
  return box;
};

const buyButton=l=>{
  const b=el("button","button tier-buy","Add to cart");b.type="button";b.dataset.buy=l.key;
  const open=released&&l.buyable===true&&cat.isConfigured(l.key);
  b.setAttribute("aria-disabled",open?"false":"true");
  if(!open)b.dataset.inertReason=!released?"RELEASE_HELD":"LINK_PLACEHOLDER";
  b.addEventListener("click",e=>{
    if(!open){e.preventDefault();if(status)status.textContent=!released?HELD:NOLINK;return;}
    window.location.assign(cat.get(l.key).link);
  });
  return b;
};
const demoButton=l=>{
  if(!l.demo||!DEMOS[l.demo])return null;
  const d=el("button","button button-ghost tier-demo","Watch demo");d.type="button";d.dataset.demo=l.demo;
  d.setAttribute("aria-label","Watch the "+l.product+" demo");
  return d;
};

const listBlock=cl=>{
  const wrap=el("div","tier-list");
  wrap.appendChild(el("p","tier-list-head",cl.heading));
  const ul=el("ul","checklist");
  cl.items.forEach(t=>ul.appendChild(el("li",null,t)));
  wrap.appendChild(ul);return wrap;
};

// One tier card's body (price, buttons, checklist) for line l.
const tierBody=(l,prev)=>{
  const body=el("div","tier-body");body.dataset.offer=l.key;
  body.appendChild(priceBlock(l));
  const actions=el("div","tier-actions");
  if(l.buyable===true)actions.appendChild(buyButton(l));
  const d=demoButton(l);if(d)actions.appendChild(d);
  body.appendChild(actions);
  body.appendChild(listBlock(checklist(l,prev)));
  return body;
};

let uid=0;
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

// Tiered product: header + grid of tier cards.
const tieredProduct=(product,lines)=>{
  const sec=el("section","cat-product");sec.id="p-"+slug(product);
  const head=el("div","product-head");
  head.appendChild(el("h3",null,product));
  head.appendChild(el("p","small",lines[0].description));
  sec.appendChild(head);
  const grid=el("div","tier-grid");grid.dataset.count=String(lines.length);
  lines.forEach((l,i)=>{
    const card=el("article","tier-card");
    const rec=lines.length>=3&&i===1;
    if(rec){card.classList.add("is-recommended");card.appendChild(el("p","tier-badge","Recommended"));}
    const h=el("h4","tier-name",l.tier);h.id="t-"+(++uid);card.appendChild(h);
    card.setAttribute("aria-labelledby",h.id);
    card.appendChild(tierBody(l,i?lines[i-1]:null));
    grid.appendChild(card);
  });
  sec.appendChild(grid);
  return sec;
};

// A la carte product: one card with a Done-for-you / DIY toggle.
const alacarteCard=(product,lines)=>{
  const card=el("article","tier-card alc-card");
  const h=el("h3","tier-name",product);h.id="t-"+(++uid);card.appendChild(h);
  card.setAttribute("aria-labelledby",h.id);
  card.appendChild(el("p","small alc-desc",lines[0].description));
  const group=el("div","plan-toggle");group.setAttribute("role","group");group.setAttribute("aria-label","Plan type for "+product);
  const bodies=[],btns=[];
  lines.forEach((l,i)=>{
    const b=el("button","toggle-btn",isDIY(l)?"DIY":"Done for you");b.type="button";
    b.setAttribute("aria-pressed",i===0?"true":"false");b.dataset.plan=isDIY(l)?"diy":"dfy";
    const body=tierBody(l,null);body.hidden=i!==0;body.id="b-"+(++uid);
    b.setAttribute("aria-controls",body.id);
    body.insertBefore(el("p","plan-label",planLabel(l)),body.firstChild);
    btns.push(b);bodies.push(body);group.appendChild(b);
  });
  btns.forEach((b,i)=>b.addEventListener("click",()=>{
    btns.forEach((x,j)=>x.setAttribute("aria-pressed",String(i===j)));
    bodies.forEach((x,j)=>{x.hidden=i!==j;});
  }));
  card.appendChild(group);
  bodies.forEach(b=>card.appendChild(b));
  return card;
};

const groupBy=(fam)=>{
  const g={};cat.lines.filter(l=>l.family===fam).forEach(l=>{(g[l.product]=g[l.product]||[]).push(l);});return g;
};
const panel=id=>document.getElementById(id);

// ---- A la carte ----
const pAlc=panel("panel-alacarte");
if(pAlc){
  pAlc.appendChild(el("p","panel-intro","One job, automated. Pick Done for you, or DIY with no setup fee."));
  const grid=el("div","tier-grid alc-grid");const g=groupBy("A LA CARTE");
  grid.dataset.count=String(Object.keys(g).length);
  Object.entries(g).forEach(([p,ls])=>grid.appendChild(alacarteCard(p,ls)));
  pAlc.appendChild(grid);
}

// ---- Lead Generator (+ add-ons, only when approved) ----
const pLG=panel("panel-leadgen");
if(pLG){
  Object.entries(groupBy("LEAD GENERATOR")).forEach(([p,ls])=>pLG.appendChild(tieredProduct(p,ls)));
  const addons=cat.lines.filter(l=>l.family==="LEAD GENERATOR ADD-ON");
  if(cat.ADDONS_APPROVED===true&&addons.length){
    const sec=el("section","cat-product addons");sec.id="addons";sec.dataset.addons="shown";
    const head=el("div","product-head");
    head.appendChild(el("h3",null,"Lead Generator add-ons"));
    head.appendChild(el("p","small","Add these to an ACE Lead Generator plan."));
    sec.appendChild(head);
    const grid=el("div","tier-grid");grid.dataset.count=String(addons.length);
    addons.forEach(l=>{
      const card=el("article","tier-card addon-card");card.dataset.addon=l.key;
      const h=el("h4","tier-name",l.tier?l.product+" ("+l.tier+")":l.product);h.id="t-"+(++uid);card.appendChild(h);card.setAttribute("aria-labelledby",h.id);
      const body=el("div","tier-body");body.dataset.offer=l.key;
      body.appendChild(priceBlock(l));
      body.appendChild(el("p","small",l.description));
      if(l.buyable===true&&!l.pending){const a=el("div","tier-actions");a.appendChild(buyButton(l));body.appendChild(a);}
      else body.appendChild(el("p","addon-pending","Pending approval"));
      card.appendChild(body);grid.appendChild(card);
    });
    sec.appendChild(grid);pLG.appendChild(sec);
  }
}

// ---- Operating systems ----
const pOS=panel("panel-os");
if(pOS){
  const g=groupBy("OPERATING SYSTEM");
  const jump=el("nav","os-jump");jump.setAttribute("aria-label","Operating systems");
  Object.keys(g).forEach(p=>{const a=el("a",null,p);a.href="#p-"+slug(p);jump.appendChild(a);});
  pOS.appendChild(jump);
  Object.entries(g).forEach(([p,ls])=>pOS.appendChild(tieredProduct(p,ls)));
}

// ---- Top-ups (bought in My ACE, never here) ----
const pTop=panel("panel-topups");
if(pTop){
  pTop.appendChild(el("p","panel-intro","Need more usage credit? Top up any time from your My ACE account."));
  const grid=el("div","tier-grid topup-grid");const ls=cat.lines.filter(l=>l.family==="CREDIT PACK");grid.dataset.count=String(ls.length);
  ls.forEach(l=>{
    const card=el("article","tier-card topup-card");
    const h=el("h3","tier-name",l.product);h.id="t-"+(++uid);card.appendChild(h);card.setAttribute("aria-labelledby",h.id);
    const body=el("div","tier-body");body.dataset.offer=l.key;
    const big=el("p","price-big");const amt=el("span","price-amt",usd(l.monthlyFounding));amt.dataset.field="monthlyFounding";
    big.appendChild(amt);big.appendChild(el("span","price-per"," one time"));body.appendChild(big);
    body.appendChild(el("p","small",l.description));
    body.appendChild(el("p","small topup-where","Buy from your My ACE account."));
    card.appendChild(body);grid.appendChild(card);
  });
  pTop.appendChild(grid);
}

// Demo player (page-local; assets already on the site).
const dlg=document.getElementById("demoDialog"),vid=document.getElementById("demoVideo");
document.addEventListener("click",e=>{
  const t=e.target&&e.target.closest?e.target.closest("[data-demo]"):null;if(!t||!dlg||!vid)return;
  vid.src=DEMOS[t.dataset.demo];vid.poster=DEMOS[t.dataset.demo].replace(".mp4","-poster.jpg");
  if(typeof dlg.showModal==="function")dlg.showModal();vid.play().catch(()=>{});
});
if(dlg)dlg.addEventListener("close",()=>{vid.pause();});

// Tabs: product-family selector + "How pricing works". Arrow keys, Home, End.
const tablist=document.getElementById("familyTabs");
const tabs=tablist?[...tablist.querySelectorAll('[role="tab"]')]:[];
const select=(tab,focus)=>{tabs.forEach(t=>{const on=t===tab;t.setAttribute("aria-selected",String(on));t.tabIndex=on?0:-1;
  const p=document.getElementById(t.getAttribute("aria-controls"));if(p)p.hidden=!on;});
  if(focus)tab.focus();};
tabs.forEach((t,i)=>{
  t.addEventListener("click",()=>select(t,false));
  t.addEventListener("keydown",e=>{
    const k=e.key;let n=null;
    if(k==="ArrowRight"||k==="ArrowDown")n=tabs[(i+1)%tabs.length];
    else if(k==="ArrowLeft"||k==="ArrowUp")n=tabs[(i-1+tabs.length)%tabs.length];
    else if(k==="Home")n=tabs[0];else if(k==="End")n=tabs[tabs.length-1];
    if(n){e.preventDefault();select(n,true);}
  });
});
// Deep link: /catalog/#os (or any panel's short name) opens that family.
const HASH={alacarte:"tab-alacarte",leadgen:"tab-leadgen",os:"tab-os",topups:"tab-topups",pricing:"tab-pricing"};
const h=(window.location&&window.location.hash||"").replace("#","");
if(HASH[h]){const t=document.getElementById(HASH[h]);if(t)select(t,false);}

if(status&&!released)status.textContent=HELD;
})();
