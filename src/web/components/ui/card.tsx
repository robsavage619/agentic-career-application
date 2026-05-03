"use client";

import { motion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLMotionProps<"div"> {
  glass?: boolean;
  accent?: boolean;
  variant?: "default" | "raised" | "inset";
}

const VARIANT_BG: Record<NonNullable<CardProps["variant"]>, string> = {
  default: "var(--surface)",
  raised:  "var(--surface-raised)",
  inset:   "var(--surface-inset)",
};

export function Card({ glass, accent, variant = "default", className, children, style, ...props }: CardProps) {
  return (
    <motion.div
      className={cn(
        "p-5",
        glass && "backdrop-blur-sm",
        className
      )}
      style={{
        background: VARIANT_BG[variant],
        /* Top highlight edge — makes the card feel like it's sitting ON the background */
        borderTop: accent
          ? "1px solid rgba(var(--accent-rgb),0.25)"
          : "1px solid var(--border-strong)",
        borderRight:  "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        borderLeft:   "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
        ...style,
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function CardHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)}>
      {children}
    </div>
  );
}

/* Wayfinding label — tertiary color, not accent. Accent is reserved for data signals. */
export function CardLabel({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "0.65rem",
        fontWeight: 700,
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        color: accent ? "var(--accent)" : "var(--text-secondary)",
      }}
    >
      {children}
    </span>
  );
}
