"use client";

import ReactMarkdown from "react-markdown";

/** Safe Markdown for chat bubbles (no raw HTML). */
export function ChatMarkdown({ children }: { children: string }) {
  const text = children ?? "";
  if (!text.trim()) return null;

  return (
    <div className="chat-md">
      <ReactMarkdown
        skipHtml
        components={{
          a: ({ href, children: c }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {c}
            </a>
          ),
          // Avoid huge headings in a bubble
          h1: ({ children: c }) => <p className="chat-md-strong">{c}</p>,
          h2: ({ children: c }) => <p className="chat-md-strong">{c}</p>,
          h3: ({ children: c }) => <p className="chat-md-strong">{c}</p>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
