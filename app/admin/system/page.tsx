import Link from "next/link";
import { isFakePayEnabled } from "@/lib/server/payments/fakepay";
import { getPaymobConfig } from "@/lib/server/payments/paymob";
import {
  configureExternalErrorTracking,
  isExternalErrorTrackingActive,
} from "@/lib/server/errors";
import { db } from "@/lib/server/db";
import { TechLabel } from "@/components/ui/text";

/**
 * System operations page (Phase 9).
 * CONFIGURED / NOT CONFIGURED / DEGRADED / UNAVAILABLE — never values.
 */

function Status({
  name,
  state,
  note,
}: {
  name: string;
  state: "CONFIGURED" | "NOT CONFIGURED" | "DEGRADED" | "UNAVAILABLE" | "READY";
  note?: string;
}) {
  const tone =
    state === "CONFIGURED" || state === "READY"
      ? "text-success"
      : state === "DEGRADED"
        ? "text-warning"
        : state === "UNAVAILABLE"
          ? "text-error"
          : "text-faint";
  return (
    <li className="flex items-center justify-between gap-4 border-b border-edge py-3">
      <span className="text-sm font-medium">{name}</span>
      <span className={`font-mono text-[11px] uppercase ${tone}`}>
        {state}
        {note ? ` · ${note}` : ""}
      </span>
    </li>
  );
}

export default async function AdminSystemPage() {
  configureExternalErrorTracking();

  // DB health via cheap bounded probe (TTL-cached in the ready route; this
  // page does one direct check for freshness).
  let dbState: "READY" | "UNAVAILABLE" = "UNAVAILABLE";
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise<never>((_, r) => setTimeout(() => r(new Error("t")), 2500)),
    ]);
    dbState = "READY";
  } catch {}

  const paymob = getPaymobConfig();
  const storageDriver = process.env.VIDEO_STORAGE_DRIVER ?? "local-fs";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">System</h1>
      <p className="mt-1 text-sm text-faint">
        Operational status only — secret values never appear in this panel.{" "}
        <Link
          href="/admin/settings"
          className="underline decoration-electric underline-offset-4 hover:text-electric"
        >
          Configuration view →
        </Link>
      </p>

      <section aria-labelledby="sys-health" className="mt-8">
        <TechLabel>Health</TechLabel>
        <ul className="mt-3">
          <Status name="Application" state="READY" />
          <Status name="Database (ready probe)" state={dbState} />
          <li className="flex items-center justify-between gap-4 border-b border-edge py-3 text-sm">
            <span>Probes</span>
            <span dir="ltr" className="font-mono text-[11px]">
              <a
                className="hover:text-electric"
                href="/api/health/live"
                target="_blank"
              >
                /api/health/live
              </a>
              {" · "}
              <a
                className="hover:text-electric"
                href="/api/health/ready"
                target="_blank"
              >
                /api/health/ready
              </a>
            </span>
          </li>
        </ul>
      </section>

      <section aria-labelledby="sys-env" className="mt-8">
        <TechLabel>Environment</TechLabel>
        <ul className="mt-3">
          <Status
            name="Runtime"
            state="CONFIGURED"
            note={`NODE_ENV=${process.env.NODE_ENV ?? "unknown"}`}
          />
          <Status
            name="Error tracking"
            state={isExternalErrorTrackingActive() ? "CONFIGURED" : "NOT CONFIGURED"}
            note="no-op adapter until a provider DSN is set"
          />
        </ul>
      </section>

      <section aria-labelledby="sys-storage" className="mt-8">
        <TechLabel>Storage &amp; video</TechLabel>
        <ul className="mt-3">
          <Status
            name={`Video storage (${storageDriver})`}
            state={storageDriver === "local-fs" ? "DEGRADED" : "CONFIGURED"}
            note={
              storageDriver === "local-fs"
                ? "development filesystem — production needs object storage"
                : undefined
            }
          />
          <Status
            name="Transcoding (HLS)"
            state="NOT CONFIGURED"
            note="optional seam — MP4 pipeline active"
          />
        </ul>
      </section>

      <section aria-labelledby="sys-mail" className="mt-8">
        <TechLabel>Email delivery</TechLabel>
        <ul className="mt-3">
          <Status
            name="Transactional provider"
            state={process.env.MAIL_FROM ? "CONFIGURED" : "NOT CONFIGURED"}
            note={process.env.MAIL_FROM ? undefined : "dev outbox adapter active"}
          />
        </ul>
      </section>

      <section aria-labelledby="sys-pay" className="mt-8">
        <TechLabel>Payments</TechLabel>
        <ul className="mt-3">
          <Status
            name="Paymob"
            state={paymob ? "CONFIGURED" : "NOT CONFIGURED"}
            note={
              paymob
                ? `${paymob.mode} mode${paymob.mode === "production" ? "" : " — sandbox transaction verification pending"}`
                : "adapter refuses to operate without credentials"
            }
          />
          {isFakePayEnabled() && (
            <Status
              name="fakepay (dev)"
              state="CONFIGURED"
              note="development-only provider active"
            />
          )}
          <Status
            name="Manual fallback"
            state="CONFIGURED"
            note="admin-approved, audited"
          />
        </ul>
      </section>

      <section aria-labelledby="sys-analytics" className="mt-8">
        <TechLabel>Analytics</TechLabel>
        <ul className="mt-3">
          <Status
            name="Product events"
            state="CONFIGURED"
            note="AnalyticsEvent table — external provider seam deferred"
          />
        </ul>
      </section>

      <p className="mt-10 font-mono text-[11px] leading-relaxed text-faint">
        Operations runbook: docs/OPERATIONS.md
      </p>
    </div>
  );
}
