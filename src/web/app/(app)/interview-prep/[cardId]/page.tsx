"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Sparkles, FileDown, Loader2, ArrowLeft,
  CheckCircle2, RotateCcw,
} from "lucide-react";
import { useProfile } from "@/lib/hooks/use-profile";
import { api, type PipelineCard, type InterviewPrepData } from "@/lib/api";

const MONO = "'Geist Mono Variable', 'Geist Mono', ui-monospace, 'SF Mono', 'Menlo', monospace";

export default function InterviewPrepPage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = use(params);
  const cardIdNum = Number(cardId);
  const profile = useProfile();
  const profileId = profile?.id;
  const qc = useQueryClient();

  // Fetch the pipeline card itself
  const cardQuery = useQuery<PipelineCard | undefined>({
    queryKey: ["pipeline-card", profileId, cardIdNum],
    queryFn: async () => {
      const all = await api.pipeline.list(profileId!);
      return all.find((c) => c.id === cardIdNum);
    },
    enabled: !!profileId && !!cardIdNum,
  });

  // Fetch existing prep
  const prepQuery = useQuery<InterviewPrepData | null>({
    queryKey: ["interview-prep", cardIdNum],
    queryFn: () => api.interviewPrep.get(cardIdNum),
    enabled: !!cardIdNum,
  });

  const [jdInput, setJdInput] = useState("");

  useEffect(() => {
    if (cardQuery.data?.notes && !jdInput) setJdInput(cardQuery.data.notes);
  }, [cardQuery.data, jdInput]);

  const generate = useMutation({
    mutationFn: () =>
      api.interviewPrep.generate({
        pipeline_card_id: cardIdNum,
        job_description: jdInput,
      }),
    onSuccess: (data) => {
      qc.setQueryData(["interview-prep", cardIdNum], data);
    },
  });

  const [writingBack, setWritingBack] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleWriteback() {
    if (!prepQuery.data) return;
    setWritingBack("saving");
    try {
      const r = await api.interviewPrep.writeback(prepQuery.data.id);
      setWritingBack(r.written ? "saved" : "error");
      setTimeout(() => setWritingBack("idle"), 2400);
    } catch {
      setWritingBack("error");
      setTimeout(() => setWritingBack("idle"), 2400);
    }
  }

  if (!profile) return null;
  const card = cardQuery.data;
  const prep = prepQuery.data;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header>
        <Link
          href="/pipeline"
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
          <ArrowLeft size={11} /> BACK TO PIPELINE
        </Link>
        <div className="flex items-center gap-2.5 mb-2">
          <Users size={14} style={{ color: "var(--accent)" }} />
          <span className="chrome">Interview prep</span>
        </div>
        <h1>
          {card ? `${card.title} @ ${card.company}` : "Loading…"}
        </h1>
        <p style={{ marginTop: 8, fontSize: "0.95rem", color: "var(--text-secondary)", letterSpacing: "-0.005em", maxWidth: 620 }}>
          The agent drafts likely questions from the JD and grounds STAR answers in your vault accomplishments. Save the result back to your vault to read offline.
        </p>
      </header>

      {/* JD input */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "16px 18px",
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="chrome">Job context</span>
          <span style={{ fontFamily: MONO, fontSize: "0.6rem", color: "var(--text-muted)", letterSpacing: "0.04em" }}>
            {jdInput.length.toLocaleString()} CHARS
          </span>
        </div>
        <textarea
          value={jdInput}
          onChange={(e) => setJdInput(e.target.value)}
          placeholder="Paste the JD or your notes about this role — the agent uses this to predict question topics."
          style={{
            width: "100%",
            minHeight: 120,
            padding: "10px 12px",
            borderRadius: "var(--radius)",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            fontSize: "0.85rem",
            outline: "none",
            resize: "vertical",
            lineHeight: 1.55,
            fontFamily: "inherit",
            letterSpacing: "-0.005em",
          }}
        />
        <div className="flex items-center justify-end gap-2 mt-3">
          <button
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "9px 18px",
              borderRadius: "var(--radius)",
              background: generate.isPending ? "var(--surface-3)" : "var(--accent)",
              color: generate.isPending ? "var(--text-muted)" : "var(--accent-text)",
              fontSize: "0.825rem",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              border: "none",
              cursor: generate.isPending ? "not-allowed" : "pointer",
            }}
          >
            {generate.isPending ? <Loader2 size={13} className="animate-spin" /> : prep ? <RotateCcw size={13} /> : <Sparkles size={13} />}
            {generate.isPending ? "Drafting prep…" : prep ? "Regenerate" : "Generate prep"}
          </button>
        </div>
      </div>

      {/* Prep content */}
      {prepQuery.isLoading ? (
        <div style={{ padding: 40, fontFamily: MONO, fontSize: "0.7rem", color: "var(--text-muted)", letterSpacing: "0.04em", textAlign: "center" }}>
          LOADING…
        </div>
      ) : prep ? (
        <PrepResult prep={prep} writingBack={writingBack} onWriteback={handleWriteback} />
      ) : (
        <div
          style={{
            padding: "40px 24px",
            textAlign: "center",
            background: "var(--surface)",
            border: "1px dashed var(--border-strong)",
            borderRadius: "var(--radius-lg)",
            color: "var(--text-muted)",
            fontFamily: MONO,
            fontSize: "0.7rem",
            letterSpacing: "0.04em",
          }}
        >
          NO PREP YET — GENERATE ONE TO SEE QUESTIONS, STAR ANSWERS, AND VAULT EVIDENCE.
        </div>
      )}

      {generate.isError && (
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
          Generation failed. Make sure the API is up and the vault is reachable.
        </div>
      )}
    </div>
  );
}

function PrepResult({ prep, writingBack, onWriteback }: {
  prep: InterviewPrepData;
  writingBack: "idle" | "saving" | "saved" | "error";
  onWriteback: () => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14 }}>
      {/* Markdown content */}
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
            padding: "12px 18px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div className="flex items-center gap-2">
            <span className="chrome">Prep · {new Date(prep.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
            {prep.vault_path && (
              <span style={{ fontFamily: MONO, fontSize: "0.6rem", color: "var(--vault-purple)", letterSpacing: "0.04em" }}>
                · IN VAULT
              </span>
            )}
          </div>
          <button
            onClick={onWriteback}
            disabled={writingBack === "saving"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 11px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(160,121,255,0.3)",
              background: "var(--vault-soft)",
              color: "var(--vault-purple)",
              fontSize: "0.72rem",
              fontWeight: 600,
              cursor: writingBack === "saving" ? "not-allowed" : "pointer",
            }}
          >
            {writingBack === "saving" ? <Loader2 size={11} className="animate-spin" /> : writingBack === "saved" ? <CheckCircle2 size={11} /> : <FileDown size={11} />}
            {writingBack === "saved" ? "Saved" : writingBack === "error" ? "Vault offline" : "Save to vault"}
          </button>
        </div>
        <pre
          style={{
            padding: "20px 22px 24px",
            fontFamily: "inherit",
            fontSize: "0.875rem",
            color: "var(--text-secondary)",
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            letterSpacing: "-0.005em",
            margin: 0,
          }}
        >
          {prep.content}
        </pre>
      </div>

      {/* Evidence */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          alignSelf: "flex-start",
        }}
      >
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <span className="chrome">Vault evidence</span>
            <span style={{ fontFamily: MONO, fontSize: "0.6rem", color: "var(--vault-purple)", letterSpacing: "0.04em" }}>
              · {prep.evidence.length} HITS
            </span>
          </div>
        </div>
        {prep.evidence.length === 0 ? (
          <div style={{ padding: "16px 18px", fontFamily: MONO, fontSize: "0.7rem", color: "var(--text-muted)", letterSpacing: "0.04em" }}>
            NO HITS — VAULT MAY BE OFFLINE.
          </div>
        ) : (
          prep.evidence.map((e, i) => (
            <div key={i} style={{ padding: "12px 18px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
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
                {e.filename}
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
                {e.context}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
