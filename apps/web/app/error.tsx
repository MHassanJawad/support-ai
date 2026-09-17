"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
    <h1 className="text-2xl font-semibold">We couldn't load this page</h1>
    <p className="mt-3 text-muted">Please try again. Your saved workspace data is still available.</p>
    <button className="mt-6 min-h-11 rounded bg-accent px-4 text-white" onClick={reset} type="button">Try again</button>
    <a className="mt-4 text-accent underline" href="/">Return to home</a>
  </main>;
}
