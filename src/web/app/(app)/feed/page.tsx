"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, MapPin, ExternalLink, X, RefreshCw, Briefcase, DollarSign, ChevronDown, ChevronUp,
} from "lucide-react";
import { api, type SavedJob } from "@/lib/api";
import { useProfile } from "@/lib/hooks/use-profile";
import { usePipelineStats } from "@/lib/hooks/use-pipeline";

/* ── Default search params keyed by profile rag_tag ── */
const PROFILE_DEFAULTS: Record<string, { keywords: string; location: string }> = {
  rob: { keywords: "AI product manager sports", location: "Beaverton OR" },
  ari: { keywords: "nursing research informatics", location: "Remote" },
};

function salaryLabel(min: number | null, max: number | null): string {
  if (!min && !max) return "";
  const fmt = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;
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

/* ── Job card ── */
function JobCard({
  sj,
  onDismiss,
  onAddToPipeline,
}: {
  sj: SavedJob;
  onDismiss: (id: number) => void;
  onAddToPipeline: (sj: SavedJob) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { job } = sj;
  const salary = salaryLabel(job.salary_min, job.salary_max);
  const age = daysAgo(job.posted_at);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="rounded-xl flex flex-col"
      style={{
        background: "#0e1015",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Main row */}
      <div className="flex items-start gap-3 p-4">
        {/* Score badge */}
        {sj.score != null && (
          <div
            className="shrink-0 flex items-center justify-center rounded-lg font-mono font-bold text-[0.7rem] tabular-nums"
            style={{
              width: 36,
              height: 36,
              background:
                sj.score >= 0.85
                  ? "rgba(var(--accent-rgb),0.12)"
                  : "rgba(255,255,255,0.04)",
              color:
                sj.score >= 0.85
                  ? "var(--accent)"
                  : sj.score >= 0.7
                    ? "#f1f1f3"
                    : "#484d63",
              border:
                sj.score >= 0.85
                  ? "1px solid rgba(var(--accent-rgb),0.3)"
                  : "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {Math.round(sj.score * 100)}
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[0.85rem] font-semibold text-[#f1f1f3] truncate">{job.title}</span>
            {age && <span className="text-[0.6rem] text-[#484d63] shrink-0">{age}</span>}
          </div>
          <div className="text-[0.7rem] text-[#8b8fa8] mt-0.5">
            {job.company}
            {job.location && <span className="ml-2 text-[#484d63]"><MapPin size={9} className="inline mr-0.5" />{job.location}</span>}
          </div>
          {salary && (
            <div className="flex items-center gap-1 mt-1 text-[0.65rem]" style={{ color: "var(--accent)" }}>
              <DollarSign size={10} />
              {salary}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg transition-all hover:text-[#f1f1f3]"
            style={{ color: "#484d63", background: "rgba(255,255,255,0.04)" }}
            title="Toggle description"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg transition-all hover:text-[var(--accent)]"
              style={{ color: "#484d63", background: "rgba(255,255,255,0.04)" }}
              title="Open posting"
            >
              <ExternalLink size={13} />
            </a>
          )}
          <button
            onClick={() => onAddToPipeline(sj)}
            className="px-2.5 py-1.5 rounded-lg text-[0.65rem] font-semibold transition-all hover:-translate-y-0.5"
            style={{ background: "rgba(var(--accent-rgb),0.12)", color: "var(--accent)", border: "1px solid rgba(var(--accent-rgb),0.25)" }}
          >
            + Pipeline
          </button>
          <button
            onClick={() => onDismiss(sj.id)}
            className="p-1.5 rounded-lg transition-all hover:text-[#ef4444]"
            style={{ color: "#484d63", background: "rgba(255,255,255,0.04)" }}
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
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="px-4 pb-4 text-[0.72rem] text-[#8b8fa8] leading-relaxed border-t"
              style={{ borderColor: "rgba(255,255,255,0.05)" }}
            >
              <div className="mt-3 line-clamp-6">{job.description}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Search bar ── */
function SearchBar({
  keywords, setKeywords, location, setLocation, onFetch, loading,
}: {
  keywords: string; setKeywords: (v: string) => void;
  location: string; setLocation: (v: string) => void;
  onFetch: () => void; loading: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-2.5"
      style={{ background: "#0e1015", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <Search size={14} style={{ color: "#484d63", flexShrink: 0 }} />
      <input
        value={keywords}
        onChange={(e) => setKeywords(e.target.value)}
        placeholder="Keywords…"
        className="flex-1 bg-transparent text-[0.78rem] text-[#f1f1f3] outline-none placeholder:text-[#484d63]"
        onKeyDown={(e) => e.key === "Enter" && onFetch()}
      />
      <div className="w-px h-4" style={{ background: "rgba(255,255,255,0.08)" }} />
      <MapPin size={12} style={{ color: "#484d63", flexShrink: 0 }} />
      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Location…"
        className="w-32 bg-transparent text-[0.78rem] text-[#f1f1f3] outline-none placeholder:text-[#484d63]"
        onKeyDown={(e) => e.key === "Enter" && onFetch()}
      />
      <button
        onClick={onFetch}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.68rem] font-semibold transition-all disabled:opacity-50 hover:-translate-y-0.5"
        style={{ background: "var(--accent)", color: "#000" }}
      >
        <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
        {loading ? "Fetching…" : "Fetch Jobs"}
      </button>
    </div>
  );
}

/* ── Add to pipeline modal ── */
function AddToPipelineModal({
  sj,
  profileId,
  onClose,
}: {
  sj: SavedJob;
  profileId: number;
  onClose: () => void;
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
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 12 }}
        style={{
          background: "#0e1015",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          padding: "1.75rem",
          width: 380,
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <span className="text-[0.9rem] font-semibold text-[#f1f1f3]">Add to Pipeline</span>
          <button onClick={onClose} style={{ color: "#484d63" }}><X size={16} /></button>
        </div>
        <div className="mb-1 text-[0.82rem] font-medium text-[#f1f1f3]">{sj.job.title}</div>
        <div className="text-[0.7rem] text-[#484d63] mb-5">{sj.job.company}</div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg py-2 text-[0.72rem] font-medium"
            style={{ background: "rgba(255,255,255,0.04)", color: "#8b8fa8", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            Cancel
          </button>
          <button
            onClick={() => mutate()}
            disabled={isPending}
            className="flex-1 rounded-lg py-2 text-[0.72rem] font-bold transition-all disabled:opacity-40"
            style={{ background: "var(--accent)", color: "#000" }}
          >
            {isPending ? "Adding…" : "Add to Pipeline"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Main page ── */
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
    mutationFn: () =>
      api.jobs.fetch({ profile_id: profileId!, keywords, location }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs", profileId] }),
  });

  const { mutate: dismiss } = useMutation({
    mutationFn: (id: number) => api.jobs.dismiss(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["jobs", profileId] });
      const prev = qc.getQueryData<SavedJob[]>(["jobs", profileId]);
      qc.setQueryData<SavedJob[]>(["jobs", profileId], (old) =>
        old?.filter((j) => j.id !== id) ?? []
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["jobs", profileId], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["jobs", profileId] }),
  });

  return (
    <div className="flex flex-col h-full gap-5">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-end justify-between shrink-0"
      >
        <div>
          <h1 className="text-[1.9rem] font-bold tracking-[-0.03em] text-[#f1f1f3]">Job Feed</h1>
        </div>
        <div className="text-[0.68rem] text-[#484d63]">
          {jobs.length} role{jobs.length !== 1 ? "s" : ""} in feed
        </div>
      </motion.div>

      {/* Search */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
        <SearchBar
          keywords={keywords}
          setKeywords={setKeywords}
          location={location}
          setLocation={setLocation}
          onFetch={() => fetchJobs()}
          loading={fetching}
        />
      </motion.div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-3">
        {isLoading && (
          <div className="flex items-center justify-center h-32 text-[0.7rem] text-[#484d63]">Loading…</div>
        )}

        {!isLoading && jobs.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-40 gap-3"
          >
            <Briefcase size={28} style={{ color: "#2a2d3a" }} />
            <div className="text-[0.75rem] text-[#484d63]">No jobs yet — hit Fetch Jobs to populate your feed.</div>
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

      {/* Modals */}
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
