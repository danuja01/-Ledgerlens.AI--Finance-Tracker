import type { ChatApiMessage, ToolCallChunk } from "@/lib/openaiChat";

const CHAT_URL = "https://api.openai.com/v1/chat/completions";

export async function chatCompletionNonStream(
  messages: ChatApiMessage[],
  apiKey: string,
  options: {
    tools?: unknown[];
    tool_choice?: "auto" | "none";
    temperature?: number;
    max_completion_tokens?: number;
    signal?: AbortSignal;
  } = {},
): Promise<{
  finish_reason: string | null;
  message: {
    role: "assistant";
    content: string | null;
    tool_calls?: ToolCallChunk[];
  };
}> {
  const body: Record<string, unknown> = {
    model: "gpt-5.4-mini",
    messages,
    temperature: options.temperature ?? 0.25,
    max_completion_tokens: options.max_completion_tokens ?? 4096,
  };
  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    body.tool_choice = options.tool_choice ?? "auto";
  }

  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: options.signal,
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) {
    let detail = raw;
    try {
      const j = JSON.parse(raw) as { error?: { message?: string } };
      if (j.error?.message) detail = j.error.message;
    } catch {
      /* keep */
    }
    throw new Error(detail || res.statusText);
  }

  const data = JSON.parse(raw) as {
    choices?: {
      finish_reason: string | null;
      message?: {
        role: string;
        content: string | null;
        tool_calls?: ToolCallChunk[];
      };
    }[];
  };
  const choice = data.choices?.[0];
  if (!choice?.message) throw new Error("Empty response from model");

  return {
    finish_reason: choice.finish_reason ?? null,
    message: {
      role: "assistant",
      content: choice.message.content ?? null,
      tool_calls: choice.message.tool_calls,
    },
  };
}

/**
 * Agent loop: model may request tools; we execute locally and send results until the model returns text.
 */
export async function runChatWithToolLoop(
  apiKey: string,
  initialMessages: ChatApiMessage[],
  tools: unknown[],
  executeTool: (name: string, argsJson: string) => object,
  options: {
    maxIterations?: number;
    signal?: AbortSignal;
    onToolRound?: (info: { round: number; toolNames: string[] }) => void;
  } = {},
): Promise<string> {
  const maxIterations = options.maxIterations ?? 10;
  const messages: ChatApiMessage[] = [...initialMessages];

  for (let i = 0; i < maxIterations; i++) {
    const { finish_reason, message } = await chatCompletionNonStream(
      messages,
      apiKey,
      {
        tools,
        signal: options.signal,
      },
    );

    if (message.tool_calls?.length) {
      const toolNames = message.tool_calls.map((t) => t.function.name);
      options.onToolRound?.({ round: i + 1, toolNames });

      messages.push({
        role: "assistant",
        content: message.content,
        tool_calls: message.tool_calls,
      });

      for (const tc of message.tool_calls) {
        const name = tc.function.name;
        const argsJson = tc.function.arguments ?? "{}";
        const result = executeTool(name, argsJson);
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
      continue;
    }

    if (message.content?.trim()) {
      return message.content;
    }

    if (finish_reason === "length") {
      throw new Error("Model response was truncated (length). Try a shorter question.");
    }

    throw new Error("Model returned no text and no tool calls.");
  }

  throw new Error("Too many tool rounds — try simplifying your question.");
}
