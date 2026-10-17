// ACE Command Center service worker: shows phone alerts and opens the queue on tap.
// It caches nothing, so the Draft Center always shows live data.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  const title = d.title || "ACE Command Center";
  e.waitUntil(Promise.all([
    self.registration.showNotification(title, {
      body: d.body || "Something needs you in the Command Center.",
      icon: "/assets/apple-touch-icon.png",
      badge: "/assets/favicon.png",
      tag: d.tag || "ace-drafts",
      renotify: true,
      data: { url: d.url || "/owner/" }
    }),
    (self.navigator && self.navigator.setAppBadge && d.badge) ? self.navigator.setAppBadge(d.badge).catch(() => {}) : Promise.resolve()
  ]));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/owner/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url.includes("/owner/") && "focus" in c) { if ("navigate" in c && c.url !== new URL(url, self.location.origin).href) c.navigate(url).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
