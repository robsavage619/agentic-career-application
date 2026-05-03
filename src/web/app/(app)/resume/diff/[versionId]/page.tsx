"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { api, type ResumeDiffPair, type ResumeDiffResult } from "@/lib/api";

const MONO = "'Geist Mono Variable', 'Geist Mono', ui-monospace, 'SF Mono', 'Menlo', monospace";

const KIND_COLOR: Record<ResumeDiffPair["kind"], string> = {
  unchanged: "var(--text-muted)",
  changed: "var(--amber)",
  added: "var(--green)",
  removed: "var(--red)",
};

const KIND_LABEL: Record<ResumeDiffPair["kind"], string> = {
  unchanged: "·",
  changed: "≠",
  added: "+",
  removed: "−",
};

export default function ResumeDiffPage({ params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = use(params);
  const versionIdNum = Number(versionId);

  const { data, isLoading, isError } = useQuery<ResumeDiffResult>({
    queryKey: ["resume-diff", versionIdNum],
    queryFn: () => api.resume.diff(versionIdNum),
    enabled: !!versionIdNum,
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header>
        <Link
          href="/resume"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontFamily: MONO,
            fontSize: "0.65rem",
            letterSpacing: "0.06em",
            color: "var(--text-muted)",
            marginBottom: 12,
          }}
        >
          <ArrowLeft size={11} /> BACK TO RESUME
        </Link>
        <div className="flex items-center gap-2.5 mb-2">
          <FileText size={14} style={{ color: "var(--accent)" }} />
          <span className="chrome">Resume diff</span>
        </div>
        <div className="flex items-end justify-between">
          <h1>Base vs. tailored.</h1>
          {data && (
            <a
              href={api.resume.downloadUrl(data.version_id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: "var(--radius)",
                background: "var(--accent)",
                color: "var(--accent-text)",
                fontSize: "0.8rem",
                fontWeight: 600,
                letterSpacing: "-0.01em",
                textDecoration: "none",
              }}
            >
              <Download size={12} />
              Download .docx
            </a>
          )}
        </div>
        {data && (
          <div className="flex items-center gap-2 mt-3" style={{ fontFamily: MONO, fontSize: "0.65rem", letterSpacing: "0.05em" }}>
            <span style={{ color: "var(--text-muted)" }}>
              {new Date(data.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).toUpperCase()}
            </span>
            <span style={{ color: "var(--border-strong)" }}>·</span>
            <span style={{ color: "var(--accent)", textShadow: "0 0 6px var(--accent)" }}>
              {data.changes} CHANGES
            </span>
            <span style={{ color: "var(--border-strong)" }}>·</span>
            <span style={{ color: "var(--text-muted)" }}>{data.total} TOTAL LINES</span>
          </div>
        )}
      </header>

      {isLoading && (
        <div style={{ padding: 40, fontFamily: MONO, fontSize: "0.7rem", color: "var(--text-muted)", letterSpacing: "0.04em", textAlign: "center" }}>
          LOADING DIFF…
        </div>
      )}

      {isError && (
        <div
          style={{
            padding: "12px 16px",
            border: "1px solid rgba(248,113,113,0.3)",
            background: "var(--red-soft)",
            borderRadius: "var(--radius-lg)",
            color: "var(--red)",
            fontSize: "0.85rem",
          }}
        >
          Couldn't load the diff. Version may not exist.
        </div>
      )}

      {data && (
        <>
          {/* Column headers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "32px 1fr 1fr",
              gap: 10,
              padding: "0 4px",
            }}
          >
            <div />
            <div className="chrome">BASE</div>
            <div className="chrome" style={{ color: "var(--accent)" }}>TAILORED</div>
          </div>

          {/* Diff rows */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
            }}
          >
            {data.pairs.map((pair, i) => (
              <DiffRow key={i} pair={pair} index={i} />
            ))}
          </div>

          {/* JD snapshot */}
          {data.jd_snapshot && (
            <details
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "12px 18px",
              }}
            >
              <summary style={{ cursor: "pointer", listStyle: "none" }}>
                <span className="chrome">JD snapshot at generation time</span>
              </summary>
              <pre
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface-2)",
                  fontFamily: "inherit",
                  fontSize: "0.78rem",
                  color: "var(--text-tertiary)",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {data.jd_snapshot}
              </pre>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function DiffRow({ pair, index }: { pair: ResumeDiffPair; index: number }) {
  const color = KIND_COLOR[pair.kind];
  const label = KIND_LABEL[pair.kind];
  const dim = pair.kind === "unchanged";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "32px 1fr 1fr",
        gap: 10,
        alignItems: "stretch",
        borderTop: index === 0 ? "none" : "1px solid var(--border)",
        background: pair.kind === "unchanged" ? "transparent" : `${color}08`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: MONO,
          fontSize: "0.7rem",
          fontWeight: 700,
          color,
          background: pair.kind === "unchanged" ? "transparent" : `${color}12`,
          borderRight: "1px solid var(--border)",
          opacity: dim ? 0.5 : 1,
        }}
      >
        {label}
      </div>
      <div
        style={{
          padding: "10px 14px",
          fontSize: "0.82rem",
          color: dim ? "var(--text-tertiary)" : "var(--text-secondary)",
          lineHeight: 1.55,
          letterSpacing: "-0.005em",
          opacity: pair.base ? 1 : 0.3,
          borderRight: "1px solid var(--border)",
          fontStyle: pair.base ? "normal" : "italic",
        }}
      >
        {pair.base || "(blank)"}
      </div>
      <div
        style={{
          padding: "10px 14px",
          fontSize: "0.82rem",
          color: dim ? "var(--text-tertiary)" : "var(--text-primary)",
          lineHeight: 1.55,
          letterSpacing: "-0.005em",
          fontWeight: pair.kind === "added" || pair.kind === "changed" ? 500 : 400,
          opacity: pair.version ? 1 : 0.3,
          fontStyle: pair.version ? "normal" : "italic",
        }}
      >
        {pair.version || "(blank)"}
      </div>
    </div>
  );
}
