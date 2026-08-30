"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { RoutineDetail } from "@forja/shared";
import { api, ApiError } from "@/lib/api";
import { RoutineBuilder } from "@/components/rutinas/routine-builder";

export default function EditarRutinaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [detail, setDetail] = useState<RoutineDetail | null>(null);

  useEffect(() => {
    api<RoutineDetail>(`/routines/${id}`)
      .then(setDetail)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) router.replace("/entrenar");
      });
  }, [id, router]);

  if (!detail) {
    return (
      <div className="flex flex-col gap-3" aria-hidden>
        <div className="superficie h-8 w-48 animate-pulse" />
        <div className="superficie h-40 animate-pulse" />
        <div className="superficie h-40 animate-pulse" />
      </div>
    );
  }

  return <RoutineBuilder routineId={id} initial={detail} />;
}
