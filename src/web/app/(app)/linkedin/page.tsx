"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Trash2, X, ExternalLink, RefreshCw } from "lucide-react";
import { api, type LinkedInPost } from "@/lib/api";
import { useProfile } from "@/lib/hooks/use-profile";

const MONO = "'Geist Mono Variable', 'Geist Mono', ui-monospace, 'SF Mono', 'Menlo', monospace";

/* ── LinkedIn logo SVG ── */
function LinkedInLogo({ height = 22 }: { height?: number }) {
  const w = height * (143 / 38);
  return (
    <svg height={height} width={w} viewBox="0 0 430 115" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="LinkedIn">
      {/* "in" icon box */}
      <rect width="115" height="115" rx="12" fill="#0A66C2" />
      <path
        d="M26 44h20v51H26V44zM36 20c6.6 0 12 5.4 12 12s-5.4 12-12 12-12-5.4-12-12 5.4-12 12-12z"
        fill="white"
      />
      <path
        d="M65 44h19v7h.3c2.6-5 9-10.3 18.5-10.3 19.8 0 23.4 13 23.4 29.9V95H107V74.2c0-7.5-.1-17.1-10.4-17.1-10.4 0-12 8.1-12 16.5V95H65V44z"
        fill="white"
      />
      {/* "LinkedIn" text */}
      <text
        x="138"
        y="87"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontSize="72"
        fontWeight="700"
        fill="#0A66C2"
        letterSpacing="-2"
      >
        LinkedIn
      </text>
    </svg>
  );
}

const STATUS_LABEL: Record<string, string> = {
  draft: "DRAFT",
  scheduled: "SCHEDULED",
  posted: "POSTED",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "var(--text-tertiary)",
  scheduled: "var(--amber)",
  posted: "var(--green)",
};

function PostCard({ post, selected, onSelect, onDelete, onPublish }: {
  post: LinkedInPost;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onPublish: () => void;
}) {
  const preview = post.content.slice(0, 90).replace(/\n/g, " ");
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      onClick={onSelect}
      style={{
        padding: "12px",
        borderRadius: "var(--radius)",
        cursor: "pointer",
        background: selected ? "var(--accent-soft)" : "var(--surface-2)",
        border: selected ? "1px solid rgba(122,255,142,0.25)" : "1px solid var(--border)",
        transition: "all 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: STATUS_COLOR[post.status] ?? "var(--text-muted)",
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        <span style={{ fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.06em", color: STATUS_COLOR[post.status] }}>
          {STATUS_LABEL[post.status] ?? post.status}
        </span>
        <span style={{ fontFamily: MONO, fontSize: "0.58rem", color: "var(--text-muted)", marginLeft: "auto" }}>
          {new Date(post.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      </div>
      <div
        style={{
          fontSize: "0.775rem",
          color: "var(--text-secondary)",
          lineHeight: 1.5,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          marginBottom: 8,
        }}
      >
        {preview}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {post.status === "draft" && (
          <span style={{ fontFamily: MONO, fontSize: "0.55rem", color: "var(--text-muted)", letterSpacing: "0.04em" }}>
            DRAFT
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{
            marginLeft: "auto",
            padding: "4px",
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <Trash2 size={11} />
        </button>
      </div>
    </motion.div>
  );
}

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

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "var(--radius)",
    background: "var(--surface-2)",
    border: "1px solid var(--border-strong)",
    color: "var(--text-primary)",
    fontSize: "0.875rem",
    outline: "none",
    letterSpacing: "-0.01em",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span className="chrome">Generate post</span>
      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Topic (e.g., AI in sports analytics)…"
        style={inputStyle}
        onFocus={(e) => { e.target.style.borderColor = "rgba(122,255,142,0.4)"; }}
        onBlur={(e) => { e.target.style.borderColor = "var(--border-strong)"; }}
      />
      <input
        value={angle}
        onChange={(e) => setAngle(e.target.value)}
        placeholder="Angle / hook (optional)…"
        style={inputStyle}
        onFocus={(e) => { e.target.style.borderColor = "rgba(122,255,142,0.4)"; }}
        onBlur={(e) => { e.target.style.borderColor = "var(--border-strong)"; }}
      />
      <button
        onClick={() => mutate()}
        disabled={!topic || isPending}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "12px",
          borderRadius: "var(--radius)",
          background: !topic || isPending ? "var(--surface-3)" : "var(--accent)",
          color: !topic || isPending ? "var(--text-muted)" : "var(--accent-text)",
          border: "none",
          fontSize: "0.875rem",
          fontWeight: 600,
          cursor: !topic || isPending ? "not-allowed" : "pointer",
          letterSpacing: "-0.01em",
          transition: "all 0.15s",
        }}
      >
        {isPending ? (
          <>
            <Sparkles size={14} className="animate-pulse" />
            Generating in your voice…
          </>
        ) : (
          <><Sparkles size={14} /> Generate in My Voice</>
        )}
      </button>
    </div>
  );
}

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

  const overLimit = content.length > 3000;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <span className="chrome">Editor</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontFamily: MONO,
              fontSize: "0.65rem",
              color: overLimit ? "var(--red)" : "var(--text-muted)",
            }}
          >
            {content.length}/3000
          </span>
          <button
            onClick={save}
            disabled={saving || content === post.content}
            style={{
              fontSize: "0.775rem",
              fontWeight: 600,
              color: "var(--accent)",
              background: "transparent",
              border: "none",
              cursor: saving || content === post.content ? "not-allowed" : "pointer",
              opacity: saving || content === post.content ? 0.4 : 1,
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {post.status === "draft" && (
            <span
              style={{
                fontFamily: MONO,
                fontSize: "0.6rem",
                letterSpacing: "0.05em",
                color: "var(--text-muted)",
                padding: "5px 10px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "var(--surface-3)",
              }}
            >
              PUBLISH COMING SOON
            </span>
          )}
          {post.status === "posted" && (
            <span style={{ fontFamily: MONO, fontSize: "0.65rem", color: "var(--green)", letterSpacing: "0.04em" }}>
              POSTED ✓
            </span>
          )}
        </div>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        style={{
          flex: 1,
          padding: "16px",
          borderRadius: "var(--radius-lg)",
          background: "var(--surface-2)",
          border: `1px solid ${overLimit ? "rgba(248,113,113,0.4)" : "var(--border-strong)"}`,
          color: "var(--text-primary)",
          fontSize: "0.875rem",
          lineHeight: 1.7,
          resize: "none",
          outline: "none",
          minHeight: 0,
          letterSpacing: "-0.005em",
        }}
        onFocus={(e) => { if (!overLimit) e.target.style.borderColor = "rgba(122,255,142,0.3)"; }}
        onBlur={(e) => { e.target.style.borderColor = overLimit ? "rgba(248,113,113,0.4)" : "var(--border-strong)"; }}
      />
    </div>
  );
}

function ProfileCard({ status, profileId, onRefresh }: {
  status: import("@/lib/api").LinkedInStatus;
  profileId: number;
  onRefresh: () => void;
}) {
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await api.linkedin.refreshProfile(profileId);
      onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        borderRadius: "var(--radius-lg)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
          border: "2px solid rgba(10,102,194,0.3)",
          background: "var(--surface-3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {status.picture_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={status.picture_url} alt={status.name ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontFamily: MONO, fontSize: "1rem", fontWeight: 700, color: "#0A66C2" }}>
            {status.name?.charAt(0) ?? "?"}
          </span>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.015em" }}>
            {status.name || "—"}
          </span>
          <span
            style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "var(--green)",
              boxShadow: "0 0 5px var(--green)",
              flexShrink: 0,
            }}
          />
          <span style={{ fontFamily: MONO, fontSize: "0.6rem", color: "var(--green)", letterSpacing: "0.05em" }}>
            CONNECTED
          </span>
        </div>
        {status.headline && (
          <div style={{ fontSize: "0.775rem", color: "var(--text-tertiary)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {status.headline}
          </div>
        )}
        {status.vanity_name && (
          <a
            href={`https://www.linkedin.com/in/${status.vanity_name}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.7rem", color: "#4d9de0", marginTop: 2 }}
          >
            linkedin.com/in/{status.vanity_name}
            <ExternalLink size={10} />
          </a>
        )}
      </div>

      {/* Refresh */}
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        style={{
          padding: "6px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)",
          background: "transparent",
          color: "var(--text-muted)",
          cursor: refreshing ? "not-allowed" : "pointer",
          opacity: refreshing ? 0.5 : 1,
          flexShrink: 0,
        }}
        title="Refresh profile"
      >
        <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
      </button>
    </div>
  );
}

export default function LinkedInPage() {
  const profile = useProfile();
  const profileId = profile?.id;
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [view, setView] = useState<"generate" | "edit">("generate");

  const { data: liStatus, refetch: refetchStatus } = useQuery({
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 28 }}>
      {/* Header */}
      <header>
        <span className="chrome" style={{ display: "block", marginBottom: 10 }}>Content studio</span>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <LinkedInLogo height={32} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {liStatus?.connected ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--green)",
                    display: "inline-block",
                    boxShadow: "0 0 5px var(--green)",
                  }}
                />
                <span style={{ fontFamily: MONO, fontSize: "0.65rem", color: "var(--green)", letterSpacing: "0.04em" }}>
                  CONNECTED
                </span>
              </div>
            ) : (
              <a
                href={profileId ? api.linkedin.authUrl(profileId) : "#"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 16px",
                  borderRadius: "var(--radius)",
                  background: "#0A66C2",
                  color: "#fff",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                }}
              >
                Connect LinkedIn
              </a>
            )}
            <div style={{ display: "flex", gap: 4 }}>
              {(["generate", "edit"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "var(--radius)",
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    background: view === v ? "var(--accent-soft)" : "transparent",
                    color: view === v ? "var(--accent)" : "var(--text-tertiary)",
                    border: view === v ? "1px solid rgba(122,255,142,0.25)" : "1px solid var(--border)",
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {v === "generate" ? "+ Generate" : "Edit"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Connected profile card */}
      {liStatus?.connected && (
        <ProfileCard
          status={liStatus}
          profileId={profileId!}
          onRefresh={() => refetchStatus()}
        />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16, flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.08 }}
          style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", minHeight: 0 }}
        >
          <span className="chrome">Drafts & Posts</span>
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
            <div
              style={{
                fontFamily: MONO,
                fontSize: "0.65rem",
                color: "var(--text-muted)",
                letterSpacing: "0.03em",
                paddingTop: 4,
              }}
            >
              No posts yet — generate one.
            </div>
          )}
        </motion.div>

        {/* Main panel */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          style={{ minHeight: 0 }}
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
              <motion.div key={`edit-${selectedPost.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: "100%" }}>
                <EditorPanel post={selectedPost} profileId={profileId} />
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  fontFamily: MONO,
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  letterSpacing: "0.04em",
                }}
              >
                {view === "edit" ? "Select a post to edit" : null}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
