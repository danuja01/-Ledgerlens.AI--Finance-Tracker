import type { ChatMessage } from "@/lib/openaiChat";

/** Keep the last N complete user↔assistant pairs to control token use (user blobs are large). */
export function sliceThreadForContext(
  thread: ChatMessage[],
  maxPairs = 4,
): ChatMessage[] {
  const maxMessages = Math.max(2, maxPairs * 2);
  if (thread.length <= maxMessages) return thread;
  return thread.slice(-maxMessages);
}
