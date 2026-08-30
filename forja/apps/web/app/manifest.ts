import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FORJA — Entrenamiento",
    short_name: "FORJA",
    description: "Registra tus entrenamientos, incluso sin conexion. Forja tu progreso.",
    id: "/",
    start_url: "/hoy",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0c0e12",
    theme_color: "#0c0e12",
    lang: "es",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
