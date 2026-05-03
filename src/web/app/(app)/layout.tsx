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
        className="w-[232px] shrink-0 flex flex-col"
        style={{
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {/* Wordmark */}
        <div className="px-5 pt-6 pb-7">
          <div className="flex items-center gap-2.5">
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-text)",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "-0.04em",
                boxShadow: "var(--shadow-xs)",
              }}
            >
              C
            </div>
            <span
              style={{
                fontSize: "0.95rem",
                fontWeight: 600,
                letterSpacing: "-0.025em",
                color: "var(--text-primary)",
              }}
            >
              Career
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col flex-1 px-3 gap-0.5">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="group flex items-center gap-2.5 px-3 py-2 transition-colors duration-150 select-none"
                style={{
                  borderRadius: "var(--radius)",
                  background: active ? "var(--surface)" : "transparent",
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  boxShadow: active ? "var(--shadow-xs)" : "none",
                  border: active ? "1px solid var(--border)" : "1px solid transparent",
                }}
              >
                <Icon
                  size={16}
                  strokeWidth={active ? 2 : 1.75}
                  style={{
                    color: active ? "var(--accent)" : "var(--text-tertiary)",
                    flexShrink: 0,
                  }}
                />
                <span
                  className="text-[0.875rem] truncate"
                  style={{
                    fontWeight: active ? 550 : 450,
                    letterSpacing: "-0.01em",
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
          <div className="px-3 pb-3 mt-3">
            <div
              className="flex items-center gap-2.5 px-3 py-2.5"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                boxShadow: "var(--shadow-xs)",
              }}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center"
                style={{
                  background: "var(--accent-soft)",
                  borderRadius: "50%",
                  color: "var(--accent)",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  letterSpacing: "-0.02em",
                }}
              >
                {profile.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-[0.825rem] font-semibold truncate"
                  style={{
                    color: "var(--text-primary)",
                    letterSpacing: "-0.015em",
                  }}
                >
                  {profile.name}
                </div>
                <div
                  className="text-[0.7rem] mt-0.5"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Personal
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="transition-opacity hover:opacity-100 opacity-50"
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
      <main
        className="flex-1 overflow-y-auto"
        style={{ background: "var(--bg)" }}
      >
        <div className="animate-in mx-auto" style={{ maxWidth: 1100, padding: "40px 56px 80px" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
