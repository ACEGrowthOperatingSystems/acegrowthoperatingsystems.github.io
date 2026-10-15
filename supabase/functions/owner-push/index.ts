// owner-push: phone alerts for the ACE Owner Draft Center.
//
//   GET  ?action=key     -> { publicKey }  (VAPID public key the page subscribes with)
//   POST ?action=notify  -> sends "N drafts waiting" to every saved owner device,
//                           only when there are pending drafts AND new ones arrived
//                           since the last alert, and never more than once per 20 min
//                           (urgent drafts bypass the 20-min spacing).
//   POST ?action=test    -> same as notify but always sends (still rate-limited to 1/min).
//
// The VAPID key pair is generated here on first use and stored in the database,
// so the private key is never typed, pasted, or passed through any person or tool.
// Calling notify is harmless by design: it can only deliver an accurate count.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization,apikey,x-client-info",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "content-type": "application/json" } });

async function keys() {
  const { data, error } = await db.rpc("owner_push_get_keys");
  if (error) throw error;
  if (data && data.public_key) return data;
  const k = webpush.generateVAPIDKeys();
  const { data: saved, error: e2 } = await db.rpc("owner_push_set_keys", {
    p_public: k.publicKey, p_private: k.privateKey,
  });
  if (e2) throw e2;
  return saved; // returns whichever pair won if two calls raced
}

async function send(force: boolean) {
  const k = await keys();
  webpush.setVapidDetails("mailto:AceGrowth.os@gmail.com", k.public_key, k.private_key);
  const { data: st, error } = await db.rpc("owner_push_state", { p_force: force });
  if (error) throw error;
  if (!st.should_send) return { sent: false, reason: st.reason, pending: st.pending };
  const n = st.pending;
  const title = st.urgent > 0 ? `ACE: ${st.urgent} urgent draft${st.urgent > 1 ? "s" : ""}` : "ACE Draft Center";
  const body = n === 0 ? "Test alert: your phone alerts are working."
    : `${n} draft${n > 1 ? "s" : ""} waiting for your approval.`;
  const payload = JSON.stringify({ title, body, url: "/owner/", badge: n });
  let ok = 0, failed = 0;
  for (const s of st.subscriptions as { endpoint: string; subscription: webpush.PushSubscription }[]) {
    try {
      await webpush.sendNotification(s.subscription, payload, { TTL: 3600 * 6, urgency: st.urgent > 0 ? "high" : "normal" });
      ok++;
      await db.rpc("owner_push_mark", { p_endpoint: s.endpoint, p_error: null });
    } catch (e) {
      failed++;
      const code = (e as { statusCode?: number }).statusCode ?? 0;
      await db.rpc("owner_push_mark", { p_endpoint: s.endpoint, p_error: `${code} ${String((e as Error).message).slice(0, 200)}`, p_gone: code === 404 || code === 410 });
    }
  }
  await db.rpc("owner_push_log_send", { p_pending: n, p_new: st.new_since_last, p_ok: ok, p_failed: failed, p_note: force ? "test" : "notify" });
  return { sent: true, pending: n, delivered: ok, failed, devices: st.subscriptions.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const action = new URL(req.url).searchParams.get("action") ?? "notify";
  try {
    if (action === "key") return json({ publicKey: (await keys()).public_key });
    if (req.method !== "POST") return json({ error: "use POST" }, 405);
    if (action === "notify") return json(await send(false));
    if (action === "test") return json(await send(true));
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
