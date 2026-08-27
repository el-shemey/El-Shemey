"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/server/auth/session";

/**
 * Admin UI locale toggle (EN/AR). Cookie-based so the whole /admin segment
 * flips direction server-rendered — RTL is first-class, not patched in.
 * Uses the existing single i18n system (lib/i18n).
 */
export async function setAdminLocaleAction(): Promise<void> {
  await requireRole("ADMIN");
  const cookieStore = await cookies();
  const current = cookieStore.get("admin_locale")?.value ?? "en";
  const next = current === "ar" ? "en" : "ar";
  cookieStore.set("admin_locale", next, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/admin", "layout");
}
