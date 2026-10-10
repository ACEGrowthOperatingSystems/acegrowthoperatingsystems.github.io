(()=>{"use strict";

// ============================================================================
// THE ONLY PLACE THE "CHOOSE YOUR DEMO" FUNNEL IS CONFIGURED.
//
// 1. SECTION_RELEASE_STATE gates the homepage section (index.html #choose-demo)
//    AND its "Ask a question" form. The homepage has no page-level release
//    flag, so this section carries its own, exactly like a held page:
//      - anything other than the exact string "RELEASED" is HELD;
//      - HELD: the section ships with the `hidden` attribute and stays hidden;
//        the form never posts (it records the payload locally only);
//      - "?preview=1" on the URL reveals a HELD section for review screenshots
//        ONLY. Preview never enables submission.
//    To release: change "APPROVAL_HELD" to "RELEASED" and change nothing else.
//    Releasing also makes the question form post live to the ACE intake, so
//    the n8n "demo-question" route must be accepting first.
//
// 2. DEMOS[].file: each demo's vertical 9:16 MP4 (an https:// URL, or a site
//    path ending in .mp4). Files live in assets/demos/ (H.264, no audio,
//    faststart, 10 Oct 2026); paths are relative to the homepage root.
//    Setting a file back to "REPLACE_WITH_VIDEO_URL" restores the card below.
//    While a file is still the placeholder, the player shows a
//    "Demo video coming soon" card instead of a broken player.
//    poster (optional) and duration (optional, e.g. "1:30") follow the same
//    rule: empty means "not shown".
//
// 3. LAUNCH_PRICING_ENDS: when the Founding Member Rate stops being offered,
//    as an ISO date string, or null. Set by Jim 10 Oct 2026: offer available
//    until March 1, 2027 (end of day Feb 28, America/New_York).
//    - set and in the future: "Available until <date>" + a calm days-left
//      countdown (no seconds) on the checkout banner and demo end panel;
//    - null: the Founding Member banner shows with no date and no countdown;
//    - past (or invalid): the countdown AND the Founding Member banner are
//      hidden. Never fake urgency: only a real date goes here.
//    Visitor-facing name is "Founding Member Rate"; the key keeps its name.
//
// No prices live here. Prices come only from assets/checkout-config.js.
// ============================================================================

const SECTION_RELEASE_STATE="APPROVAL_HELD";
const VIDEO_PLACEHOLDER="REPLACE_WITH_VIDEO_URL";
const LAUNCH_PRICING_ENDS="2027-03-01T00:00:00-05:00";
const QUESTION_FORM_KEY="demo-question";

// Playlist order is this array's order. growth is last on purpose: it is the
// "whole system" demo, so it closes a playlist unless it is the only pick.
const DEMOS=[
  {key:"followup",title:"The Follow-Up Machine",outcome:"Answer every lead fast and book more calls",file:"assets/demos/followup.mp4",poster:"assets/demos/followup-poster.jpg",duration:"0:35"},
  {key:"pipeline",title:"Pipeline Builder",outcome:"Find new clients every week",file:"assets/demos/pipeline.mp4",poster:"assets/demos/pipeline-poster.jpg",duration:"0:34"},
  {key:"content",title:"Content Autopilot",outcome:"Post every day without the work",file:"assets/demos/content.mp4",poster:"assets/demos/content-poster.jpg",duration:"0:32"},
  {key:"proposal",title:"Proposal Engine",outcome:"Send proposals the same day and close more",file:"assets/demos/proposal.mp4",poster:"assets/demos/proposal-poster.jpg",duration:"0:31"},
  {key:"growth",title:"The Growth Engine",outcome:"See the whole ACE system working together",file:"assets/demos/growth.mp4",poster:"assets/demos/growth-poster.jpg",duration:"0:35"}
];

// /start/ questionnaire interest (exact option text) -> demo keys.
const START_INTEREST_MAP={
  "Automated prospecting":["pipeline"],
  "Automated marketing & social posting":["content"],
  "Automated sales systems":["followup","proposal"],
  "Instant lead response & follow-up":["followup"],
  "Automated booking":["followup"],
  "Automated proposals":["proposal"],
  "Accelerated growth & profitability":["growth"]
};

// Which checkout offers to recommend for each demo interest.
const RECOMMENDED_OFFERS={
  content:["SA-CONTENT-CREATION","SA-CREATION-DISTRIBUTION"],
  followup:["TIER-ESSENTIAL","TIER-PROFESSIONAL"],
  proposal:["TIER-ESSENTIAL","TIER-PROFESSIONAL"],
  pipeline:["TIER-ESSENTIAL","TIER-PROFESSIONAL"],
  growth:["TIER-ESSENTIAL","TIER-PROFESSIONAL"]
};

const KEYS=DEMOS.map(d=>d.key);

const isVideoConfigured=value=>typeof value==="string"&&value!==VIDEO_PLACEHOLDER&&!value.startsWith("REPLACE_WITH")
  &&(/^https:\/\/[^\s"'<>]+$/.test(value)||/^\/?[\w\-./]+\.mp4$/.test(value));

// Unknown keys are dropped; output is de-duplicated and in playlist order.
const normalizeKeys=list=>{
  const wanted=new Set((Array.isArray(list)?list:String(list||"").split(","))
    .map(v=>String(v).trim().toLowerCase()).filter(Boolean));
  return KEYS.filter(k=>wanted.has(k));
};

const mapStartInterests=interests=>{
  const keys=[];
  (Array.isArray(interests)?interests:[]).forEach(label=>{
    (START_INTEREST_MAP[String(label).trim()]||[]).forEach(k=>keys.push(k));
  });
  return normalizeKeys(keys);
};

// Injectable clock (tests/review only set window.ACE_CLOCK); defaults to Date.now.
const now=()=>{
  const c=typeof window!=="undefined"&&window.ACE_CLOCK;
  const t=typeof c==="function"?Number(c()):NaN;
  return Number.isFinite(t)?t:Date.now();
};

// Was a deadline configured at all (valid date), regardless of whether it passed?
const launchPricingConfigured=()=>typeof LAUNCH_PRICING_ENDS==="string"&&!Number.isNaN(Date.parse(LAUNCH_PRICING_ENDS));

// A real, future deadline or null. Invalid or past dates render nothing.
const launchPricingEnds=(at=now())=>{
  if(typeof LAUNCH_PRICING_ENDS!=="string"||!LAUNCH_PRICING_ENDS.trim())return null;
  const t=Date.parse(LAUNCH_PRICING_ENDS);
  if(Number.isNaN(t)||t<=at)return null;
  return new Date(t);
};

// Whole days remaining (rounded up), or null when there is no live deadline.
const daysLeft=(at=now())=>{
  const ends=launchPricingEnds(at);
  return ends?Math.ceil((ends.getTime()-at)/864e5):null;
};

// "March 1, 2027" in Eastern time, or "" when there is no live deadline.
const deadlineLabel=(at=now())=>{
  const ends=launchPricingEnds(at);
  return ends?ends.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric",timeZone:"America/New_York"}):"";
};

// Founding Member offer still showable: no deadline set, or deadline not yet passed.
const foundingOfferOpen=(at=now())=>!launchPricingConfigured()||launchPricingEnds(at)!==null;

window.ACE_DEMO_CONFIG=Object.freeze({
  SECTION_RELEASE_STATE,
  sectionReleased:SECTION_RELEASE_STATE==="RELEASED",
  LAUNCH_PRICING_ENDS,
  QUESTION_FORM_KEY,
  VIDEO_PLACEHOLDER,
  DEMOS:Object.freeze(DEMOS.map(d=>Object.freeze({...d}))),
  KEYS:Object.freeze(KEYS.slice()),
  START_INTEREST_MAP:Object.freeze({...START_INTEREST_MAP}),
  RECOMMENDED_OFFERS:Object.freeze({...RECOMMENDED_OFFERS}),
  isVideoConfigured,
  normalizeKeys,
  mapStartInterests,
  launchPricingEnds,
  launchPricingConfigured,
  foundingOfferOpen,
  daysLeft,
  deadlineLabel,
  now
});

})();
