(()=>{"use strict";

// Visibility control for the /marketing/ value offer.
// This file NEVER submits, never builds a payload, and never reads or writes
// RELEASE_AUTHORIZED. The panel's form is bound by product-launch.js exactly
// like the main form, so the release gate behaves identically there.

const panel=document.getElementById("offerPanel");
if(!panel)return;

const closeButton=document.getElementById("offerClose");
const SEEN_KEY="ace-mkt-offer-seen";
const DELAY_MS=10000;
const SCROLL_FRACTION=0.5;

const alreadySeen=()=>{
  try{return sessionStorage.getItem(SEEN_KEY)==="1"}catch(error){return false}
};
const markSeen=()=>{
  try{sessionStorage.setItem(SEEN_KEY,"1")}catch(error){/* private mode: show once per page instead */}
};

if(alreadySeen())return;

let shown=false;
let timer=null;

const scrolledHalfway=()=>{
  const scrollable=document.documentElement.scrollHeight-window.innerHeight;
  if(scrollable<=0)return false;
  return (window.scrollY||window.pageYOffset||0)/scrollable>=SCROLL_FRACTION;
};

const teardown=()=>{
  if(timer!==null){clearTimeout(timer);timer=null}
  window.removeEventListener("scroll",onScroll);
};

const show=()=>{
  if(shown)return;
  shown=true;
  teardown();
  markSeen();
  panel.hidden=false;
  document.addEventListener("keydown",onKeydown);
  const firstField=panel.querySelector("input[type=email]");
  if(firstField)firstField.focus({preventScroll:true});
};

const dismiss=()=>{
  panel.hidden=true;
  document.removeEventListener("keydown",onKeydown);
};

function onScroll(){if(scrolledHalfway())show()}

function onKeydown(event){if(event.key==="Escape"){event.stopPropagation();dismiss()}}

timer=setTimeout(show,DELAY_MS);
window.addEventListener("scroll",onScroll,{passive:true});
if(closeButton)closeButton.addEventListener("click",dismiss);

})();
