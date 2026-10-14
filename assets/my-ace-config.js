// My ACE customer account page: public, non-secret configuration.
// supabaseKey is the project's PUBLISHABLE key (browser-safe by design). The
// anon role has no table grants and cannot execute any My ACE function: every
// read and write goes through security-definer RPCs granted to signed-in
// (authenticated) users only, scoped to the signed-in email.
// Top-up and billing-portal links stay null until Jim approves live Stripe
// links; while null the buttons explain how to top up instead of linking out.
window.ACE_MYACE_CONFIG = Object.freeze({
  supabaseUrl: "https://axvcxkcdunxnjhsstopt.supabase.co",
  supabaseKey: "sb_publishable_I7KZjJBpS8cxPzZMGYuxfA_y_8UYd8C",
  billingPortalUrl: null,
  topUps: [
    { usd: 20, url: null },
    { usd: 50, url: null },
    { usd: 100, url: null }
  ],
  supportEmail: "AceGrowth.os@gmail.com"
});
