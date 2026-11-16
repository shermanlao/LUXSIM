import { OfficialWaitDialog } from "@/components/OfficialWaitDialog";
import {
  OFFICIAL_WAIT_COPY,
  PROJECT_LOADING_TITLE_EN,
  PROJECT_LOADING_TITLE_ZH,
} from "@/lib/official-wait-dialog";

export { PROJECT_LOADING_TITLE_EN, PROJECT_LOADING_TITLE_ZH };

/** Official wait-state dialog shown while a project opens into the editor. */
export function ProjectLoadingDialog() {
  return (
    <OfficialWaitDialog
      titleEn={OFFICIAL_WAIT_COPY.projectLoading.titleEn}
      titleZh={OFFICIAL_WAIT_COPY.projectLoading.titleZh}
      titleId="project-loading-title"
      messageId="project-loading-message"
    />
  );
}
