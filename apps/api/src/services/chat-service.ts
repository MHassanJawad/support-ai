// Conversation and RAG answer orchestration for SupportAI chat.
import type { CreateConversationInput } from "@supportai/shared";
import { supabaseAdmin } from "../config/supabase";
import { AppError, NotFoundError } from "../errors/app-error";
import { aiProvider } from "./ai-provider";
import { retrieveRelevantChunks } from "./document-service";
import { listFaqs } from "./faq-service";

export async function createConversation(input: CreateConversationInput, businessId: string) {
  const { data, error } = await supabaseAdmin
    .from("conversations")
    .insert({
      business_id: businessId,
      customer_id: input.customerId ?? null,
      title: input.title ?? "New conversation"
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new AppError("DATABASE_ERROR", "Could not create conversation.", 500);
  }

  return data;
}

export async function listConversations(businessId: string) {
  const { data, error } = await supabaseAdmin
    .from("conversations")
    .select("*, messages(id, sender, content, created_at)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AppError("DATABASE_ERROR", "Could not list conversations.", 500);
  }

  return data;
}

export async function getConversation(conversationId: string, businessId: string) {
  const { data, error } = await supabaseAdmin
    .from("conversations")
    .select("*, messages(*)")
    .eq("id", conversationId)
    .eq("business_id", businessId)
    .order("created_at", { referencedTable: "messages", ascending: true })
    .maybeSingle();

  if (error) {
    throw new AppError("DATABASE_ERROR", "Could not load conversation.", 500);
  }

  if (!data) {
    throw new NotFoundError("Conversation was not found.");
  }

  return data;
}

export async function answerMessage(conversationId: string, businessId: string, content: string) {
  const startedAt = Date.now();
  const conversation = await getConversation(conversationId, businessId);
  const recentMessages = (conversation.messages ?? []).slice(-8) as Array<{ sender: string; content: string }>;
  const history = recentMessages.map((message) => `${message.sender}: ${message.content.slice(0, 2000)}`).join("\n");
  const previousQuestion = [...recentMessages].reverse().find((message) => message.sender === "customer")?.content;
  const retrievalQuery = previousQuestion ? `${previousQuestion.slice(0, 1000)}\n${content}` : content;
  const [documentSources, faqs] = await Promise.all([retrieveRelevantChunks(businessId, retrievalQuery), listFaqs(businessId)]);
  const words = new Set(retrievalQuery.toLowerCase().match(/\p{L}{3,}/gu) ?? []);
  const faqSources = (faqs ?? []).map((faq) => ({
    documentId: faq.id as string, chunkId: faq.id as string,
    documentName: `FAQ: ${faq.question}`, excerpt: `${faq.question}\n${faq.answer}`,
    score: [...words].filter((word) => `${faq.question} ${faq.answer}`.toLowerCase().includes(word)).length / Math.max(words.size, 1)
  })).filter((faq) => faq.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
  const sources = [...documentSources, ...faqSources];
  const answer = sources.length ? await aiProvider.generateAnswer(content, sources, history)
    : "I'm unable to confirm that detail right now. Please contact the business directly for the most accurate information.";

  const { data: assistantMessage, error: assistantMessageError } = await supabaseAdmin
    .from("messages")
    .insert([{
      business_id: businessId,
      conversation_id: conversationId,
      sender: "customer",
      content,
      metadata: {}
    }, {
      business_id: businessId,
      conversation_id: conversationId,
      sender: "assistant",
      content: answer,
      metadata: { sources }
    }])
    .select("*");

  if (assistantMessageError || !assistantMessage) {
    console.error(JSON.stringify({
      level: "error",
      message: "Could not persist chat messages",
      businessId,
      conversationId,
      supabaseError: assistantMessageError ? {
        code: assistantMessageError.code,
        message: assistantMessageError.message,
        details: assistantMessageError.details
      } : null
    }));
    throw new AppError("DATABASE_ERROR", "Could not persist assistant message.", 500);
  }

  await supabaseAdmin.from("analytics_events").insert({
    business_id: businessId,
    event_name: "chat_answered",
    properties: {
      question: content,
      responseTimeMs: Date.now() - startedAt,
      sourceCount: sources.length
    }
  });

  return {
    conversationId,
    messageId: assistantMessage.find((message) => message.sender === "assistant")!.id,
    answer,
    sources
  };
}
