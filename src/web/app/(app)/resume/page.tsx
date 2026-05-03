"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Download, Trash2, Sparkles, FileText, ChevronRight, Clock } from "lucide-react";
import { api, type BaseResume, type ResumeVersion } from "@/lib/api";
import { useProfile } from "@/lib/hooks/use-profile";

function BaseResumeCard({
  resume, selected, onSelect, onDelete,
}: {
  resume: BaseResume; selected: boolean; onSelect: () => void; onDelete: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      onClick={onSelect}
      className="flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer transition-all"
      style={{
        background: selected ? "rgba(var(--accent-rgb),0.08)" : "#0e1015",
        border: selected ? "1px solid rgba(var(--accent-rgb),0.25)" : "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <FileText size={15} style={{ color: selected ? "var(--accent)" : "#484d63", flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <div className="text-[0.78rem] font-medium text-[#f1f1f3] truncate">{resume.name}</div>
        <div className="text-[0.62rem] text-[#484d63] mt-0.5">{new Date(resume.uploaded_at).toLocaleDateString()}</div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="p-1 rounded transition-colors hover:text-[#ef4444]"
        style={{ color: "#2a2d3a" }}
      >
        <Trash2 size={12} />
      </button>
    </motion.div>
  );
}

function VersionRow({ version }: { version: ResumeVersion }) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2.5"
      style={{ background: "#0e1015", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <Clock size={11} style={{ color: "#484d63" }} />
      <div className="flex-1 min-w-0">
        <div className="text-[0.7rem] text-[#f1f1f3] truncate">{version.jd_snapshot || "Untitled"}</div>
        <div className="text-[0.6rem] text-[#484d63] mt-0.5">
          {new Date(version.created_at).toLocaleDateString("en-US", {
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
          })}
        </div>
      </div>
      <a
        href={api.resume.downloadUrl(version.id)}
        download
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[0.62rem] font-semibold transition-all hover:-translate-y-0.5"
        style={{ background: "rgba(var(--accent-rgb),0.1)", color: "var(--accent)", border: "1px solid rgba(var(--accent-rgb),0.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <Download size={10} /> DOCX
      </a>
    </div>
  );
}

export default function ResumePage() {
  const profile = useProfile();
  const profileId = profile?.id;
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedBaseId, setSelectedBaseId] = useState<number | null>(null);
  const [jd, setJd] = useState("");
  const [generating, setGenerating] = useState(false);

  const { data: rawBases } = useQuery({
    queryKey: ["resume-bases", profileId],
    queryFn: () => api.resume.listBases(profileId!),
    enabled: !!profileId,
  });
  const bases = Array.isArray(rawBases) ? rawBases : [];

  const { data: rawVersions } = useQuery({
    queryKey: ["resume-versions", selectedBaseId],
    queryFn: () => api.resume.listVersions(selectedBaseId!),
    enabled: !!selectedBaseId,
  });
  const versions = Array.isArray(rawVersions) ? rawVersions : [];

  const { mutate: uploadResume, isPending: uploading } = useMutation({
    mutationFn: (file: File) => api.resume.upload(profileId!, file),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["resume-bases", profileId] });
      setSelectedBaseId(res.id);
    },
  });

  const { mutate: deleteBase } = useMutation({
    mutationFn: (id: number) => api.resume.deleteBase(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resume-bases", profileId] });
      setSelectedBaseId(null);
    },
  });

  async function generate() {
    if (!selectedBaseId || !jd.trim()) return;
    setGenerating(true);
    try {
      await api.resume.generate({ base_resume_id: selectedBaseId, job_description: jd });
      qc.invalidateQueries({ queryKey: ["resume-versions", selectedBaseId] });
    } finally {
      setGenerating(false);
    }
  }

  const selectedBase = bases.find((b) => b.id === selectedBaseId);

  return (
    <div className="flex flex-col h-full gap-5">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-end justify-between shrink-0"
      >
        <h1 className="text-[1.9rem] font-bold tracking-[-0.03em] text-[#f1f1f3]">Resume Engine</h1>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading || !profileId}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.68rem] font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-40"
          style={{ background: "var(--accent)", color: "#000" }}
        >
          <Upload size={12} />
          {uploading ? "Uploading…" : "Upload Resume"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".docx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadResume(f);
            e.target.value = "";
          }}
        />
      </motion.div>

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        {/* Base resumes */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.08 }}
          className="col-span-3 flex flex-col gap-2 overflow-y-auto min-h-0"
        >
          <div className="text-[0.6rem] font-semibold tracking-[0.14em] uppercase text-[#484d63] mb-1 shrink-0">
            Base Resumes
          </div>
          <AnimatePresence initial={false}>
            {bases.map((b) => (
              <BaseResumeCard
                key={b.id}
                resume={b}
                selected={b.id === selectedBaseId}
                onSelect={() => setSelectedBaseId(b.id)}
                onDelete={() => deleteBase(b.id)}
              />
            ))}
          </AnimatePresence>
          {bases.length === 0 && (
            <div
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 rounded-xl p-6 cursor-pointer border border-dashed transition-all hover:border-[rgba(var(--accent-rgb),0.3)]"
              style={{ borderColor: "rgba(255,255,255,0.07)", background: "#0e1015" }}
            >
              <Upload size={20} style={{ color: "#2a2d3a" }} />
              <span className="text-[0.68rem] text-[#484d63] text-center">Upload a .docx to get started</span>
            </div>
          )}
        </motion.div>

        {/* JD + generate */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="col-span-5 flex flex-col gap-3 min-h-0"
        >
          <div className="text-[0.6rem] font-semibold tracking-[0.14em] uppercase text-[#484d63]">
            Job Description
          </div>
          <textarea
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            placeholder="Paste the full job description here…"
            className="flex-1 rounded-xl px-4 py-3 text-[0.75rem] text-[#f1f1f3] resize-none outline-none placeholder:text-[#2a2d3a] leading-relaxed"
            style={{ background: "#0e1015", border: "1px solid rgba(255,255,255,0.08)", minHeight: 0 }}
            onFocus={(e) => { e.target.style.borderColor = "rgba(var(--accent-rgb),0.3)"; }}
            onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
          />
          <div
            className="rounded-xl p-3 flex gap-2.5"
            style={{ background: "rgba(var(--accent-rgb),0.05)", border: "1px solid rgba(var(--accent-rgb),0.12)" }}
          >
            <Sparkles size={12} className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
            <p className="text-[0.68rem] text-[#8b8fa8] leading-relaxed">
              Claude rewrites bullets to match the JD — same format, same voice, stronger keywords.
              RAG vault context injected automatically.
            </p>
          </div>
          <button
            onClick={generate}
            disabled={!selectedBaseId || !jd.trim() || generating}
            className="w-full rounded-xl py-3 text-[0.78rem] font-bold tracking-wide text-black transition-all hover:-translate-y-0.5 disabled:opacity-30 flex items-center justify-center gap-2"
            style={{ background: "var(--accent)", boxShadow: "0 4px 20px rgba(var(--accent-rgb),0.2)" }}
          >
            {generating ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                  <Sparkles size={14} />
                </motion.div>
                Generating…
              </>
            ) : (
              <><Sparkles size={14} /> Generate Tailored Resume</>
            )}
          </button>
        </motion.div>

        {/* Version history */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="col-span-4 flex flex-col gap-2 overflow-y-auto min-h-0"
        >
          <div className="text-[0.6rem] font-semibold tracking-[0.14em] uppercase text-[#484d63] mb-1 shrink-0">
            Version History
            {selectedBase && <span className="ml-1.5 normal-case tracking-normal text-[#2a2d3a]">— {selectedBase.name}</span>}
          </div>
          {!selectedBaseId && (
            <div className="text-[0.68rem] text-[#484d63] flex items-center gap-1.5 mt-2">
              <ChevronRight size={11} /> Select a base resume to see versions
            </div>
          )}
          <AnimatePresence initial={false}>
            {versions.map((v) => (
              <motion.div key={v.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <VersionRow version={v} />
              </motion.div>
            ))}
          </AnimatePresence>
          {selectedBaseId && versions.length === 0 && (
            <div className="text-[0.68rem] text-[#484d63]">No versions yet — generate one above.</div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
