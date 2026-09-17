// Role-aware single-purpose authentication panel for Supabase email/password sessions.
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, CheckCircle2, LogIn, Mail, RefreshCw, ShieldCheck, UserPlus, Users } from "lucide-react";
import { supabase, supabaseConfigError } from "../lib/supabase";

type AuthRole = "business" | "customer";
type AuthMode = "login" | "register";
type AuthHref = "/business/login" | "/business/register" | "/customer/login" | "/customer/register";
type Feedback = { tone: "error" | "success"; text: string } | null;

interface AuthPanelProps {
  mode: AuthMode;
  role: AuthRole;
}

export function AuthPanel({ mode, role }: AuthPanelProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessIndustry, setBusinessIndustry] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pendingEmail, setPendingEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const isBusiness = role === "business";
  const isRegister = mode === "register";
  const forgotPasswordHref = isBusiness ? "/business/forgot-password" : "/customer/forgot-password";

  const copy = useMemo(() => {
    if (isBusiness && isRegister) {
      return {
        eyebrow: "Business registration",
        heading: "Register your business workspace.",
        body: "Create an owner account and save the business details SupportAI needs to prepare your support dashboard.",
        cardTitle: "Business information",
        cardBody: "Use your official business details so your customer support portal is easy to recognize.",
        dashboardHref: "/business/dashboard" as const,
        switchHref: "/business/login" as AuthHref,
        switchLabel: "Already have a registered business? Log in to your workspace.",
        submitLabel: "Register business",
        submittingLabel: "Creating business account..."
      };
    }

    if (isBusiness) {
      return {
        eyebrow: "Business login",
        heading: "Welcome back to your workspace.",
        body: "Sign in to manage documents, FAQs, analytics, and the customer support portal for your business.",
        cardTitle: "Business login",
        cardBody: "Access your existing business owner account.",
        dashboardHref: "/business/dashboard" as const,
        switchHref: "/business/register" as AuthHref,
        switchLabel: "New to SupportAI? Register your business.",
        submitLabel: "Sign in",
        submittingLabel: "Signing in..."
      };
    }

    if (isRegister) {
      return {
        eyebrow: "Customer registration",
        heading: "Create your customer account.",
        body: "Browse business support centers and keep your customer support conversations in one place.",
        cardTitle: "Customer account",
        cardBody: "Create a customer profile for asking questions across available business portals.",
        dashboardHref: "/customer/dashboard" as const,
        switchHref: "/customer/login" as AuthHref,
        switchLabel: "Already have a customer account? Log in instead.",
        submitLabel: "Create customer account",
        submittingLabel: "Creating account..."
      };
    }

    return {
      eyebrow: "Customer login",
      heading: "Find support from businesses you use.",
      body: "Sign in to browse available support portals and continue previous conversations.",
      cardTitle: "Customer login",
      cardBody: "Access your customer dashboard.",
      dashboardHref: "/customer/dashboard" as const,
      switchHref: "/customer/register" as AuthHref,
      switchLabel: "New customer? Create an account.",
      submitLabel: "Sign in",
      submittingLabel: "Signing in..."
    };
  }, [isBusiness, isRegister]);

  useEffect(() => {
    if (supabaseConfigError) {
      setFeedback({ tone: "error", text: supabaseConfigError });
    }
  }, []);

  async function submitLogin() {
    if (isSubmitting) {
      return;
    }

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setFeedback({ tone: "error", text: "Enter your email and password." });
      return;
    }

    if (supabaseConfigError) {
      setFeedback({ tone: "error", text: supabaseConfigError });
      return;
    }

    setFeedback(null);
    setIsSubmitting(true);

    try {
      const result = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

      if (result.error) {
        setFeedback({ tone: "error", text: result.error.message });
        return;
      }

      router.push(copy.dashboardHref);
    } catch {
      setFeedback({ tone: "error", text: "Unable to reach auth service. Verify Supabase URL/key and network connectivity." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitRegistration() {
    if (isSubmitting) {
      return;
    }

    const normalizedEmail = email.trim();
    if (!fullName.trim()) {
      setFeedback({ tone: "error", text: isBusiness ? "Enter the business owner name." : "Enter your full name." });
      return;
    }

    if (isBusiness && !businessName.trim()) {
      setFeedback({ tone: "error", text: "Enter your business name." });
      return;
    }

    if (isBusiness && !businessIndustry.trim()) {
      setFeedback({ tone: "error", text: "Enter your business industry." });
      return;
    }

    if (isBusiness && businessAddress.trim().length < 5) {
      setFeedback({ tone: "error", text: "Enter your business address." });
      return;
    }

    if (!normalizedEmail) {
      setFeedback({ tone: "error", text: isBusiness ? "Enter a business email address." : "Enter an email address." });
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

    if (supabaseConfigError) {
      setFeedback({ tone: "error", text: supabaseConfigError });
      return;
    }

    setFeedback(null);
    setIsSubmitting(true);

    try {
      const result = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${copy.dashboardHref}`,
          data: {
            account_type: role,
            full_name: fullName.trim(),
            ...(isBusiness
              ? {
                  company_industry: businessIndustry.trim(),
                  company_address: businessAddress.trim(),
                  company_name: businessName.trim()
                }
              : {})
          }
        }
      });

      if (result.error) {
        const isExistingAccount =
          result.error.code === "user_already_exists" ||
          result.error.message.toLowerCase().includes("already registered");

        setFeedback({
          tone: "error",
          text: isExistingAccount
            ? "An account with this email already exists. Use the login link below instead of registering again."
            : result.error.message
        });
        return;
      }

      if (result.data.session) {
        router.push(copy.dashboardHref);
        return;
      }

      if (result.data.user?.identities?.length === 0) {
        setFeedback({ tone: "error", text: "This email may already be registered. Sign in or use Forgot password to recover your account." });
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setPendingEmail(normalizedEmail);
    } catch {
      setFeedback({ tone: "error", text: "Unable to reach auth service. Verify Supabase URL/key and network connectivity." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendConfirmation() {
    if (!pendingEmail || isResending) {
      return;
    }

    setIsResending(true);
    setFeedback(null);

    try {
      const result = await supabase.auth.resend({
        type: "signup",
        email: pendingEmail,
        options: { emailRedirectTo: `${window.location.origin}${copy.dashboardHref}` }
      });

      if (result.error) {
        setFeedback({ tone: "error", text: result.error.message });
        return;
      }

      setFeedback({ tone: "success", text: "Confirmation email sent again. It may take a minute to arrive." });
    } catch {
      setFeedback({ tone: "error", text: "Could not resend the confirmation email. Please try again shortly." });
    } finally {
      setIsResending(false);
    }
  }

  const icon = isRegister ? <UserPlus className="h-5 w-5" /> : <LogIn className="h-5 w-5" />;

  return (
    <main className="min-h-screen bg-mist px-5 py-8 text-ink">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-6">
          <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted hover:text-ink" href="/">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">{copy.eyebrow}</p>
            <h1 className="mt-3 max-w-xl font-display text-4xl font-semibold leading-tight sm:text-5xl">{copy.heading}</h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-muted">{copy.body}</p>
          </div>
          <div className="grid gap-3 text-sm text-muted sm:grid-cols-3 lg:grid-cols-1">
            <TrustItem icon={<ShieldCheck className="h-4 w-4" />} label="Secure account access" />
            <TrustItem
              icon={isBusiness ? <Building2 className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              label={isBusiness ? "Business owner access" : "Customer dashboard"}
            />
          </div>
        </section>

        <section className="surface mx-auto w-full max-w-xl rounded-[28px] p-5 sm:p-7">
          {pendingEmail ? (
            <RegistrationConfirmation
              feedback={feedback}
              isResending={isResending}
              loginHref={copy.switchHref}
              onChangeEmail={() => {
                setPendingEmail("");
                setFeedback(null);
              }}
              onResend={() => void resendConfirmation()}
              pendingEmail={pendingEmail}
            />
          ) : (
            <>
          <div className="mb-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-panel">{icon}</div>
            <h2 className="font-display text-2xl font-semibold">{copy.cardTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{copy.cardBody}</p>
          </div>

          {feedback ? <FeedbackAlert feedback={feedback} /> : null}

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (isRegister) {
                submitRegistration().catch(() =>
                  setFeedback({ tone: "error", text: "Something went wrong while creating your account." })
                );
              } else {
                submitLogin().catch(() =>
                  setFeedback({ tone: "error", text: "Something went wrong while signing in." })
                );
              }
            }}
          >
            {isRegister ? (
              <>
                {isBusiness ? (
                  <>
                    <Field
                      label="Business name"
                      onChange={(event) => setBusinessName(event.target.value)}
                      placeholder="Acme Retail"
                      value={businessName}
                    />
                    <Field
                      label="Industry"
                      onChange={(event) => setBusinessIndustry(event.target.value)}
                      placeholder="E-commerce, healthcare, education..."
                      value={businessIndustry}
                    />
                    <Field
                      label="Business address"
                      onChange={(event) => setBusinessAddress(event.target.value)}
                      placeholder="Street, city, state or province"
                      value={businessAddress}
                    />
                    <Field
                      label="Owner name"
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Hassan Jawad"
                      value={fullName}
                    />
                  </>
                ) : (
                  <Field
                    label="Full name"
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Hassan Jawad"
                    value={fullName}
                  />
                )}
              </>
            ) : null}

            <Field
              label={isBusiness ? "Business email" : "Email"}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={isBusiness ? "owner@business.com" : "you@example.com"}
              type="email"
              value={email}
            />
            <Field
              label="Password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              type="password"
              value={password}
            />
            {!isRegister ? (
              <div className="-mt-2 flex justify-end">
                <Link className="text-sm font-semibold text-accent hover:text-primary" href={forgotPasswordHref}>
                  Forgot password?
                </Link>
              </div>
            ) : null}
            {isRegister ? (
              <Field
                label="Confirm password"
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter password"
                type="password"
                value={confirmPassword}
              />
            ) : null}

            <button
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 font-semibold text-white shadow-soft disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? copy.submittingLabel : copy.submitLabel}
            </button>
          </form>

          <div className="mt-5 border-t border-line pt-5 text-center text-sm text-muted">
            <Link className="font-semibold text-accent hover:text-primary" href={copy.switchHref}>
              {copy.switchLabel}
            </Link>
          </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function RegistrationConfirmation({
  feedback,
  isResending,
  loginHref,
  onChangeEmail,
  onResend,
  pendingEmail
}: {
  feedback: Feedback;
  isResending: boolean;
  loginHref: AuthHref;
  onChangeEmail: () => void;
  onResend: () => void;
  pendingEmail: string;
}) {
  return (
    <div aria-live="polite" className="py-2 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent">
        <Mail className="h-8 w-8" />
      </div>
      <p className="mt-5 text-sm font-semibold uppercase tracking-wider text-accent">One more step</p>
      <h2 className="mt-2 font-display text-3xl font-semibold">Check your inbox</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
        We sent a confirmation link to <strong className="break-all text-ink">{pendingEmail}</strong>. Open it to activate
        your account and continue to your dashboard.
      </p>

      <div className="mx-auto mt-6 max-w-md rounded-2xl border border-line bg-mist p-4 text-left text-sm leading-6 text-muted">
        <p className="flex items-start gap-2">
          <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-accent" />
          Check your spam, junk, and promotions folders if it is not in your inbox.
        </p>
        <p className="mt-3 flex items-start gap-2">
          <LogIn className="mt-1 h-4 w-4 shrink-0 text-accent" />
          Already confirmed this email before? Supabase will not send another signup email. Use Go to login instead.
        </p>
      </div>

      {feedback ? (
        <div className="mt-4">
          <FeedbackAlert feedback={feedback} />
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-accent px-4 font-semibold text-white disabled:opacity-60"
          disabled={isResending}
          onClick={onResend}
          type="button"
        >
          <RefreshCw className={`h-4 w-4 ${isResending ? "animate-spin" : ""}`} />
          {isResending ? "Sending..." : "Resend email"}
        </button>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-line bg-panel px-4 font-semibold"
          href={loginHref}
        >
          Go to login
        </Link>
      </div>
      <button
        className="mt-5 text-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline"
        onClick={onChangeEmail}
        type="button"
      >
        Enter a different email address
      </button>
    </div>
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

function Field({
  label,
  onChange,
  placeholder,
  type = "text",
  value
}: {
  label: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input
        className="min-h-11 rounded-2xl border border-line bg-panel px-3 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/10"
        onChange={onChange}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
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
