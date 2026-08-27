"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export type ToastData = {
  title: string;
  description?: string;
  variant?: "info" | "success" | "warning" | "error";
};

type Toast = ToastData & { id: number };

let listeners: Array<(t: Toast) => void> = [];
let nextId = 1;

/** Imperative toast API — call from event handlers, never during render. */
export function toast(data: ToastData) {
  const t: Toast = { ...data, id: nextId++ };
  for (const listener of listeners) listener(t);
}

const variantBar = {
  info: "border-intermediate",
  success: "border-success",
  warning: "border-warning",
  error: "border-danger",
} as const;

/**
 * Fixed toast region. Mount once per layout; push via `toast()`.
 * Announced politely via role="status".
 */
export function ToastViewport({ className }: { className?: string }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (t: Toast) => {
      setToasts((prev) => [...prev.slice(-2), t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 4200);
    };
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed bottom-4 end-4 z-50 w-72 space-y-2",
        className,
      )}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            "animate-settle pointer-events-auto rounded-sm border border-edge border-s-4 bg-surface px-4 py-3 shadow-lift",
            variantBar[t.variant ?? "info"],
          )}
        >
          <p className="text-sm font-semibold">{t.title}</p>
          {t.description && (
            <p className="mt-0.5 text-xs leading-relaxed text-soft">{t.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}
