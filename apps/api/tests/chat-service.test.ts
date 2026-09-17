import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), retrieve: vi.fn(), faqs: vi.fn(), generate: vi.fn(), insert: vi.fn() }));
vi.mock("../src/config/supabase", () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock("../src/services/document-service", () => ({ retrieveRelevantChunks: mocks.retrieve }));
vi.mock("../src/services/faq-service", () => ({ listFaqs: mocks.faqs }));
vi.mock("../src/services/ai-provider", () => ({ aiProvider: { generateAnswer: mocks.generate } }));
import { answerMessage } from "../src/services/chat-service";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.retrieve.mockResolvedValue([]);
  mocks.faqs.mockResolvedValue([{ id: "faq", question: "Refund policy?", answer: "Refunds within 14 days." }]);
  mocks.generate.mockResolvedValue("Refunds within 14 days. [1]");
  mocks.from.mockImplementation((table: string) => {
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "order"]) query[method] = vi.fn(() => query);
    query.maybeSingle = vi.fn(async () => ({ data: { messages: [{ sender: "customer", content: "What is your refund policy?" }] }, error: null }));
    query.insert = mocks.insert.mockImplementation(() => table === "messages"
      ? { select: async () => ({ data: [{ id: "answer", sender: "assistant" }], error: null }) }
      : Promise.resolve({ error: null }));
    return query;
  });
});
describe("RAG conversation persistence", () => {
  it("grounds answers in FAQs and provides conversation memory", async () => {
    const result = await answerMessage("conversation", "tenant", "What about refunds?");
    expect(result.sources[0]?.documentName).toBe("FAQ: Refund policy?");
    expect(mocks.generate.mock.calls[0]?.[2]).toContain("What is your refund policy?");
    expect(mocks.retrieve).toHaveBeenCalledWith("tenant", expect.stringContaining("What about refunds?"));
    expect(mocks.insert).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ business_id: "tenant", sender: "customer", metadata: {} }),
      expect.objectContaining({ business_id: "tenant", sender: "assistant" })
    ]));
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ event_name: "chat_answered", business_id: "tenant" }));
  });
  it("does not persist an unanswered customer turn when generation fails", async () => {
    mocks.generate.mockRejectedValue(new Error("Provider unavailable"));
    await expect(answerMessage("conversation", "tenant", "Refunds?")).rejects.toThrow("Provider unavailable");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("does not call generation when no knowledge matches", async () => {
    mocks.faqs.mockResolvedValue([]);
    const result = await answerMessage("conversation", "tenant", "Unknown topic");
    expect(result.answer).toContain("unable to confirm that detail");
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
