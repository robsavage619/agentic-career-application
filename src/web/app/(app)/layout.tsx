"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Briefcase, KanbanSquare,
  FileText, Mail, Network, Users, LogOut,
} from "lucide-react";
import { useProfile, useProfileActions, useApplyTheme } from "@/lib/hooks/use-profile";
import { api } from "@/lib/api";
import { useProfileStore } from "@/lib/stores/profile-store";
import { getProfileIcon } from "@/components/ui/profile-icons";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/feed",      icon: Briefcase,        label: "Job Feed" },
  { href: "/pipeline",  icon: KanbanSquare,     label: "Pipeline" },
  { href: "/resume",    icon: FileText,         label: "Resume" },
  { href: "/letters",   icon: Mail,             label: "Cover Letters" },
  { href: "/linkedin",  icon: Network,          label: "LinkedIn" },
  { href: "/panel",     icon: Users,            label: "Expert Panel" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const profile = useProfile();
  const { setProfile, clearProfile } = useProfileActions();
  const profileId = useProfileStore((s) => s.profileId);

  useApplyTheme(profile);

  useEffect(() => {
    if (!profileId) { router.replace("/"); return; }
    if (!profile) {
      api.profiles.get(profileId).then(setProfile).catch(() => router.replace("/"));
    }
  }, [profileId, profile, router, setProfile]);

  function handleSignOut() {
    clearProfile();
    router.replace("/");
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>

      {/* ── Sidebar ── */}
      <aside
        className="w-[200px] shrink-0 flex flex-col"
        style={{
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--border)",
        }}
      >

        {/* Wordmark */}
        <div className="px-5 pt-6 pb-5 shrink-0">
          <div className="flex items-center gap-2 mb-0.5">
            {/* Accent pip — tiny identity mark */}
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "var(--accent)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "'Space Grotesk Variable', sans-serif",
                fontSize: "1.05rem",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: "var(--text-primary)",
                lineHeight: 1,
              }}
            >
              Career
            </span>
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.55rem",
              fontWeight: 500,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--text-tertiary)",
              paddingLeft: 13,
            }}
          >
            Command
          </div>
        </div>

        {/* Divider */}
        <div className="mx-5 mb-3" style={{ height: 1, background: "var(--border)" }} />

        {/* Nav */}
        <nav className="flex flex-col flex-1 px-3 gap-0.5 overflow-y-auto">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="group relative flex items-center gap-3 px-3 py-[9px] transition-all duration-150 select-none"
                style={{
                  borderRadius: "var(--radius)",
                  background: active ? "var(--accent-dim)" : "transparent",
                  boxShadow: active ? "inset 2px 0 0 var(--accent)" : "none",
                  color: active ? "var(--accent)" : "var(--text-tertiary)",
                }}
              >
                <Icon
                  size={13}
                  strokeWidth={active ? 2.5 : 1.75}
                  style={{
                    flexShrink: 0,
                    color: active ? "var(--accent)" : "var(--text-tertiary)",
                    transition: "color 0.15s",
                  }}
                  className={active ? "" : "group-hover:!text-[var(--text-secondary)] transition-colors"}
                />
                <span
                  className="text-[0.73rem] font-medium tracking-[-0.01em] truncate transition-colors"
                  style={{
                    color: active ? "var(--accent)" : "var(--text-tertiary)",
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  <span className={active ? "" : "group-hover:text-[var(--text-secondary)]"}>
                    {label}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Profile widget */}
        {profile && (
          <div className="mx-3 mb-3 mt-2">
            {/* Thin separator above profile */}
            <div className="mb-2.5" style={{ height: 1, background: "var(--border)" }} />
            <div
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-strong)",
              }}
            >
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: "var(--accent-dim)",
                  border: "1px solid var(--border-accent)",
                }}
              >
                {getProfileIcon(profile.avatar_emoji, 15, profile.accent_color)}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-[0.75rem] font-semibold leading-tight truncate"
                  style={{
                    color: "var(--text-primary)",
                    fontFamily: "'Space Grotesk Variable', sans-serif",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {profile.name}
                </div>
                <div
                  className="text-[0.58rem] leading-tight mt-0.5"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    color: "var(--accent)",
                    letterSpacing: "0.04em",
                  }}
                >
                  active
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="transition-opacity hover:opacity-60"
                style={{ color: "var(--text-tertiary)" }}
                title="Switch profile"
              >
                <LogOut size={11} />
              </button>
            </div>
          </div>
        )}

        {/* Version */}
        <div className="px-5 pb-4">
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.52rem",
              letterSpacing: "0.14em",
              color: "var(--text-muted)",
            }}
          >
            v0.1.0
          </span>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main
        className="flex-1 overflow-y-auto"
        style={{ background: "var(--bg)" }}
      >
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="h-full p-7"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
