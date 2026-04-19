import type { ChatMessage } from "@/lib/openaiChat";

const STORAGE_KEY = "ledgerlens-chat-sessions-v2";

export type ChatSessionRecord = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  thread: ChatMessage[];
};

function safeParse(raw: string | null): ChatSessionRecord[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter(
      (x): x is ChatSessionRecord =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as ChatSessionRecord).id === "string" &&
        Array.isArray((x as ChatSessionRecord).thread),
    );
  } catch {
    return [];
  }
}

export function loadChatSessions(): ChatSessionRecord[] {
  if (typeof localStorage === "undefined") return [];
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

export function saveChatSessions(sessions: ChatSessionRecord[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    /* quota */
  }
}

export function newSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function titleFromQuestion(q: string): string {
  const t = q.replace(/\s+/g, " ").trim();
  if (t.length <= 48) return t || "New chat";
  return `${t.slice(0, 45)}…`;
}
