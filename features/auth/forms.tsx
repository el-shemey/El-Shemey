"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shimmy } from "@/components/character/shimmy";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { ActionState } from "@/features/auth/actions";
import {
  confirmPasswordResetAction,
  loginAction,
  logoutAction,
  registerAction,
  requestResetCodeAction,
  resendOtpAction,
  verifyIdentityAction,
} from "@/features/auth/actions";

const field =
  "w-full rounded-sm border border-edge bg-base/70 px-3 py-2.5 text-sm text-fg placeholder:text-faint focus:border-indigo";
const label = "block text-sm font-medium";
const ctaClass =
  "inline-block rounded-sm bg-indigo px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-strong";

function Err({ state, dict }: { state: ActionState; dict: Dictionary }) {
  if (!state.code) return null;
  if (state.code === "DELIVERY_NOT_CONFIGURED") {
    const ch = state.channel === "SMS" ? "SMS" : "Email";
    return (
      <p
        role="alert"
        className="rounded-sm border-s-2 border-warning bg-raised px-3 py-2 text-xs text-warning"
      >
        {ch} delivery is not configured.
      </p>
    );
  }
  const key = `err_${state.code}` as keyof Dictionary["auth"];
  return (
    <p
      role="alert"
      className="rounded-sm border-s-2 border-error bg-raised px-3 py-2 text-xs text-error"
    >
      {dict.auth[key] ?? dict.auth.err_UNKNOWN}
    </p>
  );
}

/* ------------------------------- OTP input ------------------------------- */

export function OtpInput({
  name = "code",
  disabled,
}: {
  name?: string;
  disabled?: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const applyValue = (index: number, value: string) => {
    const clean = value.replace(/\D/g, "");
    setDigits((prev) => {
      const next = [...prev];
      if (clean.length > 1) {
        clean
          .slice(0, 6 - index)
          .split("")
          .forEach((ch, i) => (next[index + i] = ch));
      } else {
        next[index] = clean;
      }
      return next;
    });
    const advance = Math.max(1, Math.min(clean.length || 1, 6 - index));
    refs.current[Math.min(5, index + advance - 1)]?.focus();
  };

  return (
    <div
      role="group"
      aria-label="6-digit verification code"
      dir="ltr"
      className="flex justify-center gap-2"
    >
      <input type="hidden" name={name} value={digits.join("")} />
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={6}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          value={d}
          onChange={(e) => applyValue(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !d && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
            if (!pasted) return;
            setDigits((prev) => {
              const next = [...prev];
              pasted
                .slice(0, 6)
                .split("")
                .forEach((ch, idx) => (next[idx] = ch));
              return next;
            });
            refs.current[Math.min(5, pasted.length)]?.focus();
          }}
          className="size-12 rounded-md border border-edge bg-base text-center font-mono text-xl font-semibold text-fg focus:border-indigo disabled:opacity-50"
        />
      ))}
    </div>
  );
}

/* ------------------------------- Resend block ---------------------------- */

function ResendOtp({
  identifier,
  onResent,
  dict,
}: {
  identifier: string;
  onResent?: () => void;
  dict: Dictionary;
}) {
  const [countdown, setCountdown] = useState(60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (countdown <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [countdown]);

  const resend = async () => {
    try {
      await resendOtpAction(identifier);
    } finally {
      setCountdown(60);
      onResent?.();
    }
  };

  return (
    <button
      type="button"
      disabled={countdown > 0}
      onClick={() => void resend()}
      className="text-xs font-semibold underline decoration-electric decoration-2 underline-offset-4 disabled:no-underline disabled:opacity-50"
    >
      {countdown > 0 ? `${dict.auth.resendCta} (${countdown}s)` : dict.auth.resendCta}
    </button>
  );
}

/* --------------------------- Channel toggle ------------------------------ */

type ChannelType = "EMAIL" | "PHONE";

function ChannelToggle({
  value,
  onChange,
  dict,
}: {
  value: ChannelType;
  onChange: (c: ChannelType) => void;
  dict: Dictionary;
}) {
  const options: Array<{ id: ChannelType; label: string }> = [
    { id: "EMAIL", label: dict.auth.channelEmail },
    { id: "PHONE", label: dict.auth.channelPhone },
  ];
  return (
    <div
      role="radiogroup"
      aria-label={dict.auth.identifierLabel}
      className="mb-4 flex overflow-hidden rounded-sm border border-edge-strong"
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="radio"
          aria-checked={value === opt.id}
          onClick={() => onChange(opt.id)}
          className={`flex-1 px-3 py-2 text-sm transition-colors ${
            value === opt.id
              ? "bg-indigo text-white"
              : "bg-transparent text-soft hover:bg-hover hover:text-fg"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------- Delivery not configured ----------------------- */

function DeliveryNotice({ channel }: { channel?: "EMAIL" | "SMS" }) {
  const label = channel === "SMS" ? "SMS" : "Email";
  return (
    <p
      role="status"
      className="rounded-sm border-s-2 border-warning bg-raised px-3 py-2 text-xs text-warning"
    >
      {label} delivery is not configured.{" "}
      <span lang="ar" dir="rtl" className="font-arabic">
        لم يتم تهيئة الإرسال بعد.
      </span>
    </p>
  );
}

/* -------------------------------- Login ---------------------------------- */

export function LoginForm({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const router = useRouter();
  const isAr = locale === "ar";

  const [loginState, loginDispatch, loginPending] = useActionState(
    loginAction,
    {} as ActionState,
  );

  const [otpStep, setOtpStep] = useState(false);
  const [identifier, setIdentifier] = useState("");

  const [verifyState, verifyDispatch, verifyPending] = useActionState(
    async (_prev: ActionState, formData: FormData) => {
      const fd = new FormData();
      fd.set("identifier", identifier);
      fd.set("code", String(formData.get("code") ?? "").replace(/\D/g, ""));
      return verifyIdentityAction(_prev, fd);
    },
    {} as ActionState,
  );

  // Post-action navigation
  useEffect(() => {
    if (loginState.ok) {
      router.push(`/${locale}/learn`);
      router.refresh();
    }
  }, [loginState.ok, locale, router]);

  useEffect(() => {
    if (verifyState.ok) {
      router.push(`/${locale}/learn`);
      router.refresh();
    }
  }, [verifyState.ok, locale, router]);

  if (otpStep) {
    return (
      <form action={verifyDispatch} className="space-y-6" aria-labelledby="auth-title">
        {verifyState.code && <Err state={verifyState} dict={dict} />}
        <input type="hidden" name="identifier" value={identifier} />
        <OtpInput />
        <button
          type="submit"
          disabled={verifyPending}
          className="w-full rounded-sm bg-indigo px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-strong disabled:opacity-50"
        >
          {verifyPending ? "…" : dict.auth.verifyDoneTitle}
        </button>
        <div className="text-center">
          <ResendOtp identifier={identifier} dict={dict} />
        </div>
      </form>
    );
  }

  return (
    <form action={loginDispatch} className="space-y-5" aria-labelledby="auth-title">
      {loginState.code && loginState.code !== "IDENTITY_NOT_VERIFIED" && (
        <Err state={loginState} dict={dict} />
      )}
      <div>
        <label htmlFor="identifier" className={label}>
          {dict.auth.identifierLabel}
        </label>
        <input
          id="identifier"
          name="identifier"
          autoComplete="username"
          required
          dir="ltr"
          className={`${field} mt-1.5`}
        />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="password" className={label}>
            {dict.auth.passwordLabel}
          </label>
          <Link
            href={`/${locale}/forgot-password`}
            className="text-xs text-faint hover:text-electric"
          >
            {dict.auth.forgotLink}
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={`${field} mt-1.5`}
        />
      </div>
      <button
        type="submit"
        disabled={loginPending}
        className="w-full rounded-sm bg-indigo px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-strong disabled:opacity-50"
      >
        {loginPending ? "…" : dict.auth.signInCta}
      </button>
      <p className={`text-center text-sm text-faint ${isAr ? "font-arabic" : ""}`}>
        {dict.auth.noAccount}{" "}
        <Link
          href={`/${locale}/register`}
          className="font-semibold text-electric hover:underline"
        >
          {dict.auth.createOne}
        </Link>
      </p>
    </form>
  );
}

/* ------------------------------- Register -------------------------------- */

export function RegisterForm({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const router = useRouter();
  const isAr = locale === "ar";

  const [channel, setChannel] = useState<ChannelType>("EMAIL");
  const [registerState, registerDispatch, registerPending] = useActionState(
    registerAction,
    {} as ActionState,
  );

  const [verifyState, verifyDispatch, verifyPending] = useActionState(
    async (_prev: ActionState, formData: FormData) => {
      const fd = new FormData();
      fd.set("identifier", registerState.identifier ?? "");
      fd.set("code", String(formData.get("code") ?? "").replace(/\D/g, ""));
      return verifyIdentityAction(_prev, fd);
    },
    {} as ActionState,
  );

  // Derived route state: no effects needed.
  const otpStep = Boolean(registerState.ok);
  const identifier = registerState.identifier ?? "";
  const verified = registerState.ok === true && verifyState.ok === true;

  if (verified) {
    return (
      <div role="status" className="space-y-5 text-center">
        <Shimmy mood="celebrate" size={96} className="mx-auto" />
        <p className="text-sm text-success">✓ {dict.auth.verifyDoneDesc}</p>
        <Link href={`/${locale}/learn`} className={ctaClass}>
          {dict.learn.continueCta}
        </Link>
      </div>
    );
  }

  if (otpStep) {
    return (
      <form action={verifyDispatch} className="space-y-6">
        {registerState.code === "DELIVERY_NOT_CONFIGURED" && (
          <DeliveryNotice channel={registerState.channel} />
        )}
        {verifyState.code && <Err state={verifyState} dict={dict} />}
        <input type="hidden" name="identifier" value={identifier} />
        <OtpInput />
        <button
          type="submit"
          disabled={verifyPending}
          className="w-full rounded-sm bg-indigo px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-strong disabled:opacity-50"
        >
          {verifyPending ? "…" : dict.auth.verifyDoneTitle}
        </button>
        <div className="text-center">
          <ResendOtp identifier={identifier} dict={dict} />
        </div>
      </form>
    );
  }

  /* ---------------------------- Registration step ------------------------- */
  return (
    <form action={registerDispatch} className="space-y-5">
      {registerState.code && <Err state={registerState} dict={dict} />}

      <ChannelToggle value={channel} onChange={setChannel} dict={dict} />

      <div>
        <label htmlFor="name" className={label}>
          {dict.auth.nameLabel}
        </label>
        <input
          id="name"
          name="name"
          maxLength={80}
          className={`${field} mt-1.5 ${isAr ? "text-right font-arabic" : ""}`}
        />
      </div>

      {channel === "EMAIL" ? (
        <div>
          <label htmlFor="reg-email" className={label}>
            {dict.auth.emailLabel}
          </label>
          <input
            id="reg-email"
            name="identifier"
            type="email"
            autoComplete="email"
            required
            dir="ltr"
            data-channel={channel}
            className={`${field} mt-1.5`}
          />
        </div>
      ) : (
        <div>
          <label htmlFor="reg-phone" className={label}>
            {dict.auth.phoneLabel}
          </label>
          <input
            id="reg-phone"
            name="identifier"
            type="tel"
            autoComplete="tel"
            required
            placeholder="+201000000000"
            dir="ltr"
            aria-describedby="phone-hint"
            className={`${field} mt-1.5`}
          />
          <p id="phone-hint" className="mt-1.5 text-xs text-faint">
            {dict.auth.phoneHint}
          </p>
        </div>
      )}

      <div>
        <label htmlFor="rpassword" className={label}>
          {dict.auth.passwordLabel}
        </label>
        <input
          id="rpassword"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          aria-describedby="pw-hint"
          className={`${field} mt-1.5`}
        />
        <p
          id="pw-hint"
          className={`mt-1.5 text-xs text-faint ${isAr ? "font-arabic" : ""}`}
        >
          {dict.auth.passwordHint}
        </p>
      </div>

      <button
        type="submit"
        disabled={registerPending}
        className="w-full rounded-sm bg-indigo px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-strong disabled:opacity-50"
      >
        {registerPending ? "…" : dict.auth.registerCta}
      </button>

      <p className={`text-center text-sm text-faint ${isAr ? "font-arabic" : ""}`}>
        {dict.auth.haveAccount}{" "}
        <Link
          href={`/${locale}/login`}
          className="font-semibold text-electric hover:underline"
        >
          {dict.auth.signInLink}
        </Link>
      </p>
    </form>
  );
}

/* ------------------------- Forgot password (OTP) ------------------------- */

export function ForgotPasswordFlow({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const [step, setStep] = useState<"request" | "reset" | "done">("request");
  const [identifier, setIdentifier] = useState("");

  const requestState = useActionState(
    async (_prev: ActionState, formData: FormData) => {
      const result = await requestResetCodeAction(_prev, formData);
      if (result.identifier) {
        setIdentifier(result.identifier);
        setStep("reset");
      }
      return result;
    },
    {} as ActionState,
  );

  const confirmState = useActionState(
    async (_prev: ActionState, formData: FormData) => {
      const result = await confirmPasswordResetAction(_prev, formData);
      if (result.ok) setStep("done");
      return result;
    },
    {} as ActionState,
  );

  if (step === "done") {
    return (
      <div role="status" className="space-y-4 text-center">
        <Shimmy mood="celebrate" size={90} className="mx-auto" />
        <p className="text-sm text-success">✓ {dict.auth.resetTitle}</p>
        <Link href={`/${locale}/login`} className={ctaClass}>
          {dict.auth.backToLogin}
        </Link>
      </div>
    );
  }

  const [reqResult] = requestState;
  const [confResult] = confirmState;

  return step === "request" ? (
    <>
      {reqResult.code === "DELIVERY_NOT_CONFIGURED" && (
        <DeliveryNotice channel={reqResult.channel} />
      )}
      <RequestForm locale={locale} dict={dict} />
    </>
  ) : (
    <>
      {confResult.code && <Err state={confResult} dict={dict} />}
      <ConfirmResetForm locale={locale} dict={dict} identifier={identifier} />
    </>
  );
}

function RequestForm({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  void locale;
  const [state, action, pending] = useActionState(requestResetCodeAction, {});
  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="fident" className={label}>
          {dict.auth.identifierLabel}
        </label>
        <input
          id="fident"
          name="identifier"
          required
          dir="ltr"
          className={`${field} mt-1.5`}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-sm bg-indigo px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-strong disabled:opacity-50"
      >
        {pending ? "…" : dict.auth.sendResetCta}
      </button>
    </form>
  );
}

function ConfirmResetForm({
  locale,
  dict,
  identifier,
}: {
  locale: Locale;
  dict: Dictionary;
  identifier: string;
}) {
  void locale;
  const [state, action, pending] = useActionState(confirmPasswordResetAction, {});
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="identifier" value={identifier} />
      <OtpInput name="code" />
      <div>
        <label htmlFor="npassword" className={label}>
          {dict.auth.passwordLabel}
        </label>
        <input
          id="npassword"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          aria-describedby="npw-hint"
          className={`${field} mt-1.5`}
        />
        <p id="npw-hint" className="mt-1.5 text-xs text-faint">
          {dict.auth.passwordHint}
        </p>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-sm bg-beginner px-5 py-3 text-sm font-semibold text-white shadow-glow hover:brightness-110 disabled:opacity-50"
      >
        {pending ? "…" : dict.auth.resetTitle}
      </button>
    </form>
  );
}

/* ------------------------------ Verify page ------------------------------ */

export function VerifyAnyIdentifierForm({
  locale,
  dict,
  initialIdentifier = "",
}: {
  locale: Locale;
  dict: Dictionary;
  initialIdentifier?: string;
}) {
  const isAr = locale === "ar";
  const [state, action, pending] = useActionState(
    verifyIdentityAction,
    {} as ActionState,
  );

  if (state.ok) {
    return (
      <div role="status" className="space-y-4 text-center">
        <Shimmy mood="celebrate" size={90} className="mx-auto" />
        <p className="text-sm text-success">✓ {dict.auth.verifyDoneDesc}</p>
        <Link href={`/${locale}/login`} className={ctaClass}>
          {dict.auth.signInLink}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      {state.code && <Err state={state} dict={dict} />}
      <div>
        <label htmlFor="videntifier" className={label}>
          {dict.auth.identifierLabel}
        </label>
        <input
          id="videntifier"
          name="identifier"
          required
          defaultValue={initialIdentifier}
          dir="ltr"
          className={`${field} mt-1.5`}
        />
      </div>
      <OtpInput />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-sm bg-indigo px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-strong disabled:opacity-50"
      >
        {pending ? "…" : dict.auth.verifyDoneTitle}
      </button>
    </form>
  );
}

/* ------------------------------ Sign out --------------------------------- */

export function SignOutButton({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const signOutWithLocale = logoutAction.bind(null, locale);
  return (
    <form action={signOutWithLocale}>
      <button
        type="submit"
        className="rounded-sm border-2 border-edge-strong px-4 py-2 text-sm font-semibold transition-colors hover:border-indigo"
      >
        {dict.auth.signOutCta}
      </button>
    </form>
  );
}
