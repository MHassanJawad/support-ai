import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../src/config/env", () => ({ env: {
  GEMINI_API_KEY: "test-key", GEMINI_EMBEDDING_MODEL: "gemini-embedding-001",
  GEMINI_EMBEDDING_DIMENSIONS: 768, GEMINI_GENERATION_MODEL: "test-model"
} }));
import { GeminiAiProvider, buildRagPrompt, formatCustomerFacingAnswer } from "../src/services/ai-provider";
import { chunkText } from "../src/services/text-chunker";

afterEach(() => vi.unstubAllGlobals());
describe("embedding and retrieval regressions", () => {
  it("requests the configured dimensions and task type", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ embedding: { values: Array(768).fill(0.1) } })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await new GeminiAiProvider().embed("Refunds take 14 days", "RETRIEVAL_DOCUMENT", "policy.txt")).toHaveLength(768);
    const request = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(request[1].body))).toMatchObject({
      title: "policy.txt",
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: 768
    });
    expect(request[1].signal).toBeDefined();
  });
  it("rejects unexpected vector dimensions instead of silently truncating", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ embedding: { values: Array(3072).fill(0.1) } }))));
    await expect(new GeminiAiProvider().embed("Question", "RETRIEVAL_QUERY")).rejects.toMatchObject({ code: "AI_PROVIDER_ERROR" });
  });
  it("converts provider failures into the API error contract", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "quota exhausted" } }), { status: 429 })));
    await expect(new GeminiAiProvider().embed("Question", "RETRIEVAL_QUERY")).rejects.toMatchObject({ statusCode: 502 });
  });
  it("includes follow-up history while retaining grounded instructions", () => {
    const prompt = buildRagPrompt("And weekends?", "Closed on Sundays.", "customer: What are your hours?");
    expect(prompt).toContain("What are your hours?");
    expect(prompt).toContain("Never mention reference material, documents, sources, context, retrieval, a knowledge base");
  });
  it("removes internal retrieval language and citation markers from customer replies", () => {
    const answer = formatCustomerFacingAnswer(
      "**SupportAI** The provided information does not mention a physical shop location [1]."
    );
    expect(answer).toBe("I'm unable to confirm a physical shop location.");
  });
  it("preserves overlap across chunk boundaries", () => {
    const chunks = chunkText("abcdefghijklmnopqrstuv", 10, 3);
    expect(chunks[0]?.content.slice(-3)).toBe(chunks[1]?.content.slice(0, 3));
    expect(chunks.at(-1)?.content.endsWith("uv")).toBe(true);
  });
  it("rejects chunk parameters that could cause an infinite loop", () => {
    expect(() => chunkText("content", 0, 0)).toThrow(RangeError);
    expect(() => chunkText("content", 10, 10)).toThrow(RangeError);
  });
});
