import { describe, expect, it } from "vitest";
import {
  applyCompletion,
  computeCourseProgress,
  orderedLessons,
  reconcileRecords,
} from "@/lib/domain/progress";
import type { LessonRef, ProgressRecord } from "@/lib/domain/types";

function lesson(
  id: string,
  moduleId: string,
  overrides: Partial<LessonRef> = {},
): LessonRef {
  return {
    id,
    moduleId,
    slug: id,
    titleEn: id,
    titleAr: id,
    type: "LESSON",
    accessLevel: "FREE",
    publishState: "PUBLISHED",
    ...overrides,
  };
}

const TREE = [
  {
    id: "m1",
    lessons: [
      lesson("l1", "m1"),
      lesson("l2", "m1"),
      lesson("draft-lesson", "m1", { publishState: "DRAFT" }),
    ],
  },
  {
    id: "m2",
    lessons: [
      lesson("l3", "m2"),
      lesson("pro-lesson", "m2", { accessLevel: "PRO" as const }),
    ],
  },
];

describe("orderedLessons / reconcileRecords — relationships & identity", () => {
  it("orders lessons across modules in tree order (locale-independent ids)", () => {
    const flat = orderedLessons(TREE);
    expect(flat.map((l) => l.id)).toEqual([
      "l1",
      "l2",
      "draft-lesson",
      "l3",
      "pro-lesson",
    ]);
  });

  it("ignores progress records for unknown/deleted lessons", () => {
    const records: ProgressRecord[] = [
      { lessonId: "l1", completedAt: new Date() },
      { lessonId: "ghost-lesson", completedAt: new Date() },
    ];
    const kept = reconcileRecords(orderedLessons(TREE), records);
    expect(kept).toHaveLength(1);
    expect(kept[0].lessonId).toBe("l1");
  });
});

describe("applyCompletion — creation, duplicates, retries", () => {
  const now = new Date("2026-01-01T10:00:00Z");

  it("creates a completion on first event", () => {
    const { record, wasDuplicate } = applyCompletion(undefined, now);
    expect(wasDuplicate).toBe(false);
    expect(record.completedAt).toEqual(now);
    expect(record.completionEvents).toBe(1);
  });

  it("is idempotent for duplicate completions — first timestamp preserved", () => {
    const first = applyCompletion(undefined, now);
    const second = applyCompletion(
      { lessonId: "l1", completedAt: first.record.completedAt },
      new Date("2026-02-02T12:00:00Z"),
    );
    expect(second.wasDuplicate).toBe(true);
    expect(second.record.completedAt).toEqual(now); // unchanged
    expect(second.record.completionEvents).toBeGreaterThan(
      first.record.completionEvents,
    );
  });

  it("treats a started-but-incomplete record as first completion on retry", () => {
    // e.g. a record created without completedAt
    const result = applyCompletion({ lessonId: "l1", completedAt: null }, now);
    expect(result.wasDuplicate).toBe(false);
    expect(result.record.completedAt).toEqual(now);
  });
});

describe("computeCourseProgress — derived aggregates", () => {
  it("empty records → 0%, current = first published lesson", () => {
    const p = computeCourseProgress(TREE, []);
    expect(p.percent).toBe(0);
    expect(p.currentLessonId).toBe("l1");
    expect(p.nextLessonId).toBe("l2");
    expect(p.activeModuleId).toBe("m1");
    expect(p.publishedLessons).toBe(4); // draft excluded
  });

  it("counts only PUBLISHED lessons toward percent", () => {
    const records: ProgressRecord[] = [
      { lessonId: "l1", completedAt: new Date() },
      { lessonId: "l2", completedAt: new Date() },
      { lessonId: "draft-lesson", completedAt: new Date() }, // must NOT count
    ];
    const p = computeCourseProgress(TREE, records);
    expect(p.completedCount).toBe(2);
    expect(p.percent).toBe(50); // 2 of 4 published
    expect(p.currentLessonId).toBe("l3");
    expect(p.lastActivityAt).toBeTruthy();
  });

  it("full completion → 100% with no current/next lesson", () => {
    const records: ProgressRecord[] = TREE.flatMap((m) =>
      m.lessons
        .filter((l) => l.publishState === "PUBLISHED")
        .map((l) => ({
          lessonId: l.id,
          completedAt: new Date(),
        })),
    );
    const p = computeCourseProgress(TREE, records);
    expect(p.percent).toBe(100);
    expect(p.currentLessonId).toBeNull();
    expect(p.nextLessonId).toBeNull();
  });
});
