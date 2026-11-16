"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

export type GuideLang = "zh" | "en";
export const GUIDE_LANG_STORAGE_KEY = "luxsim-guide-lang";

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
  | { type: "ul" | "ol"; items: string[] }
  | { type: "img"; alt: string; src: string };

const IMAGE_LINE = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/;

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
    const image = line.trim().match(IMAGE_LINE);
    if (image) {
      blocks.push({ type: "img", alt: image[1] ?? "", src: image[2] ?? "" });
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
      if (!cur.trim() || cur.startsWith("#") || /^[-*] /.test(cur) || /^\d+\. /.test(cur) || IMAGE_LINE.test(cur.trim())) {
        break;
      }
      para.push(cur);
      i += 1;
    }
    blocks.push({ type: "p", text: para.join(" ") });
  }
  return blocks;
}

export function detectGuideBlockLang(text: string): GuideLang | "both" {
  const trimmed = text.trim();
  if (!trimmed || IMAGE_LINE.test(trimmed)) return "both";
  const cjk = (trimmed.match(/[\u3400-\u9FFF]/g) ?? []).length;
  return cjk >= 2 ? "zh" : "en";
}

export function localizeGuideHeading(text: string, lang: GuideLang): string {
  const parts = text.split(" / ");
  if (parts.length >= 2) {
    return (lang === "zh" ? parts[0] : parts.slice(1).join(" / ")).trim();
  }
  return text;
}

export function filterGuideBlocks(blocks: Block[], lang: GuideLang): Block[] {
  const out: Block[] = [];
  for (const block of blocks) {
    if (block.type === "h1" || block.type === "h2") {
      out.push({ ...block, text: localizeGuideHeading(block.text, lang) });
      continue;
    }
    if (block.type === "img") {
      out.push(block);
      continue;
    }
    if (block.type === "ul" || block.type === "ol") {
      const items = block.items.filter((item) => {
        const itemLang = detectGuideBlockLang(item);
        return itemLang === "both" || itemLang === lang;
      });
      if (items.length > 0) out.push({ ...block, items });
      continue;
    }
    if (block.type === "p") {
      const blockLang = detectGuideBlockLang(block.text);
      if (blockLang === "both" || blockLang === lang) out.push(block);
    }
  }
  return out;
}

function setGuideLang(lang: GuideLang, setter: (lang: GuideLang) => void) {
  setter(lang);
  try {
    window.localStorage.setItem(GUIDE_LANG_STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

export function UserGuideArticle({ markdown }: { markdown: string }) {
  const [lang, setLang] = useState<GuideLang>("zh");
  const allBlocks = useMemo(() => parseUserGuideMarkdown(markdown), [markdown]);
  const blocks = useMemo(() => filterGuideBlocks(allBlocks, lang), [allBlocks, lang]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(GUIDE_LANG_STORAGE_KEY);
      if (stored === "zh" || stored === "en") {
        setLang(stored);
        return;
      }
    } catch {
      /* ignore */
    }
    if (typeof navigator !== "undefined" && !navigator.language.toLowerCase().startsWith("zh")) {
      setLang("en");
    }
  }, []);

  const btn = (value: GuideLang, label: string) => (
    <button
      type="button"
      className={`rounded-md border px-3 py-1.5 text-sm ${
        lang === value
          ? "border-[var(--accent-2)] bg-[var(--accent-2)] text-white"
          : "border-[var(--line)] bg-white text-[var(--ink)] hover:bg-[color-mix(in_srgb,var(--line)_25%,white)]"
      }`}
      aria-pressed={lang === value}
      onClick={() => setGuideLang(value, setLang)}
    >
      {label}
    </button>
  );

  return (
    <article className="user-guide space-y-4 text-[0.98rem] leading-relaxed">
      <div
        className="mb-2 flex flex-wrap items-center justify-end gap-1"
        role="group"
        aria-label="Guide language"
        data-guide-lang-toggle=""
      >
        {btn("zh", "中文")}
        {btn("en", "English")}
      </div>
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
        if (block.type === "img") {
          const caption = localizeGuideHeading(block.alt, lang);
          return (
            <figure key={i} className="my-5 overflow-hidden rounded-lg border border-[var(--line)] bg-[#0f1c24]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={block.src} alt={caption} className="mx-auto block h-auto w-full" />
              {caption ? (
                <figcaption className="bg-white px-3 py-2 text-sm text-[var(--muted)]">{caption}</figcaption>
              ) : null}
            </figure>
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
