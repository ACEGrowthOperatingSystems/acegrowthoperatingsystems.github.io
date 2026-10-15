// Owner Draft Center: public, non-secret configuration.
// Reuses the My ACE Supabase project and PUBLISHABLE key (browser-safe).
// pushFunctionUrl serves only the VAPID PUBLIC key and an accurate-count alert;
// the private key is generated and kept server-side and never appears here.
window.ACE_OWNER_CONFIG = Object.freeze({
  supabaseUrl: (window.ACE_MYACE_CONFIG || {}).supabaseUrl || "https://axvcxkcdunxnjhsstopt.supabase.co",
  supabaseKey: (window.ACE_MYACE_CONFIG || {}).supabaseKey || "sb_publishable_I7KZjJBpS8cxPzZMGYuxfA_y_8UYd8C",
  pushFunctionUrl: "https://axvcxkcdunxnjhsstopt.supabase.co/functions/v1/owner-push"
});
