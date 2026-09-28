(()=>{"use strict";

// ============================================================================
// THE ONLY PLACE A CHECKOUT LINK IS CONFIGURED.
//
// To go live, replace the placeholder below with the real Stripe payment link
// and change nothing else. Until then it stays exactly as written.
//
//        STRIPE_LINK_ACE_MKT = "REPLACE_WITH_LIVE_LINK"
//
// The checkout page refuses to navigate while the value is the placeholder,
// and refuses to navigate while the page's own release flag is held. Both
// conditions must be satisfied before a buy button can send anyone to Stripe.
// ============================================================================

const STRIPE_LINK_ACE_MKT="REPLACE_WITH_LIVE_LINK";

// No price is published anywhere on this site, so none is asserted here.
// "[PRICE]" is a placeholder, not a price.
const PRICE_ACE_MKT="[PRICE]";

const PLACEHOLDER="REPLACE_WITH_LIVE_LINK";

window.ACE_CHECKOUT=Object.freeze({
  links:Object.freeze({"ACE-MKT":STRIPE_LINK_ACE_MKT}),
  prices:Object.freeze({"ACE-MKT":PRICE_ACE_MKT}),
  isConfigured(productKey){
    const link=this.links[productKey];
    return typeof link==="string"&&link.length>0&&link!==PLACEHOLDER;
  }
});

})();
