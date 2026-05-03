"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Trash2, Clock, ChevronRight, User, BarChart2, Briefcase, Code, TrendingUp } from "lucide-react";
import { api, type PanelSession } from "@/lib/api";
import { useProfile } from "@/lib/hooks/use-profile";

const PERSONAS = [
  { id: "recruiter",       name: "Recruiter",       icon: User,      color: "#60a5fa" },
  { id: "hiring_manager",  name: "Hiring Manager",  icon: Briefcase, color: "#f59e0b" },
  { id: "career_coach",    name: "Career Coach",    icon: TrendingUp, color: "#22c55e" },
  { id: "market_analyst",  name: "Analyst",         icon: BarChart2, color: "#a78bfa" },
  { id: "tech_lead",       name: "Tech Lead",       icon: Code,      color: "var(--accent)" },
] as const;

const DOC_TYPES = ["resume", "cover_letter", "linkedin_post", "strategy"] as const;

/* ── Session history item ── */
function SessionItem({
  session, selected, onSelect, onDelete,
}: {
  session: PanelSession; selected: boolean; onSelect: () => void; onDelete: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      onClick={onSelect}
      className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 cursor-pointer transition-all"
      style={{
        background: selected ? "rgba(var(--accent-rgb),0.08)" : "#0e1015",
        border: selected ? "1px solid rgba(var(--accent-rgb),0.25)" : "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <Clock size={11} className="mt-0.5 shrink-0" style={{ color: selected ? "var(--accent)" : "#484d63" }} />
      <div className="flex-1 min-w-0">
        <div className="text-[0.72rem] font-medium text-[#f1f1f3] capitalize">
          {session.document_type.replace("_", " ")}
        </div>
        <div className="text-[0.6rem] text-[#484d63] mt-0.5 truncate">{session.document_snapshot}</div>
        <div className="text-[0.58rem] text-[#2a2d3a] mt-0.5">
          {new Date(session.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="p-1 shrink-0 rounded transition-colors hover:text-[#ef4444]"
        style={{ color: "#2a2d3a" }}
      >
        <Trash2 size={11} />
      </button>
    </motion.div>
  );
}

/* ── Review card for one persona ── */
function ReviewCard({
  personaId, review, delay,
}: {
  personaId: string; review: string; delay: number;
}) {
  const persona = PERSONAS.find((p) => p.id === personaId);
  if (!persona) return null;
  const Icon = persona.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="flex flex-col gap-3 rounded-xl p-4"
      style={{ background: "#0e1015", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex items-center justify-center rounded-lg"
          style={{
            width: 28, height: 28,
            background: `${persona.color}15`,
            border: `1px solid ${persona.color}30`,
          }}
        >
          <Icon size={13} style={{ color: persona.color }} />
        </div>
        <span className="text-[0.72rem] font-semibold" style={{ color: persona.color }}>
          {persona.name}
        </span>
      </div>
      <div className="text-[0.72rem] text-[#8b8fa8] leading-relaxed whitespace-pre-wrap">
        {review}
      </div>
    </motion.div>
  );
}

/* ── Session detail view ── */
function SessionDetail({ session }: { session: PanelSession }) {
  const reviews: Record<string, string> = JSON.parse(session.reviews_json || "{}");
  const hasReviews = Object.keys(reviews).length > 0;

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto">
      <div className="shrink-0">
        <div className="text-[0.6rem] font-semibold tracking-[0.14em] uppercase text-[#484d63]">
          {session.document_type.replace("_", " ")} — Panel Review
        </div>
        <div className="text-[0.68rem] text-[#484d63] mt-1 line-clamp-2">{session.document_snapshot}</div>
      </div>

      {!hasReviews ? (
        <div className="flex items-center justify-center flex-1 text-[0.7rem] text-[#484d63]">
          No reviews in this session.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {PERSONAS.map((p, i) =>
            reviews[p.id] ? (
              <ReviewCard key={p.id} personaId={p.id} review={reviews[p.id]} delay={i * 0.08} />
            ) : null
          )}
        </div>
      )}
    </div>
  );
}

/* ── Submit form ── */
function SubmitForm({
  profileId, onDone,
}: {
  profileId: number; onDone: (session: PanelSession) => void;
}) {
  const [docType, setDocType] = useState<string>("resume");
  const [doc, setDoc] = useState("");
  const [running, setRunning] = useState(false);

  const qc = useQueryClient();
  const { mutate } = useMutation({
    mutationFn: () =>
      api.panel.create({ profile_id: profileId, document_type: docType, document_snapshot: doc }),
    onSuccess: (session) => {
      qc.invalidateQueries({ queryKey: ["panel", profileId] });
      setRunning(false);
      onDone(session);
    },
    onError: () => setRunning(false),
  });

  function submit() {
    if (!doc.trim()) return;
    setRunning(true);
    mutate();
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="text-[0.6rem] font-semibold tracking-[0.14em] uppercase text-[#484d63] shrink-0">
        Submit for Review
      </div>

      {/* Doc type selector */}
      <div className="flex flex-wrap gap-1.5 shrink-0">
        {DOC_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setDocType(t)}
            className="px-2.5 py-1 rounded-md text-[0.65rem] font-medium capitalize transition-all"
            style={{
              background: docType === t ? "rgba(var(--accent-rgb),0.12)" : "rgba(255,255,255,0.04)",
              border: docType === t ? "1px solid rgba(var(--accent-rgb),0.35)" : "1px solid rgba(255,255,255,0.07)",
              color: docType === t ? "var(--accent)" : "#484d63",
            }}
          >
            {t.replace("_", " ")}
          </button>
        ))}
      </div>

      <textarea
        value={doc}
        onChange={(e) => setDoc(e.target.value)}
        placeholder="Paste your document here — resume, cover letter, LinkedIn post, or strategy…"
        className="flex-1 rounded-xl px-4 py-3 text-[0.73rem] text-[#f1f1f3] resize-none outline-none placeholder:text-[#2a2d3a] leading-relaxed"
        style={{ background: "#0e1015", border: "1px solid rgba(255,255,255,0.08)", minHeight: 0 }}
        onFocus={(e) => { e.target.style.borderColor = "rgba(var(--accent-rgb),0.3)"; }}
        onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
      />

      {/* Persona preview */}
      <div className="flex gap-2 shrink-0">
        {PERSONAS.map((p) => {
          const Icon = p.icon;
          return (
            <div
              key={p.id}
              className="flex-1 flex flex-col items-center gap-1.5 rounded-lg py-2"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <Icon size={12} style={{ color: p.color }} />
              <span className="text-[0.55rem] text-[#484d63] text-center leading-tight">{p.name}</span>
            </div>
          );
        })}
      </div>

      <button
        onClick={submit}
        disabled={!doc.trim() || running}
        className="shrink-0 w-full rounded-xl py-3 text-[0.78rem] font-bold text-black transition-all hover:-translate-y-0.5 disabled:opacity-30 flex items-center justify-center gap-2"
        style={{ background: "var(--accent)", boxShadow: "0 4px 20px rgba(var(--accent-rgb),0.2)" }}
      >
        {running ? (
          <>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
              <Sparkles size={14} />
            </motion.div>
            5 experts reviewing… (~30s)
          </>
        ) : (
          <><Sparkles size={14} /> Launch Expert Panel</>
        )}
      </button>
    </div>
  );
}

/* ── Main page ── */
export default function PanelPage() {
  const profile = useProfile();
  const profileId = profile?.id;
  const qc = useQueryClient();
  const [view, setView] = useState<"submit" | "review">("submit");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: rawSessions } = useQuery({
    queryKey: ["panel", profileId],
    queryFn: () => api.panel.list(profileId!),
    enabled: !!profileId,
  });
  const sessions = Array.isArray(rawSessions) ? rawSessions : [];

  const { mutate: deleteSession } = useMutation({
    mutationFn: (id: number) => api.panel.delete(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["panel", profileId] });
      if (selectedId === id) setSelectedId(null);
    },
  });

  const selectedSession = sessions.find((s) => s.id === selectedId);

  return (
    <div className="flex flex-col h-full gap-5">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-end justify-between shrink-0"
      >
        <h1 className="text-[1.9rem] font-bold tracking-[-0.03em] text-[#f1f1f3]">Expert Panel</h1>
        <div className="flex gap-1.5">
          {(["submit", "review"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-3 py-1.5 rounded-lg text-[0.65rem] font-semibold capitalize transition-all"
              style={{
                background: view === v ? "rgba(var(--accent-rgb),0.12)" : "rgba(255,255,255,0.04)",
                color: view === v ? "var(--accent)" : "#484d63",
                border: view === v ? "1px solid rgba(var(--accent-rgb),0.3)" : "1px solid rgba(255,255,255,0.07)",
              }}
            >
              {v === "submit" ? "Submit" : "History"}
            </button>
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        {/* Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.08 }}
          className="col-span-3 flex flex-col gap-2 overflow-y-auto min-h-0"
        >
          <div className="text-[0.6rem] font-semibold tracking-[0.14em] uppercase text-[#484d63] mb-1 shrink-0">
            Session History
          </div>
          <AnimatePresence initial={false}>
            {sessions.map((s) => (
              <SessionItem
                key={s.id}
                session={s}
                selected={s.id === selectedId}
                onSelect={() => { setSelectedId(s.id); setView("review"); }}
                onDelete={() => deleteSession(s.id)}
              />
            ))}
          </AnimatePresence>
          {sessions.length === 0 && (
            <div className="text-[0.68rem] text-[#484d63] flex items-center gap-1.5">
              <ChevronRight size={11} /> No sessions yet
            </div>
          )}
        </motion.div>

        {/* Main */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="col-span-9 min-h-0"
        >
          <AnimatePresence mode="wait">
            {view === "submit" && profileId ? (
              <motion.div key="submit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <SubmitForm
                  profileId={profileId}
                  onDone={(s) => { setSelectedId(s.id); setView("review"); }}
                />
              </motion.div>
            ) : view === "review" && selectedSession ? (
              <motion.div key={`review-${selectedSession.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <SessionDetail session={selectedSession} />
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center h-full text-[0.72rem] text-[#484d63]">
                {view === "review" ? "Select a session to view reviews" : null}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
