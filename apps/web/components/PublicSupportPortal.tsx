// Public customer support portal for a single business.
"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, HelpCircle, Loader2, Send, Sparkles } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import Link from "next/link";
import { apiRequest } from "../lib/api";
import { supabase } from "../lib/supabase";

interface Business {
  id: string;
  name: string;
  industry: string;
}

interface Faq {
  id: string;
  question: string;
  answer: string;
}

interface ChatSource {
  documentName: string;
  chunkId: string;
  score: number;
  excerpt: string;
}

interface ChatMessage {
  sender: "customer" | "assistant";
  content: string;
  sources?: ChatSource[];
  timestamp: string;
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const suggestedQuestions = ["What are your business hours?", "How do I request a refund?", "How can I contact support?"];

export function PublicSupportPortal({ businessId }: { businessId: string }) {
  const [business, setBusiness] = useState<Business | null>(null);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState("");
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const requestPending = useRef(false);
  const [signedIn, setSignedIn] = useState(false);
  const [showFaqs, setShowFaqs] = useState(false);
  const [history, setHistory] = useState<Array<{ id: string; title: string }>>([]);

  useEffect(() => {
    async function loadPortal() {
      setIsLoading(true);
      setError("");

      try {
        const [businessData, faqData] = await Promise.all([
          publicRequest<Business>(`/api/v1/public/businesses/${businessId}`),
          publicRequest<Faq[]>(`/api/v1/public/businesses/${businessId}/faqs`)
        ]);
        setBusiness(businessData);
        setFaqs(faqData);
        const { data: auth } = await supabase.auth.getSession();
        setSignedIn(!!auth.session);
        if (auth.session) {
          const saved = await apiRequest<Array<{ id: string; title: string }>>(`/api/v1/public/businesses/${businessId}/conversations`);
          setHistory(saved);
          if (saved[0]) await openConversation(saved[0].id);
        }
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      } finally {
        setIsLoading(false);
      }
    }

    loadPortal().catch((loadError: unknown) => setError(getErrorMessage(loadError)));
  }, [businessId]);

  async function openConversation(id: string) {
    if (requestPending.current) return;
    setError("");
    try {
      const conversation = await apiRequest<{ messages: Array<{ sender: "customer" | "assistant"; content: string; created_at: string; metadata: { sources?: ChatSource[] } }> }>(`/api/v1/public/businesses/${businessId}/conversations/${id}`);
      setConversationId(id);
      setMessages(conversation.messages.map((message) => ({
        sender: message.sender, content: message.content, timestamp: message.created_at,
        ...(message.metadata?.sources ? { sources: message.metadata.sources } : {})
      })));
    } catch (failure) { setError(getErrorMessage(failure)); }
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, isAsking]);

  function scrollToBottom() {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }

  async function askQuestion(nextQuestion = question) {
    const trimmedQuestion = nextQuestion.trim();
    if (!trimmedQuestion || requestPending.current) {
      return;
    }
    if (!signedIn) { setError("Sign in to start a conversation."); return; }
    if (trimmedQuestion.length > 4000) { setError("Keep your question under 4,000 characters."); return; }
    requestPending.current = true;

    setQuestion("");
    setError("");
    setIsAsking(true);
    setMessages((current) => [...current, { sender: "customer", content: trimmedQuestion, timestamp: new Date().toISOString() }]);

    try {
      const response = await apiRequest<{
        conversationId: string;
        answer: string;
        sources: ChatSource[];
      }>(`/api/v1/public/businesses/${businessId}/chat`, {
        method: "POST",
        body: JSON.stringify({
          content: trimmedQuestion,
          ...(conversationId ? { conversationId } : {})
        })
      });

      setConversationId(response.conversationId);
      setHistory((current) => current.some((item) => item.id === response.conversationId) ? current : [{ id: response.conversationId, title: trimmedQuestion.slice(0, 80) }, ...current]);
      setMessages((current) => [
        ...current,
        {
          sender: "assistant",
          content: response.answer,
          sources: response.sources,
          timestamp: new Date().toISOString()
        }
      ]);
    } catch (askError) {
      setMessages((current) => current.slice(0, -1));
      setQuestion(trimmedQuestion);
      setError(getErrorMessage(askError));
    } finally {
      requestPending.current = false;
      setIsAsking(false);
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-mist p-5">
        <div className="space-y-3">
          <div className="h-16 w-72 animate-pulse rounded-3xl bg-line" />
          <div className="h-40 w-72 animate-pulse rounded-3xl bg-line" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-mist text-ink">
      <header className="z-10 border-b border-line bg-panel/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary font-display font-semibold text-panel">
              {business?.name?.slice(0, 1).toUpperCase() ?? "S"}
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-display font-semibold">{business?.name ?? "Support Center"}</h1>
              <p className="truncate text-xs text-muted">
                {business?.industry ?? "Customer support"} - <span className="text-accent">Powered by AI</span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Link className="text-sm text-accent" href="/customer/dashboard">Businesses</Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div
        className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[320px_1fr]"
      >
        <aside className="hidden overflow-y-auto border-r border-line p-4 lg:block">
          <div className="mb-3 flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-accent" />
            <h2 className="font-display font-semibold">FAQs</h2>
          </div>
          <div className="space-y-3">
            {faqs.length > 0 ? (
              faqs.map((faq) => (
                <article className="rounded-2xl border border-line bg-mist p-3" key={faq.id}>
                  <h3 className="font-semibold">{faq.question}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">{faq.answer}</p>
                </article>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-line p-3 text-sm text-muted">No FAQs are published yet.</p>
            )}
          </div>
        </aside>

        <section className="relative flex min-h-0 flex-col rounded-3xl border border-line bg-panel shadow-soft">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <button className="min-h-11 rounded border border-line px-3 text-sm lg:hidden" onClick={() => setShowFaqs(!showFaqs)} aria-expanded={showFaqs} type="button">{showFaqs ? "Hide FAQs" : "FAQs"}</button>
            <select className="min-h-11 min-w-0 flex-1 rounded border border-line bg-panel px-2 text-sm" aria-label="Conversation history" value={conversationId} disabled={isAsking} onChange={(event) => { if (event.target.value) void openConversation(event.target.value); }}>
              <option value="">New conversation</option>
              {history.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            <button className="min-h-11 rounded border border-line px-3 text-sm" disabled={isAsking} onClick={() => { setConversationId(""); setMessages([]); setError(""); }} type="button">New chat</button>
          </div>
          {showFaqs ? <div className="max-h-52 overflow-y-auto border-b border-line p-4 lg:hidden">
            {faqs.length ? faqs.map((faq) => <details key={faq.id} className="mb-3"><summary className="cursor-pointer text-sm font-semibold">{faq.question}</summary><p className="mt-2 whitespace-pre-wrap text-sm text-muted">{faq.answer}</p></details>) : <p className="text-sm text-muted">No FAQs published yet.</p>}
          </div> : null}
          <div ref={scrollRef} role="log" aria-label="Conversation messages" aria-live="polite" onScroll={(event) => {
            const element = event.currentTarget;
            setShowScrollButton(element.scrollHeight - element.scrollTop - element.clientHeight > 220);
          }} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length > 0 ? (
              messages.map((message, index) => <ChatBubble key={`${message.sender}-${index}`} message={message} />)
            ) : (
              <WelcomeCard businessName={business?.name ?? "this business"} onAsk={askQuestion} />
            )}
            {isAsking ? <TypingIndicator /> : null}
            {error ? <p role="alert" className="rounded-2xl border border-coral/30 bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p> : null}
          </div>

          {showScrollButton ? (
            <button
              className="absolute bottom-28 right-5 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-primary text-panel shadow-soft"
              onClick={scrollToBottom}
              aria-label="Scroll to latest message"
              type="button"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          ) : null}

          <div className="border-t border-line p-3">
            {!signedIn ? <p className="mb-3 text-sm text-muted"><Link className="font-semibold text-accent underline" href="/customer/login">Sign in</Link> or <Link className="font-semibold text-accent underline" href="/customer/register">create an account</Link> to ask a question and save your conversations.</p> : null}
            <div className="flex items-end gap-2">
              <textarea
                className="max-h-36 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-mist px-3 py-3 text-sm"
                onChange={(event) => setQuestion(event.target.value)}
                aria-label="Your question"
                maxLength={4000}
                disabled={!signedIn || isAsking || !business}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    askQuestion();
                  }
                }}
                placeholder="Type your question..."
                rows={1}
                value={question}
              />
              <button
                className="flex min-h-11 min-w-11 items-center justify-center rounded-2xl bg-accent text-white disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isAsking || !question.trim() || !signedIn || !business}
                aria-label="Send question"
                title="Send question"
                onClick={() => askQuestion()}
                type="button"
              >
                {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function WelcomeCard({ businessName, onAsk }: { businessName: string; onAsk: (question: string) => void }) {
  return (
    <div className="mx-auto mt-4 max-w-lg p-4 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-primary text-panel">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="font-display text-2xl font-semibold">Ask {businessName} anything.</h2>
      <p className="mt-2 text-sm leading-6 text-muted">What can we help you with today?</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {suggestedQuestions.map((question) => (
          <button className="min-h-11 rounded-full border border-line bg-panel px-3 text-sm" key={question} onClick={() => onAsk(question)} type="button">
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isCustomer = message.sender === "customer";

  return (
    <article className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[82%] rounded-3xl p-4 ${isCustomer ? "bg-accent text-white" : "border border-line bg-mist text-ink"}`}>
        {!isCustomer ? (
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-accent">
            <Bot className="h-4 w-4" />
            SupportAI
          </div>
        ) : null}
        <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>
        <p className={`mt-2 text-xs ${isCustomer ? "text-white" : "text-muted"}`}>{new Date(message.timestamp).toLocaleTimeString()}</p>
        {message.sources && message.sources.length > 0 ? (
          <details className="mt-3 rounded-2xl border border-line bg-panel/70 p-3 text-xs text-ink">
            <summary className="cursor-pointer font-semibold">Sources</summary>
            <div className="mt-2 space-y-2">
              {message.sources.map((source) => (
                <div className="rounded-xl border border-line p-2" key={source.chunkId}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{source.documentName}</span>
                    <span className="shrink-0 text-muted">{source.score.toFixed(3)}</span>
                  </div>
                  <p className="mt-1 line-clamp-3 text-muted">{source.excerpt}</p>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </article>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-3xl border border-line bg-mist px-4 py-3">
        <span className="h-2 w-2 animate-bounce rounded-full bg-accent" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:120ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:240ms]" />
      </div>
    </div>
  );
}

async function publicRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);

  if (!(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers
  });

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
