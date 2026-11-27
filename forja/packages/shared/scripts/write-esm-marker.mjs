import { writeFileSync } from "node:fs";

/**
 * El paquete es CommonJS por defecto (sin "type" en package.json), asi que Node
 * y los bundlers leerian `dist-esm/*.js` como CJS y reventarian con la sintaxis
 * `export`. Este marcador declara ESM solo dentro de dist-esm/.
 *
 * Lleva también `sideEffects: false`: webpack lo lee del package.json más
 * cercano (este), no del de la raíz, y sin él no poda los esquemas ni zod.
 *
 * tsc no puede emitirlo por si mismo: de ahi este paso extra en el build.
 */
writeFileSync(
  new URL("../dist-esm/package.json", import.meta.url),
  `${JSON.stringify({ type: "module", sideEffects: false }, null, 2)}\n`,
);
