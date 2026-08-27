import { describe, expect, it } from "vitest";
import {
  sanitizeLessonBlocks,
  isSafeRemoteUrl,
  extractLessonContent,
} from "@/lib/content";

/**
 * Unit — structured lesson content blocks (Phase 6).
 * The same sanitizer guards the admin write path and the student render
 * path; these tests pin its security and shape guarantees.
 */

describe("sanitizeLessonBlocks", () => {
  it("accepts well-formed blocks", () => {
    const blocks = sanitizeLessonBlocks([
      { kind: "p", en: "Hello", ar: "أهلاً" },
      { kind: "h", en: "Heading" },
      { kind: "code", lang: "js", code: "console.log(1)" },
      { kind: "callout", tone: "warn", en: "Careful" },
      { kind: "checklist", items: [{ en: "Do this", done: true }] },
      { kind: "exercise", en: "Try it yourself" },
      { kind: "image", url: "https://cdn.example.com/x.png", altEn: "Diagram" },
    ]);
    expect(blocks).toHaveLength(7);
    expect(blocks[0]).toEqual({ kind: "p", en: "Hello", ar: "أهلاً" });
  });

  it("parses JSON strings (admin form payload)", () => {
    const blocks = sanitizeLessonBlocks(
      JSON.stringify([{ kind: "p", en: "From JSON" }]),
    );
    expect(blocks).toEqual([{ kind: "p", en: "From JSON" }]);
  });

  it("drops unknown kinds and malformed entries", () => {
    const blocks = sanitizeLessonBlocks([
      { kind: "script", en: "<script>alert(1)</script>" },
      null,
      42,
      { kind: "p" }, // missing text
      { kind: "code" }, // empty code
      { kind: "p", en: "Survivor" },
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ kind: "p", en: "Survivor" });
  });

  it("rejects non-https image URLs (no javascript:, no data:, no //)", () => {
    expect(
      sanitizeLessonBlocks([{ kind: "image", url: "javascript:alert(1)", altEn: "x" }]),
    ).toHaveLength(0);
    expect(
      sanitizeLessonBlocks([{ kind: "image", url: "data:text/html,<b>", altEn: "x" }]),
    ).toHaveLength(0);
    expect(
      sanitizeLessonBlocks([
        { kind: "image", url: "//evil.example.com/x", altEn: "x" },
      ]),
    ).toHaveLength(0);
    expect(isSafeRemoteUrl("https://ok.example.com/a.png")).toBe(true);
  });

  it("enforces caps: max 100 blocks, text truncation", () => {
    const many = Array.from({ length: 250 }, (_, i) => ({ kind: "p", en: `t${i}` }));
    expect(sanitizeLessonBlocks(many)).toHaveLength(100);

    const long = "x".repeat(50_000);
    const [block] = sanitizeLessonBlocks([{ kind: "p", en: long }]);
    if (block?.kind === "p") {
      expect(block.en.length).toBeLessThanOrEqual(10_000);
    } else {
      throw new Error("expected p block");
    }
  });

  it("returns empty for garbage instead of throwing", () => {
    expect(sanitizeLessonBlocks("not json at all")).toEqual([]);
    expect(sanitizeLessonBlocks({ kind: "p" })).toEqual([]);
    expect(sanitizeLessonBlocks(undefined)).toEqual([]);
    expect(extractLessonContent(null).blocks).toEqual([]);
  });

  it("extractLessonContent keeps legacy body alongside blocks", () => {
    const c = extractLessonContent({
      descriptionEn: "body",
      descriptionAr: "جسم",
      blocks: [{ kind: "h", en: "Title" }],
    });
    expect(c.descriptionEn).toBe("body");
    expect(c.blocks).toHaveLength(1);
  });
});
