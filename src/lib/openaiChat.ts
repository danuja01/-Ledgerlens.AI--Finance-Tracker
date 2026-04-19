const CHAT_URL = "https://api.openai.com/v1/chat/completions";

export function getOpenAiApiKey(): string | undefined {
  const k =
    import.meta.env.VITE_OPENAI_API_KEY?.trim() ||
    import.meta.env.VITE_OPEN_AI_API_KEY?.trim();
  return k || undefined;
}

/** Breakdown chart (pie or horizontal bar) — one value per segment. */
export type ChatChartBreakdownSpec = {
  id: string;
  kind: "pie" | "bar";
  title: string;
  subtitle?: string;
  currency: string;
  data: { name: string; value: number }[];
};

/** Multi-series time-series chart — one row per calendar month. */
export type ChatChartTrendSpec = {
  id: string;
  /** line = line chart per series; trend_bar = grouped vertical bars; cashflow = income+expense+net bars */
  kind: "line" | "trend_bar" | "cashflow";
  title: string;
  subtitle?: string;
  currency: string;
  /** Recharts-compatible data: each entry is one time point; keys = "label" + series keys. */
  data: Record<string, string | number>[];
  series: { key: string; name: string; color?: string }[];
};

export type ChatChartSpec = ChatChartBreakdownSpec | ChatChartTrendSpec;

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  /** Rendered below the assistant markdown when present (e.g. expense charts). */
  charts?: ChatChartSpec[];
};

/** OpenAI Chat Completions message shape (includes tool calls). */
export type ToolCallChunk = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ChatApiMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: ToolCallChunk[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

export async function sendChatCompletion(
  messages: ChatMessage[],
  apiKey: string,
): Promise<string> {
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      messages,
      temperature: 0.35,
      max_completion_tokens: 2500,
    }),
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = (await res.json()) as { error?: { message?: string } };
      if (err.error?.message) detail = err.error.message;
    } catch {
      try {
        detail = await res.text();
      } catch {
        /* ignore */
      }
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from model");
  return text;
}

/**
 * Stream chat completion; calls onDelta for each delta. Returns full text.
 * Pass AbortSignal to cancel (stop button).
 */
export async function streamChatCompletion(
  messages: ChatMessage[],
  apiKey: string,
  onDelta: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal,
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      messages,
      temperature: 0.35,
      max_completion_tokens: 2500,
      stream: true,
    }),
  });

  if (!res.ok) {
    let detail = await res.text();
    try {
      const j = JSON.parse(detail) as { error?: { message?: string } };
      if (j.error?.message) detail = j.error.message;
    } catch {
      /* keep text */
    }
    throw new Error(detail || res.statusText);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
        };
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onDelta(delta);
        }
      } catch {
        /* ignore partial JSON lines */
      }
    }
  }

  const rest = buffer.trim();
  if (rest.startsWith("data:")) {
    const payload = rest.slice(5).trim();
    if (payload !== "[DONE]") {
      try {
        const json = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
        };
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onDelta(delta);
        }
      } catch {
        /* ignore */
      }
    }
  }

  return full;
}
