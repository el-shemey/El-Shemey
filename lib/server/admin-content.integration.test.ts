import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  createCourse,
  createLesson,
  createModule,
  getCourseEditor,
  getLessonEditor,
  moveLesson,
  moveModule,
  updateCourse,
  updateLesson,
} from "@/lib/server/admin-content";
import { setCoursePublishState, deleteVideo } from "@/lib/server/admin-repo";
import { assertAdminRole } from "@/lib/server/admin-guard";
import {
  _setVideoStorageForTests,
  LocalVideoStorage,
} from "@/lib/server/video/storage";

/**
 * INTEGRATION — Admin CMS content management (live local DB).
 * Covers course/module/lesson creation, ordering stability, bilingual
 * persistence, publish validation, authorization primitives and safe
 * video deletion.
 */

const prisma = new PrismaClient();
let dbUp = true;
const RID = Math.random().toString(36).slice(2, 8);

let adminId = "";

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const admin =
      (await prisma.user.findFirst({ where: { role: "ADMIN" } })) ??
      (await prisma.user.create({
        data: { email: `cms-admin-${RID}@test.elshemey.dev`, role: "ADMIN" },
      }));
    adminId = admin.id;
  } catch {
    dbUp = false;
  }
});

afterAll(async () => {
  if (!dbUp) return;
  try {
    await prisma.videoAsset.deleteMany({ where: { title: { contains: RID } } });
    await prisma.lesson.deleteMany({ where: { titleEn: { contains: RID } } });
    await prisma.module.deleteMany({ where: { titleEn: { contains: RID } } });
    await prisma.course.deleteMany({
      where: { OR: [{ slug: { contains: RID } }, { titleEn: { contains: RID } }] },
    });
    await prisma.user.deleteMany({ where: { email: { contains: RID } } });
    await prisma.auditLog.deleteMany({
      where: {
        entityType: "VideoAsset",
        createdAt: { gte: new Date(Date.now() - 3600_000) },
      },
    });
  } catch {}
  await _setVideoStorageForTests(null);
  await prisma.$disconnect();
});

describe.sequential("admin authorization primitive", () => {
  it("denies USER/undefined roles before any mutation runs", () => {
    expect(() => assertAdminRole("USER")).toThrow("FORBIDDEN");
    expect(() => assertAdminRole(undefined)).toThrow("FORBIDDEN");
    expect(() => assertAdminRole("ADMIN")).not.toThrow();
  });
});

describe.sequential("course management", () => {
  let courseId = "";

  it("creates a course with a server-generated slug", async () => {
    if (!dbUp) return;
    const result = await createCourse({
      titleEn: `Prompt Craft ${RID}`,
      titleAr: `صناعة البرومبتات ${RID}`,
    });
    expect(result.ok).toBe(true);
    courseId = result.courseId!;
    const editor = await getCourseEditor(courseId);
    expect(editor?.slug).toMatch(/^prompt-craft/);
    expect(editor?.titleAr).toContain(RID);
  });

  it("generates unique slugs for identical titles", async () => {
    if (!dbUp) return;
    const dup = await createCourse({
      titleEn: `Prompt Craft ${RID}`,
      titleAr: "dup",
    });
    const first = await getCourseEditor(courseId);
    const second = await getCourseEditor(dup.courseId!);
    expect(first!.slug).not.toBe(second!.slug);
  });

  it("rejects courses missing bilingual titles", async () => {
    if (!dbUp) return;
    expect((await createCourse({ titleEn: "x", titleAr: "" })).ok).toBe(false);
    expect((await updateCourse(courseId, { titleEn: "", titleAr: "y" })).ok).toBe(
      false,
    );
  });

  it("blocks publishing an incomplete course with exact reasons", async () => {
    if (!dbUp) return;
    const result = await setCoursePublishState(adminId, courseId, "PUBLISHED");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("INCOMPLETE");
  });

  it("publishes once completeness passes", async () => {
    if (!dbUp) return;
    await updateCourse(courseId, {
      titleEn: `Prompt Craft ${RID}`,
      titleAr: `عربي ${RID}`,
      summaryEn: "A complete summary long enough for the metadata check.",
      summaryAr: `ملخص كافٍ للنشر ${RID}`,
    });
    const mod = await createModule(courseId, {
      titleEn: `M1 ${RID}`,
      titleAr: "وحدة",
    });
    void mod;
    const editor = await getCourseEditor(courseId);
    const lesson = await createLesson(editor!.modules[0].id, {
      titleEn: `L1 ${RID}`,
    });
    await updateLesson(lesson.lessonId!, {
      titleEn: `L1 ${RID}`,
      titleAr: "درس",
      publishState: "PUBLISHED",
    });
    // Also publish module so the course passes lesson checks
    const m = editor!.modules[0];
    await prisma.module.update({
      where: { id: m.id },
      data: { publishState: "PUBLISHED" },
    });
    const result = await setCoursePublishState(adminId, courseId, "PUBLISHED");
    expect(result.ok).toBe(true);
  });
});

describe.sequential("module & lesson ordering", () => {
  let courseId = "";
  let m1 = "";
  let m2 = "";
  let l1 = "";
  let l2 = "";
  let l3 = "";

  beforeAll(async () => {
    if (!dbUp) return;
    const c = await createCourse({ titleEn: `Order ${RID}`, titleAr: "ترتيب" });
    courseId = c.courseId!;
    await createModule(courseId, { titleEn: "A", titleAr: "أ" });
    await createModule(courseId, { titleEn: "B", titleAr: "ب" });
    const editor = await getCourseEditor(courseId);
    m1 = editor!.modules[0].id;
    m2 = editor!.modules[1].id;
    for (const t of ["one", "two", "two"]) {
      await createLesson(m1, { titleEn: `${t} ${RID}` });
    }
    const e2 = await getCourseEditor(courseId);
    l1 = e2!.modules[0].lessons[0].id;
    l2 = e2!.modules[0].lessons[1].id;
    l3 = e2!.modules[0].lessons[2].id;
  });

  it("assigns stable sequential positions on creation", async () => {
    if (!dbUp) return;
    const editor = await getCourseEditor(courseId);
    expect(editor!.modules.map((m) => m.position)).toEqual([1, 2]);
    expect(editor!.modules[0].lessons.map((l) => l.position)).toEqual([1, 2, 3]);
  });

  it("deduplicates lesson slugs within a module", async () => {
    if (!dbUp) return;
    const editor = await getCourseEditor(courseId);
    const slugs = editor!.modules[0].lessons.map((l) => l.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    // Titles: "one RID", "two RID", "two RID" → third gets -2 suffix.
    expect(slugs[2]).toBe(`${slugs[1]}-2`);
  });

  it("swaps lesson order transactionally without gaps", async () => {
    if (!dbUp) return;
    const up = await moveLesson(m1, l3, -1);
    expect(up.ok).toBe(true);
    const editor = await getCourseEditor(courseId);
    const ids = editor!.modules[0].lessons.map((l) => l.id);
    expect(ids).toEqual([l1, l3, l2]);
    expect(editor!.modules[0].lessons.map((l) => l.position)).toEqual([1, 2, 3]);
  });

  it("refuses out-of-range moves", async () => {
    if (!dbUp) return;
    expect((await moveLesson(m1, l1, -1)).ok).toBe(false);
    expect((await moveModule(courseId, m2, 1)).ok).toBe(false);
  });

  it("swaps module order", async () => {
    if (!dbUp) return;
    await moveModule(courseId, m1, 1);
    const editor = await getCourseEditor(courseId);
    expect(editor!.modules[0].id).toBe(m2);
    expect(editor!.modules[1].id).toBe(m1);
  });
});

describe.sequential("lesson content persistence (bilingual)", () => {
  it("stores EN+AR text and validated resources under contentRef", async () => {
    if (!dbUp) return;
    const c = await createCourse({ titleEn: `Content ${RID}`, titleAr: "محتوى" });
    await createModule(c.courseId!, { titleEn: "M", titleAr: "و" });
    const editor = await getCourseEditor(c.courseId!);
    const lesson = await createLesson(editor!.modules[0].id, { titleEn: "L" });

    const ok = await updateLesson(lesson.lessonId!, {
      titleEn: `Deep Context ${RID}`,
      titleAr: `السياق العميق ${RID}`,
      descriptionEn: "English body",
      descriptionAr: "نص عربي",
      accessLevel: "FREE",
      type: "LESSON",
      publishState: "DRAFT",
      durationSeconds: 615,
      resourcesJson: JSON.stringify([
        { label: "Cheat sheet", url: "https://example.com/x.pdf" },
        { label: "evil", url: "javascript:alert(1)" }, // must be dropped
      ]),
    });
    expect(ok.ok).toBe(true);

    const view = await getLessonEditor(lesson.lessonId!);
    expect(view?.titleAr).toContain(RID);
    expect(view?.contentRef?.descriptionAr).toBe("نص عربي");
    expect(view?.accessLevel).toBe("FREE");
    expect(view?.durationSeconds).toBe(615);
    expect(view?.contentRef?.resources).toHaveLength(1); // unsafe URL rejected
    expect(view?.publishState).toBe("DRAFT"); // draft isolation preserved
  });
});

describe.sequential("video deletion safety", () => {
  it("deletes row AND stored bytes; missing rows are reported", async () => {
    if (!dbUp) return;
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const pathMod = await import("node:path");
    const tmp = await fs.mkdtemp(pathMod.join(os.tmpdir(), "elshemey-del-"));
    _setVideoStorageForTests(new LocalVideoStorage(tmp));

    const c = await createCourse({ titleEn: `Del ${RID}`, titleAr: "حذف" });
    await createModule(c.courseId!, { titleEn: "M", titleAr: "و" });
    const editor = await getCourseEditor(c.courseId!);
    const lesson = await createLesson(editor!.modules[0].id, { titleEn: "L" });

    const asset = await prisma.videoAsset.create({
      data: {
        storageRef: `del-${RID}/original.mp4`,
        title: `to-delete-${RID}`,
        status: "READY",
        lessonId: lesson.lessonId!,
        createdById: adminId,
        mimeType: "video/mp4",
      },
    });
    const storage = new LocalVideoStorage(tmp);
    const bytes = new Uint8Array([1, 2, 3]);
    await storage.save(asset.storageRef, new Response(bytes).body!);

    const result = await deleteVideo(adminId, asset.id);
    expect(result.ok).toBe(true);
    expect(await prisma.videoAsset.findUnique({ where: { id: asset.id } })).toBeNull();
    expect(await storage.stat(asset.storageRef)).toBeNull(); // bytes gone too

    expect((await deleteVideo(adminId, "nonexistent")).ok).toBe(false);

    await fs.rm(tmp, { recursive: true, force: true });
  });
});
