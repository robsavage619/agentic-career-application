"use client";

import type { Profile } from "./api";

const KEY = "ccc_profile_id";

export function getStoredProfileId(): number | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(KEY);
  return v ? Number(v) : null;
}

export function setStoredProfileId(id: number): void {
  localStorage.setItem(KEY, String(id));
}

export function clearStoredProfile(): void {
  localStorage.removeItem(KEY);
}

export function applyProfileTheme(profile: Profile): void {
  document.documentElement.setAttribute("data-profile", profile.rag_tag || "rob");
  document.documentElement.style.setProperty("--accent", profile.accent_color);
  const rgb = hexToRgb(profile.accent_color);
  if (rgb) document.documentElement.style.setProperty("--accent-rgb", rgb);
}

function hexToRgb(hex: string): string | null {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : null;
}
