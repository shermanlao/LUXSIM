"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { ProjectLoadingDialog } from "@/components/ProjectLoadingDialog";

type Props = {
  href: string;
  name: string;
  updatedLabel: string;
  hasResults: boolean;
};

export function ProjectListCard({ href, name, updatedLabel, hasResults }: Props) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }
    event.preventDefault();
    setOpening(true);
    router.push(href);
  }

  return (
    <>
      {opening && <ProjectLoadingDialog />}
      <Link
        href={href}
        className="panel p-5 hover:border-[var(--accent-2)] transition-colors"
        onClick={onClick}
      >
        <h2 className="display text-2xl mb-2">{name}</h2>
        <p className="text-sm text-[var(--muted)]">Updated {updatedLabel}</p>
        <p className="text-xs mt-3 text-[var(--accent-2)]">
          {hasResults ? "Has calculation results" : "Not calculated yet"}
        </p>
      </Link>
    </>
  );
}
