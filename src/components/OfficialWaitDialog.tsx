import type { OfficialWaitCopy } from "@/lib/official-wait-dialog";

export type { OfficialWaitCopy };

/**
 * Official wait-state dialog. Reused by project open and any other slow work.
 * Not closed by a backdrop click, Esc, or a close button, and has no cancel action.
 */
export function OfficialWaitDialog({
  titleEn,
  titleZh,
  titleId = "official-wait-title",
  messageId = "official-wait-message",
}: OfficialWaitCopy & { titleId?: string; messageId?: string }) {
  return (
    <div className="official-wait-backdrop" role="presentation">
      <div
        className="official-wait-dialog"
        role="dialog"
        aria-modal="true"
        aria-busy="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        <div className="official-wait-spinner" aria-hidden="true" />
        <h2 id={titleId} className="display">
          {titleEn}
        </h2>
        <p id={messageId}>{titleZh}</p>
      </div>
    </div>
  );
}
