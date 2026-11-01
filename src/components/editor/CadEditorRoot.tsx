import type { ReactNode } from "react";

/** Full-bleed dark CAD shell for project editor routes. */
export function CadEditorRoot({ children }: { children: ReactNode }) {
  return <div className="cad-editor-root">{children}</div>;
}
