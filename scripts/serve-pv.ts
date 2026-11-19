// Serveur de fichiers local qui remplace le stockage Scaleway en développement.
// `pnpm pv:serve` sert pv-data/ sur http://localhost:4322 ; dans .env :
//   PV_BASE_URL=http://localhost:4322/pv
// Lecture seule, sans dépendance. Ne pas utiliser en production.

import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..", "pv-data");
const port = Number(process.env.PV_PORT ?? 4322);

const TYPES: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".pdf": "application/pdf",
};

createServer((req, res) => {
  const pathname = decodeURIComponent(
    new URL(req.url ?? "/", "http://localhost").pathname,
  );
  const path = resolve(root, `.${pathname}`);
  const type = TYPES[extname(path)];
  const inside = path.startsWith(root + sep);
  const isFile =
    inside &&
    type !== undefined &&
    statSync(path, { throwIfNoEntry: false })?.isFile();

  if (req.method !== "GET" || !isFile) {
    res.writeHead(404).end();
    console.log(`404 ${pathname}`);
    return;
  }
  res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
  createReadStream(path).pipe(res);
}).listen(port, "127.0.0.1", () => {
  console.log(`PV servis depuis ${root} sur http://localhost:${port}/pv`);
});
