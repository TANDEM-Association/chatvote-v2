// Matomo : mesure d'audience sans cookie. Désactivé si l'URL ou l'identifiant
// du site est vide. Le script matomo.js est chargé depuis l'instance Matomo,
// dont l'origine doit figurer dans la CSP de vercel.json.
const base = (import.meta.env.PUBLIC_MATOMO_URL ?? "")
  .trim()
  .replace(/\/+$/, "");
const siteId = (import.meta.env.PUBLIC_MATOMO_SITE_ID ?? "").trim();

if (base && siteId) {
  const w = window as unknown as { _paq?: unknown[][] };
  w._paq = w._paq ?? [];
  const paq = w._paq;
  // Aucun cookie Matomo : nos seuls cookies restent userID et conversationId.
  paq.push(["disableCookies"]);
  paq.push(["setDoNotTrack", true]);
  paq.push(["setTrackerUrl", `${base}/matomo.php`]);
  paq.push(["setSiteId", siteId]);
  paq.push(["trackPageView"]);
  paq.push(["enableLinkTracking"]);

  const script = document.createElement("script");
  script.async = true;
  script.src = `${base}/matomo.js`;
  document.head.append(script);
}
