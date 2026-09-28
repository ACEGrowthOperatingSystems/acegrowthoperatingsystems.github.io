(()=>{"use strict";

// Buy-button behaviour for the checkout path. Two independent gates must both
// be open before a button navigates anywhere:
//   1. this page's own release flag (assets/release-flag.js) must be RELEASED
//   2. the checkout link (assets/checkout-config.js) must no longer be the
//      REPLACE_WITH_LIVE_LINK placeholder
// Either one closed means the button is inert and says why. There is no path
// through this file that reaches Stripe while either gate is closed.

const released=Boolean(window.ACE_RELEASE&&window.ACE_RELEASE.isReleased());
const config=window.ACE_CHECKOUT;
const status=document.getElementById("checkoutStatus");

const HELD_NOTICE="Checkout is not open. This page is held pending release authorization and no payment can be taken.";
const UNCONFIGURED_NOTICE="Checkout is not open. No payment link is configured for this offer.";

document.querySelectorAll("[data-buy]").forEach(button=>{
  const productKey=button.dataset.buy;
  const configured=Boolean(config&&config.isConfigured(productKey));
  const open=released&&configured;

  button.setAttribute("aria-disabled",open?"false":"true");
  if(!open)button.setAttribute("data-inert-reason",!released?"RELEASE_HELD":"LINK_PLACEHOLDER");

  button.addEventListener("click",event=>{
    if(!open){
      event.preventDefault();
      if(status)status.textContent=!released?HELD_NOTICE:UNCONFIGURED_NOTICE;
      return;
    }
    window.location.assign(config.links[productKey]);
  });
});

// Fill the price from the single config spot rather than hard-coding it in the
// page, so there is exactly one place a price can ever be set.
document.querySelectorAll("[data-price-for]").forEach(node=>{
  const key=node.dataset.priceFor;
  const price=config&&config.prices?config.prices[key]:null;
  node.textContent=price||"[PRICE]";
});

if(status&&!released)status.textContent=HELD_NOTICE;

})();
