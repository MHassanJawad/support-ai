// Marketing landing page for SupportAI.
import { ArrowRight, BarChart3, Bot, Building2, MessageSquare, Sparkles, Upload, Users } from "lucide-react";
import Link from "next/link";
import { Reveal } from "../components/Reveal";
import { ThemeToggle } from "../components/ThemeToggle";

const features = [
  {
    icon: <Bot className="h-5 w-5" />,
    title: "AI-powered answers",
    body: "Customers get grounded responses from the exact support documents each business uploads."
  },
  {
    icon: <Upload className="h-5 w-5" />,
    title: "Easy document upload",
    body: "Owners add PDFs and text files, then SupportAI extracts, chunks, embeds, and indexes the content."
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: "Actionable analytics",
    body: "Track query volume, common questions, response timing, and support center readiness."
  }
];

const steps = [
  "Register a business workspace",
  "Upload support knowledge",
  "Share the AI customer portal"
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-mist text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-panel/90 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-5">
          <Link className="flex min-h-11 items-center gap-2 font-display font-semibold" href="/">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-panel">
              <Sparkles className="h-5 w-5" />
            </span>
            SupportAI
          </Link>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              <Link className="rounded-full border border-line bg-panel px-4 py-2 text-sm font-medium hover:shadow-soft" href="/customer/login">
                Customer login
              </Link>
              <Link className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-panel hover:shadow-soft" href="/business/login">
                Business login
              </Link>
            </div>
            <ThemeToggle />
          </div>
        </nav>
      </header>

      <section className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/media/heroImager.webp')" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(245,247,251,0.92)_0%,rgba(245,247,251,0.78)_42%,rgba(245,247,251,0.38)_72%,rgba(245,247,251,0.12)_100%)] dark:bg-[linear-gradient(90deg,rgba(11,16,32,0.94)_0%,rgba(11,16,32,0.80)_42%,rgba(11,16,32,0.48)_72%,rgba(11,16,32,0.22)_100%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-5 lg:py-20">
          <Reveal>
            <div>
              <p className="mb-4 font-display text-2xl font-semibold text-ink">SupportAI</p>
              <h1 className="fluid-title max-w-3xl font-display font-semibold">
              Turn business knowledge into instant customer support.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">
              Give customers clear answers from your business documents and FAQs, in one dedicated support center.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-white shadow-soft"
                  href="/business/register"
                >
                  Register your business
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-panel px-6 py-3 font-semibold text-ink shadow-sm"
                  href="/customer/login"
                >
                  Access a business portal
                  <Users className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </Reveal>

        </div>
      </section>

      <section className="border-y border-line bg-panel">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-10 sm:px-5 md:grid-cols-3">
          {features.map((feature, index) => (
            <Reveal delay={index * 100} key={feature.title}>
              <article className="h-full rounded-2xl border border-line bg-panel p-5 shadow-sm hover:shadow-soft">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  {feature.icon}
                </div>
                <h2 className="font-display text-lg font-semibold">{feature.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{feature.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-5">
        <Reveal>
          <div className="mb-8">
            <p className="font-semibold text-accent">How it works</p>
            <h2 className="fluid-heading mt-2 font-display font-semibold">From documents to answers in three steps.</h2>
          </div>
        </Reveal>
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <Reveal delay={index * 120} key={step}>
              <div className="relative rounded-2xl border border-line bg-panel p-5 shadow-sm">
                <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-primary font-display font-semibold text-panel">
                  {index + 1}
                </span>
                <h3 className="font-display text-lg font-semibold">{step}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {index === 0
                    ? "Owners sign up and create a secure workspace."
                    : index === 1
                      ? "Files and FAQs are indexed for retrieval."
                      : "Customers ask questions through a polished portal."}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <RoleCard
            body="Upload documents, manage FAQs, monitor queries, and publish a customer portal."
            href="/business/register"
            icon={<Building2 className="h-5 w-5" />}
            title="For business owners"
          />
          <RoleCard
            body="Browse support centers, ask AI-powered questions, and get answers from business knowledge bases."
            href="/customer/login"
            icon={<MessageSquare className="h-5 w-5" />}
            title="For customers"
          />
        </div>
      </section>

      <footer className="border-t border-line bg-panel">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p>SupportAI - AI customer support for modern businesses.</p>
          <div className="flex gap-4">
            <Link href="/business/login">Business</Link>
            <Link href="/customer/login">Customer</Link>
            <Link href="/customer/register">Create account</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function RoleCard({
  body,
  href,
  icon,
  title
}: {
  body: string;
  href: "/business/register" | "/customer/login";
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <Link className="rounded-2xl border border-line bg-panel p-6 shadow-sm hover:shadow-lift" href={href}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-panel">{icon}</div>
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
      <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-accent">
        Continue
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}
