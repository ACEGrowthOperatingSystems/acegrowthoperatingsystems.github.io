(()=>{"use strict";

// ============================================================================
// THE ONLY PLACE THE "ACE WEEKLY BRIEF" POP-UP IS CONFIGURED.
//
// POPUP_RELEASE_STATE gates the pop-up (index.html #weekly-brief) AND its
// subscribe form. It is the pop-up's own flag, separate from every page flag
// and from the Choose Your Demo section flag:
//   - anything other than the exact string "RELEASED" is HELD;
//   - HELD: the pop-up ships with the `hidden` attribute and never appears;
//     the form never posts (it records the payload locally only);
//   - "?preview=1" on the URL shows a HELD pop-up for review ONLY, with a
//     "held preview" ribbon. Preview never enables submission.
// To release: change "APPROVAL_HELD" to "RELEASED" and change nothing else.
// Releasing makes the form post live to the ACE intake, so the n8n
// "weekly-brief-subscribe" route must be accepting first. Any Kit sync is
// done server-side by n8n; the browser never talks to Kit.
// ============================================================================

const POPUP_RELEASE_STATE="APPROVAL_HELD";
const FORM_KEY="weekly-brief-subscribe";
const DELAY_MS=10000;
const SEEN_KEY="ace-weekly-brief-popup-seen";

window.ACE_WEEKLY_BRIEF_CONFIG=Object.freeze({
  POPUP_RELEASE_STATE,
  popupReleased:POPUP_RELEASE_STATE==="RELEASED",
  FORM_KEY,
  DELAY_MS,
  SEEN_KEY
});

})();
