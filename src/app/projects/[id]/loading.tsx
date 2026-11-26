import { CadEditorRoot } from "@/components/editor/CadEditorRoot";
import { ProjectLoadingDialog } from "@/components/ProjectLoadingDialog";

/** Route-level fallback while the project server page is loading. */
export default function ProjectRouteLoading() {
  return (
    <CadEditorRoot>
      <ProjectLoadingDialog />
    </CadEditorRoot>
  );
}
