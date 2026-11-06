// Accès serveur à l'index des communes (nom, codes postaux, département d'un
// code INSEE). Généré par `pnpm build:data` ; `?raw` évite que TypeScript
// n'infère le type du fichier (1,5 Mo). Ne pas importer côté navigateur : la
// recherche y charge `/communes-index.json`.

import raw from "../../data/generated/communes-index.json?raw";
import {
  type Commune,
  type CommuneIndex,
  type CommuneTuple,
  toCommune,
} from "./communes-index";

let loaded:
  | { departments: Record<string, string>; byCode: Map<string, CommuneTuple> }
  | undefined;

function load() {
  if (!loaded) {
    const index = JSON.parse(raw) as CommuneIndex;
    loaded = {
      departments: index.departments,
      byCode: new Map(index.communes.map((tuple) => [tuple[0], tuple])),
    };
  }
  return loaded;
}

/** `undefined` si le code n'existe pas dans le snapshot. */
export function findCommune(code: string): Commune | undefined {
  const { departments, byCode } = load();
  const tuple = byCode.get(code);
  return tuple ? toCommune(tuple, departments) : undefined;
}
