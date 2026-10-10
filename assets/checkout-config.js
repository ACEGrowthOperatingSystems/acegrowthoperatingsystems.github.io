(()=>{"use strict";

// ============================================================================
// THE ONLY PLACE CHECKOUT LINKS AND PRICES ARE CONFIGURED.
//
// Prices below are the approved launch prices (ace_v2.price_schedule, approved
// 25 Sep + Amendment 2 28 Sep), shown 35% below the standard price as approved
// 28 Sep. They are display text only; Stripe charges what the payment link says.
//
// To go live, replace each "REPLACE_WITH_LIVE_LINK" with that offer's LIVE
// Stripe payment link and change nothing else. A buy button refuses to
// navigate while its link is the placeholder, while the link is a Stripe TEST
// link (buy.stripe.com/test_...), or while the page's release flag is held.
// ============================================================================

const PLACEHOLDER="REPLACE_WITH_LIVE_LINK";

const OFFERS=[
  {key:"SA-CONTENT-DISTRIBUTION",name:"Content Distribution Machine",launch:"$405/month",standard:"$620/month",credit:"$42",link:PLACEHOLDER},
  {key:"SA-CONTENT-CREATION",name:"Content Creation Machine",launch:"$510/month",standard:"$780/month",credit:"$54",link:PLACEHOLDER},
  {key:"SA-CREATION-DISTRIBUTION",name:"Creation + Distribution",launch:"$815/month",standard:"$1,250/month",credit:"$84",link:PLACEHOLDER},
  {key:"TIER-ESSENTIAL",name:"Essential",launch:"$1,500 onboarding + $810/month",standard:"$2,300 onboarding + $1,240/month",credit:"$78",link:PLACEHOLDER},
  {key:"TIER-PROFESSIONAL",name:"Professional",launch:"$3,500 onboarding + $1,530/month",standard:"$5,380 onboarding + $2,350/month",credit:"$180",link:PLACEHOLDER},
  {key:"TIER-GROWTH",name:"Growth",launch:"$7,500 onboarding + $3,060/month",standard:"$11,530 onboarding + $4,700/month",credit:"$360",link:PLACEHOLDER},
  // Display-only: Enterprise is scoped per organization and sold by contact,
  // never by payment link. contactOnly offers are never "configured", so no
  // buy button can ever navigate for them even if a link is pasted here.
  {key:"TIER-ENTERPRISE",name:"Enterprise",launch:"From $15,000 onboarding + $7,650/month",standard:null,credit:null,link:PLACEHOLDER,contactOnly:true}
];

const links={},prices={},standard={},credit={},names={};
const contactOnly={};
OFFERS.forEach(o=>{links[o.key]=o.link;prices[o.key]=o.launch;names[o.key]=o.name;
  if(o.standard)standard[o.key]=o.standard;if(o.credit)credit[o.key]=o.credit;if(o.contactOnly)contactOnly[o.key]=true;});

window.ACE_CHECKOUT=Object.freeze({
  offers:Object.freeze(OFFERS.map(o=>Object.freeze({...o}))),
  links:Object.freeze(links),
  prices:Object.freeze(prices),
  standard:Object.freeze(standard),
  credit:Object.freeze(credit),
  names:Object.freeze(names),
  contactOnly:Object.freeze(contactOnly),
  isConfigured(productKey){
    if(this.contactOnly[productKey])return false;
    const link=this.links[productKey];
    return typeof link==="string"&&link.length>0&&link!==PLACEHOLDER
      &&/^https:\/\/buy\.stripe\.com\//.test(link)&&!/^https:\/\/buy\.stripe\.com\/test_/.test(link);
  }
});

})();
