// Logged-in customer dashboard for browsing business support portals.
"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Building2, ExternalLink, Loader2, MapPin, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { ThemeToggle } from "./ThemeToggle";

interface Business {
  id: string;
  name: string;
  industry: string;
  address: string;
  created_at: string;
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function CustomerDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      setIsLoading(true);
      setError("");

      try {
        const [{ data }, businessData] = await Promise.all([supabase.auth.getSession(), publicRequest<Business[]>("/api/v1/public/businesses")]);
        setSession(data.session);
        setBusinesses(businessData);
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboard().catch((loadError: unknown) => setError(getErrorMessage(loadError)));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  const filteredBusinesses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return businesses;
    }

    return businesses.filter(
      (business) =>
        business.name.toLowerCase().includes(normalizedQuery) || business.industry.toLowerCase().includes(normalizedQuery)
    );
  }, [businesses, query]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-mist p-5">
        <Loader2 className="h-6 w-6 animate-spin text-teal" />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-mist p-5">
        <div className="rounded border border-line bg-panel p-5 text-center shadow-sm">
          <p className="mb-4 text-sm text-muted">Sign in as a customer to continue.</p>
          <Link className="rounded bg-teal px-4 py-2 text-sm font-medium text-white" href="/customer/login">
            Customer login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-mist">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <Link className="mb-2 flex items-center gap-2 font-semibold" href="/">
              <Sparkles className="h-4 w-4 text-teal" />
              SupportAI
            </Link>
            <h1 className="text-xl font-semibold text-ink">Customer Dashboard</h1>
            <p className="text-sm text-muted">Browse available business support centers.</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button className="min-h-11 rounded-full border border-line bg-panel px-4 text-sm" onClick={() => { void supabase.auth.signOut().then(({ error: signOutError }) => { if (signOutError) setError(signOutError.message); }).catch(() => setError("Could not sign out. Please retry.")); }} type="button">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-5 sm:px-5">
        <div className="mb-5 max-w-xl">
          <label className="mb-2 block text-sm font-medium text-ink" htmlFor="business-search">
            Find a business
          </label>
          <div className="flex items-center gap-2 rounded border border-line px-3 py-2">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              className="min-h-11 w-full bg-transparent outline-none"
              id="business-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or industry"
              value={query}
            />
          </div>
        </div>

        {error ? <p role="alert" className="mb-4 rounded border border-coral/30 bg-coral/10 px-3 py-2 text-sm text-coral">{error} <button type="button" className="underline" onClick={() => window.location.reload()}>Retry</button></p> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredBusinesses.length > 0 ? (
            filteredBusinesses.map((business) => (
              <article className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-sm hover:shadow-soft" key={business.id}>
                <div
                  aria-label={`${business.name} business cover`}
                  className="relative h-36 bg-cover"
                  role="img"
                  style={{
                    backgroundImage:
                      "linear-gradient(180deg, rgba(8, 15, 32, 0.04), rgba(8, 15, 32, 0.58)), url('/media/heroImager.webp')",
                    backgroundPosition: getBusinessImagePosition(business.id)
                  }}
                >
                  <div className="absolute bottom-4 left-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/30 bg-white/90 text-accent shadow-soft">
                    <Building2 className="h-5 w-5" />
                  </div>
                </div>
                <div className="flex flex-1 flex-col items-start p-5">
                  <h2 className="font-display text-lg font-semibold text-ink">{business.name}</h2>
                  <p className="mt-1 text-sm text-muted">{business.industry}</p>
                  <p className="mb-4 mt-3 flex flex-1 items-start gap-2 text-sm leading-6 text-muted">
                    <MapPin className="mt-1 h-4 w-4 shrink-0 text-accent" />
                    <span>{business.address}</span>
                  </p>
                  <Link
                    className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-white"
                    href={`/support/${business.id}`}
                  >
                    Open support center
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))
          ) : (
            <p className="rounded border border-dashed border-line bg-panel p-4 text-sm text-muted">
              No business support centers found.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

async function publicRequest<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`);

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message ?? "Request failed.");
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function getBusinessImagePosition(businessId: string): string {
  const position = businessId.split("").reduce((total, character) => total + character.charCodeAt(0), 0) % 60;
  return `${20 + position}% center`;
}
