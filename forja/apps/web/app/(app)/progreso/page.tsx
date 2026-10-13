import type { Metadata } from "next";
import { ProgresoVista } from "./progreso-vista";

export const metadata: Metadata = { title: "Progreso" };

export default function ProgresoPage() {
  return <ProgresoVista />;
}
