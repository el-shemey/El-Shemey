import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n/config";

/**
 * Edge middleware — TWO independent responsibilities:
 *
 * 1. Locale routing (Phase 2): "/" and un-prefixed paths redirect to
 *    /{locale}/… based on Accept-Language. /design stays non-localized.
 *
 * 2. Coarse auth gate (Phase 4, adjusted Phase 6): /[lang]/learn no longer
 *    blocks anonymous visitors at the edge — published FREE lessons are a
 *    PUBLIC preview per the product access model. Every /learn page and API
 *    still enforces authentication server-side (getUser()/requireRole() +
 *    entitlement checks), so this was never the security layer. PRO content,
 *    progress mutations and signed video URLs remain unreachable unauthenticated.
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/design") ||
    pathname.startsWith("/admin") // non-localized owner surface
  ) {
    return;
  }

  const hasLocale = LOCALES.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );
  if (!hasLocale) {
    const accept = request.headers.get("accept-language")?.toLowerCase() ?? "";
    const locale = accept.split(",")[0]?.trim().startsWith("ar")
      ? "ar"
      : DEFAULT_LOCALE;
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  // NOTE: /learn pages enforce authentication server-side (Phase 6 preview:
  // anonymous visitors may render published FREE lessons; everything else
  // redirects or denies inside the Server Components / route handlers).

  return;
}

export const config = {
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
