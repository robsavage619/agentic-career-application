"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Trash2, Sparkles, Clock, Plus } from "lucide-react";
import { api, type CoverLetter } from "@/lib/api";
import { useProfile } from "@/lib/hooks/use-profile";

/* ── Letter list sidebar ── */
function LetterItem({
  letter, selected, onSelect, onDelete,
}: {
  letter: CoverLetter; selected: boolean; onSelect: () => void; onDelete: () => void;
}) {
  const preview = letter.content.slice(0, 60).replace(/\n/g, " ");
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
        <div className="text-[0.72rem] text-[#f1f1f3] truncate">{preview || "Empty draft"}</div>
        <div className="text-[0.6rem] text-[#484d63] mt-0.5">
          {new Date(letter.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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

/* ── Generate form ── */
function GenerateForm({
  profileId, onDone,
}: {
  profileId: number; onDone: (letter: CoverLetter) => void;
}) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jd, setJd] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [draft, setDraft] = useState("");

  // Pre-fill from analyzer/pipeline handoff
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const fromJd = sp.get("jd");
    if (fromJd && !jd) setJd(decodeURIComponent(fromJd));
    const fromTitle = sp.get("title");
    if (fromTitle && !title) setTitle(decodeURIComponent(fromTitle));
    const cardId = sp.get("card");
    if (cardId && !jd) {
      api.pipeline.list(profileId).then((cards) => {
        const card = cards.find((c) => c.id === Number(cardId));
        if (card) {
          if (card.notes && !jd) setJd(card.notes);
          if (card.title && !title) setTitle(card.title);
          if (card.company && !company) setCompany(card.company);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  async function generate() {
    if (!title || !company || !jd.trim()) return;
    setStreaming(true);
    setDraft("");
    const res = await api.letters.generateStream({
      profile_id: profileId,
      job_title: title,
      company,
      job_description: jd,
    });
    if (!res.body) { setStreaming(false); return; }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulated = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const chunk = line.slice(6);
        if (chunk === "[DONE]") {
          setStreaming(false);
          // Fetch updated list to get the saved letter id
          const letters = await api.letters.list(profileId);
          const newest = letters[0];
          if (newest) onDone(newest);
          return;
        }
        accumulated += chunk;
        setDraft(accumulated);
      }
    }
    setStreaming(false);
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="text-[0.6rem] font-semibold tracking-[0.14em] uppercase text-[#484d63] shrink-0">
        Generate New Letter
      </div>
      <div className="grid grid-cols-2 gap-2 shrink-0">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Role title…"
          className="rounded-lg px-3 py-2 text-[0.75rem] text-[#f1f1f3] outline-none placeholder:text-[#2a2d3a]"
          style={{ background: "#0e1015", border: "1px solid rgba(255,255,255,0.08)" }}
          onFocus={(e) => { e.target.style.borderColor = "rgba(var(--accent-rgb),0.35)"; }}
          onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
        />
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Company…"
          className="rounded-lg px-3 py-2 text-[0.75rem] text-[#f1f1f3] outline-none placeholder:text-[#2a2d3a]"
          style={{ background: "#0e1015", border: "1px solid rgba(255,255,255,0.08)" }}
          onFocus={(e) => { e.target.style.borderColor = "rgba(var(--accent-rgb),0.35)"; }}
          onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
        />
      </div>
      <textarea
        value={jd}
        onChange={(e) => setJd(e.target.value)}
        placeholder="Paste job description…"
        className="rounded-xl px-3 py-2.5 text-[0.73rem] text-[#f1f1f3] resize-none outline-none placeholder:text-[#2a2d3a] leading-relaxed"
        style={{ background: "#0e1015", border: "1px solid rgba(255,255,255,0.08)", height: 120 }}
        onFocus={(e) => { e.target.style.borderColor = "rgba(var(--accent-rgb),0.3)"; }}
        onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
      />
      {draft && (
        <div
          className="flex-1 overflow-y-auto rounded-xl px-3 py-2.5 text-[0.73rem] text-[#8b8fa8] leading-relaxed whitespace-pre-wrap"
          style={{ background: "#0e1015", border: "1px solid rgba(255,255,255,0.06)", minHeight: 80 }}
        >
          {draft}
          {streaming && (
            <motion.span
              animate={{ opacity: [1, 0, 1] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="inline-block w-0.5 h-3.5 ml-0.5 align-middle"
              style={{ background: "var(--accent)" }}
            />
          )}
        </div>
      )}
      <button
        onClick={generate}
        disabled={!title || !company || !jd.trim() || streaming}
        className="shrink-0 w-full rounded-xl py-2.5 text-[0.75rem] font-bold text-black transition-all hover:-translate-y-0.5 disabled:opacity-30 flex items-center justify-center gap-2"
        style={{ background: "var(--accent)" }}
      >
        {streaming ? (
          <>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
              <Sparkles size={13} />
            </motion.div>
            Generating…
          </>
        ) : (
          <><Sparkles size={13} /> Generate Cover Letter</>
        )}
      </button>
    </div>
  );
}

/* ── Editor panel ── */
function EditorPanel({ letter }: { letter: CoverLetter }) {
  const qc = useQueryClient();
  const [content, setContent] = useState(letter.content);
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    setSaving(true);
    await api.letters.update(letter.id, content);
    await qc.invalidateQueries({ queryKey: ["letters", letter.profile_id] });
    setSaving(false);
  }, [content, letter.id, letter.profile_id, qc]);

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between shrink-0">
        <div className="text-[0.6rem] font-semibold tracking-[0.14em] uppercase text-[#484d63]">Editor</div>
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving || content === letter.content}
            className="text-[0.65rem] font-semibold transition-all disabled:opacity-30"
            style={{ color: "var(--accent)" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <a
            href={api.letters.downloadUrl(letter.id)}
            download
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[0.62rem] font-semibold transition-all hover:-translate-y-0.5"
            style={{ background: "rgba(var(--accent-rgb),0.1)", color: "var(--accent)", border: "1px solid rgba(var(--accent-rgb),0.2)" }}
          >
            <Download size={10} /> DOCX
          </a>
        </div>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="flex-1 rounded-xl px-4 py-3 text-[0.75rem] text-[#f1f1f3] resize-none outline-none leading-relaxed"
        style={{ background: "#0e1015", border: "1px solid rgba(255,255,255,0.08)", minHeight: 0 }}
        onFocus={(e) => { e.target.style.borderColor = "rgba(var(--accent-rgb),0.3)"; }}
        onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
      />
    </div>
  );
}

/* ── Main page ── */
export default function LettersPage() {
  const profile = useProfile();
  const profileId = profile?.id;
  const qc = useQueryClient();
  const [view, setView] = useState<"generate" | "edit">("generate");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: rawLetters } = useQuery({
    queryKey: ["letters", profileId],
    queryFn: () => api.letters.list(profileId!),
    enabled: !!profileId,
  });
  const letters = Array.isArray(rawLetters) ? rawLetters : [];

  const { mutate: deleteLetter } = useMutation({
    mutationFn: (id: number) => api.letters.delete(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["letters", profileId] });
      if (selectedId === id) setSelectedId(null);
    },
  });

  const selectedLetter = letters.find((l) => l.id === selectedId);

  return (
    <div className="flex flex-col h-full gap-5">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-end justify-between shrink-0"
      >
        <h1 className="text-[1.9rem] font-bold tracking-[-0.03em] text-[#f1f1f3]">Cover Letters</h1>
        <div className="flex gap-1.5">
          {(["generate", "edit"] as const).map((v) => (
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
              {v === "generate" ? <><Plus size={10} className="inline mr-1" />Generate</> : "Edit"}
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
            Saved Letters
          </div>
          <AnimatePresence initial={false}>
            {letters.map((l) => (
              <LetterItem
                key={l.id}
                letter={l}
                selected={l.id === selectedId}
                onSelect={() => { setSelectedId(l.id); setView("edit"); }}
                onDelete={() => deleteLetter(l.id)}
              />
            ))}
          </AnimatePresence>
          {letters.length === 0 && (
            <div className="text-[0.68rem] text-[#484d63]">No letters yet — generate one.</div>
          )}
        </motion.div>

        {/* Main panel */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="col-span-9 min-h-0"
        >
          <AnimatePresence mode="wait">
            {view === "generate" && profileId ? (
              <motion.div
                key="generate"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full"
              >
                <GenerateForm
                  profileId={profileId}
                  onDone={(letter) => { setSelectedId(letter.id); setView("edit"); qc.invalidateQueries({ queryKey: ["letters", profileId] }); }}
                />
              </motion.div>
            ) : view === "edit" && selectedLetter ? (
              <motion.div
                key={`edit-${selectedLetter.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full"
              >
                <EditorPanel letter={selectedLetter} />
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center h-full text-[0.72rem] text-[#484d63]"
              >
                {view === "edit" ? "Select a letter to edit" : null}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
