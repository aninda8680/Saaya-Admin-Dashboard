"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
  size?: number;
}

export function CopyButton({ value, label, className = "", size = 13 }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 p-1 rounded transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 ${className}`}
      title={copied ? "Copied!" : `Copy ${label || value}`}
      aria-label={copied ? "Copied!" : `Copy ${label || value}`}
    >
      {copied ? (
        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium">
          <Check size={size} />
          {label && <span>Copied</span>}
        </span>
      ) : (
        <>
          <Copy size={size} />
          {label && <span className="text-[11px]">{label}</span>}
        </>
      )}
    </button>
  );
}

