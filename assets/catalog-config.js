(()=>{"use strict";

// ============================================================================
// ACE LAUNCH CATALOG (20 Oct 2026). THE ONLY PLACE /catalog/ PRICES AND LINKS
// ARE CONFIGURED.
//
// Source: ace_v2.launch_catalog_20261020 (28 lines), approved by Jim
// 12 Oct 2026 19:46Z (jim_decisions 5.09 APPROVED LAUNCH CATALOG; 3.03 FINAL;
// 3.03 CREDIT PAUSE RULE 19:49Z). Offer keys match
// ace_v2.checkout_offers_launch_20261020 / stripe_checkout_links_launch.
// Prices are whole US dollars and are display text only: Stripe charges
// what the payment link says.
//
// To go live: replace each "REPLACE_WITH_LIVE_LINK" with that offer's LIVE
// Stripe payment link (buy.stripe.com/..., never buy.stripe.com/test_...).
// A button stays inert while its link is the placeholder, a TEST link, or
// not a buy.stripe.com link, or while the page release flag is held.
// Usage top-ups (lines 26-28) are bought inside My ACE, never here.
// Lead Generator add-ons (A01, A02) are pending approval and never buyable here.
// ============================================================================

const PLACEHOLDER="REPLACE_WITH_LIVE_LINK";
const FOUNDING_RATE_ENDS="2027-03-01T00:00:00-05:00";

const LINES=[
  {"line":1,"key":"L01-AUTOMATED-CONTENT-CREATION","family":"A LA CARTE","product":"Automated Content Creation","tier":null,"plan":"DFY","setupFounding":495,"setupStandard":695,"monthlyFounding":149,"monthlyStandard":199,"includedCredit":30,"demo":"content","description":"Your social posts prepared for you. You approve from your phone before anything goes out.","buyable":true,"link":"https://buy.stripe.com/28EdRbep6fS2axs5ILak00c"},
  {"line":2,"key":"L02-AUTOMATED-CONTENT-CREATION-DIY","family":"A LA CARTE","product":"Automated Content Creation","tier":null,"plan":"DIY (10 posts)","setupFounding":0,"setupStandard":0,"monthlyFounding":49,"monthlyStandard":49,"includedCredit":null,"demo":"content","description":"Your social posts prepared for you. You approve from your phone before anything goes out.","buyable":true,"link":"https://buy.stripe.com/3cI7sNgxeeNY7lg9Z1ak00m"},
  {"line":3,"key":"L03-AUTOMATED-SOCIAL-MARKETING","family":"A LA CARTE","product":"Automated Social Marketing","tier":null,"plan":"DFY","setupFounding":495,"setupStandard":795,"monthlyFounding":229,"monthlyStandard":249,"includedCredit":54,"demo":"content","description":"Schedules your social posts. You approve from your phone first.","buyable":true,"link":"https://buy.stripe.com/3cIaEZ5SAcFQ20Wgnpak00k"},
  {"line":4,"key":"L04-AUTOMATED-SOCIAL-MARKETING-DIY","family":"A LA CARTE","product":"Automated Social Marketing","tier":null,"plan":"DIY","setupFounding":0,"setupStandard":0,"monthlyFounding":99,"monthlyStandard":99,"includedCredit":null,"demo":"content","description":"Schedules your social posts. You approve from your phone first.","buyable":true,"link":"https://buy.stripe.com/aFa3cxftadJUgVQ6MPak00o"},
  {"line":5,"key":"L05-AUTOMATED-LEAD-GENERATION","family":"A LA CARTE","product":"Automated Lead Generation","tier":null,"plan":"DFY","setupFounding":695,"setupStandard":895,"monthlyFounding":219,"monthlyStandard":299,"includedCredit":48,"demo":"followup","description":"Answers new leads within minutes, follows up and books calls.","buyable":true,"link":"https://buy.stripe.com/14A28tgxe0X8dJE0orak00a"},
  {"line":6,"key":"L06-AUTOMATED-LEAD-GENERATION-DIY","family":"A LA CARTE","product":"Automated Lead Generation","tier":null,"plan":"DIY (email only, 1 form)","setupFounding":0,"setupStandard":0,"monthlyFounding":99,"monthlyStandard":99,"includedCredit":null,"demo":"followup","description":"Answers new leads within minutes, follows up and books calls.","buyable":true,"link":"https://buy.stripe.com/4gM4gB4Ow35g0WS4EHak00n"},
  {"line":7,"key":"L07-AUTOMATED-PROSPECTING-MACHINE","family":"A LA CARTE","product":"Automated Prospecting Machine","tier":null,"plan":"DFY","setupFounding":795,"setupStandard":1195,"monthlyFounding":399,"monthlyStandard":449,"includedCredit":150,"demo":"pipeline","description":"Builds prospect lists for your business.","buyable":true,"link":"https://buy.stripe.com/8x200lftadJUbBw0orak006"},
  {"line":8,"key":"L08-AUTOMATED-PROSPECTING-MACHINE-DIY","family":"A LA CARTE","product":"Automated Prospecting Machine","tier":null,"plan":"DIY (250 prospects)","setupFounding":0,"setupStandard":0,"monthlyFounding":99,"monthlyStandard":99,"includedCredit":null,"demo":"pipeline","description":"Builds prospect lists for your business.","buyable":true,"link":"https://buy.stripe.com/28E9AV3KsbBMcFA1svak00l"},
  {"line":9,"key":"L09-ACE-LEAD-GENERATOR-IGNITE","family":"LEAD GENERATOR","product":"ACE Lead Generator","tier":"Ignite","plan":"DFY","setupFounding":499,"setupStandard":499,"monthlyFounding":497,"monthlyStandard":697,"includedCredit":null,"demo":"pipeline","description":"Builds prospect lists, follows up and books calls. New sending mailboxes need 14-21 days to warm up before the first send; your monthly plan starts at the first send.","buyable":true,"link":"https://buy.stripe.com/9B66oJ4Ow0X84943ADak007"},
  {"line":10,"key":"L10-ACE-LEAD-GENERATOR-ACCELERATE","family":"LEAD GENERATOR","product":"ACE Lead Generator","tier":"Accelerate","plan":"DFY","setupFounding":749,"setupStandard":749,"monthlyFounding":1097,"monthlyStandard":1397,"includedCredit":null,"demo":"pipeline","description":"Builds prospect lists, follows up and books calls. New sending mailboxes need 14-21 days to warm up before the first send; your monthly plan starts at the first send.","buyable":true,"link":"https://buy.stripe.com/7sYdRb80IfS23501svak00f"},
  {"line":11,"key":"L11-ACE-LEAD-GENERATOR-FULL-THROTTLE","family":"LEAD GENERATOR","product":"ACE Lead Generator","tier":"Full Throttle","plan":"DFY","setupFounding":999,"setupStandard":999,"monthlyFounding":1997,"monthlyStandard":2497,"includedCredit":null,"demo":"pipeline","description":"Builds prospect lists, follows up and books calls. New sending mailboxes need 14-21 days to warm up before the first send; your monthly plan starts at the first send.","buyable":true,"link":"https://buy.stripe.com/bJedRb1CkgW6fRMc79ak000"},
  {"line":12,"key":"L12-ACE-LEAD-GENERATOR-REDLINE","family":"LEAD GENERATOR","product":"ACE Lead Generator","tier":"Redline","plan":"DFY","setupFounding":1249,"setupStandard":1249,"monthlyFounding":2997,"monthlyStandard":3497,"includedCredit":null,"demo":"pipeline","description":"Builds prospect lists, follows up and books calls. New sending mailboxes need 14-21 days to warm up before the first send; your monthly plan starts at the first send.","buyable":true,"link":"https://buy.stripe.com/dRmbJ35SA8pA8pk6MPak00e"},
  {"line":13,"key":"L13-PROSPECTING-AUTOPILOT-OS-IGNITE","family":"OPERATING SYSTEM","product":"Prospecting Autopilot OS","tier":"Ignite","plan":"DFY","setupFounding":895,"setupStandard":1295,"monthlyFounding":799,"monthlyStandard":999,"includedCredit":150,"demo":"pipeline","description":"Builds prospect lists, follows up and books calls. You approve from your phone.","buyable":true,"link":"https://buy.stripe.com/4gM28t2Go5dofRM2wzak00g"},
  {"line":14,"key":"L14-PROSPECTING-AUTOPILOT-OS-ACCELERATE","family":"OPERATING SYSTEM","product":"Prospecting Autopilot OS","tier":"Accelerate","plan":"DFY","setupFounding":1095,"setupStandard":1495,"monthlyFounding":1299,"monthlyStandard":1599,"includedCredit":225,"demo":"pipeline","description":"Builds prospect lists, follows up and books calls. You approve from your phone.","buyable":true,"link":"https://buy.stripe.com/eVqbJ394M0X8eNIgnpak005"},
  {"line":15,"key":"L15-PROSPECTING-AUTOPILOT-OS-FULL-THROTTLE","family":"OPERATING SYSTEM","product":"Prospecting Autopilot OS","tier":"Full Throttle","plan":"DFY","setupFounding":1395,"setupStandard":1995,"monthlyFounding":2099,"monthlyStandard":2599,"includedCredit":325,"demo":"pipeline","description":"Builds prospect lists, follows up and books calls. You approve from your phone.","buyable":true,"link":"https://buy.stripe.com/aFa5kF0yg0X8bBw9Z1ak00i"},
  {"line":16,"key":"L16-PROSPECTING-AUTOPILOT-OS-REDLINE","family":"OPERATING SYSTEM","product":"Prospecting Autopilot OS","tier":"Redline","plan":"DFY","setupFounding":1795,"setupStandard":2495,"monthlyFounding":2999,"monthlyStandard":3699,"includedCredit":450,"demo":"pipeline","description":"Builds prospect lists, follows up and books calls. You approve from your phone.","buyable":true,"link":"https://buy.stripe.com/7sY4gB3Ks35geNIefhak002"},
  {"line":17,"key":"L17-SOCIAL-MEDIA-MARKETING-OS-STARTER","family":"OPERATING SYSTEM","product":"Social Media Marketing OS","tier":"Starter","plan":"DFY","setupFounding":795,"setupStandard":1195,"monthlyFounding":349,"monthlyStandard":429,"includedCredit":75,"demo":"content","description":"Schedules your social posts across your channels. You approve from your phone.","buyable":true,"link":"https://buy.stripe.com/00w8wRep60X8gVQc79ak001"},
  {"line":18,"key":"L18-SOCIAL-MEDIA-MARKETING-OS-PRO","family":"OPERATING SYSTEM","product":"Social Media Marketing OS","tier":"Pro","plan":"DFY","setupFounding":1295,"setupStandard":1795,"monthlyFounding":599,"monthlyStandard":699,"includedCredit":150,"demo":"content","description":"Schedules your social posts across your channels. You approve from your phone.","buyable":true,"link":"https://buy.stripe.com/28E14pdl235g8pk6MPak00d"},
  {"line":19,"key":"L19-SOCIAL-MEDIA-MARKETING-OS-SCALE","family":"OPERATING SYSTEM","product":"Social Media Marketing OS","tier":"Scale","plan":"DFY","setupFounding":2250,"setupStandard":2750,"monthlyFounding":1095,"monthlyStandard":1295,"includedCredit":300,"demo":"content","description":"Schedules your social posts across your channels. You approve from your phone.","buyable":true,"link":"https://buy.stripe.com/6oU5kF4Ow35gdJE2wzak008"},
  {"line":20,"key":"L20-CUSTOMER-ACQUISITION-OS-STARTER","family":"OPERATING SYSTEM","product":"Customer Acquisition OS","tier":"Starter","plan":"DFY","setupFounding":995,"setupStandard":1495,"monthlyFounding":449,"monthlyStandard":549,"includedCredit":125,"demo":"followup","description":"Answers new leads within minutes, sends proposals, follows up and books calls.","buyable":true,"link":"https://buy.stripe.com/dRmcN7ftafS2axs2wzak003"},
  {"line":21,"key":"L21-CUSTOMER-ACQUISITION-OS-PRO","family":"OPERATING SYSTEM","product":"Customer Acquisition OS","tier":"Pro","plan":"DFY","setupFounding":1495,"setupStandard":2250,"monthlyFounding":699,"monthlyStandard":899,"includedCredit":225,"demo":"followup","description":"Answers new leads within minutes, sends proposals, follows up and books calls.","buyable":true,"link":"https://buy.stripe.com/bJe00l4Ow6hs6hcefhak004"},
  {"line":22,"key":"L22-CUSTOMER-ACQUISITION-OS-SCALE","family":"OPERATING SYSTEM","product":"Customer Acquisition OS","tier":"Scale","plan":"DFY","setupFounding":2495,"setupStandard":3500,"monthlyFounding":1195,"monthlyStandard":1495,"includedCredit":450,"demo":"followup","description":"Answers new leads within minutes, sends proposals, follows up and books calls.","buyable":true,"link":"https://buy.stripe.com/6oU00ldl2gW6350dbdak00h"},
  {"line":23,"key":"L23-GROWTH-AUTOPILOT-OS-GROWTH","family":"OPERATING SYSTEM","product":"Growth Autopilot OS","tier":"Growth","plan":"DFY","setupFounding":2500,"setupStandard":3500,"monthlyFounding":1499,"monthlyStandard":1799,"includedCredit":350,"demo":"growth","description":"The whole system: answers new leads within minutes, sends proposals, follows up and books calls, schedules social posts and builds prospect lists. You approve from your phone.","buyable":true,"link":"https://buy.stripe.com/7sY3cx80IbBM494gnpak00b"},
  {"line":24,"key":"L24-GROWTH-AUTOPILOT-OS-GROWTH-PRO","family":"OPERATING SYSTEM","product":"Growth Autopilot OS","tier":"Growth Pro","plan":"DFY","setupFounding":3500,"setupStandard":4500,"monthlyFounding":2099,"monthlyStandard":2699,"includedCredit":600,"demo":"growth","description":"The whole system: answers new leads within minutes, sends proposals, follows up and books calls, schedules social posts and builds prospect lists. You approve from your phone.","buyable":true,"link":"https://buy.stripe.com/00w3cxftabBM350efhak00j"},
  {"line":25,"key":"L25-GROWTH-AUTOPILOT-OS-GROWTH-SCALE","family":"OPERATING SYSTEM","product":"Growth Autopilot OS","tier":"Growth Scale","plan":"DFY","setupFounding":5000,"setupStandard":6500,"monthlyFounding":3499,"monthlyStandard":4499,"includedCredit":1100,"demo":"growth","description":"The whole system: answers new leads within minutes, sends proposals, follows up and books calls, schedules social posts and builds prospect lists. You approve from your phone.","buyable":true,"link":"https://buy.stripe.com/dRm28tdl2dJU8pkb35ak009"},
  {"line":26,"key":"L26-USAGE-TOPUP-20","family":"CREDIT PACK","product":"Usage top-up","tier":"$20","plan":"TOPUP","setupFounding":null,"setupStandard":null,"monthlyFounding":20,"monthlyStandard":20,"includedCredit":null,"demo":null,"description":"Adds usage credit to your account when you need more.","buyable":false,"link":"REPLACE_WITH_LIVE_LINK"},
  {"line":27,"key":"L27-USAGE-TOPUP-50","family":"CREDIT PACK","product":"Usage top-up","tier":"$50","plan":"TOPUP","setupFounding":null,"setupStandard":null,"monthlyFounding":50,"monthlyStandard":50,"includedCredit":null,"demo":null,"description":"Adds usage credit to your account when you need more.","buyable":false,"link":"REPLACE_WITH_LIVE_LINK"},
  {"line":28,"key":"L28-USAGE-TOPUP-100","family":"CREDIT PACK","product":"Usage top-up","tier":"$100","plan":"TOPUP","setupFounding":null,"setupStandard":null,"monthlyFounding":100,"monthlyStandard":100,"includedCredit":null,"demo":null,"description":"Adds usage credit to your account when you need more.","buyable":false,"link":"REPLACE_WITH_LIVE_LINK"},
  // Lead Generator add-ons. PRICES NOT APPROVED. Never buyable from this file:
  // buyable stays false and pending stays true until Jim approves the prices.
  // The whole block is hidden on /catalog/ unless ADDONS_APPROVED (below) is true.
  {"line":null,"key":"A01-LEAD-GENERATOR-WEBSITE-LEAD-GENERATOR","family":"LEAD GENERATOR ADD-ON","product":"Website Lead Generator","tier":null,"plan":"ADDON","setupFounding":99,"setupStandard":149,"monthlyFounding":29,"monthlyStandard":49,"includedCredit":null,"demo":null,"description":"Add-on for the ACE Lead Generator.","buyable":false,"pending":true,"link":"REPLACE_WITH_LIVE_LINK"},
  {"line":null,"key":"A02-LEAD-GENERATOR-EXTRA-SENDING-MAILBOX","family":"LEAD GENERATOR ADD-ON","product":"Extra Sending Mailbox","tier":null,"plan":"ADDON","setupFounding":49,"setupStandard":49,"monthlyFounding":19,"monthlyStandard":19,"includedCredit":null,"demo":null,"description":"Add-on for the ACE Lead Generator. New sending mailboxes need 14-21 days to warm up before the first send.","buyable":false,"pending":true,"link":"REPLACE_WITH_LIVE_LINK"}
];

// Lead Generator add-on block on /catalog/. false = the block is not rendered
// at all. Flip to true ONLY after Jim approves the add-on prices. Even when
// true, add-on lines are shown as "Pending approval" and are never buyable.
const ADDONS_APPROVED=false;

// Approved per-tier plan facts (prospects or posts per month) from the
// approved Claude Doc "ACE Product Catalog & Pricing - Launch 20 Oct"
// (fe43efe3). Display text only; keyed by line key. Add nothing here that is
// not in that doc.
const TIER_FACTS={
  "L01-AUTOMATED-CONTENT-CREATION":["20 posts a month"],
  "L02-AUTOMATED-CONTENT-CREATION-DIY":["10 posts a month"],
  "L03-AUTOMATED-SOCIAL-MARKETING":["30 posts a month"],
  "L07-AUTOMATED-PROSPECTING-MACHINE":["500 prospects a month"],
  "L08-AUTOMATED-PROSPECTING-MACHINE-DIY":["250 prospects a month"],
  "L09-ACE-LEAD-GENERATOR-IGNITE":["500 prospects a month"],
  "L10-ACE-LEAD-GENERATOR-ACCELERATE":["1,500 prospects a month"],
  "L11-ACE-LEAD-GENERATOR-FULL-THROTTLE":["3,000 prospects a month"],
  "L12-ACE-LEAD-GENERATOR-REDLINE":["5,000 prospects a month"],
  "L13-PROSPECTING-AUTOPILOT-OS-IGNITE":["500 prospects a month"],
  "L14-PROSPECTING-AUTOPILOT-OS-ACCELERATE":["1,500 prospects a month"],
  "L15-PROSPECTING-AUTOPILOT-OS-FULL-THROTTLE":["3,000 prospects a month"],
  "L16-PROSPECTING-AUTOPILOT-OS-REDLINE":["5,000 prospects a month"],
  "L17-SOCIAL-MEDIA-MARKETING-OS-STARTER":["20 posts a month"],
  "L18-SOCIAL-MEDIA-MARKETING-OS-PRO":["30 posts a month"],
  "L19-SOCIAL-MEDIA-MARKETING-OS-SCALE":["60 posts a month"]
};

const isLiveLink=v=>typeof v==="string"&&v!==PLACEHOLDER&&/^https:\/\/buy\.stripe\.com\/(?!test_)[A-Za-z0-9_]+$/.test(v);
const byKey={};LINES.forEach(l=>{byKey[l.key]=l;});
const usd=n=>"$"+Number(n).toLocaleString("en-US");

window.ACE_CATALOG=Object.freeze({
  PLACEHOLDER,FOUNDING_RATE_ENDS,ADDONS_APPROVED:ADDONS_APPROVED===true,
  tierFacts:key=>Object.freeze((TIER_FACTS[key]||[]).slice()),
  lines:Object.freeze(LINES.map(l=>Object.freeze({...l}))),
  get:key=>byKey[key]||null,
  usd,
  isConfigured:key=>Boolean(byKey[key]&&byKey[key].buyable===true&&!byKey[key].pending&&byKey[key].family!=="LEAD GENERATOR ADD-ON"&&isLiveLink(byKey[key].link)),
  isLiveLink
});

})();
