import { z } from "zod";

/**
 * Structured lesson content blocks (Phase 8 Content Factory).
 *
 * ONE validated schema guards both boundaries:
 *  - admin save path (features/admin actions → lib/server/admin-content.ts)
 *  - student render path (lesson page block renderer)
 *
 * Rendering NEVER uses dangerouslySetInnerHTML: every block maps to fixed
 * React elements with escaped text children. Block IDs are assigned by the
 * editor (client) and preserved verbatim; they are labels, not security.
 */

export const MAX_BLOCKS = 100;
const MAX_TEXT = 10_000;
const MAX_ITEMS = 30;
const MAX_CODE = 20_000;
const MAX_TABLE_CELLS = 400;

/** Only http(s) remote references are ever allowed. */
export function isSafeRemoteUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^https:\/\/[^\s"'<>]+$/.test(value) &&
    value.length <= 2048
  );
}

const idField = z
  .string()
  .max(64)
  .regex(/^[A-Za-z0-9_-]*$/)
  .optional();

const textEn = z.string().trim().min(1).max(MAX_TEXT);
const textAr = z.string().trim().max(MAX_TEXT).optional();

const lessonP = z.object({ kind: z.literal("p"), id: idField, en: textEn, ar: textAr });
const lessonH = z.object({ kind: z.literal("h"), id: idField, en: textEn, ar: textAr });
const lessonQuote = z.object({
  kind: z.literal("quote"),
  id: idField,
  en: textEn,
  ar: textAr,
  attribution: z.string().trim().max(200).optional(),
});
const lessonExercise = z.object({
  kind: z.literal("exercise"),
  id: idField,
  en: textEn,
  ar: textAr,
});
const calloutOf = (kind: "callout" | "tip" | "warning") =>
  z.object({ kind: z.literal(kind), id: idField, en: textEn, ar: textAr });
const lessonCallout = calloutOf("callout");
const lessonTip = calloutOf("tip");
const lessonWarning = calloutOf("warning");
const lessonCode = z.object({
  kind: z.literal("code"),
  id: idField,
  lang: z.string().trim().max(24).default("text"),
  code: z.string().max(MAX_CODE),
  explanation: z.object({ en: textEn, ar: textAr }).partial().optional(),
});
const checklistSchema = z.object({
  kind: z.literal("checklist"),
  id: idField,
  items: z
    .array(
      z.object({
        id: idField,
        en: z.string().trim().min(1).max(500),
        ar: z.string().trim().max(500).optional(),
        done: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(MAX_ITEMS),
});
const imageSchema = z.object({
  kind: z.literal("image"),
  id: idField,
  url: z.string().refine(isSafeRemoteUrl, "unsafe URL").or(z.literal("")).optional(),
  altEn: z.string().trim().min(1).max(300),
  altAr: z.string().trim().max(300).optional(),
});
const tableSchema = z.object({
  kind: z.literal("table"),
  id: idField,
  headers: z.array(z.string().trim().max(120)).min(1).max(8),
  rows: z
    .array(z.array(z.string().trim().max(500)).max(8))
    .min(1)
    .max(Math.ceil(MAX_TABLE_CELLS / 8)),
});
const dividerSchema = z.object({ kind: z.literal("divider"), id: idField });

export const lessonBlockSchema = z.discriminatedUnion("kind", [
  lessonP,
  lessonH,
  lessonCode,
  lessonCallout,
  lessonTip,
  lessonWarning,
  lessonQuote,
  checklistSchema,
  lessonExercise,
  imageSchema,
  tableSchema,
  dividerSchema,
]);

export type LessonBlock = z.infer<typeof lessonBlockSchema>;

/**
 * Validates an untrusted `blocks` value into LessonBlock[].
 * Unknown kinds and malformed entries are DROPPED, never thrown past the
 * caller — a bad block must never break a lesson page. IDs are preserved
 * when present; otherwise stable ids are derived from index order at save
 * time by the editor (this function never invents content).
 */
export interface CourseMetaLike {
  [k: string]: unknown;
}

/** Post-validation length clamps (zod validates presence; we clamp size). */
function clampBlock<T extends LessonBlock>(b: T): T {
  const s = (v: string | undefined, max: number) =>
    v === undefined ? undefined : v.slice(0, max);
  switch (b.kind) {
    case "code":
      return { ...b, code: b.code.slice(0, MAX_CODE), lang: b.lang.slice(0, 24) };
    case "checklist":
      return {
        ...b,
        items: b.items.map((i) => ({ ...i, en: i.en.slice(0, 500), ar: s(i.ar, 500) })),
      };
    case "image":
      return { ...b, altEn: b.altEn.slice(0, 300), altAr: s(b.altAr, 300) };
    case "table":
      return {
        ...b,
        headers: b.headers.map((h) => h.slice(0, 120)),
        rows: b.rows.map((r) => r.map((c) => c.slice(0, 500))),
      };
    default: {
      // Bilingual text blocks (p/h/callout/tip/warning/quote/exercise).
      const bb = b as unknown as { en: string; ar?: string };
      const clamped = {
        ...bb,
        en: bb.en.slice(0, MAX_TEXT),
        ...(bb.ar !== undefined ? { ar: bb.ar.slice(0, MAX_TEXT) } : {}),
      };
      return clamped as unknown as T;
    }
  }
}

/** Pre-validation clamps so oversized strings truncate instead of failing. */
function preclamp(entry: Record<string, unknown>): Record<string, unknown> {
  const out = { ...entry };
  const clampStr = (key: string, max: number) => {
    const v = out[key];
    if (typeof v === "string" && v.length > max) out[key] = v.slice(0, max);
  };
  for (const key of ["en", "ar", "code", "altEn", "altAr", "attribution"]) {
    clampStr(key, key === "code" ? MAX_CODE : MAX_TEXT);
  }
  if (Array.isArray(out.items)) {
    out.items = (out.items as unknown[]).slice(0, MAX_ITEMS);
  }
  return out;
}

/**
 * Validates an untrusted `blocks` value into LessonBlock[].
 * Unknown kinds and malformed entries are DROPPED, never thrown past the
 * caller — a bad block must never break a lesson page. IDs are preserved
 * when present; otherwise stable ids are derived from index order at save
 * time by the editor (this function never invents content).
 */
export function sanitizeLessonBlocks(value: unknown): LessonBlock[] {
  let raw: unknown = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];

  const out: LessonBlock[] = [];
  for (const entry of raw.slice(0, MAX_BLOCKS)) {
    if (!entry || typeof entry !== "object") continue;
    const result = lessonBlockSchema.safeParse(
      preclamp(entry as Record<string, unknown>),
    );
    if (!result.success) continue;
    out.push(clampBlock(result.data as LessonBlock));
    if (out.length >= MAX_BLOCKS) break;
  }
  return out;
}

export interface LessonContent {
  descriptionEn: string | null;
  descriptionAr: string | null;
  blocks: LessonBlock[];
}

/** Extracts legacy/plain body + structured blocks from a contentRef object. */
export function extractLessonContent(contentRef: unknown): LessonContent {
  if (!contentRef || typeof contentRef !== "object") {
    return { descriptionEn: null, descriptionAr: null, blocks: [] };
  }
  const c = contentRef as Record<string, unknown>;
  return {
    descriptionEn: typeof c.descriptionEn === "string" ? c.descriptionEn : null,
    descriptionAr: typeof c.descriptionAr === "string" ? c.descriptionAr : null,
    blocks: sanitizeLessonBlocks(c.blocks),
  };
}
