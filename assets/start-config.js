(()=>{"use strict";

// ============================================================================
// THE ONLY PLACE THE /start/ DEMO VIDEO AND BOOKING LINK ARE CONFIGURED.
//
// To go live, replace each "REPLACE_WITH_..." value with a real https:// URL
// and change nothing else.
//
// While a value is still its placeholder (or is not an https:// URL):
//   - DEMO_VIDEO_URL: no <video> is rendered; the success state shows a
//     "Your demo video is on its way to your inbox" card instead.
//   - BOOKING_URL:    the "Book your free demo" button stays hidden.
// Nothing here can release the page: that is the page's own
// data-release-state attribute (see assets/release-flag.js).
// ============================================================================

const DEMO_VIDEO_URL="REPLACE_WITH_DEMO_VIDEO";
const BOOKING_URL="REPLACE_WITH_BOOKING_LINK";
const DEMO_POSTER_URL="../og-image.jpg";

const isConfigured=value=>typeof value==="string"&&!value.startsWith("REPLACE_WITH")&&/^https:\/\/[^\s"'<>]+$/.test(value);

window.ACE_START_CONFIG=Object.freeze({
  DEMO_VIDEO_URL,
  BOOKING_URL,
  DEMO_POSTER_URL,
  videoConfigured:isConfigured(DEMO_VIDEO_URL),
  bookingConfigured:isConfigured(BOOKING_URL),
  isConfigured
});

})();
