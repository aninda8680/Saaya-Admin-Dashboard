"use client";

import React from "react";
import { Search, X } from "lucide-react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  onClear?: () => void;
}

export function Input({
  icon,
  onClear,
  value,
  className = "",
  ...props
}: InputProps) {
  return (
    <div className="relative flex items-center w-full">
      {icon && (
        <div className="absolute left-2.5 text-zinc-400 pointer-events-none flex items-center">
          {icon}
        </div>
      )}
      <input
        value={value}
        className={`w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 text-xs py-1.5 transition-colors outline-none focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-1 focus:ring-zinc-400 disabled:opacity-50 ${
          icon ? "pl-8" : "pl-2.5"
        } ${onClear && value ? "pr-8" : "pr-2.5"} ${className}`}
        {...props}
      />
      {onClear && value && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 rounded"
          title="Clear"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

export function SearchInput({
  placeholder = "Search...",
  value,
  onChange,
  onClear,
  className = "",
}: {
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear?: () => void;
  className?: string;
}) {
  return (
    <Input
      icon={<Search size={14} />}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onClear={onClear}
      className={className}
    />
  );
}
