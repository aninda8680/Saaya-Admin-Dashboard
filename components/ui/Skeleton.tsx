"use client";

import React from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-zinc-200/80 dark:bg-zinc-800 rounded ${className}`}
    />
  );
}

export function MetricSkeleton() {
  return (
    <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-subtle flex flex-col gap-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-16 my-1" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-800/30">
        <div className="space-y-1.5">
          <Skeleton className="h-2.5 w-12" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-2.5 w-12" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      <Skeleton className="h-8 w-full rounded-lg" />
    </div>
  );
}

export function TableSkeleton({
  rows = 6,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <>
      {/* Mobile Card Skeleton (< 640px) */}
      <div className="block sm:hidden divide-y divide-zinc-100 dark:divide-zinc-800/80">
        {Array.from({ length: Math.min(rows, 4) }).map((_, i) => (
          <CardSkeleton key={`m-skel-${i}`} />
        ))}
      </div>

      {/* Desktop Table Skeleton (>= 640px) */}
      <div className="hidden sm:block w-full p-4 space-y-3">
        <div className="flex gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-3">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={`head-${i}`} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={`row-${r}`}
            className="flex gap-4 py-3 border-b border-zinc-100 dark:border-zinc-800/40"
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={`cell-${r}-${c}`} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

export function AlertSkeleton() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-850/30 flex items-center justify-between"
        >
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-2.5 w-36" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function TelemetryLogsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {/* Mobile Reading Log Card Skeletons (< 768px) */}
      <div className="block md:hidden divide-y divide-zinc-100 dark:divide-zinc-800/80">
        {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
          <div key={i} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Spreadsheet Skeletons (>= 768px) */}
      <div className="hidden md:block w-full p-4 space-y-3">
        <div className="flex gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={`th-${i}`} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: count }).map((_, r) => (
          <div
            key={`tr-${r}`}
            className="flex gap-4 py-3 border-b border-zinc-100 dark:border-zinc-800/40"
          >
            {Array.from({ length: 9 }).map((_, c) => (
              <Skeleton key={`td-${r}-${c}`} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

export function DeviceDetailSkeleton() {
  return (
    <div className="p-5 sm:p-8 lg:p-10 max-w-7xl mx-auto space-y-6 animate-pulse">
      {/* Breadcrumb + Header */}
      <div className="space-y-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <Skeleton className="h-4 w-32" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>
      </div>

      {/* 8-Sensor HUD Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2"
          >
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-2 w-10" />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>

      {/* Content Area */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}
