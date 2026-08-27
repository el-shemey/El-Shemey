import type { NextConfig } from "next";

/**
 * Production security headers (Phase 10).
 *
 * CSP notes:
 *  - script-src keeps 'unsafe-inline'/'unsafe-eval': the Next.js App Router
 *    runtime requires inline bootstrap scripts, and 'unsafe-eval' is needed
 *    in development. Nonce-based strict CSP is a documented future hardening
 *    step (requires middleware-generated nonces on every document).
 *  - frame-src allows ONLY the Paymob hosted checkout iframes (sandbox +
 *    production hosts). Everything else is blocked from embedding us AND
 *    from being embedded by us.
 *  - media-src includes blob: (Video.js) and https: (future object-storage
 *    playback). img-src allows remote course covers/resources.
 *
 * HSTS is sent unconditionally: browsers ignore it over plain HTTP, so it is
 * safe locally and mandatory once HTTPS/TLS is live.
 */

const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  [
    "script-src",
    "'self'",
    "'unsafe-inline'",
    process.env.NODE_ENV === "production" ? "" : "'unsafe-eval'",
  ]
    .filter(Boolean)
    .join(" "),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' blob: https:",
  "frame-src https://accept.paymob.com https://acceptstaging.paymob.com",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "Content-Security-Policy", value: cspDirectives },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["nodemailer", "@node-rs/argon2"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
