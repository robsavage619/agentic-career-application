"use client";

import { motion } from "framer-motion";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  index?: number;
}

export function StatCard({ label, value, sub, index = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-1 rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0a0a0f] px-5 py-4"
    >
      <span className="text-[0.62rem] font-semibold tracking-[0.15em] uppercase text-[#5a6272]">
        {label}
      </span>
      <span
        className="text-[2rem] font-bold leading-none tracking-tight"
        style={{ color: "var(--accent)" }}
      >
        {value}
      </span>
      {sub && <span className="text-[0.7rem] text-[#9ca3af]">{sub}</span>}
    </motion.div>
  );
}
