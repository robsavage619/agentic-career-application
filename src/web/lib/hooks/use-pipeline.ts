"use client";

import { useQuery } from "@tanstack/react-query";
import { useProfile } from "./use-profile";

export type PipelineStage = "DISCOVERED" | "APPLIED" | "SCREENER" | "INTERVIEW" | "OFFER" | "CLOSED";

export interface PipelineCard {
  id: number;
  profile_id: number;
  stage: PipelineStage;
  title: string;
  company: string;
  url: string;
  deadline: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function usePipeline() {
  const profile = useProfile();
  return useQuery<PipelineCard[]>({
    queryKey: ["pipeline", profile?.id],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/pipeline/?profile_id=${profile?.id}`);
      if (!res.ok) throw new Error("Failed to fetch pipeline");
      const data = await res.json();
      return Array.isArray(data) ? data : (data.cards ?? []);
    },
    enabled: !!profile?.id,
    staleTime: 30_000,
  });
}

export function usePipelineStats() {
  const { data: cards = [] } = usePipeline();
  const active = cards.filter((c) => !["CLOSED"].includes(c.stage));
  const byStage = (stage: PipelineStage) => cards.filter((c) => c.stage === stage).length;
  return {
    total: active.length,
    interviews: byStage("INTERVIEW"),
    offers: byStage("OFFER"),
    applied: byStage("APPLIED"),
  };
}
