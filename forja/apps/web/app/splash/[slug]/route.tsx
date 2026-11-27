import { readFileSync } from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { splashVariants } from "@/lib/pwa/splash";

export const dynamic = "force-static";
export const dynamicParams = false;

/* Splash de iOS generado en build: fondo del tema oscuro (unico al arrancar) +
   icono centrado. Sin texto: no hace falta cargar fuentes. */
export function generateStaticParams() {
  return splashVariants().map((v) => ({ slug: v.slug }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const v = splashVariants().find((x) => x.slug === slug);
  if (!v) return new Response(null, { status: 404 });
  const icon = `data:image/png;base64,${readFileSync(
    path.join(process.cwd(), "public/icons/icon-512.png"),
  ).toString("base64")}`;
  const size = Math.round(Math.min(v.width, v.height) * 0.4);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#0c0e12",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <img src={icon} width={size} height={size} alt="" />
    </div>,
    { width: v.width, height: v.height },
  );
}
