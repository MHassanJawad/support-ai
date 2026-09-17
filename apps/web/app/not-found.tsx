import Link from "next/link";

export default function NotFound() {
  return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
    <p className="font-semibold text-accent">SupportAI / 404</p>
    <h1 className="mt-3 text-3xl font-semibold">Page not found</h1>
    <p className="mt-3 text-muted">This page may have moved or the link may be incorrect.</p>
    <Link className="mt-6 text-accent underline" href="/">Return to home</Link>
  </main>;
}
