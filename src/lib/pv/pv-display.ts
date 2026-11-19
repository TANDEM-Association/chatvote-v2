// Libellés d'affichage des séances (partagé, sans import Node).

/** « 2025-01-29 » → « 29 janvier 2025 » ; « 1er » pour le premier du mois. */
export function formatSeanceDate(date: string): string {
  return new Date(`${date}T00:00:00Z`)
    .toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    })
    .replace(/^1 /, "1er ");
}

/** « 1 délibération », « 3 délibérations », « Aucune délibération ». */
export function formatDeliberations(count: number): string {
  if (count === 0) return "Aucune délibération";
  return `${count} délibération${count > 1 ? "s" : ""}`;
}
