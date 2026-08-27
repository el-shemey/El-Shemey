"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type MenuItem = {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
};

/**
 * Dropdown menu — keyboard and screen-reader friendly:
 * Escape closes, click-outside closes, aria wiring on trigger and listbox.
 */
export function DropdownMenu({
  trigger,
  items,
  align = "start",
  className,
}: {
  trigger: string;
  items: MenuItem[];
  align?: "start" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-sm border-2 border-edge-strong bg-surface px-4 py-2 text-sm font-semibold transition-colors hover:bg-hover"
      >
        {trigger}
        <svg
          aria-hidden
          viewBox="0 0 10 6"
          className={cn(
            "w-2.5 fill-none stroke-current stroke-[1.5] transition-transform duration-150",
            open && "rotate-180",
          )}
        >
          <path d="m1 1 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          id={menuId}
          role="menu"
          className={cn(
            "absolute z-30 mt-1.5 min-w-44 overflow-hidden rounded-sm border border-edge-strong bg-surface py-1 shadow-card",
            align === "end" ? "end-0" : "start-0",
          )}
        >
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  item.onSelect();
                  setOpen(false);
                }}
                className={cn(
                  "block w-full px-4 py-2 text-start text-sm transition-colors hover:bg-hover",
                  item.destructive ? "text-danger" : "text-fg",
                )}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
