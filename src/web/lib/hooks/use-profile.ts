"use client";

import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useProfileStore } from "@/lib/stores/profile-store";
import type { Profile } from "@/lib/api";

export function useProfile() {
  return useProfileStore((s) => s.profile);
}

export function useProfileActions() {
  return useProfileStore(
    useShallow((s) => ({ setProfile: s.setProfile, clearProfile: s.clearProfile }))
  );
}

/* Surface token maps — applied as inline styles so they always win the cascade */
const PROFILE_TOKENS: Record<string, Record<string, string>> = {
  rob: {
    "--bg":             "#050e1c",
    "--surface-inset":  "#030a14",
    "--surface":        "#091828",
    "--surface-2":      "#0e2035",
    "--surface-3":      "#152840",
    "--surface-raised": "#1c3250",
    "--sidebar-bg":     "#03080f",
    "--border":         "rgba(100,150,220,0.08)",
    "--border-strong":  "rgba(100,150,220,0.13)",
    "--border-accent":  "rgba(199,255,0,0.14)",
    "--text-primary":   "#e8f0ff",
    "--text-secondary": "#7a90b8",
    "--text-tertiary":  "#3d5070",
    "--text-muted":     "#1e2d42",
    "--text-data":      "#b8d4ff",
    "--radius":         "10px",
    "--radius-lg":      "16px",
    "--radius-card":    "12px",
  },
  ari: {
    "--bg":             "#0c0617",
    "--surface-inset":  "#080412",
    "--surface":        "#13092a",
    "--surface-2":      "#1a0f38",
    "--surface-3":      "#221547",
    "--surface-raised": "#2c1c58",
    "--sidebar-bg":     "#070412",
    "--border":         "rgba(167,139,250,0.08)",
    "--border-strong":  "rgba(167,139,250,0.14)",
    "--border-accent":  "rgba(167,139,250,0.22)",
    "--text-primary":   "#f0eaff",
    "--text-secondary": "#9080c0",
    "--text-tertiary":  "#5040a0",
    "--text-muted":     "#2c1f60",
    "--text-data":      "#d8c8ff",
    "--radius":         "14px",
    "--radius-lg":      "22px",
    "--radius-card":    "16px",
  },
};

export function useApplyTheme(profile: Profile | null) {
  useEffect(() => {
    if (!profile) return;
    const root = document.documentElement;
    const tag = profile.rag_tag || "rob";
    root.setAttribute("data-profile", tag);

    /* Accent from the stored profile color */
    root.style.setProperty("--accent", profile.accent_color);
    const hex = profile.accent_color.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    root.style.setProperty("--accent-rgb", `${r},${g},${b}`);
    root.style.setProperty("--accent-dim", `rgba(${r},${g},${b},0.10)`);
    root.style.setProperty("--accent-glow", `rgba(${r},${g},${b},0.14)`);

    /* Surface + typography + shape tokens — full profile swap */
    const tokens = PROFILE_TOKENS[tag];
    if (tokens) {
      Object.entries(tokens).forEach(([prop, val]) => {
        root.style.setProperty(prop, val);
      });
    }
  }, [profile]);
}
