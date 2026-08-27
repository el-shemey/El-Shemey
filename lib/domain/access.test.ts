import { describe, expect, it } from "vitest";
import { canViewLesson, noEntitlements } from "@/lib/domain/access";
import {
  completeLessonInputSchema,
  startEnrollmentInputSchema,
  slugSchema,
} from "@/lib/domain/schemas";

const published = {
  lesson: { accessLevel: "FREE" as const, publishState: "PUBLISHED" as const },
  modulePublishState: "PUBLISHED" as const,
};

describe("access boundary — FREE vs PRO (server-side only)", () => {
  it("FREE lessons are previewable without entitlements", () => {
    expect(canViewLesson(published, false)).toBe(true);
  });

  it("PRO lessons are blocked without entitlement", () => {
    const pro = {
      lesson: { accessLevel: "PRO" as const, publishState: "PUBLISHED" as const },
      modulePublishState: "PUBLISHED" as const,
    };
    expect(canViewLesson(pro, false)).toBe(false);
    expect(canViewLesson(pro, true)).toBe(true);
  });

  it("DRAFT content is never accessible — even with PRO", () => {
    const draft = {
      lesson: { accessLevel: "FREE" as const, publishState: "DRAFT" as const },
      modulePublishState: "PUBLISHED" as const,
    };
    const draftModule = {
      lesson: published.lesson,
      modulePublishState: "DRAFT" as const,
    };
    expect(canViewLesson(draft, true)).toBe(false);
    expect(canViewLesson(draftModule, true)).toBe(false);
  });

  it("ARCHIVED content is hidden", () => {
    const archived = { ...published, modulePublishState: "ARCHIVED" as const };
    expect(canViewLesson(archived, false)).toBe(false);
  });

  it("default provider grants no PRO access (Phase 3 has no subscriptions)", async () => {
    expect(await noEntitlements.hasProAccess("anyone")).toBe(false);
  });
});

describe("input validation boundaries — invalid relationships rejected", () => {
  it("rejects malformed slugs", () => {
    expect(slugSchema.safeParse("Bad Slug").success).toBe(false);
    expect(slugSchema.safeParse("").success).toBe(false);
    expect(slugSchema.safeParse("prompt-engineering").success).toBe(true);
  });

  it("requires userId + courseSlug + lessonSlug for completions", () => {
    expect(
      completeLessonInputSchema.safeParse({ courseSlug: "x-course", lessonSlug: "l1" })
        .success,
    ).toBe(false);
    expect(
      completeLessonInputSchema.safeParse({
        userId: "cjld2cjxh0000qzrmn831i7rn",
        courseSlug: "x-course",
        lessonSlug: "l1",
      }).success,
    ).toBe(true);
  });

  it("validates enrollment start input", () => {
    expect(startEnrollmentInputSchema.safeParse({ userId: "not-a-cuid" }).success).toBe(
      false,
    );
  });
});
