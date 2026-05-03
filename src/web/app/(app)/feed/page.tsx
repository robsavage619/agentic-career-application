"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, MapPin, ExternalLink, X, RefreshCw, Briefcase, DollarSign, ChevronDown, ChevronUp,
} from "lucide-react";
import { api, type SavedJob } from "@/lib/api";
import { useProfile } from "@/lib/hooks/use-profile";

const MONO = "'Geist Mono Variable', 'Geist Mono', ui-monospace, 'SF Mono', 'Menlo', monospace";

const PROFILE_DEFAULTS: Record<string, { keywords: string; location: string }> = {
  rob: { keywords: "AI product manager sports", location: "Beaverton OR" },
  ari: { keywords: "nursing research informatics", location: "Remote" },
};

function salaryLabel(min: number | null, max: number | null): string {
  if (!min && !max) return "";
  const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  return `up to ${fmt(max!)}`;
}

function daysAgo(posted: string | null): string {
  if (!posted) return "";
  const ms = Date.now() - new Date(posted).getTime();
  const d = Math.floor(ms / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}

function scoreColor(s: number) {
  if (s >= 0.75) return "var(--green)";
  if (s >= 0.55) return "var(--amber)";
  return "var(--red)";
}

function JobCard({ sj, onDismiss, onAddToPipeline }: {
  sj: SavedJob;
  onDismiss: (id: number) => void;
  onAddToPipeline: (sj: SavedJob) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { job } = sj;
  const salary = salaryLabel(job.salary_min, job.salary_max);
  const age = daysAgo(job.posted_at);
  const sc = sj.score != null ? scoreColor(sj.score) : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
      }}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Score badge */}
        {sj.score != null && sc && (
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: "var(--radius)",
              background: `${sc}18`,
              border: `1px solid ${sc}35`,
              color: sc,
              fontFamily: MONO,
              fontSize: "0.75rem",
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
              textShadow: `0 0 8px ${sc}`,
            }}
          >
            {Math.round(sj.score * 100)}
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              style={{
                fontSize: "0.9rem",
                fontWeight: 550,
                color: "var(--text-primary)",
                letterSpacing: "-0.012em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "100%",
              }}
            >
              {job.title}
            </span>
            {age && (
              <span
                style={{ fontFamily: MONO, fontSize: "0.6rem", color: "var(--text-muted)", letterSpacing: "0.04em", flexShrink: 0 }}
              >
                {age}
              </span>
            )}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", marginTop: 2 }}>
            {job.company}
            {job.location && (
              <span style={{ marginLeft: 8, color: "var(--text-muted)" }}>
                <MapPin size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 2 }} />
                {job.location}
              </span>
            )}
          </div>
          {salary && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: "0.72rem", color: "var(--green)" }}>
              <DollarSign size={10} />
              {salary}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              padding: "6px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--text-tertiary)",
              cursor: "pointer",
            }}
            title="Toggle description"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                padding: "6px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--text-tertiary)",
              }}
              title="Open posting"
            >
              <ExternalLink size={13} />
            </a>
          )}
          <button
            onClick={() => onAddToPipeline(sj)}
            style={{
              padding: "6px 12px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(122,255,142,0.25)",
              background: "var(--accent-soft)",
              color: "var(--accent)",
              fontSize: "0.72rem",
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: "-0.01em",
            }}
          >
            + Pipeline
          </button>
          <button
            onClick={() => onDismiss(sj.id)}
            style={{
              padding: "6px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
            title="Dismiss"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Expandable description */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: "hidden" }}
          >
            <div
              style={{
                padding: "12px 16px 16px",
                borderTop: "1px solid var(--border)",
                fontSize: "0.78rem",
                color: "var(--text-tertiary)",
                lineHeight: 1.7,
              }}
            >
              <div style={{
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 6,
                WebkitBoxOrient: "vertical",
              }}>
                {job.description}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SearchBar({ keywords, setKeywords, location, setLocation, onFetch, loading }: {
  keywords: string; setKeywords: (v: string) => void;
  location: string; setLocation: (v: string) => void;
  onFetch: () => void; loading: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        borderRadius: "var(--radius-lg)",
        background: "var(--surface)",
        border: "1px solid var(--border-strong)",
      }}
    >
      <Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
      <input
        value={keywords}
        onChange={(e) => setKeywords(e.target.value)}
        placeholder="Keywords…"
        style={{
          flex: 1,
          background: "transparent",
          fontSize: "0.875rem",
          color: "var(--text-primary)",
          outline: "none",
          letterSpacing: "-0.01em",
        }}
        onKeyDown={(e) => e.key === "Enter" && onFetch()}
      />
      <div style={{ width: 1, height: 16, background: "var(--border-strong)" }} />
      <MapPin size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Location…"
        style={{
          width: 130,
          background: "transparent",
          fontSize: "0.875rem",
          color: "var(--text-primary)",
          outline: "none",
          letterSpacing: "-0.01em",
        }}
        onKeyDown={(e) => e.key === "Enter" && onFetch()}
      />
      <button
        onClick={onFetch}
        disabled={loading}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 16px",
          borderRadius: "var(--radius)",
          background: "var(--accent)",
          color: "var(--accent-text)",
          fontSize: "0.8rem",
          fontWeight: 600,
          letterSpacing: "-0.01em",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
          border: "none",
        }}
      >
        <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        {loading ? "Fetching…" : "Fetch jobs"}
      </button>
    </div>
  );
}

function AddToPipelineModal({ sj, profileId, onClose }: {
  sj: SavedJob; profileId: number; onClose: () => void;
}) {
  const qc = useQueryClient();
  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      api.pipeline.create({
        profile_id: profileId,
        title: sj.job.title,
        company: sj.job.company,
        url: sj.job.url,
        stage: "DISCOVERED",
        job_id: sj.job_id,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline", profileId] });
      onClose();
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(6px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 12 }}
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-xl)",
          padding: "28px",
          width: 380,
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <span className="chrome">Add to pipeline</span>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><X size={16} /></button>
        </div>
        <div
          style={{ fontSize: "0.95rem", fontWeight: 550, color: "var(--text-primary)", letterSpacing: "-0.015em", marginBottom: 4 }}
        >
          {sj.job.title}
        </div>
        <div style={{ fontSize: "0.8rem", color: "var(--text-tertiary)", marginBottom: 24 }}>
          {sj.job.company}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "9px",
              borderRadius: "var(--radius)",
              background: "var(--surface-3)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
              fontSize: "0.8rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => mutate()}
            disabled={isPending}
            style={{
              flex: 1,
              padding: "9px",
              borderRadius: "var(--radius)",
              background: "var(--accent)",
              color: "var(--accent-text)",
              border: "none",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? "Adding…" : "Add to pipeline"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function FeedPage() {
  const profile = useProfile();
  const profileId = profile?.id;
  const ragTag = profile?.rag_tag ?? "rob";
  const qc = useQueryClient();

  const defaults = PROFILE_DEFAULTS[ragTag] ?? PROFILE_DEFAULTS.rob;
  const [keywords, setKeywords] = useState(defaults.keywords);
  const [location, setLocation] = useState(defaults.location);
  const [addTarget, setAddTarget] = useState<SavedJob | null>(null);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["jobs", profileId],
    queryFn: async () => {
      const result = await api.jobs.list(profileId!);
      return Array.isArray(result) ? result : [];
    },
    enabled: !!profileId,
  });

  const { mutate: fetchJobs, isPending: fetching } = useMutation({
    mutationFn: () => api.jobs.fetch({ profile_id: profileId!, keywords, location }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs", profileId] }),
  });

  const { mutate: dismiss } = useMutation({
    mutationFn: (id: number) => api.jobs.dismiss(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["jobs", profileId] });
      const prev = qc.getQueryData<SavedJob[]>(["jobs", profileId]);
      qc.setQueryData<SavedJob[]>(["jobs", profileId], (old) => old?.filter((j) => j.id !== id) ?? []);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["jobs", profileId], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["jobs", profileId] }),
  });

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <header>
        <div className="flex items-center justify-between mb-1">
          <span className="chrome">Job feed</span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: "0.65rem",
              color: "var(--text-muted)",
              letterSpacing: "0.04em",
            }}
          >
            {jobs.length} role{jobs.length !== 1 ? "s" : ""} in feed
          </span>
        </div>
        <h1 style={{ marginBottom: 16 }}>Incoming signals.</h1>
        <SearchBar
          keywords={keywords}
          setKeywords={setKeywords}
          location={location}
          setLocation={setLocation}
          onFetch={() => fetchJobs()}
          loading={fetching}
        />
      </header>

      {/* Feed */}
      <div className="flex flex-col gap-3">
        {isLoading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 128,
              color: "var(--text-muted)",
              fontFamily: MONO,
              fontSize: "0.7rem",
              letterSpacing: "0.04em",
            }}
          >
            Loading…
          </div>
        )}

        {!isLoading && jobs.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: 160,
              gap: 12,
            }}
          >
            <Briefcase size={28} style={{ color: "var(--text-muted)" }} />
            <div
              style={{
                fontFamily: MONO,
                fontSize: "0.72rem",
                color: "var(--text-muted)",
                letterSpacing: "0.04em",
              }}
            >
              No jobs yet — hit Fetch jobs to populate your feed.
            </div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {jobs.map((sj) => (
            <JobCard
              key={sj.id}
              sj={sj}
              onDismiss={dismiss}
              onAddToPipeline={setAddTarget}
            />
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {addTarget && profileId && (
          <AddToPipelineModal
            key="add-pipeline"
            sj={addTarget}
            profileId={profileId}
            onClose={() => setAddTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
