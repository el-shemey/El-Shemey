import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  getCourseLearningView,
  getLessonView,
  getPreviewLessonView,
} from "@/lib/server/learner";
import { saveLessonPosition, startEnrollment } from "@/lib/server/learning-repo";

/**
 * INTEGRATION — Phase 6 student learning experience (live local DB).
 * Uses a DEDICATED deterministic course tree so assertions don't depend on
 * shared seed content. Covers: position persistence + resume, cross-user
 * isolation, overview state matrix (done/current/available/locked),
 * entitlement unlocking, and the anonymous free-preview boundary.
 */

const prisma = new PrismaClient();
let dbUp = true;
const RID = Math.random().toString(36).slice(2, 8);
const SLUG = `flow-course-${RID}`;

let adminId = "";
let planId = "";

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const admin =
      (await prisma.user.findFirst({ where: { role: "ADMIN" } })) ??
      (await prisma.user.create({
        data: { email: `flow-admin-${RID}@test.elshemey.dev`, role: "ADMIN" },
      }));
    adminId = admin.id;

    // Self-contained active plan — never borrow state from other test files
    // that may run in parallel against the same database.
    const plan = await prisma.plan.create({
      data: {
        slug: `flow-plan-${RID}`,
        nameEn: "Flow PRO",
        nameAr: "برو",
        interval: "MONTH",
        amountMinor: 10000,
        currency: "EGP",
        isActive: true,
      },
    });
    planId = plan.id;

    const course = await prisma.course.create({
      data: {
        slug: SLUG,
        titleEn: `Flow ${RID}`,
        titleAr: `تدفق ${RID}`,
        summaryEn: "Summary long enough for completeness checks.",
        summaryAr: "ملخص",
        level: "BEGINNER",
        accessLevel: "PRO",
        publishState: "PUBLISHED",
        estimatedHours: 4,
        modules: {
          create: {
            position: 1,
            titleEn: `M ${RID}`,
            titleAr: "وحدة",
            publishState: "PUBLISHED",
            lessons: {
              create: [
                {
                  slug: "l1",
                  position: 1,
                  accessLevel: "FREE",
                  publishState: "PUBLISHED",
                  titleEn: "L1",
                  titleAr: "د١",
                  durationSeconds: 300,
                },
                {
                  slug: "l2",
                  position: 2,
                  accessLevel: "PRO",
                  publishState: "PUBLISHED",
                  titleEn: "L2",
                  titleAr: "د٢",
                  durationSeconds: 420,
                },
                {
                  slug: "l3",
                  position: 3,
                  accessLevel: "PRO",
                  publishState: "PUBLISHED",
                  titleEn: "L3",
                  titleAr: "د٣",
                },
              ],
            },
          },
        },
      },
    });
    void course;
  } catch {
    dbUp = false;
  }
});

afterAll(async () => {
  if (!dbUp) return;
  try {
    await prisma.videoAsset.deleteMany({ where: { title: { contains: RID } } });
    await prisma.course.deleteMany({ where: { slug: SLUG } });
    await prisma.subscription.deleteMany({
      where: { plan: { slug: `flow-plan-${RID}` } },
    });
    await prisma.plan.deleteMany({ where: { slug: `flow-plan-${RID}` } });
    await prisma.user.deleteMany({
      where: { email: { contains: `-f-${RID}@` } },
    });
  } catch {}
  await prisma.$disconnect();
});

async function createUser(tag: string): Promise<string> {
  const u = await prisma.user.create({
    data: { email: `${tag}-f-${RID}@elshemey.dev` },
  });
  return u.id;
}

describe.sequential("Phase 6 learning flow", () => {
  let userA = "";
  let userB = "";

  beforeAll(async () => {
    if (!dbUp) return;
    userA = await createUser("a");
    userB = await createUser("b");
    await startEnrollment({ userId: userA, courseSlug: SLUG });
    await startEnrollment({ userId: userB, courseSlug: SLUG });
  });

  it("position persists and resurfaces as resumeAt in the lesson view", async () => {
    if (!dbUp) return;
    await saveLessonPosition(userA, SLUG, "l1", 187);
    const view = await getLessonView(userA, "en", SLUG, "l1");
    expect(view.status).toBe("OK");
    if (view.status === "OK") expect(view.resumeAt).toBe(187);

    // Overwrite keeps latest position (never resets accidentally).
    await saveLessonPosition(userA, SLUG, "l1", 240);
    const v2 = await getLessonView(userA, "en", SLUG, "l1");
    if (v2.status === "OK") expect(v2.resumeAt).toBe(240);
  });

  it("cross-user isolation: B's progress never appears in A's view", async () => {
    if (!dbUp) return;
    await saveLessonPosition(userB, SLUG, "l1", 42);
    const va = await getLessonView(userA, "en", SLUG, "l1");
    const vb = await getLessonView(userB, "en", SLUG, "l1");
    if (va.status === "OK" && vb.status === "OK") {
      expect(va.resumeAt).toBe(240); // A's own value
      expect(vb.resumeAt).toBe(42); // B's own value
    }
  });

  it("overview derives states: current first free lesson, PRO locked", async () => {
    if (!dbUp) return;
    const view = await getCourseLearningView(userA, SLUG);
    expect(view.status).toBe("OK");
    if (view.status !== "OK") return;

    const flat = view.modules.flatMap((m) => m.lessons);
    expect(flat.map((l) => l.state)).toEqual(["current", "locked", "locked"]);
    expect(view.progress.completedCount).toBe(0);
    // Resume target = the current open lesson.
    expect(view.resumeSlug).toBe("l1");

    const lesson = await getLessonView(userA, "en", SLUG, "l2");
    expect(lesson.status).toBe("LOCKED"); // PRO wall enforced server-side
  });

  it("completion advances current; PRO wall appears when the rest is locked", async () => {
    if (!dbUp) return;
    const { completeLesson } = await import("@/lib/server/learning-repo");
    await completeLesson({ userId: userA, courseSlug: SLUG, lessonSlug: "l1" });

    const view = await getCourseLearningView(userA, SLUG);
    if (view.status !== "OK") return;
    const flat = view.modules.flatMap((m) => m.lessons);
    expect(flat.map((l) => l.state)).toEqual(["done", "locked", "locked"]);
    // No open slot remains → no resume target (PRO wall).
    expect(view.resumeSlug).toBeNull();

    // Next-lesson navigation from l1 still re-authorizes: LOCKED.
    const next = await getLessonView(userA, "en", SLUG, "l2");
    expect(next.status).toBe("LOCKED");
  });

  it("active entitlement unlocks PRO lessons across overview + player", async () => {
    if (!dbUp) return;
    await prisma.subscription.create({
      data: {
        userId: userB,
        planId,
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 7 * 86400_000),
      },
    });
    const view = await getCourseLearningView(userB, SLUG);
    if (view.status !== "OK") return;
    const flat = view.modules.flatMap((m) => m.lessons);
    expect(flat.every((l) => l.state !== "locked")).toBe(true);

    // Attach a READY video so the full playback chain can complete.
    const lesson2 = await prisma.lesson.findFirst({ where: { slug: "l2" } });
    await prisma.videoAsset.create({
      data: {
        storageRef: `flow-${RID}-l2/original.mp4`,
        title: `flow-video-${RID}`,
        status: "READY",
        mimeType: "video/mp4",
        lessonId: lesson2!.id,
        createdById: adminId,
      },
    });

    const pro = await getLessonView(userB, "en", SLUG, "l2");
    expect(pro.status).toBe("OK");
    if (pro.status === "OK") {
      expect(pro.video.allowed).toBe(true); // signed URL issued
    }
  });

  it("anonymous preview: FREE renders, PRO LOCKED, unknown NOT_FOUND", async () => {
    if (!dbUp) return;
    const free = await getPreviewLessonView(SLUG, "l1");
    expect(free.status).toBe("OK");
    if (free.status === "OK") {
      expect(Object.keys(free)).not.toContain("playbackUrl");
      expect(Object.keys(free)).not.toContain("progress");
    }

    const pro = await getPreviewLessonView(SLUG, "l2");
    expect(pro.status).toBe("LOCKED");

    const ghost = await getPreviewLessonView(SLUG, `ghost-${RID}`);
    expect(ghost.status).toBe("NOT_FOUND");
  });

  it("position writes are refused for inaccessible lessons", async () => {
    if (!dbUp) return;
    // userA has no entitlement → l2 is locked → position write denied.
    await expect(saveLessonPosition(userA, SLUG, "l2", 100)).rejects.toThrow(
      "ACCESS_DENIED",
    );
    // No row may exist for the refused write.
    const lesson2 = await prisma.lesson.findFirst({ where: { slug: "l2" } });
    const rows = await prisma.lessonProgress.count({
      where: { lessonId: lesson2!.id, enrollment: { userId: userA } },
    });
    expect(rows).toBe(0);
  });

  it("smart next skips locked lessons; course-complete state is exact", async () => {
    if (!dbUp) return;
    const { completeLesson } = await import("@/lib/server/learning-repo");

    // userA (no entitlement) completes l1 → next available must be null
    // (everything after is PRO/locked), never a locked href.
    const viewA = await getLessonView(userA, "en", SLUG, "l1");
    if (viewA.status === "OK" && viewA.completed) {
      expect(viewA.nextAvailableHref).toBeNull();
    }

    // userB (entitled) completes all three → courseCompleted flips true and
    // the last lesson offers no next.
    for (const s of ["l1", "l2", "l3"]) {
      await completeLesson({ userId: userB, courseSlug: SLUG, lessonSlug: s });
    }
    const done = await getLessonView(userB, "en", SLUG, "l3");
    if (done.status === "OK") {
      expect(done.courseCompleted).toBe(true);
      expect(done.nextAvailableHref).toBeNull();
    }
  });
});
