// Unit tests for RAG prompt construction.
import { describe, expect, it } from "vitest";

describe("buildRagPrompt", () => {
  it("should instruct the model to avoid unsupported answers", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    process.env.GEMINI_API_KEY = "gemini";
    process.env.GEMINI_EMBEDDING_DIMENSIONS = "768";
    const { buildRagPrompt } = await import("../src/services/ai-provider");
    const prompt = buildRagPrompt("What is the refund window?", "Refunds are available for 14 days.");

    expect(prompt).toContain("Never mention reference material, documents, sources, context, retrieval, a knowledge base");
    expect(prompt).toContain("What is the refund window?");
    expect(prompt).toContain("Refunds are available for 14 days.");
  });
});
