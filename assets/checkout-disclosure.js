(()=>{"use strict";
// Billing disclosure + required acknowledgement for /checkout/ pages.
// Wording: DRAFT FOR JIM APPROVAL (ledger thread CHECKOUT-DISCLOSURE-20261014,
// ChatGPT MSG-13188 reviewed and corrected by Claude). Facts come only from
// Jim's decisions of 12 Oct 2026: onboarding/refund terms (3.07), automated
// onboarding flow and credit pause rule with lead-reply overdraft (3.03).
// Kept in JS (not the HTML) so no dollar figure is hard-coded in the page.
const D=window.ACE_DISCLOSURE={
  bullets:[
    "The setup fee is charged today, as setup starts at checkout.",
    "Your monthly plan starts on first delivery.",
    "Every plan has a 3-month minimum, then month to month.",
    "Usage credit top-ups are $20, $50 or $100.",
    "You get an alert at 80% of your credit. At 100%, work pauses except replies to new leads, which continue on an overdraft of up to 10% of your monthly credit, billed on your next bill.",
    "Onboarding starts when you submit the onboarding questionnaire. No refunds after onboarding starts."
  ],
  leadGenerator:"Lead Generator: new sending mailboxes need 14 to 21 days to warm up. Your monthly plan starts at first send.",
  ackLabel:"I understand the setup fee is charged today, the monthly plan starts on first delivery, there is a 3-month minimum, and there are no refunds after onboarding starts.",
  autoTopUpLabel:"Add $20 of credit automatically when my usage credit runs out."
};
const box=document.getElementById("billingDisclosure");
if(!box)return;
const h=document.createElement("h2");h.textContent="Before you pay";box.appendChild(h);
const ul=document.createElement("ul");
D.bullets.forEach(t=>{const li=document.createElement("li");li.textContent=t;ul.appendChild(li);});
box.appendChild(ul);
if(document.body.dataset.productKey==="ACE-LEADGEN"){const p=document.createElement("p");p.className="small";p.textContent=D.leadGenerator;box.appendChild(p);}
const label=document.createElement("label");label.className="ack";
const cb=document.createElement("input");cb.type="checkbox";cb.id="billingAck";cb.required=true;
label.appendChild(cb);label.appendChild(document.createTextNode(" "+D.ackLabel));
box.appendChild(label);
// Auto top-up opt-in is rendered only once it is wired to Stripe (flag below).
if(window.ACE_CHECKOUT&&window.ACE_CHECKOUT.autoTopUpWired===true){
  const l2=document.createElement("label");l2.className="ack";
  const c2=document.createElement("input");c2.type="checkbox";c2.id="autoTopUp";
  l2.appendChild(c2);l2.appendChild(document.createTextNode(" "+D.autoTopUpLabel));box.appendChild(l2);
}
box.hidden=false;
})();
