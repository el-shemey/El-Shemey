"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

/**
 * Modal dialog built on the native <dialog> element:
 * top-layer rendering, focus trap and Escape handling come free.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  actions,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // Close on backdrop click — the dialog element itself is only hit there.
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-md rounded-md border-2 border-edge-strong bg-surface p-0 shadow-lift backdrop:bg-base/70",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-edge px-5 py-4">
        <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-fg">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="grid size-7 place-items-center rounded-xs text-faint hover:bg-hover hover:text-fg"
        >
          <svg
            aria-hidden
            viewBox="0 0 10 10"
            className="size-3 stroke-current stroke-[1.5] fill-none"
          >
            <path d="m1 1 8 8M9 1 1 9" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="px-5 py-4 text-sm leading-relaxed text-soft">{children}</div>
      {actions && <div className="flex justify-end gap-3 px-5 pb-5">{actions}</div>}
    </dialog>
  );
}

/** Ready-made confirmation pattern for destructive actions. */
export function ConfirmDanger({
  open,
  onClose,
  onConfirm,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Keep it
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Confirm
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
