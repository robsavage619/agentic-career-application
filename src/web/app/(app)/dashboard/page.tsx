"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CalendarClock,
  Inbox,
  AlarmClock,
  TimerReset,
  CheckCircle2,
  Loader2,
  RefreshCw,
  FileDown,
} from "lucide-react";
import { useProfile } from "@/lib/hooks/use-profile";
import { api, type Briefing, type BriefingCard, type BriefingFollowUp, type BriefingJob } from "@/lib/api";

const TODAY = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

export default function DashboardPage() {
  const profile = useProfile();
  const profileId = profile?.id;

  const briefingQuery = useQuery<Briefing>({
    queryKey: ["briefing", profileId],
    queryFn: () => api.dashboard.briefing(profileId!),
    enabled: !!profileId,
    staleTime: 60_000,
  });

  const [writingBack, setWritingBack] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleWriteback() {
    if (!profileId) return;
    setWritingBack("saving");
    try {
      const r = await api.dashboard.writebackBriefing(profileId);
      setWritingBack(r.written ? "saved" : "error");
      setTimeout(() => setWritingBack("idle"), 2400);
    } catch {
      setWritingBack("error");
      setTimeout(() => setWritingBack("idle"), 2400);
    }
  }

  if (!profile) return null;

  return (
    <div className="flex flex-col gap-10">
      {/* ── Hero ── */}
      <header className="flex items-end justify-between gap-6 pt-2">
        <div>
          <div
            className="text-[0.8rem] mb-2"
            style={{ color: "var(--text-tertiary)", letterSpacing: "-0.005em" }}
          >
            {TODAY}
          </div>
          <h1>
            Good morning, {profile.name}.
          </h1>
          <p
            className="mt-2 text-[0.95rem]"
            style={{ color: "var(--text-secondary)" }}
          >
            {summarize(briefingQuery.data)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => briefingQuery.refetch()}
            disabled={briefingQuery.isFetching}
            className="flex items-center gap-2 px-3 py-2 transition"
            style={{
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text-secondary)",
              fontSize: "0.825rem",
              fontWeight: 500,
              boxShadow: "var(--shadow-xs)",
            }}
          >
            <RefreshCw
              size={14}
              className={briefingQuery.isFetching ? "animate-spin" : ""}
            />
            Refresh
          </button>
          <button
            onClick={handleWriteback}
            disabled={writingBack === "saving"}
            className="flex items-center gap-2 px-3 py-2 transition"
            style={{
              borderRadius: "var(--radius)",
              background: "var(--accent)",
              color: "var(--accent-text)",
              fontSize: "0.825rem",
              fontWeight: 550,
              letterSpacing: "-0.005em",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            {writingBack === "saving" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : writingBack === "saved" ? (
              <CheckCircle2 size={14} />
            ) : (
              <FileDown size={14} />
            )}
            {writingBack === "saved" ? "Saved to vault" : writingBack === "error" ? "Vault offline" : "Save to vault"}
          </button>
        </div>
      </header>

      {/* ── KPI strip ── */}
      <KpiStrip briefing={briefingQuery.data} loading={briefingQuery.isLoading} />

      {/* ── Sections ── */}
      <div className="flex flex-col gap-7">
        <Section
          title="New jobs"
          subtitle="Saved in the last 24 hours"
          icon={Inbox}
          empty={!briefingQuery.data?.new_jobs.length}
          emptyText="Nothing new today. Pull from the job feed to refresh."
          emptyCta={{ href: "/feed", label: "Go to job feed" }}
        >
          {briefingQuery.data?.new_jobs.map((j) => <NewJobRow key={j.saved_job_id} job={j} />)}
        </Section>

        <Section
          title="Deadlines today"
          subtitle="Pipeline cards due in the next 24 hours"
          icon={AlarmClock}
          empty={!briefingQuery.data?.deadlines_today.length}
          emptyText="No deadlines today."
        >
          {briefingQuery.data?.deadlines_today.map((c) => <CardRow key={c.card_id} card={c} />)}
        </Section>

        <Section
          title="Follow-ups owed"
          subtitle="Stage-aware nudges based on time-since-update"
          icon={TimerReset}
          empty={!briefingQuery.data?.follow_ups.length}
          emptyText="Nothing waiting on a follow-up."
        >
          {briefingQuery.data?.follow_ups.map((f) => <FollowUpRow key={f.card_id} item={f} />)}
        </Section>

        <Section
          title="Stalled cards"
          subtitle="Open pipeline cards with no movement in 7+ days"
          icon={CalendarClock}
          empty={!briefingQuery.data?.stalled_cards.length}
          emptyText="Nothing's stalled. Nice."
        >
          {briefingQuery.data?.stalled_cards.map((c) => <CardRow key={c.card_id} card={c} />)}
        </Section>
      </div>
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────

function summarize(b: Briefing | undefined): string {
  if (!b) return "Pulling today's briefing…";
  const parts: string[] = [];
  if (b.counts.new_jobs) parts.push(`${b.counts.new_jobs} new ${b.counts.new_jobs === 1 ? "job" : "jobs"}`);
  if (b.counts.deadlines_today) parts.push(`${b.counts.deadlines_today} deadline${b.counts.deadlines_today === 1 ? "" : "s"} today`);
  if (b.counts.follow_ups) parts.push(`${b.counts.follow_ups} follow-up${b.counts.follow_ups === 1 ? "" : "s"} owed`);
  if (b.counts.stalled_cards) parts.push(`${b.counts.stalled_cards} stalled`);
  if (!parts.length) return "All quiet. Nothing's waiting on you today.";
  return parts.join(" · ");
}

function KpiStrip({ briefing, loading }: { briefing: Briefing | undefined; loading: boolean }) {
  const k = briefing?.counts;
  return (
    <div
      className="grid grid-cols-4 gap-px overflow-hidden"
      style={{
        background: "var(--border)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      <Kpi label="Pipeline open" value={k?.pipeline_open ?? 0} loading={loading} />
      <Kpi label="New today" value={k?.new_jobs ?? 0} loading={loading} highlight={!!k?.new_jobs} />
      <Kpi label="Deadlines today" value={k?.deadlines_today ?? 0} loading={loading} highlight={!!k?.deadlines_today} />
      <Kpi label="Follow-ups owed" value={k?.follow_ups ?? 0} loading={loading} highlight={!!k?.follow_ups} />
    </div>
  );
}

function Kpi({
  label, value, loading, highlight,
}: { label: string; value: number; loading: boolean; highlight?: boolean }) {
  return (
    <div className="px-5 py-5" style={{ background: "var(--surface)" }}>
      <div className="text-[0.75rem]" style={{ color: "var(--text-tertiary)", letterSpacing: "-0.005em" }}>
        {label}
      </div>
      <div
        className="mt-1 tabular tabular-nums"
        style={{
          fontSize: "1.75rem",
          fontWeight: 600,
          letterSpacing: "-0.035em",
          lineHeight: 1.1,
          color: highlight ? "var(--accent)" : "var(--text-primary)",
          opacity: loading ? 0.4 : 1,
          transition: "opacity 0.2s",
        }}
      >
        {value}
      </div>
    </div>
  );
}

type SectionProps = {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
  empty: boolean;
  emptyText: string;
  emptyCta?: { href: string; label: string };
  children?: React.ReactNode;
};

function Section({ title, subtitle, icon: Icon, empty, emptyText, emptyCta, children }: SectionProps) {
  return (
    <section>
      <div className="flex items-baseline gap-3 mb-3 px-1">
        <Icon size={15} strokeWidth={1.75} style={{ color: "var(--text-tertiary)", marginBottom: -2 }} />
        <h2 className="text-[1.05rem]" style={{ fontWeight: 600, letterSpacing: "-0.022em" }}>
          {title}
        </h2>
        <span className="text-[0.8rem]" style={{ color: "var(--text-tertiary)" }}>
          {subtitle}
        </span>
      </div>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-xs)",
          overflow: "hidden",
        }}
      >
        {empty ? (
          <EmptyState text={emptyText} cta={emptyCta} />
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {children}
          </div>
        )}
      </div>
    </section>
  );
}

function EmptyState({ text, cta }: { text: string; cta?: { href: string; label: string } }) {
  return (
    <div className="flex items-center justify-between px-5 py-6">
      <span className="text-[0.875rem]" style={{ color: "var(--text-tertiary)" }}>
        {text}
      </span>
      {cta && (
        <Link
          href={cta.href}
          className="flex items-center gap-1 text-[0.825rem] font-medium transition-colors"
          style={{ color: "var(--accent)" }}
        >
          {cta.label}
          <ArrowUpRight size={14} />
        </Link>
      )}
    </div>
  );
}

function NewJobRow({ job }: { job: BriefingJob }) {
  return (
    <a
      href={job.url || undefined}
      target={job.url ? "_blank" : undefined}
      rel="noreferrer"
      className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--overlay)]"
    >
      <div className="min-w-0 flex-1">
        <div
          className="text-[0.925rem] font-semibold truncate"
          style={{ color: "var(--text-primary)", letterSpacing: "-0.012em" }}
        >
          {job.title}
        </div>
        <div className="text-[0.825rem]" style={{ color: "var(--text-secondary)" }}>
          {job.company}
          {job.location ? ` · ${job.location}` : ""}
        </div>
      </div>
      {job.score != null && <ScoreChip value={job.score} />}
    </a>
  );
}

function CardRow({ card }: { card: BriefingCard }) {
  const when = card.deadline ? formatWhen(card.deadline) : null;
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <div
          className="text-[0.925rem] font-semibold truncate"
          style={{ color: "var(--text-primary)", letterSpacing: "-0.012em" }}
        >
          {card.title}
        </div>
        <div className="text-[0.825rem]" style={{ color: "var(--text-secondary)" }}>
          {card.company}
          {when ? ` · ${when}` : ""}
          {card.days_since_update > 0 ? ` · idle ${card.days_since_update}d` : ""}
        </div>
      </div>
      <StagePill stage={card.stage} />
    </div>
  );
}

function FollowUpRow({ item }: { item: BriefingFollowUp }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <div
          className="text-[0.925rem] font-semibold truncate"
          style={{ color: "var(--text-primary)", letterSpacing: "-0.012em" }}
        >
          {item.title} · {item.company}
        </div>
        <div className="text-[0.825rem]" style={{ color: "var(--text-secondary)" }}>
          {item.suggested_action}
          <span style={{ color: "var(--text-tertiary)" }}> · {item.days_in_stage}d in {item.stage.toLowerCase()}</span>
        </div>
      </div>
      <StagePill stage={item.stage} />
    </div>
  );
}

function ScoreChip({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div
      className="tabular shrink-0 px-2 py-0.5"
      style={{
        background: "var(--accent-soft)",
        color: "var(--accent)",
        borderRadius: 999,
        fontSize: "0.75rem",
        fontWeight: 600,
        letterSpacing: "-0.01em",
      }}
    >
      {pct}
    </div>
  );
}

function StagePill({ stage }: { stage: string }) {
  return (
    <span
      className="shrink-0 px-2.5 py-1"
      style={{
        background: "var(--surface-3)",
        color: "var(--text-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 999,
        fontSize: "0.7rem",
        fontWeight: 500,
        letterSpacing: "0.01em",
        textTransform: "lowercase",
      }}
    >
      {stage.toLowerCase()}
    </span>
  );
}

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffH = (d.getTime() - now.getTime()) / 3_600_000;
    if (diffH < 0) return `overdue ${Math.abs(Math.round(diffH))}h`;
    if (diffH < 24) return `in ${Math.round(diffH)}h`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}
