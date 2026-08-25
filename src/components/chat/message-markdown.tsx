"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { Root, Text, Parent } from "mdast";
import { visit } from "unist-util-visit";
import { findMentionPatterns } from "@/lib/chat/mentions";

type MentionNode = { type: "mention"; userId: string; value: string };

/**
 * A remark plugin, not string preprocessing — mdast already breaks the body
 * into text/emphasis/code/link nodes for markdown's own syntax, so mentions
 * need to be recognized as their own node type *within* that tree (the same
 * way remark-gfm adds strikethrough) rather than as a separate string pass
 * that would run before or after markdown parsing and risk double-processing
 * a mention that lands inside e.g. a `code span` or **bold** run.
 */
function remarkMentions(members: { id: string; displayName: string }[]) {
  const patterns = findMentionPatterns(members);
  return () => (tree: Root) => {
    visit(tree, "text", (node: Text, index, parent: Parent | undefined) => {
      if (!parent || index === undefined || patterns.length === 0) return;
      const value = node.value;
      if (!value.includes("@")) return;

      const newNodes: (Text | MentionNode)[] = [];
      let cursor = 0;
      while (cursor < value.length) {
        const atIndex = value.indexOf("@", cursor);
        if (atIndex === -1) {
          newNodes.push({ type: "text", value: value.slice(cursor) });
          break;
        }
        if (atIndex > cursor) newNodes.push({ type: "text", value: value.slice(cursor, atIndex) });

        const remainder = value.slice(atIndex);
        let matched: { userId: string; length: number } | null = null;
        for (const { userId, pattern } of patterns) {
          const anchored = new RegExp(`^${pattern.source}`, "i");
          const m = anchored.exec(remainder);
          if (m && (!matched || m[0].length > matched.length)) matched = { userId, length: m[0].length };
        }

        if (matched) {
          newNodes.push({ type: "mention", userId: matched.userId, value: remainder.slice(0, matched.length) });
          cursor = atIndex + matched.length;
        } else {
          newNodes.push({ type: "text", value: "@" });
          cursor = atIndex + 1;
        }
      }

      if (newNodes.length > 1) {
        // @ts-expect-error -- mdast's Content union doesn't know about our custom "mention" leaf, but react-markdown only needs `type` to route to the matching `components` key.
        parent.children.splice(index, 1, ...newNodes);
        return index + newNodes.length;
      }
    });
  };
}

// Deliberately small surface — chat is a conversation, not a document editor.
// Headings/images/tables are not rendered as their block-level HTML (that
// belongs in the wiki/notes surfaces this app doesn't have, and a stray
// "# " in a chat message shouldn't blow a line up to page-title size); an
// h1-h6 or table syntax just falls back to plain inline text via the
// overrides below.
function buildComponents(): Components {
  return {
    p: ({ children }) => <>{children}</>,
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-2 hover:decoration-[var(--accent)]"
      >
        {children}
      </a>
    ),
    code: ({ className, children }) => {
      // remark-gfm marks fenced (multi-line) code blocks with a `language-*`
      // class on this same `code` node; inline `` `code` `` carries none —
      // that's the one signal available here to tell the two apart.
      const isBlock = /language-/.test(className ?? "");
      if (isBlock) {
        return (
          <pre className="my-1 overflow-x-auto rounded-md bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)] px-2.5 py-2 text-[12px]">
            <code>{children}</code>
          </pre>
        );
      }
      return <code className="rounded bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)] px-1 py-0.5 text-[0.9em]">{children}</code>;
    },
    ul: ({ children }) => <ul className="my-0.5 list-disc pl-4">{children}</ul>,
    ol: ({ children }) => <ol className="my-0.5 list-decimal pl-4">{children}</ol>,
    li: ({ children }) => <li className="my-0">{children}</li>,
    blockquote: ({ children }) => <blockquote className="my-0.5 border-l-2 border-border pl-2 text-muted-foreground">{children}</blockquote>,
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    h1: ({ children }) => <>{children}</>,
    h2: ({ children }) => <>{children}</>,
    h3: ({ children }) => <>{children}</>,
    h4: ({ children }) => <>{children}</>,
    h5: ({ children }) => <>{children}</>,
    h6: ({ children }) => <>{children}</>,
    img: ({ alt }) => <>{alt}</>,
    table: ({ children }) => <>{children}</>,
    // @ts-expect-error -- custom node type from remarkMentions above, not part of react-markdown's built-in Components map.
    mention: ({ node }: { node: MentionNode }) => (
      <span className="rounded bg-[var(--accent)]/15 px-1 py-0.5 font-medium text-[var(--accent)]">{node.value}</span>
    ),
  };
}

export function MessageMarkdown({ body, members }: { body: string; members: { id: string; displayName: string }[] }) {
  return (
    <span className="[&_p]:my-0">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMentions(members)]} components={buildComponents()}>
        {body}
      </ReactMarkdown>
    </span>
  );
}
