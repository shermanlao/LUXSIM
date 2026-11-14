import type { ReactNode } from "react";

type InlineNode = string | { type: "strong" | "em" | "code" | "link"; text: string; href?: string };

function parseInline(text: string): ReactNode[] {
  const nodes: InlineNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push({ type: "strong", text: token.slice(2, -2) });
    } else if (token.startsWith("*")) {
      nodes.push({ type: "em", text: token.slice(1, -1) });
    } else if (token.startsWith("`")) {
      nodes.push({ type: "code", text: token.slice(1, -1) });
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) nodes.push({ type: "link", text: link[1], href: link[2] });
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes.map((node, i) => {
    if (typeof node === "string") return node;
    if (node.type === "strong") return <strong key={i}>{node.text}</strong>;
    if (node.type === "em") return <em key={i}>{node.text}</em>;
    if (node.type === "code") {
      return (
        <code key={i} className="rounded bg-[color-mix(in_srgb,var(--line)_55%,white)] px-1 py-0.5 text-[0.9em]">
          {node.text}
        </code>
      );
    }
    return (
      <a key={i} href={node.href} className="text-[var(--accent-2)] underline">
        {node.text}
      </a>
    );
  });
}

type Block =
  | { type: "h1" | "h2" | "p"; text: string }
  | { type: "ul" | "ol"; items: string[] };

export function parseUserGuideMarkdown(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").trim().split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push({ type: "h1", text: line.slice(2).trim() });
      i += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3).trim() });
      i += 1;
      continue;
    }
    if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^[-*] /, ""));
        i += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^\d+\. /, ""));
        i += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length) {
      const cur = lines[i] ?? "";
      if (!cur.trim() || cur.startsWith("#") || /^[-*] /.test(cur) || /^\d+\. /.test(cur)) break;
      para.push(cur);
      i += 1;
    }
    blocks.push({ type: "p", text: para.join(" ") });
  }
  return blocks;
}

export function UserGuideArticle({ markdown }: { markdown: string }) {
  const blocks = parseUserGuideMarkdown(markdown);
  return (
    <article className="user-guide space-y-4 text-[0.98rem] leading-relaxed">
      {blocks.map((block, i) => {
        if (block.type === "h1") {
          return (
            <h1 key={i} className="display text-4xl mb-2">
              {parseInline(block.text)}
            </h1>
          );
        }
        if (block.type === "h2") {
          return (
            <h2 key={i} className="text-xl font-semibold pt-6">
              {parseInline(block.text)}
            </h2>
          );
        }
        if (block.type === "p") {
          return (
            <p key={i} className="text-[var(--ink)]">
              {parseInline(block.text)}
            </p>
          );
        }
        if (block.type !== "ul" && block.type !== "ol") return null;
        const List = block.type === "ol" ? "ol" : "ul";
        const listClass =
          block.type === "ol" ? "list-decimal pl-6 space-y-1.5" : "list-disc pl-6 space-y-1.5";
        return (
          <List key={i} className={listClass}>
            {block.items.map((item, j) => (
              <li key={j}>{parseInline(item)}</li>
            ))}
          </List>
        );
      })}
    </article>
  );
}
