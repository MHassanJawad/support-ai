// Main authenticated business dashboard for documents, FAQs, chat, and analytics.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  BarChart3,
  Building2,
  ExternalLink,
  FileText,
  FileUp,
  LayoutDashboard,
  Loader2,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  UploadCloud,
  X
} from "lucide-react";
import { apiRequest } from "../lib/api";
import { supabase } from "../lib/supabase";
import { ThemeToggle } from "./ThemeToggle";
import { StatusToast } from "./ui";

interface Business {
  id: string;
  name: string;
  industry: string;
  address: string;
  created_at: string;
}

interface Membership {
  role: string;
  businesses: Business | Business[];
}

interface Profile {
  userId: string;
  memberships: Membership[];
}

interface DocumentRow {
  id: string;
  filename: string;
  status: string;
  created_at?: string;
}

interface FaqRow {
  id: string;
  question: string;
  answer: string;
}

interface AnalyticsSummary {
  dailyUsage: Record<string, number>;
  totalQueries: number;
  averageResponseTimeMs: number;
  mostAskedQuestions: Array<{ question: string; count: number }>;
}

interface ChatSource {
  documentId: string;
  documentName: string;
  chunkId: string;
  score: number;
  excerpt: string;
}

type ActionName = "refresh" | "business" | "upload" | "faq" | "chat" | "delete";

const navItems = [
  { label: "Overview", id: "overview", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "Business profile", id: "business-profile", icon: <Building2 className="h-4 w-4" /> },
  { label: "Documents", id: "documents", icon: <FileText className="h-4 w-4" /> },
  { label: "FAQs", id: "faqs", icon: <MessageSquare className="h-4 w-4" /> },
  { label: "Analytics & chat", id: "analytics", icon: <BarChart3 className="h-4 w-4" /> },
  { label: "Conversations", id: "conversations", icon: <MessageSquare className="h-4 w-4" /> }
];

export function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [faqs, setFaqs] = useState<FaqRow[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [conversationId, setConversationId] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [answerSources, setAnswerSources] = useState<ChatSource[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState<ActionName | null>("refresh");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");
  const [editingBusiness, setEditingBusiness] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FaqRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ kind: "documents" | "faqs"; id: string; name: string } | null>(null);
  const [conversations, setConversations] = useState<Array<{ id: string; title: string; messages: Array<{ id: string; sender: string; content: string; created_at: string }> }>>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (pendingDelete || error) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pendingDelete, error]);

  useEffect(() => {
    const stored = window.localStorage.getItem("supportai-sidebar-collapsed");
    setIsCollapsed(stored === "true");
  }, []);

  const activeBusiness = useMemo(() => {
    const firstMembership = profile?.memberships?.[0];
    if (!firstMembership) {
      return null;
    }

    return Array.isArray(firstMembership.businesses) ? firstMembership.businesses[0] ?? null : firstMembership.businesses;
  }, [profile]);

  async function refresh(options: { silent?: boolean } = {}) {
    if (!options.silent) {
      setBusyAction("refresh");
    }
    setError("");

    try {
      const profileData = await apiRequest<Profile>("/api/v1/profile");
      setProfile(profileData);
      const hasBusiness = profileData.memberships.length > 0;

      if (!hasBusiness) {
        setDocuments([]);
        setFaqs([]);
        setAnalytics(null);
        if (!options.silent) {
          setNotice("Create your business workspace to unlock uploads, FAQs, chat, and analytics.");
        }
        return;
      }

      const [documentData, faqData, analyticsData, conversationData] = await Promise.all([
        apiRequest<DocumentRow[]>("/api/v1/documents"),
        apiRequest<FaqRow[]>("/api/v1/faqs"),
        apiRequest<AnalyticsSummary>("/api/v1/analytics/summary"),
        apiRequest<typeof conversations>("/api/v1/chat/conversations")
      ]);
      setDocuments(documentData);
      setFaqs(faqData);
      setAnalytics(analyticsData);
      setConversations(conversationData);
      if (!options.silent) {
        setNotice("Dashboard refreshed.");
      }
    } catch (refreshError) {
      setError(getErrorMessage(refreshError));
    } finally {
      if (!options.silent) {
        setBusyAction(null);
      }
    }
  }

  useEffect(() => {
    refresh().catch((refreshError: unknown) => setError(getErrorMessage(refreshError)));
  }, []);

  async function createBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyAction || (activeBusiness && !editingBusiness)) {
      return;
    }

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") ?? "").trim();
    const industry = String(form.get("industry") ?? "").trim();
    const address = String(form.get("address") ?? "").trim();

    if (!name || !industry || !address) {
      setError("Enter the business name, industry, and address.");
      return;
    }

    setBusyAction("business");
    setError("");
    setNotice("");

    try {
      await apiRequest(activeBusiness ? "/api/v1/businesses/current" : "/api/v1/businesses", {
        method: activeBusiness ? "PATCH" : "POST",
        body: JSON.stringify({ name, industry, address })
      });
      formElement.reset();
      setNotice(`${name} was saved successfully.`);
      setEditingBusiness(false);
      await refresh({ silent: true });
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setBusyAction(null);
    }
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyAction || !activeBusiness) {
      return;
    }

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const selectedFile = form.get("file");
    if (!(selectedFile instanceof File) || !selectedFile.size) {
      setError("Choose a PDF or TXT file before uploading.");
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024 || !/\.(pdf|txt)$/i.test(selectedFile.name)) {
      setError("Choose a PDF or TXT file up to 10 MB.");
      return;
    }

    setBusyAction("upload");
    setError("");
    setNotice("");

    try {
      await apiRequest("/api/v1/documents", { method: "POST", body: form });
      formElement.reset();
      setNotice("Document is ready to answer customer questions.");
      await refresh({ silent: true });
    } catch (uploadError) {
      await refresh({ silent: true });
      setError(getErrorMessage(uploadError));
    } finally {
      setBusyAction(null);
      setIsDragging(false);
    }
  }

  async function createFaq(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyAction || !activeBusiness) {
      return;
    }

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const faqQuestion = String(form.get("question") ?? "").trim();
    const faqAnswer = String(form.get("answer") ?? "").trim();

    if (!faqQuestion || !faqAnswer) {
      setError("Enter both FAQ question and answer.");
      return;
    }

    setBusyAction("faq");
    setError("");
    setNotice("");

    try {
      await apiRequest(editingFaq ? `/api/v1/faqs/${editingFaq.id}` : "/api/v1/faqs", {
        method: editingFaq ? "PATCH" : "POST",
        body: JSON.stringify({ question: faqQuestion, answer: faqAnswer })
      });
      formElement.reset();
      setNotice(editingFaq ? "FAQ updated." : "FAQ added.");
      setEditingFaq(null);
      await refresh({ silent: true });
    } catch (faqError) {
      setError(getErrorMessage(faqError));
    } finally {
      setBusyAction(null);
    }
  }

  async function askQuestion() {
    if (busyAction || !activeBusiness) {
      return;
    }

    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      setError("Enter a question before asking the chatbot.");
      return;
    }

    setBusyAction("chat");
    setError("");
    setNotice("");

    try {
      const conversation =
        conversationId ||
        (
          await apiRequest<{ id: string }>("/api/v1/chat/conversations", {
            method: "POST",
            body: JSON.stringify({ title: trimmedQuestion.slice(0, 80) || "Customer chat" })
          })
        ).id;

      setConversationId(conversation);
      const response = await apiRequest<{ answer: string; sources: ChatSource[] }>(
        `/api/v1/chat/conversations/${conversation}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ content: trimmedQuestion })
        }
      );
      setAnswer(response.answer);
      setAnswerSources(response.sources);
      setQuestion("");
      setNotice(
        response.sources.length > 0
          ? `Answer generated from ${response.sources.length} retrieved source chunk${response.sources.length === 1 ? "" : "s"}.`
          : "Answer generated, but no matching knowledge-base chunks were retrieved."
      );
      await refresh({ silent: true });
    } catch (chatError) {
      setError(getErrorMessage(chatError));
    } finally {
      setBusyAction(null);
    }
  }

  function toggleSidebar() {
    const next = !isCollapsed;
    setIsCollapsed(next);
    window.localStorage.setItem("supportai-sidebar-collapsed", String(next));
  }

  async function confirmDelete() {
    if (!pendingDelete || busyAction) return;
    setBusyAction("delete");
    setError("");
    setNotice("");
    try {
      await apiRequest(`/api/v1/${pendingDelete.kind}/${pendingDelete.id}`, { method: "DELETE" });
      setPendingDelete(null);
      await refresh({ silent: true });
      setNotice("Deleted successfully.");
    } catch (failure) { setError(getErrorMessage(failure)); }
    finally { setBusyAction(null); }
  }

  const isWorkspaceLocked = !activeBusiness;
  const supportPath = activeBusiness ? `/support/${activeBusiness.id}` : "";
  const readyDocs = documents.filter((document) => document.status === "ready").length;

  return (
    <main className="min-h-screen bg-mist text-ink">
      <button
        aria-label="Open navigation"
        className="fixed left-4 top-4 z-40 flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-panel shadow-soft lg:hidden"
        onClick={() => setIsSidebarOpen(true)}
        type="button"
      >
        <Menu className="h-5 w-5" />
      </button>
      {isSidebarOpen ? <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setIsSidebarOpen(false)} /> : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-line bg-panel p-3 shadow-soft transition lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${isCollapsed ? "lg:w-20" : "lg:w-72"} w-72`}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex min-h-11 items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-panel">
              <MessageSquare className="h-5 w-5" />
            </span>
            {!isCollapsed ? <span className="font-display font-semibold">SupportAI</span> : null}
          </div>
          <button aria-label="Close navigation" className="min-h-11 min-w-11 rounded-xl lg:hidden" onClick={() => setIsSidebarOpen(false)} type="button">
            <X className="mx-auto h-5 w-5" />
          </button>
          <button aria-label="Toggle sidebar" title="Toggle sidebar" className="hidden min-h-11 min-w-11 rounded-xl border border-line lg:block" onClick={toggleSidebar} type="button">
            {isCollapsed ? <PanelLeftOpen className="mx-auto h-4 w-4" /> : <PanelLeftClose className="mx-auto h-4 w-4" />}
          </button>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <a
              className={`relative flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium ${
                activeSection === item.id ? "bg-accent/10 text-accent" : "text-muted hover:bg-mist hover:text-ink"
              }`}
              href={`#${item.id}`}
              title={item.label}
              aria-current={activeSection === item.id ? "location" : undefined}
              onClick={() => { setActiveSection(item.id); setIsSidebarOpen(false); }}
              key={item.label}
            >
              {activeSection === item.id ? <span className="absolute left-0 h-6 w-1 rounded-full bg-accent" /> : null}
              {item.icon}
              {!isCollapsed ? <span>{item.label}</span> : null}
            </a>
          ))}
        </nav>

        <div className="mt-auto rounded-2xl border border-line bg-mist p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-semibold text-panel">
              {activeBusiness?.name?.slice(0, 1).toUpperCase() ?? "B"}
            </div>
            {!isCollapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{activeBusiness?.name ?? "No business yet"}</p>
                <p className="truncate text-xs text-muted">{activeBusiness?.industry ?? "Create workspace"}</p>
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      <section className={`transition-all ${isCollapsed ? "lg:pl-20" : "lg:pl-72"}`}>
        <header className="border-b border-line bg-panel/85 px-4 py-4 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="pl-14 lg:pl-0">
              <p className="text-sm font-medium text-accent">Business owner dashboard</p>
              <h1 className="font-display text-2xl font-semibold">Workspace Overview</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-panel px-4 text-sm disabled:opacity-60"
                disabled={busyAction !== null}
                onClick={() => refresh()}
                type="button"
              >
                {busyAction === "refresh" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </button>
              <ThemeToggle />
              <button className="min-h-11 rounded-full border border-line bg-panel px-4 text-sm" onClick={() => { void supabase.auth.signOut().then(({ error: signOutError }) => { if (signOutError) setError(signOutError.message); }).catch(() => setError("Could not sign out. Please retry.")); }} type="button">
                Logout
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6" id="overview">
          <StatusToast message={error || notice} tone={error ? "error" : "success"} />
          {pendingDelete ? <section className="border-l-4 border-coral bg-panel p-4" role="alert">
            <p className="font-semibold">Delete {pendingDelete.name}?</p>
            <p className="mt-1 text-sm text-muted">This removes it from your knowledge base and cannot be undone.</p>
            <div className="mt-3 flex gap-3">
              <button className="min-h-11 rounded bg-coral px-4 text-white" disabled={!!busyAction} onClick={() => void confirmDelete()} type="button">{busyAction === "delete" ? "Deleting..." : "Delete"}</button>
              <button className="min-h-11 rounded border border-line px-4" disabled={!!busyAction} onClick={() => setPendingDelete(null)} type="button">Cancel</button>
            </div>
          </section> : null}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Documents uploaded" value={documents.length} />
            <KpiCard label="Ready documents" value={readyDocs} />
            <KpiCard label="Customer queries" value={analytics?.totalQueries ?? 0} />
            <KpiCard label="Avg response ms" value={analytics?.averageResponseTimeMs ?? 0} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <Panel id="business-profile" icon={<Building2 className="h-5 w-5" />} title="Business profile">
              {activeBusiness && !editingBusiness ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-line bg-mist p-4">
                    <p className="font-display text-xl font-semibold">{activeBusiness.name}</p>
                    <p className="mt-1 text-sm text-muted">{activeBusiness.industry}</p>
                    <p className="mt-2 text-sm text-muted">{activeBusiness.address}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <a
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-accent px-4 text-sm font-semibold text-white"
                      href={supportPath}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Preview Customer Portal
                    </a>
                    <button className="min-h-11 rounded-2xl border border-line bg-panel px-4 text-sm font-semibold" onClick={() => setEditingBusiness(true)} type="button">
                      Edit Business Info
                    </button>
                  </div>
                  <p className="break-all rounded-2xl border border-line bg-panel p-3 text-xs text-muted">{supportPath}</p>
                </div>
              ) : (
                <form className="grid gap-3" onSubmit={createBusiness}>
                  <Field label="Business name" name="name" placeholder="Business name" defaultValue={activeBusiness?.name ?? ""} />
                  <Field label="Industry" name="industry" placeholder="Retail, education..." defaultValue={activeBusiness?.industry ?? ""} />
                  <Field label="Business address" name="address" placeholder="Street, city, state or province" defaultValue={activeBusiness?.address ?? ""} />
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-4 font-semibold text-panel disabled:opacity-70"
                    disabled={busyAction !== null}
                    type="submit"
                  >
                    {busyAction === "business" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {busyAction === "business" ? "Saving..." : activeBusiness ? "Save changes" : "Create business"}
                  </button>
                  {editingBusiness ? <button type="button" onClick={() => setEditingBusiness(false)}>Cancel</button> : null}
                </form>
              )}
            </Panel>

            <Panel id="documents" icon={<FileUp className="h-5 w-5" />} title="Documents">
              <form
                className={`mb-4 rounded-3xl border border-dashed p-5 text-center ${
                  isDragging ? "border-accent bg-accent/10" : "border-line bg-mist"
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  if (!fileInput.current || busyAction || isWorkspaceLocked) return;
                  const transfer = new DataTransfer();
                  const file = event.dataTransfer.files[0];
                  if (file) transfer.items.add(file);
                  fileInput.current.files = transfer.files;
                }}
                onSubmit={uploadDocument}
              >
                <UploadCloud className="mx-auto h-9 w-9 text-accent" />
                <p className="mt-3 font-semibold">Drag files here or choose a document</p>
                <p className="mt-1 text-sm text-muted">PDF or TXT, up to 10 MB.</p>
                <input
                  className="mt-4 w-full rounded-2xl border border-line bg-panel px-3 py-3"
                  disabled={isWorkspaceLocked || busyAction !== null}
                  name="file"
                  ref={fileInput}
                  aria-label="Knowledge base document"
                  accept=".pdf,.txt,application/pdf,text/plain"
                  required
                  type="file"
                />
                <button
                  className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-accent px-4 font-semibold text-white disabled:opacity-70"
                  disabled={isWorkspaceLocked || busyAction !== null}
                  type="submit"
                >
                  {busyAction === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                  {busyAction === "upload" ? "Processing..." : "Upload New Document"}
                </button>
              </form>
              <div className="grid gap-3 sm:grid-cols-2">
                {documents.length > 0 ? (
                  documents.map((document) => <DocumentCard document={document} key={document.id} disabled={!!busyAction} onDelete={() => setPendingDelete({ kind: "documents", id: document.id, name: document.filename })} />)
                ) : (
                  <EmptyState message="Upload your first document to start answering customer questions." />
                )}
              </div>
            </Panel>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Panel id="faqs" title="FAQs">
              <form className="mb-4 grid gap-3" onSubmit={createFaq} key={editingFaq?.id ?? "new"}>
                <Field disabled={isWorkspaceLocked || busyAction !== null} label="Question" name="question" placeholder="What is your refund policy?" defaultValue={editingFaq?.question ?? ""} />
                <label className="grid gap-2 text-sm font-medium">
                  Answer
                  <textarea
                    className="min-h-24 rounded-2xl border border-line bg-panel px-3 py-3 text-sm focus:border-accent"
                    disabled={isWorkspaceLocked || busyAction !== null}
                    name="answer"
                    defaultValue={editingFaq?.answer ?? ""}
                    required
                    minLength={3}
                    maxLength={5000}
                    placeholder="Refunds are available within 14 days..."
                  />
                </label>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-4 font-semibold text-panel disabled:opacity-70"
                  disabled={isWorkspaceLocked || busyAction !== null}
                  type="submit"
                >
                  {busyAction === "faq" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {busyAction === "faq" ? "Saving..." : editingFaq ? "Save FAQ" : "Add FAQ"}
                </button>
                {editingFaq ? <button type="button" onClick={() => setEditingFaq(null)}>Cancel edit</button> : null}
              </form>
              <div className="space-y-3">
                {faqs.length > 0 ? (
                  faqs.map((faq) => (
                    <article className="rounded-2xl border border-line bg-mist p-4" key={faq.id}>
                      <p className="font-semibold">{faq.question}</p>
                      <p className="mt-1 text-sm leading-6 text-muted">{faq.answer}</p>
                      <div className="mt-2 flex gap-2">
                        <button aria-label={`Edit FAQ: ${faq.question}`} title="Edit FAQ" className="min-h-11 min-w-11 rounded border border-line" disabled={!!busyAction} onClick={() => setEditingFaq(faq)} type="button"><Pencil className="mx-auto h-4 w-4" /></button>
                        <button aria-label={`Delete FAQ: ${faq.question}`} title="Delete FAQ" className="min-h-11 min-w-11 rounded border border-line text-coral" disabled={!!busyAction} onClick={() => setPendingDelete({ kind: "faqs", id: faq.id, name: faq.question })} type="button"><Trash2 className="mx-auto h-4 w-4" /></button>
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyState message="Add FAQs to publish them in the customer portal." />
                )}
              </div>
            </Panel>

            <Panel id="analytics" icon={<MessageSquare className="h-5 w-5" />} title="Analytics & chat preview">
              <h3 className="mb-2 text-sm font-semibold">Daily queries</h3>
              <div className="mb-4 space-y-2">
                {Object.entries(analytics?.dailyUsage ?? {}).sort(([a], [b]) => b.localeCompare(a)).slice(0, 7).map(([day, count]) => <div className="flex items-center gap-3 text-sm" key={day}><span className="w-24 shrink-0">{day}</span><meter className="h-4 flex-1" min={0} max={Math.max(1, ...Object.values(analytics?.dailyUsage ?? {}))} value={count} aria-label={`Queries on ${day}`} /><span>{count}</span></div>)}
                {!analytics?.totalQueries ? <p className="text-sm text-muted">Your first conversation will appear here.</p> : null}
              </div>
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                {(analytics?.mostAskedQuestions ?? []).slice(0, 4).map((item) => (
                  <div className="rounded-2xl border border-line bg-mist p-3" key={item.question}>
                    <p className="truncate text-sm font-semibold">{item.question}</p>
                    <p className="text-xs text-muted">{item.count} queries</p>
                  </div>
                ))}
              </div>
              <textarea
                className="h-28 w-full rounded-2xl border border-line bg-panel px-3 py-3 text-sm"
                disabled={isWorkspaceLocked || busyAction !== null}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask a test customer question..."
                value={question}
                aria-label="Test customer question"
                maxLength={4000}
              />
              <button
                className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-accent px-4 font-semibold text-white disabled:opacity-70"
                disabled={isWorkspaceLocked || busyAction !== null}
                onClick={askQuestion}
                type="button"
              >
                {busyAction === "chat" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                {busyAction === "chat" ? "Thinking..." : "Ask"}
              </button>
              {answer ? <p className="mt-4 rounded-2xl border border-line bg-mist p-4 text-sm leading-6">{answer}</p> : null}
              {answerSources.length > 0 ? (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-semibold">Sources</p>
                  {answerSources.map((source) => (
                    <div className="rounded-2xl border border-line p-3 text-sm" key={source.chunkId}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate font-medium">{source.documentName}</p>
                        <span className="shrink-0 text-xs text-muted">{source.score.toFixed(3)}</span>
                      </div>
                      <p className="mt-1 line-clamp-3 text-muted">{source.excerpt}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </Panel>
          </div>
          <Panel id="conversations" title="Conversation history">
            {conversations.length ? conversations.map((conversation) => <details key={conversation.id} className="border-b border-line py-3">
              <summary className="cursor-pointer font-medium">{conversation.title}</summary>
              <div className="mt-3 space-y-3">{[...conversation.messages].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((message) => <div key={message.id} className="border-l-2 border-accent pl-3"><p className="text-xs font-semibold text-muted">{message.sender === "customer" ? "Customer" : "SupportAI"}</p><p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p></div>)}</div>
            </details>) : <EmptyState message="Customer conversations will appear here." />}
          </Panel>
        </div>
      </section>
    </main>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-2xl border border-line bg-panel p-4 shadow-sm hover:shadow-soft">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-3 font-display text-3xl font-semibold">{value}</p>
    </article>
  );
}

function Panel({ children, icon, title, id }: { children: React.ReactNode; icon?: React.ReactNode; title: string; id?: string }) {
  return (
    <section id={id} className="min-w-0 scroll-mt-5 border-t border-line py-5">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="font-display text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({
  disabled,
  label,
  name,
  placeholder
  , defaultValue
}: {
  disabled?: boolean;
  label: string;
  name: string;
  placeholder: string;
  defaultValue?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input
        className="min-h-11 rounded-2xl border border-line bg-panel px-3 text-sm focus:border-accent"
        disabled={disabled}
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required
        maxLength={name === "question" ? 500 : name === "address" ? 240 : name === "industry" ? 80 : 120}
        minLength={name === "address" ? 5 : name === "question" ? 3 : 2}
      />
    </label>
  );
}

function DocumentCard({ document, disabled, onDelete }: { document: DocumentRow; disabled: boolean; onDelete: () => void }) {
  const isReady = document.status === "ready";
  const isFailed = document.status === "failed";

  return (
    <article className="animate-in rounded-2xl border border-line bg-panel p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-mist text-accent">
          <FileText className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{document.filename}</p>
          <p className="text-xs text-muted">{document.created_at ? document.created_at.slice(0, 10) : "Uploaded"}</p>
        </div>
      </div>
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold ${
          isReady ? "bg-accent/10 text-accent" : isFailed ? "bg-coral/10 text-coral" : "bg-primary/10 text-primary"
        }`}
      >
        {document.status}
      </span>
      {document.status === "processing" ? <div className="mt-3 h-2 overflow-hidden rounded-full bg-line"><div className="h-full w-2/3 animate-pulse rounded-full bg-accent" /></div> : null}
      <button className="mt-3 flex min-h-11 items-center gap-2 text-sm text-coral" disabled={disabled} onClick={onDelete} type="button"><Trash2 className="h-4 w-4" />Delete</button>
      {isFailed ? <p className="mt-2 text-xs text-muted">Processing failed. Delete this entry and upload again after resolving the error.</p> : null}
    </article>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-mist p-5 text-center text-sm text-muted sm:col-span-2">
      {message}
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
