import { cn } from "@/lib/utils";

const STAGE_COLORS: Record<string, string> = {
  DISCOVERED: "bg-[rgba(255,255,255,0.05)] text-[#7a8099]",
  APPLIED:    "bg-[rgba(59,130,246,0.11)] text-[#60a5fa]",
  SCREENER:   "bg-[rgba(168,85,247,0.11)] text-[#c084fc]",
  INTERVIEW:  "bg-[rgba(var(--accent-rgb),0.11)] text-[var(--accent)]",
  OFFER:      "bg-[rgba(16,185,129,0.11)] text-[#34d399]",
  CLOSED:     "bg-[rgba(255,255,255,0.03)] text-[#454b63]",
};

export function StageBadge({ stage }: { stage: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-semibold tracking-wide",
        STAGE_COLORS[stage] ?? "bg-[rgba(255,255,255,0.05)] text-[#7a8099]"
      )}
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "0.58rem",
      }}
    >
      {stage}
    </span>
  );
}
