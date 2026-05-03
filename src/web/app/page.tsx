"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api, type Profile } from "@/lib/api";
import { useProfileActions } from "@/lib/hooks/use-profile";
import { useProfileStore } from "@/lib/stores/profile-store";
import { getProfileIcon } from "@/components/ui/profile-icons";

/* Accent colors used before any profile is selected */
const ROB_ACCENT  = "#c7ff00";
const ARI_ACCENT  = "#a78bfa";

const DEFAULTS: (Omit<Profile, "id" | "created_at"> & { tagline: string })[] = [
  { name: "Rob", accent_color: ROB_ACCENT, avatar_emoji: "bolt",     rag_tag: "rob", tagline: "3 new matches today" },
  { name: "Ari", accent_color: ARI_ACCENT, avatar_emoji: "knitting", rag_tag: "ari", tagline: "2 new matches today" },
];

export default function ProfilePicker() {
  const router = useRouter();
  const { setProfile } = useProfileActions();
  const existingId = useProfileStore((s) => s.profileId);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<number | null>(null);

  useEffect(() => {
    if (existingId) { router.replace("/dashboard"); return; }
    api.profiles.list().then(async (existing) => {
      if (existing.length === 0) {
        const created = await Promise.all(DEFAULTS.map((d) => api.profiles.create(d)));
        setProfiles(created);
      } else {
        const synced = await Promise.all(
          existing.map((profile, i) => {
            const def = DEFAULTS[i];
            if (!def) return Promise.resolve(profile);
            const stale =
              profile.name !== def.name ||
              profile.avatar_emoji !== def.avatar_emoji ||
              profile.accent_color !== def.accent_color ||
              profile.rag_tag !== def.rag_tag;
            if (!stale) return Promise.resolve(profile);
            return api.profiles.update(profile.id, {
              name: def.name,
              avatar_emoji: def.avatar_emoji,
              accent_color: def.accent_color,
              rag_tag: def.rag_tag,
            });
          })
        );
        setProfiles(synced);
      }
      setLoading(false);
    });
  }, [existingId, router]);

  async function selectProfile(profile: Profile) {
    setSelecting(profile.id);
    setProfile(profile);
    router.push("/dashboard");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#08090c" }}>
        <motion.div
          animate={{ opacity: [0.2, 0.7, 0.2] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.65rem",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: "#454b63",
          }}
        >
          Initializing
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden"
      style={{ background: "#08090c" }}
    >
      {/* Dual profile ambient glows — both people are present */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            "radial-gradient(ellipse 55% 45% at 28% 60%, rgba(199,255,0,0.045) 0%, transparent 65%)",
            "radial-gradient(ellipse 55% 45% at 72% 60%, rgba(167,139,250,0.06) 0%, transparent 65%)",
            "radial-gradient(ellipse 70% 40% at 50% -5%, rgba(255,255,255,0.025) 0%, transparent 60%)",
          ].join(", "),
        }}
      />

      {/* Fine grain texture */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: 0.15,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Top rule */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "rgba(255,255,255,0.06)" }}
      />

      <div className="relative z-10 flex flex-col items-center px-8 text-center">

        {/* Wordmark */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="mb-16 flex items-center gap-3"
        >
          <div className="h-px w-8" style={{ background: "rgba(255,255,255,0.12)" }} />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.58rem",
              fontWeight: 500,
              letterSpacing: "0.35em",
              textTransform: "uppercase",
              color: "#454b63",
            }}
          >
            Career Command Center
          </span>
          <div className="h-px w-8" style={{ background: "rgba(255,255,255,0.12)" }} />
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="mb-5 leading-[1.05]"
          style={{
            fontFamily: "'Space Grotesk Variable', sans-serif",
            fontSize: "clamp(2.8rem, 6.5vw, 5.5rem)",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            color: "#eef0f6",
          }}
        >
          Who&apos;s navigating
          <br />
          <span style={{ color: "rgba(238,240,246,0.28)", fontWeight: 300 }}>today?</span>
        </motion.h1>

        {/* Sub */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mb-14 text-[0.9rem] leading-relaxed"
          style={{ color: "#8892af", maxWidth: 360 }}
        >
          Select your profile to load your personalized career intelligence.
        </motion.p>

        {/* Profile cards */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="relative flex gap-5 flex-wrap justify-center"
        >
          {profiles.map((profile, i) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              tagline={DEFAULTS[i]?.tagline ?? ""}
              loading={selecting === profile.id}
              onClick={() => selectProfile(profile)}
            />
          ))}
        </motion.div>
      </div>

      {/* Bottom version */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center">
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.55rem",
            letterSpacing: "0.2em",
            color: "#272c3d",
          }}
        >
          v0.1.0
        </span>
      </div>
    </div>
  );
}

function ProfileCard({
  profile,
  tagline,
  loading,
  onClick,
}: {
  profile: Profile;
  tagline: string;
  loading: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const accent = profile.accent_color;

  /* Per-profile surface tints so the two cards feel materially different */
  const isRob  = profile.accent_color === ROB_ACCENT;
  const baseBg = isRob ? "#0b0e16" : "#0f0d18";
  const hovBg  = isRob ? "#10141f" : "#16131f";

  return (
    <motion.button
      onClick={onClick}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      disabled={loading}
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex flex-col items-center gap-5 outline-none"
      style={{
        width: 216,
        minHeight: 286,
        padding: "2.25rem 1.75rem",
        background: hovered ? hovBg : baseBg,
        border: `1px solid ${hovered ? `${accent}35` : "rgba(255,255,255,0.06)"}`,
        borderRadius: isRob ? 14 : 20,
        cursor: "pointer",
        transition: "background 0.2s, border-color 0.2s, box-shadow 0.2s",
        boxShadow: hovered
          ? `0 24px 56px rgba(0,0,0,0.55), 0 0 0 1px ${accent}18, 0 0 40px ${accent}08`
          : "none",
      }}
    >
      {/* Icon ring */}
      <motion.div
        animate={{
          background: hovered ? `${accent}14` : "rgba(255,255,255,0.035)",
          borderColor: hovered ? `${accent}40` : "rgba(255,255,255,0.07)",
        }}
        transition={{ duration: 0.2 }}
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {getProfileIcon(profile.avatar_emoji, 34, hovered ? accent : "#454b63")}
      </motion.div>

      {/* Name */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: "'Space Grotesk Variable', sans-serif",
            fontSize: "1.15rem",
            fontWeight: 600,
            letterSpacing: "-0.025em",
            color: hovered ? "#eef0f6" : "#8892af",
            transition: "color 0.2s",
          }}
        >
          {profile.name}
        </div>
      </div>

      {/* Accent rule */}
      <motion.div
        animate={{ scaleX: hovered ? 1 : 0.25, opacity: hovered ? 1 : 0.2 }}
        transition={{ duration: 0.25 }}
        style={{
          height: 1,
          width: 40,
          background: accent,
          borderRadius: 1,
          transformOrigin: "center",
        }}
      />

      {/* Data point */}
      {tagline && (
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.6rem",
            color: hovered ? accent : "#454b63",
            transition: "color 0.2s",
            textAlign: "center",
            letterSpacing: "0.02em",
          }}
        >
          {tagline}
        </div>
      )}

      {/* CTA */}
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.6rem",
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: hovered ? accent : "#272c3d",
          transition: "color 0.2s",
        }}
      >
        {loading ? "Loading" : "Enter →"}
      </span>

      {/* Hover glow underneath */}
      {hovered && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="pointer-events-none absolute inset-0"
          style={{
            borderRadius: "inherit",
            background: `radial-gradient(ellipse 80% 50% at 50% 100%, ${accent}09 0%, transparent 70%)`,
          }}
        />
      )}
    </motion.button>
  );
}
