"use client";

import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { Sparkles, TrendingUp, Zap, ArrowUpRight } from "lucide-react";
import { useProfile } from "@/lib/hooks/use-profile";
import { usePipeline, usePipelineStats } from "@/lib/hooks/use-pipeline";
import { Card, CardHeader, CardLabel } from "@/components/ui/card";
import { StageBadge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const TREND_DATA = [
  { month: "Nov", roles: 42 }, { month: "Dec", roles: 38 },
  { month: "Jan", roles: 51 }, { month: "Feb", roles: 67 },
  { month: "Mar", roles: 74 }, { month: "Apr", roles: 89 },
];

const SKILLS_GAP = [
  { skill: "ML Ops",           have: 60, need: 90 },
  { skill: "Product Strategy", have: 45, need: 85 },
  { skill: "Sports Analytics", have: 80, need: 88 },
  { skill: "Stakeholder Mgmt", have: 70, need: 80 },
  { skill: "LLM Fine-tuning",  have: 50, need: 78 },
];

const TOP_JOBS = [
  { title: "AI Product Manager — Sports", company: "Nike",      match: 94, location: "Beaverton, OR" },
  { title: "Sr. ML Engineer, Fan Exp.",    company: "NFL Media", match: 87, location: "Remote" },
  { title: "Head of AI, Global Sports",   company: "Adidas",    match: 81, location: "Portland, OR" },
  { title: "AI Platform Lead — Sports",   company: "ESPN",       match: 78, location: "Bristol, CT" },
  { title: "Data Scientist, Athlete Perf.", company: "USOC",    match: 74, location: "Colorado Springs" },
];

const STAGE_ORDER = ["DISCOVERED", "APPLIED", "SCREENER", "INTERVIEW", "OFFER"] as const;

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-xl"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border-strong)",
        color: "var(--text-primary)",
      }}
    >
      <div className="font-semibold mb-0.5" style={{ color: "var(--accent)" }}>{label}</div>
      <div style={{ color: "var(--text-secondary)" }}>{payload[0].value} roles</div>
    </div>
  );
}

/* Stat block — accent=true reserves the volt signal for one number per screen */
function StatBlock({ value, label, accent = false }: { value: string | number; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <span
        className="leading-none tabular-nums"
        style={{
          fontFamily: "'Space Grotesk Variable', sans-serif",
          fontSize: "2.2rem",
          fontWeight: 700,
          letterSpacing: "-0.04em",
          color: accent ? "var(--accent)" : "var(--text-data)",
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.55rem",
          letterSpacing: "0.14em",
          textTransform: "uppercase" as const,
          color: accent ? "rgba(var(--accent-rgb),0.5)" : "var(--text-tertiary)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
  const profile = useProfile();
  const stats = usePipelineStats();
  const { data: allCards = [] } = usePipeline();

  const { data: rawFeedJobs = [] } = useQuery({
    queryKey: ["jobs", profile?.id],
    queryFn: async () => {
      const result = await api.jobs.list(profile!.id);
      return Array.isArray(result) ? result : [];
    },
    enabled: !!profile?.id,
  });

  const pipelineStages = STAGE_ORDER.map((stage) => ({
    stage,
    count: allCards.filter((c) => c.stage === stage).length,
  }));

  const maxStage = pipelineStages.reduce((a, b) => b.count > a.count ? b : a, pipelineStages[0]);

  const topJobs = rawFeedJobs.length > 0
    ? rawFeedJobs
        .filter((sj) => !sj.dismissed)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 5)
        .map((sj) => ({
          title: sj.job.title,
          company: sj.job.company,
          match: Math.round((sj.score ?? 0.7) * 100),
          location: sj.job.location,
        }))
    : TOP_JOBS;

  const activeCount = stats.total || 0;
  const interviewCount = stats.interviews || 0;
  const offerCount = stats.offers || 0;

  return (
    <div className="flex flex-col gap-6 h-full">

      {/* ── Command header ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="flex items-end justify-between shrink-0 pb-5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.6rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase" as const,
              color: "var(--accent)",
              marginBottom: "0.6rem",
            }}
          >
            Intelligence Report
          </div>
          <h1
            style={{
              fontFamily: "'Space Grotesk Variable', sans-serif",
              fontSize: "clamp(2.6rem, 4vw, 3.6rem)",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              color: "var(--text-primary)",
            }}
          >
            {profile?.name ?? "Dashboard"}
          </h1>
        </div>

        {/* Stats — volt on ONE number only (Active) */}
        <div className="flex items-end gap-8">
          <StatBlock value={activeCount} label="Active" accent />
          <div className="w-px h-8 self-center" style={{ background: "var(--border-strong)" }} />
          <StatBlock value={interviewCount} label="Interviews" />
          <StatBlock value={offerCount} label="Offers" />
          <div className="w-px h-8 self-center" style={{ background: "var(--border-strong)" }} />
          <StatBlock value="89" label="Market Pulse" />
        </div>
      </motion.div>

      {/* ── Main grid — 5+4+3 ── */}
      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">

        {/* Left: Job matches + Pipeline */}
        <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="col-span-5 flex flex-col gap-4 min-h-0">

          <Card className="flex flex-col">
            <CardHeader>
              <CardLabel>Top Matches</CardLabel>
              <button
                className="flex items-center gap-1 transition-colors hover:text-[var(--accent)]"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.6rem",
                  color: "var(--text-tertiary)",
                }}
              >
                View all <ArrowUpRight size={11} />
              </button>
            </CardHeader>

            <div className="flex flex-col" style={{ borderTop: "1px solid var(--border)" }}>
              {topJobs.map((job, i) => (
                <motion.div
                  key={job.title}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.06 }}
                  className="group flex items-center gap-3 py-3 cursor-pointer"
                  style={{ borderBottom: i < topJobs.length - 1 ? "1px solid var(--border)" : "none" }}
                >
                  {/* Rank — only #1 gets accent */}
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "0.58rem",
                      width: 16,
                      flexShrink: 0,
                      color: i === 0 ? "var(--accent)" : "var(--text-muted)",
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="text-[0.82rem] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {job.title}
                    </div>
                    <div className="text-[0.65rem] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                      {job.company}
                      <span className="mx-1.5" style={{ opacity: 0.3 }}>·</span>
                      {job.location}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div
                      style={{
                        width: 36,
                        height: 3,
                        background: "var(--surface-3)",
                        borderRadius: 2,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${job.match}%`,
                          height: "100%",
                          borderRadius: 2,
                          /* Only 90+ gets full volt; others get data-text tints */
                          background: job.match >= 90
                            ? "var(--accent)"
                            : "var(--text-data)",
                          opacity: job.match >= 90 ? 1 : job.match >= 80 ? 0.55 : 0.3,
                        }}
                      />
                    </div>
                    {/* Match score — accent only for 90+ */}
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        width: 28,
                        textAlign: "right" as const,
                        color: job.match >= 90 ? "var(--accent)" : "var(--text-data)",
                        opacity: job.match >= 90 ? 1 : job.match >= 80 ? 0.75 : 0.5,
                      }}
                    >
                      {job.match}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>

          {/* Pipeline */}
          <Card>
            <CardHeader>
              <CardLabel>Pipeline</CardLabel>
              <button
                className="flex items-center gap-1 transition-colors hover:text-[var(--accent)]"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.6rem",
                  color: "var(--text-tertiary)",
                }}
              >
                Manage <ArrowUpRight size={11} />
              </button>
            </CardHeader>
            <div className="flex gap-2">
              {pipelineStages.map(({ stage, count }) => {
                const isMax = stage === maxStage?.stage && count > 0;
                return (
                  <div key={stage} className="flex-1 flex flex-col items-center gap-2">
                    <span
                      className="leading-none tabular-nums"
                      style={{
                        fontFamily: "'Space Grotesk Variable', sans-serif",
                        fontSize: "1.5rem",
                        fontWeight: 700,
                        /* Only the stage with the most items gets accent */
                        color: isMax ? "var(--accent)" : count > 0 ? "var(--text-data)" : "var(--surface-3)",
                      }}
                    >
                      {count}
                    </span>
                    <StageBadge stage={stage} />
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>

        {/* Middle: Skills gap */}
        <motion.div {...fadeUp} transition={{ delay: 0.18 }} className="col-span-4 min-h-0">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardLabel>Skills Gap</CardLabel>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.58rem",
                  color: "var(--text-tertiary)",
                }}
              >
                vs. target roles
              </span>
            </CardHeader>

            <div className="flex flex-col gap-4 flex-1">
              {SKILLS_GAP.map(({ skill, have, need }, i) => {
                const pct = Math.round((have / need) * 100);
                const gap = need - have;
                /* Only the widest gap gets accent treatment */
                const isTopGap = i === 0;
                return (
                  <div key={skill} className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-baseline">
                      <span
                        className="text-[0.75rem] font-medium"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {skill}
                      </span>
                      <div className="flex items-baseline gap-1.5">
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 700,
                            fontSize: "0.78rem",
                            /* Accent only for the skill with the largest gap */
                            color: isTopGap ? "var(--accent)" : "var(--text-data)",
                          }}
                        >
                          {pct}%
                        </span>
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: "0.58rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          {have}/{need}
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        position: "relative",
                        height: 3,
                        background: "var(--surface-3)",
                        borderRadius: 2,
                        overflow: "hidden",
                      }}
                    >
                      <motion.div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          bottom: 0,
                          borderRadius: 2,
                          /* Accent fill only for top gap skill; others use data-text */
                          background: isTopGap
                            ? `linear-gradient(90deg, rgba(var(--accent-rgb),0.3) 0%, var(--accent) 100%)`
                            : `linear-gradient(90deg, rgba(var(--accent-rgb),0.1) 0%, var(--text-data) 100%)`,
                          opacity: isTopGap ? 1 : 0.45,
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.3 + i * 0.07, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Insight callout */}
            <div
              className="mt-5 flex gap-2.5 p-3"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border-accent)",
                borderRadius: "var(--radius)",
              }}
            >
              <Zap size={12} className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
              <p className="text-[0.68rem] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Next best skill:</span>{" "}
                ML Ops — in 41% of target roles, largest delta.
              </p>
            </div>
          </Card>
        </motion.div>

        {/* Right: Trend + Expert Panel */}
        <motion.div
          {...fadeUp}
          transition={{ delay: 0.26 }}
          className="col-span-3 flex flex-col gap-4 min-h-0 overflow-hidden"
        >
          <Card className="flex flex-col flex-1 min-h-0">
            <CardHeader>
              <CardLabel>Market Trend</CardLabel>
              <TrendingUp size={12} style={{ color: "var(--text-tertiary)" }} />
            </CardHeader>
            <p
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.55rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase" as const,
                color: "var(--text-muted)",
                marginBottom: "0.75rem",
              }}
            >
              AI / Sports · 6 mo
            </p>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={TREND_DATA} margin={{ top: 4, right: 4, left: -26, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      {/* Drastically reduced fill opacity — line chart, not a green sun */}
                      <stop offset="5%"  stopColor="var(--accent)" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "var(--text-tertiary)", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--text-tertiary)", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="roles"
                    stroke="var(--accent)"
                    strokeWidth={1.5}
                    fill="url(#trendGrad)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Expert Panel CTA */}
          <Card className="shrink-0 flex flex-col gap-3" accent>
            <div className="flex items-center gap-2">
              <Sparkles size={12} style={{ color: "var(--accent)" }} />
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.6rem",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase" as const,
                  color: "var(--text-secondary)",
                }}
              >
                Expert Panel
              </span>
            </div>
            <p className="text-[0.68rem] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              5 AI experts critique your materials in parallel.
            </p>
            <button
              className="w-full py-2.5 text-[0.72rem] font-bold tracking-wide text-black transition-all hover:opacity-90 active:scale-[0.98]"
              style={{
                background: "var(--accent)",
                borderRadius: "var(--radius)",
                fontFamily: "'Space Grotesk Variable', sans-serif",
              }}
            >
              Launch Panel →
            </button>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
