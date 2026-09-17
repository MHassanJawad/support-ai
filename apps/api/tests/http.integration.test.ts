import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }));
vi.mock("../src/config/env", () => ({
  env: { NODE_ENV: "test", RATE_LIMIT_WINDOW_MS: 60000, RATE_LIMIT_MAX: 100, GEMINI_API_KEY: "test" },
  allowedOrigins: ["http://localhost:3000"]
}));
vi.mock("../src/config/supabase", () => ({
  supabaseAuth: { auth: { getUser: mocks.getUser } },
  supabaseAdmin: { from: mocks.from }
}));
import { createApp } from "../src/app";

let server: Server;
let base: string;
beforeAll(async () => {
  server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterAll(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
beforeEach(() => vi.resetAllMocks());

describe("HTTP authentication and error contracts", () => {
  it("returns 401 for every protected workspace route without a bearer token", async () => {
    for (const path of ["/profile", "/documents", "/faqs", "/chat/conversations", "/analytics/summary"]) {
      const response = await fetch(`${base}/api/v1${path}`);
      expect(response.status).toBe(401);
      expect((await response.json()).error.requestId).toBeTruthy();
    }
  });
  it("rejects unauthenticated customer chat", async () => {
    const response = await fetch(`${base}/api/v1/public/businesses/00000000-0000-4000-8000-000000000001/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: "Hello" })
    });
    expect(response.status).toBe(401);
  });
  it("rejects an expired token", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: "Expired" } });
    const response = await fetch(`${base}/api/v1/profile`, { headers: { Authorization: "Bearer expired" } });
    expect(response.status).toBe(401);
  });
  it("rejects malformed JSON with a readable validation error", async () => {
    const response = await fetch(`${base}/api/v1/businesses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });
  it("does not let read-only members modify FAQs", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
    const chain: Record<string, unknown> = {};
    for (const name of ["select", "eq", "order", "limit"]) chain[name] = vi.fn(() => chain);
    chain.maybeSingle = vi.fn(async () => ({ data: { business_id: "business", role: "member" }, error: null }));
    mocks.from.mockReturnValue(chain);
    const response = await fetch(`${base}/api/v1/faqs`, { method: "POST", headers: { Authorization: "Bearer valid", "Content-Type": "application/json" }, body: JSON.stringify({ question: "Hours?", answer: "9 to 5" }) });
    expect(response.status).toBe(403);
  });
  it("returns JSON for unknown routes", async () => {
    const response = await fetch(`${base}/missing`);
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("RESOURCE_NOT_FOUND");
  });
  it("blocks another customer's conversation even when its UUID is known", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "customer-a" } }, error: null });
    mocks.from.mockImplementation((table: string) => {
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "order", "limit"]) chain[method] = vi.fn(() => chain);
      chain.maybeSingle = vi.fn(async () => ({ data: table === "business_members" ? null
        : { customer_id: "customer-b", messages: [] }, error: null }));
      return chain;
    });
    const response = await fetch(`${base}/api/v1/public/businesses/00000000-0000-4000-8000-000000000001/conversations/00000000-0000-4000-8000-000000000002`, {
      headers: { Authorization: "Bearer valid" }
    });
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("AUTHORIZATION_FAILED");
  });
  it("returns structured rate limit errors after a burst", async () => {
    let response: Response | undefined;
    for (let index = 0; index < 101; index++) response = await fetch(`${base}/health`);
    expect(response?.status).toBe(429);
    expect((await response!.json()).error.code).toBe("RATE_LIMITED");
  });
});
