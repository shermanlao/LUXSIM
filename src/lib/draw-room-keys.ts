/** Backspace: clear the whole typed length first, then remove the last corner. */
export function applyDrawRoomBackspace<T>(lengthBuf: string, draft: T[]): {
  lengthBuf: string;
  draft: T[];
} {
  if (lengthBuf) return { lengthBuf: "", draft };
  return { lengthBuf: "", draft: draft.slice(0, -1) };
}

/**
 * Esc while the Draw room tool is active: cancel a typed length or draft if
 * there is one; otherwise let a fullscreen handler (or anything else) see the key.
 */
export function drawRoomEscapeAction(
  lengthBuf: string,
  draftLength: number
): "cancel-draft" | "pass" {
  return lengthBuf || draftLength > 0 ? "cancel-draft" : "pass";
}
