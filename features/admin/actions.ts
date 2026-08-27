"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/server/auth/session";
import {
  approveRefund,
  assignVideoToLesson,
  confirmManualPayment,
  deleteVideo,
  rejectRefund,
  setCoursePublishState,
  setVideoPublishState,
} from "@/lib/server/admin-repo";
import {
  createCourse,
  createLesson,
  createModule,
  deleteCourse,
  deleteLesson,
  deleteModule,
  deleteResourceFile,
  duplicateCourse,
  duplicateLesson,
  duplicateModule,
  moveLesson,
  moveLessonToModule,
  setLessonPublishState,
  moveModule,
  updateCourse,
  updateLesson,
} from "@/lib/server/admin-content";

/**
 * Admin server actions.
 *
 * SECURITY: EVERY action re-verifies the role server-side via
 * requireRole("ADMIN") — the admin layout guard is never the only check,
 * and client payloads can never supply identity or role.
 * Errors return coarse reason codes; Prisma internals never leak.
 */

export type AdminActionState = { ok?: boolean; code?: string };

/* ------------------------------- Videos ----------------------------------- */

export async function assignVideoAction(
  videoId: string,
  lessonId: string | null,
): Promise<void> {
  const admin = await requireRole("ADMIN");
  await assignVideoToLesson(admin.id, videoId, lessonId);
  revalidatePath("/admin/media");
}

/** Form-driven variant: select value "" means unassign. */
export async function assignVideoFormAction(
  videoId: string,
  formData: FormData,
): Promise<void> {
  await assignVideoAction(videoId, String(formData.get("lessonId") ?? "") || null);
}

export async function setVideoPublishStateAction(
  videoId: string,
  next: "READY" | "ARCHIVED",
): Promise<void> {
  const admin = await requireRole("ADMIN");
  const result = await setVideoPublishState(admin.id, videoId, next);
  if (!result.ok) console.warn("video publish rejected:", result.reason ?? "");
  revalidatePath("/admin/media");
}

export async function deleteVideoAction(videoId: string): Promise<void> {
  const admin = await requireRole("ADMIN");
  const result = await deleteVideo(admin.id, videoId);
  if (!result.ok) console.warn("video delete rejected:", result.reason ?? "");
  revalidatePath("/admin/media");
}

export async function archiveVideoAction(videoId: string): Promise<void> {
  const admin = await requireRole("ADMIN");
  const result = await setVideoPublishState(admin.id, videoId, "ARCHIVED");
  void result;
  revalidatePath("/admin/media");
}

/* ------------------------------- Courses ---------------------------------- */

export async function setCoursePublishStateAction(
  courseId: string,
  next: "PUBLISHED" | "DRAFT" | "ARCHIVED",
): Promise<{ ok: boolean; reason?: string }> {
  const admin = await requireRole("ADMIN");
  const result = await setCoursePublishState(admin.id, courseId, next);
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/en/courses");
  revalidatePath("/ar/courses");
  return result;
}

export async function createCourseAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    await requireRole("ADMIN");
  } catch {
    return { code: "FORBIDDEN" };
  }
  const result = await createCourse({
    titleEn: String(formData.get("titleEn") ?? ""),
    titleAr: String(formData.get("titleAr") ?? ""),
  });
  if (!result.ok || !result.courseId) return { code: result.reason ?? "UNKNOWN" };
  redirect(`/admin/courses/${result.courseId}`);
}

export async function updateCourseAction(
  courseId: string,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    await requireRole("ADMIN");
  } catch {
    return { code: "FORBIDDEN" };
  }
  const raw = Object.fromEntries(formData.entries());
  const result = await updateCourse(courseId, raw);
  if (!result.ok) return { code: result.reason ?? "UNKNOWN" };
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/admin/courses");
  return { ok: true };
}

/* ------------------------- Modules & lessons ------------------------------ */

export async function createModuleAction(
  courseId: string,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    await requireRole("ADMIN");
  } catch {
    return { code: "FORBIDDEN" };
  }
  const result = await createModule(courseId, {
    titleEn: String(formData.get("titleEn") ?? ""),
    titleAr: String(formData.get("titleAr") ?? ""),
  });
  if (!result.ok) return { code: result.reason ?? "UNKNOWN" };
  revalidatePath(`/admin/courses/${courseId}`);
  return { ok: true };
}

export async function renameModuleAction(
  courseId: string,
  moduleId: string,
  formData: FormData,
): Promise<void> {
  await requireRole("ADMIN");
  const { renameModule } = await import("@/lib/server/admin-content");
  await renameModule(moduleId, {
    titleEn: String(formData.get(`module-title-en-${moduleId}`) ?? ""),
    titleAr: String(formData.get(`module-title-ar-${moduleId}`) ?? ""),
  });
  revalidatePath(`/admin/courses/${courseId}`);
}

export async function createLessonAction(
  moduleId: string,
  courseId: string,
  formData: FormData,
): Promise<void> {
  await requireRole("ADMIN");
  const result = await createLesson(moduleId, {
    titleEn: String(formData.get("titleEn") ?? ""),
    titleAr: String(formData.get("titleAr") ?? "") || undefined,
  });
  if (result.ok && result.lessonId) {
    redirect(`/admin/lessons/${result.lessonId}`);
  }
}

export async function updateLessonAction(
  lessonId: string,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    await requireRole("ADMIN");
  } catch {
    return { code: "FORBIDDEN" };
  }
  // resources/attachments arrive as newline-separated `label | url` pairs and
  // are converted into validated JSON before hitting the domain layer.
  let form = parseLinkPairs(formData, "resources", "resourcesJson");
  form = parseLinkPairs(form, "attachments", "attachmentsJson");
  // Structured content blocks (Phase 6): raw JSON is sanitized in the domain
  // layer by sanitizeLessonBlocks — malformed entries are dropped, not fatal.
  const blocksRaw = String(formData.get("blocks") ?? "").trim();
  if (blocksRaw) {
    form.append("blocksJson", blocksRaw);
    form.delete("blocks");
  }
  // The editor exposes minutes; the domain stores seconds.
  const minutes = Number(form.get("durationMinutes"));
  if (Number.isFinite(minutes) && minutes > 0) {
    form.set("durationSeconds", String(Math.round(minutes * 60)));
  }
  // Completion threshold arrives as a percentage; the domain stores 0–1.
  const pct = Number(form.get("completionThresholdPercent"));
  if (Number.isFinite(pct) && pct > 0) {
    form.set("completionThresholdPercent", String(Math.round(pct)));
  }
  const raw = Object.fromEntries(form.entries());
  const result = await updateLesson(lessonId, raw);
  if (!result.ok) return { code: result.reason ?? "UNKNOWN" };
  revalidatePath(`/admin/lessons/${lessonId}`);
  revalidatePath("/admin/courses");
  return { ok: true };
}

function parseLinkPairs(form: FormData, field: string, target: string): FormData {
  const rawValue = String(form.get(field) ?? "");
  if (!rawValue.trim()) return form;
  const pairs = rawValue
    .split("\n")
    .map((line) => line.split("|", 2))
    .filter((parts) => parts.length === 2)
    .map(([label, url]) => ({ label: label.trim(), url: url.trim() }));
  const next = new FormData();
  for (const [key, value] of form.entries()) {
    if (key !== field) next.append(key, value);
  }
  next.append(target, JSON.stringify(pairs));
  return next;
}

export async function moveLessonAction(
  courseId: string,
  moduleId: string,
  lessonId: string,
  direction: 1 | -1,
): Promise<void> {
  await requireRole("ADMIN");
  const result = await moveLesson(moduleId, lessonId, direction);
  void result;
  revalidatePath(`/admin/courses/${courseId}`);
}

export async function moveModuleAction(
  courseId: string,
  moduleId: string,
  direction: 1 | -1,
): Promise<void> {
  await requireRole("ADMIN");
  const result = await moveModule(courseId, moduleId, direction);
  void result;
  revalidatePath(`/admin/courses/${courseId}`);
}

/* --------------------- Phase 8 — Content Factory ops ---------------------- */

export async function deleteLessonAction(
  courseId: string,
  lessonId: string,
): Promise<void> {
  const admin = await requireRole("ADMIN");
  await deleteLesson(admin.id, lessonId);
  revalidatePath(`/admin/courses/${courseId}`);
}

export async function duplicateLessonAction(
  courseId: string,
  lessonId: string,
): Promise<void> {
  const admin = await requireRole("ADMIN");
  const result = await duplicateLesson(admin.id, lessonId);
  if (result.ok && result.lessonId) redirect(`/admin/lessons/${result.lessonId}`);
}

export async function deleteModuleAction(
  courseId: string,
  moduleId: string,
): Promise<void> {
  const admin = await requireRole("ADMIN");
  await deleteModule(admin.id, moduleId);
  revalidatePath(`/admin/courses/${courseId}`);
}

export async function duplicateModuleAction(
  courseId: string,
  moduleId: string,
): Promise<void> {
  const admin = await requireRole("ADMIN");
  await duplicateModule(admin.id, moduleId);
  revalidatePath(`/admin/courses/${courseId}`);
}

export async function moveLessonToModuleAction(
  courseId: string,
  lessonId: string,
  formData: FormData,
): Promise<void> {
  const admin = await requireRole("ADMIN");
  const targetModuleId = String(formData.get("targetModuleId") ?? "");
  if (targetModuleId) {
    await moveLessonToModule(admin.id, lessonId, targetModuleId);
  }
  revalidatePath(`/admin/courses/${courseId}`);
}

export async function setLessonPublishStateAction(
  lessonId: string,
  next: "PUBLISHED" | "DRAFT",
): Promise<{ ok: boolean; reason?: string; missing?: string[] }> {
  const admin = await requireRole("ADMIN");
  const result = await setLessonPublishState(admin.id, lessonId, next);
  revalidatePath(`/admin/lessons/${lessonId}`);
  return result;
}

export async function deleteCourseAction(courseId: string): Promise<void> {
  const admin = await requireRole("ADMIN");
  const result = await deleteCourse(admin.id, courseId);
  if (!result.ok) console.warn("course delete rejected:", result.reason ?? "");
  revalidatePath("/admin/courses");
  redirect("/admin/courses");
}

export async function duplicateCourseAction(courseId: string): Promise<void> {
  const admin = await requireRole("ADMIN");
  const result = await duplicateCourse(admin.id, courseId);
  if (result.ok && result.courseId) redirect(`/admin/courses/${result.courseId}`);
}

export async function deleteResourceAction(resourceId: string): Promise<void> {
  const admin = await requireRole("ADMIN");
  await deleteResourceFile(admin.id, resourceId);
  revalidatePath("/admin/lessons");
}

/** Form-driven resource delete for the client uploader list. */
export async function deleteResourceFormAction(
  resourceId: string,
  formData: FormData,
): Promise<void> {
  void formData;
  await deleteResourceAction(resourceId);
}

/* --------------------------- Bulk operations (P8) -------------------------- */

/**
 * Bulk video operations (Phase 8): mode=publish|unpublish|delete.
 * Every id is re-verified through the same state machine / deletion path
 * used for single-row actions.
 */
export async function bulkVideoStateAction(formData: FormData): Promise<void> {
  const admin = await requireRole("ADMIN");
  const mode = String(formData.get("mode") ?? "");
  const ids = formData
    .getAll("videoIds")
    .map((v) => String(v))
    .filter(Boolean);
  if (!ids.length) return;

  if (mode === "publish" || mode === "unpublish") {
    const next = mode === "publish" ? "READY" : "ARCHIVED";
    for (const id of ids) {
      await setVideoPublishState(admin.id, id, next);
    }
  } else if (mode === "delete") {
    for (const id of ids) {
      await deleteVideo(admin.id, id);
    }
  }
  revalidatePath("/admin/media");
}

/* --------------------------- User management (P9) -------------------------- */

export async function revokeSessionsAction(userId: string): Promise<void> {
  const admin = await requireRole("ADMIN");
  const { revokeUserSessions } = await import("@/lib/server/admin-users");
  const result = await revokeUserSessions(admin.id, userId);
  if (!result.ok) console.warn("session revocation rejected:", result.reason ?? "");
  revalidatePath(`/admin/users/${userId}`);
}

export async function deleteUserAction(userId: string): Promise<void> {
  const admin = await requireRole("ADMIN");
  const { deleteAndAnonymizeUser } = await import("@/lib/server/admin-users");
  const result = await deleteAndAnonymizeUser(admin.id, userId);
  if (!result.ok) console.warn("user deletion rejected:", result.reason ?? "");
  revalidatePath("/admin/users");
}

export async function changeUserRoleAction(
  userId: string,
  nextRole: string,
): Promise<void> {
  const admin = await requireRole("ADMIN");
  const { changeUserRole } = await import("@/lib/server/admin-users");
  const result = await changeUserRole(admin.id, userId, nextRole);
  if (!result.ok) console.warn("role change rejected:", result.reason ?? "");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}

/* --------------------------- Business operations -------------------------- */

export async function approveRefundAction(refundId: string): Promise<void> {
  const admin = await requireRole("ADMIN");
  const result = await approveRefund(admin.id, refundId);
  if (!result.ok) console.warn("refund approval rejected:", result.reason ?? "unknown");
  revalidatePath("/admin/refunds");
  revalidatePath("/admin/payments");
}

export async function rejectRefundAction(refundId: string, reason: string) {
  const admin = await requireRole("ADMIN");
  await rejectRefund(admin.id, refundId, reason.slice(0, 300));
  revalidatePath("/admin/refunds");
}

export async function confirmManualPaymentAction(paymentId: string): Promise<void> {
  const admin = await requireRole("ADMIN");
  await confirmManualPayment(admin.id, paymentId);
  revalidatePath("/admin/payments");
}
