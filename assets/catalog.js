(()=>{"use strict";

// /catalog/ renderer. Two independent gates must both be open before a Buy
// button navigates: this page's release flag is exactly RELEASED, and the
// offer has a LIVE buy.stripe.com link in assets/catalog-config.js.
// Either closed: the button is inert and says why. No network calls here.

const cat=window.ACE_CATALOG;
const released=Boolean(window.ACE_RELEASE&&window.ACE_RELEASE.isReleased());
const root=document.getElementById("catalogRoot");
const status=document.getElementById("checkoutStatus");
const HELD="Checkout is not open. This page is held pending release authorization and no payment can be taken.";
const NOLINK="Checkout is not open. No payment link is configured for this plan yet.";
if(!cat||!root)return;

const DEMOS={pipeline:"../assets/demos/pipeline.mp4",content:"../assets/demos/content.mp4",
  followup:"../assets/demos/followup.mp4",proposal:"../assets/demos/proposal.mp4",growth:"../assets/demos/growth.mp4"};
const FAMILIES=[["A LA CARTE","A la carte"],["LEAD GENERATOR","ACE Lead Generator"],["OPERATING SYSTEM","Operating systems"],["CREDIT PACK","Usage top-ups"]];

const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
const usd=cat.usd;

const priceLine=l=>{
  if(l.plan==="TOPUP")return usd(l.monthlyFounding)+" one time";
  const m=usd(l.monthlyFounding)+"/month";
  return l.setupFounding?usd(l.setupFounding)+" setup + "+m:m+", no setup fee";
};
const standardLine=l=>{
  if(l.plan==="TOPUP"||(l.setupStandard===l.setupFounding&&l.monthlyStandard===l.monthlyFounding))return "";
  const m=usd(l.monthlyStandard)+"/month";
  return "Standard price "+(l.setupStandard?usd(l.setupStandard)+" setup + "+m:m);
};

const groups={};
cat.lines.forEach(l=>{(groups[l.family]=groups[l.family]||{});(groups[l.family][l.product]=groups[l.family][l.product]||[]).push(l);});

FAMILIES.forEach(([fam,label])=>{
  if(!groups[fam])return;
  const sec=el("section","cat-family");sec.appendChild(el("h2",null,label));
  Object.entries(groups[fam]).forEach(([product,lines])=>{
    const card=el("article","checkout cat-product");
    card.appendChild(el("h3",null,product));
    card.appendChild(el("p","small",lines[0].description));
    const list=el("div","cat-lines");
    lines.forEach(l=>{
      const row=el("div","cat-line");row.dataset.offer=l.key;
      const name=[l.tier,l.plan==="DFY"?"Done for you":l.plan==="TOPUP"?null:l.plan].filter(Boolean).join(" · ");
      if(name)row.appendChild(el("p","cat-tier",name));
      row.appendChild(el("p","price",priceLine(l)));
      const std=standardLine(l);if(std){const s=el("p","small");s.appendChild(el("s",null,std));row.appendChild(s);}
      if(l.includedCredit)row.appendChild(el("p","small","Includes a "+usd(l.includedCredit)+" monthly usage credit."));
      const actions=el("div","buy-row");
      if(l.demo&&DEMOS[l.demo]){const d=el("button","button button-ghost","Demo");d.type="button";d.dataset.demo=l.demo;actions.appendChild(d);}
      if(l.buyable){
        const b=el("button","button","Add to cart");b.type="button";b.dataset.buy=l.key;
        const open=released&&cat.isConfigured(l.key);
        b.setAttribute("aria-disabled",open?"false":"true");
        if(!open)b.dataset.inertReason=!released?"RELEASE_HELD":"LINK_PLACEHOLDER";
        b.addEventListener("click",e=>{
          if(!open){e.preventDefault();if(status)status.textContent=!released?HELD:NOLINK;return;}
          window.location.assign(cat.get(l.key).link);
        });
        actions.appendChild(b);
      }else{
        actions.appendChild(el("p","small","Buy from your My ACE account."));
      }
      row.appendChild(actions);list.appendChild(row);
    });
    card.appendChild(list);sec.appendChild(card);
  });
  root.appendChild(sec);
});

// Demo player (page-local; assets already on the site).
const dlg=document.getElementById("demoDialog"),vid=document.getElementById("demoVideo");
document.addEventListener("click",e=>{
  const t=e.target.closest("[data-demo]");if(!t||!dlg||!vid)return;
  vid.src=DEMOS[t.dataset.demo];vid.poster=DEMOS[t.dataset.demo].replace(".mp4","-poster.jpg");
  if(typeof dlg.showModal==="function")dlg.showModal();vid.play().catch(()=>{});
});
if(dlg)dlg.addEventListener("close",()=>{vid.pause();});

// Tabs.
const tabs=[...document.querySelectorAll('[role="tab"]')];
const select=tab=>{tabs.forEach(t=>{const on=t===tab;t.setAttribute("aria-selected",String(on));t.tabIndex=on?0:-1;
  document.getElementById(t.getAttribute("aria-controls")).hidden=!on;});};
tabs.forEach(t=>t.addEventListener("click",()=>select(t)));

if(status&&!released)status.textContent=HELD;
})();
