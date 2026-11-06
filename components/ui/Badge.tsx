"use client";

import React from "react";

export type BadgeVariant = "online" | "standby" | "offline" | "neutral";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
  title?: string;
}

export function Badge({
  children,
  variant = "neutral",
  dot = false,
  className = "",
  title,
}: BadgeProps) {
  const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
    online: {
      container: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60",
      dot: "bg-emerald-500",
    },
    standby: {
      container: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60",
      dot: "bg-amber-500",
    },
    offline: {
      container: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700",
      dot: "bg-zinc-400 dark:bg-zinc-500",
    },
    neutral: {
      container: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700",
      dot: "bg-zinc-400",
    },
  };

  const current = variantStyles[variant] || variantStyles.neutral;

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium tracking-tight font-mono ${current.container} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${current.dot} ${
            variant === "online" ? "animate-pulse" : ""
          }`}
        />
      )}
      {children}
    </span>
  );
}
