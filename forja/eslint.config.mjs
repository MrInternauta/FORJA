import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * ESLint 9 (flat config) para el monorepo FORJA.
 *
 * `eslint-config-next` todavia se publica en formato eslintrc, asi que se
 * traduce con FlatCompat y se acota a `apps/web`: las reglas de React/Next/a11y
 * no tienen sentido en la API NestJS ni en el paquete compartido.
 *
 * Sin reglas con tipos (`recommendedTypeChecked`): requieren un programa de TS
 * por paquete y multiplican el tiempo de analisis. `pnpm typecheck` ya cubre
 * los errores de tipo; aqui buscamos patrones, no tipado.
 */
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default tseslint.config(
  {
    // Artefactos de build y dependencias: nunca se analizan.
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "apps/web/public/sw.js", // generado por Serwist en cada build
      "**/next-env.d.ts",
      "**/*.tsbuildinfo",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Reglas de Next/React/a11y solo para la PWA.
  ...compat
    .extends("next/core-web-vitals")
    .map((config) => ({ ...config, files: ["apps/web/**/*.{ts,tsx}"] })),
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    settings: { next: { rootDir: "apps/web" } },
  },

  // El Service Worker corre en el scope del worker, no en el DOM.
  {
    files: ["apps/web/app/sw.ts"],
    languageOptions: { globals: { self: "readonly", ServiceWorkerGlobalScope: "readonly" } },
  },

  // Convencion del repo: los `_` marcan argumentos deliberadamente sin usar.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
    },
  },
);
