// Case d'opposition à la mesure d'audience (politique de confidentialité).
// Utilise les fonctions de matomo.js (optUserOut, forgetUserOptOut,
// isUserOptedOut) : aucune adresse supplémentaire n'est exposée par l'instance.
// Le choix est mémorisé par Matomo dans un cookie first-party (mtm_consent_removed),
// posé seulement quand le visiteur s'oppose.
const checkbox = document.getElementById("suivi-actif");

if (checkbox instanceof HTMLInputElement) {
  const w = window as unknown as { _paq?: unknown[] };
  w._paq = w._paq ?? [];
  const paq = w._paq;

  // Exécutée par matomo.js une fois chargé, avec le traceur en `this`.
  paq.push([
    function (this: { isUserOptedOut(): boolean }) {
      checkbox.checked = !this.isUserOptedOut();
    },
  ]);

  checkbox.addEventListener("change", () => {
    paq.push([checkbox.checked ? "forgetUserOptOut" : "optUserOut"]);
  });
}
