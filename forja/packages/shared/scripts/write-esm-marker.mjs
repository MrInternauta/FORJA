import { writeFileSync } from "node:fs";

/**
 * El paquete es CommonJS por defecto (sin "type" en package.json), asi que Node
 * y los bundlers leerian `dist-esm/*.js` como CJS y reventarian con la sintaxis
 * `export`. Este marcador declara ESM solo dentro de dist-esm/.
 *
 * tsc no puede emitirlo por si mismo: de ahi este paso extra en el build.
 */
writeFileSync(
  new URL("../dist-esm/package.json", import.meta.url),
  `${JSON.stringify({ type: "module" }, null, 2)}\n`,
);
