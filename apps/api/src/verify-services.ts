// Read-only deployment preflight; reports readiness without printing credentials or customer data.
import { env } from "./config/env";
import { supabaseAdmin } from "./config/supabase";

let failed = false;
async function check(name: string, run: () => Promise<void>) {
  try { await run(); console.log(`PASS ${name}`); }
  catch (error) { failed = true; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : "Unavailable"}`); }
}

await check("Supabase connection", async () => {
  try {
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/health`, { headers: { apikey: env.SUPABASE_ANON_KEY }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Auth service returned HTTP ${response.status}.`);
  } catch (error) {
    const cause = error instanceof Error ? error.cause as { code?: string } | undefined : undefined;
    throw new Error(cause?.code ? `Network error ${cause.code}. Check the project URL and project status.` : "Auth service is unreachable.");
  }
});

if (!failed) {
await check("database tables", async () => {
  for (const table of ["businesses", "business_members", "documents", "document_chunks", "faqs", "conversations", "messages", "analytics_events"]) {
    const { error } = await supabaseAdmin.from(table).select("id", { head: true, count: "exact" }).limit(1);
    if (error) throw new Error(`${table}: ${error.code || "request failed"}`);
  }
});
await check("private knowledge-base bucket", async () => {
  const { data, error } = await supabaseAdmin.storage.getBucket(env.SUPABASE_STORAGE_BUCKET);
  if (error || !data) throw new Error("Configured bucket is unavailable.");
  if (data.public) throw new Error("Make the knowledge-base bucket private.");
});
await check("workspace migration", async () => {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error("Could not read database API schema.");
  const schema = await response.json() as { paths?: Record<string, unknown> };
  if (!schema.paths?.["/rpc/create_business_workspace"]) throw new Error("Apply db/migrations/003_demo_readiness.sql.");
});
} else {
  console.log("SKIP database, storage and migration checks until Supabase is reachable.");
}
await check("Gemini configured models", async () => {
  let pageToken = "";
  const models: Array<{ name: string; supportedGenerationMethods?: string[] }> = [];
  do {
    const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers: { "x-goog-api-key": env.GEMINI_API_KEY }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Model access returned HTTP ${response.status}.`);
    const page = await response.json() as { models?: typeof models; nextPageToken?: string };
    models.push(...(page.models ?? []));
    pageToken = page.nextPageToken ?? "";
  } while (pageToken);
  for (const [name, method] of [[env.GEMINI_EMBEDDING_MODEL, "embedContent"], [env.GEMINI_GENERATION_MODEL, "generateContent"]]) {
    if (!models.some((model) => model.name === `models/${name}` && model.supportedGenerationMethods?.includes(method!))) {
      throw new Error(`Configured model ${name} does not support ${method} for this key.`);
    }
  }
});
process.exitCode = failed ? 1 : 0;
