"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Target, Sparkles, FileText, Mail, ArrowRight, Loader2 } from "lucide-react";
import { useProfile } from "@/lib/hooks/use-profile";
import { api, type FitScore, type FitEvidence } from "@/lib/api";

const MONO = "'Geist Mono Variable', 'Geist Mono', ui-monospace, 'SF Mono', 'Menlo', monospace";

function scoreColor(s: number) {
  if (s >= 75) return "var(--green)";
  if (s >= 55) return "var(--amber)";
  return "var(--red)";
}

function scoreLabel(s: number) {
  if (s >= 85) return "STRONG FIT";
  if (s >= 70) return "GOOD FIT";
  if (s >= 55) return "MIXED";
  if (s >= 40) return "WEAK";
  return "POOR FIT";
}

export default function AnalyzePage() {
  const profile = useProfile();
  const profileId = profile?.id;

  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jd, setJd] = useState("");

  const score = useMutation({
    mutationFn: () =>
      api.fit.score({
        profile_id: profileId!,
        job_description: jd,
        job_title: jobTitle,
        company,
      }),
  });

  const result = score.data;

  if (!profile) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header>
        <div className="flex items-center gap-2.5 mb-2">
          <Target size={14} style={{ color: "var(--accent)" }} />
          <span className="chrome">JD analyzer</span>
        </div>
        <h1>Score a fit against your vault.</h1>
        <p style={{ marginTop: 8, fontSize: "0.95rem", color: "var(--text-secondary)", letterSpacing: "-0.005em", maxWidth: 620 }}>
          Paste a JD. The agent extracts requirements, hits your Obsidian vault for evidence, and returns a 0–100 fit score with strengths, gaps, and concrete next actions.
        </p>
      </header>

      {/* Input panel */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-lg)",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="Job title (optional)"
            style={inputStyle}
          />
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Company (optional)"
            style={inputStyle}
          />
        </div>
        <textarea
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          placeholder="Paste the full job description here…"
          style={{
            ...inputStyle,
            minHeight: 200,
            resize: "vertical",
            lineHeight: 1.6,
          }}
        />
        <div className="flex items-center justify-between">
          <span style={{ fontFamily: MONO, fontSize: "0.65rem", color: "var(--text-muted)", letterSpacing: "0.04em" }}>
            {jd.length.toLocaleString()} CHARS
          </span>
          <button
            onClick={() => score.mutate()}
            disabled={!jd.trim() || score.isPending}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "9px 18px",
              borderRadius: "var(--radius)",
              background: !jd.trim() || score.isPending ? "var(--surface-3)" : "var(--accent)",
              color: !jd.trim() || score.isPending ? "var(--text-muted)" : "var(--accent-text)",
              fontSize: "0.825rem",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              border: "none",
              cursor: !jd.trim() || score.isPending ? "not-allowed" : "pointer",
            }}
          >
            {score.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {score.isPending ? "Scoring against vault…" : "Score this fit"}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && <ResultsPanel result={result} jobTitle={jobTitle} jd={jd} />}

      {/* Error state */}
      {score.isError && (
        <div
          style={{
            padding: "14px 16px",
            border: "1px solid rgba(248,113,113,0.3)",
            background: "var(--red-soft)",
            borderRadius: "var(--radius-lg)",
            color: "var(--red)",
            fontSize: "0.85rem",
          }}
        >
          Scoring failed. Make sure the API is running and the vault is reachable on port 27124.
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "var(--radius)",
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
  fontSize: "0.875rem",
  outline: "none",
  letterSpacing: "-0.005em",
  fontFamily: "inherit",
};

// ── Results ────────────────────────────────────────────────────────

function ResultsPanel({ result, jobTitle, jd }: { result: FitScore; jobTitle: string; jd: string }) {
  const score = result.score ?? 0;
  const sc = scoreColor(score);

  return (
    <div className="flex flex-col gap-4">
      {/* Score card */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-lg)",
          padding: "24px 26px",
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: 24,
          alignItems: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -50,
            left: -50,
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: `${sc}15`,
            filter: "blur(60px)",
            pointerEvents: "none",
          }}
        />
        {/* Big score */}
        <div style={{ position: "relative", display: "flex", alignItems: "baseline", gap: 4 }}>
          <span
            style={{
              fontFamily: MONO,
              fontVariantNumeric: "tabular-nums",
              fontSize: "4.5rem",
              fontWeight: 700,
              letterSpacing: "-0.06em",
              lineHeight: 1,
              color: sc,
              textShadow: `0 0 24px ${sc}`,
            }}
          >
            {result.score ?? "—"}
          </span>
          <span style={{ fontSize: "1.15rem", color: "var(--text-muted)", marginBottom: 8 }}>/100</span>
        </div>
        <div style={{ position: "relative", minWidth: 0 }}>
          <span
            className="chrome"
            style={{ color: sc, textShadow: `0 0 6px ${sc}`, marginBottom: 6, display: "inline-block" }}
          >
            {scoreLabel(score)}
          </span>
          <div
            style={{
              fontSize: "1rem",
              color: "var(--text-primary)",
              lineHeight: 1.5,
              letterSpacing: "-0.012em",
              fontWeight: 500,
            }}
          >
            {result.verdict || "—"}
          </div>
        </div>
      </div>

      {/* Two-column: analysis + evidence */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14 }}>
        {/* Analysis */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid var(--border)" }}>
            <span className="chrome">Analysis</span>
          </div>
          <pre
            style={{
              padding: "16px 18px 20px",
              fontFamily: "inherit",
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              letterSpacing: "-0.005em",
              margin: 0,
            }}
          >
            {result.output}
          </pre>
        </div>

        {/* Evidence */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <span className="chrome">Vault evidence</span>
              <span style={{ fontFamily: MONO, fontSize: "0.6rem", color: "var(--vault-purple)", letterSpacing: "0.05em" }}>
                · {result.evidence.length} HITS
              </span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {result.evidence.length === 0 ? (
              <div style={{ padding: "16px 18px", fontFamily: MONO, fontSize: "0.7rem", color: "var(--text-muted)", letterSpacing: "0.04em" }}>
                No vault hits — vault may be offline or this JD didn't match anything.
              </div>
            ) : (
              result.evidence.map((e, i) => <EvidenceCard key={i} evidence={e} />)
            )}
          </div>
        </div>
      </div>

      {/* Next actions */}
      <NextActions jobTitle={jobTitle} jd={jd} />
    </div>
  );
}

function EvidenceCard({ evidence }: { evidence: FitEvidence }) {
  return (
    <div
      style={{
        padding: "12px 18px",
        borderTop: "1px solid var(--border)",
        borderTopColor: "var(--border)",
      }}
    >
      <div
        style={{
          fontFamily: MONO,
          fontSize: "0.65rem",
          letterSpacing: "0.04em",
          color: "var(--vault-purple)",
          marginBottom: 5,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {evidence.filename}
      </div>
      <div
        style={{
          fontSize: "0.78rem",
          color: "var(--text-secondary)",
          lineHeight: 1.55,
          letterSpacing: "-0.003em",
          display: "-webkit-box",
          WebkitLineClamp: 4,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {evidence.context}
      </div>
    </div>
  );
}

function NextActions({ jobTitle, jd }: { jobTitle: string; jd: string }) {
  // Encode JD for query string handoff to other tools
  const encodedJd = encodeURIComponent(jd.slice(0, 4000));
  const encodedTitle = encodeURIComponent(jobTitle);

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "16px 18px",
      }}
    >
      <span className="chrome" style={{ display: "block", marginBottom: 10 }}>
        Next moves
      </span>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <ActionButton
          icon={FileText}
          label="Tailor resume to this JD"
          href={`/resume?jd=${encodedJd}&title=${encodedTitle}`}
        />
        <ActionButton
          icon={Mail}
          label="Draft a cover letter"
          href={`/letters?jd=${encodedJd}&title=${encodedTitle}`}
        />
      </div>
    </div>
  );
}

function ActionButton({ icon: Icon, label, href }: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 14px",
        borderRadius: "var(--radius)",
        background: "var(--surface-2)",
        border: "1px solid var(--border-strong)",
        color: "var(--text-primary)",
        fontSize: "0.825rem",
        fontWeight: 500,
        letterSpacing: "-0.01em",
        textDecoration: "none",
      }}
    >
      <Icon size={13} style={{ color: "var(--accent)" }} />
      <span>{label}</span>
      <ArrowRight size={12} style={{ color: "var(--text-muted)", marginLeft: 2 }} />
    </a>
  );
}
