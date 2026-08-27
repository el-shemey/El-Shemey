import { TechLabel } from "@/components/ui/text";

function Status({
  name,
  configured,
  note,
}: {
  name: string;
  configured: boolean;
  note?: string;
}) {
  return (
    <li className="flex items-center justify-between gap-4 border-b border-edge py-3">
      <span className="text-sm font-medium">{name}</span>
      <span
        className={`font-mono text-[11px] uppercase ${configured ? "text-success" : "text-warning"}`}
      >
        {configured ? "CONFIGURED" : "NOT CONFIGURED"}
        {note ? ` · ${note}` : ""}
      </span>
    </li>
  );
}

/** Configuration STATUS only — secret values are never rendered. */
export default function AdminSettingsPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-faint">
        Configuration status only — secret values never appear in this panel.
      </p>

      <section aria-labelledby="payments-s" className="mt-10">
        <TechLabel>Payments</TechLabel>
        <ul className="mt-3">
          <Status
            name={`Paymob (${process.env.PAYMOB_MODE === "production" ? "PRODUCTION" : "sandbox"} mode)`}
            configured={Boolean(
              process.env.PAYMOB_API_KEY &&
              process.env.PAYMOB_INTEGRATION_ID &&
              process.env.PAYMOB_HMAC_SECRET &&
              process.env.PAYMOB_IFRAME_ID,
            )}
            note="sandbox transaction verification pending (7B gate)"
          />
          <Status
            name="Vodafone Cash"
            configured={false}
            note="routes via Paymob once verified"
          />
          <Status
            name="Fawry"
            configured={false}
            note="routes via Paymob once verified"
          />
          <Status
            name="InstaPay"
            configured={false}
            note="compliance review pending (D21)"
          />
          <Status name="Manual fallback" configured note="admin-approved, audited" />
        </ul>
      </section>

      <section aria-labelledby="video-s" className="mt-10">
        <TechLabel>Video</TechLabel>
        <ul className="mt-3">
          <Status
            name={`Self-hosted storage (${process.env.VIDEO_STORAGE_DRIVER ?? "local-fs"})`}
            configured
            note={
              process.env.VIDEO_STORAGE_DRIVER === "s3"
                ? "object storage"
                : "development filesystem"
            }
          />
        </ul>
      </section>

      <section aria-labelledby="email-s" className="mt-10">
        <TechLabel>Email</TechLabel>
        <ul className="mt-3">
          <Status
            name="Transactional provider"
            configured={Boolean(process.env.MAIL_FROM)}
            note="dev outbox adapter active"
          />
        </ul>
      </section>

      <section aria-labelledby="security-s" className="mt-10">
        <TechLabel>Security</TechLabel>
        <ul className="mt-3">
          <Status name="AUTH_SECRET" configured={Boolean(process.env.AUTH_SECRET)} />
          <Status name="Rate limiter" configured note="in-memory dev implementation" />
        </ul>
      </section>
    </div>
  );
}
