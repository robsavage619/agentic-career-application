"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Send, Trash2, Clock, ExternalLink, Plus, Link } from "lucide-react";
import { api, type LinkedInPost } from "@/lib/api";
import { useProfile } from "@/lib/hooks/use-profile";

const STATUS_COLORS: Record<string, string> = {
  draft: "#484d63",
  scheduled: "#f59e0b",
  posted: "#22c55e",
};

/* ── Post card ── */
function PostCard({
  post, selected, onSelect, onDelete, onPublish,
}: {
  post: LinkedInPost; selected: boolean;
  onSelect: () => void; onDelete: () => void; onPublish: () => void;
}) {
  const preview = post.content.slice(0, 80).replace(/\n/g, " ");
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      onClick={onSelect}
      className="flex flex-col gap-2 rounded-xl px-3 py-3 cursor-pointer transition-all"
      style={{
        background: selected ? "rgba(var(--accent-rgb),0.08)" : "#0e1015",
        border: selected ? "1px solid rgba(var(--accent-rgb),0.25)" : "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ background: STATUS_COLORS[post.status] ?? "#484d63" }}
        />
        <span className="text-[0.6rem] text-[#484d63] capitalize">{post.status}</span>
        <span className="text-[0.58rem] text-[#2a2d3a] ml-auto">
          {new Date(post.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      </div>
      <div className="text-[0.72rem] text-[#8b8fa8] line-clamp-2">{preview}</div>
      <div className="flex items-center gap-1.5">
        {post.status === "draft" && (
          <button
            onClick={(e) => { e.stopPropagation(); onPublish(); }}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[0.6rem] font-semibold transition-all hover:opacity-80"
            style={{ background: "rgba(var(--accent-rgb),0.1)", color: "var(--accent)", border: "1px solid rgba(var(--accent-rgb),0.2)" }}
          >
            <Send size={9} /> Post
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="ml-auto p-1 rounded transition-colors hover:text-[#ef4444]"
          style={{ color: "#2a2d3a" }}
        >
          <Trash2 size={10} />
        </button>
      </div>
    </motion.div>
  );
}

/* ── Generate form ── */
function GenerateForm({ profileId, onDone }: { profileId: number; onDone: (p: LinkedInPost) => void }) {
  const [topic, setTopic] = useState("");
  const [angle, setAngle] = useState("");
  const qc = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: () => api.linkedin.generatePost({ profile_id: profileId, topic, angle }),
    onSuccess: (post) => {
      qc.invalidateQueries({ queryKey: ["linkedin-posts", profileId] });
      onDone(post);
    },
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[0.6rem] font-semibold tracking-[0.14em] uppercase text-[#484d63]">
        Generate Post
      </div>
      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Topic (e.g., AI in sports analytics)…"
        className="rounded-lg px-3 py-2 text-[0.75rem] text-[#f1f1f3] outline-none placeholder:text-[#2a2d3a]"
        style={{ background: "#0e1015", border: "1px solid rgba(255,255,255,0.08)" }}
        onFocus={(e) => { e.target.style.borderColor = "rgba(var(--accent-rgb),0.35)"; }}
        onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
      />
      <input
        value={angle}
        onChange={(e) => setAngle(e.target.value)}
        placeholder="Angle / hook (optional)…"
        className="rounded-lg px-3 py-2 text-[0.75rem] text-[#f1f1f3] outline-none placeholder:text-[#2a2d3a]"
        style={{ background: "#0e1015", border: "1px solid rgba(255,255,255,0.08)" }}
        onFocus={(e) => { e.target.style.borderColor = "rgba(var(--accent-rgb),0.35)"; }}
        onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
      />
      <button
        onClick={() => mutate()}
        disabled={!topic || isPending}
        className="rounded-xl py-2.5 text-[0.75rem] font-bold text-black transition-all hover:-translate-y-0.5 disabled:opacity-30 flex items-center justify-center gap-2"
        style={{ background: "var(--accent)" }}
      >
        {isPending ? (
          <>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
              <Sparkles size={13} />
            </motion.div>
            Generating…
          </>
        ) : (
          <><Sparkles size={13} /> Generate in My Voice</>
        )}
      </button>
    </div>
  );
}

/* ── Editor panel ── */
function EditorPanel({ post, profileId }: { post: LinkedInPost; profileId: number }) {
  const qc = useQueryClient();
  const [content, setContent] = useState(post.content);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  async function save() {
    setSaving(true);
    await api.linkedin.updatePost(post.id, { content });
    await qc.invalidateQueries({ queryKey: ["linkedin-posts", profileId] });
    setSaving(false);
  }

  async function publish() {
    setPublishing(true);
    try {
      await api.linkedin.publishPost(post.id);
      await qc.invalidateQueries({ queryKey: ["linkedin-posts", profileId] });
    } finally {
      setPublishing(false);
    }
  }

  const charCount = content.length;
  const overLimit = charCount > 3000;

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between shrink-0">
        <div className="text-[0.6rem] font-semibold tracking-[0.14em] uppercase text-[#484d63]">Editor</div>
        <div className="flex items-center gap-2">
          <span className={`text-[0.6rem] font-mono ${overLimit ? "text-[#ef4444]" : "text-[#484d63]"}`}>
            {charCount}/3000
          </span>
          <button
            onClick={save}
            disabled={saving || content === post.content}
            className="text-[0.65rem] font-semibold transition-all disabled:opacity-30"
            style={{ color: "var(--accent)" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {post.status === "draft" && (
            <button
              onClick={publish}
              disabled={publishing || overLimit}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[0.65rem] font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-30"
              style={{ background: "var(--accent)", color: "#000" }}
            >
              <Send size={10} />
              {publishing ? "Posting…" : "Post to LinkedIn"}
            </button>
          )}
          {post.status === "posted" && (
            <span className="text-[0.65rem] font-semibold" style={{ color: "#22c55e" }}>
              Posted ✓
            </span>
          )}
        </div>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="flex-1 rounded-xl px-4 py-3 text-[0.75rem] text-[#f1f1f3] resize-none outline-none leading-relaxed"
        style={{
          background: "#0e1015",
          border: `1px solid ${overLimit ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.08)"}`,
          minHeight: 0,
        }}
        onFocus={(e) => { if (!overLimit) e.target.style.borderColor = "rgba(var(--accent-rgb),0.3)"; }}
        onBlur={(e) => { e.target.style.borderColor = overLimit ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.08)"; }}
      />
    </div>
  );
}

/* ── Main page ── */
export default function LinkedInPage() {
  const profile = useProfile();
  const profileId = profile?.id;
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [view, setView] = useState<"generate" | "edit">("generate");

  const { data: liStatus } = useQuery({
    queryKey: ["linkedin-status", profileId],
    queryFn: () => api.linkedin.status(profileId!),
    enabled: !!profileId,
  });

  const { data: rawPosts } = useQuery({
    queryKey: ["linkedin-posts", profileId],
    queryFn: () => api.linkedin.posts(profileId!),
    enabled: !!profileId,
  });
  const posts = Array.isArray(rawPosts) ? rawPosts : [];

  const { mutate: deletePost } = useMutation({
    mutationFn: (id: number) => api.linkedin.deletePost(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["linkedin-posts", profileId] });
      if (selectedId === id) setSelectedId(null);
    },
  });

  const { mutate: publishPost } = useMutation({
    mutationFn: (id: number) => api.linkedin.publishPost(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["linkedin-posts", profileId] }),
  });

  const selectedPost = posts.find((p) => p.id === selectedId);

  return (
    <div className="flex flex-col h-full gap-5">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-end justify-between shrink-0"
      >
        <h1 className="text-[1.9rem] font-bold tracking-[-0.03em] text-[#f1f1f3]">LinkedIn</h1>
        <div className="flex items-center gap-3">
          {/* OAuth status */}
          {liStatus?.connected ? (
            <div className="flex items-center gap-1.5 text-[0.65rem]" style={{ color: "#22c55e" }}>
              <div className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
              Connected
            </div>
          ) : (
            <a
              href={profileId ? api.linkedin.authUrl(profileId) : "#"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.65rem] font-semibold transition-all hover:-translate-y-0.5"
              style={{ background: "#0a66c2", color: "#fff" }}
            >
              <Link size={11} /> Connect LinkedIn
            </a>
          )}
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
            Drafts & Posts
          </div>
          <AnimatePresence initial={false}>
            {posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                selected={p.id === selectedId}
                onSelect={() => { setSelectedId(p.id); setView("edit"); }}
                onDelete={() => deletePost(p.id)}
                onPublish={() => publishPost(p.id)}
              />
            ))}
          </AnimatePresence>
          {posts.length === 0 && (
            <div className="text-[0.68rem] text-[#484d63]">No posts yet — generate one.</div>
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
            {view === "generate" && profileId ? (
              <motion.div key="generate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <GenerateForm
                  profileId={profileId}
                  onDone={(p) => { setSelectedId(p.id); setView("edit"); }}
                />
              </motion.div>
            ) : view === "edit" && selectedPost && profileId ? (
              <motion.div key={`edit-${selectedPost.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <EditorPanel post={selectedPost} profileId={profileId} />
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center h-full text-[0.72rem] text-[#484d63]">
                {view === "edit" ? "Select a post to edit" : null}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
