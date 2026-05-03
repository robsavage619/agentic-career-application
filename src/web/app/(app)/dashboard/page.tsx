"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  RefreshCw,
  Loader2,
  CheckCircle2,
  FileDown,
  TrendingUp,
  Clock,
  AlertCircle,
  ChevronRight,
  Activity,
} from "lucide-react";
import { useProfile } from "@/lib/hooks/use-profile";
import { api, type Briefing, type BriefingCard, type BriefingFollowUp, type BriefingJob } from "@/lib/api";

const TODAY = new Date().toLocaleDateString("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
}).toUpperCase();

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

  const b = briefingQuery.data;
  const verdict = getVerdict(b);

  return (
    <div className="flex gap-8">
      {/* ── Main column ── */}
      <div className="flex-1 min-w-0 flex flex-col gap-6">

        {/* ── TODAY · VERDICT hero ── */}
        <HeroCard
          verdict={verdict}
          briefing={b}
          loading={briefingQuery.isLoading}
          fetching={briefingQuery.isFetching}
          onRefresh={() => briefingQuery.refetch()}
          onWriteback={handleWriteback}
          writingBack={writingBack}
          profileName={profile.name}
        />

        {/* ── POWERED BY THE VAULT ── */}
        <VaultPanel briefing={b} loading={briefingQuery.isLoading} />

        {/* ── YOUR STORY ── */}
        <StoryCard briefing={b} loading={briefingQuery.isLoading} />

        {/* ── Sections ── */}
        <div className="flex flex-col gap-4">
          <Section
            eyebrow="NEW JOBS"
            subtitle="saved in the last 24h"
            empty={!b?.new_jobs.length}
            emptyText="Nothing new. Pull from the job feed."
            emptyCta={{ href: "/feed", label: "Job feed" }}
            signal={b?.counts.new_jobs ?? 0}
          >
            {b?.new_jobs.map((j) => <NewJobRow key={j.saved_job_id} job={j} />)}
          </Section>

          <Section
            eyebrow="DEADLINES"
            subtitle="due in the next 24h"
            empty={!b?.deadlines_today.length}
            emptyText="No deadlines today."
            signal={b?.counts.deadlines_today ?? 0}
            signalColor="red"
          >
            {b?.deadlines_today.map((c) => <CardRow key={c.card_id} card={c} />)}
          </Section>

          <Section
            eyebrow="FOLLOW-UPS"
            subtitle="stage-aware nudges"
            empty={!b?.follow_ups.length}
            emptyText="Nothing waiting on a follow-up."
            signal={b?.counts.follow_ups ?? 0}
            signalColor="amber"
          >
            {b?.follow_ups.map((f) => <FollowUpRow key={f.card_id} item={f} />)}
          </Section>

          <Section
            eyebrow="STALLED"
            subtitle="no movement in 7+ days"
            empty={!b?.stalled_cards.length}
            emptyText="Nothing stalled. Clean pipeline."
            signal={b?.counts.stalled_cards ?? 0}
            signalColor="amber"
          >
            {b?.stalled_cards.map((c) => <CardRow key={c.card_id} card={c} />)}
          </Section>
        </div>
      </div>

      {/* ── Right rail ── */}
      <div className="w-[260px] shrink-0 flex flex-col gap-4">
        <MomentumRail briefing={b} loading={briefingQuery.isLoading} />
        <PipelineRail briefing={b} loading={briefingQuery.isLoading} />
      </div>
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────────

type Verdict = { label: string; color: string; glow: string; pip: string };

function getVerdict(b: Briefing | undefined): Verdict {
  if (!b) return { label: "LOADING", color: "var(--text-muted)", glow: "none", pip: "var(--text-muted)" };
  const { deadlines_today, follow_ups, stalled_cards, new_jobs } = b.counts;
  if (deadlines_today > 0) return { label: "URGENT", color: "var(--red)", glow: "var(--red-soft)", pip: "var(--red)" };
  if (follow_ups > 0) return { label: "ACTION NEEDED", color: "var(--amber)", glow: "var(--amber-soft)", pip: "var(--amber)" };
  if (stalled_cards > 0) return { label: "STALLED", color: "var(--amber)", glow: "var(--amber-soft)", pip: "var(--amber)" };
  if (new_jobs > 0) return { label: "NEW SIGNALS", color: "var(--green)", glow: "var(--green-soft)", pip: "var(--green)" };
  return { label: "CLEAR", color: "var(--green)", glow: "var(--green-soft)", pip: "var(--green)" };
}

function HeroCard({
  verdict, briefing, loading, fetching, onRefresh, onWriteback, writingBack, profileName,
}: {
  verdict: Verdict;
  briefing: Briefing | undefined;
  loading: boolean;
  fetching: boolean;
  onRefresh: () => void;
  onWriteback: () => void;
  writingBack: "idle" | "saving" | "saved" | "error";
  profileName: string;
}) {
  const chips = buildWhyChips(briefing);

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-lg)",
        padding: "28px 28px 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle glow top-left */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -40,
          left: -40,
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: verdict.glow,
          filter: "blur(60px)",
          pointerEvents: "none",
          opacity: 0.5,
        }}
      />

      {/* Eyebrow row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="chrome">{TODAY}</span>
          <span style={{ color: "var(--border-strong)", fontSize: "0.75rem" }}>·</span>
          <span className="chrome">VERDICT</span>
          <span style={{ color: "var(--border-strong)", fontSize: "0.75rem" }}>·</span>
          <div className="flex items-center gap-1.5">
            {/* Status pip */}
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: verdict.pip,
                display: "inline-block",
                boxShadow: `0 0 6px ${verdict.pip}`,
              }}
            />
            <span
              className="chrome"
              style={{ color: verdict.color, textShadow: `0 0 8px ${verdict.pip}` }}
            >
              {verdict.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={fetching}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-tertiary)",
              fontSize: "0.75rem",
              fontWeight: 500,
              cursor: fetching ? "not-allowed" : "pointer",
              opacity: fetching ? 0.5 : 1,
            }}
          >
            <RefreshCw size={12} className={fetching ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={onWriteback}
            disabled={writingBack === "saving"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(160,121,255,0.3)",
              background: "rgba(160,121,255,0.08)",
              color: "var(--vault-purple)",
              fontSize: "0.75rem",
              fontWeight: 500,
              cursor: writingBack === "saving" ? "not-allowed" : "pointer",
            }}
          >
            {writingBack === "saving" ? (
              <Loader2 size={12} className="animate-spin" />
            ) : writingBack === "saved" ? (
              <CheckCircle2 size={12} />
            ) : (
              <FileDown size={12} />
            )}
            {writingBack === "saved" ? "Saved" : writingBack === "error" ? "Offline" : "Save to vault"}
          </button>
        </div>
      </div>

      {/* Greeting */}
      <div style={{ marginBottom: 16 }}>
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 650,
            letterSpacing: "-0.035em",
            color: "var(--text-primary)",
            lineHeight: 1.1,
            opacity: loading ? 0.4 : 1,
          }}
        >
          {loading ? "Loading…" : `Good morning, ${profileName}.`}
        </h1>
      </div>

      {/* WHY chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span
              key={chip.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 10px",
                borderRadius: 999,
                background: chip.bg,
                border: `1px solid ${chip.border}`,
                fontSize: "0.75rem",
                fontWeight: 600,
                color: chip.color,
                letterSpacing: "-0.005em",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {chip.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function buildWhyChips(b: Briefing | undefined) {
  if (!b) return [];
  const chips: { label: string; color: string; bg: string; border: string }[] = [];
  if (b.counts.pipeline_open > 0) {
    chips.push({ label: `PIPELINE ${b.counts.pipeline_open}`, color: "var(--green)", bg: "var(--green-soft)", border: "rgba(74,222,128,0.2)" });
  }
  if (b.counts.new_jobs > 0) {
    chips.push({ label: `NEW ${b.counts.new_jobs}`, color: "var(--accent)", bg: "var(--accent-soft)", border: "rgba(122,255,142,0.2)" });
  }
  if (b.counts.deadlines_today > 0) {
    chips.push({ label: `DUE ${b.counts.deadlines_today}`, color: "var(--red)", bg: "var(--red-soft)", border: "rgba(248,113,113,0.2)" });
  }
  if (b.counts.follow_ups > 0) {
    chips.push({ label: `FOLLOW-UP ${b.counts.follow_ups}`, color: "var(--amber)", bg: "var(--amber-soft)", border: "rgba(251,191,36,0.2)" });
  }
  if (b.counts.stalled_cards > 0) {
    chips.push({ label: `STALLED ${b.counts.stalled_cards}`, color: "var(--amber)", bg: "var(--amber-soft)", border: "rgba(251,191,36,0.2)" });
  }
  return chips;
}

// ── POWERED BY THE VAULT ──────────────────────────────────────────

function VaultPanel({ briefing, loading }: { briefing: Briefing | undefined; loading: boolean }) {
  const k = briefing?.counts;
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderTop: "1px solid rgba(160,121,255,0.25)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px 12px",
          borderBottom: "1px solid var(--border)",
          background: "rgba(160,121,255,0.04)",
        }}
      >
        <span className="chrome" style={{ color: "var(--text-tertiary)" }}>Powered by</span>
        <Image
          src="/obsidian-logo.svg"
          alt="Obsidian"
          width={90}
          height={16}
          style={{ opacity: 0.85 }}
        />
      </div>

      {/* Stats grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 1,
          background: "var(--border)",
        }}
      >
        <VaultStat
          label="PIPELINE OPEN"
          value={k?.pipeline_open ?? 0}
          color="var(--green)"
          loading={loading}
        />
        <VaultStat
          label="NEW TODAY"
          value={k?.new_jobs ?? 0}
          color={k?.new_jobs ? "var(--accent)" : "var(--text-tertiary)"}
          glow={!!k?.new_jobs}
          loading={loading}
        />
        <VaultStat
          label="DEADLINES"
          value={k?.deadlines_today ?? 0}
          color={k?.deadlines_today ? "var(--red)" : "var(--text-tertiary)"}
          loading={loading}
        />
        <VaultStat
          label="FOLLOW-UPS"
          value={k?.follow_ups ?? 0}
          color={k?.follow_ups ? "var(--amber)" : "var(--text-tertiary)"}
          loading={loading}
        />
      </div>
    </div>
  );
}

function VaultStat({
  label, value, color, glow, loading,
}: { label: string; value: number; color: string; glow?: boolean; loading: boolean }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        padding: "16px 18px 14px",
      }}
    >
      <div className="chrome" style={{ marginBottom: 6 }}>{label}</div>
      <div
        style={{
          fontVariantNumeric: "tabular-nums",
          fontSize: "2rem",
          fontWeight: 700,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          color,
          opacity: loading ? 0.3 : 1,
          transition: "opacity 0.2s",
          textShadow: glow ? `0 0 16px ${color}` : "none",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ── YOUR STORY ────────────────────────────────────────────────────

function StoryCard({ briefing, loading }: { briefing: Briefing | undefined; loading: boolean }) {
  const narrative = buildNarrative(briefing);
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "20px 24px",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="chrome">YOUR STORY</span>
        <span style={{ color: "var(--border-strong)", fontSize: "0.7rem" }}>·</span>
        <span className="chrome">TODAY'S BRIEFING</span>
      </div>
      <p
        style={{
          fontSize: "0.925rem",
          lineHeight: 1.65,
          color: loading ? "var(--text-muted)" : "var(--text-secondary)",
          opacity: loading ? 0.4 : 1,
          transition: "opacity 0.2s",
          letterSpacing: "-0.005em",
        }}
      >
        {narrative}
      </p>
    </div>
  );
}

function buildNarrative(b: Briefing | undefined): string {
  if (!b) return "Pulling today's briefing from the vault…";
  const { pipeline_open, new_jobs, deadlines_today, follow_ups, stalled_cards } = b.counts;

  if (!pipeline_open && !new_jobs) {
    return "Pipeline is empty and no new jobs today. Head to the job feed to pull in fresh signals — the vault is ready when you are.";
  }

  const parts: string[] = [];

  if (pipeline_open > 0) {
    parts.push(`You have ${pipeline_open} open ${pipeline_open === 1 ? "card" : "cards"} in the pipeline.`);
  }
  if (new_jobs > 0) {
    parts.push(`${new_jobs} new ${new_jobs === 1 ? "job" : "jobs"} arrived since yesterday — worth scoring against the vault.`);
  }
  if (deadlines_today > 0) {
    parts.push(`${deadlines_today} ${deadlines_today === 1 ? "deadline" : "deadlines"} land today — don't let ${deadlines_today === 1 ? "it" : "them"} slip.`);
  }
  if (follow_ups > 0) {
    parts.push(`${follow_ups} ${follow_ups === 1 ? "card needs" : "cards need"} a follow-up based on stage timing.`);
  }
  if (stalled_cards > 0) {
    parts.push(`${stalled_cards} ${stalled_cards === 1 ? "card has" : "cards have"} gone quiet — 7+ days with no movement.`);
  }

  if (!deadlines_today && !follow_ups && !stalled_cards) {
    parts.push("Pipeline is clean. Nothing's overdue or stalled.");
  }

  return parts.join(" ");
}

// ── Right rail ────────────────────────────────────────────────────

function MomentumRail({ briefing, loading }: { briefing: Briefing | undefined; loading: boolean }) {
  const k = briefing?.counts;
  const momentum = calcMomentum(k);

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 16px 12px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Activity size={12} style={{ color: "var(--accent)" }} />
        <span className="chrome">TODAY · PULSE</span>
      </div>
      <div style={{ padding: "18px 16px" }}>
        {/* Big momentum number */}
        <div className="flex items-end gap-2 mb-1">
          <span
            style={{
              fontVariantNumeric: "tabular-nums",
              fontSize: "3rem",
              fontWeight: 700,
              letterSpacing: "-0.05em",
              lineHeight: 1,
              color: momentum.color,
              opacity: loading ? 0.3 : 1,
              textShadow: `0 0 20px ${momentum.color}`,
              transition: "opacity 0.2s",
            }}
          >
            {loading ? "—" : momentum.score}
          </span>
          <span
            style={{
              fontSize: "1rem",
              color: "var(--text-muted)",
              marginBottom: 4,
            }}
          >
            /100
          </span>
        </div>
        <div className="chrome" style={{ color: momentum.color, marginBottom: 12 }}>
          {momentum.label}
        </div>

        {/* Mini bar */}
        <div
          style={{
            height: 4,
            borderRadius: 2,
            background: "var(--surface-3)",
            overflow: "hidden",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              height: "100%",
              width: loading ? "0%" : `${momentum.score}%`,
              background: momentum.color,
              borderRadius: 2,
              boxShadow: `0 0 8px ${momentum.color}`,
              transition: "width 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
        </div>

        {/* Signal breakdown */}
        {k && (
          <div className="flex flex-col gap-2">
            <PulseRow icon={TrendingUp} label="Pipeline" value={k.pipeline_open} color="var(--green)" />
            <PulseRow icon={AlertCircle} label="Deadlines" value={k.deadlines_today} color="var(--red)" alert />
            <PulseRow icon={Clock} label="Follow-ups" value={k.follow_ups} color="var(--amber)" alert />
          </div>
        )}
      </div>
    </div>
  );
}

function calcMomentum(k: Briefing["counts"] | undefined) {
  if (!k) return { score: 0, label: "LOADING", color: "var(--text-muted)" };
  let score = 50;
  if (k.pipeline_open > 0) score += Math.min(k.pipeline_open * 5, 20);
  if (k.new_jobs > 0) score += Math.min(k.new_jobs * 3, 15);
  if (k.deadlines_today > 0) score -= k.deadlines_today * 10;
  if (k.follow_ups > 0) score -= k.follow_ups * 5;
  if (k.stalled_cards > 0) score -= k.stalled_cards * 3;
  score = Math.max(0, Math.min(100, score));

  if (score >= 75) return { score, label: "STRONG", color: "var(--green)" };
  if (score >= 50) return { score, label: "MODERATE", color: "var(--amber)" };
  return { score, label: "LOW", color: "var(--red)" };
}

function PulseRow({
  icon: Icon, label, value, color, alert,
}: { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; label: string; value: number; color: string; alert?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon size={11} style={{ color: alert && value > 0 ? color : "var(--text-muted)" }} />
        <span style={{ fontSize: "0.775rem", color: "var(--text-tertiary)" }}>{label}</span>
      </div>
      <span
        style={{
          fontVariantNumeric: "tabular-nums",
          fontSize: "0.825rem",
          fontWeight: 600,
          color: alert && value > 0 ? color : "var(--text-secondary)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function PipelineRail({ briefing, loading }: { briefing: Briefing | undefined; loading: boolean }) {
  const stages = [
    { label: "DISCOVERED", key: "discovered" },
    { label: "APPLIED", key: "applied" },
    { label: "SCREENER", key: "screener" },
    { label: "INTERVIEW", key: "interview" },
    { label: "OFFER", key: "offer" },
  ];

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 16px 12px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span className="chrome">PIPELINE · STAGES</span>
      </div>
      <div style={{ padding: "14px 16px" }}>
        <Link
          href="/pipeline"
          className="flex items-center justify-between"
          style={{
            padding: "8px 12px",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            background: "var(--surface-2)",
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Open pipeline</span>
          <div className="flex items-center gap-1">
            <span
              style={{
                fontVariantNumeric: "tabular-nums",
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "var(--green)",
                textShadow: "0 0 8px var(--green)",
                opacity: loading ? 0.3 : 1,
              }}
            >
              {briefing?.counts.pipeline_open ?? 0}
            </span>
            <ChevronRight size={13} style={{ color: "var(--text-muted)" }} />
          </div>
        </Link>
        <div className="flex flex-col gap-1.5">
          {stages.map((s) => (
            <div key={s.key} className="flex items-center justify-between">
              <span
                style={{
                  fontFamily: "'Berkeley Mono', 'JetBrains Mono', monospace",
                  fontSize: "0.65rem",
                  letterSpacing: "0.06em",
                  color: "var(--text-muted)",
                }}
              >
                {s.label}
              </span>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--surface-3)",
                  display: "inline-block",
                }}
              />
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: "0.7rem",
            color: "var(--text-muted)",
            fontFamily: "'Berkeley Mono', 'JetBrains Mono', monospace",
            letterSpacing: "0.04em",
          }}
        >
          Stage counts from pipeline →
        </div>
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────

type SectionProps = {
  eyebrow: string;
  subtitle: string;
  empty: boolean;
  emptyText: string;
  emptyCta?: { href: string; label: string };
  signal?: number;
  signalColor?: "green" | "amber" | "red";
  children?: React.ReactNode;
};

function Section({ eyebrow, subtitle, empty, emptyText, emptyCta, signal, signalColor, children }: SectionProps) {
  const sc = signalColor === "red" ? "var(--red)" : signalColor === "amber" ? "var(--amber)" : "var(--accent)";
  return (
    <section>
      <div className="flex items-center gap-3 mb-2 px-1">
        <span className="chrome">{eyebrow}</span>
        {signal != null && signal > 0 && (
          <span
            style={{
              fontVariantNumeric: "tabular-nums",
              fontSize: "0.7rem",
              fontWeight: 700,
              color: sc,
              background: `${sc}18`,
              border: `1px solid ${sc}30`,
              borderRadius: 999,
              padding: "1px 7px",
            }}
          >
            {signal}
          </span>
        )}
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{subtitle}</span>
      </div>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
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
    <div className="flex items-center justify-between px-5 py-4">
      <span
        style={{
          fontSize: "0.825rem",
          color: "var(--text-muted)",
          fontFamily: "'Berkeley Mono', 'JetBrains Mono', monospace",
          letterSpacing: "0.03em",
        }}
      >
        {text}
      </span>
      {cta && (
        <Link
          href={cta.href}
          className="flex items-center gap-1 transition-colors"
          style={{ color: "var(--accent)", fontSize: "0.775rem", fontWeight: 500 }}
        >
          {cta.label}
          <ArrowUpRight size={13} />
        </Link>
      )}
    </div>
  );
}

// ── Row components ────────────────────────────────────────────────

function NewJobRow({ job }: { job: BriefingJob }) {
  return (
    <a
      href={job.url || undefined}
      target={job.url ? "_blank" : undefined}
      rel="noreferrer"
      className="flex items-center justify-between gap-4 px-5 py-3 transition-colors"
      style={{ background: "transparent" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--overlay)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div className="min-w-0 flex-1">
        <div
          style={{
            fontSize: "0.9rem",
            fontWeight: 550,
            color: "var(--text-primary)",
            letterSpacing: "-0.012em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {job.title}
        </div>
        <div style={{ fontSize: "0.8rem", color: "var(--text-tertiary)" }}>
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
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <div className="min-w-0 flex-1">
        <div
          style={{
            fontSize: "0.9rem",
            fontWeight: 550,
            color: "var(--text-primary)",
            letterSpacing: "-0.012em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {card.title}
        </div>
        <div style={{ fontSize: "0.8rem", color: "var(--text-tertiary)" }}>
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
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <div className="min-w-0 flex-1">
        <div
          style={{
            fontSize: "0.9rem",
            fontWeight: 550,
            color: "var(--text-primary)",
            letterSpacing: "-0.012em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.title} · {item.company}
        </div>
        <div style={{ fontSize: "0.8rem", color: "var(--text-tertiary)" }}>
          {item.suggested_action}
          <span style={{ color: "var(--text-muted)" }}> · {item.days_in_stage}d in {item.stage.toLowerCase()}</span>
        </div>
      </div>
      <StagePill stage={item.stage} />
    </div>
  );
}

function ScoreChip({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 75 ? "var(--green)" : pct >= 55 ? "var(--amber)" : "var(--red)";
  return (
    <div
      style={{
        fontVariantNumeric: "tabular-nums",
        flexShrink: 0,
        padding: "3px 8px",
        background: `${color}18`,
        color,
        borderRadius: 999,
        border: `1px solid ${color}30`,
        fontSize: "0.75rem",
        fontWeight: 700,
        letterSpacing: "-0.01em",
      }}
    >
      {pct}
    </div>
  );
}

const STAGE_COLORS: Record<string, { color: string; bg: string }> = {
  DISCOVERED: { color: "var(--text-secondary)", bg: "var(--surface-3)" },
  APPLIED: { color: "var(--accent)", bg: "var(--accent-soft)" },
  SCREENER: { color: "var(--amber)", bg: "var(--amber-soft)" },
  INTERVIEW: { color: "var(--orange)", bg: "var(--orange-soft)" },
  OFFER: { color: "var(--green)", bg: "var(--green-soft)" },
  CLOSED: { color: "var(--text-muted)", bg: "var(--surface-3)" },
};

function StagePill({ stage }: { stage: string }) {
  const { color, bg } = STAGE_COLORS[stage] ?? { color: "var(--text-secondary)", bg: "var(--surface-3)" };
  return (
    <span
      style={{
        flexShrink: 0,
        padding: "3px 8px",
        background: bg,
        color,
        borderRadius: 999,
        fontSize: "0.65rem",
        fontWeight: 600,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        fontFamily: "'Berkeley Mono', 'JetBrains Mono', monospace",
        border: `1px solid ${color}30`,
      }}
    >
      {stage}
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
