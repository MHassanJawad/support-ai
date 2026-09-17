import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const businessId = "11111111-1111-4111-8111-111111111111";
const conversationId = "22222222-2222-4222-8222-222222222222";
const business = { id: businessId, name: "Harbor Books", industry: "Bookshop", address: "24 Market Street, Lahore", created_at: "2026-09-17T10:00:00Z" };
const faq = { id: "33333333-3333-4333-8333-333333333333", question: "When do you open?", answer: "We open at 9 AM." };

async function session(page: Page) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co";
  const ref = new URL(url).hostname.split(".")[0];
  const user = { id: "44444444-4444-4444-8444-444444444444", email: "demo@example.test", user_metadata: {}, app_metadata: {}, aud: "authenticated", created_at: business.created_at };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, aud: "authenticated", role: "authenticated" })}.test-signature`;
  await page.addInitScript(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: `sb-${ref}-auth-token`, data: { access_token: token, refresh_token: "test-refresh", token_type: "bearer", expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, user }
  });
  await page.route("**/auth/v1/**", (route) => route.fulfill({ json: user }));
}

async function assertLayout(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(result.violations.map((item) => ({ id: item.id, targets: item.nodes.map((node) => ({ target: node.target, reason: node.failureSummary })) }))).toEqual([]);
}

test("landing and separate authentication pages fit and expose working navigation", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Register your business" })).toBeVisible();
  const cta = await page.getByRole("link", { name: "Register your business" }).boundingBox();
  if (info.project.name === "desktop") expect(cta!.y + cta!.height).toBeLessThan(900);
  await assertLayout(page);
  await page.screenshot({ path: `test-results/landing-${info.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await assertLayout(page);
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  for (const role of ["customer", "business"]) {
    await page.goto(`/${role}/login`);
    await expect(page.getByRole("link", { name: "Forgot password?" })).toBeVisible();
    await assertLayout(page);
    await page.goto(`/${role}/register`);
    await expect(page.getByLabel("Confirm password", { exact: true })).toBeVisible();
    await assertLayout(page);
    await page.goto(`/${role}/reset-password`);
    await expect(page.getByRole("heading", { name: "Recovery link unavailable" })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("owner can upload, edit FAQs, update business and delete a document", async ({ page }, info) => {
  await session(page);
  let documents: Array<{ id: string; filename: string; status: string }> = [];
  let faqs = [faq];
  let currentBusiness = { ...business };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    let data: unknown = [];
    if (path.endsWith("/profile")) data = { userId: "demo", memberships: [{ role: "owner", businesses: currentBusiness }] };
    else if (path.endsWith("/businesses/current")) { currentBusiness = { ...currentBusiness, ...route.request().postDataJSON() }; data = currentBusiness; }
    else if (path.endsWith("/documents") && method === "POST") { documents = [{ id: "document", filename: "demo-policy.txt", status: "ready" }]; data = documents[0]; }
    else if (path.includes("/documents/") && method === "DELETE") { documents = []; return route.fulfill({ status: 204 }); }
    else if (path.endsWith("/documents")) data = documents;
    else if (path.includes("/faqs/") && method === "PATCH") { faqs = [{ ...faq, ...route.request().postDataJSON() }]; data = faqs[0]; }
    else if (path.endsWith("/faqs")) data = faqs;
    else if (path.endsWith("/analytics/summary")) data = { totalQueries: 0, dailyUsage: {}, averageResponseTimeMs: 0, mostAskedQuestions: [] };
    await route.fulfill({ json: { data } });
  });
  await page.goto("/business/dashboard");
  await expect(page.locator("#business-profile").getByText("Harbor Books", { exact: true })).toBeVisible();
  await page.getByLabel("Knowledge base document").setInputFiles({ name: "demo-policy.txt", mimeType: "text/plain", buffer: Buffer.from("Returns are available for 14 days.") });
  await page.getByRole("button", { name: "Upload New Document" }).click();
  await expect(page.getByRole("status")).toHaveText("Document is ready to answer customer questions.");
  await expect(page.getByText("ready", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit FAQ: When do you open?" }).click();
  await page.getByRole("textbox", { name: "Answer", exact: true }).fill("We open at 10 AM.");
  await page.getByRole("button", { name: "Save FAQ" }).click();
  await expect(page.getByText("We open at 10 AM.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit Business Info" }).click();
  await page.getByLabel("Business address").fill("42 Garden Road, Lahore");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("42 Garden Road, Lahore", { exact: true })).toBeVisible();
  await assertLayout(page);
  await page.screenshot({ path: `test-results/dashboard-${info.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await assertLayout(page);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("alert").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("demo-policy.txt", { exact: true })).toHaveCount(0);
});

test("customer can view FAQs, recover from a failed send and reopen saved chat", async ({ page }, info) => {
  await session(page);
  let fail = true;
  let sent = false;
  await page.route("**/api/v1/public/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = business;
    if (path.endsWith("/faqs")) data = [faq];
    else if (path.endsWith("/conversations")) data = sent ? [{ id: conversationId, title: "When do you open?" }] : [];
    else if (path.endsWith(`/conversations/${conversationId}`)) data = { messages: [{ sender: "customer", content: "When do you open?", created_at: business.created_at, metadata: {} }, { sender: "assistant", content: "We open at 9 AM.", created_at: business.created_at, metadata: {} }] };
    else if (path.endsWith("/chat")) {
      if (fail) { fail = false; return route.fulfill({ status: 502, json: { error: { message: "Service is temporarily unavailable. Please retry." } } }); }
      sent = true;
      data = { conversationId, answer: "We open at 9 AM.", sources: [] };
    }
    await route.fulfill({ json: { data } });
  });
  await page.goto(`/support/${businessId}`);
  await expect(page.getByRole("heading", { name: "Harbor Books", exact: true })).toBeVisible();
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "FAQs", exact: true }).click();
    await page.locator("summary").filter({ hasText: "When do you open?" }).click();
  }
  await expect(page.getByText("We open at 9 AM.").last()).toBeVisible();
  await page.getByLabel("Your question").fill("When do you open?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("temporarily unavailable");
  await expect(page.getByLabel("Your question")).toHaveValue("When do you open?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.getByRole("log")).toContainText("We open at 9 AM.");
  await page.reload();
  await expect(page.getByRole("log")).toContainText("We open at 9 AM.");
  await assertLayout(page);
  await page.screenshot({ path: `test-results/portal-${info.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await assertLayout(page);
});
