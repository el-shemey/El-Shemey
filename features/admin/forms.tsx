"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCourseAction,
  createModuleAction,
  deleteResourceFormAction,
  updateCourseAction,
  updateLessonAction,
} from "@/features/admin/actions";
import { cn } from "@/lib/cn";

/**
 * Admin CMS forms (Phase 5A).
 * Progressive disclosure: each form is small and purpose-built; no giant
 * control walls. All mutations go through server actions that re-verify
 * the ADMIN role server-side.
 */

const field =
  "w-full rounded-sm border border-edge bg-base px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-indigo";
const label = "block text-xs font-semibold uppercase tracking-wider text-faint";

function Alert({ code }: { code?: string }) {
  if (!code) return null;
  const friendly: Record<string, string> = {
    MISSING_TITLES: "English and Arabic titles are both required.",
    MISSING_TITLE: "An English title is required.",
    FORBIDDEN: "Not authorized.",
  };
  return (
    <p role="alert" className="mt-2 text-xs text-error">
      {friendly[code] ?? `Action failed: ${code}`}
    </p>
  );
}

function Saved({ ok }: { ok?: boolean }) {
  if (!ok) return null;
  return (
    <p role="status" className="mt-2 text-xs font-semibold text-success">
      ✓ Saved
    </p>
  );
}

/* ------------------------------ Video uploader ----------------------------- */

const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_VIDEO_MAX_UPLOAD_MB ?? 2048);

export function VideoUploader({
  lessonOptions,
  pinnedLessonId,
}: {
  lessonOptions: Array<{ id: string; titleEn: string }>;
  /** When set, uploads attach to this lesson (lesson editor path). */
  pinnedLessonId?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function start() {
    const file = inputRef.current?.files?.[0];
    setError(null);
    setDone(false);
    if (!file) {
      setError("Choose a video file first.");
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`File exceeds the ${MAX_UPLOAD_MB} MB limit.`);
      return;
    }
    const form = new FormData();
    form.append("file", file);
    form.append("title", file.name.replace(/\.[^.]+$/, ""));
    const lessonId =
      pinnedLessonId ??
      (document.getElementById("upload-lesson") as HTMLSelectElement)?.value;
    if (lessonId) form.append("lessonId", lessonId);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", "/api/admin/videos/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      setProgress(null);
      if (xhr.status === 200) {
        setDone(true);
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      } else {
        let reason = `Upload failed (${xhr.status}).`;
        try {
          reason = JSON.parse(xhr.responseText).error ?? reason;
        } catch {}
        setError(reason.replace(/_/g, " ").toLowerCase());
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setError("Network error during upload.");
    };
    xhr.onabort = () => setProgress(null);
    setProgress(0);
    xhr.send(form);
  }

  function cancel() {
    xhrRef.current?.abort();
  }

  const busy = progress !== null;

  return (
    <div className="rounded-md border border-edge bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm"
          disabled={busy}
          aria-label="Video file"
          className="w-full text-sm file:me-3 file:rounded-sm file:border-0 file:bg-raised file:px-3 file:py-1.5 file:text-xs file:text-soft"
        />
        {pinnedLessonId ? (
          <input type="hidden" value={pinnedLessonId} readOnly aria-hidden />
        ) : (
          <select
            id="upload-lesson"
            disabled={busy}
            className={cn(field, "text-soft sm:w-56")}
            defaultValue=""
          >
            <option value="">— attach later —</option>
            {lessonOptions.map((l) => (
              <option key={l.id} value={l.id}>
                {l.titleEn}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={busy ? cancel : start}
          className={
            busy
              ? "rounded-sm border border-edge-strong px-4 py-2 text-sm font-semibold hover:border-error hover:text-error"
              : "rounded-sm bg-indigo px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-strong"
          }
        >
          {busy ? `${progress}% — Cancel` : "Upload"}
        </button>
      </div>

      {busy && (
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-raised"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo to-electric transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      <p className="mt-2 font-mono text-[10px] text-faint">
        MP4 / WebM · up to {MAX_UPLOAD_MB} MB · validated server-side by magic bytes
      </p>
      {error && (
        <p role="alert" className="mt-1 text-xs text-error">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="mt-1 text-xs font-semibold text-success">
          ✓ Upload complete and processed.
        </p>
      )}
    </div>
  );
}

/* ------------------------------ Course create ------------------------------ */

export function CreateCourseForm() {
  const [state, action, pending] = useActionState(createCourseAction, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <input
        name="titleEn"
        required
        placeholder="Title (EN)"
        aria-label="English title"
        className={field}
        dir="ltr"
      />
      <input
        name="titleAr"
        required
        placeholder="العنوان (AR)"
        aria-label="Arabic title"
        className={`${field} font-arabic`}
        dir="rtl"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-sm bg-indigo px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-strong disabled:opacity-50"
      >
        + New course
      </button>
      <Alert code={state.code} />
    </form>
  );
}

/* ------------------------------ Course editor ------------------------------ */

export interface CourseEditData {
  id: string;
  titleEn: string;
  titleAr: string;
  summaryEn: string | null;
  summaryAr: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  level: string;
  accessLevel: string;
  estimatedHours?: number | null;
  seoTitleEn?: string | null;
  seoDescEn?: string | null;
  meta?: {
    objectives?: { en?: string[]; ar?: string[] };
    prerequisites?: { en?: string[]; ar?: string[] };
    instructor?: { en?: string; ar?: string };
    coverUrl?: string;
  };
}

export function CourseEditorForm({ course }: { course: CourseEditData }) {
  const [state, action, pending] = useActionState(
    updateCourseAction.bind(null, course.id),
    {},
  );
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-1">
          <span className={label}>Title (EN)</span>
          <input
            name="titleEn"
            required
            defaultValue={course.titleEn}
            className={field}
            dir="ltr"
          />
        </label>
        <label className="block space-y-1">
          <span className={label}>العنوان (AR)</span>
          <input
            name="titleAr"
            required
            defaultValue={course.titleAr}
            className={`${field} font-arabic`}
            dir="rtl"
          />
        </label>
        <label className="block space-y-1">
          <span className={label}>Short description (EN)</span>
          <textarea
            name="summaryEn"
            rows={2}
            defaultValue={course.summaryEn ?? ""}
            className={field}
            dir="ltr"
          />
        </label>
        <label className="block space-y-1">
          <span className={label}>الوصف المختصر (AR)</span>
          <textarea
            name="summaryAr"
            rows={2}
            defaultValue={course.summaryAr ?? ""}
            className={`${field} font-arabic`}
            dir="rtl"
          />
        </label>
        <label className="block space-y-1">
          <span className={label}>Description (EN)</span>
          <textarea
            name="descriptionEn"
            rows={5}
            defaultValue={course.descriptionEn ?? ""}
            className={field}
            dir="ltr"
          />
        </label>
        <label className="block space-y-1">
          <span className={label}>الوصف (AR)</span>
          <textarea
            name="descriptionAr"
            rows={5}
            defaultValue={course.descriptionAr ?? ""}
            className={`${field} font-arabic`}
            dir="rtl"
          />
        </label>

        {/* Phase 8 — objectives / prerequisites */}
        <label className="block space-y-1">
          <span className={label}>Learning objectives (EN — one per line)</span>
          <textarea
            name="objectivesEn"
            rows={4}
            defaultValue={(course.meta?.objectives?.en ?? []).join("\n")}
            className={cn(field, "text-xs")}
            dir="ltr"
          />
        </label>
        <label className="block space-y-1">
          <span className={label}>أهداف التعلّم (AR — هدف في كل سطر)</span>
          <textarea
            name="objectivesAr"
            rows={4}
            defaultValue={(course.meta?.objectives?.ar ?? []).join("\n")}
            className={cn(field, "font-arabic text-xs")}
            dir="rtl"
          />
        </label>
        <label className="block space-y-1">
          <span className={label}>Prerequisites (EN — one per line)</span>
          <textarea
            name="prerequisitesEn"
            rows={3}
            defaultValue={(course.meta?.prerequisites?.en ?? []).join("\n")}
            className={cn(field, "text-xs")}
            dir="ltr"
          />
        </label>
        <label className="block space-y-1">
          <span className={label}>المتطلبات المسبقة (AR)</span>
          <textarea
            name="prerequisitesAr"
            rows={3}
            defaultValue={(course.meta?.prerequisites?.ar ?? []).join("\n")}
            className={cn(field, "font-arabic text-xs")}
            dir="rtl"
          />
        </label>
        <label className="block space-y-1">
          <span className={label}>Instructor (EN)</span>
          <input
            name="instructorEn"
            defaultValue={course.meta?.instructor?.en ?? ""}
            className={field}
            dir="ltr"
          />
        </label>
        <label className="block space-y-1">
          <span className={label}>المدرّب (AR)</span>
          <input
            name="instructorAr"
            defaultValue={course.meta?.instructor?.ar ?? ""}
            className={`${field} font-arabic`}
            dir="rtl"
          />
        </label>
        <label className="block space-y-1">
          <span className={label}>Cover image URL</span>
          <input
            name="coverUrl"
            defaultValue={course.meta?.coverUrl ?? ""}
            placeholder="https://…"
            className={cn(field, "font-mono text-xs")}
            dir="ltr"
          />
        </label>
        <label className="block space-y-1">
          <span className={label}>Estimated duration (hours)</span>
          <input
            name="estimatedHours"
            type="number"
            min={1}
            max={999}
            defaultValue={course.estimatedHours ?? ""}
            className={field}
            dir="ltr"
          />
        </label>
        <label className="block space-y-1">
          <span className={label}>SEO title</span>
          <input
            name="seoTitleEn"
            defaultValue={course.seoTitleEn ?? ""}
            className={field}
            dir="ltr"
          />
        </label>
        <label className="block space-y-1">
          <span className={label}>SEO description</span>
          <input
            name="seoDescEn"
            defaultValue={course.seoDescEn ?? ""}
            className={field}
            dir="ltr"
          />
        </label>
        <label className="block space-y-1">
          <span className={label}>Level</span>
          <select
            name="level"
            defaultValue={course.level}
            className={cn(field, "text-soft")}
          >
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span className={label}>Access</span>
          <select
            name="accessLevel"
            defaultValue={course.accessLevel}
            className={cn(field, "text-soft")}
          >
            <option value="PRO">PRO</option>
            <option value="FREE">FREE</option>
          </select>
        </label>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-indigo px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-strong disabled:opacity-50"
        >
          Save changes
        </button>
        <Saved ok={state.ok} />
        <Alert code={state.code} />
      </div>
    </form>
  );
}

/* -------------------------------- Add module ------------------------------- */

export function AddModuleForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState(
    createModuleAction.bind(null, courseId),
    {},
  );
  return (
    <form action={action} className="flex flex-wrap items-start gap-2">
      <input
        name="titleEn"
        required
        placeholder="Module title (EN)"
        aria-label="Module title EN"
        className={cn(field, "sm:w-64")}
        dir="ltr"
      />
      <input
        name="titleAr"
        required
        placeholder="عنوان الوحدة (AR)"
        aria-label="Module title AR"
        className={cn(field, "font-arabic sm:w-64")}
        dir="rtl"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-sm border border-edge-strong px-4 py-2 text-sm font-semibold hover:border-indigo disabled:opacity-50"
      >
        + Module
      </button>
      <Alert code={state.code} />
    </form>
  );
}

/* ---------------------------- Preview & confirm ----------------------------- */

export function VideoPreview({ src, title }: { src: string; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-sm border border-edge-strong px-3 py-1.5 text-xs font-semibold hover:border-indigo"
      >
        {open ? "Close preview" : "Preview"}
      </button>
      {open && (
        <div className="mt-2 w-full">
          <video
            controls
            preload="metadata"
            src={src}
            aria-label={`Preview: ${title}`}
            className="w-full rounded-sm border border-edge bg-black"
          />
        </div>
      )}
    </>
  );
}

/** Destructive actions must never fire silently. */
export function ConfirmSubmit({
  label,
  message,
  className,
  name,
  value,
}: {
  label: string;
  message: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {label}
    </button>
  );
}

/* ------------------------------ Lesson editor ------------------------------ */

export interface LessonEditData {
  id: string;
  titleEn: string;
  titleAr: string;
  descriptionEn?: string;
  descriptionAr?: string;
  summaryEn?: string;
  summaryAr?: string;
  objectivesEn?: string[];
  objectivesAr?: string[];
  type: string;
  accessLevel: string;
  publishState: string;
  durationSeconds: number | null;
  resources: Array<{ label: string; url: string }>;
  attachments: Array<{ label: string; url: string }>;
  blocks: import("@/lib/content").LessonBlock[];
  completionThreshold?: number | null;
}

export function LessonEditorForm({ lesson }: { lesson: LessonEditData }) {
  const [state, action, pending] = useActionState(
    updateLessonAction.bind(null, lesson.id),
    {},
  );
  const isPending = pending;
  const linksToText = (links: Array<{ label: string; url: string }>) =>
    links.map((r) => `${r.label} | ${r.url}`).join("\n");

  return (
    <form action={action} className="space-y-8">
      {/* CONTENT */}
      <section aria-labelledby="le-content">
        <h3
          id="le-content"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint"
        >
          Content
        </h3>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <label className="block space-y-1">
            <span className={label}>Title (EN)</span>
            <input
              name="titleEn"
              required
              defaultValue={lesson.titleEn}
              className={field}
              dir="ltr"
            />
          </label>
          <label className="block space-y-1">
            <span className={label}>العنوان (AR)</span>
            <input
              name="titleAr"
              defaultValue={lesson.titleAr}
              className={`${field} font-arabic`}
              dir="rtl"
            />
          </label>
          <label className="block space-y-1">
            <span className={label}>Lesson text (EN)</span>
            <textarea
              name="descriptionEn"
              rows={7}
              defaultValue={lesson.descriptionEn ?? ""}
              className={field}
              dir="ltr"
            />
          </label>
          <label className="block space-y-1">
            <span className={label}>نص الدرس (AR)</span>
            <textarea
              name="descriptionAr"
              rows={7}
              defaultValue={lesson.descriptionAr ?? ""}
              className={`${field} font-arabic`}
              dir="rtl"
            />
          </label>
          <label className="block space-y-1">
            <span className={label}>Summary (EN)</span>
            <textarea
              name="summaryEn"
              rows={2}
              defaultValue={lesson.summaryEn ?? ""}
              className={field}
              dir="ltr"
            />
          </label>
          <label className="block space-y-1">
            <span className={label}>الملخص (AR)</span>
            <textarea
              name="summaryAr"
              rows={2}
              defaultValue={lesson.summaryAr ?? ""}
              className={`${field} font-arabic`}
              dir="rtl"
            />
          </label>
          <label className="block space-y-1">
            <span className={label}>Objectives (EN — one per line)</span>
            <textarea
              name="objectivesEn"
              rows={3}
              defaultValue={(lesson.objectivesEn ?? []).join("\n")}
              className={cn(field, "text-xs")}
              dir="ltr"
            />
          </label>
          <label className="block space-y-1">
            <span className={label}>الأهداف (AR — هدف في كل سطر)</span>
            <textarea
              name="objectivesAr"
              rows={3}
              defaultValue={(lesson.objectivesAr ?? []).join("\n")}
              className={cn(field, "font-arabic text-xs")}
              dir="rtl"
            />
          </label>
        </div>

        {/* Structured block editor (Phase 8) */}
        <BlockEditor initialBlocks={lesson.blocks} />
      </section>

      {/* SETTINGS */}
      <section aria-labelledby="le-settings">
        <h3
          id="le-settings"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint"
        >
          Settings
        </h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-4">
          <label className="block space-y-1">
            <span className={label}>Type</span>
            <select
              name="type"
              defaultValue={lesson.type}
              className={cn(field, "text-soft")}
            >
              <option value="LESSON">Lesson</option>
              <option value="QUIZ">Quiz</option>
              <option value="PROJECT">Project</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className={label}>Access</span>
            <select
              name="accessLevel"
              defaultValue={lesson.accessLevel}
              className={cn(field, "text-soft")}
            >
              <option value="PRO">PRO</option>
              <option value="FREE">FREE preview</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className={label}>Duration override (min)</span>
            <input
              name="durationMinutes"
              type="number"
              min={0}
              max={1440}
              defaultValue={
                lesson.durationSeconds ? Math.round(lesson.durationSeconds / 60) : ""
              }
              className={field}
              dir="ltr"
            />
          </label>
          <label className="block space-y-1">
            <span className={label}>Completion threshold (%)</span>
            <input
              name="completionThresholdPercent"
              type="number"
              min={10}
              max={100}
              defaultValue={
                lesson.completionThreshold
                  ? Math.round(lesson.completionThreshold * 100)
                  : ""
              }
              placeholder="90"
              className={field}
              dir="ltr"
            />
          </label>
          <label className="block space-y-1">
            <span className={label}>State</span>
            <select
              name="publishState"
              defaultValue={lesson.publishState}
              className={cn(field, "text-soft")}
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </select>
          </label>
        </div>
      </section>

      {/* RESOURCES */}
      <section aria-labelledby="le-resources">
        <h3
          id="le-resources"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint"
        >
          Resources &amp; downloads
        </h3>
        <p className="mt-1 text-xs text-faint">
          One per line: <code className="font-mono">label | https://…</code>
        </p>
        <div className="mt-2 grid gap-4 md:grid-cols-2">
          <label className="block space-y-1">
            <span className={label}>Resources (links)</span>
            <textarea
              name="resources"
              rows={3}
              defaultValue={linksToText(lesson.resources)}
              placeholder="Cheat sheet | https://…"
              className={cn(field, "font-mono text-xs")}
              dir="ltr"
            />
          </label>
          <label className="block space-y-1">
            <span className={label}>Attachments (files)</span>
            <textarea
              name="attachments"
              rows={3}
              defaultValue={linksToText(lesson.attachments)}
              placeholder="Starter project | https://…"
              className={cn(field, "font-mono text-xs")}
              dir="ltr"
            />
          </label>
        </div>
      </section>

      <div className="flex items-center gap-4 border-t border-edge pt-5">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-sm bg-indigo px-8 py-3 text-sm font-semibold text-white hover:bg-indigo-strong disabled:opacity-50"
        >
          Save lesson
        </button>
        <Saved ok={state.ok} />
        <Alert code={state.code} />
      </div>
    </form>
  );
}

/* --------------------- Phase 8 � Block editor UI --------------------------- */

type EditorBlock = import("@/lib/content").LessonBlock;

const BLOCK_TYPES: Array<{ kind: EditorBlock["kind"]; label: string }> = [
  { kind: "p", label: "Paragraph" },
  { kind: "h", label: "Heading" },
  { kind: "code", label: "Code" },
  { kind: "callout", label: "Callout" },
  { kind: "tip", label: "Tip" },
  { kind: "warning", label: "Warning" },
  { kind: "quote", label: "Quote" },
  { kind: "checklist", label: "Checklist" },
  { kind: "exercise", label: "Exercise" },
  { kind: "image", label: "Image" },
  { kind: "table", label: "Table" },
  { kind: "divider", label: "Divider" },
];

function newBlock(kind: EditorBlock["kind"]): Record<string, unknown> {
  const id = crypto.randomUUID().slice(0, 12);
  const bilingual = { en: "", ar: "" };
  switch (kind) {
    case "code":
      return { id, kind, lang: "python", code: "" };
    case "checklist":
      return { id, kind, items: [{ en: "" }] };
    case "table":
      return { id, kind, headers: ["Column A", "Column B"], rows: [["", ""]] };
    case "divider":
      return { id, kind };
    default:
      return { id, kind, ...bilingual };
  }
}

/** Practical block editor: add/reorder/remove typed bilingual blocks. */
function BlockEditor({ initialBlocks }: { initialBlocks: EditorBlock[] }) {
  const [blocks, setBlocks] = useState<Record<string, unknown>[]>(
    initialBlocks.map((b) => b as unknown as Record<string, unknown>),
  );
  const hiddenRef = useRef<HTMLTextAreaElement | null>(null);

  // Serialize into the hidden field the form submits (server sanitizes).
  const sync = (next: Record<string, unknown>[]) => {
    setBlocks(next);
    if (hiddenRef.current) {
      hiddenRef.current.value = next.length > 0 ? JSON.stringify(next) : "";
    }
  };

  const update = (i: number, key: string, value: unknown) => {
    const next = blocks.map((b, j) => (j === i ? { ...b, [key]: value } : b));
    sync(next);
  };
  const move = (i: number, d: -1 | 1) => {
    const t = i + d;
    if (t < 0 || t >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[t]] = [next[t], next[i]];
    sync(next);
  };

  return (
    <div className="mt-4 rounded-md border border-edge bg-base p-3">
      <input
        ref={hiddenRef as unknown as React.RefObject<HTMLInputElement>}
        name="blocks"
        type="hidden"
        value={blocks.length > 0 ? JSON.stringify(blocks) : ""}
        readOnly
      />
      <div className="flex flex-wrap gap-1.5">
        <span className="me-2 font-mono text-[10px] uppercase tracking-widest text-faint">
          Content blocks
        </span>
        {BLOCK_TYPES.map((t) => (
          <button
            key={t.kind}
            type="button"
            onClick={() => sync([...blocks, newBlock(t.kind)])}
            className="rounded-xs border border-edge px-2 py-0.5 text-[10px] font-semibold text-soft hover:border-indigo hover:text-fg"
          >
            + {t.label}
          </button>
        ))}
      </div>

      <ol className="mt-3 space-y-2">
        {blocks.map((block, i) => {
          const kind = String(block.kind);
          return (
            <li
              key={(block.id as string) ?? i}
              className="rounded-sm border border-edge bg-surface p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-electric">
                  {String(i + 1).padStart(2, "0")} � {kind}
                </span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    aria-label="Move up"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="border border-edge px-1.5 text-[10px] text-soft disabled:opacity-30 hover:border-indigo"
                  >
                    ?
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    onClick={() => move(i, 1)}
                    disabled={i === blocks.length - 1}
                    className="border border-edge px-1.5 text-[10px] text-soft disabled:opacity-30 hover:border-indigo"
                  >
                    ?
                  </button>
                  <button
                    type="button"
                    aria-label="Remove block"
                    onClick={() => sync(blocks.filter((_, j) => j !== i))}
                    className="border border-edge px-1.5 text-[10px] text-faint hover:border-error hover:text-error"
                  >
                    �
                  </button>
                </span>
              </div>

              <div className="mt-2 grid gap-2">
                {"en" in block && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <textarea
                      rows={kind === "h" ? 1 : 3}
                      placeholder="English"
                      dir="ltr"
                      defaultValue={String(block.en ?? "")}
                      onChange={(e) => update(i, "en", e.target.value)}
                      className={cn(field, "text-xs")}
                    />
                    <textarea
                      rows={kind === "h" ? 1 : 3}
                      placeholder="???????"
                      dir="rtl"
                      defaultValue={String(block.ar ?? "")}
                      onChange={(e) => update(i, "ar", e.target.value)}
                      className={cn(field, "font-arabic text-xs")}
                    />
                  </div>
                )}
                {kind === "code" && (
                  <>
                    <input
                      placeholder="language (python / js / �)"
                      dir="ltr"
                      defaultValue={String(block.lang ?? "")}
                      onChange={(e) => update(i, "lang", e.target.value)}
                      className={cn(field, "font-mono text-xs")}
                    />
                    <textarea
                      rows={5}
                      placeholder="code"
                      dir="ltr"
                      defaultValue={String(block.code ?? "")}
                      onChange={(e) => update(i, "code", e.target.value)}
                      className={cn(field, "font-mono text-xs")}
                    />
                  </>
                )}
                {kind === "image" && (
                  <>
                    <input
                      placeholder="https:// image URL"
                      dir="ltr"
                      defaultValue={String(block.url ?? "")}
                      onChange={(e) => update(i, "url", e.target.value)}
                      className={cn(field, "font-mono text-xs")}
                    />
                    <input
                      placeholder="alt text (EN)"
                      dir="ltr"
                      defaultValue={String(block.altEn ?? "")}
                      onChange={(e) => update(i, "altEn", e.target.value)}
                      className={cn(field, "text-xs")}
                    />
                  </>
                )}
                {kind === "checklist" && Array.isArray(block.items) && (
                  <div className="space-y-1">
                    {(block.items as Array<{ en: string; done?: boolean }>).map(
                      (item, j) => (
                        <input
                          key={j}
                          placeholder={`Item ${j + 1}`}
                          dir="ltr"
                          defaultValue={item.en}
                          onChange={(e) => {
                            const items = [
                              ...(block.items as Array<Record<string, unknown>>),
                            ];
                            items[j] = { ...items[j], en: e.target.value };
                            update(i, "items", items);
                          }}
                          className={cn(field, "text-xs")}
                        />
                      ),
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        update(i, "items", [...(block.items as unknown[]), { en: "" }])
                      }
                      className="rounded-xs border border-edge px-2 py-0.5 text-[10px] text-soft hover:border-indigo"
                    >
                      + item
                    </button>
                  </div>
                )}
                {kind === "table" && (
                  <p className="font-mono text-[10px] text-faint">
                    Table rows are edited via JSON for now:
                    <textarea
                      rows={4}
                      dir="ltr"
                      defaultValue={JSON.stringify({
                        headers: block.headers,
                        rows: block.rows,
                      })}
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value) as Record<
                            string,
                            unknown
                          >;
                          if (parsed.headers) update(i, "headers", parsed.headers);
                          if (parsed.rows) update(i, "rows", parsed.rows);
                        } catch {}
                      }}
                      className={cn(field, "mt-1 font-mono text-[11px]")}
                    />
                  </p>
                )}
              </div>
            </li>
          );
        })}
        {blocks.length === 0 && (
          <li className="rounded-sm border border-dashed border-edge-strong p-4 text-center text-xs text-faint">
            No structured blocks � students see the plain lesson text above.
          </li>
        )}
      </ol>
    </div>
  );
}

/* -------------------- Phase 8 � Lesson resource files ---------------------- */

export function ResourceUploader({
  lessonId,
  resources,
}: {
  lessonId: string;
  resources: Array<{
    id: string;
    label: string;
    sizeBytes: number | null;
    mimeType: string | null;
  }>;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    const file = inputRef.current?.files?.[0];
    setError(null);
    if (!file) return;
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`/api/admin/lessons/${lessonId}/resources`, {
        method: "POST",
        body: form,
      });
      setBusy(false);
      if (res.ok) {
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          (data.error ?? `Upload failed (${res.status})`)
            .replace(/_/g, " ")
            .toLowerCase(),
        );
      }
    } catch {
      setBusy(false);
      setError("network error");
    }
  }

  return (
    <div className="rounded-md border border-edge bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.zip,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.md,.docx,.xlsx,.pptx"
          disabled={busy}
          aria-label="Resource file"
          className="text-sm file:me-3 file:rounded-sm file:border-0 file:bg-raised file:px-3 file:py-1.5 file:text-xs file:text-soft"
        />
        <button
          type="button"
          onClick={upload}
          disabled={busy}
          className="rounded-sm bg-indigo px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-strong disabled:opacity-50"
        >
          {busy ? "Uploading�" : "Upload resource"}
        </button>
      </div>
      <p className="mt-1 font-mono text-[10px] text-faint">
        PDF / ZIP / images / documents � up to 50 MB � served only through the
        authorized route
      </p>
      {error && (
        <p role="alert" className="mt-1 text-xs text-error">
          {error}
        </p>
      )}

      <ul className="mt-3 divide-y divide-edge">
        {resources.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 py-2"
          >
            <a
              href={`/api/resources/${r.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-soft hover:text-electric"
            >
              ? {r.label}
            </a>
            <span dir="ltr" className="font-mono text-[10px] text-faint">
              {r.mimeType ?? "file"}
              {r.sizeBytes ? ` � ${(r.sizeBytes / 1024 / 1024).toFixed(2)} MB` : ""}
            </span>
            <form action={deleteResourceFormAction.bind(null, r.id)}>
              <ConfirmSubmit
                label="Delete"
                message={`Delete resource "${r.label}"?`}
                className="rounded-sm border border-edge px-2 py-0.5 text-[10px] text-faint hover:border-error hover:text-error"
              />
            </form>
          </li>
        ))}
        {resources.length === 0 && (
          <li className="py-2 text-xs text-faint">No downloadable resources yet.</li>
        )}
      </ul>
    </div>
  );
}
