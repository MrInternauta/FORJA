import type { Metadata } from "next";
import { RoutineBuilder } from "@/components/rutinas/routine-builder";

export const metadata: Metadata = { title: "Nueva rutina" };

export default function NuevaRutinaPage() {
  return <RoutineBuilder />;
}
