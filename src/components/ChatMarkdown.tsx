import { cn } from "@/lib/utils";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mt-3 text-base font-bold text-slate-900 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-2 text-sm font-semibold text-slate-900">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-2 text-sm font-medium text-slate-800">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="mt-2 leading-relaxed text-slate-800 first:mt-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-800">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-800">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mt-2 border-l-4 border-slate-300 pl-3 text-slate-700 italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-slate-200" />,
  a: ({ href, children }) => (
    <a
      href={href}
      className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-slate-900">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className || "");
    if (!isBlock) {
      return (
        <code className="rounded bg-slate-200/90 px-1 py-0.5 font-mono text-[0.85em] text-slate-900">
          {children}
        </code>
      );
    }
    return (
      <code
        className={cn(
          "block overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-xs leading-relaxed text-emerald-50",
          className,
        )}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mt-2 max-w-full overflow-x-auto rounded-lg">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="my-2 max-w-full overflow-x-auto">
      <table className="min-w-full border-collapse border border-slate-200 text-xs">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-100">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-800">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-slate-200 px-2 py-1.5 text-slate-900">{children}</td>
  ),
  tr: ({ children }) => <tr className="even:bg-slate-50/80">{children}</tr>,
};

export function ChatMarkdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("chat-md text-sm text-slate-800", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
