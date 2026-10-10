(()=>{"use strict";

// Launch-offer waterfall for /checkout/ace-mkt/, shown ONLY when the visitor
// arrives from the Choose Your Demo funnel (?from=demo).
//
// Every figure here is computed from assets/checkout-config.js; nothing is
// hard-coded. This file never touches a buy button, never reads or writes a
// payment link, and never changes the page's release state: checkout.js keeps
// sole ownership of buy-button gating. It only adds/reorders presentation.
//
// Urgency rule: a deadline or countdown renders only when
// assets/demo-config.js LAUNCH_PRICING_ENDS is a real, future date. While it
// is null nothing time-based renders.

const params=new URLSearchParams(location.search);
if(params.get("from")!=="demo")return;

const CHECKOUT=window.ACE_CHECKOUT;
const DEMO=window.ACE_DEMO_CONFIG;
if(!CHECKOUT)return;

const grid=document.querySelector(".offers");
const top=document.getElementById("wfTop");
const bottom=document.getElementById("wfBottom");
if(!grid||!top||!bottom)return;

const money=n=>"$"+Math.round(n).toLocaleString("en-US");

// "<onboarding> onboarding + <monthly>/month" (or "<monthly>/month") -> numbers
const parsePrice=text=>{
  if(typeof text!=="string")return null;
  const monthly=text.match(/\$([\d,]+)\/month/);
  if(!monthly)return null;
  const onboarding=text.match(/\$([\d,]+) onboarding/);
  const num=s=>Number(String(s).replace(/,/g,""));
  return{monthly:num(monthly[1]),onboarding:onboarding?num(onboarding[1]):0};
};

const active=CHECKOUT.offers.filter(o=>!o.contactOnly&&o.standard);

// Exact saving (percent, unrounded) for every charged component of every
// shown offer. The banner may say "more than a third off" ONLY if every one
// of them is above THIRD_OFF_MIN; otherwise it makes no numeric claim.
const THIRD_OFF_MIN=33.34;
const savings=[];
active.forEach(o=>{
  const l=parsePrice(o.launch),s=parsePrice(o.standard);
  if(!l||!s)return;
  if(s.monthly>0)savings.push((1-l.monthly/s.monthly)*100);
  if(s.onboarding>0)savings.push((1-l.onboarding/s.onboarding)*100);
});
const moreThanAThird=savings.length>0&&savings.every(p=>p>THIRD_OFF_MIN);

const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n};

// ---- 1. Banner ----
const banner=el("div","wf-banner");
banner.setAttribute("role","note");
banner.appendChild(el("p","wf-banner-k","From your demo"));
banner.appendChild(el("p","wf-banner-h",moreThanAThird?"Launch pricing: more than a third off standard":"Launch pricing — save vs standard"));
banner.appendChild(el("p","wf-banner-d","Every plan below shows its launch price with the standard price struck through. Your monthly price is locked while you stay subscribed."));
const ends=DEMO&&DEMO.launchPricingEnds?DEMO.launchPricingEnds():null;
if(ends){
  const clock=el("p","wf-clock");
  const date=ends.toLocaleDateString("en-US",{month:"long",day:"numeric",timeZone:"America/New_York"});
  const tick=()=>{
    const ms=ends.getTime()-Date.now();
    if(ms<=0){clock.remove();return}
    const d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5),m=Math.floor(ms%36e5/6e4);
    clock.textContent=`Launch pricing ends ${date} · ${d}d ${h}h ${m}m left`;
  };
  tick();setInterval(tick,30000);
  banner.appendChild(clock);
}
top.appendChild(banner);
top.hidden=false;

// ---- 2. Recommended for you ----
const interests=DEMO&&DEMO.normalizeKeys?DEMO.normalizeKeys(params.get("interests")||""):[];
const recommended=[];
interests.forEach(k=>((DEMO.RECOMMENDED_OFFERS||{})[k]||[]).forEach(key=>{if(!recommended.includes(key))recommended.push(key)}));
const cards={};
grid.querySelectorAll("[data-offer]").forEach(card=>{cards[card.dataset.offer]=card;card.id=card.id||`offer-${card.dataset.offer}`});
const recCards=recommended.map(k=>cards[k]).filter(Boolean);
recCards.slice().reverse().forEach(card=>{
  card.classList.add("wf-rec");
  const badge=el("p","wf-badge","Recommended for you");
  card.insertBefore(badge,card.firstChild);
  grid.insertBefore(card,grid.firstChild);
});
if(recCards.length){
  const titles=interests.map(k=>(DEMO.DEMOS.find(d=>d.key===k)||{}).title).filter(Boolean);
  const note=el("p","wf-recnote",`Recommended from the demos you picked: ${titles.join(", ")}.`);
  top.appendChild(note);
}

// ---- 3. Upsell: the bundle vs buying the two machines separately ----
const bundle=CHECKOUT.offers.find(o=>o.key==="SA-CREATION-DISTRIBUTION");
const partA=CHECKOUT.offers.find(o=>o.key==="SA-CONTENT-CREATION");
const partB=CHECKOUT.offers.find(o=>o.key==="SA-CONTENT-DISTRIBUTION");
const pb=bundle&&parsePrice(bundle.launch),pa=partA&&parsePrice(partA.launch),pd=partB&&parsePrice(partB.launch);
if(pb&&pa&&pd){
  const separate=pa.monthly+pd.monthly;
  const save=separate-pb.monthly;
  if(save>0){
    const card=el("div","wf-upsell");
    card.appendChild(el("p","wf-k","Bundle and save"));
    card.appendChild(el("h2","wf-h",`${bundle.name} saves ${money(save)}/month`));
    card.appendChild(el("p","wf-d",`${partA.name} (${partA.launch}) plus ${partB.name} (${partB.launch}) bought separately is ${money(separate)}/month. Together as ${bundle.name}: ${bundle.launch}.`));
    const go=el("a","wf-link","See the bundle");
    go.href=`#offer-${bundle.key}`;
    card.appendChild(go);
    // Content buyers see the bundle saving up top; everyone else below the plans.
    (interests.includes("content")?top:bottom).appendChild(card);
  }
}

// ---- 4. Downsell: ask a question, or start smaller ----
const firstPayment=o=>{const p=parsePrice(o.launch);return p?p.onboarding+p.monthly:Infinity};
const smallest=active.slice().sort((a,b)=>firstPayment(a)-firstPayment(b))[0];
const down=el("div","wf-down");
down.appendChild(el("p","wf-down-h","Not ready yet?"));
const links=el("div","wf-down-links");
const askQ=new URLSearchParams({ask:"1"});
if(interests.length)askQ.set("interests",interests.join(","));
if(params.get("preview")==="1")askQ.set("preview","1");
const ask=el("a","wf-link wf-link--quiet","Ask a question");
ask.href=`../../?${askQ.toString()}#choose-demo`;
links.appendChild(ask);
if(smallest&&cards[smallest.key]){
  const small=el("a","wf-link wf-link--quiet",`Start smaller: ${smallest.name} at ${smallest.launch}`);
  small.href=`#offer-${smallest.key}`;
  links.appendChild(small);
}
down.appendChild(links);
down.appendChild(el("p","wf-down-d","A representative answers every question within 24 hours."));
bottom.appendChild(down);
bottom.hidden=false;

})();
