import { ChatMarkdown } from "@/components/ChatMarkdown";
import { useFinance } from "@/context/FinanceContext";
import { sliceThreadForContext } from "@/lib/chatContextWindow";
import {
  executeFinanceTool,
  FINANCE_TOOLS,
  formatLedgerFiltersSummary,
} from "@/lib/financeChatTools";
import {
  loadChatSessions,
  newSessionId,
  saveChatSessions,
  titleFromQuestion,
  type ChatSessionRecord,
} from "@/lib/chatSessions";
import {
  getOpenAiApiKey,
  type ChatApiMessage,
  type ChatMessage,
} from "@/lib/openaiChat";
import { runChatWithToolLoop } from "@/lib/openaiChatTools";
import { cn } from "@/lib/utils";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import systemPromptBase from "@/prompts/financial_assistant_system.txt?raw";

/** Max user↔assistant pairs kept in API context (older turns dropped; each send includes fresh filters + tools). */
const CONTEXT_PAIRS = 4;

function displayUserPayload(full: string): string {
  const m = full.match(/User question:\n([\s\S]*)$/);
  return m ? m[1].trim() : full;
}

export function FinancialChat() {
  const { processed, filtered, analytics, filters } = useFinance();
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState<ChatSessionRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const apiKey = getOpenAiApiKey();
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    let list = loadChatSessions();
    if (list.length === 0) {
      const id = newSessionId();
      const now = Date.now();
      list = [
        {
          id,
          title: "New chat",
          createdAt: now,
          updatedAt: now,
          thread: [],
        },
      ];
      saveChatSessions(list);
    }
    setSessions(list);
    setActiveId(list[0].id);
    setThread(list[0].thread);
  }, []);

  const persistActive = useCallback(
    (nextThread: ChatMessage[], title?: string) => {
      if (!activeId) return;
      setSessions((prev) => {
        const next = prev.map((s) => {
          if (s.id !== activeId) return s;
          return {
            ...s,
            thread: nextThread,
            updatedAt: Date.now(),
            title: title ?? s.title,
          };
        });
        saveChatSessions(next);
        return next;
      });
    },
    [activeId],
  );

  const selectSession = (id: string) => {
    const s = sessions.find((x) => x.id === id);
    if (!s) return;
    setActiveId(id);
    setThread(s.thread);
    setError(null);
  };

  const newChat = () => {
    const id = newSessionId();
    const now = Date.now();
    const rec: ChatSessionRecord = {
      id,
      title: "New chat",
      createdAt: now,
      updatedAt: now,
      thread: [],
    };
    setSessions((prev) => {
      const next = [rec, ...prev];
      saveChatSessions(next);
      return next;
    });
    setActiveId(id);
    setThread([]);
    setError(null);
  };

  const deleteSession = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        const rec: ChatSessionRecord = {
          id: newSessionId(),
          title: "New chat",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          thread: [],
        };
        saveChatSessions([rec]);
        setActiveId(rec.id);
        setThread([]);
        return [rec];
      }
      saveChatSessions(next);
      if (activeId === id) {
        setActiveId(next[0].id);
        setThread(next[0].thread);
      }
      return next;
    });
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread, open, loading, toolStatus, fullscreen]);

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  const send = useCallback(async () => {
    const q = input.trim();
    if (!q || loading) return;
    if (!apiKey) {
      setError("Add VITE_OPENAI_API_KEY to .env and restart the dev server.");
      return;
    }

    setError(null);
    setInput("");
    setLoading(true);
    setToolStatus("Connecting…");

    const userBlock = `Active dashboard filters (the app already limits data to this window):\n${formatLedgerFiltersSummary(filters)}\n\nFilters (JSON):\n${JSON.stringify(filters)}\n\nUser question:\n${q}`;
    const userMsg: ChatMessage = { role: "user", content: userBlock };

    const contextThread = sliceThreadForContext(thread, CONTEXT_PAIRS);
    const history: ChatApiMessage[] = contextThread.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
    const messages: ChatApiMessage[] = [
      { role: "system", content: systemPromptBase.trim() },
      ...history,
      { role: "user", content: userBlock },
    ];

    const isFirstUserMessage =
      thread.filter((m) => m.role === "user").length === 0;
    const firstTitle = isFirstUserMessage ? titleFromQuestion(q) : undefined;

    setThread((prev) => [...prev, userMsg]);

    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    const ctx = { processed, filtered, analytics, filters };

    try {
      const reply = await runChatWithToolLoop(
        apiKey,
        messages,
        FINANCE_TOOLS,
        (name, argsJson) => executeFinanceTool(ctx, name, argsJson),
        {
          signal,
          onToolRound: ({ round, toolNames }) => {
            setToolStatus(
              `Running ledger tools (step ${round}): ${toolNames.join(", ")}`,
            );
          },
        },
      );

      setToolStatus(null);
      setThread((prev) => {
        const next = [...prev, { role: "assistant", content: reply }];
        persistActive(next, firstTitle);
        return next;
      });
    } catch (e) {
      setToolStatus(null);
      if (e instanceof Error && e.name === "AbortError") {
        /* user hit Stop — no assistant message */
      } else {
        const msg = e instanceof Error ? e.message : "Something went wrong.";
        setError(msg);
      }
    } finally {
      setLoading(false);
      setToolStatus(null);
      abortRef.current = null;
    }
  }, [input, loading, apiKey, processed, filtered, analytics, filters, thread, persistActive]);

  const clearThread = () => {
    setThread([]);
    setError(null);
    persistActive([]);
  };

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => b.updatedAt - a.updatedAt),
    [sessions],
  );

  const shellClass = fullscreen
    ? "fixed inset-0 z-50 flex bg-slate-950/60 p-0 backdrop-blur-sm"
    : "fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center";

  const panelClass = fullscreen
    ? "relative z-10 flex h-full w-full max-w-none flex-col overflow-hidden bg-white shadow-2xl sm:flex-row"
    : "relative z-10 flex max-h-[90vh] w-[min(100%,80vw)] min-w-0 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg ring-2 ring-white/20 transition hover:bg-slate-800 sm:bottom-8 sm:right-8"
        aria-label="Open finance assistant"
      >
        <span className="text-2xl" aria-hidden>
          💬
        </span>
      </button>

      {open && (
        <div className={shellClass} role="dialog" aria-modal="true" aria-labelledby="chat-title">
          <button
            type="button"
            className={cn("absolute inset-0", fullscreen ? "cursor-default" : "cursor-default")}
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div
            className={cn(
              panelClass,
              !fullscreen && "rounded-2xl",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sidebar — sessions */}
            <aside
              className={cn(
                "flex shrink-0 flex-col border-slate-200 bg-slate-50",
                fullscreen
                  ? cn(
                      "w-full border-b sm:w-72 sm:border-b-0 sm:border-r",
                      sidebarOpen ? "flex" : "hidden sm:flex",
                    )
                  : "hidden",
              )}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Sessions
                </span>
                <button
                  type="button"
                  onClick={newChat}
                  className="rounded-lg bg-slate-900 px-2 py-1 text-xs font-medium text-white"
                >
                  + New
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {sortedSessions.map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      "group mb-1 flex cursor-pointer items-start gap-1 rounded-lg px-2 py-2 text-left text-sm transition",
                      s.id === activeId
                        ? "bg-slate-900 text-white"
                        : "bg-white text-slate-800 hover:bg-slate-200/80",
                    )}
                    onClick={() => selectSession(s.id)}
                  >
                    <span className="min-w-0 flex-1 truncate">{s.title}</span>
                    <button
                      type="button"
                      className="shrink-0 rounded px-1 text-xs opacity-0 group-hover:opacity-100"
                      onClick={(e) => deleteSession(s.id, e)}
                      aria-label="Delete session"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <p className="border-t border-slate-200 px-3 py-2 text-[10px] leading-snug text-slate-500">
                Context: last {CONTEXT_PAIRS} exchanges; each send includes current filters + ledger tools.
              </p>
            </aside>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 sm:px-4">
                {fullscreen && (
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 sm:hidden"
                    onClick={() => setSidebarOpen((o) => !o)}
                  >
                    {sidebarOpen ? "Hide list" : "Sessions"}
                  </button>
                )}
                <div className="min-w-0 flex-1">
                  <h2 id="chat-title" className="truncate font-semibold text-slate-900">
                    LedgerLens assistant
                  </h2>
                  <p className="text-xs text-slate-500">
                    Tool calling · markdown · GPT-4o-mini ·{" "}
                    {fullscreen ? "Full screen" : "Compact"}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  onClick={() => setFullscreen((f) => !f)}
                >
                  {fullscreen ? "Exit full" : "Full screen"}
                </button>
                {thread.length > 0 && (
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                    onClick={clearThread}
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>

              {!apiKey && (
                <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-900">
                  Set <code className="rounded bg-amber-100/80 px-1">VITE_OPENAI_API_KEY</code> in{" "}
                  <code className="rounded bg-amber-100/80 px-1">.env</code> and restart the dev server.
                </p>
              )}

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
                {thread.length === 0 && !loading && (
                  <p className="text-sm text-slate-600">
                    Ask about spending, income, or trends. The assistant runs <strong>ledger tools</strong>{" "}
                    (like ChatGPT function calling) so totals and counts come from your actual filtered
                    data—not guesses. Set the right <strong>date range</strong> in the dashboard first.
                    Sessions are saved in this browser.
                  </p>
                )}
                {thread.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-2xl px-4 py-3",
                      m.role === "user"
                        ? "ml-6 bg-slate-100 text-slate-900"
                        : "mr-4 border border-emerald-100/80 bg-emerald-50/50",
                    )}
                  >
                    {m.role === "user" ? (
                      <p className="whitespace-pre-wrap break-words text-sm">
                        {displayUserPayload(m.content)}
                      </p>
                    ) : (
                      <ChatMarkdown content={m.content} />
                    )}
                  </div>
                ))}
                {loading && (
                  <p className="text-xs text-slate-500">
                    {toolStatus ?? "Working…"}
                  </p>
                )}
                {error && !loading && (
                  <p className="text-xs text-rose-600">{error}</p>
                )}
                <div ref={bottomRef} />
              </div>

              <form
                className="border-t border-slate-200 p-3 sm:p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                <div className="flex flex-wrap gap-2">
                  <textarea
                    rows={fullscreen ? 2 : 2}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    placeholder="Ask about your finances… (Enter to send, Shift+Enter for new line)"
                    className="min-h-[44px] min-w-0 flex-1 resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                    disabled={loading}
                    autoComplete="off"
                  />
                  {loading ? (
                    <button
                      type="button"
                      onClick={stop}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-800"
                    >
                      Stop
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
                    >
                      Send
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
