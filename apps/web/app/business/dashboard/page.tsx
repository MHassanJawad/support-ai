// Business owner dashboard route.
"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Dashboard } from "../../../components/Dashboard";
import { supabase } from "../../../lib/supabase";
import Link from "next/link";

export default function BusinessDashboardPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setLoaded(true));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!loaded) {
    return <main className="p-6">Loading...</main>;
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-mist p-5">
        <div className="rounded border border-line bg-panel p-5 text-center shadow-sm">
          <p className="mb-4 text-sm text-muted">Sign in as a business owner to continue.</p>
          <Link className="rounded bg-ink px-4 py-2 text-sm font-medium text-white" href="/business/login">
            Business login
          </Link>
        </div>
      </main>
    );
  }

  return <Dashboard />;
}
