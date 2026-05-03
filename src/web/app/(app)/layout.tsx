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
        className="w-[220px] shrink-0 flex flex-col"
        style={{
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {/* Wordmark */}
        <div className="px-5 pt-6 pb-7">
          <div className="flex flex-col gap-0.5">
            <span
              style={{
                fontFamily: "'Berkeley Mono', 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Menlo', monospace",
                fontSize: "0.65rem",
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--accent)",
                textShadow: "var(--accent-glow)",
                lineHeight: 1,
              }}
            >
              Career
            </span>
            <span
              style={{
                fontFamily: "'Berkeley Mono', 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Menlo', monospace",
                fontSize: "0.65rem",
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--accent)",
                textShadow: "var(--accent-glow)",
                lineHeight: 1,
              }}
            >
              Command
            </span>
            <span
              style={{
                fontFamily: "'Berkeley Mono', 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Menlo', monospace",
                fontSize: "0.65rem",
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--accent)",
                textShadow: "var(--accent-glow)",
                lineHeight: 1,
              }}
            >
              Center
            </span>
          </div>
          <div
            className="mt-2"
            style={{
              width: "100%",
              height: 1,
              background: "linear-gradient(90deg, var(--accent-soft) 0%, transparent 100%)",
            }}
          />
        </div>

        {/* Nav */}
        <nav className="flex flex-col flex-1 px-3 gap-0.5">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="group flex items-center gap-2.5 px-3 py-2 transition-all duration-150 select-none"
                style={{
                  borderRadius: "var(--radius)",
                  background: active ? "var(--surface-2)" : "transparent",
                  color: active ? "var(--text-primary)" : "var(--text-tertiary)",
                  border: active ? "1px solid var(--border)" : "1px solid transparent",
                }}
              >
                <Icon
                  size={15}
                  strokeWidth={active ? 2 : 1.75}
                  style={{
                    color: active ? "var(--accent)" : "var(--text-muted)",
                    flexShrink: 0,
                    filter: active ? "drop-shadow(0 0 4px rgba(122,255,142,0.4))" : "none",
                  }}
                />
                <span
                  className="text-[0.825rem] truncate"
                  style={{
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
                className="flex h-7 w-7 shrink-0 items-center justify-center"
                style={{
                  background: "var(--accent-soft)",
                  borderRadius: "50%",
                  color: "var(--accent)",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  letterSpacing: "0.02em",
                  fontFamily: "'Berkeley Mono', 'JetBrains Mono', monospace",
                  border: "1px solid rgba(122,255,142,0.2)",
                }}
              >
                {profile.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-[0.8rem] font-semibold truncate"
                  style={{ color: "var(--text-primary)", letterSpacing: "-0.015em" }}
                >
                  {profile.name}
                </div>
                <div
                  className="text-[0.65rem] mt-0.5"
                  style={{
                    color: "var(--text-muted)",
                    fontFamily: "'Berkeley Mono', 'JetBrains Mono', monospace",
                    letterSpacing: "0.05em",
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
                <LogOut size={13} />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* ── Main content ── */}
      <main
        className="flex-1 overflow-y-auto"
        style={{ background: "var(--bg)" }}
      >
        <div className="animate-in mx-auto" style={{ maxWidth: 1120, padding: "44px 64px 96px" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
