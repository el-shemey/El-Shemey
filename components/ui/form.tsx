"use client";

import { cn } from "@/lib/cn";

const fieldStyles =
  "w-full rounded-sm border bg-base/70 px-3 py-2.5 text-sm text-fg transition-colors duration-150 placeholder:text-faint focus:border-indigo";

function stateStyles(invalid?: boolean, valid?: boolean) {
  if (invalid) return "border-error";
  if (valid) return "border-success";
  return "border-edge";
}

/**
 * Field wrapper: label + control + hint/error wiring.
 * Pass `error` to switch to the invalid state (aria-invalid + describedby).
 */
export function FormField({
  label,
  htmlFor,
  hint,
  error,
  success,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  success?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const messageId = error ? `${htmlFor}-message` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-fg">
        {label}
      </label>
      {children}
      {hint && !error && !success && (
        <p id={`${htmlFor}-hint`} className="text-xs text-faint">
          {hint}
        </p>
      )}
      {success && (
        <p
          id={messageId}
          className="flex items-center gap-1.5 text-xs font-medium text-success"
        >
          {success}
        </p>
      )}
      {error && (
        <p
          id={messageId}
          className="flex items-center gap-1.5 text-xs font-medium text-error"
          role="alert"
        >
          <svg aria-hidden viewBox="0 0 12 12" className="size-3 shrink-0 fill-current">
            <path d="M6 0a6 6 0 1 0 0 12A6 6 0 0 0 6 0Zm.75 9h-1.5V7.5h1.5V9Zm0-2.75h-1.5v-3.5h1.5v3.5Z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
  valid?: boolean;
};

export function Input({ invalid, valid, className, ...rest }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${rest.id}-message` : undefined}
      className={cn(fieldStyles, stateStyles(invalid, valid), className)}
      {...rest}
    />
  );
}

export function Textarea({
  invalid,
  valid,
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & InputProps) {
  return (
    <textarea
      className={cn(
        fieldStyles,
        "min-h-24 resize-y leading-relaxed",
        stateStyles(invalid, valid),
        className,
      )}
      {...rest}
    />
  );
}

export function Select({
  invalid,
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <select
        className={cn(
          fieldStyles,
          "appearance-none pe-9",
          invalid ? "border-error" : "border-edge",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 10 6"
        className="pointer-events-none absolute end-3 top-1/2 w-2.5 -translate-y-1/2 fill-none stroke-soft stroke-[1.5]"
      >
        <path d="m1 1 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function SearchField({
  label,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div className={cn("relative", className)}>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 fill-none stroke-faint stroke-[1.5]"
      >
        <circle cx="7" cy="7" r="4.75" />
        <path d="m11 11 3.5 3.5" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        aria-label={label}
        placeholder={rest.placeholder ?? label}
        className={cn(fieldStyles, "border-edge ps-9")}
        {...rest}
      />
    </div>
  );
}

/** Custom-drawn checkbox — deterministic across platforms, RTL-safe. */
export function Checkbox({
  label,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={cn("group flex cursor-pointer items-center gap-2.5", className)}>
      <input
        type="checkbox"
        className="sh-choice sh-choice--check size-5 shrink-0"
        {...rest}
      />
      <span className="text-sm select-none">{label}</span>
    </label>
  );
}

export function Radio({
  label,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2.5", className)}>
      <input
        type="radio"
        className="sh-choice sh-choice--dot size-5 shrink-0"
        {...rest}
      />
      <span className="text-sm select-none">{label}</span>
    </label>
  );
}

/** Switch — track + knob with logical-property translation for RTL. */
export function Switch({
  label,
  checked,
  defaultChecked,
  onCheckedChange,
  className,
}: {
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-3", className)}>
      <span className="relative inline-flex">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className="h-6 w-10 rounded-full border-2 border-edge-strong bg-hover transition-colors peer-checked:border-indigo peer-checked:bg-indigo"
        />
        <span
          aria-hidden
          className="absolute start-0.5 top-0.5 size-4 rounded-full bg-raised shadow-card transition-transform peer-checked:translate-x-4 peer-checked:bg-white rtl:peer-checked:-translate-x-4"
        />
      </span>
      <span className="text-sm select-none">{label}</span>
    </label>
  );
}
