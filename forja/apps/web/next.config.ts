import path from "node:path";
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // En dev el SW estorba (cachea HMR); solo se genera en build de produccion.
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone es para la imagen OCI. En Vercel no: su empaquetado resuelve las
  // trazas contra la raiz del repo git (una arriba de forja/) y con esta raiz
  // buscaba apps/web/... en vez de forja/apps/web/...
  ...(process.env.VERCEL
    ? {}
    : {
        output: "standalone" as const,
        // Monorepo: raiz de trazado para que standalone incluya @forja/shared.
        outputFileTracingRoot: path.join(__dirname, "../../"),
      }),
};

export default withSerwist(nextConfig);
