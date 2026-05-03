"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  KanbanSquare,
  FileText,
  Mail,
  Network,
  Users,
  LogOut,
} from "lucide-react";
import { useProfile, useProfileActions } from "@/lib/hooks/use-profile";
import { api } from "@/lib/api";
import { useProfileStore } from "@/lib/stores/profile-store";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Today" },
  { href: "/feed", icon: Briefcase, label: "Job feed" },
  { href: "/pipeline", icon: KanbanSquare, label: "Pipeline" },
  { href: "/resume", icon: FileText, label: "Resume" },
  { href: "/letters", icon: Mail, label: "Cover letters" },
  { href: "/linkedin", icon: Network, label: "LinkedIn" },
  { href: "/panel", icon: Users, label: "Panel review" },
];

const MONO = "'Berkeley Mono', 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Menlo', monospace";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const profile = useProfile();
  const { setProfile, clearProfile } = useProfileActions();
  const profileId = useProfileStore((s) => s.profileId);

  useEffect(() => {
    if (!profileId) {
      router.replace("/");
      return;
    }
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
        className="w-[240px] shrink-0 flex flex-col"
        style={{
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {/* Wordmark */}
        <div className="px-5 pt-7 pb-6">
          <div style={{ lineHeight: 1.1 }}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: "1.05rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--accent)",
                textShadow: "var(--accent-glow)",
              }}
            >
              Career
            </div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: "1.05rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--accent)",
                textShadow: "var(--accent-glow)",
              }}
            >
              Command
            </div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: "1.05rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--accent)",
                textShadow: "var(--accent-glow)",
              }}
            >
              Center
            </div>
          </div>
          <div
            style={{
              marginTop: 10,
              width: "100%",
              height: 1,
              background: "linear-gradient(90deg, rgba(122,255,142,0.35) 0%, transparent 80%)",
            }}
          />
        </div>

        {/* Nav */}
        <nav className="flex flex-col flex-1 px-3 gap-1">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2.5 transition-all duration-150 select-none"
                style={{
                  borderRadius: "var(--radius)",
                  background: active ? "var(--surface-2)" : "transparent",
                  color: active ? "var(--text-primary)" : "var(--text-tertiary)",
                  border: active ? "1px solid var(--border-strong)" : "1px solid transparent",
                }}
              >
                <Icon
                  size={16}
                  strokeWidth={active ? 2 : 1.75}
                  style={{
                    color: active ? "var(--accent)" : "var(--text-muted)",
                    flexShrink: 0,
                    filter: active ? "drop-shadow(0 0 5px rgba(122,255,142,0.5))" : "none",
                    transition: "filter 0.15s",
                  }}
                />
                <span
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: active ? 550 : 400,
                    letterSpacing: "-0.01em",
                    color: active ? "var(--text-primary)" : "var(--text-tertiary)",
                  }}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Profile chip */}
        {profile && (
          <div className="px-3 pb-4 mt-3">
            <div
              className="flex items-center gap-2.5 px-3 py-2.5"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
              }}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center"
                style={{
                  background: "var(--accent-soft)",
                  borderRadius: "50%",
                  color: "var(--accent)",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  fontFamily: MONO,
                  border: "1px solid rgba(122,255,142,0.2)",
                }}
              >
                {profile.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  style={{
                    fontSize: "0.825rem",
                    fontWeight: 550,
                    color: "var(--text-primary)",
                    letterSpacing: "-0.015em",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {profile.name}
                </div>
                <div
                  style={{
                    fontSize: "0.6rem",
                    marginTop: 1,
                    color: "var(--text-muted)",
                    fontFamily: MONO,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  Local
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="transition-opacity hover:opacity-100 opacity-30"
                style={{ color: "var(--text-tertiary)" }}
                title="Switch profile"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
        <div className="animate-in mx-auto" style={{ maxWidth: 1140, padding: "48px 64px 96px" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
