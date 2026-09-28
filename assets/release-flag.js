(()=>{"use strict";

// ACE per-page release flag.
//
// There is NO site-wide release switch. Every page carries its own state in its
// own <body data-release-state="..."> attribute, so releasing one page cannot
// release another. To release a single page, change that one page's attribute
// to exactly "RELEASED" and change nothing else.
//
// Fail-closed by construction: anything that is not the exact string "RELEASED"
// is held. A missing attribute, an empty value, a typo, a lowercase "released",
// or this script failing to load all resolve to HELD, never to released.

const RELEASED="RELEASED";
const raw=document.body&&document.body.dataset?document.body.dataset.releaseState:undefined;
const state=typeof raw==="string"?raw.trim():"";
const released=state===RELEASED;

window.ACE_RELEASE=Object.freeze({
  // Identifies which page this flag belongs to, for evidence and logging only.
  page:(document.body&&document.body.dataset&&document.body.dataset.pageKey)||location.pathname,
  state:state||"MISSING",
  released,
  isReleased(){return released}
});

})();
