// My ACE customer account page: public, non-secret configuration.
// supabaseKey is the project's PUBLISHABLE key (browser-safe by design). The
// anon role has no table grants and cannot execute any My ACE function: every
// read and write goes through security-definer RPCs granted to signed-in
// (authenticated) users only, scoped to the signed-in email.
// Top-up links: live Stripe payment links approved by Jim 16 Oct 2026
// (jim_decisions 3.04), same as catalog lines 26-28. The billing-portal link
// stays null until one exists; while null that button explains what to do.
window.ACE_MYACE_CONFIG = Object.freeze({
  supabaseUrl: "https://axvcxkcdunxnjhsstopt.supabase.co",
  supabaseKey: "sb_publishable_I7KZjJBpS8cxPzZMGYuxfA_y_8UYd8C",
  billingPortalUrl: null,
  topUps: [
    { usd: 20, url: "https://buy.stripe.com/7sY14p3Ks8pA6hc0orak00q" },
    { usd: 50, url: "https://buy.stripe.com/28E00l6WEgW69to0orak00s" },
    { usd: 100, url: "https://buy.stripe.com/7sYdRbdl27lw7lg0orak00r" }
  ],
  supportEmail: "AceGrowth.os@gmail.com"
});
