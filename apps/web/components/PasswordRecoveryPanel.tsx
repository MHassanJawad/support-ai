"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, CheckCircle2, KeyRound, Loader2, Mail, ShieldCheck, Users } from "lucide-react";
import { supabase, supabaseConfigError } from "../lib/supabase";

type AuthRole = "business" | "customer";
type RecoveryMode = "request" | "reset";
type Feedback = { tone: "error" | "success"; text: string } | null;

export function PasswordRecoveryPanel({ mode, role }: { mode: RecoveryMode; role: AuthRole }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [sentEmail, setSentEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingLink, setIsCheckingLink] = useState(mode === "reset");
  const [canResetPassword, setCanResetPassword] = useState(false);

  const isBusiness = role === "business";
  const loginHref = isBusiness ? "/business/login" : "/customer/login";
  const forgotHref = isBusiness ? "/business/forgot-password" : "/customer/forgot-password";

  const copy = useMemo(
    () => ({
      accountLabel: isBusiness ? "business owner" : "customer",
      icon: isBusiness ? <Building2 className="h-4 w-4" /> : <Users className="h-4 w-4" />
    }),
    [isBusiness]
  );

  useEffect(() => {
    if (supabaseConfigError) {
      setFeedback({ tone: "error", text: supabaseConfigError });
    }
  }, []);

  useEffect(() => {
    if (mode !== "reset" || supabaseConfigError) {
      return;
    }

    let isMounted = true;

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) {
        return;
      }

      if (event === "PASSWORD_RECOVERY" || session) {
        setCanResetPassword(true);
        setIsCheckingLink(false);
      }
    });

    supabase.auth
      .getSession()
      .then(({ data: sessionData, error }) => {
        if (!isMounted) {
          return;
        }

        if (error) {
          setFeedback({ tone: "error", text: error.message });
          setIsCheckingLink(false);
          return;
        }

        setCanResetPassword(Boolean(sessionData.session));
        setIsCheckingLink(false);
      })
      .catch(() => {
        if (isMounted) {
          setFeedback({ tone: "error", text: "Could not validate this recovery link." });
          setIsCheckingLink(false);
        }
      });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [mode]);

  async function requestReset() {
    if (isSubmitting) {
      return;
    }

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setFeedback({ tone: "error", text: "Enter the email address connected to your account." });
      return;
    }

    if (supabaseConfigError) {
      setFeedback({ tone: "error", text: supabaseConfigError });
      return;
    }

    setFeedback(null);
    setIsSubmitting(true);

    try {
      const result = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/${role}/reset-password`
      });

      if (result.error) {
        setFeedback({ tone: "error", text: result.error.message });
        return;
      }

      setSentEmail(normalizedEmail);
    } catch {
      setFeedback({ tone: "error", text: "Unable to request a password reset. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updatePassword() {
    if (isSubmitting) {
      return;
    }

    if (password.length < 8) {
      setFeedback({ tone: "error", text: "Password must be at least 8 characters." });
      return;
    }

    if (password !== confirmPassword) {
      setFeedback({ tone: "error", text: "Passwords do not match." });
      return;
    }

    setFeedback(null);
    setIsSubmitting(true);

    try {
      const result = await supabase.auth.updateUser({ password });

      if (result.error) {
        setFeedback({ tone: "error", text: result.error.message });
        return;
      }

      setPassword("");
      setConfirmPassword("");
      await supabase.auth.signOut();
      setFeedback({ tone: "success", text: "Password updated successfully. Redirecting you to login..." });
      window.setTimeout(() => router.push(loginHref), 1200);
    } catch {
      setFeedback({ tone: "error", text: "Could not update your password. Request a new recovery link and try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-mist px-5 py-8 text-ink">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-6">
          <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted hover:text-ink" href={loginHref}>
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </Link>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">Account recovery</p>
            <h1 className="mt-3 max-w-xl font-display text-4xl font-semibold leading-tight sm:text-5xl">
              {mode === "request" ? "Recover access to your account." : "Choose a new password."}
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-muted">
              {mode === "request"
                ? "We will send a secure, time-limited recovery link to the email connected to your account."
                : "Use a strong password you have not used for this account before."}
            </p>
          </div>
          <div className="grid gap-3 text-sm text-muted sm:grid-cols-2 lg:grid-cols-1">
            <TrustItem icon={<ShieldCheck className="h-4 w-4" />} label="Secure account recovery" />
            <TrustItem icon={copy.icon} label={`${copy.accountLabel} account`} />
          </div>
        </section>

        <section className="surface mx-auto w-full max-w-xl rounded-[28px] p-5 sm:p-7">
          {mode === "request" ? (
            sentEmail ? (
              <EmailSent email={sentEmail} loginHref={loginHref} onTryAgain={() => setSentEmail("")} />
            ) : (
              <>
                <PanelHeading
                  body="Enter the email used when you registered."
                  icon={<Mail className="h-5 w-5" />}
                  title="Forgot your password?"
                />
                {feedback ? <FeedbackAlert feedback={feedback} /> : null}
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void requestReset();
                  }}
                >
                  <Field label="Account email" onChange={setEmail} placeholder="you@example.com" type="email" value={email} />
                  <button
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 font-semibold text-white shadow-soft disabled:opacity-60"
                    disabled={isSubmitting}
                    type="submit"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    {isSubmitting ? "Sending recovery link..." : "Send recovery link"}
                  </button>
                </form>
              </>
            )
          ) : isCheckingLink ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              <p className="mt-4 font-semibold">Validating recovery link...</p>
            </div>
          ) : canResetPassword ? (
            <>
              <PanelHeading
                body="Your recovery link is valid. Enter and confirm your new password."
                icon={<KeyRound className="h-5 w-5" />}
                title="Reset password"
              />
              {feedback ? <FeedbackAlert feedback={feedback} /> : null}
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void updatePassword();
                }}
              >
                <Field label="New password" onChange={setPassword} placeholder="At least 8 characters" type="password" value={password} />
                <Field
                  label="Confirm new password"
                  onChange={setConfirmPassword}
                  placeholder="Re-enter your new password"
                  type="password"
                  value={confirmPassword}
                />
                <button
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 font-semibold text-white shadow-soft disabled:opacity-60"
                  disabled={isSubmitting || feedback?.tone === "success"}
                  type="submit"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  {isSubmitting ? "Updating password..." : "Update password"}
                </button>
              </form>
            </>
          ) : (
            <div className="py-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-coral/10 text-coral">
                <KeyRound className="h-8 w-8" />
              </div>
              <h2 className="mt-5 font-display text-2xl font-semibold">Recovery link unavailable</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
                This link may have expired or already been used. Request a new link to continue.
              </p>
              {feedback ? <div className="mt-4"><FeedbackAlert feedback={feedback} /></div> : null}
              <Link
                className="mt-6 inline-flex min-h-11 items-center justify-center rounded-2xl bg-accent px-5 font-semibold text-white"
                href={forgotHref}
              >
                Request a new link
              </Link>
            </div>
          )}

          {!sentEmail && mode === "request" ? (
            <div className="mt-5 border-t border-line pt-5 text-center text-sm">
              <Link className="font-semibold text-accent hover:text-primary" href={loginHref}>
                Remembered your password? Return to login.
              </Link>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function EmailSent({
  email,
  loginHref,
  onTryAgain
}: {
  email: string;
  loginHref: "/business/login" | "/customer/login";
  onTryAgain: () => void;
}) {
  return (
    <div aria-live="polite" className="py-2 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <p className="mt-5 text-sm font-semibold uppercase tracking-wider text-accent">Request received</p>
      <h2 className="mt-2 font-display text-3xl font-semibold">Check your inbox</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
        If an account exists for <strong className="break-all text-ink">{email}</strong>, Supabase will send a password
        recovery link. Check spam and junk folders too.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-accent px-4 font-semibold text-white" href={loginHref}>
          Return to login
        </Link>
        <button className="min-h-11 rounded-2xl border border-line bg-panel px-4 font-semibold" onClick={onTryAgain} type="button">
          Try another email
        </button>
      </div>
    </div>
  );
}

function PanelHeading({ body, icon, title }: { body: string; icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-6">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-panel">{icon}</div>
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
    </div>
  );
}

function Field({
  label,
  onChange,
  placeholder,
  type,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  type: "email" | "password";
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input
        autoComplete={type === "email" ? "email" : "new-password"}
        className="min-h-11 rounded-2xl border border-line bg-panel px-3 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/10"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required
        type={type}
        value={value}
      />
    </label>
  );
}

function FeedbackAlert({ feedback }: { feedback: Exclude<Feedback, null> }) {
  const isError = feedback.tone === "error";

  return (
    <div
      className={`mb-4 rounded-2xl border px-4 py-3 text-left text-sm leading-6 ${
        isError ? "border-coral/35 bg-coral/10 text-coral" : "border-accent/30 bg-accent/10 text-accent"
      }`}
      role={isError ? "alert" : "status"}
    >
      {feedback.text}
    </div>
  );
}

function TrustItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex min-h-11 items-center gap-2 rounded-2xl border border-line bg-panel px-3 py-2 shadow-sm">
      <span className="text-accent">{icon}</span>
      <span>{label}</span>
    </div>
  );
}
