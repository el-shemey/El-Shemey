import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import "@/app/globals.css";
import { fontVars } from "@/lib/fonts";
import { getUser } from "@/lib/server/auth/session";
import { getDict } from "@/lib/i18n/dictionaries";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { ShimmyGlyph } from "@/components/character/shimmy";
import { SignOutButton } from "@/features/auth/forms";
import { setAdminLocaleAction } from "@/features/admin/locale";

export const metadata: Metadata = {
  title: "Owner Control Center",
  robots: { index: false },
};

const NAV: Array<{ group: string; items: Array<{ href: string; label: string }> }> = [
  {
    group: "CONTENT",
    items: [
      { href: "/admin/courses", label: "Courses" },
      { href: "/admin/media", label: "Media" },
      { href: "/admin/search", label: "Search" },
      { href: "/admin/content-health", label: "Content health" },
    ],
  },
  {
    group: "BUSINESS",
    items: [
      { href: "/admin/payments", label: "Payments" },
      { href: "/admin/analytics", label: "Analytics" },
      { href: "/admin/subscriptions", label: "Subscriptions" },
      { href: "/admin/refunds", label: "Refunds" },
    ],
  },
  {
    group: "PEOPLE",
    items: [{ href: "/admin/users", label: "Users" }],
  },
  {
    group: "INSIGHTS · SYSTEM",
    items: [
      { href: "/admin", label: "Overview" },
      { href: "/admin/system", label: "System" },
      { href: "/admin/settings", label: "Settings" },
      { href: "/admin/audit", label: "Activity log" },
    ],
  },
];

/**
 * OWNER CONTROL CENTER.
 * Root html wrapper for the /admin segment + server-side role gate on every
 * render. Locale (EN/AR incl. RTL) comes from a cookie — one i18n system,
 * no duplication. Non-admins never reach admin content.
 */
export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/en/login?callbackUrl=/admin");
  if (user.role !== "ADMIN") redirect("/en");

  const cookieStore = await cookies();
  const raw = cookieStore.get("admin_locale")?.value ?? "en";
  const locale: Locale = isLocale(raw) ? raw : "en";
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
      className={`${fontVars} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-base font-sans text-fg">
        <div className="flex min-h-full flex-1">
          {/* Sidebar */}
          <aside className="hidden w-56 shrink-0 flex-col border-e border-edge bg-surface md:flex">
            <Link
              href="/en"
              className="flex items-center gap-2 border-b border-edge px-5 py-4"
            >
              <ShimmyGlyph />
              <span className="font-bold tracking-tight">
                EL-SHEMEY
                <span aria-hidden className="text-violet">
                  .
                </span>
              </span>
            </Link>
            <nav aria-label="Admin" className="flex-1 overflow-y-auto px-3 py-4">
              {NAV.map((group) => (
                <div key={group.group} className="mb-5">
                  <p className="px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                    {group.group}
                  </p>
                  <ul className="space-y-1">
                    {group.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className="block rounded-sm px-3 py-2 text-sm text-soft transition-colors hover:bg-hover hover:text-fg"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
            <div className="border-t border-edge p-4">
              <form action={setAdminLocaleAction}>
                <button
                  type="submit"
                  className="mb-3 w-full rounded-sm border border-edge-strong px-3 py-1.5 font-mono text-[11px] font-semibold text-soft hover:border-indigo hover:text-fg"
                >
                  {locale === "ar" ? "English" : "العربية"}
                </button>
              </form>
              <p dir="ltr" className="truncate font-mono text-[11px] text-faint">
                {user.email}
              </p>
              <div className="mt-2">
                <SignOutButton locale="en" dict={getDict("en")} />
              </div>
            </div>
          </aside>

          {/* Main */}
          <div className="min-w-0 flex-1">
            {/* Mobile nav */}
            <div className="border-b border-edge bg-surface px-4 py-3 md:hidden">
              <nav
                aria-label="Admin mobile"
                className="flex gap-3 overflow-x-auto text-sm"
              >
                {NAV.flatMap((g) => g.items).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="whitespace-nowrap rounded-sm border border-edge px-3 py-1.5 text-soft"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
            <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
